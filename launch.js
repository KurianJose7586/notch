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
async function makeWorktree(dir, agent) {
  const root = path.resolve(await git(['rev-parse', '--show-toplevel'], dir))
  const repo = path.basename(root), id = `${agent}-${Date.now().toString(36).slice(-5)}`
  const target = path.join(path.dirname(root), `${repo}.worktrees`, `${repo}-${id}`)
  await git(['worktree', 'add', '-b', `notch/${id}`, target], root)
  return target
}

const samePath = (a, b) => !!a && !!b && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()

module.exports = { AGENTS, launchAgent, makeWorktree, samePath, commandFor }

if (require.main === module) {
  const assert = require('assert')
  assert.equal(commandFor('claude', ''), 'claude')
  assert.equal(commandFor('agy', 'fix it'), "agy -i 'fix it'")
  assert.equal(commandFor('kilo', "don't"), "kilo --prompt 'don''t'")
  assert.equal(commandFor('claude', 'it’s'), "claude 'it’’s'")
  assert.equal(commandFor('opencode', 'say "hi" $HOME `x`'), `opencode --prompt 'say \\"hi\\" $HOME \`x\`'`)
  assert.ok(samePath('C:/Code/App', 'c:\\code\\app\\'))
  console.log('launch.js ok')
}
