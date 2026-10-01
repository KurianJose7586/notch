// Updates: look for a newer GitHub release at start and every 6 hours, download it quietly, and install it when you
// quit (or on "Restart now"). Packaged builds only. "Check automatically" can be switched off in Setup, which stops
// the background checks (and the only network call this app makes); "Check now" still works.
const fs = require('fs')
const path = require('path')

// updater: electron-updater's autoUpdater (null when running from source). dir: where the on/off marker lives.
function createUpdater({ updater, dir, version, onChange = () => {} }) {
  const off = path.join(dir, 'updates-off')
  const s = { status: updater ? 'idle' : 'dev', version, next: '', error: '' } // idle | checking | downloading | ready | current | error | dev
  const view = () => ({ ...s, auto: !fs.existsSync(off) })
  const set = patch => { Object.assign(s, patch); onChange(view()) }
  const settled = () => s.status === 'ready' // once an update is downloaded, later checks mustn't reset it

  if (updater) {
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.allowPrerelease = false
    updater.on('checking-for-update', () => settled() || set({ status: 'checking', error: '' }))
    updater.on('update-available', i => settled() || set({ status: 'downloading', next: i.version }))
    updater.on('update-not-available', () => settled() || set({ status: 'current' }))
    updater.on('update-downloaded', i => set({ status: 'ready', next: i.version }))
    updater.on('error', e => settled() || set({ status: 'error', error: String(e?.message || e).split('\n')[0].slice(0, 120) }))
  }
  const check = () => { // returns at once; progress and failures arrive as events, so the rejections are swallowed here
    updater?.checkForUpdates().then(r => r?.downloadPromise?.catch(() => {})).catch(() => {})
    return Promise.resolve(view())
  }
  const auto = () => { if (!fs.existsSync(off)) check() }
  return {
    state: view,
    check,
    start() { setTimeout(auto, 30e3); setInterval(auto, 6 * 3600e3) },
    setAuto(on) { if (on) fs.rmSync(off, { force: true }); else fs.writeFileSync(off, ''); set({}); return view() },
    restart() { updater?.quitAndInstall(true, true) }, // silent install, then start the new version
  }
}

module.exports = createUpdater

if (require.main === module) {
  const assert = require('assert'), os = require('os'), { EventEmitter } = require('events')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-upd-'))
  const fake = Object.assign(new EventEmitter(), { checks: 0, quit: null, checkForUpdates() { this.checks++; return Promise.resolve() }, quitAndInstall(...a) { this.quit = a } })
  const seen = []
  const u = createUpdater({ updater: fake, dir, version: '0.3.0', onChange: s => seen.push(s.status) })
  assert.equal(u.state().status, 'idle'); assert.equal(u.state().auto, true)
  fake.emit('checking-for-update'); fake.emit('update-available', { version: '0.3.1' })
  assert.deepEqual(seen, ['checking', 'downloading']); assert.equal(u.state().next, '0.3.1')
  fake.emit('update-downloaded', { version: '0.3.1' })
  assert.equal(u.state().status, 'ready')
  fake.emit('checking-for-update'); fake.emit('update-not-available'); fake.emit('error', new Error('offline'))
  assert.equal(u.state().status, 'ready', 'a downloaded update is never reset by later checks')
  u.restart(); assert.deepEqual(fake.quit, [true, true])
  assert.equal(u.setAuto(false).auto, false); assert.ok(fs.existsSync(path.join(dir, 'updates-off')))
  assert.equal(u.setAuto(true).auto, true); assert.ok(!fs.existsSync(path.join(dir, 'updates-off')))
  const e = createUpdater({ updater: fake, dir, version: '0.3.0' }); fake.emit('error', new Error('boom\nstack line'))
  assert.equal(e.state().status, 'error'); assert.equal(e.state().error, 'boom')
  const dev = createUpdater({ updater: null, dir, version: '0.3.0' })
  assert.equal(dev.state().status, 'dev'); dev.restart()
  dev.check().then(s => { assert.equal(s.status, 'dev'); console.log('updater.js ok') })
}
