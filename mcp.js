// Team messages as MCP tools, so any agent that speaks MCP can use them. The agent starts this over stdio (setup.js
// registers it) and each call is passed to the notch, which works out which session is asking:
//   installed:     agent-notch.exe resources/app/mcp.js <agent>   (with ELECTRON_RUN_AS_NODE=1)
//   source folder: node mcp.js <agent>
const http = require('http')
const readline = require('readline')

const agent = process.argv[2] || 'agent'
const TOOLS = [
  {
    name: 'team_send',
    description: "Send a short message to the other coding agents working in this same git repository, on this computer and on teammates' computers, whatever agent they are (Claude Code, Copilot, OpenCode, Antigravity, Kilo). Use it when your work affects theirs (you changed an API, schema, shared type or config; renamed or moved files; are about to change files they are likely in), to claim or hand over a piece of work, or to ask one of them a question. Be brief and concrete: what changed and what it means for them.",
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The message' },
        to: { type: 'string', description: 'Who it is for: an agent from team_check (e.g. "bob/claude"), a teammate ("bob": all their agents), or leave it out for everyone in the repo' },
      },
      required: ['text'],
    },
  },
  {
    name: 'team_check',
    description: "See who else is working in this git repository right now (agents on this computer and on teammates' computers, with what each is doing) and read new messages they sent you. New messages also reach you automatically as you work; call this before work that could clash with someone else's, or with wait_seconds when you are waiting for a reply.",
    inputSchema: {
      type: 'object',
      properties: { wait_seconds: { type: 'number', description: 'If nothing new has arrived, wait up to this many seconds (at most 90) for a message' } },
    },
  },
]

const call = (tool, args) => new Promise(done => {
  const req = http.request({ host: '127.0.0.1', port: 47800, method: 'POST', path: `/team/${tool}?agent=${agent}&pid=${process.pid}`, headers: { 'x-notch': '1' } }, res => {
    let out = ''
    res.setEncoding('utf8').on('data', c => (out += c)).on('end', () => done(out))
  })
  req.on('error', () => done("Agent Notch isn't running, so team messages can't be sent or read right now."))
  req.end(JSON.stringify({ ...args, cwd: process.cwd() }))
})

const say = (id, body) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\n')
readline.createInterface({ input: process.stdin }).on('line', async line => {
  let m
  try { m = JSON.parse(line) } catch { return }
  if (m.id === undefined || m.id === null) return // a notification: nothing to answer
  if (m.method === 'initialize') return say(m.id, { result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'agent-notch', version: '1.0.0' } } })
  if (m.method === 'tools/list') return say(m.id, { result: { tools: TOOLS } })
  if (m.method === 'tools/call') return say(m.id, { result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments || {}) }] } })
  if (m.method === 'ping') return say(m.id, { result: {} })
  say(m.id, { error: { code: -32601, message: 'Method not found' } })
})
