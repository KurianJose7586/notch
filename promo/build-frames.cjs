// Generates compositions/frames/NN-*.html from one place so every frame shares the notch's look.
// Run: node build-frames.cjs   (then assemble with the workflow's assemble-index script)
const fs = require('fs')
const path = require('path')
const OUT = path.join(__dirname, 'compositions', 'frames')
fs.mkdirSync(OUT, { recursive: true })

// ---------- shared look (scoped per frame with `$`) ----------
const COMMON = `
$ { font-family: "Notch Sans", sans-serif; color: #fff; }
$ .bg { position: absolute; inset: 0; background: #000; }
$ .cam, $ .cam2 { position: absolute; inset: 0; }
$ .wall { position: absolute; inset: 0; background: radial-gradient(120% 90% at 30% 20%, #34405e, #1a1f2e 60%, #0d0f16); }
$ .h { position: absolute; font-weight: 700; font-variation-settings: "opsz" 36; letter-spacing: -.045em; line-height: 1.04; text-transform: lowercase; color: #fff; }
$ .h div { display: block; }
$ .o { color: #FF9F0A; } $ .b { color: #0A84FF; } $ .r { color: #FF453A; } $ .g { color: #30D158; }
$ .term { position: absolute; width: 500px; height: 300px; background: #0c0c0c; border: 2px solid #3a3a3a; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,.6); overflow: hidden; }
$ .term .bar { height: 40px; background: #202020; display: flex; align-items: center; gap: 12px; padding: 0 16px; font-size: 19px; color: #ddd; }
$ .term .bar img { width: 22px; height: 22px; }
$ .term .tx { padding: 14px 18px; font: 19px/1.5 "Notch Mono", monospace; color: #c8c8c8; white-space: pre; }
$ .pill { position: absolute; left: 0; right: 0; margin: 0 auto; top: 36px; width: max-content; height: 72px; border-radius: 36px; background: #000;
          display: flex; align-items: center; gap: 18px; padding: 0 30px 0 26px; font-size: 27px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap;
          box-shadow: 0 0 0 1px rgba(255,255,255,.1) inset, 0 24px 64px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.4); }
$ .rim { position: absolute; inset: 0; border-radius: inherit; padding: 3px; --spin: 0deg;
         background: conic-gradient(from var(--spin), transparent 0deg 240deg, rgba(10,132,255,.9) 315deg, rgba(191,90,242,.95) 342deg, transparent 360deg);
         -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
$ .dots { position: relative; display: flex; }
$ .dots i { display: block; width: 24px; height: 24px; border-radius: 50%; border: 3px solid #000; margin-left: -9px; }
$ .dots i:first-child { margin-left: 0; }
$ .tile { display: grid; place-items: center; border-radius: 22%; box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset, 0 2px 4px rgba(0,0,0,.4); flex: none; }
$ .tile img { width: 62%; height: 62%; }
$ .tile.agy img, $ .tile.kilo img { width: 80%; height: 80%; }
$ .claude { background: #F4EFE6; } $ .agy { background: linear-gradient(160deg, #24252B, #131418); }
$ .opencode { background: linear-gradient(160deg, #262222, #121010); } $ .kilo { background: #0B0B0B; }
$ .copilot { background: linear-gradient(160deg, #3B2A6B, #17112E); }
$ .key { position: absolute; display: grid; place-items: center; background: linear-gradient(#2c2c2e, #1c1c1e); border: 3px solid #48484a; color: #fff; font-weight: 700;
         box-shadow: 0 10px 0 #0a0a0a, 0 24px 48px rgba(0,0,0,.55); }
$ .card { position: absolute; background: #1c1c1e; border-radius: 28px; }
$ .spin { display: inline-block; border-radius: 50%; border: 3px solid rgba(10,132,255,.25); border-top-color: #0A84FF; }
`
const DOT = { claude: '#D97757', agy: '#3DBE6A', opencode: '#EDE8E6', kilo: '#F8F675', copilot: '#8B5CF6' }
const NAME = { claude: 'Claude', agy: 'Antigravity', opencode: 'OpenCode', kilo: 'Kilo', copilot: 'Copilot' }
const logo = a => `assets/logo-${a}.svg`
const tile = (a, px) => `<div class="tile ${a}" style="width:${px}px;height:${px}px"><img src="${logo(a)}" alt=""></div>`
const dots = list => `<span class="dots">${list.map(a => `<i style="background:${DOT[a]}"></i>`).join('')}</span>`
const term = (id, a, title, x, y, text, extra = '') =>
  `<div class="term" id="${id}" style="left:${x}px;top:${y}px;${extra}"><div class="bar" data-layout-allow-overlap><img src="${logo(a)}" alt="">${title}</div><div class="tx" data-layout-allow-overlap>${text}</div></div>`

// The chaos pile from frame 1, reused (frozen) in frame 4 and (calm) in frame 8.
const PILE = [
  ['claude', 'claude · payments-api', 70, 90, -4, '✻ Editing auth.ts…\n<span class="o">? Allow edit to auth.ts</span>'],
  ['agy', 'agy · payments-api', 430, 330, 3, 'Running tests…\n<span class="o">1. Yes  2. No</span>'],
  ['opencode', 'opencode · web-app', 1090, 70, 5, 'Reading router.tsx\n<span class="b">● thinking</span>'],
  ['kilo', 'kilo · web-app', 1290, 560, -6, 'Add dark mode\n<span class="g">✓ theme.css</span>'],
  ['copilot', 'copilot · docs', 780, 640, -2, 'EditFiles quickstart.md\n…'],
  ['claude', 'claude · landing', 40, 640, 7, '✻ Thinking…'],
  ['agy', 'agy · infra', 650, 30, -8, '<span class="o">Do you trust this folder?</span>'],
  ['opencode', 'opencode · cli', 1380, 300, 9, 'Run: npm i\n<span class="o">Allow? (y/n)</span>'],
  ['kilo', 'kilo · mobile', 240, 400, -10, 'Edit App.tsx\n<span class="o">needs you</span>'],
  ['copilot', 'copilot · api', 1020, 400, 6, 'Plan: 4 steps'],
  ['claude', 'claude · infra', 560, 520, -5, '<span class="r">Error: 429</span>'],
  ['agy', 'agy · docs', 1500, 40, 3, 'Stop hook…'],
]

function frame(id, dur, css, html, js) {
  // chaos layers and tight display leading overlap on purpose; tell the layout audit so
  html = html.replace(/<(div|span) (class="(?:term|prompt|badge|h word|chip|o|r|g|b)[^"]*"|id="f(?:\d\d|ph)-l\d")/g, '<$1 data-layout-allow-overlap $2')
  const scope = `[data-composition-id="${id}"]`
  const style = (COMMON + css).replace(/\$ /g, scope + ' ').replace(/\$ \{/g, scope + ' {').replace(/\$\s*\{/g, scope + ' {')
  return `<template>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: "Notch Sans"; src: url("assets/fonts/SegUIVar.ttf"); font-weight: 100 900; }
@font-face { font-family: "Notch Mono"; src: url("assets/fonts/CascadiaMono.ttf"); }
#root { position: absolute; inset: 0; overflow: hidden; }
${style}
</style>
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
  <div class="bg clip" id="f${id}-bg" data-start="0" data-duration="${dur}" data-track-index="0"></div>
  <div class="clip" id="f${id}-content" data-start="0" data-duration="${dur}" data-track-index="1" style="position:absolute;inset:0">
${html}
  </div>
</div>
<script>
(function () {
  const R = document.querySelector('[data-composition-id="${id}"]')
  const $ = s => R.querySelector(s), $$ = s => Array.from(R.querySelectorAll(s))
  const tl = gsap.timeline({ paused: true })
${js}
  window.__timelines["${id}"] = tl
})()
</script>
</template>
`
}
const write = (id, dur, css, html, js) => fs.writeFileSync(path.join(OUT, id + '.html'), frame(id, dur, css, html, js))

// Deterministic jitter: a fixed table, no Math.random.
const JIT = [[9, -6], [-12, 4], [7, 11], [-5, -13], [13, 2], [-8, 9], [4, -10], [-14, -3], [11, 7], [-6, 12], [8, -9], [-11, 5], [5, 13], [-13, -7], [12, -4], [-4, 10], [10, 6], [-9, -11]]
const shake = (target, t0, n, amp, step) => JIT.slice(0, n).map(([x, y], i) =>
  `  tl.to(${target}, { x: ${Math.round(x * amp)}, y: ${Math.round(y * amp)}, duration: ${step}, ease: "none" }, ${(t0 + i * step).toFixed(3)})`).join('\n') +
  `\n  tl.to(${target}, { x: 0, y: 0, duration: ${step}, ease: "none" }, ${(t0 + n * step).toFixed(3)})`

// ================= 01 · Tab chaos (5s) =================
{
  const WORDS = [['claude.', 0], ['agy.', .8], ['opencode.', 1.4], ['kilo.', 2], ['copilot.', 2.6], ['claude <span class="o">again.</span>', 3.2]]
  const T = [.05, .8, 1.4, 2, 2.6, 3.2, 3.42, 3.6, 3.78, 3.94, 4.08, 4.22]
  write('01-tab-chaos', 5, `
$ .word { position: absolute; left: 0; right: 0; top: 330px; text-align: center; font-size: 210px; text-shadow: 0 10px 80px rgba(0,0,0,.95), 0 0 24px rgba(0,0,0,.8); }
`, `    <div class="cam" data-layout-allow-overlap><div class="cam2">
      <div class="wall"></div>
${PILE.map((p, i) => '      ' + term('f01-t' + i, p[0], p[1], p[2], p[3], p[5])).join('\n')}
${WORDS.map((w, i) => `      <div class="h word" id="f01-w${i}">${w[0]}</div>`).join('\n')}
    </div></div>`, `
  const T = ${JSON.stringify(T)}, ROT = ${JSON.stringify(PILE.map(p => p[4]))}
  $$('.term').forEach((el, i) => {
    tl.fromTo(el, { opacity: 0, scale: 1.55, rotation: ROT[i] * 2.2 }, { opacity: 1, scale: 1, rotation: ROT[i], duration: .22, ease: "back.out(2.2)" }, T[i])
  })
  const W = ${JSON.stringify(WORDS.map(w => w[1]))}
  $$('.word').forEach((el, i) => {
    if (i) tl.set(el, { opacity: 0 }, 0)
    tl.fromTo(el, { opacity: 1, scale: 1.45 }, { opacity: 1, scale: 1, duration: .2, ease: "power4.out" }, W[i])
    if (i < W.length - 1) tl.set(el, { opacity: 0 }, W[i + 1])
  })
  tl.fromTo($('.cam2'), { scale: 1 }, { scale: 1.07, duration: 5, ease: "none" }, 0)
${shake("$('.cam')", 3.2, 18, 1, .1)}
`)
}

// ================= 02 · Everyone needs you (6s) =================
{
  const P = [
    ['1. Yes  2. No\n<span class="o">esc to cancel</span>', 60, 90, -3, .1],
    ['Allow: npm install\nreact-router@7? <span class="o">(y/n)</span>', 1330, 70, 4, .6],
    ['Do you trust this folder?\n<span class="o">1. Yes, proceed</span>', 1360, 690, -5, 1.5],
    ['Run: rm -rf dist?\n<span class="o">1. Yes  2. No</span>', 80, 720, 5, 1.9],
    ['Allow edit to auth.ts?', 700, 800, -2, 2.3],
    ['Allow: git push --force? <span class="o">(y/n)</span>', 640, 60, 2, 2.7],
    ['1. Yes  2. No\n<span class="o">esc to cancel</span>', 40, 410, -4, 3],
    ['Allow: curl install.sh | sh?', 1400, 430, 3, 3.2],
  ]
  const B = [[560, 170, -6, 1.7], [1180, 580, 8, 2.1], [380, 620, 4, 2.5], [1250, 280, -5, 3.3]]
  const CUR = [[1500, 250], [300, 170], [1560, 760], [260, 800], [900, 860], [960, 130], [200, 470], [1600, 500], [700, 300], [1250, 700], [420, 640]]
  write('02-everyone-needs-you', 6, `
$ .dim { position: absolute; inset: 0; background: rgba(0,0,0,.4); }
$ .ghost { filter: blur(5px); opacity: .55; }
$ .prompt { position: absolute; background: #141414; border: 2px solid #FF9F0A; border-radius: 12px; padding: 18px 24px; font: 23px/1.45 "Notch Mono", monospace; color: #eee; white-space: pre; box-shadow: 0 14px 36px rgba(0,0,0,.6); }
$ .badge { position: absolute; background: #FF9F0A; color: #000; font-weight: 700; font-size: 25px; border-radius: 99px; padding: 7px 20px; box-shadow: 0 8px 24px rgba(255,159,10,.35); }
$ .cursor { position: absolute; left: 0; top: 0; width: 60px; height: 60px; filter: drop-shadow(0 6px 10px rgba(0,0,0,.7)); }
$ .head { z-index: 10; left: 0; right: 0; top: 330px; text-align: center; font-size: 170px; text-shadow: 0 10px 80px #000, 0 0 30px rgba(0,0,0,.9); }
`, `    <div class="cam" data-layout-allow-overlap>
      <div class="wall"></div>
${PILE.slice(0, 4).map((p, i) => '      ' + term('f02-g' + i, p[0], p[1], p[2], p[3], p[5], `transform:rotate(${p[4]}deg)`).replace('class="term"', 'class="term ghost"')).join('\n')}
      <div class="dim"></div>
${P.map((p, i) => `      <div class="prompt" id="f02-p${i}" style="left:${p[1]}px;top:${p[2]}px">${p[0]}</div>`).join('\n')}
${B.map((b, i) => `      <div class="badge" id="f02-b${i}" style="left:${b[0]}px;top:${b[1]}px">needs you</div>`).join('\n')}
      <div class="h head"><div id="f02-l1">which one</div><div id="f02-l2" class="o">needs you?</div></div>
      <svg class="cursor" viewBox="0 0 24 24"><path d="M3 2l17 10-7 2 4 7-3 1.5-4-7-5 4.5z" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>
    </div>`, `
  const P = ${JSON.stringify(P.map(p => [p[1], p[2], p[3], p[4]]))}, B = ${JSON.stringify(B)}
  const pop = (el, r, t) => tl.fromTo(el, { opacity: 0, scale: .4, rotation: r * 3 }, { opacity: 1, scale: 1, rotation: r, duration: .32, ease: "back.out(2.6)" }, t)
  const close = (el, cx, cy) => tl.to(el, { x: (960 - cx) * .3, y: (470 - cy) * .3, duration: 2.5, ease: "power1.in" }, 3.5)
  $$('.prompt').forEach((el, i) => { pop(el, P[i][2], P[i][3]); close(el, P[i][0] + 200, P[i][1] + 40) })
  $$('.badge').forEach((el, i) => { pop(el, B[i][2], B[i][3]); close(el, B[i][0] + 70, B[i][1] + 20) })
  const cur = $('.cursor'), C = ${JSON.stringify(CUR)}
  tl.fromTo(cur, { x: 1700, y: 900, opacity: 0 }, { x: C[0][0], y: C[0][1], opacity: 1, duration: .4, ease: "power2.out" }, 1.1)
  C.slice(1).forEach(([x, y], i) => {
    tl.to(cur, { x, y, duration: .34 - Math.min(i, 8) * .018, ease: "power2.inOut" }, 1.5 + i * .4)
    tl.to(cur, { scale: .8, duration: .06, yoyo: true, repeat: 1 }, 1.84 + i * .4)
  })
  tl.fromTo($('#f02-l1'), { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: .25, ease: "power4.out" }, 3.5)
  tl.fromTo($('#f02-l2'), { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: .25, ease: "power4.out" }, 3.85)
${shake("$('.cam')", 3.5, 12, .45, .2)}
`)
}

// ================= 03 · Still "working" (4s) =================
write('03-still-working', 4, `
$ .blur { position: absolute; inset: 0; filter: blur(10px) brightness(.4); }
$ .big { left: 240px; top: 90px; width: 1440px; height: 600px; border-radius: 20px; border-color: #555; }
$ .big .bar { height: 72px; font-size: 30px; gap: 18px; padding: 0 28px; }
$ .big .bar img { width: 36px; height: 36px; }
$ .big .tx { padding: 44px 52px; font-size: 40px; line-height: 1.7; }
$ .line1 { display: inline-block; }
$ .chip { position: absolute; right: 48px; bottom: 44px; display: flex; align-items: center; gap: 16px; padding: 16px 30px; border-radius: 99px; border: 2px solid #0A84FF; color: #2E95FF; font-size: 34px; font-weight: 600; background: rgba(10,132,255,.08); }
$ .chip .spin { width: 32px; height: 32px; }
$ .timer { font-variant-numeric: tabular-nums; }
$ .cap { position: absolute; left: 0; right: 0; top: 750px; text-align: center; font-size: 66px; font-weight: 600; letter-spacing: -.02em; }
$ .slice { position: absolute; left: 0; right: 0; height: 26px; opacity: 0; mix-blend-mode: screen; }
`, `    <div class="cam"><div class="cam2">
      <div class="blur" data-layout-allow-overlap><div class="wall"></div>${PILE.slice(0, 5).map((p, i) => term('f03-g' + i, p[0], p[1], p[2], p[3], p[5], `transform:rotate(${p[4]}deg)`)).join('')}</div>
      <div class="term big"><div class="bar"><img src="${logo('claude')}" alt="">claude · payments-api</div>
        <div class="tx"><span class="line1" id="f03-l1">✻ Refactoring the API layer…</span>
<span class="r" id="f03-l2">⎿ Usage limit reached · resets 10:16 PM</span></div>
        <div class="chip" id="f03-chip"><span class="spin" id="f03-spin"></span><span>Working… <span class="timer" id="f03-timer">1h 58m</span></span></div>
      </div>
      <div class="cap" id="f03-cap">that one's been <span class="o">"working"</span> for 2 hours.</div>
      <div class="slice" id="f03-s1" style="top:260px;background:rgba(255,0,80,.55)"></div>
      <div class="slice" id="f03-s2" style="top:470px;background:rgba(0,220,255,.5)"></div>
      <div class="slice" id="f03-s3" style="top:640px;background:rgba(255,159,10,.5)"></div>
    </div></div>`, `
  tl.fromTo($('.big'), { opacity: 0, scale: .82 }, { opacity: 1, scale: 1, duration: .35, ease: "power4.out" }, 0)
  tl.fromTo($('#f03-l1'), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .9, ease: "steps(28)" }, .15)
  tl.fromTo($('#f03-chip'), { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: .3, ease: "power3.out" }, .25)
  tl.fromTo($('#f03-spin'), { rotation: 0 }, { rotation: 360 * 7, duration: 4, ease: "none" }, 0)
  tl.fromTo($('#f03-l2'), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: .22, ease: "power3.out" }, 1.2)
  const timer = $('#f03-timer'), clock = { m: 118 }
  tl.fromTo(clock, { m: 118 }, { m: 134, duration: 2.4, ease: "power2.in", onUpdate: () => { const m = Math.round(clock.m); timer.textContent = Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' } }, 1.2)
  tl.fromTo($('#f03-cap'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .45, ease: "power3.out" }, 2.4)
  tl.fromTo($('.cam2'), { scale: 1 }, { scale: 1.05, duration: 4, ease: "none" }, 0)
${shake("$('.cam')", 3.4, 6, 1.6, .1)}
  ;['#f03-s1', '#f03-s2', '#f03-s3'].forEach((s, i) => {
    tl.fromTo($(s), { opacity: 0, x: -40 }, { opacity: 1, x: 40, duration: .08, ease: "none", yoyo: true, repeat: 3 }, 3.45 + i * .12)
  })
  tl.to($('.big'), { skewX: 6, duration: .06, yoyo: true, repeat: 5, ease: "none" }, 3.55)
  tl.to($('.cam2'), { filter: "brightness(1.8) saturate(2)", duration: .05, yoyo: true, repeat: 3, ease: "none" }, 3.72)
`)

// ================= 04 · The notch drops (4s) =================
{
  const pick = [0, 1, 2, 3, 4, 5]
  const order = ['claude', 'agy', 'opencode', 'kilo', 'copilot']
  write('04-notch-drops', 4, `
$ .chaos { position: absolute; inset: 0; }
$ .halo { position: absolute; left: 0; right: 0; margin: 0 auto; top: -120px; width: 900px; height: 420px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(10,132,255,.35), rgba(191,90,242,.18) 55%, transparent); }
$ .pill { gap: 16px; }
$ .glint { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
$ .glint i { position: absolute; top: -20px; bottom: -20px; width: 140px; background: linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent); }
$ .head { left: 0; right: 0; top: 420px; text-align: center; font-size: 170px; }
`, `      <div class="chaos" id="f04-chaos" data-layout-allow-overlap><div class="wall" id="f04-wall"></div>
${pick.map(i => '        ' + term('f04-t' + i, PILE[i][0], PILE[i][1], PILE[i][2], PILE[i][3], PILE[i][5])).join('\n')}
      </div>
      <div class="halo" id="f04-halo"></div>
      <div class="pill" id="f04-pill"><div class="rim" id="f04-rim"></div>${dots(order)}<span id="f04-label">5 working</span><div class="glint"><i id="f04-glint"></i></div></div>
      <div class="h head"><span id="f04-a">meet </span><span class="b" id="f04-b">agent notch.</span></div>`, `
  const ROT = ${JSON.stringify(pick.map(i => PILE[i][4]))}, POS = ${JSON.stringify(pick.map(i => [PILE[i][2] + 250, PILE[i][3] + 150]))}
  const COL = ${JSON.stringify(pick.map(i => DOT[PILE[i][0]]))}
  const terms = $$('.term')
  terms.forEach((el, i) => tl.set(el, { rotation: ROT[i] }, 0))
  tl.fromTo($('#f04-chaos'), { filter: "grayscale(0.3) brightness(0.8)" }, { filter: "grayscale(1) brightness(0.45)", duration: .7, ease: "power2.out" }, 0)
  tl.fromTo($('#f04-pill'), { y: -170, scale: .8 }, { y: 0, scale: 1.6, duration: 1.1, ease: "elastic.out(1, 0.62)" }, .7)
  tl.fromTo($('#f04-halo'), { opacity: 0 }, { opacity: 1, duration: 1, ease: "power2.out" }, 1.1)
  tl.fromTo($('#f04-rim'), { opacity: 0 }, { opacity: 1, duration: .6, ease: "power2.out" }, 1.15)
  tl.fromTo($('#f04-rim'), { "--spin": "0deg" }, { "--spin": "620deg", duration: 2.9, ease: "power1.inOut" }, 1.1)
  tl.fromTo($('#f04-glint'), { x: -200 }, { x: 560, duration: .75, ease: "power2.inOut" }, 1.3)
  const dotsEls = $$('.dots i')
  dotsEls.forEach(d => tl.set(d, { scale: 0 }, 0))
  tl.set($('#f04-label'), { opacity: 0 }, 0)
  terms.forEach((el, i) => {
    const t = 1.8 + i * .12
    tl.to(el, { x: 960 - POS[i][0], y: 72 - POS[i][1], scale: .03, rotation: 0, opacity: 0, boxShadow: '0 0 90px 40px ' + COL[i], duration: .55, ease: "power3.in" }, t)
  })
  tl.to($('#f04-wall'), { opacity: 0, duration: .8, ease: "power2.in" }, 1.85)
  dotsEls.forEach((d, i) => tl.fromTo(d, { scale: 0 }, { scale: 1, duration: .35, ease: "back.out(3)" }, 2.3 + i * .09))
  tl.fromTo($('#f04-label'), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .3, ease: "power2.out" }, 2.55)
  tl.to($('#f04-pill'), { scale: 1.7, duration: .12, yoyo: true, repeat: 1, ease: "power2.out" }, 2.72)
  tl.fromTo($('#f04-a'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .7, ease: "power3.out" }, 2.85)
  tl.fromTo($('#f04-b'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .7, ease: "power3.out" }, 3.02)
`)
}

// ================= shared: the rebuilt notch panel (native app sizes, scaled up) =================
const IND = {
  working: '<span class="ind w"></span>',
  waiting: '<span class="ind q"></span>',
  done: '<svg class="ind d" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6"/></svg>',
}
const STATUS = { working: 'Working', waiting: 'Needs you', done: 'Done' }
const row = (id, a, st, task, action, opts = {}) => `<div class="row ${st}" id="${id}">
  <div class="tile ${a}" style="width:32px;height:32px;border-radius:9px">${opts.unread ? '<span class="unread"></span>' : ''}<img src="${logo(a)}" alt=""></div>
  <div class="body"><div class="name">${NAME[a]}${opts.tag ? `<span class="tag">${opts.tag}</span>` : ''}</div><div class="task">${task}</div><div class="action">${action}</div>${opts.progress ? `<div class="progress"><div class="track"><i id="${id}-bar"></i></div><span>3 of 7</span></div>` : ''}</div>
  <div class="side"><div class="status ${st}">${IND[st]}${STATUS[st]}</div><div class="auto">${a === 'copilot' ? '' : `<span class="sw${opts.auto ? ' on' : ''}">AUTO<span class="knob"></span></span>`}<span class="timer">${opts.time}</span></div></div>
</div>`
const PANEL_CSS = `
$ .panel { position: absolute; width: 460px; padding: 18px 16px 14px; background: #000; border-radius: 34px; box-shadow: 0 0 0 1px rgba(255,255,255,.09) inset, 0 30px 80px rgba(0,0,0,.6); font-size: 13px; line-height: 1.35; }
$ .phead { display: flex; align-items: center; gap: 10px; padding: 0 6px 2px; }
$ .phead h1 { font-size: 17px; font-weight: 600; letter-spacing: -.02em; margin: 0; }
$ .phead .summary { flex: 1; text-align: right; color: rgba(235,235,245,.6); font-size: 12px; }
$ .round { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,.1); display: grid; place-items: center; font-size: 15px; font-weight: 700; }
$ .group { margin-top: 14px; }
$ .gtitle { display: flex; justify-content: space-between; padding: 0 8px 6px; font-size: 12px; font-weight: 600; color: rgba(235,235,245,.6); }
$ .gtitle span:last-child { color: rgba(235,235,245,.55); font-weight: 500; }
$ .gcard { background: #1c1c1e; border-radius: 14px; overflow: hidden; }
$ .row { position: relative; display: flex; gap: 12px; padding: 11px 12px; }
$ .row + .row::before { content: ""; position: absolute; top: 0; left: 56px; right: 0; height: 1px; background: rgba(84,84,88,.45); }
$ .row.waiting { background: rgba(255,159,10,.08); }
$ .row.error { background: rgba(255,69,58,.1); }
$ .row .tile { position: relative; }
$ .unread { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; border-radius: 50%; background: #0A84FF; box-shadow: 0 0 0 2.5px #1c1c1e; }
$ .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
$ .name { font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
$ .tag { margin-left: 7px; padding: 1px 6px; border-radius: 5px; background: rgba(255,255,255,.1); color: rgba(235,235,245,.6); font-size: 10.5px; font-weight: 600; }
$ .task { color: rgba(255,255,255,.86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
$ .action { color: rgba(235,235,245,.6); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
$ .row.error .action { color: #FF8A80; }
$ .progress { display: flex; align-items: center; gap: 8px; margin-top: 5px; color: rgba(235,235,245,.6); font-size: 11.5px; }
$ .track { flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,.1); overflow: hidden; }
$ .track i { display: block; height: 100%; width: 43%; border-radius: 2px; background: #0A84FF; }
$ .side { flex: none; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 8px; }
$ .status { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
$ .status.working { color: #0A84FF; } $ .status.waiting { color: #FF9F0A; } $ .status.done { color: #30D158; } $ .status.error { color: #FF6961; }
$ .ind { display: inline-block; border-radius: 50%; flex: none; }
$ .ind.w { width: 11px; height: 11px; border: 1.8px solid rgba(10,132,255,.25); border-top-color: #0A84FF; }
$ .ind.q { width: 7px; height: 7px; background: #FF9F0A; }
$ .ind.e { width: 7px; height: 7px; background: #FF453A; box-shadow: 0 0 0 3px rgba(255,69,58,.22); }
$ .ind.d { width: 11px; height: 11px; border-radius: 0; fill: none; stroke: #30D158; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
$ .auto { display: flex; align-items: center; gap: 10px; }
$ .sw { display: flex; align-items: center; gap: 6px; color: rgba(235,235,245,.55); font-size: 11px; font-weight: 600; }
$ .sw .knob { position: relative; width: 34px; height: 20px; border-radius: 10px; background: rgba(120,120,128,.36); }
$ .sw .knob::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 8px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.3); }
$ .sw.on { color: #30D158; } $ .sw.on .knob { background: #30D158; } $ .sw.on .knob::after { left: 16px; }
$ .timer { color: rgba(235,235,245,.55); font-size: 11.5px; min-width: 24px; text-align: right; }
$ .row.waiting .timer { color: #FF9F0A; font-weight: 600; }
`

// ================= 05 · One glance (5s) =================
{
  const S = 1.42, W = 460 * S, LEFT = 1110
  write('05-one-glance', 5, PANEL_CSS + `
$ .pw { position: absolute; left: ${LEFT}px; top: 34px; width: ${W}px; transform-origin: 50% 0; }
$ .sc { transform: scale(${S}); transform-origin: 0 0; }
$ .sc .panel { position: relative; }
$ .head { left: 130px; top: 250px; font-size: 128px; }
`, `      <div class="pill" id="f05-pill"><div class="rim" style="--spin:260deg"></div>${dots(['claude', 'agy', 'opencode', 'kilo', 'copilot'])}<span>5 working</span></div>
      <div class="pw" id="f05-pw"><div class="sc"><div class="panel">
        <div class="phead" id="f05-hd"><h1>Agents</h1><span class="summary" id="f05-sum">1 need you · 3 working · 1 done</span><span class="round">i</span><span class="round">+</span><span class="round">▦</span></div>
        <div class="group" id="f05-g0"><div class="gtitle"><span>web-app</span><span>2 agents</span></div><div class="gcard">
          ${row('f05-r0', 'opencode', 'waiting', 'Migrate to the new router', 'Allow: npm install react-router@7', { time: '19s', unread: true })}
          ${row('f05-r1', 'kilo', 'done', 'Add dark mode', 'Finished', { time: '1m' })}
        </div></div>
        <div class="group" id="f05-g1"><div class="gtitle"><span>payments-api</span><span>2 agents</span></div><div class="gcard">
          ${row('f05-r2', 'claude', 'working', 'Add rate limiting to the auth routes', 'Edit auth.ts', { time: '4m', progress: true })}
          ${row('f05-r3', 'agy', 'working', 'Write the webhook tests', 'Run tests', { time: '54s', auto: true })}
        </div></div>
        <div class="group" id="f05-g2"><div class="gtitle"><span>docs</span><span>1 agent</span></div><div class="gcard">
          ${row('f05-r4', 'copilot', 'working', 'Rewrite the quickstart', 'EditFiles quickstart.md', { time: '37s', tag: 'VS Code' })}
        </div></div>
      </div></div></div>
      <div class="h head"><div id="f05-l0">every agent.</div><div id="f05-l1">every project.</div><div id="f05-l2" class="b">one glance.</div></div>`, `
  tl.fromTo($('#f05-pill'), { opacity: 1, scale: 1.6 }, { opacity: 0, scale: 1.9, filter: "blur(8px)", duration: .35, ease: "power2.in" }, .55)
  tl.fromTo($('#f05-pw'), { x: ${Math.round((1920 - W) / 2 - LEFT)}, scaleX: .24, scaleY: .08, opacity: 0 }, { scaleX: 1, scaleY: 1, opacity: 1, duration: .75, ease: "back.out(1.05)" }, .6)
  tl.to($('#f05-pw'), { x: 0, duration: .7, ease: "power3.inOut" }, 1.25)
  const parts = ['#f05-hd', '#f05-g0', '#f05-r0', '#f05-r1', '#f05-g1', '#f05-r2', '#f05-r3', '#f05-g2', '#f05-r4']
  parts.forEach((s, i) => tl.fromTo($(s), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, ease: "power3.out" }, .9 + i * .24))
  tl.fromTo($('#f05-r2-bar'), { width: "0%" }, { width: "43%", duration: .8, ease: "power2.out" }, 1.9)
  $$('.ind.w').forEach(el => tl.fromTo(el, { rotation: 0 }, { rotation: 360 * 5, duration: 5, ease: "none" }, 0))
  tl.fromTo($('.ind.q'), { boxShadow: "0 0 0 0 rgba(255,159,10,.6)" }, { boxShadow: "0 0 0 6px rgba(255,159,10,0)", duration: 1.2, repeat: 3, ease: "power1.out" }, .6)
  ;['#f05-l0', '#f05-l1', '#f05-l2'].forEach((s, i) => tl.fromTo($(s), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 3.2 + i * .4))
`)
}

// ================= 06 · Needs you? One key. (5s) =================
write('06-one-key', 5, `
$ .pill.warn { box-shadow: 0 0 0 1.5px rgba(255,159,10,.55) inset, 0 16px 70px rgba(255,159,10,.3), 0 4px 12px rgba(0,0,0,.4); }
$ .lbl { position: relative; display: flex; align-items: center; gap: 14px; }
$ .lbl .sub { color: rgba(235,235,245,.6); font-weight: 500; font-size: 25px; }
$ .lbl2 { position: absolute; left: 0; top: 0; bottom: 0; display: flex; align-items: center; }
$ .peek { position: absolute; left: 0; right: 0; margin: 0 auto; top: 140px; width: 860px; padding: 26px 30px; background: #000; border-radius: 40px; display: flex; gap: 24px;
          box-shadow: 0 0 0 1.5px rgba(255,159,10,.4) inset, 0 30px 80px rgba(0,0,0,.6); transform-origin: 50% 0; }
$ .pbody { flex: 1; display: flex; flex-direction: column; gap: 6px; position: relative; }
$ .ptitle { font-size: 31px; font-weight: 600; color: #FF9F0A; }
$ .pcmd { font: 25px "Notch Mono", monospace; color: rgba(235,235,245,.75); }
$ .acts { display: flex; gap: 16px; margin-top: 14px; }
$ .acts span { height: 56px; padding: 0 28px; border-radius: 28px; display: flex; align-items: center; gap: 10px; font-size: 25px; font-weight: 600; }
$ .acts kbd { font: 600 19px "Notch Mono", monospace; opacity: .6; }
$ .deny { background: rgba(255,255,255,.12); } $ .allow { background: #0A84FF; box-shadow: 0 8px 28px rgba(10,132,255,.4); }
$ .done { position: absolute; left: 0; top: 0; display: flex; flex-direction: column; gap: 6px; }
$ .done .ptitle { color: #0A84FF; display: flex; align-items: center; gap: 12px; }
$ .done .spin { width: 24px; height: 24px; }
$ .ring { position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 4px solid #0A84FF; }
$ .head { left: 150px; top: 520px; font-size: 140px; }
$ .cap { position: absolute; left: 154px; top: 820px; font: 30px "Notch Mono", monospace; color: rgba(235,235,245,.6); }
$ .cap b { color: #fff; }
$ .keyY { left: 1250px; top: 520px; width: 210px; height: 210px; border-radius: 40px; font-size: 110px; }
`, `      <div class="pill warn" id="f06-pill"><div class="lbl" id="f06-warn">${dots(['opencode', 'claude', 'agy', 'kilo'])}<span class="o">OpenCode needs you</span><span class="sub">web-app</span></div><div class="lbl2" id="f06-ok" style="left:26px">${dots(['opencode', 'claude', 'agy', 'kilo'])}<span style="margin-left:18px">5 working</span></div></div>
      <div class="peek" id="f06-peek">${tile('opencode', 76)}
        <div class="pbody">
          <div id="f06-ask"><div class="ptitle">OpenCode needs you</div><div class="pcmd">Allow: npm install react-router@7</div>
            <div class="acts"><span class="deny">Deny <kbd>N</kbd></span><span class="allow" id="f06-allow">Allow <kbd>Y</kbd></span></div></div>
          <div class="done" id="f06-done"><div class="ptitle"><span class="spin" id="f06-spin"></span>Working</div><div class="pcmd">Edit router.tsx</div></div>
        </div>
      </div>
      <div class="ring" id="f06-ring" style="left:820px;top:222px"></div>
      <div class="h head"><div id="f06-l0">needs you?</div><div id="f06-l1" class="b">one key.</div></div>
      <div class="key keyY" id="f06-key">Y</div>
      <div class="cap" id="f06-cap"><b>Y</b> allow · <b>N</b> deny · <b>Ctrl+Alt+J</b> jumps to it</div>`, `
  tl.fromTo($('#f06-pill'), { scale: .9 }, { scale: 1, duration: .5, ease: "back.out(2)" }, 0)
  tl.fromTo($('#f06-pill'), { boxShadow: "0 0 0 1.5px rgba(255,159,10,.3) inset, 0 12px 40px rgba(255,159,10,.12), 0 4px 12px rgba(0,0,0,.4)" },
    { boxShadow: "0 0 0 1.5px rgba(255,159,10,.7) inset, 0 16px 80px rgba(255,159,10,.42), 0 4px 12px rgba(0,0,0,.4)", duration: .8, yoyo: true, repeat: 2, ease: "sine.inOut" }, 0)
  tl.set($('#f06-ok'), { opacity: 0 }, 0)
  tl.fromTo($('#f06-peek'), { opacity: 0, y: -60, scaleY: .5 }, { opacity: 1, y: 0, scaleY: 1, duration: .65, ease: "back.out(1.3)" }, .3)
  tl.set($('#f06-done'), { opacity: 0 }, 0)
  tl.fromTo($('#f06-l0'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 1.2)
  tl.fromTo($('#f06-key'), { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: .6, ease: "back.out(1.6)" }, 1.4)
  // the press
  tl.to($('#f06-key'), { y: 12, boxShadow: "0 2px 0 #0a0a0a, 0 10px 24px rgba(0,0,0,.55)", background: "linear-gradient(#3a3a3c, #2c2c2e)", duration: .08, ease: "power2.in" }, 2.4)
  tl.to($('#f06-key'), { y: 0, boxShadow: "0 10px 0 #0a0a0a, 0 24px 48px rgba(0,0,0,.55)", background: "linear-gradient(#2c2c2e, #1c1c1e)", duration: .5, ease: "elastic.out(1, 0.5)" }, 2.5)
  tl.fromTo($('#f06-allow'), { scale: 1 }, { scale: .9, duration: .08, yoyo: true, repeat: 1, ease: "power2.out" }, 2.45)
  tl.set($('#f06-ring'), { opacity: 0 }, 0)
  tl.fromTo($('#f06-ring'), { opacity: .9, scale: .2 }, { opacity: 0, scale: 2.2, duration: .6, ease: "power2.out", immediateRender: false }, 2.45)
  tl.to($('#f06-ask'), { opacity: 0, y: -10, duration: .25, ease: "power2.in" }, 2.6)
  tl.fromTo($('#f06-done'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .4, ease: "power3.out" }, 2.8)
  tl.to($('#f06-peek'), { boxShadow: "0 0 0 1.5px rgba(10,132,255,.35) inset, 0 30px 80px rgba(0,0,0,.6)", duration: .5 }, 2.7)
  tl.to($('#f06-warn'), { opacity: 0, duration: .25 }, 2.7)
  tl.to($('#f06-ok'), { opacity: 1, duration: .35 }, 2.85)
  tl.to($('#f06-pill'), { boxShadow: "0 0 0 1px rgba(255,255,255,.1) inset, 0 24px 64px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.4)", duration: .6 }, 2.7)
  tl.fromTo($('#f06-spin'), { rotation: 0 }, { rotation: 720, duration: 2.2, ease: "none" }, 2.8)
  tl.fromTo($('#f06-l1'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 2.75)
  tl.fromTo($('#f06-cap'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5, ease: "power2.out" }, 3.6)
`)

// ================= 06b · Phone approve (5s) =================
write('06b-phone-approve', 5, `
$ .pill { width: 330px; padding: 0; justify-content: center; overflow: hidden; }
$ .pill .lbl { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; gap: 18px; }
$ .pill .lbl2 { position: absolute; left: 0; right: 0; justify-content: center; top: 0; bottom: 0; display: flex; align-items: center; gap: 18px; }
$ .head { left: 150px; top: 330px; font-size: 112px; }
$ .cap { position: absolute; left: 154px; top: 790px; font: 30px "Notch Mono", monospace; color: rgba(235,235,245,.6); }
$ .phone { position: absolute; left: 1210px; top: 150px; width: 430px; height: 790px; border-radius: 64px; background: #050505; border: 3px solid #3a3a3c; padding: 16px;
           box-shadow: 0 0 0 10px #151517, 0 50px 120px rgba(0,0,0,.7); transform-origin: 50% 100%; }
$ .scr { position: relative; width: 100%; height: 100%; border-radius: 48px; background: #000; overflow: hidden; padding: 58px 22px 0; }
$ .scr .notchbar { position: absolute; top: 14px; left: 50%; margin-left: -62px; width: 124px; height: 32px; border-radius: 16px; background: #0b0b0c; }
$ .ph-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
$ .ph-h b { font-size: 34px; font-weight: 700; letter-spacing: -.02em; }
$ .ph-h span { font-size: 18px; color: rgba(235,235,245,.6); display: flex; align-items: center; gap: 8px; }
$ .ph-h i { width: 11px; height: 11px; border-radius: 50%; background: #30D158; }
$ .ph-ask { position: absolute; left: 22px; right: 22px; top: 106px; padding: 22px; border-radius: 26px; background: #1c1c1e; border: 2px solid rgba(255,159,10,.6); box-shadow: 0 0 40px rgba(255,159,10,.22); transform-origin: 50% 0; }
$ .ph-who { display: flex; align-items: center; gap: 14px; font-size: 24px; font-weight: 600; }
$ .ph-who em { font-style: normal; color: rgba(235,235,245,.6); font-weight: 500; font-size: 18px; margin-left: auto; }
$ .ph-what { margin-top: 14px; font-size: 22px; font-weight: 600; color: #FF9F0A; }
$ .ph-code { margin-top: 10px; padding: 14px 16px; border-radius: 14px; background: #000; font: 19px/1.4 "Notch Mono", monospace; color: rgba(255,255,255,.85); }
$ .ph-btns { display: grid; grid-template-columns: 1fr 1.6fr; gap: 14px; margin-top: 20px; }
$ .ph-btns span { height: 76px; border-radius: 22px; display: grid; place-items: center; font-size: 28px; font-weight: 700; }
$ .ph-deny { background: rgba(255,255,255,.14); } $ .ph-allow { background: #0A84FF; box-shadow: 0 8px 26px rgba(10,132,255,.45); }
$ .ph-ok { position: absolute; left: 22px; right: 22px; top: 106px; padding: 26px 22px; border-radius: 26px; background: #1c1c1e; display: flex; align-items: center; gap: 18px; font-size: 26px; font-weight: 600; }
$ .ph-ok svg { width: 48px; height: 48px; flex: none; fill: none; stroke: #30D158; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
$ .ph-ok small { display: block; font-size: 18px; font-weight: 500; color: rgba(235,235,245,.6); margin-top: 2px; }
$ .ph-list { position: absolute; left: 22px; right: 22px; bottom: 34px; border-radius: 22px; background: #1c1c1e; overflow: hidden; }
$ .ph-row { display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
$ .ph-row + .ph-row { border-top: 1px solid rgba(84,84,88,.45); }
$ .ph-row b { font-size: 21px; } $ .ph-row small { display: block; font-size: 16px; color: rgba(235,235,245,.6); }
$ .ph-row .stw { margin-left: auto; display: grid; justify-items: end; }
$ .ph-row .st { grid-area: 1 / 1; font-size: 17px; font-weight: 600; color: #0A84FF; }
$ .finger { position: absolute; left: 0; top: 0; width: 76px; height: 76px; border-radius: 50%; background: rgba(255,255,255,.4); border: 3px solid rgba(255,255,255,.85); }
$ .buzz { position: absolute; top: 400px; width: 14px; height: 150px; border-radius: 8px; border: 5px solid #FF9F0A; border-top: 0; border-bottom: 0; opacity: 0; }
$ .ring { position: absolute; left: 50%; top: 72px; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; border: 4px solid #0A84FF; opacity: 0; }
`, `      <div class="pill" id="fph-pill"><div class="rim" style="--spin:200deg"></div>
        <div class="lbl" id="fph-ok">${dots(['claude', 'agy', 'opencode', 'kilo', 'copilot'])}<span>5 working</span></div>
        <div class="lbl2" id="fph-warn">${dots(['claude', 'agy', 'opencode', 'kilo'])}<span style="color:#FF9F0A">Claude needs you</span><span style="color:rgba(235,235,245,.6);font-weight:500">payments-api</span></div></div>
      <div class="ring" id="fph-ring"></div>
      <div class="h head"><div id="fph-l0">step away.</div><div id="fph-l1" class="b">approve from</div><div id="fph-l2" class="b">your phone.</div></div>
      <div class="cap" id="fph-cap">scan once · same wi-fi · no app</div>
      <div class="buzz" id="fph-b0" style="left:1150px"></div><div class="buzz" id="fph-b1" style="left:1680px"></div>
      <div class="phone" id="fph-phone"><div class="scr">
        <div class="notchbar"></div>
        <div class="ph-h"><b>Notch</b><span><i></i>Live</span></div>
        <div class="ph-ask" id="fph-ask"><div class="ph-who">${tile('claude', 52)}<span>Claude</span><em>payments-api</em></div>
          <div class="ph-what">Allow Bash?</div><div class="ph-code">npm run deploy</div>
          <div class="ph-btns"><span class="ph-deny">Deny</span><span class="ph-allow" id="fph-allow">Allow</span></div></div>
        <div class="ph-ok" id="fph-done"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg><div>Allowed<small>Claude is working again</small></div></div>
        <div class="ph-list"><div class="ph-row">${tile('claude', 44)}<div><b>Claude</b><small>payments-api</small></div><span class="stw"><span class="st" id="fph-st1" style="color:#FF9F0A">Waiting</span><span class="st" id="fph-st2">Working</span></span></div>
          <div class="ph-row">${tile('agy', 44)}<div><b>Antigravity</b><small>payments-api</small></div><span class="stw"><span class="st">Working</span></span></div></div>
        <div class="finger" id="fph-finger"></div>
      </div></div>`, `
  tl.set($('#fph-warn'), { opacity: 0 }, 0)
  tl.fromTo($('#fph-phone'), { y: 900, rotation: 4 }, { y: 0, rotation: 0, duration: .9, ease: "back.out(1.15)" }, .15)
  tl.fromTo($('#fph-l0'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, .3)
  tl.set($('#fph-ask'), { opacity: 0 }, 0)
  tl.set($('#fph-done'), { opacity: 0 }, 0)
  tl.set($('#fph-finger'), { opacity: 0 }, 0)
  // the request arrives: the pill turns orange, the phone buzzes, the card pops
  tl.to($('#fph-ok'), { opacity: 0, duration: .2 }, 1.2)
  tl.to($('#fph-warn'), { opacity: 1, duration: .25 }, 1.3)
  tl.to($('#fph-pill'), { boxShadow: "0 0 0 1.5px rgba(255,159,10,.7) inset, 0 16px 80px rgba(255,159,10,.42), 0 4px 12px rgba(0,0,0,.4)", duration: .4 }, 1.2)
  tl.fromTo($('#fph-pill'), { width: 330 }, { width: 660, duration: .55, ease: "back.out(1.4)" }, 1.2)
  tl.fromTo($('#fph-ask'), { opacity: 0, scale: .9, y: -10 }, { opacity: 1, scale: 1, y: 0, duration: .45, ease: "back.out(1.6)" }, 1.25)
  tl.set($('#fph-st1'), { opacity: 0 }, 0)
  tl.to($('#fph-st2'), { opacity: 0, duration: .15 }, 1.25)
  tl.to($('#fph-st1'), { opacity: 1, duration: .15 }, 1.25)
  tl.to($('#fph-phone'), { x: 9, duration: .05, yoyo: true, repeat: 9, ease: "none" }, 1.25)
  ;['#fph-b0', '#fph-b1'].forEach(s => tl.fromTo($(s), { opacity: .9, scaleY: .5 }, { opacity: 0, scaleY: 1.2, duration: .5, ease: "power2.out", immediateRender: false }, 1.3))
  // the tap
  tl.fromTo($('#fph-finger'), { opacity: 0, x: 210, y: 690, scale: 1.4 }, { opacity: 1, x: 250, y: 484, scale: 1, duration: .6, ease: "power3.out" }, 2.0)
  tl.to($('#fph-finger'), { scale: .8, duration: .09, ease: "power2.in" }, 2.65)
  tl.to($('#fph-allow'), { scale: .94, duration: .09, ease: "power2.in" }, 2.65)
  tl.to($('#fph-finger'), { scale: 1.1, opacity: 0, duration: .3, ease: "power2.out" }, 2.75)
  tl.to($('#fph-allow'), { scale: 1, duration: .3, ease: "back.out(2)" }, 2.75)
  tl.to($('#fph-ask'), { opacity: 0, scale: .96, duration: .22, ease: "power2.in" }, 2.8)
  tl.fromTo($('#fph-done'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, ease: "power3.out" }, 2.95)
  tl.to($('#fph-st1'), { opacity: 0, duration: .2 }, 2.95)
  tl.to($('#fph-st2'), { opacity: 1, duration: .3 }, 3.0)
  // back on the PC, it carries on
  tl.to($('#fph-warn'), { opacity: 0, duration: .25 }, 2.95)
  tl.to($('#fph-ok'), { opacity: 1, duration: .3 }, 3.05)
  tl.to($('#fph-pill'), { boxShadow: "0 0 0 1px rgba(255,255,255,.1) inset, 0 24px 64px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.4)", width: 330, duration: .6, ease: "power3.inOut" }, 2.95)
  tl.fromTo($('#fph-ring'), { opacity: .9, scale: .3 }, { opacity: 0, scale: 3, duration: .7, ease: "power2.out", immediateRender: false }, 2.95)
  ;['#fph-l1', '#fph-l2'].forEach((s, i) => tl.fromTo($(s), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 3.0 + i * .2))
  tl.fromTo($('#fph-cap'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5, ease: "power2.out" }, 3.8)
`)

// ================= 07 · Auto-Enter (4s) =================
{
  const L = [
    ['Run: npm test', .2], ['<span class="o">1. Yes</span>  2. No   esc to cancel', .9], ['<span class="g">↵ pressed by notch</span>', 1.12],
    ['Run: git add -A', 1.4], ['<span class="o">1. Yes</span>  2. No   esc to cancel', 1.6], ['<span class="g">↵ pressed by notch</span>', 1.82],
    ['Edit: webhook.test.ts', 2.05], ['<span class="o">1. Yes</span>  2. No   esc to cancel', 2.25], ['<span class="g">↵ pressed by notch</span>', 2.47],
  ]
  write('07-auto-enter', 4, `
$ .aterm { left: 110px; top: 150px; width: 860px; height: 600px; border-radius: 18px; }
$ .aterm .bar { height: 64px; font-size: 27px; gap: 16px; padding: 0 24px; }
$ .aterm .bar img { width: 32px; height: 32px; }
$ .aterm .tx { padding: 26px 34px; font-size: 30px; line-height: 1.55; }
$ .aterm .tx div { display: block; }
$ .arow { left: 1040px; top: 150px; width: 780px; padding: 26px 30px; display: flex; align-items: center; gap: 22px; }
$ .arow .nm { flex: 1; display: flex; flex-direction: column; gap: 4px; }
$ .arow b { font-size: 36px; font-weight: 600; }
$ .arow .sub { font-size: 26px; color: rgba(235,235,245,.6); }
$ .autol { font-size: 24px; font-weight: 700; letter-spacing: .03em; color: rgba(235,235,245,.55); }
$ .knob { position: relative; width: 76px; height: 44px; border-radius: 22px; background: rgba(120,120,128,.36); }
$ .knob i { position: absolute; top: 4px; left: 4px; width: 36px; height: 36px; border-radius: 18px; background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
$ .cnt { position: absolute; left: 1044px; top: 330px; font: 28px "Notch Mono", monospace; color: rgba(235,235,245,.6); display: flex; align-items: baseline; gap: 22px; }
$ .cnt b { font: 700 96px "Notch Sans", sans-serif; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -.03em; }
$ .zap { position: absolute; left: 0; top: 0; width: 46px; height: 46px; border-radius: 50%; background: #0A84FF; color: #fff; display: grid; place-items: center; font-size: 28px; font-weight: 700; box-shadow: 0 0 30px rgba(10,132,255,.8); }
$ .head { left: 1040px; top: 500px; font-size: 130px; }
`, `      <div class="term aterm"><div class="bar"><img src="${logo('agy')}" alt="">agy · payments-api</div><div class="tx">${L.map((l, i) => `<div id="f07-x${i}">${l[0]}</div>`).join('')}</div></div>
      <div class="card arow" id="f07-row">${tile('agy', 76)}<div class="nm"><b>Antigravity</b><span class="sub">Write the webhook tests</span></div><span class="autol" id="f07-al">AUTO</span><div class="knob" id="f07-kb"><i id="f07-kn"></i></div></div>
      <div class="cnt" id="f07-cnt">Enters pressed for you <b id="f07-n">0</b></div>
      ${[0, 1, 2].map(i => `<div class="zap" id="f07-z${i}">↵</div>`).join('')}
      <div class="h head"><div id="f07-l0">auto-enter.</div><div id="f07-l1" class="b">finally.</div></div>`, `
  const L = ${JSON.stringify(L.map(l => l[1]))}
  tl.fromTo($('.aterm'), { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: .5, ease: "power3.out" }, 0)
  tl.fromTo($('#f07-row'), { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: .5, ease: "power3.out" }, .05)
  L.forEach((t, i) => tl.fromTo($('#f07-x' + i), { opacity: 0 }, { opacity: 1, duration: .08, ease: "none" }, t))
  tl.to($('#f07-kn'), { x: 32, duration: .4, ease: "back.out(2)" }, .6)
  tl.to($('#f07-kb'), { backgroundColor: "#30D158", duration: .25 }, .6)
  tl.to($('#f07-al'), { color: "#30D158", duration: .25 }, .6)
  tl.fromTo($('#f07-cnt'), { opacity: 0 }, { opacity: 1, duration: .3 }, .8)
  ;[0, 1, 2].forEach(i => {
    const z = $('#f07-z' + i), t = [0.9, 1.6, 2.25][i], ly = 150 + 64 + 26 + (1 + i * 3) * 46.5
    tl.fromTo(z, { x: 1700, y: 200, opacity: 0, scale: .6 }, { x: 560, y: ly - 4, opacity: 1, scale: 1, duration: .2, ease: "power2.in" }, t)
    tl.to(z, { opacity: 0, scale: 2, duration: .18, ease: "power2.out" }, t + .2)
  })
  const n = $('#f07-n'), c = { v: 0 }
  tl.fromTo(c, { v: 0 }, { v: 147, duration: 2, ease: "power2.in", onUpdate: () => { n.textContent = Math.round(c.v) } }, .9)
  tl.fromTo($('#f07-l0'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 2.8)
  tl.fromTo($('#f07-l1'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 3.0)
`)
}

// ================= 08 · One-click grid (4s) =================
{
  const WN = [0, 1, 2, 3, 4, 5] // same windows as the frame 1 pile
  const GW = 520, GH = 290, GX = 140, GY = 150, GAP = 40
  const grid = WN.map((_, i) => [GX + (i % 3) * (GW + GAP), GY + Math.floor(i / 3) * (GH + GAP)])
  write('08-grid', 4, `
$ .gterm { width: ${GW}px; height: ${GH}px; }
$ .gicon { display: grid; grid-template-columns: repeat(2, 11px); gap: 4px; margin-left: 6px; }
$ .gicon i { display: block; width: 11px; height: 11px; border-radius: 3px; background: #fff; }
$ .head { left: 144px; top: 800px; font-size: 84px; }
$ .keyG { right: 150px; top: 790px; height: 86px; padding: 0 34px; border-radius: 20px; font-size: 34px; }
`, `      <div class="pill" id="f08-pill"><div class="rim" style="--spin:120deg"></div>${dots(['claude', 'agy', 'opencode', 'kilo'])}<span>4 working</span><span class="gicon" id="f08-gi"><i></i><i></i><i></i><i></i></span></div>
${WN.map((w, i) => '      ' + term('f08-t' + i, PILE[w][0], PILE[w][1], grid[i][0], grid[i][1], PILE[w][5]).replace('class="term"', 'class="term gterm"')).join('\n')}
      <div class="h head"><span id="f08-a">one click. </span><span id="f08-b" class="b">every window.</span></div>
      <div class="key keyG" id="f08-key">Ctrl+Alt+G</div>`, `
  const FROM = ${JSON.stringify(WN.map((w, i) => [PILE[w][2] - grid[i][0], PILE[w][3] - grid[i][1], PILE[w][4]]))}
  $$('.gterm').forEach((el, i) => {
    tl.fromTo(el, { x: FROM[i][0], y: FROM[i][1], rotation: FROM[i][2], opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: .35, ease: "power2.out" }, .05 * i)
    tl.to(el, { x: 0, y: 0, rotation: 0, duration: .95, ease: "back.out(1.15)" }, 1.25 + i * .08)
  })
  tl.fromTo($('#f08-key'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .4, ease: "power3.out" }, .5)
  tl.to($('#f08-key'), { y: 10, boxShadow: "0 2px 0 #0a0a0a, 0 10px 24px rgba(0,0,0,.55)", duration: .08, ease: "power2.in" }, 1.05)
  tl.to($('#f08-key'), { y: 0, boxShadow: "0 10px 0 #0a0a0a, 0 24px 48px rgba(0,0,0,.55)", duration: .45, ease: "elastic.out(1, 0.5)" }, 1.15)
  tl.fromTo($('#f08-gi'), { scale: 1 }, { scale: 1.5, duration: .14, yoyo: true, repeat: 1, ease: "power2.out" }, 1.08)
  tl.fromTo($('#f08-a'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .5, ease: "power3.out" }, 2.6)
  tl.fromTo($('#f08-b'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .5, ease: "power3.out" }, 2.8)
`)
}

// ================= 09 · Know before the wall (4s) =================
write('09-limits', 4, PANEL_CSS + `
$ .lcard { left: 150px; top: 250px; width: 820px; padding: 34px 38px; display: flex; gap: 34px; align-items: center; }
$ .lim { flex: 1; display: flex; flex-direction: column; gap: 12px; }
$ .lim .top { display: flex; justify-content: space-between; font-size: 30px; color: rgba(235,235,245,.6); }
$ .lim .top b { color: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
$ .lim .tr { height: 14px; border-radius: 7px; background: rgba(255,255,255,.1); overflow: hidden; }
$ .lim .tr i { display: block; height: 100%; border-radius: 7px; background: #0A84FF; width: 0%; }
$ .lim .when { font-size: 24px; color: rgba(235,235,245,.55); }
$ .toast { position: absolute; left: 0; right: 0; margin: 0 auto; top: 36px; width: 900px; height: 116px; border-radius: 58px; background: #000; display: flex; align-items: center; gap: 22px; padding: 0 40px 0 26px;
           box-shadow: 0 0 0 1.5px rgba(255,159,10,.55) inset, 0 16px 70px rgba(255,159,10,.3); transform-origin: 50% 0; }
$ .toast b { display: block; font-size: 31px; font-weight: 600; color: #FF9F0A; }
$ .toast span { font-size: 25px; color: rgba(235,235,245,.6); }
$ .srow { position: absolute; left: 150px; top: 560px; width: 820px; }
$ .srow .sc { transform: scale(1.78); transform-origin: 0 0; width: 460px; }
$ .srow .gcard { border-radius: 16px; }
$ .head { left: 1080px; top: 300px; font-size: 128px; }
`, `      <div class="pill" id="f09-pill"><div class="rim" style="--spin:200deg"></div>${dots(['claude', 'agy', 'opencode', 'kilo'])}<span>4 working</span></div>
      <div class="toast" id="f09-toast">${tile('claude', 64)}<div><b>Claude at 82% of your 5-hour limit</b><span>Resets Wed 11:06 PM</span></div></div>
      <div class="card lcard" id="f09-card">${tile('claude', 64)}
        <div class="lim"><div class="top"><span>5-hour</span><b id="f09-p0">0%</b></div><div class="tr"><i id="f09-b0"></i></div><span class="when">resets 11:06 PM</span></div>
        <div class="lim"><div class="top"><span>Weekly</span><b id="f09-p1">0%</b></div><div class="tr"><i id="f09-b1"></i></div><span class="when">resets Sun</span></div>
      </div>
      <div class="srow" id="f09-row"><div class="sc"><div class="gcard"><div class="row error">
        <div class="tile claude" style="width:32px;height:32px;border-radius:9px"><img src="${logo('claude')}" alt=""></div>
        <div class="body"><div class="name">Claude</div><div class="task">Refactor the API layer</div><div class="action">Usage limit reached · resets 10:16 PM</div></div>
        <div class="side"><div class="status error"><span class="ind e"></span>Stopped</div><span class="timer">40s</span></div>
      </div></div></div></div>
      <div class="h head"><div id="f09-l0">know before</div><div id="f09-l1">you hit</div><div id="f09-l2" class="b">the wall.</div></div>`, `
  tl.fromTo($('#f09-card'), { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: .5, ease: "power3.out" }, 0)
  const p0 = $('#f09-p0'), p1 = $('#f09-p1'), v = { a: 0, b: 0 }
  tl.fromTo(v, { a: 0, b: 0 }, { a: 82, b: 41, duration: 1.5, ease: "power2.out", onUpdate: () => { p0.textContent = Math.round(v.a) + '%'; p1.textContent = Math.round(v.b) + '%' } }, .3)
  tl.fromTo($('#f09-b0'), { width: "0%" }, { width: "82%", duration: 1.5, ease: "power2.out" }, .3)
  tl.fromTo($('#f09-b1'), { width: "0%" }, { width: "41%", duration: 1.5, ease: "power2.out" }, .3)
  tl.to($('#f09-b0'), { backgroundColor: "#FF9F0A", duration: .3 }, .95)
  tl.to($('#f09-pill'), { opacity: 0, scale: .9, duration: .2, ease: "power2.in" }, 1.75)
  tl.fromTo($('#f09-toast'), { opacity: 0, scaleX: .55, scaleY: .6 }, { opacity: 1, scaleX: 1, scaleY: 1, duration: .6, ease: "back.out(1.4)" }, 1.8)
  tl.fromTo($('#f09-row'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .5, ease: "power3.out" }, 2.6)
  ;['#f09-l0', '#f09-l1', '#f09-l2'].forEach((s, i) => tl.fromTo($(s), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, 2.8 + i * .2))
`)

// ================= 10 · One notch (5s, final) =================
write('10-one-notch', 5, `
$ .icon { position: absolute; left: 0; right: 0; margin: 0 auto; top: 190px; width: 230px; height: 230px; }
$ .name { position: absolute; left: 0; right: 0; top: 450px; text-align: center; font-size: 170px; font-weight: 700; font-variation-settings: "opsz" 36; letter-spacing: -.045em; line-height: 1; }
$ .tag { position: absolute; left: 0; right: 0; top: 660px; text-align: center; font-size: 60px; font-weight: 600; letter-spacing: -.02em; }
$ .agents { position: absolute; left: 0; right: 0; top: 790px; display: flex; justify-content: center; align-items: center; gap: 26px; }
$ .agents em { font: 500 24px "Notch Mono", monospace; letter-spacing: .14em; color: rgba(235,235,245,.6); font-style: normal; margin-left: 14px; }
`, `      <div class="pill" id="f10-pill"><div class="rim" style="--spin:300deg"></div>${dots(['claude', 'agy', 'opencode', 'kilo', 'copilot'])}<span>5 working</span></div>
      <img class="icon" id="f10-icon" src="assets/agent-notch-icon.png" alt="Agent Notch">
      <div class="name" id="f10-name">Agent Notch</div>
      <div class="tag" id="f10-tag">All your coding agents. <span class="b">One notch.</span></div>
      <div class="agents">${['claude', 'agy', 'opencode', 'kilo', 'copilot'].map((a, i) => `<span id="f10-a${i}">${tile(a, 64)}</span>`).join('')}<em id="f10-win">FOR WINDOWS</em></div>`, `
  tl.to($('#f10-pill'), { scaleY: 1.3, scaleX: .9, duration: .25, ease: "power2.out" }, .15)
  tl.to($('#f10-pill'), { y: -220, scaleY: 1.6, scaleX: .7, duration: .45, ease: "power3.in" }, .45)
  tl.fromTo($('#f10-icon'), { opacity: 0, scale: .2 }, { opacity: 1, scale: 1, duration: .8, ease: "back.out(1.7)" }, 1.0)
  tl.fromTo($('#f10-name'), { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: .7, ease: "power3.out" }, 1.45)
  tl.fromTo($('#f10-tag'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .6, ease: "power2.out" }, 2.4)
  ;[0, 1, 2, 3, 4].forEach(i => tl.fromTo($('#f10-a' + i), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .4, ease: "back.out(2)" }, 2.7 + i * .06))
  tl.fromTo($('#f10-win'), { opacity: 0 }, { opacity: 1, duration: .4 }, 3.0)
`)

console.log('frames written:', fs.readdirSync(OUT).join(', '))
