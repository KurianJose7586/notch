// Connects / disconnects the notch to each agent's own config. Used by the setup sheet, the uninstaller and the CLI:
//   node setup.js            connect every installed agent (running from this source folder, via Node)
//   node setup.js --remove   disconnect them all
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const AGENTS = ['claude', 'agy', 'opencode', 'kilo', 'copilot']
const MARK = 'agent-notch' // every hook we add carries this, in its name or its path
const CLAUDE_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Notification', 'Stop', 'StopFailure', 'SessionEnd']
const COPILOT_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']
const home = () => os.homedir()
const files = () => ({
  claude: path.join(home(), '.claude', 'settings.json'),
  agy: path.join(home(), '.gemini', 'config', 'hooks.json'), // shared by the agy CLI and the Antigravity IDE
  opencode: path.join(home(), '.config', 'opencode', 'plugins', 'agent-notch.js'),
  kilo: path.join(home(), '.config', 'kilo', 'plugins', 'agent-notch.js'),
  copilot: path.join(home(), '.copilot', 'hooks', 'agent-notch.json'), // VS Code's user-level agent hooks
})
const homes = () => ({ // an agent counts as installed once it has made its config folder
  claude: path.join(home(), '.claude'),
  agy: path.join(home(), '.gemini'),
  opencode: path.join(home(), '.config', 'opencode'),
  kilo: path.join(home(), '.config', 'kilo'),
  copilot: path.join(home(), '.vscode'),
})

// How agents invoke the hook. Installed: notch-hook.cmd next to the exe, which runs hook.js with the exe in Node mode
// (no Node needed, and ~2x faster than `agent-notch.exe --hook`). From source: Node runs hook.js from this folder.
// agy runs hooks through `cmd /c` and mangles quoted paths, so it gets a space-free 8.3 short path.
function runner(exe) {
  const target = exe ? path.join(path.dirname(exe), 'notch-hook.cmd') : path.join(__dirname, 'hook.js')
  const short = execSync(`cmd /c for %A in ("${target}") do @echo %~sA`).toString().trim()
  if (short.includes(' ')) throw new Error(`No short path for ${target}; move it to a folder without spaces`)
  const slashed = target.replace(/\\/g, '/')
  return exe ? { quoted: `"${slashed}"`, bare: short } : { quoted: `node "${slashed}"`, bare: `node ${short}` }
}

// A config we can't parse is left alone rather than overwritten; one that wouldn't change isn't rewritten.
function editJson(file, fn) {
  const exists = fs.existsSync(file)
  const text = exists ? fs.readFileSync(file, 'utf8') : '{}'
  const json = JSON.parse(text)
  const before = JSON.stringify(json)
  fn(json)
  if (exists && JSON.stringify(json) === before) return
  if (exists && !fs.existsSync(file + '.bak')) fs.writeFileSync(file + '.bak', text)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
}
const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return {} } }
const writeIfChanged = (file, text) => {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

function connected(agent) {
  const f = files()[agent]
  if (agent === 'claude') return JSON.stringify(readJson(f).hooks || {}).includes(MARK)
  if (agent === 'agy') return !!readJson(f)[MARK]
  return fs.existsSync(f)
}

// Claude's usage limits reach the notch through Claude's status line. 'none' and 'ours' can be switched; 'other'
// means you have your own status line, which we never replace.
function statusLine() {
  const s = readJson(files().claude).statusLine
  return !s ? 'none' : JSON.stringify(s).includes(MARK) ? 'ours' : 'other'
}

function status() {
  const f = files(), h = homes()
  return Object.fromEntries([
    ...AGENTS.map(a => [a, { installed: fs.existsSync(h[a]), connected: connected(a), where: f[a].replace(home(), '~') }]),
    ['limits', statusLine()],
  ])
}

// on = true connects with `run` (from runner()); on = false disconnects. Re-connecting replaces the old hooks.
function set(agent, on, run) {
  const file = files()[agent]
  if (agent === 'claude') {
    if (!on && !fs.existsSync(file)) return
    return editJson(file, s => {
      s.hooks ||= {}
      for (const ev of CLAUDE_EVENTS) {
        s.hooks[ev] = (s.hooks[ev] || []).filter(h => !JSON.stringify(h).includes(MARK))
        if (on) s.hooks[ev].push({ ...(ev.endsWith('ToolUse') && { matcher: '*' }), hooks: [{ type: 'command', command: `${run.quoted} claude ${ev}`, timeout: 60 }] })
        if (!s.hooks[ev].length) delete s.hooks[ev]
      }
      if (!Object.keys(s.hooks).length) delete s.hooks
      if (JSON.stringify(s.statusLine || '').includes(MARK)) { // keep our status line pointing at this copy, or drop it
        if (on) s.statusLine.command = `${run.quoted} claude StatusLine`; else delete s.statusLine
      }
    })
  }
  if (agent === 'agy') {
    if (!on && !fs.existsSync(file)) return
    const cmd = event => ({ type: 'command', command: `${run?.bare} agy ${event}`, timeout: 60 })
    return editJson(file, h => {
      delete h[MARK]
      if (on) h[MARK] = { // tool events are grouped with a matcher, the rest are flat lists
        PreInvocation: [cmd('PreInvocation')],
        PreToolUse: [{ matcher: '*', hooks: [cmd('PreToolUse')] }],
        PostToolUse: [{ matcher: '*', hooks: [cmd('PostToolUse')] }],
        Stop: [cmd('Stop')],
      }
    })
  }
  if (!on) return fs.rmSync(file, { force: true })
  if (agent === 'copilot') { // a whole hooks file of our own; VS Code runs `windows` on Windows
    const hooks = Object.fromEntries(COPILOT_EVENTS.map(ev => [ev, [{ type: 'command', command: `${run.bare} copilot ${ev}`, windows: `${run.bare} copilot ${ev}`, timeout: 30 }]]))
    return writeIfChanged(file, JSON.stringify({ hooks }, null, 2) + '\n')
  }
  // OpenCode / Kilo: a one-line plugin that re-exports plugin.js, so updates to the app apply without reconnecting
  writeIfChanged(file, `export { AgentNotch } from ${JSON.stringify(path.join(__dirname, 'plugin.js').replace(/\\/g, '/'))}\n`)
}

// Claude usage limits on/off. Never touches a status line that isn't ours.
function setLimits(on, run) {
  const now = statusLine()
  if (now === 'other') throw new Error('You already have your own Claude status line, so the notch leaves it alone')
  editJson(files().claude, s => {
    if (on) s.statusLine = { type: 'command', command: `${run.quoted} claude StatusLine`, padding: 0 }
    else if (now === 'ours') delete s.statusLine
  })
}

// On start: rewrite every connected agent's hooks for `run`. Agents connected by an older version pick up new events,
// and ones pointing at another copy of Agent Notch (e.g. the source folder before installing) move to this one, so
// removing that copy can't leave them calling a hook that's gone. Files that wouldn't change aren't touched.
function refresh(run) {
  for (const agent of AGENTS) if (connected(agent)) set(agent, true, run)
}

module.exports = { AGENTS, status, runner, set, setLimits, refresh }

if (require.main === module) {
  const remove = process.argv.includes('--remove'), run = remove ? null : runner()
  for (const [agent, s] of Object.entries(status())) {
    if (agent === 'limits') continue
    if (!s.installed && !s.connected) { console.log(`${agent}: not installed, skipped`); continue }
    set(agent, !remove, run)
    console.log(`${agent}: ${remove ? 'disconnected' : 'connected'} (${s.where})`)
  }
}
