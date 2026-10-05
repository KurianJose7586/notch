// Spawns agents in new Windows Terminal windows, optionally inside a fresh git worktree.
const path = require('path')
const { spawn, execFile } = require('child_process')

const AGENTS = ['claude', 'agy', 'opencode', 'kilo']
const PROMPT_FLAG = { claude: '', agy: '-i ', opencode: '--prompt ', kilo: '--prompt ' }

// PowerShell single-quoted literal. PS also treats curly quotes as quote marks, so those are doubled too.
// Windows PowerShell 5.1 drops embedded double quotes when calling native exes, so they're pre-escaped as \".
const psQuote = s => `'${s.replace(/"/g, '\\"').replace(/['\u2018\u2019\u201A\u201B]/g, m => m + m)}'`

const commandFor = (agent, prompt) => prompt ? `${agent} ${PROMPT_FLAG[agent]}${psQuote(prompt)}` : agent

// Own window per agent (tabs can't be tiled). -NoExit keeps the shell open after the agent quits.
// The command goes in base64 so nothing in the prompt can break out of it.
function launchAgent(agent, dir, prompt) {
  const encoded = Buffer.from(commandFor(agent, prompt), 'utf16le').toString('base64')
  spawn('wt.exe', ['-w', 'new', '-d', dir, 'powershell.exe', '-NoLogo', '-NoExit', '-EncodedCommand', encoded], { detached: true, stdio: 'ignore' }).unref()
}

const git = (args, cwd) => new Promise((ok, fail) =>
  execFile('git', args, { cwd, windowsHide: true }, (e, out, err) => e ? fail(new Error((err || e.message).trim().split('\n')[0])) : ok(out.trim())))

// <parent>/<repo>.worktrees/<repo>-<agent>-<id> on branch notch/<agent>-<id>, branched from HEAD.
// ponytail: starts at the worktree root even if you picked a subfolder, and uncommitted changes don't carry over
let nextWorktree = 0 // several of the same agent started together must not share a branch
async function makeWorktree(dir, agent) {
  const root = path.resolve(await git(['rev-parse', '--show-toplevel'], dir))
  const repo = path.basename(root), id = `${agent}-${Date.now().toString(36).slice(-5)}${nextWorktree++}`
  const target = path.join(path.dirname(root), `${repo}.worktrees`, `${repo}-${id}`)
  await git(['worktree', 'add', '-b', `notch/${id}`, target], root)
  return target
}

// Bringing worktree agents' work home. The main checkout is always listed first.
async function worktrees(dir) {
  const blocks = (await git(['worktree', 'list', '--porcelain'], dir)).split(/\r?\n\r?\n/)
  const all = blocks.map(b => ({ path: path.resolve(b.match(/^worktree (.*)$/m)[1]), branch: b.match(/^branch refs\/heads\/(.*)$/m)?.[1] }))
  return { main: all[0].path, notch: all.filter(w => w.branch?.startsWith('notch/')) }
}

// Each launched branch and how big it is. Agents rarely commit, so what they left is committed to their own branch first,
// except in `busy` worktrees whose agent is still at it. names: worktree path -> commit message (the session's name).
async function branches(dir, busy = [], names = {}) {
  const { main, notch } = await worktrees(dir)
  const into = await git(['rev-parse', '--abbrev-ref', 'HEAD'], main)
  const list = await Promise.all(notch.map(async w => {
    if (busy.some(b => samePath(b, w.path))) return { ...w, busy: true }
    try {
      if (await git(['status', '--porcelain'], w.path)) {
        const name = Object.entries(names).find(([p]) => samePath(p, w.path))?.[1]
        await git(['add', '-A'], w.path)
        await git(['commit', '-q', '-m', String(name || `Agent work on ${w.branch}`).slice(0, 200)], w.path)
      }
      const stat = await git(['diff', '--shortstat', `HEAD...${w.branch}`], main)
      return { ...w, stat, subject: stat && await git(['log', '-1', '--format=%s', w.branch], main) }
    } catch (e) { return { ...w, error: e.message } }
  }))
  return { main, into, list }
}

// Merges one at a time, so a branch that clashes with one merged before it is caught too. A conflict is aborted and left for later.
// Your own uncommitted changes stop it ({ dirty: true }) unless saveMine commits them first.
async function bringHome(dir, pick, saveMine = false) {
  const { main, notch } = await worktrees(dir)
  if (await git(['status', '--porcelain', '--untracked-files=no'], main)) {
    if (!saveMine) return { dirty: true }
    await git(['commit', '-q', '-a', '-m', 'Save my work before merging agent branches'], main)
  }
  const out = {}
  for (const w of notch.filter(w => pick.includes(w.branch))) {
    try { await git(['merge', '--no-edit', w.branch], main) }
    catch { await git(['merge', '--abort'], main).catch(() => {}); out[w.branch] = 'conflict'; continue }
    out[w.branch] = 'merged'
    try { await git(['worktree', 'remove', '--force', w.path], main); await git(['branch', '-d', w.branch], main) }
    catch { out[w.branch] = 'tidy' } // Windows won't delete a folder a terminal is still sitting in
  }
  return out
}

async function discard(dir, branch) {
  const { main, notch } = await worktrees(dir), w = notch.find(w => w.branch === branch)
  if (!w) return
  await git(['worktree', 'remove', '--force', w.path], main)
  await git(['branch', '-D', branch], main)
}

// A name for each launched session: the task it was given, or "Claude 2" when the same agent is started more than once.
const PRETTY = { claude: 'Claude', agy: 'Antigravity', opencode: 'OpenCode', kilo: 'Kilo' }
const launchLabels = (agents, prompts) => agents.map((a, i) =>
  prompts ? String(prompts[i] ?? '').trim().slice(0, 40) : agents.filter(x => x === a).length > 1 ? `${PRETTY[a]} ${agents.slice(0, i + 1).filter(x => x === a).length}` : '')

const samePath = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()

module.exports = { AGENTS, launchAgent, makeWorktree, worktrees, branches, bringHome, discard, samePath, commandFor, launchLabels }

if (require.main === module) {
  const assert = require('assert')
  assert.equal(commandFor('claude', ''), 'claude')
  assert.equal(commandFor('agy', 'fix it'), "agy -i 'fix it'")
  assert.equal(commandFor('kilo', "don't"), "kilo --prompt 'don''t'")
  assert.equal(commandFor('claude', 'it’s'), "claude 'it’’s'")
  assert.equal(commandFor('opencode', 'say "hi" $HOME `x`'), `opencode --prompt 'say \\"hi\\" $HOME \`x\`'`)
  assert.ok(samePath('C:/Code/App', 'c:\\code\\app\\'))
  assert.deepEqual(launchLabels(['claude', 'claude', 'agy'], null), ['Claude 1', 'Claude 2', ''])
  assert.deepEqual(launchLabels(['claude'], null), [''])
  assert.deepEqual(launchLabels(['claude', 'agy'], ['fix the tests', ' add a README ']), ['fix the tests', 'add a README'])
  // two of the same agent, started at once, each get their own worktree and branch
  const fs = require('fs'), os = require('os')
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-wt-'))
  ;(async () => {
    await git(['init', '-q'], repoDir)
    await git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], repoDir)
    const made = await Promise.all([makeWorktree(repoDir, 'claude'), makeWorktree(repoDir, 'claude'), makeWorktree(repoDir, 'claude')])
    assert.equal(new Set(made).size, 3, 'distinct worktrees: ' + made.join(', '))
    made.forEach(d => assert.ok(fs.existsSync(d)))
    // bring them home: the first adds a file, the other two edit the same line, so the third clashes once the second is in
    await git(['config', 'user.name', 't'], repoDir); await git(['config', 'user.email', 't@t'], repoDir)
    fs.writeFileSync(path.join(made[0], 'new.txt'), 'hi\n')
    fs.writeFileSync(path.join(made[1], 'a.txt'), 'one\n')
    fs.writeFileSync(path.join(made[2], 'a.txt'), 'two\n')
    const { list } = await branches(repoDir, [], { [made[0]]: 'add new.txt' })
    assert.ok(list.every(b => b.stat.startsWith('1 file changed')), JSON.stringify(list))
    assert.equal(await git(['log', '-1', '--format=%s', list[0].branch], repoDir), 'add new.txt')
    // your own uncommitted edit blocks the merge, unless you say to commit it first
    fs.writeFileSync(path.join(repoDir, 'mine.txt'), 'v1\n'); await git(['add', 'mine.txt'], repoDir); await git(['commit', '-q', '-m', 'mine'], repoDir)
    fs.writeFileSync(path.join(repoDir, 'mine.txt'), 'v2\n')
    assert.deepEqual(await bringHome(repoDir, list.map(b => b.branch)), { dirty: true })
    const res = await bringHome(repoDir, list.map(b => b.branch), true)
    assert.equal(fs.readFileSync(path.join(repoDir, 'mine.txt'), 'utf8'), 'v2\n')
    assert.ok((await git(['log', '--format=%s'], repoDir)).includes('Save my work before merging agent branches'))
    assert.deepEqual(Object.values(res), ['merged', 'merged', 'conflict'])
    assert.equal(await git(['status', '--porcelain'], repoDir), '', 'an aborted merge leaves the checkout clean')
    await discard(repoDir, list[2].branch)
    assert.equal((await worktrees(repoDir)).notch.length, 0)
    fs.rmSync(repoDir, { recursive: true, force: true }); fs.rmSync(repoDir + '.worktrees', { recursive: true, force: true })
    console.log('launch.js ok')
  })().catch(e => { console.error(e); process.exit(1) })
}
