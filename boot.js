// Entry point. The installed exe doubles as the hook runner and the uninstall step, so users don't need Node:
//   agent-notch.exe --hook <agent> <Event>   run one hook (see hook.js)
//   agent-notch.exe --disconnect             remove the notch from every agent's config (the uninstaller runs this)
if (process.argv.includes('--hook')) require('./hook.js')
else if (process.argv.includes('--disconnect')) {
  const setup = require('./setup')
  for (const agent of setup.AGENTS) try { setup.set(agent, false) } catch {}
  process.exit(0)
} else require('./main.js')
