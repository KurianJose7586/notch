// Approve from your phone: a tiny web page on your Wi-Fi, off by default. It is a second server, apart from the
// hook server on 127.0.0.1:47800, which must never be reachable from the network. Every request needs the pairing
// token (it's in the QR code's link); "New link" swaps the token, which cuts off every phone paired before.
const http = require('http')
const os = require('os')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const qr = require('qrcode-generator')

const PORT = 47801

// ponytail: first real adapter wins. Setup shows the link as text too, so a wrong pick (VPN) is visible.
function lanIp() {
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    if (!/vEthernet|WSL|VirtualBox|VMware|Docker|Loopback|Tailscale|Hyper-V/i.test(name))
      for (const a of list) if (a.family === 'IPv4' && !a.internal) return a.address
  return null
}

// file: where the on/off switch and token persist. list(): what the phone may see. decide(key, 'allow'|'deny').
function createPhone({ file, list, decide, port = PORT }) {
  let cfg = { enabled: false, token: '' }
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(file, 'utf8')) } } catch {}
  const save = () => fs.writeFileSync(file, JSON.stringify(cfg))
  const newToken = () => crypto.randomBytes(12).toString('base64url')
  const authed = t => {
    const a = Buffer.from(String(t)), b = Buffer.from(cfg.token)
    return !!cfg.token && a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  let server = null, keepAlive = null, last = ''
  const clients = new Set()

  function handler(req, res) {
    const u = new URL(req.url, 'http://x')
    if (!authed(u.searchParams.get('t') || '')) { res.writeHead(403); return res.end('This link is invalid or was replaced. Scan the QR code in Notch again.') }
    if (u.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      return res.end(fs.readFileSync(path.join(__dirname, 'phone.html')))
    }
    if (u.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
      clients.add(res)
      res.on('close', () => clients.delete(res))
      return res.write(`data: ${JSON.stringify(list())}\n\n`)
    }
    if (u.pathname === '/decide' && req.method === 'POST') {
      let body = ''
      return req.on('data', c => { body += c; if (body.length > 1000) req.destroy() }).on('end', () => {
        let m = {}
        try { m = JSON.parse(body) } catch {}
        if (typeof m.key !== 'string' || !['allow', 'deny'].includes(m.choice)) { res.writeHead(400); return res.end() }
        decide(m.key, m.choice) // a no-op unless that request is still waiting
        res.end('ok')
      })
    }
    res.writeHead(404); res.end()
  }

  const api = {
    get enabled() { return cfg.enabled },
    start() {
      if (server || !cfg.enabled) return
      server = http.createServer(handler).on('error', e => { console.error('phone server:', e.message); server = null }).listen(port, '0.0.0.0')
      keepAlive = setInterval(() => clients.forEach(c => c.write(':\n\n')), 25000) // Wi-Fi drops idle streams
    },
    stop() {
      clearInterval(keepAlive)
      clients.forEach(c => c.end()); clients.clear()
      server?.close(); server?.closeAllConnections?.(); server = null
    },
    set(on) {
      cfg.enabled = !!on
      if (on && !cfg.token) cfg.token = newToken()
      save()
      on ? api.start() : api.stop()
    },
    renew() { // revoke every paired phone
      cfg.token = newToken(); save()
      clients.forEach(c => c.end()); clients.clear()
    },
    broadcast() { // called on every notch update; only tells phones when something they show changed
      if (!clients.size) return
      const now = JSON.stringify(list())
      if (now === last) return
      last = now
      clients.forEach(c => c.write(`data: ${now}\n\n`))
    },
    info() {
      if (!cfg.enabled) return { enabled: false }
      const ip = lanIp()
      if (!ip) return { enabled: true, error: 'Not connected to a network' }
      const url = `http://${ip}:${port}/?t=${cfg.token}`
      const code = qr(0, 'M'); code.addData(url); code.make()
      return { enabled: true, url, qr: code.createDataURL(5, 3) }
    },
  }
  return api
}

module.exports = createPhone

if (require.main === module) {
  const assert = require('assert')
  ;(async () => {
    const calls = []
    const file = path.join(os.tmpdir(), 'notch-phone-test.json')
    fs.rmSync(file, { force: true })
    let rows = [{ key: 'a', state: 'waiting' }]
    const p = createPhone({ file, list: () => rows, decide: (k, c) => calls.push([k, c]), port: 47911 })
    assert.equal(p.info().enabled, false)
    p.set(true)
    const { url } = p.info(), t = new URL(url).searchParams.get('t')
    const base = 'http://127.0.0.1:47911'
    await new Promise(r => setTimeout(r, 100))
    assert.equal((await fetch(base + '/')).status, 403, 'no token')
    assert.equal((await fetch(base + '/?t=nope')).status, 403, 'wrong token')
    assert.equal((await fetch(`${base}/?t=${t}`)).status, 200, 'page')
    const post = body => fetch(`${base}/decide?t=${t}`, { method: 'POST', body: JSON.stringify(body) })
    assert.equal((await post({ key: 'a', choice: 'allow' })).status, 200)
    assert.equal((await post({ key: 'a', choice: 'all' })).status, 400, 'only allow/deny')
    assert.equal((await post({ key: 7, choice: 'allow' })).status, 400)
    assert.deepEqual(calls, [['a', 'allow']])
    const ev = await fetch(`${base}/events?t=${t}`), r = ev.body.getReader()
    assert.match(new TextDecoder().decode((await r.read()).value), /"key":"a"/, 'first event is the current list')
    rows = [{ key: 'b', state: 'waiting' }]; p.broadcast()
    assert.match(new TextDecoder().decode((await r.read()).value), /"key":"b"/, 'pushed on change')
    p.renew()
    assert.equal((await fetch(`${base}/?t=${t}`)).status, 403, 'old link revoked')
    p.set(false)
    await new Promise(r => setTimeout(r, 100))
    await assert.rejects(fetch(base + '/'), 'server stopped')
    fs.rmSync(file, { force: true })
    console.log('phone.js ok')
  })().catch(e => { console.error(e); process.exit(1) })
}
