// Builds the music cut and the notch's message blip, and writes the timed sound-effect cues into audio_meta.json.
// Needs ffmpeg on PATH and the demo's HeyGen library audio (../demo/assets). Run: node build-audio.cjs
const fs = require('fs')
const { execFileSync } = require('child_process')
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args.map(String)], { stdio: 'inherit' })
const B = 0.46875, TOTAL = 44 * B // 11 bars, 20.625s

// The demo's 128 BPM track from its last intro bar (13.125s): it drops at 1.875s, breaks at 15s and drops again at 16.875s
ff(['-ss', 13.125, '-t', TOTAL, '-i', '../demo/assets/bgm/track.mp3', '-af', `afade=t=in:d=0.04,afade=t=out:st=${TOTAL - 1.6}:d=1.6`, '-c:a', 'libmp3lame', '-q:a', '2', 'assets/bgm/cut.mp3'])

// The notch's team-message sound (blip() in ../index.html): sine 1567.98 Hz, then 2093 Hz 80 ms later, each a 10 ms rise and a 0.3 s decay
const note = (f, d) => `if(gte(t,${d}),if(lt(t-${d},0.01),(t-${d})/0.01,exp(-21.4*(t-${d}-0.01)))*sin(2*PI*${f}*(t-${d}))*lt(t-${d},0.32),0)`
ff(['-f', 'lavfi', '-i', `aevalsrc='0.5*(${note(1567.98, 0)}+${note(2093, 0.08)})':s=48000:d=0.45`, 'assets/sfx/blip.wav'])

const USED = ['soft-pop-on-open', 'whoosh-into-the-push', 'tap', 'quick-ding-cascade', 'clean-final-hit']
for (const f of USED) fs.copyFileSync(`../demo/assets/sfx/${f}.mp3`, `assets/sfx/${f}.mp3`)

// frame = the frame's number in STORYBOARD.md; offsets are seconds into that frame
const LEN = { blip: .45, 'soft-pop-on-open': 1.3, 'whoosh-into-the-push': 1.8, tap: .26, 'quick-ding-cascade': 1.1, 'clean-final-hit': 2.75 }
const S = (frame, name, offset_s, volume) => ({ frame, file: `assets/sfx/${name}.${name === 'blip' ? 'wav' : 'mp3'}`, offset_s: +offset_s.toFixed(3), duration_s: LEN[name], volume, source: 'host' })
const sfx = [
  // 1: a message per beat, then one behind the line
  ...[0, B, 2 * B, 3 * B].map(t => S(1, 'blip', t, .6)), S(1, 'blip', 6 * B, .3),
  // 2: the tiles land, each message lands, the burst
  S(2, 'soft-pop-on-open', 0, .5), ...[1, 2, 3, 4, 5].map(b => S(2, 'blip', b * B + .34, .4)), S(2, 'quick-ding-cascade', 6 * B + .3, .45),
  // 3: the PCs swing in, the push, the landing
  S(3, 'whoosh-into-the-push', 0, .45), S(3, 'tap', 2 * B, .6), S(3, 'blip', 4 * B, .6),
  // 4: the card, the panel, the replies
  S(4, 'blip', .9, .6), S(4, 'soft-pop-on-open', 4 * B, .55), S(4, 'blip', 2.55, .35), S(4, 'blip', 3.0, .35),
  // 5: pulled in through the break, then the hit on the drop
  S(5, 'whoosh-into-the-push', .4, .3), S(5, 'clean-final-hit', 4 * B, .9),
]
fs.writeFileSync('audio_meta.json', JSON.stringify({
  bgm: { path: 'assets/bgm/cut.mp3', volume: .55, source: 'host', duration_s: TOTAL, query: 'the demo track, 13.125s on: last intro bar, drop, break, second drop' },
  bgm_pending: false, voices: [], sfx,
}, null, 2))
console.log(`${sfx.length} cues, music ${TOTAL}s`)
