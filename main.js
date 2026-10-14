const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, shell } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { apply, tick, set, homeOf } = require('./state')
const { AGENTS, launchAgent, launchIn, makeWorktree, worktrees, branches, bringHome, discard, samePath, launchLabels } = require('./launch')
const setup = require('./setup')
const createPhone = require('./phone')
const createUpdater = require('./updater')
const position = require('./position')
const { createTeam, slug } = require('./team')

if (!app.requestSingleInstanceLock()) process.exit(0) // app.exit doesn't stop this script; a duplicate must not clear .quit or spawn the helper

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
const reload = () => goodbye('reload', () => { win = null; app.relaunch(); app.exit(0) }) // exit skips 'closed', so drop win first: late IPC and the 700ms tick must not touch a dead window // full restart: picks up code changes and replays the welcome

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
// If the helper dies or never starts, answer everything queued with '' and every later call at once, so nothing hangs.
let helperDead = false
const helperGone = () => { helperDead = true; for (const r of waiting.splice(0)) r('') }
helper.on('exit', helperGone)
helper.on('error', helperGone)
helper.stdin.on('error', helperGone)
const win32 = cmd => helperDead ? Promise.resolve('') : new Promise(r => { waiting.push(r); helper.stdin.write(cmd + '\n') })

// Usage limits the agents report. Claude's come from its status line: rate_limits.five_hour / seven_day, each
// { used_percentage, resets_at (epoch s) }, only for Pro/Max plans and after the session's first reply.
const limits = {}
// New versions: checked from GitHub Releases, downloaded quietly, installed when you quit. Not when running from source.
const updates = createUpdater({
  updater: app.isPackaged ? require('electron-updater').autoUpdater : null,
  dir: app.getPath('userData'), version: app.getVersion(),
  onChange: s => win?.webContents.send('update', s),
})
const push = () => { win?.webContents.send('sessions', Object.values(sessions), limits, teamView()); phone.broadcast() }
// Team messages between agents on the same repo, here and on teammates' PCs (team.js). Off until you switch it on.
const team = createTeam({ file: path.join(app.getPath('userData'), 'team.json'), changed: () => push() })
// What the notch draws of it: per repo, teammates' agents and recent messages; `of`: each session's repo and team name.
const teamView = () => team.on ? { repos: team.state(), of: Object.fromEntries(Object.values(sessions).map(s => [s.key, { id: team.idOf(s.cwd), name: nameOf(s) }])) } : null
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
  if (!s.cwd) { s.cwd = l.dir; s.project = path.basename(homeOf(l.dir)) }
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

// Team messages. An agent's name on the team is the name you gave its session here, or else what kind of agent it is.
const nameOf = s => slug(s.label) || s.agent
const KIND = { claude: 'Claude Code', agy: 'Antigravity', opencode: 'OpenCode', kilo: 'Kilo', copilot: 'Copilot' }
const said = m => `- ${m.from}${m.to ? ' to ' + m.to : ''}: ${m.text}`
const whoIs = a => `- ${a.human}/${a.name} (${KIND[a.agent] || a.agent}${a.here ? ', on this computer' : ''})${a.task ? ': ' + a.task : ''}`

// Everyone else on a folder's repo: this PC's other sessions there, then teammates' agents.
async function rosterOf(cwd, self) {
  const id = await team.repo(cwd), r = await team.roster(cwd), here = []
  for (const o of Object.values(sessions)) if (o !== self && o.cwd && await team.repo(o.cwd) === id) here.push({ human: r.human, name: nameOf(o), agent: o.agent, task: o.task, here: true })
  return { ...r, list: [...here, ...r.who] }
}

// Coordinate mode (a per-repo switch, on this PC): the agents in a repo work as one team until one of them sends done.
// A finishing agent is kept going with the team's news, or told to wait for it; 10 quiet minutes let everyone stop.
const QUIET_MS = 10 * 60e3
const RULES = `Coordinate mode is on in this repo: you and the other agents working in it (team_check lists them) are one team on the same goal, with as little human help as possible.
- Agree who does what before editing (claim your part with team_send) and leave files another agent has claimed to them.
- Tell the team when you finish a part, change something others rely on (APIs, shared files, schemas), or get stuck.
- Waiting on a teammate? Call team_check with wait_seconds: 90 (again if needed) instead of stopping.
- Skip messages that only say thanks or OK.
- When the whole goal is done and checked, one of you sends team_send with done: true; then everyone can stop.`
const NUDGE = "Coordinate mode is on and the team's work isn't marked done. If you're waiting on teammates, call team_check with wait_seconds: 90. If your part is finished, tell the team with team_send and wait for what's next. If the whole goal is done and checked, send team_send with done: true, then stop."
async function coordinating(s) {
  const c = s?.cwd && await team.coordination(s.cwd).catch(() => null)
  if (!c?.on || Date.now() - Math.max(c.last?.at || 0, s.turnAt || 0) > QUIET_MS) return false
  return !(c.last?.done && c.last.at >= (s.turnAt || 0)) // a done that came after this agent's task began ends its round
}

// New team messages ride back on a hook's reply, for agents that let a hook add to what the model reads: as hook
// context (Claude, Copilot), as a step before the next model call (Antigravity), or added to a tool's result by
// plugin.js (OpenCode, Kilo; it flags the calls whose reply it shows). Each is shown once. A finishing agent is only
// held for messages that name it, and never twice in a row, so agents can't keep each other going (unless coordinating).
const MAIL = { claude: ['UserPromptSubmit', 'PostToolUse', 'Stop'], copilot: ['UserPromptSubmit', 'PostToolUse', 'Stop'], agy: ['PreInvocation', 'Stop'] }
function wrap(agent, event, text) {
  const stop = event === 'Stop'
  if (agent === 'claude') return stop ? { decision: 'block', reason: text } : { hookSpecificOutput: { hookEventName: event, additionalContext: text } }
  if (agent === 'agy') return stop ? { decision: 'continue', reason: text } : { injectSteps: [{ systemMessage: { systemMessage: text } }] }
  // Copilot: VS Code's own harness reads the nested shape and the Copilot CLI's harness the flat one; each ignores the other
  const inner = { hookEventName: event, ...(stop ? { decision: 'block', reason: text } : { additionalContext: text }) }
  return stop ? { decision: 'block', reason: text, hookSpecificOutput: inner } : { additionalContext: text, hookSpecificOutput: inner }
}
async function mailFor(s, agent, event, p) {
  const plugin = agent === 'opencode' || agent === 'kilo'
  if (!team.on || !s.cwd || !(plugin ? p.mail === true : MAIL[agent]?.includes(event))) return ''
  const stop = event === 'Stop', turn = event === 'UserPromptSubmit' || (event === 'PreInvocation' && p.invocationNum === 0)
  if (turn) { s.heldStop = false; s.turnAt = Date.now() }
  const coord = await coordinating(s)
  if (stop && (s.state !== 'done' || !coord && (s.heldStop || p.stop_hook_active))) { s.heldStop = false; return '' } // it failed, or held once already
  const mail = await team.take(s.cwd, s.key, nameOf(s), { started: s.started, direct: stop && !coord }).catch(() => null)
  if (!mail) return '' // not in a git repo
  let text = mail.length ? `New messages from other coding agents working in this repo:\n${mail.map(said).join('\n')}\nYou can answer with the team_send tool.` : ''
  if (turn) { // a new task: who else is here, whenever that changed
    const { list } = await rosterOf(s.cwd, s), names = list.map(a => a.human + '/' + a.name).join()
    if (names && names !== s.toldRoster) text = `Also working in this repo right now:\n${list.map(whoIs).join('\n')}\nThey can be reached with the team_send tool.${text ? '\n\n' + text : ''}`
    s.toldRoster = names
    if (coord) text = `${RULES}${text ? '\n\n' + text : ''}`
  }
  if (stop && coord) text = `${text ? text + '\n\n' : ''}${NUDGE}` // coordinating: keep going with the news, or wait for it
  if (!text) return ''
  if (stop) { s.heldStop = true; set(s, 'working', Date.now()); s.action = mail.length ? 'Reading team messages' : 'Waiting for the team'; s.unread = false }
  return plugin ? text : JSON.stringify(wrap(agent, event, text))
}

// Calls from mcp.js. The MCP server is the agent's child like its hooks are, so the agent process tells which session
// is asking (the busiest one, for agents that run several sessions in one process).
const agentPid = {} // MCP server pid -> agent pid
const sent = {} // session -> when it last sent: a runaway agent can't flood the team
async function teamCall(tool, body, url, res) {
  let a = {}
  try { a = JSON.parse(body) } catch {}
  const agent = url.searchParams.get('agent') || 'agent', pid = +url.searchParams.get('pid') || 0
  agentPid[pid] ??= +(await win32('find ' + pid)).split(' ')[1] || 0
  const s = Object.values(sessions).filter(o => o.agent === agent && (agentPid[pid] ? o.pid === agentPid[pid] : samePath(o.cwd, a.cwd))).sort((x, y) => y.updated - x.updated)[0]
  const cwd = s?.cwd || a.cwd, name = s ? nameOf(s) : slug(agent)
  if (!team.on) return res.end('Team messages are off. They can be turned on in Agent Notch: Setup → Team messages.')
  if (!cwd || !(await team.repo(cwd))) return res.end("This folder isn't in a git repository, so there is no team to message from here.")
  const { list, human, remote, error, live } = await rosterOf(cwd, s)
  const link = !remote ? 'This repo has no remote, so only agents on this computer get messages.' : error ? `The remote can't be reached right now (${error}); messages go out once it can.` : ''
  if (tool === 'team_send') {
    if (!String(a.text || '').trim()) return res.end('Not sent: the message is empty.')
    const k = s?.key || agent, recent = (sent[k] || []).filter(t => Date.now() - t < 300e3)
    if (recent.length >= 10) return res.end('Not sent: that would be 11 messages in 5 minutes. Wait a little, or say more in one message.')
    sent[k] = [...recent, Date.now()]
    await team.send(cwd, { name, agent, to: a.to, text: a.text, key: s?.key, done: a.done === true })
    const heard = list.some(o => team.addressed(a.to, o.human, o.name))
    return res.end([`Sent to ${a.to || 'everyone in this repo'}${a.done === true ? ', marked done: agents in coordinate mode can stop now' : ''}.`, heard ? '' : `Nobody ${a.to ? 'by that name ' : ''}is working in this repo right now, so only agents that are will see it.`, link].filter(Boolean).join(' '))
  }
  if (tool !== 'team_check') return res.end('Unknown tool')
  let mail = []
  for (let t = 0, wait = Math.min(Math.max(+a.wait_seconds || 0, 0), 90); ; t++) { // waiting for a reply: check every second, fetch every 5
    mail = await team.take(cwd, s?.key || `${agent}:${pid}`, name, { started: s?.started })
    if (mail.length || t >= wait) break
    if (t % 5 === 0) team.hurry(cwd)
    await sleep(1000)
  }
  res.end([
    `You are ${human}/${name}.`,
    list.length ? `Also working in this repo:\n${list.map(whoIs).join('\n')}`
      : `Nobody else is working in this repo right now${remote && !live ? " that you can see: teammates' agents show up once anyone has sent a team message in this repo" : ''}.`,
    mail.length ? `New messages:\n${mail.map(said).join('\n')}` : 'No new messages.',
    await coordinating(s) ? RULES : '',
    link,
  ].filter(Boolean).join('\n\n'))
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
  const mail = s && await mailFor(s, agent, event, p)
  if (mail) { push(); return res.end(mail) }
  if (s?.restartWhenDone && s.state === 'done') setTimeout(() => restart(s.key), 800) // asked while it was busy: it's finished now
  // Reading team messages can't hurt, so it never waits for your OK (sending does, until you allow it for good)
  if (agent === 'claude' && event === 'PreToolUse' && (p.tool_name === 'mcp__agent-notch__team_check' || p.tool_name === 'mcp__agent-notch__team_send' && await coordinating(s))) return res.end(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }))
  if (s && s.auto && agent === 'agy' && event === 'PreToolUse') { res.end(answer(agent, 'ask')); return pressWhenPrompted(s) } // any agy tool can prompt
  if (!s || !isGate(agent, event, p)) return res.end('')
  // The Antigravity IDE has no console to press Enter in, so the notch can't answer its prompt: leave it to the IDE.
  if (agent === 'agy' && s.app) return res.end(answer(agent, 'ask'))
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
  // Agents on this PC only. Replies carry team messages, so a web page must not get in, either under another name
  // pointed at 127.0.0.1 (DNS rebinding: wrong Host) or cross-site (can't add the x-notch header without a CORS OK).
  const url = new URL(req.url, 'http://x')
  const [, agent, event] = url.pathname.split('/')
  if (!/^(127\.0\.0\.1|localhost):47800$/.test(req.headers.host || '') || (agent === 'team' && !req.headers['x-notch'])) { res.writeHead(403); return res.end() }
  if (req.method === 'GET') return res.end(JSON.stringify(Object.values(sessions), null, 2)) // debug: curl localhost:47800
  let body = ''
  req.on('data', c => (body += c)).on('end', () => (agent === 'team' ? teamCall(event, body, url, res) : handleEvent(agent, event, body, url, res)).catch(e => {
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
  if (team.on) { // what each repo's agents here are doing, for teammates; team.js decides when to actually fetch
    const groups = {}
    for (const s of Object.values(sessions)) if (s.cwd) (groups[s.cwd] ||= []).push({ name: nameOf(s), agent: s.agent, task: s.task })
    team.sync(groups).catch(e => console.error('team sync failed:', e.message))
  }
}, 700)

function focus(key) {
  const s = sessions[key]
  if (!s) return
  decide(key, 'ask') // answering in the terminal instead
  s.unread = false
  if (s.hwnd) win32('focus ' + s.hwnd)
  push()
}

// Restart an agent in its own terminal, back in the same conversation: say, so it loads tools added since it started.
// Terminal agents only (an app has no shell to come back in). A busy one restarts as soon as it finishes.
const RESUME = { claude: '--resume', opencode: '--session', kilo: '--session', agy: '--conversation' }
const canRestart = s => !!RESUME[s.agent] && !!s.pid && !s.app
async function restart(key) {
  const s = sessions[key]
  if (!s || !canRestart(s)) return
  if (s.state === 'working' || s.state === 'waiting') { s.restartWhenDone = true; return push() }
  const cmd = `${s.agent} ${RESUME[s.agent]} ${key.slice(s.agent.length + 1).replace(/[^\w-]/g, '')}` // the id, safe to type into a shell
  const pid = s.pid
  Object.assign(s, { restartWhenDone: false, located: false, pid: null, hwnd: null, action: 'Restarted' }) // the resumed agent reports in as this same session
  push()
  if (await win32(`restart ${pid} ${Buffer.from(cmd).toString('base64')}`) !== 'typed') launchIn(s.cwd || app.getPath('home'), cmd) // no shell to go back to: a new window
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
  win?.setIgnoreMouseEvents(false)
  win?.setFocusable(true)
  win?.setSkipTaskbar(true) // setFocusable resets window styles on Windows, which brings back a taskbar button
  win?.focus()
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
  win?.setFocusable(false)
  win?.setSkipTaskbar(true)
  win?.setIgnoreMouseEvents(true, { forward: true })
})
ipcMain.on('mouse', (_, over) => keyboard || win?.setIgnoreMouseEvents(!over, { forward: true }))
ipcMain.on('focus', (_, key) => focus(key))
ipcMain.on('decide', (_, key, choice) => decide(key, choice))
ipcMain.on('auto', (_, key, on) => {
  if (!sessions[key]) return
  sessions[key].auto = on
  if (on) decide(key, 'allow')
  push()
})
ipcMain.on('dismiss', (_, key) => { decide(key, 'ask'); delete sessions[key]; push() })
ipcMain.on('restart', (_, key) => restart(key))
ipcMain.handle('restart-all', () => { const list = Object.values(sessions).filter(canRestart); for (const s of list) restart(s.key); return list.length })
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
// Bring it home: merge worktree agents' branches back. Only branches git lists as notch/* worktrees are ever touched.
const gitError = e => ({ error: /not a git repository/i.test(e.message) ? "This folder isn't a git repo" : e.message })
const busyPaths = () => Object.values(sessions).filter(s => s.state === 'working' || s.state === 'waiting').map(s => s.cwd)
ipcMain.handle('branches', (_, dir, names) => branches(dir, busyPaths(), names || {}).catch(gitError))
ipcMain.handle('bring-home', (_, dir, pick, saveMine) => bringHome(dir, Array.isArray(pick) ? pick : [], saveMine === true).catch(gitError))
ipcMain.handle('discard', (_, dir, branch) => discard(dir, String(branch)).then(() => ({ ok: true }), gitError))
ipcMain.handle('fix-conflict', (_, dir, branch) => worktrees(dir).then(({ main, notch }) => {
  if (!notch.some(w => w.branch === branch)) return { error: 'That branch is gone' }
  launchAgent('claude', main, `Merge the git branch ${branch} into the current branch, resolve the merge conflicts so both changes work, and commit the merge.`)
  return { ok: true }
}, gitError))
ipcMain.on('open-path', (_, p) => typeof p === 'string' && /\.worktrees[\\/]/.test(p) && shell.openPath(p))

// Setup sheet: which agents are connected, start with Windows, and whether first-run setup was finished.
const SETUP_DONE = path.join(app.getPath('userData'), 'setup-done')
const loginOpts = () => app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] } // from source, register electron + this folder
ipcMain.handle('setup-status', () => ({ agents: setup.status(), login: app.getLoginItemSettings(loginOpts()).openAtLogin, done: fs.existsSync(SETUP_DONE) }))
const hookRunner = () => setup.runner(app.isPackaged ? process.execPath : null)
ipcMain.handle('setup-connect', (_, agent, on) => {
  if (!setup.AGENTS.includes(agent)) return { error: 'Unknown agent' }
  try { setup.set(agent, !!on, on ? hookRunner() : null, team.on) } catch (e) { return { error: e.message } }
  return { agents: setup.status() }
})
ipcMain.handle('setup-limits', (_, on) => {
  try { setup.setLimits(!!on, hookRunner()) } catch (e) { return { error: e.message } }
  return { agents: setup.status() }
})
ipcMain.handle('setup-login', (_, on) => { app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() }); return app.getLoginItemSettings(loginOpts()).openAtLogin })
ipcMain.handle('setup-done', () => { fs.writeFileSync(SETUP_DONE, ''); fs.writeFileSync(NEWS_SEEN, NEWS.id); return true }) // new users get the news in Setup itself
// What's new: one peek, once, for people who were already using Notch when a feature arrived
const NEWS = { id: 'team', title: 'New: team messages', line: 'Agents can now message each other. Hover to set up' }
const NEWS_SEEN = path.join(app.getPath('userData'), 'news-seen')
ipcMain.handle('news', () => {
  if (!fs.existsSync(SETUP_DONE) || (fs.existsSync(NEWS_SEEN) && fs.readFileSync(NEWS_SEEN, 'utf8') === NEWS.id)) return null
  fs.writeFileSync(NEWS_SEEN, NEWS.id)
  return team.on ? null : NEWS // already using it: nothing new
})
ipcMain.handle('update-state', () => updates.state())
ipcMain.handle('update-check', () => updates.check())
ipcMain.handle('update-auto', (_, on) => updates.setAuto(!!on))
ipcMain.on('update-restart', () => goodbye('reload', () => { win = null; updates.restart() })) // the goodbye animation, then install and relaunch
// Team messages on/off. The MCP tools are only in agents' configs while it's on, so they cost nothing otherwise.
ipcMain.handle('team-set', (_, on) => {
  team.set(!!on)
  try { setup.refresh(hookRunner(), team.on) } catch (e) { return { on: team.on, error: e.message } }
  return { on: team.on }
})
ipcMain.handle('team-info', () => ({ on: team.on }))
ipcMain.handle('team-coord', (_, id, on) => { team.setCoord(String(id), !!on); return !!on })
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
// Where the notch sits along the top of a monitor (position.js). anchorX is the screen x of the pill's centre; you can
// drag it, nudge it with the arrow keys, and it remembers where you left it.
const POSITION = path.join(app.getPath('userData'), 'position.json')
let anchorX = 0, fullNow = false, grab = 0
const displayAt = x => screen.getDisplayNearestPoint({ x, y: 0 })
function place(display = displayAt(anchorX)) {
  anchorX = position.clampAnchor(anchorX, display.bounds)
  win?.setBounds(position.windowRect(anchorX, display.bounds, SIZES[fullNow ? 'full' : 'compact']))
}
function loadPosition() {
  let saved = null
  try { saved = JSON.parse(fs.readFileSync(POSITION, 'utf8')) } catch {}
  anchorX = position.fromSaved(saved, screen.getAllDisplays(), screen.getPrimaryDisplay()).anchor
}
const savePosition = () => { const d = displayAt(anchorX); fs.writeFile(POSITION, JSON.stringify(position.toSaved(anchorX, d.bounds, d.id)), () => {}) }
ipcMain.on('drag-start', () => { grab = screen.getCursorScreenPoint().x - anchorX })
ipcMain.on('drag-move', () => { const p = screen.getCursorScreenPoint(); anchorX = p.x - grab; place(screen.getDisplayNearestPoint(p)) }) // follows the cursor, onto other monitors too
ipcMain.on('drag-end', () => { anchorX = position.snapAnchor(anchorX, displayAt(anchorX).bounds); place(); savePosition() })
const nudge = dx => { anchorX += Math.sign(dx) * 40; place(); savePosition() }
const recenter = () => { anchorX = position.centre(displayAt(anchorX).bounds); place(); savePosition() }
ipcMain.on('nudge', (_, dx) => nudge(dx))
ipcMain.on('recenter', recenter)

function size(full) { fullNow = full; place() }
ipcMain.on('size', (_, full) => size(!!full))

app.whenReady().then(() => {
  phone.start()
  updates.start()
  // Bring connected agents' hooks up to date with this version and point them at this copy
  try { setup.refresh(hookRunner(), team.on) } catch (e) { console.error('hook refresh failed:', e.message) }
  loadPosition()
  win = new BrowserWindow({
    ...position.windowRect(anchorX, displayAt(anchorX).bounds, SIZES.compact),
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true,
    hasShadow: false, focusable: false, alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile('index.html')
  win.on('closed', () => { win = null }) // quit/update destroys it; late IPC from the page must not touch a dead window

  const keys = { 'Control+Alt+N': toggleKeyboard, 'Control+Alt+J': jumpNext, 'Control+Alt+G': grid, 'Control+Alt+R': reload, 'Control+Alt+V': () => win?.webContents.send('venom'), 'Control+Alt+Z': () => win?.webContents.send('sleep'), 'Control+Alt+Q': quit,
    'Control+Alt+Shift+Left': () => nudge(-1), 'Control+Alt+Shift+Right': () => nudge(1), 'Control+Alt+Shift+Home': recenter } // not plain Ctrl+Alt+arrows: Intel graphics drivers use those to rotate the screen
  for (const [accel, fn] of Object.entries(keys)) if (!globalShortcut.register(accel, fn)) console.warn('shortcut taken: ' + accel)
  screen.on('display-removed', () => place()); screen.on('display-metrics-changed', () => place()) // a monitor came or went: stay on screen
})

app.on('will-quit', () => { globalShortcut.unregisterAll(); helper.kill() })
