// Team messages: coding agents of any provider working on the same git repo, on this PC and on teammates' PCs, can
// message each other. The repo's own remote carries them: this PC appends each message as an empty commit on a ref of
// its own, refs/notch/msg/<me>, and fetches everyone's into refs/notch/in/. One writer per ref, so pushes never clash,
// and the ref doubles as the outbox: a push that fails (offline) goes out with the next one. Whoever can push to the
// repo is on the team and nobody else is. Branches, tags and the working tree are never touched.
// A repo's channel opens when someone first sends a message there; until then nothing is pushed to it.
// Coordinate mode (per repo, on this PC) keeps agents working with the team until a message marks the work done.
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { git } = require('./launch')

const EVERY_MS = 15000 // how often a repo with live agents is fetched (and right after a send); 4x slower until anyone has used it
const SINCE = '30.minutes.ago' // a teammate seen for the first time: only their recent messages are taken
const STALE_MS = 15 * 60e3 // presence nobody refreshed for this long (their PC slept or went offline) isn't shown
const KEEP = 100 // messages kept per repo
const MAX = 2000 // characters per message: notes, not documents (and a hook's context has room for several)
const CATCH_UP_MS = 24 * 3600e3 // a message none of an agent's sessions saw still reaches its next session within a day

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 40)

// Who a message is for. to: '' or 'all' = everyone; otherwise names split by commas or spaces: a teammate ('bob', all
// their agents), an agent ('api'), or both ('bob/api'). Returns 'direct', 'all' or false.
function addressed(to, human, name) {
  const want = String(to || '').toLowerCase().split(/[\s,]+/).map(t => t.replace(/^@/, '')).filter(Boolean)
  if (want.some(t => t === human || t === name || t === `${human}/${name}`)) return 'direct'
  return !want.length || want.some(t => t === 'all' || t === 'everyone') ? 'all' : false
}

// A message or presence commit's JSON, after its one-line subject; null if it isn't one.
const parse = body => { try { return JSON.parse(body.slice(body.indexOf('\n\n') + 2)) } catch { return null } }

// file: on/off switch, delivery cursors and recent messages. every: fetch interval. host: this PC's name.
// changed(): there's a new message, or teammates' agents came, went or moved on (the notch redraws).
function createTeam({ file, every = EVERY_MS, host = os.hostname(), changed = () => {} }) {
  let data = { on: false, seen: {}, log: {}, cursors: {}, coord: {} }
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) } } catch {}
  const save = () => fs.writeFileSync(file, JSON.stringify(data))
  let n = Math.max(0, ...Object.values(data.log).flat().map(m => m.n)) // message numbers, for delivery cursors
  const byCwd = {}, repos = {}, ids = {} // ids: folder -> repo, once known
  let active = new Set()

  // The repo a folder belongs to (a worktree shares its main checkout's). Rejects outside git.
  const open = cwd => byCwd[cwd] ||= (async () => {
    const dir = path.resolve(await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)), id = dir.toLowerCase()
    ids[cwd] = id
    if (repos[id]) return repos[id]
    const conf = k => git(['config', k], cwd).catch(() => '')
    const [name, email, remotes] = await Promise.all([conf('user.name'), conf('user.email'), git(['remote'], cwd)])
    const human = slug(name || os.userInfo().username) || 'me', list = remotes.split(/\s+/).filter(Boolean)
    return repos[id] ||= {
      id, dir, human, remote: list.includes('origin') ? 'origin' : list[0] || null,
      // this PC's ref; a second clone of the same repo here gets its own, so no ref ever has two writers
      me: `${human}-${slug(host)}-${crypto.createHash('sha1').update(id).digest('hex').slice(0, 6)}`,
      ident: ['-c', `user.name=${name || human}`, '-c', `user.email=${email || `${human}@${slug(host)}`}`],
      queue: Promise.resolve(), live: false, dirty: false, busy: false, next: 0, who: [], error: null, synced: 0,
    }
  })()

  const g = (r, args, timeout) => git([`--git-dir=${r.dir}`, ...args], r.dir, timeout)
  const run = (r, fn) => { const p = r.queue.then(fn); r.queue = p.catch(() => {}); return p } // one git job per repo at a time
  async function commit(r, message, parent) {
    r.tree ||= await g(r, ['mktree']) // the empty tree: messages carry no files
    // --no-gpg-sign: plumbing, not code; a signing prompt per message would make this unusable
    return g(r, [...r.ident, 'commit-tree', '--no-gpg-sign', ...(parent ? ['-p', parent] : []), '-m', message, r.tree])
  }
  function add(r, m) {
    m.n = ++n
    m.got = [] // which agents it has reached (human/name)
    const log = data.log[r.id] ||= []
    log.push(m)
    log.splice(0, log.length - KEEP)
    save()
    changed()
  }

  // name: what the sending agent is called, agent: what kind it is; key: its session, so it isn't handed its own message back.
  // done: the team's shared work is finished, which ends a coordinated round on every PC.
  async function send(cwd, { name, agent = '', to, text, key, done }) {
    const r = await open(cwd)
    text = String(text || '').trim().slice(0, MAX)
    if (!text) throw new Error('The message is empty')
    const m = { from: `${r.human}/${name}`, agent, to: String(to || '').trim().slice(0, 200), text, ...(done ? { done: true } : {}) }
    const id = !r.remote ? crypto.randomUUID() : await run(r, async () => { // no remote: only this PC's agents can hear it
      const ref = `refs/notch/msg/${r.me}`, parent = await g(r, ['rev-parse', '-q', '--verify', ref]).catch(() => '')
      const sha = await commit(r, `notch: ${m.from} -> ${m.to || 'all'}\n\n${JSON.stringify(m)}`, parent)
      await g(r, ['update-ref', ref, sha])
      r.live = r.dirty = true
      return sha
    })
    add(r, { id, ...m, key, at: Date.now() })
    r.next = 0 // out with the next sync
    return r
  }

  // Messages a session hasn't been shown yet, addressed to it and not its own. started: when it showed up; on its first
  // call it gets what arrived since, and what none of this agent's sessions saw in the last day, so a message to an
  // agent that had stopped reaches it when it's back. direct: only if one of them names it (news alone doesn't keep a
  // finishing agent going).
  async function take(cwd, key, name, { started = Date.now(), direct = false } = {}) {
    const r = await open(cwd), me = `${r.human}/${name}`
    const since = data.cursors[key]
    const missed = m => m.got && !m.got.includes(me) && m.from !== me && Date.now() - m.at < CATCH_UP_MS
    const mail = (data.log[r.id] || []).filter(m => (since === undefined ? m.at >= started || missed(m) : m.n > since) && m.key !== key && addressed(m.to, r.human, name))
    if (direct && !mail.some(m => addressed(m.to, r.human, name) === 'direct')) return []
    for (const m of mail) if (m.got && !m.got.includes(me)) m.got.push(me)
    delete data.cursors[key]
    data.cursors[key] = n // newest last, so the oldest go first below
    const keys = Object.keys(data.cursors)
    for (const k of keys.slice(0, keys.length - 500)) delete data.cursors[k]
    if (mail.length || since === undefined) save()
    return mail
  }

  // Teammates' agents on a folder's repo (this PC's own are main.js's sessions), and how the link to the remote is doing.
  async function roster(cwd) {
    const r = await open(cwd)
    return { id: r.id, human: r.human, remote: r.remote, live: r.live, error: r.error, synced: r.synced, who: r.who }
  }

  // Coordinate mode on a folder's repo, and its latest message (main.js works out whether a round is still going).
  async function coordination(cwd) {
    const r = await open(cwd)
    return { on: !!data.coord[r.id], last: (data.log[r.id] || []).at(-1) || null }
  }
  function setCoord(id, on) { if (on) data.coord[id] = true; else delete data.coord[id]; save(); changed() }

  // What this PC's agents on a repo are doing. Republished when it changes, and every few minutes so it doesn't go stale.
  function present(r, agents) {
    const text = JSON.stringify(agents)
    if (text === r.shown && Date.now() - r.shownAt < STALE_MS / 3) return
    r.shown = text
    r.shownAt = Date.now()
    r.dirty = true // keeps the repo syncing until this has gone out
    run(r, async () => {
      await g(r, ['update-ref', `refs/notch/who/${r.me}`, await commit(r, `notch: ${r.human} presence\n\n${JSON.stringify({ human: r.human, agents, at: Date.now() })}`)])
      r.dirty = true
    }).catch(() => { r.shown = null }) // try again next sync
  }

  async function syncRepo(r) {
    if (r.dirty) {
      r.dirty = false
      const mine = (await g(r, ['for-each-ref', '--format=%(refname)', `refs/notch/msg/${r.me}`, `refs/notch/who/${r.me}`])).split('\n').filter(Boolean)
      // --no-verify: messages, not code, so the repo's pre-push hooks (tests, linters) have nothing to check
      if (mine.length) await g(r, ['push', '-q', '--no-verify', r.remote, ...mine.map(ref => `+${ref}:${ref}`)], 30000).catch(e => { r.dirty = true; throw e })
    }
    await g(r, ['fetch', '-q', '--no-write-fetch-head', r.remote, '+refs/notch/msg/*:refs/notch/in/msg/*', '+refs/notch/who/*:refs/notch/in/who/*'], 30000)
    const seen = data.seen[r.id] ||= {}
    for (const [ref, tip] of (await g(r, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/notch/in/msg'])).split('\n').filter(Boolean).map(l => l.split(' '))) {
      r.live = true // someone has used this repo's channel
      if (ref.endsWith('/' + r.me) || seen[ref] === tip) continue
      const log = range => g(r, ['log', '--reverse', '-n', '50', '--format=%H%x1f%B%x1e', ...range])
      // after the last one taken; or, first time (or that one is gone), the recent ones
      const out = await (seen[ref] ? log([`${seen[ref]}..${tip}`]) : Promise.reject()).catch(() => log([`--since=${SINCE}`, tip]))
      for (const rec of out.split('\x1e')) {
        const [id, body = ''] = rec.trim().split('\x1f'), m = parse(body)
        if (typeof m?.from !== 'string' || typeof m.text !== 'string') continue
        const msg = { id, from: m.from.slice(0, 80), agent: String(m.agent || '').slice(0, 20), to: String(m.to || '').slice(0, 200), text: m.text.slice(0, MAX), ...(m.done === true ? { done: true } : {}), at: Date.now() }
        add(r, msg)
      }
      seen[ref] = tip
      save()
    }
    const who = []
    for (const rec of (await g(r, ['for-each-ref', '--format=%(refname)%1f%(contents)%1e', 'refs/notch/in/who'])).split('\x1e')) {
      const [ref, body = ''] = rec.trim().split('\x1f'), p = ref && !ref.endsWith('/' + r.me) && parse(body)
      if (p && Date.now() - p.at < STALE_MS && Array.isArray(p.agents)) who.push(...p.agents.map(a => ({ human: String(p.human), name: String(a.name), agent: String(a.agent), task: String(a.task || '') })))
    }
    if (JSON.stringify(who) !== JSON.stringify(r.who)) { r.who = who; changed() }
  }

  // What the notch shows: per repo, teammates' agents and the recent messages (mine: sent from this PC).
  const state = () => Object.fromEntries(Object.values(repos).map(r => [r.id, {
    human: r.human, remote: r.remote, live: r.live, error: r.error, who: r.who, coord: !!data.coord[r.id],
    log: (data.log[r.id] || []).slice(-30).map(({ id, from, agent, to, text, at, key, done, got }) => ({ id, from, agent, to, text, at, mine: !!key, done: !!done,
      // a teammate's message for this PC that none of its agents has had yet (it reaches the next one that's working here)
      waiting: !key && got?.length === 0 && (!!addressed(to, r.human, '') || String(to).toLowerCase().includes(r.human + '/')) })),
  }]))

  // groups: { cwd: [{ name, agent, task }] } for every folder with live agents on this PC. Called every tick; each repo
  // is fetched every `every` ms (or right after a send), and once more after its last agent here leaves, so teammates
  // see them go. Resolves when the fetches it started are done.
  async function sync(groups, now = Date.now()) {
    const agentsOf = new Map()
    for (const [cwd, agents] of Object.entries(groups)) {
      const r = await open(cwd).catch(() => null)
      if (r?.remote) agentsOf.set(r, [...(agentsOf.get(r) || []), ...agents])
    }
    for (const r of active) if (!agentsOf.has(r)) agentsOf.set(r, [])
    const jobs = []
    for (const [r, agents] of agentsOf) {
      if (r.live) present(r, agents) // queued ahead of the sync below, so it goes out with it
      if (r.busy || r.next > now) continue
      r.busy = true
      jobs.push(run(r, () => syncRepo(r))
        .then(() => { r.error = null; r.synced = Date.now(); r.next = Date.now() + every * (r.live ? 1 : 4) }, e => { r.error = e.message; r.next = Date.now() + every * 4 })
        .finally(() => { r.busy = false }))
    }
    active = new Set([...agentsOf].filter(([r, a]) => a.length || r.dirty).map(([r]) => r)) // a repo whose last agent left stays until that's out
    await Promise.all(jobs)
  }

  return {
    get on() { return data.on },
    set(on) { data.on = !!on; save() },
    repo: cwd => open(cwd).then(r => r.id, () => null),
    idOf: cwd => ids[cwd], // the same, for a folder already looked at; undefined otherwise
    hurry: cwd => open(cwd).then(r => { r.next = 0 }, () => {}), // someone's waiting on a reply: fetch on the next sync
    send, take, roster, sync, addressed, state, coordination, setCoord,
  }
}

module.exports = { createTeam, slug, addressed }

if (require.main === module) {
  const assert = require('assert')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-team-'))
  const origin = path.join(tmp, 'origin.git'), A = path.join(tmp, 'alice'), B = path.join(tmp, 'bob'), A2 = path.join(tmp, 'alice-wt')
  assert.equal(addressed('', 'bob', 'api'), 'all'); assert.equal(addressed('@Bob', 'bob', 'api'), 'direct')
  assert.equal(addressed('alice, bob/api', 'bob', 'api'), 'direct'); assert.equal(addressed('bob/web', 'bob', 'api'), false)
  assert.equal(slug('Fix the login redirect!'), 'fix-the-login-redirect')
  ;(async () => {
    await git(['init', '-q', '--bare', origin], tmp)
    for (const [dir, who] of [[A, 'Alice'], [B, 'Bob']]) {
      await git(['clone', '-q', origin, dir], tmp)
      await git(['config', 'user.name', who], dir); await git(['config', 'user.email', `${who}@x`], dir)
    }
    await git(['commit', '-q', '--allow-empty', '-m', 'x'], A)
    await git(['worktree', 'add', '-q', A2], A) // an agent in a worktree is on the same repo
    const a = createTeam({ file: path.join(tmp, 'a.json'), every: 0, host: 'pc-a' })
    const b = createTeam({ file: path.join(tmp, 'b.json'), every: 0, host: 'pc-b' })
    const texts = mail => mail.map(m => m.text)

    // same PC: straight from one agent to the next, before any push
    await a.take(A, 'kilo:3', 'kilo', { started: 0 })
    await a.send(A, { name: 'claude', text: 'renamed /cart/checkout → /orders', key: 'claude:1' })
    assert.deepEqual(texts(await a.take(A2, 'kilo:3', 'kilo')), ['renamed /cart/checkout → /orders'])
    assert.deepEqual(await a.take(A2, 'kilo:3', 'kilo'), [], 'shown once')
    assert.deepEqual(await a.take(A, 'claude:1', 'claude', { started: 0 }), [], 'not your own')

    // across PCs, through the remote; presence too
    await a.sync({ [A]: [{ name: 'claude', agent: 'claude', task: 'orders API' }] })
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    assert.deepEqual(texts(await b.take(B, 'opencode:9', 'opencode', { started: 0 })), ['renamed /cart/checkout → /orders'], 'non-ASCII survives the trip')
    assert.equal((await b.take(B, 'opencode:9', 'opencode'))[0], undefined)
    assert.deepEqual((await b.roster(B)).who, [{ human: 'alice', name: 'claude', agent: 'claude', task: 'orders API' }])
    // what the notch draws: the sender sees it as sent from here, the teammate as received, both with who's around
    const [mine] = Object.values(a.state())[0].log, [theirs] = Object.values(b.state())[0].log
    assert.deepEqual([mine.mine, theirs.mine, theirs.from, theirs.id === mine.id], [true, false, 'alice/claude', true])
    assert.equal(Object.values(b.state())[0].who[0].task, 'orders API')
    assert.equal(b.idOf(B), Object.keys(b.state())[0])

    // a question for one agent; news alone doesn't count as direct
    await b.send(B, { name: 'opencode', to: 'alice/claude', text: 'what does /orders return?', key: 'opencode:9' })
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    await a.sync({ [A]: [{ name: 'claude', agent: 'claude', task: 'orders API' }] })
    assert.deepEqual(await a.take(A2, 'kilo:3', 'kilo', { direct: true }), [], 'not for kilo')
    const q = await a.take(A, 'claude:1', 'claude', { direct: true })
    assert.deepEqual(q.map(m => [m.from, m.text]), [['bob/opencode', 'what does /orders return?']])
    assert.deepEqual((await a.roster(A)).who.map(w => w.name), ['opencode'], 'bob joined once the channel was open')

    // coordinate mode is this PC's switch; a message marked done reaches the other PC as done
    assert.equal((await b.coordination(B)).on, false)
    b.setCoord(b.idOf(B), true)
    assert.equal((await b.coordination(B)).on, true)
    await a.send(A, { name: 'claude', text: 'all done and tested', key: 'claude:1', done: true })
    await a.sync({ [A]: [{ name: 'claude', agent: 'claude', task: 'orders API' }] })
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    const { last } = await b.coordination(B)
    assert.deepEqual([last.text, last.done], ['all done and tested', true])
    assert.equal(Object.values(b.state())[0].coord, true)
    assert.deepEqual(texts(await b.take(B, 'opencode:9', 'opencode')), ['all done and tested'])

    // offline: the send waits in the ref and goes out with the next sync that reaches the remote
    await git(['remote', 'set-url', 'origin', path.join(tmp, 'nowhere.git')], A)
    await a.send(A, { name: 'claude', to: 'bob', text: '{ id, status }', key: 'claude:1' })
    await a.sync({ [A]: [] })
    assert.ok((await a.roster(A)).error, 'unreachable remote is reported')
    await git(['remote', 'set-url', 'origin', origin], A)
    await a.sync({ [A]: [{ name: 'claude', agent: 'claude', task: 'orders API' }] })
    assert.equal((await a.roster(A)).error, null)
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    assert.deepEqual(texts(await b.take(B, 'opencode:9', 'opencode')), ['{ id, status }'])

    // a message for an agent with no session running shows as waiting; its next session gets it, and only once
    await b.send(B, { name: 'opencode', to: 'alice/claude', text: 'ping while you were away', key: 'opencode:9' })
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    await a.sync({ [A]: [] })
    assert.equal(Object.values(a.state())[0].log.at(-1).waiting, true)
    const later = Date.now() + 1000 // sessions that started after it arrived
    assert.deepEqual(texts(await a.take(A, 'claude:9', 'claude', { started: later })), ['ping while you were away'])
    assert.deepEqual(await a.take(A, 'claude:10', 'claude', { started: later }), [], 'once per agent')
    assert.equal(Object.values(a.state())[0].log.at(-1).waiting, false)
    await a.take(A, 'claude:1', 'claude') // the session that was already running gets it too

    // a restarted notch picks up where it left off
    const a2 = createTeam({ file: path.join(tmp, 'a.json'), every: 0, host: 'pc-a' })
    assert.deepEqual(await a2.take(A, 'claude:1', 'claude'), [], 'nothing shown twice')

    // the last agent leaves: teammates see them go, even though the next fetch wasn't due when it left
    const a3 = createTeam({ file: path.join(tmp, 'a.json'), every: 60000, host: 'pc-a' })
    await a3.sync({ [A]: [{ name: 'claude', agent: 'claude', task: 'orders API' }] })
    await a3.sync({})
    await a3.sync({}, Date.now() + 10 * 60000)
    await b.sync({ [B]: [{ name: 'opencode', agent: 'opencode', task: 'checkout page' }] })
    assert.deepEqual((await b.roster(B)).who, [])

    // only notch refs: no branches pushed, nothing in the working tree
    assert.equal(await git(['for-each-ref', '--format=%(refname)', 'refs/heads'], origin), '')
    assert.equal(await git(['status', '--porcelain'], B), '')
    await assert.rejects(a.take(tmp, 'x:1', 'x'), 'a folder outside git has no team')
    await git(['worktree', 'remove', '--force', A2], A)
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log('team.js ok')
  })().catch(e => { console.error(e); process.exit(1) })
}
