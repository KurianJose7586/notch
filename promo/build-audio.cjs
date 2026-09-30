// Builds assets/bgm/mix.mp3 (chaos, a beat of silence at the freeze, then the calm track) and writes the timed
// sound-effect cue list into audio_meta.json. Needs ffmpeg on PATH and the HeyGen tracks in assets/bgm and assets/sfx.
// Run: node build-audio.cjs
const fs = require('fs')
const { execFileSync } = require('child_process')
const TOTAL = 51

// Calm track is 30s and the order act now runs ~35s: play its first 24s, then rejoin it at 8s through a 2s crossfade.
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 'assets/bgm/chaos.mp3', '-i', 'assets/bgm/calm.mp3', '-filter_complex', [
  '[0]atrim=0:15,volume=3dB,afade=t=out:st=14.55:d=0.45,apad=whole_dur=' + TOTAL + '[a]',
  '[1]atrim=0:24,asetpts=PTS-STARTPTS[c1]', '[1]atrim=8:30,asetpts=PTS-STARTPTS[c2]',
  '[c1][c2]acrossfade=d=2,afade=t=in:st=0:d=0.12,adelay=15700|15700,apad=whole_dur=' + TOTAL + '[b]',
  `[a][b]amix=inputs=2:normalize=0,atrim=0:${TOTAL},afade=t=out:st=${TOTAL - 1.6}:d=1.6`,
].join(';'), '-c:a', 'libmp3lame', '-q:a', '2', 'assets/bgm/mix.mp3'], { stdio: 'inherit' })

// frame = the scene's number in STORYBOARD.md; offsets are seconds into that scene
const S = (frame, file, offset_s, duration_s, volume) => ({ frame, file: 'assets/sfx/' + file + '.mp3', offset_s, duration_s, volume })
const sfx = [
  ...[0, .8, 1.4, 2, 2.6, 3.2, 3.6, 3.94, 4.22].map((t, i) => S(1, 'impact-hit-on-each-word', t, .6, i < 6 ? .5 : .3)),
  S(1, 'keyboard-clatter-bed', 0, 11, .22),
  S(2, 'notification-pings-stacking', .1, 5.4, .4), S(2, 'error-beep', 1.9, 1.2, .3), S(2, 'error-beep', 3.3, 1.2, .3),
  S(3, 'record-scratch-at-the-reveal', 1.15, 1.5, .5), S(3, 'clock-ticking-fast', 1.2, 2.2, .35), S(3, 'glitch-riser-into-the-freeze', 2.03, 1.97, .55),
  S(4, 'then-a-soft-whoosh-down-and-a-glass-chim', .7, 1.52, .55), S(4, 'whoosh', 1.8, 1.5, .35),
  S(5, 'soft-expand-whoosh', .6, 1.5, .4), S(5, 'light-ticks-as-rows-land', .9, 2.2, .22),
  S(6, 'soft-alert-chime', .05, .72, .4), S(6, 'keycap-clack', 2.4, .35, .6), S(6, 'success-tick', 2.75, .6, .4),
  // 7: the phone
  S(7, 'whoosh', .2, 1.2, .3), S(7, 'soft-alert-chime', 1.25, .72, .45), S(7, 'notification-pings-stacking', 1.3, .8, .25),
  S(7, 'keycap-clack', 2.65, .35, .45), S(7, 'success-tick', 2.95, .6, .4),
  // 8: auto-enter
  S(8, 'switch-click', .6, .26, .55), ...[.9, 1.6, 2.25].map(t => S(8, 'three-quick-enter-clicks', t, .3, .45)), S(8, 'counter-ticks', .9, 2, .25),
  // 9: grid
  S(9, 'keycap-clack', 1.05, .35, .55), S(9, 'staggered-soft-snaps', 1.3, .67, .5),
  // 10: limits
  S(10, 'soft-rising-tone-during-the-count-up', .3, 1.33, .3), S(10, 'alert-chime-at-the-toast', 1.8, .74, .45),
  // 11: lockup
  S(11, 'the-notch-goodbye-whoosh-up', .4, 1.6, .45), S(11, 'then-a-clean-final-chord-hit-on-the-lock', 1.0, 4, .5),
]
const m = JSON.parse(fs.readFileSync('audio_meta.json', 'utf8'))
m.bgm = { path: 'assets/bgm/mix.mp3', volume: .8, query: 'chaos (0-15s) + silence at the freeze + calm (15.7s on)', duration_s: TOTAL }
m.sfx = sfx
fs.writeFileSync('audio_meta.json', JSON.stringify(m, null, 2))
console.log(sfx.length + ' cues, mix ' + TOTAL + 's')
