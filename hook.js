// Called by agent hooks with the event JSON on stdin:
//   installed:     agent-notch.exe --hook <agent> <Event>   (the app exe runs this file; no Node needed)
//   source folder: node hook.js <agent> <Event>
// Forwards to the notch, starting it first if it isn't running. If it still can't be reached,
// prints the agent's neutral default so nothing changes.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const flag = process.argv.indexOf('--hook')
const [agent, event] = process.argv.slice(flag >= 0 ? flag + 1 : 2)
const fallback = agent === 'agy' ? (event === 'PreToolUse' ? '{"decision":"ask"}' : '{}') : ''
const gate = event === 'PermissionRequest' || (agent === 'agy' && event === 'PreToolUse') // the notch may hold these for your click

// The notch's single-instance lock makes concurrent launches from parallel hooks harmless.
function launch() {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE // set when the agent itself runs under Electron (Claude desktop); would start Electron as plain Node
  const [cmd, args] = process.versions.electron
    ? [process.execPath, []] // we are the installed exe: start it normally
    : [require(path.join(__dirname, 'node_modules', 'electron')), [__dirname]]
  spawn(cmd, args, { detached: true, stdio: 'ignore', env }).unref()
}

const quitByUser = fs.existsSync(path.join(__dirname, '.quit')) // you quit it: don't start it back up
const done = out => { process.stdout.write(out || fallback); process.exit(0) }

// ponytail: if the notch can't start at all, every hook call waits the full ~4s retry window
function send(body, tries = 0) {
  const req = http.request({ host: '127.0.0.1', port: 47800, method: 'POST', path: `/${agent}/${event}?pid=${process.pid}`, timeout: gate ? 58000 : 5000 }, res => {
    let out = ''; res.on('data', c => (out += c)).on('end', () => done(out))
  })
  req.on('timeout', () => { req.destroy(); done() })
  req.on('error', e => {
    if (e.code !== 'ECONNREFUSED' || tries >= 16 || quitByUser) return done()
    if (!tries) try { launch() } catch { return done() } // e.g. node_modules missing: fall back instead of crashing
    setTimeout(() => send(body, tries + 1), 250)
  })
  req.end(body)
}

// fd 0 directly: Electron's main process doesn't wire up process.stdin on Windows
let input = ''
try { input = fs.readFileSync(0, 'utf8') } catch {}
send(input)
