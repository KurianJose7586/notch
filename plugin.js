// agent-notch plugin for OpenCode and Kilo (Kilo is an OpenCode fork with the same plugin API).
// install-hooks.js links this into ~/.config/{opencode,kilo}/plugins/. Starts the notch if it isn't running.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const agent = /kilo/i.test(process.execPath) ? 'kilo' : 'opencode'
const EVENTS = new Set(['session.status', 'session.idle', 'session.deleted', 'session.error', 'todo.updated',
  'permission.updated', 'permission.asked', 'permission.replied', 'question.asked', 'question.replied'])
const APP = dirname(fileURLToPath(import.meta.url))

let launchedAt = 0
function launch() { // the notch's single-instance lock makes duplicate launches harmless
  launchedAt = Date.now()
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const dev = existsSync(join(APP, 'node_modules', 'electron')) // source folder; otherwise installed at <install>/resources/app
  const [cmd, args] = dev ? [createRequire(import.meta.url)(join(APP, 'node_modules', 'electron')), [APP]] : [join(APP, '..', '..', 'agent-notch.exe'), []]
  spawn(cmd, args, { detached: true, stdio: 'ignore', env }).unref()
}

export const AgentNotch = async ({ directory }) => {
  const send = async (event, body, ms = 3000) => {
    for (;;) {
      try {
        const r = await fetch(`http://127.0.0.1:47800/${agent}/${event}?pid=${process.pid}`, {
          method: 'POST', body: JSON.stringify({ cwd: directory, ...body }), signal: AbortSignal.timeout(ms),
        })
        return await r.text()
      } catch (e) {
        if (e.name === 'TimeoutError' || existsSync(join(APP, '.quit'))) return '' // you quit it: don't start it back up
        // Unreachable: start it, then retry for up to 4s. Relaunch at most every 30s so a notch you quit doesn't stall every event.
        if (Date.now() - launchedAt > 30000) launch()
        else if (Date.now() - launchedAt > 4000) return ''
        await new Promise(r => setTimeout(r, 250))
      }
    }
  }

  return {
    'chat.message': async (input, output) =>
      send('prompt', { sessionID: input.sessionID, text: output.parts.filter(p => p.type === 'text').map(p => p.text).join(' ') }),
    'tool.execute.before': async (input, output) => send('tool', { sessionID: input.sessionID, tool: input.tool, args: output.args }),
    'tool.execute.after': async input => send('toolDone', { sessionID: input.sessionID }),
    'permission.ask': async (input, output) => { // the notch may hold this until you click Allow / Deny
      const r = await send('permission', { sessionID: input.sessionID, title: input.title, detail: [].concat(input.pattern || []).join(' ') }, 45000)
      if (r === 'allow' || r === 'deny') output.status = r
    },
    event: async ({ event }) => {
      if (EVENTS.has(event.type)) await send(event.type, event.properties)
    },
  }
}
