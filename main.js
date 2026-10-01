const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { apply, tick, set } = require('./state')
const { AGENTS, launchAgent, makeWorktree, samePath, launchLabels } = require('./launch')
const setup = require('./setup')
const createPhone = require('./phone')
const createUpdater = require('./updater')

if (!app.requestSingleInstanceLock()) app.exit(0)

// Quitting leaves this marker so agent hooks don't start the notch straight back up; starting it clears it.
const QUIT_MARK = path.join(__dirname, '.quit')
fs.rmSync(QUIT_MARK, { force: true })
// Quit and reload let the notch play its goodbye first; it exits anyway if the page doesn't answer in 3s.
let leaving = null
function goodbye(kind, then) {
  if (leaving) return
  leaving = then
  if (win) win.webContents.send('goodbye', kind); else then()
  setTimeout(then, 3000)
}
const quit = () => { fs.writeFileSync(QUIT_MARK, ''); goodbye('quit', () => app.quit()) }
const reload = () => goodbye('reload', () => { app.relaunch(); app.exit(0) }) // full restart: picks up code changes and replays the welcome

// How long a permission waits in the notch before falling back to the agent's own prompt. Longer with a phone paired,
// since you may have walked away; the hooks give up at 58s (hook.js, plugin.js), Claude and agy at 60s (setup.js).
const holdMs = () => phone.enabled ? 55000 : 30000
const sessions = {}
const held = {} // session key -> { res, agent, timer }: permission requests waiting on your click
let win, foreground = null, keyboard = false

// What a paired phone may see: each agent's state, and the request only while it is really waiting on an answer.
const phone = createPhone({
  file: path.join(app.getPath('userData'), 'phone.json'),
  list: () => Object.values(sessions).map(s => ({ key: s.key, agent: s.agent, project: s.project, label: s.label, state: s.state, action: s.action, task: s.task, ask: held[s.key] ? s.request : null })),
  decide: (key, choice) => decide(key, choice),
})

// Win32 helper (window lookup, focus, grid), one line in, one line out.
const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'win.ps1')], { windowsHide: true })
const waiting = []
let buf = ''
helper.stdout.on('data', d => {
  buf += d
  for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) waiting.shift()?.(buf.slice(0, i).trim())
})
const win32 = cmd => new Promise(r => { waiting.push(r); helper.stdin.write(cmd + '\n') })

// Usage limits the agents report. Claude's come from its status line: rate_limits.five_hour / seven_day, each
// { used_percentage, resets_at (epoch s) }, only for Pro/Max plans and after the session's first reply.
const limits = {}
// New versions: checked from GitHub Releases, downloaded quietly, installed when you quit. Not when running from source.
const updates = createUpdater({
  updater: app.isPackaged ? require('electron-updater').autoUpdater : null,
  dir: app.getPath('userData'), version: app.getVersion(),
  onChange: s => win?.webContents.send('update', s),
})
const push = () => { win?.webContents.send('sessions', Object.values(sessions), limits); phone.broadcast() }
const clock = epochS => new Date(epochS * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// What Claude shows in its status line: context use, then the 5-hour and weekly limits, coloured as they fill up.
function statusText(s) {
  const paint = (label, pct) => {
    if (typeof pct !== 'number') return null
    const c = pct >= 90 ? '31' : pct >= 70 ? '33' : '2' // red, yellow, dim
    return `\x1b[${c}m${label} ${Math.round(pct)}%\x1b[0m`
  }
  return [paint('ctx', s?.context), paint('5h', limits.claude?.five?.used_percentage), paint('7d', limits.claude?.week?.used_percentage)]
    .filter(Boolean).join(' \x1b[2m·\x1b[0m ')
}

// Folders agents have worked in, newest first, for the launcher.
const RECENT = path.join(app.getPath('userData'), 'recent.json')
let recent = []
try { recent = JSON.parse(fs.readFileSync(RECENT, 'utf8')) } catch {}
function remember(dir) {
  if (!dir || /\.worktrees[\\/]/.test(dir)) return // launched worktrees aren't projects you'd pick again
  recent = [path.resolve(dir), ...recent.filter(d => !samePath(d, dir))].slice(0, 12)
  fs.writeFile(RECENT, JSON.stringify(recent), () => {})
}

// Names you give sessions, kept across notch restarts. ponytail: never pruned; it's a few bytes per rename
const LABELS = path.join(app.getPath('userData'), 'labels.json')
let labels = {}
try { labels = JSON.parse(fs.readFileSync(LABELS, 'utf8')) } catch {}
function rename(key, label) {
  const s = sessions[key]
  label = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (label) labels[key] = label; else delete labels[key]
  fs.writeFile(LABELS, JSON.stringify(labels), () => {})
  if (!s) return
  s.label = label
  // Also retitle the terminal. Claude Code keeps setting its own title, so for Claude this only sticks until its next update.
  if (s.pid && !s.app) win32(`title ${s.pid} ${Buffer.from(label || (s.agent + ' · ' + s.project)).toString('base64')}`)
  push()
}

// Agents launched from the notch that haven't reported in yet: their first event turns on AUTO and joins the tile batch.
const launched = [] // { agent, dir, auto, batch }
function claimLaunch(s) {
  // agy reports no folder until you've trusted it, so a folderless agy session matches a pending agy launch.
  const i = launched.findIndex(l => l.agent === s.agent && (samePath(l.dir, s.cwd) || !s.cwd))
  if (i < 0) return
  const [l] = launched.splice(i, 1)
  if (!s.cwd) { s.cwd = l.dir; s.project = path.basename(l.dir) }
  if (l.auto) s.auto = true
  if (l.label) rename(s.key, l.label) // "Claude 2", or the task it was given
  // You picked this folder and asked for AUTO, so agy's "trust this folder?" screen gets its Enter too.
  if (l.auto && s.agent === 'agy') pressWhenPrompted(s, PROMPT.trust)
  if (s.hwnd) l.batch.hwnds.push(s.hwnd)
  if (l.batch.hwnds.length === l.batch.total) tileBatch(l.batch)
}
function tileBatch(b) {
  if (b.done) return
  b.done = true
  clearTimeout(b.timer)
  if (b.hwnds.length > 1) grid(b.hwnds)
}

// Permission gates: the only hook calls whose reply matters. agy fires PreToolUse for every tool without saying
// which ones will prompt, so only shell commands are held (they're the prompts you'd otherwise Enter through).
function isGate(agent, event, p) {
  if (agent === 'agy') return event === 'PreToolUse' && p.toolCall?.name === 'run_command'
  if (agent === 'claude') return event === 'PermissionRequest'
  return event === 'permission' // opencode / kilo plugin
}

// choice: allow | deny | ask (= fall back to the agent's own prompt)
function answer(agent, choice) {
  if (agent === 'agy') return JSON.stringify({ decision: choice, ...(choice === 'deny' && { reason: 'Denied from the notch' }) })
  if (choice === 'ask') return ''
  if (agent === 'claude') return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: choice, ...(choice === 'deny' && { message: 'Denied from the notch' }) } } })
  return choice
}

function describeRequest(agent, p) {
  if (agent === 'agy') return { title: p.toolCall.args.toolSummary || 'Run command', detail: p.toolCall.args.CommandLine || '' }
  if (agent === 'claude') {
    const i = p.tool_input || {}
    return { title: `Allow ${p.tool_name}?`, detail: String(i.command || i.file_path || i.url || JSON.stringify(i)).slice(0, 400) }
  }
  return { title: p.title || 'Permission needed', detail: p.detail || '' }
}

function decide(key, choice) { // choice: allow | deny | ask | all (allow + AUTO from now on)
  const h = held[key]
  if (!h) return
  clearTimeout(h.timer)
  delete held[key]
  const s = sessions[key]
  if (s) {
    if (choice === 'all') s.auto = true
    s.request = null
    s.pendingSince = 0
    if (choice !== 'ask') set(s, 'working', Date.now())
  }
  h.res.end(answer(h.agent, choice === 'all' ? 'allow' : choice))
  if (s && h.agent === 'agy' && (choice === 'allow' || choice === 'all')) pressWhenPrompted(s)
  push()
}

// agy ignores a hook's "allow" (and its permissionOverrides) and always shows its own prompt, so approving an agy
// command means pressing Enter on that prompt. The Enter goes into that terminal's input queue only, and only once
// the prompt is actually on its screen; it stops as soon as the tool runs.
const sleep = ms => new Promise(r => setTimeout(r, ms))
const PROMPT = {
  permission: t => /1\.\s+Yes/.test(t) && /esc to cancel/i.test(t),
  trust: t => /Do you trust the contents of this project\?/.test(t) && /> Yes, I trust this folder/.test(t), // Enter = the highlighted Yes
}
async function pressWhenPrompted(s, isPrompt = PROMPT.permission) {
  const seq = s.seq
  for (let i = 0, presses = 0; i < 40 && presses < 2; i++) {
    await sleep(250)
    if (sessions[s.key] !== s || s.seq !== seq || !s.pid) return // the tool ran, or the session ended
    const screen = Buffer.from(await win32('screen ' + s.pid), 'base64').toString()
    if (isPrompt(screen)) { await win32('enter ' + s.pid); presses++; await sleep(1000) }
  }
}

async function handleEvent(agent, event, body, url, res) {
  let p = {}
  try { p = JSON.parse(body) } catch {}
  const s = apply(sessions, agent, event, p)
  // Locate the window on the first event, while the hook's process chain is still alive.
  if (s && !s.located) {
    s.located = true
    const [hwnd, pid, kind, appName] = (await win32('find ' + (+url.searchParams.get('pid') || 0))).split(' ')
    s.hwnd = hwnd === '0' ? null : hwnd
    s.pid = +pid || null
    s.app = kind === 'app' // the window is an app (Claude desktop, Antigravity IDE, VS Code), not a terminal
    s.appName = kind === 'app' ? (appName || '').toLowerCase() : ''
    s.label = labels[s.key] || ''
    remember(s.cwd)
    claimLaunch(s)
  }
  if (agent === 'claude' && p.rate_limits) limits.claude = { five: p.rate_limits.five_hour || null, week: p.rate_limits.seven_day || null, at: Date.now() }
  if (s && event === 'StopFailure' && p.error_type === 'rate_limit') {
    const w = [limits.claude?.five, limits.claude?.week].filter(Boolean).sort((a, b) => b.used_percentage - a.used_percentage)[0]
    if (w?.resets_at) s.action = `Usage limit reached · resets ${clock(w.resets_at)}`
  }
  push()
  if (event === 'StatusLine') return res.end(statusText(s)) // Claude prints this in its own status line
  if (s && s.auto && agent === 'agy' && event === 'PreToolUse') { res.end(answer(agent, 'ask')); return pressWhenPrompted(s) } // any agy tool can prompt
  if (!s || !isGate(agent, event, p)) return res.end('')
  if (s.auto) return res.end(answer(agent, 'allow'))
  // Already looking at that agent (or another request is open)? Let its own prompt handle it.
  if ((s.hwnd && s.hwnd === foreground) || held[s.key]) return res.end(answer(agent, 'ask'))

  s.request = describeRequest(agent, p)
  s.action = s.request.title
  set(s, 'waiting', Date.now())
  held[s.key] = { res, agent, timer: setTimeout(() => decide(s.key, 'ask'), holdMs()) }
  res.on('close', () => { // agent gave up on the hook (Ctrl+C, timeout): drop the request
    if (held[s.key]?.res === res && !res.writableEnded) { clearTimeout(held[s.key].timer); delete held[s.key]; s.request = null; push() }
  })
  push()
}

http.createServer((req, res) => {
  if (req.method === 'GET') return res.end(JSON.stringify(Object.values(sessions), null, 2)) // debug: curl localhost:47800
  const url = new URL(req.url, 'http://x')
  const [, agent, event] = url.pathname.split('/')
  let body = ''
  req.on('data', c => (body += c)).on('end', () => handleEvent(agent, event, body, url, res).catch(e => {
    console.error('hook event failed:', e) // a broken event must never leave an agent waiting on its hook
    if (!res.writableEnded) res.end('')
  }))
}).on('error', e => { if (e.code === 'EADDRINUSE') app.exit(0) }) // another notch (e.g. the installed one) is already running
  .listen(47800, '127.0.0.1')

const isAlive = pid => { try { process.kill(pid, 0); return true } catch { return false } }
setInterval(async () => {
  foreground = (await win32('fg')) || null
  let changed = tick(sessions, Date.now(), isAlive)
  for (const s of Object.values(sessions)) if (s.unread && s.hwnd && s.hwnd === foreground) { s.unread = false; changed = true }
  if (changed) push()
}, 700)

function focus(key) {
  const s = sessions[key]
  if (!s) return
  decide(key, 'ask') // answering in the terminal instead
  s.unread = false
  if (s.hwnd) win32('focus ' + s.hwnd)
  push()
}

let jumpIndex = 0
function jumpNext() { // Ctrl+Alt+J: cycle through agents that need you, then finished ones you haven't seen
  const list = Object.values(sessions).filter(s => s.hwnd && (s.state === 'waiting' || s.unread))
    .sort((a, b) => (b.state === 'waiting') - (a.state === 'waiting') || a.started - b.started)
  if (list.length) focus(list[jumpIndex++ % list.length].key)
}

function grid(only) { // tile agent windows (all, or just `only`) on the monitor under the mouse
  const hwnds = only || [...new Set(Object.values(sessions).map(s => s.hwnd).filter(Boolean))]
  if (!hwnds.length) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const top = display.id === screen.getPrimaryDisplay().id ? 52 : 0 // keep clear of the notch
  const a = display.workArea
  const r = screen.dipToScreenRect(null, { x: a.x, y: a.y + top, width: a.width, height: a.height - top })
  win32(`grid ${r.x} ${r.y} ${r.width} ${r.height} ${hwnds.join(',')}`)
}

function grabFocus() { // the notch is normally click-through and unfocusable; typing needs both off
  keyboard = true
  win.setIgnoreMouseEvents(false)
  win.setFocusable(true)
  win.setSkipTaskbar(true) // setFocusable resets window styles on Windows, which brings back a taskbar button
  win.focus()
}

function toggleKeyboard() { // Ctrl+Alt+N: open the panel with keyboard focus
  if (keyboard) return win.webContents.send('keyboard', false)
  grabFocus()
  win.webContents.send('keyboard', true)
}

const MAX_AGENTS = 8 // same cap as the launcher
async function launch({ agents, dir, prompt = '', prompts = null, auto = false, worktree = false }) {
  agents = Array.isArray(agents) ? agents : [] // the same agent may appear several times
  if (!agents.length) return { error: prompts ? 'Write at least one task' : 'Pick an agent' }
  if (agents.length > MAX_AGENTS) return { error: `That's a lot of windows: ${MAX_AGENTS} at most` }
  if (!agents.every(a => AGENTS.includes(a))) return { error: 'Unknown agent' }
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return { error: "That folder doesn't exist" }
  prompt = String(prompt).trim().slice(0, 8000)
  const batch = { total: agents.length, hwnds: [], done: false }
  batch.timer = setTimeout(() => tileBatch(batch), 25000) // agents that stay quiet until you type never report in
  try {
    const labels = launchLabels(agents, prompts)
    for (const [i, agent] of agents.entries()) {
      const task = prompts ? String(prompts[i] ?? '').trim().slice(0, 8000) : prompt
      const label = labels[i]
      const target = worktree ? await makeWorktree(dir, agent) : dir
      launched.push({ agent, dir: target, auto, batch, label })
      launchAgent(agent, target, task)
    }
  } catch (e) {
    return { error: /not a git repository/i.test(e.message) ? "Worktrees need a git repo, and this folder isn't one" : e.message }
  }
  remember(dir)
  return { ok: true }
}

ipcMain.on('keyboard-closed', () => {
  keyboard = false
  win.setFocusable(false)
  win.setSkipTaskbar(true)
  win.setIgnoreMouseEvents(true, { forward: true })
})
ipcMain.on('mouse', (_, over) => keyboard || win.setIgnoreMouseEvents(!over, { forward: true }))
ipcMain.on('focus', (_, key) => focus(key))
ipcMain.on('decide', (_, key, choice) => decide(key, choice))
ipcMain.on('auto', (_, key, on) => {
  if (!sessions[key]) return
  sessions[key].auto = on
  if (on) decide(key, 'allow')
  push()
})
ipcMain.on('dismiss', (_, key) => { decide(key, 'ask'); delete sessions[key]; push() })
ipcMain.on('grid', () => grid())
ipcMain.on('grab-focus', grabFocus)
ipcMain.on('rename', (_, key, label) => rename(key, label))
ipcMain.handle('recent', () => recent.filter(d => fs.existsSync(d)))
ipcMain.handle('browse', async () => {
  // Owned by the notch: sits above it, gets no taskbar button of its own, and hands focus back when it closes.
  const r = await dialog.showOpenDialog(win, { title: 'Choose a project folder', properties: ['openDirectory'] })
  grabFocus()
  remember(r.filePaths[0]) // first in Recent even if the launcher gets closed
  return r.filePaths[0] || null
})
ipcMain.handle('launch', (_, opts) => launch(opts))

// Setup sheet: which agents are connected, start with Windows, and whether first-run setup was finished.
const SETUP_DONE = path.join(app.getPath('userData'), 'setup-done')
const loginOpts = () => app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] } // from source, register electron + this folder
ipcMain.handle('setup-status', () => ({ agents: setup.status(), login: app.getLoginItemSettings(loginOpts()).openAtLogin, done: fs.existsSync(SETUP_DONE) }))
const hookRunner = () => setup.runner(app.isPackaged ? process.execPath : null)
ipcMain.handle('setup-connect', (_, agent, on) => {
  if (!setup.AGENTS.includes(agent)) return { error: 'Unknown agent' }
  try { setup.set(agent, !!on, on ? hookRunner() : null) } catch (e) { return { error: e.message } }
  return { agents: setup.status() }
})
ipcMain.handle('setup-limits', (_, on) => {
  try { setup.setLimits(!!on, hookRunner()) } catch (e) { return { error: e.message } }
  return { agents: setup.status() }
})
ipcMain.handle('setup-login', (_, on) => { app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() }); return app.getLoginItemSettings(loginOpts()).openAtLogin })
ipcMain.handle('setup-done', () => { fs.writeFileSync(SETUP_DONE, ''); return true })
ipcMain.handle('update-state', () => updates.state())
ipcMain.handle('update-check', () => updates.check())
ipcMain.handle('update-auto', (_, on) => updates.setAuto(!!on))
ipcMain.on('update-restart', () => goodbye('reload', () => updates.restart())) // the goodbye animation, then install and relaunch
ipcMain.handle('phone-info', () => phone.info())
ipcMain.handle('phone-set', (_, on) => { phone.set(!!on); return phone.info() })
ipcMain.handle('phone-renew', () => { phone.renew(); return phone.info() })
ipcMain.on('quit', quit)
ipcMain.on('reload', reload)
ipcMain.on('goodbye-done', () => leaving?.())
ipcMain.on('ready', push)

// A transparent window is recomposited whole on every animation frame, so it's only full size while the panel is
// open; collapsed, it just fits the pill and its cards (plus shadow).
const SIZES = { full: { width: 560, height: 720 }, compact: { width: 520, height: 230 } }
function size(full) {
  const { bounds } = screen.getPrimaryDisplay(), s = SIZES[full ? 'full' : 'compact']
  win.setBounds({ x: Math.round(bounds.x + (bounds.width - s.width) / 2), y: bounds.y, ...s })
}
ipcMain.on('size', (_, full) => size(!!full))

app.whenReady().then(() => {
  phone.start()
  updates.start()
  // Bring connected agents' hooks up to date with this version and point them at this copy
  try { setup.refresh(hookRunner()) } catch (e) { console.error('hook refresh failed:', e.message) }
  const { bounds } = screen.getPrimaryDisplay(), { width: W, height: H } = SIZES.compact
  win = new BrowserWindow({
    width: W, height: H, x: Math.round(bounds.x + (bounds.width - W) / 2), y: bounds.y,
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    hasShadow: false, focusable: false, alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile('index.html')

  const keys = { 'Control+Alt+N': toggleKeyboard, 'Control+Alt+J': jumpNext, 'Control+Alt+G': grid, 'Control+Alt+R': reload, 'Control+Alt+V': () => win?.webContents.send('venom'), 'Control+Alt+Q': quit }
  for (const [accel, fn] of Object.entries(keys)) if (!globalShortcut.register(accel, fn)) console.warn('shortcut taken: ' + accel)
})

app.on('will-quit', () => { globalShortcut.unregisterAll(); helper.kill() })
