// Turns raw hook events from each agent into one session shape the UI renders.
const path = require('path')

const WAIT_AFTER_MS = 1500 // agy has no "needs permission" event: a tool that hasn't finished by now is assumed to be on a prompt
const STALE_MS = 2 * 3600e3

const short = (s, n = 90) => (s || '').toString().replace(/\s+/g, ' ').trim().slice(0, n)

// Claude uses `Edit` + file_path, OpenCode/Kilo use `edit` + filePath.
function describe(tool = '', i = {}) {
  const t = tool.toLowerCase(), name = tool[0]?.toUpperCase() + tool.slice(1), file = i.file_path || i.filePath
  if (t === 'bash') return '$ ' + short(i.command, 70)
  if (file) return `${name} ${path.basename(file)}`
  if (t === 'grep' || t === 'glob') return `Search ${short(i.pattern, 50)}`
  if (t === 'webfetch') return 'Fetch ' + short(i.url, 60)
  if (t === 'websearch') return 'Search web: ' + short(i.query, 50)
  if (i.description) return short(i.description)
  return name
}

// Claude's StopFailure error_type -> what the notch says.
const CLAUDE_ERRORS = {
  rate_limit: 'Usage limit reached', overloaded: 'Claude is overloaded', billing_error: 'Billing problem',
  authentication_failed: 'Signed out', oauth_org_not_allowed: 'Org not allowed', account_on_hold: 'Account on hold',
  invalid_request: 'Request failed', model_not_found: 'Model not found', server_error: 'Server error',
  max_output_tokens: 'Hit the output limit', cloud_credential_error: 'Credential error',
}
// agy / OpenCode report errors as free text; the usual limit wording becomes "Usage limit reached".
const errorText = msg => /quota|rate.?limit|429|resource.?exhausted|usage limit|too many requests/i.test(msg || '') ? 'Usage limit reached' : short(msg || 'Stopped with an error', 80)

// Normalises one event into { id, cwd, kind, action, task, todos }; kind drives the state machine.
function normalize(agent, event, p) {
  if (agent === 'claude') {
    const base = { id: p.session_id, cwd: p.cwd }
    switch (event) {
      case 'SessionStart': return { ...base, kind: 'idle' }
      case 'UserPromptSubmit': return { ...base, kind: 'turn', task: short(p.prompt, 140) }
      case 'PreToolUse': return { ...base, kind: 'tool', action: describe(p.tool_name, p.tool_input), todos: p.tool_input && p.tool_input.todos }
      case 'PostToolUse': return { ...base, kind: 'toolDone' }
      case 'PermissionRequest': return { ...base, kind: 'idle' } // permission gate: main.js decides and sets state
      case 'Notification': return { ...base, kind: 'wait', action: short(p.message) }
      case 'Stop': return { ...base, kind: 'stop' }
      case 'StopFailure': return { ...base, kind: 'fail', action: CLAUDE_ERRORS[p.error_type] || 'Stopped with an error', error: p.error_type || 'unknown' }
      case 'StatusLine': return { id: p.session_id, cwd: p.workspace?.current_dir || p.cwd, kind: 'meta', context: p.context_window?.used_percentage }
      case 'SessionEnd': return { ...base, kind: 'end' }
    }
  }
  if (agent === 'copilot') { // VS Code agent hooks: Claude-style events; field names accepted in either casing
    const id = p.session_id || p.sessionId || p.transcript_path || p.transcriptPath || p.cwd
    const base = { id, cwd: p.cwd || p.workspaceFolder || '' }
    switch (event) {
      case 'SessionStart': return { ...base, kind: 'idle' }
      case 'UserPromptSubmit': return { ...base, kind: 'turn', task: short(p.prompt, 140) }
      case 'PreToolUse': return { ...base, kind: 'tool', action: describe(p.tool_name || p.toolName, p.tool_input || p.toolArgs || p.toolInput) }
      case 'PostToolUse': return { ...base, kind: 'toolDone' }
      case 'Stop': return { ...base, kind: 'stop' }
    }
  }
  if (agent === 'agy') {
    const base = { id: p.conversationId, cwd: (p.workspacePaths || [])[0] }
    const args = (p.toolCall && p.toolCall.args) || {}
    switch (event) {
      case 'PreInvocation': return { ...base, kind: p.invocationNum === 0 ? 'turn' : 'think' }
      case 'PreToolUse': return { ...base, kind: 'tool', pending: true, action: short(args.toolSummary || args.toolAction || p.toolCall?.name) }
      case 'PostToolUse': return { ...base, kind: 'toolDone' }
      case 'Stop': // terminationReason: model_stop (normal), max_steps_exceeded, error
        if (p.terminationReason === 'max_steps_exceeded') return { ...base, kind: 'fail', action: 'Hit the step limit', error: 'max_steps' }
        if (p.error || /error/i.test(p.terminationReason || '')) return { ...base, kind: 'fail', action: errorText(p.error), error: 'error' }
        return { ...base, kind: 'stop' }
    }
  }
  if (agent === 'opencode' || agent === 'kilo') { // same plugin API; events come from plugin.js
    const base = { id: p.sessionID, cwd: p.cwd }
    switch (event) {
      case 'prompt': return { ...base, kind: 'turn', task: short(p.text, 140) }
      case 'tool': return { ...base, kind: 'tool', action: describe(p.tool, p.args), todos: p.args && p.args.todos }
      case 'toolDone': case 'permission.replied': case 'question.replied': return { ...base, kind: 'toolDone' }
      case 'permission': return { ...base, kind: 'idle' } // permission.ask gate: main.js decides and sets state
      case 'permission.updated': case 'permission.asked': return { ...base, kind: 'wait', action: short(p.title || 'Needs permission') }
      case 'question.asked': return { ...base, kind: 'wait', action: short(p.questions?.[0]?.question || 'Has a question') }
      case 'session.status':
        if (p.status?.type === 'busy') return { ...base, kind: 'think' }
        if (p.status?.type === 'retry') return { ...base, kind: 'think', action: 'Retrying: ' + errorText(p.status.message) } // e.g. rate limited, backing off
        return null
      case 'session.error': return { ...base, kind: 'fail', action: errorText(p.error?.data?.message || p.error?.message || p.error?.name), error: 'error' }
      case 'todo.updated': return { ...base, kind: 'idle', todos: p.todos }
      case 'session.idle': return { ...base, kind: 'stop' }
      case 'session.deleted': return { ...base, id: p.info?.id, kind: 'end' }
    }
  }
  return null
}

// State changes go through here so `since` (how long it's been working / waiting) stays right.
const set = (s, state, now) => { if (s.state !== state) { s.state = state; s.since = now } }

// Mutates sessions; returns the touched session (or null).
function apply(sessions, agent, event, p, now = Date.now()) {
  const e = normalize(agent, event, p || {})
  if (!e || !e.id) return null
  const key = `${agent}:${e.id}`
  if (e.kind === 'end') { delete sessions[key]; return null }
  const s = sessions[key] ||= {
    key, agent, cwd: e.cwd || '', project: e.cwd ? path.basename(e.cwd) : 'unknown',
    state: 'idle', since: now, action: '', task: '', log: [], todos: null, auto: false, unread: false, request: null, pendingSince: 0, seq: 0, started: now,
  }
  s.updated = now
  switch (e.kind) {
    case 'idle': break
    case 'turn': set(s, 'working', now); s.action = 'Thinking…'; s.todos = null; s.unread = false; s.error = null; if (e.task) s.task = e.task; break
    case 'think': set(s, 'working', now); if (e.action) s.action = e.action; break
    case 'fail': set(s, 'error', now); s.action = e.action; s.error = e.error; s.pendingSince = 0; s.unread = true; break
    case 'meta': if (typeof e.context === 'number') s.context = Math.round(e.context); break
    case 'tool':
      set(s, 'working', now); s.action = e.action
      s.log = [...s.log, { t: now, text: e.action }].slice(-5)
      s.pendingSince = e.pending ? now : 0
      s.seq++ // tool started: lets main.js tell one tool call from the next
      break
    case 'toolDone': set(s, 'working', now); s.pendingSince = 0; s.seq++; break
    case 'wait': set(s, 'waiting', now); if (e.action) s.action = e.action; break
    case 'stop': set(s, 'done', now); s.action = 'Finished'; s.pendingSince = 0; s.unread = true; break
  }
  if (Array.isArray(e.todos)) s.todos = { done: e.todos.filter(t => t.status === 'completed').length, total: e.todos.length }
  return s
}

// Time-based transitions; isAlive(pid) prunes sessions whose agent process exited. Returns true if anything changed.
function tick(sessions, now, isAlive) {
  let changed = false
  for (const s of Object.values(sessions)) {
    if (s.pendingSince && !s.auto && !s.request && s.state === 'working' && now - s.pendingSince > WAIT_AFTER_MS) { set(s, 'waiting', now); changed = true }
    if ((s.pid && !isAlive(s.pid)) || now - s.updated > STALE_MS) { delete sessions[s.key]; changed = true }
  }
  return changed
}

module.exports = { apply, tick, set }

if (require.main === module) {
  const assert = require('assert')
  const S = {}
  apply(S, 'claude', 'UserPromptSubmit', { session_id: 'a', cwd: 'C:/x/LRNAI', prompt: 'fix login' }, 0)
  assert.equal(S['claude:a'].state, 'working'); assert.equal(S['claude:a'].project, 'LRNAI')
  apply(S, 'claude', 'PreToolUse', { session_id: 'a', tool_name: 'TodoWrite', tool_input: { todos: [{ status: 'completed' }, { status: 'pending' }] } }, 1)
  assert.deepEqual(S['claude:a'].todos, { done: 1, total: 2 })
  apply(S, 'claude', 'PreToolUse', { session_id: 'a', tool_name: 'Edit', tool_input: { file_path: 'C:/x/src/auth.ts' } }, 2)
  assert.equal(S['claude:a'].action, 'Edit auth.ts')
  apply(S, 'claude', 'Notification', { session_id: 'a', message: 'Claude needs your permission' }, 3)
  assert.equal(S['claude:a'].state, 'waiting')
  apply(S, 'claude', 'Stop', { session_id: 'a' }, 4); assert.equal(S['claude:a'].state, 'done'); assert.equal(S['claude:a'].since, 4); assert.ok(S['claude:a'].unread)
  apply(S, 'claude', 'UserPromptSubmit', { session_id: 'a', prompt: 'next' }, 5); assert.ok(!S['claude:a'].unread)

  apply(S, 'agy', 'PreToolUse', { conversationId: 'b', workspacePaths: ['C:/x/enestock'], toolCall: { name: 'run_command', args: { toolSummary: 'Run npm test' } } }, 1000)
  assert.equal(S['agy:b'].action, 'Run npm test')
  tick(S, 2000, () => true); assert.equal(S['agy:b'].state, 'working')
  tick(S, 3000, () => true); assert.equal(S['agy:b'].state, 'waiting')
  const seq = S['agy:b'].seq
  apply(S, 'agy', 'PostToolUse', { conversationId: 'b' }, 3100); assert.equal(S['agy:b'].state, 'working'); assert.notEqual(S['agy:b'].seq, seq)
  S['agy:b'].pid = 42; tick(S, 3200, () => false); assert.equal(S['agy:b'], undefined)

  apply(S, 'claude', 'SessionEnd', { session_id: 'a' }); assert.equal(S['claude:a'], undefined)

  const oc = (ev, p) => apply(S, 'kilo', ev, { sessionID: 'k', cwd: 'C:/x/Buildethon', ...p })
  oc('prompt', { text: 'add dark mode' }); assert.equal(S['kilo:k'].task, 'add dark mode')
  oc('tool', { tool: 'edit', args: { filePath: 'C:/x/src/theme.css' } }); assert.equal(S['kilo:k'].action, 'Edit theme.css')
  oc('todo.updated', { todos: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] }); assert.deepEqual(S['kilo:k'].todos, { done: 1, total: 3 })
  oc('permission.updated', { title: 'Run npm install' }); assert.equal(S['kilo:k'].state, 'waiting')
  oc('permission.replied'); assert.equal(S['kilo:k'].state, 'working')
  oc('session.idle'); assert.equal(S['kilo:k'].state, 'done')
  apply(S, 'kilo', 'session.deleted', { info: { id: 'k' } }); assert.equal(S['kilo:k'], undefined)
  apply(S, 'claude', 'UserPromptSubmit', { session_id: 'L', cwd: 'C:/x/app', prompt: 'go' }, 10)
  apply(S, 'claude', 'StopFailure', { session_id: 'L', error_type: 'rate_limit' }, 11)
  assert.equal(S['claude:L'].state, 'error'); assert.equal(S['claude:L'].action, 'Usage limit reached')
  apply(S, 'claude', 'StatusLine', { session_id: 'L', context_window: { used_percentage: 42.6 } }, 12); assert.equal(S['claude:L'].context, 43)
  apply(S, 'claude', 'UserPromptSubmit', { session_id: 'L', prompt: 'again' }, 13); assert.equal(S['claude:L'].state, 'working'); assert.equal(S['claude:L'].error, null)
  apply(S, 'agy', 'Stop', { conversationId: 'E', workspacePaths: ['C:/x'], terminationReason: 'error', error: 'RESOURCE_EXHAUSTED: quota exceeded' }, 14)
  assert.equal(S['agy:E'].state, 'error'); assert.equal(S['agy:E'].action, 'Usage limit reached')
  apply(S, 'kilo', 'session.error', { sessionID: 'K2', cwd: 'C:/x', error: { name: 'APIError', data: { message: 'Rate limit exceeded' } } }, 15)
  assert.equal(S['kilo:K2'].action, 'Usage limit reached')
  apply(S, 'copilot', 'PreToolUse', { sessionId: 'V', cwd: 'C:/x/web', toolName: 'editFiles', toolArgs: { filePath: 'C:/x/web/a.ts' } }, 16)
  assert.equal(S['copilot:V'].action, 'EditFiles a.ts'); assert.equal(S['copilot:V'].project, 'web')
  console.log('state.js ok')
}
