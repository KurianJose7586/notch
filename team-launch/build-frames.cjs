// Generates compositions/frames/NN-*.html for the Team messages launch video, from the notch's own parts (agent tiles,
// who-badges, bubbles, the flying message dot, the pill) on one 128 BPM grid: a beat is B, a bar 4B, every frame two bars.
// Run: node build-frames.cjs   (then node build-audio.cjs, then the workflow's assemble-index script)
const fs = require('fs')
const path = require('path')
const OUT = path.join(__dirname, 'compositions', 'frames')
fs.mkdirSync(OUT, { recursive: true })

const B = 0.46875
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// From ../index.html: the team glyph, the back chevron
const TEAM_SVG = '<svg viewBox="0 0 24 24" fill="#F3E8FF"><circle cx="9" cy="8" r="3.3"/><path d="M2.6 19c.4-3.6 3.1-5.8 6.4-5.8s6 2.2 6.4 5.8c.1.6-.4 1-1 1H3.6c-.6 0-1.1-.4-1-1z"/><circle cx="16.8" cy="9.2" r="2.6" opacity=".6"/><path d="M15.9 13.6c3-.3 5.3 1.5 5.6 4.5 0 .5-.3.9-.8.9h-3.5c-.1-2-.6-3.8-1.3-5.4z" opacity=".6"/></svg>'
const BACK_SVG = '<svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const BRANCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#E3C2FF" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2v9.6M18 9.2c0 4.5-7 3.6-11 7.8"/></svg>'
const DOT = { claude: '#D97757', agy: '#3DBE6A', opencode: '#EDE8E6', kilo: '#F8F675', copilot: '#8B5CF6' }
const RING = ['claude', 'copilot', 'opencode', 'kilo', 'agy']
const LABEL = { claude: 'Claude Code', copilot: 'Copilot', opencode: 'OpenCode', kilo: 'Kilo', agy: 'Antigravity' }

// An agent's tile as the notch draws it, with a teammate's initial when it's on someone else's PC
function tile(a, px, who) {
  const w = Math.max(15, Math.round(px * .47))
  const badge = who ? `<span class="who" style="width:${w}px;height:${w}px;font-size:${Math.round(w * .6)}px;box-shadow:0 0 0 ${Math.max(2, Math.round(px * .06))}px #000">${who}</span>` : ''
  return `<div class="tile ${a}" style="width:${px}px;height:${px}px;border-radius:${Math.round(px * .28)}px">${a === 'team' ? TEAM_SVG : `<i class="glyph" style="background-image:url(assets/logo-${a}.svg)"></i>`}${badge}</div>`
}
// The pentagon the agents sit on (frame 2, and again in frame 5)
const pentagon = (cx, cy, r) => RING.map((_, i) => { const t = (-90 + i * 72) * Math.PI / 180; return { x: Math.round(cx + r * Math.cos(t)), y: Math.round(cy + r * Math.sin(t)) } })

const CSS = `
$ { font-family: "Segoe UI Variable Display", sans-serif; color: #fff; }
$ .bg { position: absolute; inset: 0; background: #000; }
$ .glow { position: absolute; inset: 0; }
$ .tile { position: relative; display: grid; place-items: center; flex: none; box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset, 0 8px 24px rgba(0,0,0,.5); }
$ .tile .glyph { display: block; width: 62%; height: 62%; background: center / contain no-repeat; } $ .tile.agy .glyph, $ .tile.kilo .glyph { width: 80%; height: 80%; }
$ .tile svg { display: block; width: 62%; height: 62%; }
$ .claude { background: #F4EFE6; } $ .agy { background: linear-gradient(160deg, #24252B, #131418); }
$ .opencode { background: linear-gradient(160deg, #262222, #121010); } $ .kilo { background: #0B0B0B; }
$ .copilot { background: linear-gradient(160deg, #3B2A6B, #17112E); } $ .team { background: linear-gradient(160deg, #6B3FA0, #2B1745); }
$ .who { position: absolute; right: -12%; bottom: -12%; border-radius: 50%; background: #BF5AF2; color: #fff; font-weight: 700; line-height: 1; display: grid; place-items: center; }
$ .cap { position: absolute; font-weight: 700; letter-spacing: -.045em; line-height: .95; white-space: nowrap; text-shadow: 0 10px 60px rgba(0,0,0,.85); }
$ .cap > div { display: block; } $ .cap > span { display: inline-block; }
$ .p { color: #BF5AF2; }
$ .mono { font-family: "Cascadia Mono", monospace; text-transform: uppercase; letter-spacing: .14em; }
$ .dot { position: absolute; left: 0; top: 0; width: 24px; height: 24px; margin: -12px 0 0 -12px; border-radius: 50%; background: #E3C2FF; box-shadow: 0 0 20px 7px rgba(191,90,242,.85); opacity: 0; display: block; }
$ .ring { position: absolute; border-radius: 50%; border: 4px solid #BF5AF2; opacity: 0; display: block; }
$ .wall { position: absolute; inset: 0; background:
    radial-gradient(42% 60% at 50% 74%, rgba(84,160,255,.55), transparent 70%),
    radial-gradient(30% 44% at 38% 66%, rgba(40,110,230,.5), transparent 70%),
    radial-gradient(30% 44% at 63% 64%, rgba(30,90,210,.5), transparent 70%),
    radial-gradient(120% 90% at 50% 100%, #0c2a63, #071330 55%, #04070f); }
$ .ndots { display: flex; } $ .ndots i { display: block; border-radius: 50%; }
`
const ndots = (list, px, ring) => `<span class="ndots">${list.map((a, i) => `<i style="width:${px}px;height:${px}px;background:${DOT[a]};box-shadow:0 0 0 ${ring}px #000${i ? `;margin-left:-${Math.round(px * .3)}px` : ''}"></i>`).join('')}</span>`

function write(id, dur, css, html, js) {
  const p = 'f' + id[1]
  const scope = `[data-composition-id="${id}"]`
  const style = (CSS + css).replace(/\$ /g, scope + ' ').replace(/\$\s*\{/g, scope + ' {')
  html = html.replace(/<(div|span|svg|img|b|i|h1|path|line)([ >])/g, '<$1 data-layout-allow-overlap$2')
  fs.writeFileSync(path.join(OUT, id + '.html'), `<template>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: "Segoe UI Variable Display"; src: url("assets/fonts/SegUIVar.ttf"); font-weight: 100 900; }
@font-face { font-family: "Cascadia Mono"; src: url("assets/fonts/CascadiaMono.ttf"); }
#root { position: absolute; inset: 0; overflow: hidden; }
${style}
</style>
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080">
  <div class="bg clip" id="${p}-bg" data-start="0" data-duration="${dur}" data-track-index="0"></div>
  <div class="clip" id="${p}-content" data-start="0" data-duration="${dur}" data-track-index="1" style="position:absolute;inset:0">
${html}
  </div>
</div>
<script>
(function () {
  const R = document.querySelector('[data-composition-id="${id}"]')
  const $ = s => R.querySelector(s), $$ = s => Array.from(R.querySelectorAll(s))
  const tl = gsap.timeline({ paused: true })
  const B = ${B}, DUR = ${dur}
  const slam = (s, t) => tl.fromTo($(s), { opacity: 0, scale: 1.25, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: .38, ease: "power4.out" }, t)
  const rise = (s, t, d) => tl.fromTo($(s), { opacity: 0, y: d || 40 }, { opacity: 1, y: 0, duration: .42, ease: "power4.out" }, t)
  const pop = (s, t, from) => tl.fromTo($(s), { opacity: 0, scale: from || .3 }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2)" }, t)
  // a short bump on something already on screen: up, then springs back
  const bump = (s, t, k) => { tl.fromTo($(s), { scale: 1 }, { scale: k, duration: .1, ease: "power2.out", immediateRender: false }, t); tl.fromTo($(s), { scale: k }, { scale: 1, duration: .32, ease: "back.out(3)", immediateRender: false }, t + .1) }
  const ring = (s, t, k) => tl.fromTo($(s), { opacity: .9, scale: 1 }, { opacity: 0, scale: k || 1.9, duration: .44, ease: "power2.out", immediateRender: false }, t)
${js}
  window.__timelines["${id}"] = tl
})()
</script>
</template>
`)
}

// ================= 01 · Group chat (2 bars) =================
const CHAT = [
  { a: 'claude', who: 'B', from: 'bob/claude', to: 'everyone', text: "Starting on checkout. I'll call the orders API." },
  { a: 'opencode', mine: true, from: 'kurian/opencode', to: 'bob', text: 'Heads up: /cart/checkout is now POST /orders.' },
  { a: 'agy', who: 'A', from: 'alice/agy', to: 'everyone', text: 'Webhooks are signed now. Add X-Signature to tests.' },
  { a: 'claude', who: 'B', from: 'bob/claude', to: 'kurian/opencode', text: 'Got it. Switching to /orders.' },
  { a: 'opencode', mine: true, from: 'kurian/opencode', to: 'everyone', text: 'Orders API is merged. Pull when ready.' },
]
write('01-group-chat', 4 * B * 2, `
$ .glow { background: radial-gradient(50% 55% at 50% 55%, rgba(110,75,216,.2), transparent 70%); }
$ .recede { position: absolute; inset: 0; }
$ .thread { position: absolute; left: 410px; top: 0; width: 1100px; height: 800px; }
$ .row { position: absolute; left: 0; right: 0; height: 122px; display: flex; align-items: flex-end; gap: 16px; }
$ .row.mine { flex-direction: row-reverse; }
$ .bub { padding: 15px 30px 18px; border-radius: 40px 40px 40px 14px; background: #26262A; transform-origin: 0 100%; }
$ .row.mine .bub { border-radius: 40px 40px 14px 40px; background: linear-gradient(160deg, #6E4BD8, #0A84FF); transform-origin: 100% 100%; }
$ .meta { font-size: 24px; font-weight: 600; color: rgba(235,235,245,.55); margin-bottom: 4px; white-space: nowrap; }
$ .row.mine .meta { color: rgba(255,255,255,.92); }
$ .text { font-size: 36px; font-weight: 500; line-height: 1.3; letter-spacing: -.01em; white-space: nowrap; }
$ #f1-cap { left: 0; right: 0; top: 300px; text-align: center; font-size: 200px; }
`, `    <div class="glow"></div>
    <div class="recede" id="f1-recede"><div class="thread" id="f1-thread">
${CHAT.map((m, k) => `      <div class="row${m.mine ? ' mine' : ''}" style="top:${k * 140}px"><div id="f1-i${k}">${tile(m.a, 68, m.who)}</div><div class="bub" id="f1-b${k}"><div class="meta">${m.from} → ${m.to}</div><div class="text">${esc(m.text)}</div></div></div>`).join('\n')}
    </div></div>
    <div class="cap" id="f1-cap"><div id="f1-l0">your agents</div><div id="f1-l1" class="p">can talk now.</div></div>`, `
  // a message per beat; the thread scrolls so the newest sits at y 600
  const TOP = 600, STEP = 140, AT = [0, B, 2 * B, 3 * B, 6 * B]
  tl.set($("#f1-thread"), { y: TOP }, 0)
  AT.forEach(function (t, k) {
    if (k) tl.fromTo($("#f1-thread"), { y: TOP - (k - 1) * STEP }, { y: TOP - k * STEP, duration: .34, ease: "power3.out", immediateRender: false }, t)
    tl.fromTo($("#f1-b" + k), { opacity: 0, scale: .55, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: .45, ease: "back.out(1.8)" }, t)
    tl.fromTo($("#f1-i" + k), { opacity: 0, scale: .2 }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2.2)" }, t + .04)
  })
  // the drop: the chat falls back and the line slams over it
  tl.fromTo($("#f1-recede"), { scale: 1, opacity: 1, filter: "blur(0px)" }, { scale: .92, opacity: .28, filter: "blur(5px)", duration: .5, ease: "power2.out", immediateRender: false }, 4 * B)
  slam("#f1-l0", 4 * B); slam("#f1-l1", 5 * B)
  tl.fromTo($("#f1-cap"), { scale: 1 }, { scale: 1.05, duration: DUR - 4 * B, ease: "none" }, 4 * B)`)

// ================= 02 · Any agent (2 bars) =================
const P2 = pentagon(960, 400, 270)
const PAIRS = []
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) PAIRS.push([i, j])
// [from, to, beat]: one per beat round the ring, then the star and the ring all at once
const FLIGHTS = [[0, 1, 1], [1, 4, 2], [4, 2, 3], [2, 3, 4], [3, 0, 5], ...[0, 1, 2, 3, 4].map(i => [i, (i + 2) % 5, 6]), ...[0, 1, 2, 3, 4].map(i => [i, (i + 1) % 5, 7])]
write('02-any-agent', 4 * B * 2, `
$ .glow { background: radial-gradient(38% 48% at 50% 38%, rgba(191,90,242,.16), transparent 70%); }
$ .mesh { position: absolute; left: 0; top: 0; }
$ .mesh line { stroke: rgba(235,235,245,.22); stroke-width: 3; stroke-dasharray: 10 12; }
$ .node { position: absolute; width: 132px; height: 132px; }
$ .lab { position: absolute; width: 320px; text-align: center; font-size: 22px; color: rgba(235,235,245,.62); }
$ #f2-cap { left: 0; right: 0; top: 790px; text-align: center; font-size: 104px; }
`, `    <div class="glow"></div>
    <svg class="mesh" id="f2-mesh" width="1920" height="1080" viewBox="0 0 1920 1080">${PAIRS.map(([i, j]) => `<line x1="${P2[i].x}" y1="${P2[i].y}" x2="${P2[j].x}" y2="${P2[j].y}"/>`).join('')}</svg>
${FLIGHTS.map((_, n) => `    <i class="dot" id="f2-d${n}"></i>`).join('\n')}
${P2.map((p, i) => `    <i class="ring" id="f2-r${i}" style="left:${p.x - 66}px;top:${p.y - 66}px;width:132px;height:132px"></i>
    <div class="node" id="f2-n${i}" style="left:${p.x - 66}px;top:${p.y - 66}px">${tile(RING[i], 132)}</div>
    <div class="lab mono" id="f2-t${i}" style="left:${p.x - 160}px;top:${p.y + 84}px">${LABEL[RING[i]]}</div>`).join('\n')}
    <div class="cap" id="f2-cap"><span id="f2-c0">any agent.</span> <span id="f2-c1" class="p">any provider.</span></div>`, `
  const P = ${JSON.stringify(P2)}, F = ${JSON.stringify(FLIGHTS)}
  P.forEach(function (p, i) { pop("#f2-n" + i, i * .06); rise("#f2-t" + i, .12 + i * .06, 14) })
  tl.fromTo($("#f2-mesh"), { opacity: 0 }, { opacity: 1, duration: .5, ease: "power1.out" }, .1)
  tl.fromTo($$("#f2-mesh line"), { strokeDashoffset: 0 }, { strokeDashoffset: -220, duration: DUR, ease: "none" }, 0)
  // each message flies its wire; the receiver pops and rings
  F.forEach(function (f, n) {
    const a = P[f[0]], b = P[f[1]], t = f[2] * B, d = $("#f2-d" + n)
    tl.fromTo(d, { x: a.x, y: a.y, opacity: 0, scale: .4 }, { opacity: 1, scale: 1, duration: .08, ease: "none" }, t)
    tl.fromTo(d, { x: a.x, y: a.y }, { x: b.x, y: b.y, duration: .36, ease: "power2.inOut", immediateRender: false }, t)
    tl.fromTo(d, { opacity: 1, scale: 1 }, { opacity: 0, scale: .5, duration: .08, ease: "none", immediateRender: false }, t + .3)
    bump("#f2-n" + f[1], t + .34, 1.16)
    ring("#f2-r" + f[1], t + .34)
  })
  rise("#f2-c0", B); rise("#f2-c1", 3 * B)`)

// ================= 03 · Any PC (2 bars) =================
// The message's route: left notch (480, 284) → arc up to the remote (960, 120) → arc down to the right notch (1440, 284).
// x moves linearly and y eases (power1.out up, power1.in down), which traces exactly these two quadratic arcs.
write('03-any-pc', 4 * B * 2, `
$ .glow { background: radial-gradient(30% 50% at 18% 60%, rgba(10,132,255,.16), transparent 70%), radial-gradient(30% 50% at 82% 60%, rgba(191,90,242,.16), transparent 70%); }
$ .all { position: absolute; inset: 0; }
$ .arcs { position: absolute; left: 0; top: 0; }
$ .arcs path { fill: none; stroke: rgba(227,194,255,.45); stroke-width: 3; stroke-dasharray: 10 12; }
$ .stage { position: absolute; inset: 0; perspective: 1800px; }
$ .dev { position: absolute; top: 270px; width: 660px; height: 380px; border-radius: 26px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.14) inset, 0 30px 80px rgba(0,0,0,.6); }
$ #f3-left .wall { opacity: .9; }
$ #f3-right .wall { filter: hue-rotate(48deg); opacity: .9; }
$ .tbar { position: absolute; left: 0; right: 0; bottom: 0; height: 32px; background: rgba(22,22,26,.92); border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center; gap: 10px; }
$ .tbar i { display: block; width: 17px; height: 17px; border-radius: 4px; background: rgba(255,255,255,.2); }
$ .wlogo { display: grid; grid-template-columns: 7px 7px; gap: 2px; } $ .wlogo b { display: block; width: 7px; height: 7px; background: #4cc2ff; }
$ .npill { position: absolute; left: 0; right: 0; top: 12px; margin: 0 auto; width: 250px; height: 60px; border-radius: 30px; background: #000; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,.1) inset, 0 12px 30px rgba(0,0,0,.5); }
$ .pst { position: absolute; left: 0; right: 0; top: 0; height: 60px; display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 22px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; }
$ .sbub { position: absolute; left: 0; right: 0; top: 110px; margin: 0 auto; width: max-content; padding: 12px 22px 14px; border-radius: 28px 28px 10px 28px; background: linear-gradient(160deg, #6E4BD8, #0A84FF); transform-origin: 50% 0; }
$ .sbub .m { font-size: 18px; font-weight: 600; color: rgba(255,255,255,.95); margin-bottom: 2px; white-space: nowrap; }
$ .sbub .t { font-size: 26px; font-weight: 500; white-space: nowrap; }
$ .peek { position: absolute; left: 0; top: 0; width: 600px; padding: 18px 22px; display: flex; gap: 16px; align-items: flex-start; }
$ .relay { flex: none; display: flex; align-items: center; padding-top: 3px; }
$ .wire { position: relative; width: 60px; height: 3px; margin: 0 8px; background: repeating-linear-gradient(90deg, rgba(235,235,245,.3) 0 6px, transparent 6px 12px); display: block; }
$ .wire b { position: absolute; top: -6px; left: -8px; width: 15px; height: 15px; border-radius: 50%; background: #E3C2FF; box-shadow: 0 0 14px 4px rgba(191,90,242,.85); opacity: 0; display: block; }
$ .pbody { flex: 1; min-width: 0; }
$ .ptop { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 20px; white-space: nowrap; }
$ .ptop b { font-weight: 600; } $ .ptop span { color: rgba(235,235,245,.6); font-size: 18px; }
$ .pline { margin-top: 4px; font-size: 20px; line-height: 1.35; color: rgba(235,235,245,.72); }
$ .origin { position: absolute; left: 908px; top: 68px; width: 104px; height: 104px; border-radius: 50%; background: #18191A; display: grid; place-items: center; box-shadow: 0 0 0 2px rgba(191,90,242,.75) inset, 0 0 44px rgba(191,90,242,.35); }
$ .origin svg { width: 52px; height: 52px; }
$ .olab { position: absolute; left: 860px; top: 184px; width: 200px; text-align: center; font-size: 22px; color: rgba(235,235,245,.62); }
$ .badge { position: absolute; top: 128px; padding: 10px 22px; border-radius: 999px; background: rgba(191,90,242,.16); box-shadow: 0 0 0 2px #BF5AF2 inset; color: #E3C2FF; font-size: 24px; white-space: nowrap; }
$ .dlab { position: absolute; top: 672px; width: 660px; text-align: center; font-size: 24px; color: rgba(235,235,245,.62); }
$ #f3-cap { left: 0; right: 0; top: 790px; text-align: center; font-size: 104px; }
`, `    <div class="glow"></div>
    <div class="all" id="f3-all">
    <svg class="arcs" id="f3-arcs" width="1920" height="1080" viewBox="0 0 1920 1080"><path d="M 480 284 Q 720 120 960 120"/><path d="M 960 120 Q 1200 120 1440 284"/></svg>
    <div class="stage">
      <div class="dev" id="f3-left" style="left:150px"><div class="wall"></div><div class="tbar"><span class="wlogo"><b></b><b></b><b></b><b></b></span><i></i><i></i><i></i></div>
        <div class="npill"><div class="pst">${ndots(['claude', 'opencode'], 20, 3)}<span>2 working</span></div></div>
        <div class="sbub" id="f3-sbub"><div class="m">kurian/claude → bob</div><div class="t">Pushed the orders API. Pull when ready.</div></div>
      </div>
      <div class="dev" id="f3-right" style="left:1110px"><div class="wall"></div><div class="tbar"><span class="wlogo"><b></b><b></b><b></b><b></b></span><i></i><i></i><i></i></div>
        <div class="npill" id="f3-rpill">
          <div class="pst" id="f3-rpst">${ndots(['claude'], 20, 3)}<span>1 working</span></div>
          <div class="peek" id="f3-peek">
            <div class="relay"><div id="f3-ri0">${tile('claude', 50, 'K')}</div><i class="wire"><b id="f3-wd"></b></i><div id="f3-ri1">${tile('claude', 50)}</div></div>
            <div class="pbody"><div class="ptop" id="f3-pt"><b>kurian/claude → bob</b><span>shop</span></div><div class="pline" id="f3-pl">Pushed the orders API. Pull when ready.</div></div>
          </div>
        </div>
      </div>
    </div>
    <i class="dot" id="f3-dot"></i>
    <i class="ring" id="f3-oring" style="left:908px;top:68px;width:104px;height:104px"></i>
    <div class="origin" id="f3-origin">${BRANCH_SVG}</div>
    <div class="olab mono" id="f3-olab">origin</div>
    <div class="badge mono" id="f3-push" style="left:487px">git push</div>
    <div class="badge mono" id="f3-fetch" style="left:1238px">git fetch</div>
    <div class="dlab mono" id="f3-llab" style="left:150px">kurian · desktop</div>
    <div class="dlab mono" id="f3-rlab" style="left:1110px">bob · laptop</div>
    </div>
    <div class="cap" id="f3-cap"><span id="f3-c0">across PCs.</span> <span id="f3-c1" class="p">nothing to host.</span></div>`, `
  // the two PCs swing in from opposite wings, opening like a book, then drift out of phase
  tl.fromTo($("#f3-left"), { x: -520, rotationY: 42, scale: .85, opacity: 0 }, { x: 0, rotationY: 8, scale: 1, opacity: 1, duration: .62, ease: "power3.out" }, 0)
  tl.fromTo($("#f3-right"), { x: 520, rotationY: -42, scale: .85, opacity: 0 }, { x: 0, rotationY: -8, scale: 1, opacity: 1, duration: .62, ease: "power3.out" }, .12)
  tl.fromTo($("#f3-left"), { y: 0 }, { y: -8, duration: DUR, ease: "sine.inOut" }, 0)
  tl.fromTo($("#f3-right"), { y: 0 }, { y: 8, duration: DUR, ease: "sine.inOut" }, 0)
  rise("#f3-llab", .3, 14); rise("#f3-rlab", .42, 14)
  pop("#f3-origin", .15); rise("#f3-olab", .3, 12)
  tl.fromTo($("#f3-arcs"), { opacity: 0 }, { opacity: 1, duration: .45 }, .25)
  tl.fromTo($$("#f3-arcs path"), { strokeDashoffset: 0 }, { strokeDashoffset: -220, duration: DUR, ease: "none" }, 0)
  tl.fromTo($("#f3-all"), { scale: 1 }, { scale: 1.035, duration: DUR, ease: "none" }, 0)
  // a message, written on the left PC
  tl.fromTo($("#f3-sbub"), { opacity: 0, y: 20, scale: .8 }, { opacity: 1, y: 0, scale: 1, duration: .45, ease: "back.out(1.8)" }, B)
  rise("#f3-c0", B)
  // up to the remote...
  const d = $("#f3-dot")
  tl.fromTo(d, { x: 480, y: 284, opacity: 0, scale: .4 }, { opacity: 1, scale: 1, duration: .1, ease: "none" }, 2 * B)
  tl.fromTo(d, { x: 480 }, { x: 960, duration: B, ease: "none", immediateRender: false }, 2 * B)
  tl.fromTo(d, { y: 284 }, { y: 120, duration: B, ease: "power1.out", immediateRender: false }, 2 * B)
  pop("#f3-push", 2 * B, .5)
  // ...through it, and down into the other PC
  bump("#f3-origin", 3 * B, 1.18); ring("#f3-oring", 3 * B, 2.2)
  tl.fromTo(d, { x: 960 }, { x: 1440, duration: B, ease: "none", immediateRender: false }, 3 * B)
  tl.fromTo(d, { y: 120 }, { y: 284, duration: B, ease: "power1.in", immediateRender: false }, 3 * B)
  tl.fromTo(d, { opacity: 1 }, { opacity: 0, duration: .08, ease: "none", immediateRender: false }, 4 * B - .06)
  pop("#f3-fetch", 3 * B, .5)
  // it lands: the notch over there opens the message
  tl.fromTo($("#f3-rpill"), { width: 250, height: 60, borderRadius: 30 }, { width: 600, height: 136, borderRadius: 34, duration: .6, ease: "back.out(1.4)", immediateRender: false }, 4 * B)
  tl.fromTo($("#f3-rpst"), { opacity: 1 }, { opacity: 0, duration: .12, ease: "none", immediateRender: false }, 4 * B)
  tl.fromTo($("#f3-peek"), { opacity: 0 }, { opacity: 1, duration: .2, ease: "none" }, 4 * B + .05)
  pop("#f3-ri0", 4 * B + .08, .2); pop("#f3-ri1", 4 * B + .5, .2)
  rise("#f3-pt", 4 * B + .14, 8); rise("#f3-pl", 4 * B + .2, 8)
  ;[4 * B + .12, 5 * B + .12, 6 * B + .12].forEach(function (t) {
    tl.fromTo($("#f3-wd"), { x: 0, opacity: 0 }, { opacity: 1, duration: .06, ease: "none", immediateRender: false }, t)
    tl.fromTo($("#f3-wd"), { x: 0 }, { x: 60, duration: .4, ease: "power2.inOut", immediateRender: false }, t)
    tl.fromTo($("#f3-wd"), { opacity: 1 }, { opacity: 0, duration: .06, ease: "none", immediateRender: false }, t + .36)
  })
  rise("#f3-c1", 5 * B)`)

// ================= 04 · Right in your notch (2 bars) =================
// The real notch at its native size (../index.html), scaled up: the pill, the team card, then the team view.
const PEOPLE = [['claude', 'kurian/claude', '', true], ['opencode', 'kurian/opencode'], ['claude', 'bob/claude', 'B'], ['agy', 'alice/agy', 'A']]
const THREAD = [
  { a: 'claude', who: 'B', meta: 'bob/claude → kurian/opencode · 1m ago', text: 'Does /orders paginate?' },
  { a: 'opencode', mine: true, meta: 'kurian/opencode → bob/claude · now', text: 'Cursor-based: ?after=<id>&limit=50.' },
  { a: 'agy', who: 'A', meta: 'alice/agy → everyone · now', text: 'Webhook tests are green.' },
]
write('04-in-the-notch', 4 * B * 2, `
$ .shade { position: absolute; inset: 0; background: linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.5) 55%, rgba(0,0,0,.75)); }
$ .zoom { position: absolute; left: 0; right: 0; top: 10px; display: flex; justify-content: center; transform-origin: 50% 0; }
$ .isl { position: relative; flex: none; width: 150px; height: 36px; border-radius: 18px; overflow: hidden; background: #000; font-size: 13px; line-height: 1.35;
         box-shadow: 0 0 0 .5px rgba(255,255,255,.09) inset, 0 12px 32px rgba(0,0,0,.32), 0 2px 6px rgba(0,0,0,.2); }
$ .rim { position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; --spin: 0deg; opacity: .9;
         background: conic-gradient(from var(--spin), transparent 0deg 240deg, rgba(10,132,255,.9) 315deg, rgba(191,90,242,.95) 342deg, transparent 360deg);
         -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
$ .st { position: absolute; left: 0; top: 0; }
$ .pst { width: 150px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 9px; white-space: nowrap; }
$ .pst b { font-weight: 600; letter-spacing: -.01em; }
$ .peek { width: 440px; padding: 11px 14px 11px 11px; display: flex; align-items: flex-start; gap: 11px; }
$ .relay { flex: none; display: flex; align-items: center; padding-top: 2px; }
$ .wire { position: relative; width: 30px; height: 2px; margin: 0 4px; border-radius: 1px; display: block; background: repeating-linear-gradient(90deg, rgba(235,235,245,.28) 0 3px, transparent 3px 6px); }
$ .wire b { position: absolute; top: -3px; left: -4px; width: 8px; height: 8px; border-radius: 50%; background: #E3C2FF; box-shadow: 0 0 8px 2px rgba(191,90,242,.85); opacity: 0; display: block; }
$ .cbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
$ .ctop { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; white-space: nowrap; }
$ .ctop b { font-weight: 600; } $ .ctop span { color: rgba(235,235,245,.3); font-size: 12px; }
$ .cline { color: rgba(235,235,245,.6); font-size: 12.5px; white-space: nowrap; }
$ .panel { width: 460px; padding: 18px 16px 12px; }
$ .head { display: flex; align-items: center; gap: 10px; padding: 0 6px 2px; }
$ .head h1 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.02em; line-height: 1.2; }
$ .head .summary { flex: 1; text-align: right; color: rgba(235,235,245,.6); font-size: 12px; white-space: nowrap; }
$ .round { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,.1); display: grid; place-items: center; flex: none; }
$ .round svg { width: 14px; height: 14px; }
$ .roster { display: flex; gap: 6px; padding: 14px 4px 2px; }
$ .person { flex: none; width: 84px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 10.5px; color: rgba(235,235,245,.6); white-space: nowrap; }
$ .person.busy .tile { box-shadow: 0 0 0 2px #000, 0 0 0 3.5px #0A84FF; }
$ .thread { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding: 0 2px 4px; }
$ .msg { display: flex; align-items: flex-end; gap: 8px; max-width: 86%; }
$ .msg.mine { align-self: flex-end; flex-direction: row-reverse; }
$ .nb { min-width: 0; padding: 7px 11px 8px; border-radius: 16px 16px 16px 5px; background: rgba(118,118,128,.26); }
$ .msg.mine .nb { border-radius: 16px 16px 5px 16px; background: linear-gradient(160deg, #6E4BD8, #0A84FF); }
$ .nm { margin-bottom: 2px; font-size: 10.5px; font-weight: 600; color: rgba(235,235,245,.62); white-space: nowrap; }
$ .msg.mine .nm { color: rgba(255,255,255,.95); }
$ .nt { font-size: 12.5px; line-height: 1.4; white-space: nowrap; }
$ #f4-cap { left: 110px; top: 640px; font-size: 120px; }
`, `    <div class="wall"></div><div class="shade"></div>
    <div class="zoom" id="f4-zoom"><div class="isl" id="f4-isl"><div class="rim" id="f4-rim"></div>
      <div class="st pst" id="f4-pst">${ndots(['claude', 'opencode'], 10, 2)}<b>2 working</b></div>
      <div class="st peek" id="f4-peek">
        <div class="relay"><div id="f4-ri0">${tile('claude', 26, 'B')}</div><i class="wire"><b id="f4-wd"></b></i><div id="f4-ri1">${tile('opencode', 26)}</div></div>
        <div class="cbody"><div class="ctop" id="f4-ct"><b>bob/claude → kurian/opencode</b><span>shop</span></div><div class="cline" id="f4-cl">Does /orders paginate?</div></div>
      </div>
      <div class="st panel" id="f4-panel">
        <div class="head" id="f4-head"><span class="round">${BACK_SVG}</span><h1>shop</h1><span class="summary">2 agents · 2 teammates</span></div>
        <div class="roster">${PEOPLE.map(([a, name, who, busy], i) => `<div class="person${busy ? ' busy' : ''}" id="f4-p${i}">${tile(a, 32, who)}<span>${name}</span></div>`).join('')}</div>
        <div class="thread">${THREAD.map((m, i) => `<div class="msg${m.mine ? ' mine' : ''}" id="f4-m${i}">${tile(m.a, 24, m.who)}<div class="nb"><div class="nm">${m.meta}</div><div class="nt">${esc(m.text)}</div></div></div>`).join('')}</div>
      </div>
    </div></div>
    <div class="cap" id="f4-cap"><div id="f4-c0">right in</div><div id="f4-c1" class="p">your notch.</div></div>`, `
  const Z = $("#f4-zoom"), I = $("#f4-isl")
  tl.fromTo(Z, { scale: 3.25 }, { scale: 3.0, duration: .6, ease: "power2.out" }, 0)
  tl.fromTo($("#f4-rim"), { "--spin": "0deg" }, { "--spin": "1080deg", duration: DUR, ease: "none" }, 0)
  // a message arrives: the pill springs open into the team card
  tl.fromTo(I, { width: 150, height: 36, borderRadius: 18 }, { width: 440, height: 60, borderRadius: 24, duration: .62, ease: "back.out(1.3)", immediateRender: false }, .23)
  tl.fromTo($("#f4-pst"), { opacity: 1 }, { opacity: 0, duration: .15, ease: "none", immediateRender: false }, .23)
  tl.fromTo($("#f4-peek"), { opacity: 0 }, { opacity: 1, duration: .2, ease: "none" }, .25)
  pop("#f4-ri0", .3, .2); pop("#f4-ri1", .8, .2)
  rise("#f4-ct", .35, 6); rise("#f4-cl", .4, 6)
  ;[.45, .95, 1.45].forEach(function (t) {
    tl.fromTo($("#f4-wd"), { x: 0, opacity: 0 }, { opacity: 1, duration: .06, ease: "none", immediateRender: false }, t)
    tl.fromTo($("#f4-wd"), { x: 0 }, { x: 30, duration: .42, ease: "power2.inOut", immediateRender: false }, t)
    tl.fromTo($("#f4-wd"), { opacity: 1 }, { opacity: 0, duration: .06, ease: "none", immediateRender: false }, t + .38)
  })
  rise("#f4-c0", B); rise("#f4-c1", 2 * B)
  // on the bar it opens into the team view
  tl.fromTo(Z, { scale: 3.0 }, { scale: 1.8, duration: .5, ease: "power3.out", immediateRender: false }, 4 * B)
  tl.fromTo(I, { width: 440, height: 60, borderRadius: 24 }, { width: 460, height: 312, borderRadius: 30, duration: .62, ease: "back.out(1.1)", immediateRender: false }, 4 * B)
  tl.fromTo($("#f4-peek"), { opacity: 1 }, { opacity: 0, duration: .15, ease: "none", immediateRender: false }, 4 * B)
  rise("#f4-head", 4 * B + .1, 6)
  ;[0, 1, 2, 3].forEach(function (i) { pop("#f4-p" + i, 4 * B + .18 + i * .05, .5) })
  rise("#f4-m0", 4 * B + .3, 8); rise("#f4-m1", 2.55, 8); rise("#f4-m2", 3.0, 8)`)

// ================= 05 · Team messages (3 bars: the music's break, then the drop) =================
const P5 = pentagon(960, 470, 330)
write('05-lockup', 4 * B * 3, `
$ .glow { background: radial-gradient(26% 34% at 50% 43.5%, rgba(191,90,242,.45), transparent 70%); opacity: 0; }
$ .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
$ .node { position: absolute; width: 110px; height: 110px; }
$ .pillw { position: absolute; left: 0; right: 0; top: 430px; display: flex; justify-content: center; }
$ .bpill { flex: none; width: 260px; height: 80px; border-radius: 40px; background: #000; display: flex; align-items: center; justify-content: center;
           box-shadow: 0 0 0 2px rgba(191,90,242,.5) inset, 0 0 40px rgba(191,90,242,.25); }
$ .pd { display: block; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 0 0 4px #000; } $ .pd + .pd { margin-left: -8px; }
$ #f5-ring { left: 900px; top: 410px; width: 120px; height: 120px; border: 6px solid #E3C2FF; }
$ .lock { position: absolute; inset: 0; }
$ .ltile { position: absolute; left: 0; right: 0; top: 150px; display: flex; justify-content: center; }
$ .kick { position: absolute; left: 0; right: 0; top: 330px; display: flex; justify-content: center; align-items: center; gap: 16px; font-size: 26px; letter-spacing: .2em; color: #E3C2FF; }
$ #f5-title { left: 0; right: 0; top: 400px; text-align: center; font-size: 200px; }
$ .sub { position: absolute; left: 0; right: 0; top: 640px; text-align: center; font-size: 52px; font-weight: 600; letter-spacing: -.01em; color: rgba(235,235,245,.78); }
$ .logos { position: absolute; left: 0; right: 0; top: 765px; display: flex; justify-content: center; align-items: center; gap: 18px; }
$ .win { font-size: 22px; color: rgba(235,235,245,.6); margin-left: 16px; }
`, `    <div class="glow" id="f5-glow"></div>
${P5.map((p, i) => `    <div class="node" id="f5-t${i}" style="left:${p.x - 55}px;top:${p.y - 55}px">${tile(RING[i], 110)}</div>`).join('\n')}
    <div class="pillw"><div class="bpill" id="f5-pill"><span class="ndots" id="f5-pdots">${RING.map((a, i) => `<i class="pd" id="f5-d${i}" style="background:${DOT[a]}"></i>`).join('')}</span></div></div>
    <i class="ring" id="f5-ring"></i>
    <div class="flash" id="f5-flash"></div>
    <div class="lock" id="f5-lock">
      <div class="ltile" id="f5-tile">${tile('team', 150)}</div>
      <div class="kick mono" id="f5-kick">new in agent notch</div>
      <div class="cap" id="f5-title">team messages</div>
      <div class="sub" id="f5-sub">any agent <span class="p">·</span> any PC <span class="p">·</span> one repo</div>
      <div class="logos">${RING.map((a, i) => `<div id="f5-l${i}">${tile(a, 56)}</div>`).join('')}<span class="mono win" id="f5-win">for windows</span></div>
    </div>`, `
  const P = ${JSON.stringify(P5)}
  P.forEach(function (p, i) { pop("#f5-t" + i, i * .03, .6) })
  pop("#f5-pill", 0, .7)
  // the break: one by one the agents are pulled into the notch, which charges up
  P.forEach(function (p, i) {
    const t = .5 + i * .18
    tl.fromTo($("#f5-t" + i), { x: 0, y: 0, scale: 1, opacity: 1 }, { x: 960 - p.x, y: 470 - p.y, scale: .15, opacity: 0, duration: .4, ease: "power3.in", immediateRender: false }, t)
    tl.fromTo($("#f5-d" + i), { scale: 0 }, { scale: 1, duration: .25, ease: "back.out(3)" }, t + .38)
    tl.fromTo($("#f5-pill"), { scale: 1.08 }, { scale: 1, duration: .17, ease: "power2.out", immediateRender: false }, t + .4)
  })
  tl.fromTo($("#f5-glow"), { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "power2.in" }, .4)
  tl.fromTo($("#f5-pill"), { boxShadow: "0 0 0 2px rgba(191,90,242,.5) inset, 0 0 40px rgba(191,90,242,.25)" }, { boxShadow: "0 0 0 3px rgba(227,194,255,.95) inset, 0 0 90px rgba(191,90,242,.9)", duration: 1.3, ease: "power2.in", immediateRender: false }, .5)
  // ...and collapses into one bright dot
  tl.fromTo($("#f5-pill"), { width: 260, backgroundColor: "#000000" }, { width: 80, backgroundColor: "#E3C2FF", duration: .26, ease: "power3.in", immediateRender: false }, 4 * B - .26)
  tl.fromTo($("#f5-pdots"), { opacity: 1 }, { opacity: 0, duration: .12, ease: "none", immediateRender: false }, 4 * B - .26)
  // the drop: it bursts into the lockup
  tl.fromTo($("#f5-pill"), { opacity: 1 }, { opacity: 0, duration: .06, ease: "none", immediateRender: false }, 4 * B)
  tl.fromTo($("#f5-ring"), { opacity: 1, scale: .2 }, { opacity: 0, scale: 7, duration: .7, ease: "power2.out", immediateRender: false }, 4 * B)
  tl.fromTo($("#f5-flash"), { opacity: .4 }, { opacity: 0, duration: .35, ease: "power2.out", immediateRender: false }, 4 * B)
  tl.fromTo($("#f5-glow"), { opacity: 1 }, { opacity: .3, duration: .8, ease: "power2.out", immediateRender: false }, 4 * B)
  pop("#f5-tile", 4 * B, .2)
  slam("#f5-title", 4 * B + .08)
  rise("#f5-kick", 4 * B + .3, 16)
  rise("#f5-sub", 4 * B + .72, 24)
  ;[0, 1, 2, 3, 4].forEach(function (i) { pop("#f5-l" + i, 4 * B + 1.1 + i * .06, .4) })
  rise("#f5-win", 4 * B + 1.45, 10)
  tl.fromTo($("#f5-lock"), { scale: 1 }, { scale: 1.035, duration: DUR - 4 * B, ease: "none" }, 4 * B)`)

console.log('frames written:', fs.readdirSync(OUT).join(', '))
