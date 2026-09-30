---
format: 1920x1080
duration: 46s
message: "All your coding agents. One notch."
arc: Chaos → Freeze → Notch drops → Order (5 features) → Lockup
audience: developers who run several AI coding agents at once
mode: collaborative
music: chaotic glitchy electronic build that cuts to silence at the freeze, then drops into a clean, confident, polished beat
---

## Decisions

Spine: the notch pill. It arrives in frame 4 and every later beat happens in it or under it.
Two registers: orange noise for the chaos act, blue calm for the order act; the blue/violet rim and glint belong only to the notch.
Bans: no fake notch UI (rebuild from the app's own CSS and the captured stills) · no slideshow of fresh cards · no motion that says nothing · no chaos after the freeze.
Held frame: frame 10 holds still for its last 2s.
Seams: hard cuts in act 1, push-slide left through the features, zoom-through into the lockup.
Sketch sheet: storyboard.html v1.

## Video direction

- Palette: from frame.md. Chaos act (frames 1–3): ink-black ground under a dim blue-grey desktop wallpaper, cream-muted orange (#FF9F0A) is the noise accent, red (#FF453A) only for the usage-limit line. Order act (4–10): pure black stage, blue (#0A84FF) is the only accent in type; the blue/violet rim and the glint belong only to the notch.
- Type: display role (lowercase, heavy) for headlines; body role for UI text; mono (Cascadia Mono) for terminal text. Fonts ship in assets/fonts.
- Motion grammar: chaos = hard cuts on the beat, slammed entrances with overshoot, small rotations, whole-stage shake; order = long-tail power3/expo settles and the notch's own spring, nothing jitters. Every frame reveals on its beat across its whole duration; never front-load.
- Rhythm: frames 1–3 accelerate; frame 4 opens on a held freeze (the one silent stillness beat) before the notch drops; 5–9 are steady feature beats; frame 10 holds still for its last 2s.
- Negative list: no fake notch UI (rebuild from the app's CSS/stills), no slideshow (front-load then freeze), no screensaver (independent floating), no chaos motion after the freeze, no bokeh or purple AI gradients, nothing below y≈900 (keep-out band).

## Frame 1 — Tab chaos

- scene: Terminal windows spawn and pile up on a Windows desktop, one per agent, as each agent's name punches in
- voiceover: ""
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-tab-chaos.html
- type: hook
- persuasion: Pain validation
- beat: overwhelm
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/logo-claude.svg — Claude glyph; assets/logo-agy.svg — Antigravity glyph; assets/logo-opencode.svg — OpenCode glyph; assets/logo-kilo.svg — Kilo glyph; assets/logo-copilot.svg — Copilot glyph
- focal: the stacked terminal windows
- roles: logo-*.svg = supporting (title-bar glyphs)
- sfx: impact-hit on each word, keyboard clatter bed

Adapt kinetic-type-beats: keep the in-place hard-cut word swap as the signature; each word also slams a new terminal window into the pile.
Scene 1 (0.0–0.8s): dim blue-grey desktop wallpaper full-bleed; "claude." slams in dead-centre (display role, huge) with the first terminal window slamming in behind it, tilted — centred, 2 depth layers.
Scene 2 (0.8–3.2s): the word hard-cuts in place on each beat: "agy." → "opencode." → "kilo." → "copilot."; each cut slams another tilted terminal (its agent glyph + name in the title bar, mono text scrolling) into a growing overlapping pile around the word; gaps shrink beat by beat.
Scene 3 (3.2–5.0s): the cadence doubles: more windows (to ~12) slam in on fast half-beats while the word lands on "claude again." with "again." in orange; the whole stage shakes; the pile covers most of the frame, the word stays on top.

narrativeRole: open on the viewer's own daily mess: too many agent terminals at once.
keyMessage: you're running a lot of agents.

On-screen words hard-cut on the beat, each with a new terminal slamming in slightly rotated and overlapping:
"claude." → "agy." → "opencode." → "kilo." → "copilot." → "claude again." The last beats come faster; by the
end ~12 windows are stacked, each with its logo in the title bar and scrolling mono text. Chaos palette: orange
warnings, clashing window chrome, slight camera shake.

## Frame 2 — Everyone needs you

- scene: Permission prompts and "needs you" bubbles close in from every side while a cursor darts between windows
- voiceover: ""
- duration: 6s
- transition_in: cut
- status: animated
- src: compositions/frames/02-everyone-needs-you.html
- type: pain_point
- persuasion: Pain agitation
- beat: frustration + anxiety
- blueprint: overwhelm-surround (Adapt)
- asset_candidates: assets/logo-agy.svg — Antigravity glyph for the prompt windows; assets/logo-opencode.svg — OpenCode glyph
- focal: the permission prompts closing in
- roles: logo-agy.svg / logo-opencode.svg = supporting (prompt headers)
- sfx: notification pings stacking, error beep

Adapt overwhelm-surround: keep the close-in-from-all-sides accumulation; the surfaces are real agent prompts and "needs you" badges, the avatar morph is replaced by the panicked cursor.
Scene 1 (0.0–1.5s): the desktop from frame 1, dimmed; the first two prompts pop in at opposite corners ("1. Yes  2. No · esc to cancel", "Allow: npm install react-router@7? (y/n)") with a bouncy pop — layered depth.
Scene 2 (1.5–3.5s): more prompts ("Do you trust this folder?", "Run: rm -rf dist?", "Allow edit to auth.ts?") and three orange "needs you" badges pop in around the edges on the beat; a white cursor zigzags between them.
Scene 3 (3.5–6.0s): the headline "which one needs you?" (second line orange) punches in centred; every prompt drifts inward toward the centre (surrounded, not zoomed-into) while the cursor jitters; density peaks by the end.

narrativeRole: the real pain is not the agents; it's that they keep stopping to ask you something, and you can't tell which.
keyMessage: they keep needing you, and you can't tell which one.

Prompts pop in all over, taken from the real agents: "1. Yes  2. No · esc to cancel", "Allow: npm install
react-router@7?", "Do you trust this folder?", a "needs you" badge, a system beep icon. A panicked cursor zigzags
between windows, pressing Enter on the wrong one. Headline, kinetic: "which one needs you?" Density climbs until
the prompts crowd the centre (surrounded, not zoomed-into).

## Frame 3 — Still "working"

- scene: One terminal says "Usage limit reached" while its spinner insists "Working…" for 2h 14m
- voiceover: ""
- duration: 4s
- transition_in: cut
- status: animated
- src: compositions/frames/03-still-working.html
- type: pain_point
- persuasion: Negative contrast
- beat: frustration → dark humour
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/logo-claude.svg — Claude glyph for the stuck terminal
- focal: the stuck Claude terminal
- roles: logo-claude.svg = supporting (title-bar glyph)
- sfx: record-scratch at the reveal, clock ticking fast, glitch riser into the freeze

Adapt kinetic-type-beats: keep a single bold statement landing after the setup; the setup is the terminal contradiction.
Scene 1 (0.0–1.2s): punch-in: one big Claude terminal fills ~70% of the frame over a blurred, dimmed desktop; "✻ Refactoring the API layer…" types in mono.
Scene 2 (1.2–2.4s): the red line "⎿ Usage limit reached · resets 10:16 PM" appears, while a blue status chip bottom-right keeps spinning "Working…" with its timer racing up to "2h 14m".
Scene 3 (2.4–4.0s): the caption "that one's been "working" for 2 hours." lands below the terminal ("working" in orange); in the last 0.6s the frame glitches harder and harder (RGB split, jitter) into the hard freeze.

narrativeRole: the comic peak of the chaos: the tools lie to you about what's happening.
keyMessage: and you don't even know when one has stopped.

Punch-in on one Claude terminal in the pile: red "Usage limit reached · resets 10:16 PM" line, while a status
chip keeps spinning "Working… 2h 14m". The timer ticks absurdly fast. Caption: "that one's been \"working\" for 2
hours." Everything glitches harder for the final half-second, building to the freeze.

## Frame 4 — The notch drops

- scene: Everything freezes and desaturates; a glossy black notch slides down from the top with a light glint, and the chaos is pulled into it
- voiceover: ""
- duration: 4s
- transition_in: cut
- status: animated
- src: compositions/frames/04-notch-drops.html
- type: product_intro
- persuasion: Show-don't-tell proof
- beat: relief + awe
- blueprint: ticker-takeover (Adapt)
- asset_candidates: assets/notch-pill-working.png — real collapsed notch pill, "4 working"; assets/agent-notch-icon.png — app icon
- focal: assets/notch-pill-working.png — reference for the rebuilt pill
- roles: notch-pill-working.png = reference only (pill rebuilt in HTML) · agent-notch-icon.png = unused here
- sfx: silence 0.6s, then a soft whoosh down and a glass chime at the glint

Adapt ticker-takeover: keep the hero crashing in and physically taking over the chaos; the "crash" is a premium spring drop and the displaced content streaks into the hero instead of being shoved aside.
Scene 1 (0.0–0.7s): the chaos, frozen and draining to grey (held stillness — the only silent beat).
Scene 2 (0.7–1.8s): the black notch pill springs down from the top edge to top-centre; a specular glint sweeps across its glass and the blue/violet rim glows up — centred, top third.
Scene 3 (1.8–2.8s): every frozen window shrinks and streaks up into the pill, each leaving a coloured trail in its agent colour, and turns into a dot in the pill's stack; the stage clears to pure black; the pill reads "5 working".
Scene 4 (2.8–4.0s): "meet agent notch." rises in below, centred ("agent notch." in blue); hold.

narrativeRole: the turn: order arrives, and it's the only perfectly crisp, premium thing on screen.
keyMessage: meet Agent Notch.

Hard freeze on the chaos (frame holds, drains to grey, sound cuts). A beat of silence. The black notch pill
descends from the top edge on a spring, a specular glint sweeps across its glass, the blue/violet rim glows. Every
frozen window shrinks and streaks into the pill as a coloured dot, leaving a clean black stage. The pill settles
reading "5 working" with its stacked agent dots. Type fades up below: "meet agent notch."

## Frame 5 — One glance

- scene: The pill expands into the real panel: agents grouped by project, each with state, task and time
- voiceover: ""
- duration: 5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-one-glance.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: clarity + control
- blueprint: device-surface-showcase (Adapt)
- asset_candidates: assets/notch-panel-open.png — the expanded panel with limits card and project groups
- focal: assets/notch-panel-open.png — reference for the rebuilt panel
- roles: notch-panel-open.png = reference only (panel rebuilt in HTML from the app CSS)
- sfx: soft expand whoosh, light ticks as rows land

Adapt device-surface-showcase: keep the floating product surface held as hero while its content populates; the device is the notch panel itself, no bezel.
Scene 1 (0.0–1.0s): the pill (continuing from frame 4, top-centre) springs open into the panel, which glides to the right 45% of the frame — asymmetric 55/45.
Scene 2 (1.0–3.2s): project groups cascade in top to bottom: web-app (OpenCode "Needs you", Kilo "Done"), payments-api (Claude "Working" with a 3-of-7 bar filling, Antigravity "Working" AUTO on), docs (Copilot with its "VS Code" tag); the header "1 need you · 3 working · 1 done" ticks into place.
Scene 3 (3.2–5.0s): the headline builds on the left line by line on the beat: "every agent." → "every project." → "one glance." (blue); hold.

narrativeRole: first proof: the whole mess is now one calm, readable list.
keyMessage: every agent, every project, one glance.

The pill springs open into the panel (rebuilt from the real UI). Project groups cascade in: web-app, payments-api,
docs. Rows show Claude working with a 3-of-7 progress bar, Antigravity working, OpenCode "Needs you", Kilo
"Done", Copilot with its VS Code tag. The header counts tick into place. Headline beside the panel: "every agent.
every project. one glance."

## Frame 6 — Needs you? One key.

- scene: The pill turns orange with "OpenCode needs you", peeks the request, a Y keycap is pressed and it goes back to working
- voiceover: ""
- duration: 5s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/06-one-key.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease
- blueprint: cursor-ui-demo (Adapt)
- asset_candidates: assets/notch-pill-needs-you.png — the real pill in "needs you" state; assets/logo-opencode.svg — OpenCode glyph
- focal: assets/notch-pill-needs-you.png — reference for the rebuilt orange pill
- roles: notch-pill-needs-you.png = reference only · logo-opencode.svg = supporting (peek glyph)
- sfx: soft alert chime, keycap clack, success tick

Adapt cursor-ui-demo: keep one workflow demonstrated end-to-end onto the action; the "cursor" is a big keycap press instead of a mouse.
Scene 1 (0.0–1.2s): pill at top-centre glows orange: "OpenCode needs you · web-app"; the peek card drops below it: OpenCode glyph, "OpenCode needs you", mono "Allow: npm install react-router@7".
Scene 2 (1.2–2.4s): headline "needs you?" appears left; a big "Y" keycap rises in right of centre.
Scene 3 (2.4–3.6s): the keycap presses down with a springy release; a ripple runs up to the peek; the peek flips to blue "Working · Edit router.tsx" and the orange glow fades out of the pill; "one key." (blue) completes the headline.
Scene 4 (3.6–5.0s): the caption "Y allow · N deny · Ctrl+Alt+J jumps to it" fades in under the headline; hold.

narrativeRole: fixes frame 2's pain directly: you always know who needs you, and you answer without hunting.
keyMessage: it tells you who needs you, and you answer with one key.

The pill glows orange: "OpenCode needs you · web-app". It peeks down showing "Allow: npm install
react-router@7". A large keycap "Y" presses with a satisfying spring; the row flips to "Working" in blue, the
glow fades. Headline: "needs you? one key." Small caption: "Y allow · N deny · Ctrl+Alt+J jumps to it".

## Frame 7 — Auto-Enter for Antigravity

- scene: agy permission prompts appear and are answered instantly by themselves while the AUTO switch glows green
- voiceover: ""
- duration: 4s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/07-auto-enter.html
- type: feature_showcase
- persuasion: Friction reduction
- beat: ease + delight
- blueprint: agent-progress-theater (Adapt)
- asset_candidates: assets/logo-agy.svg — Antigravity glyph
- focal: the agy terminal answering itself
- roles: logo-agy.svg = supporting (terminal + notch row glyph)
- sfx: switch click, three quick Enter clicks, counter ticks

Adapt agent-progress-theater: keep the single trigger that hands the frame to the machine, then status theater resolving; the trigger is AUTO flipping on and the receipts are prompts answering themselves.
Scene 1 (0.0–0.9s): an agy terminal (left 45%) and the notch's Antigravity row (right) slide in; the AUTO switch flicks on and turns green.
Scene 2 (0.9–2.8s): three prompts "1. Yes  2. No  esc to cancel" land in the terminal in quick succession; each is answered the instant it lands — a small "↵" ripple travels from the notch row to the terminal and a green "↵ pressed by notch" line prints; the counter "Enters pressed for you:" ticks up fast to 147.
Scene 3 (2.8–4.0s): the headline "auto-enter. finally." lands right under the counter ("finally." blue); hold.

narrativeRole: the feature the creator built this for: no more babysitting agy's Enter prompts.
keyMessage: AUTO presses Enter for you.

A clean agy terminal. The notch row's AUTO switch flicks on (green). Prompts "1. Yes · esc to cancel" appear three
times in quick succession and each is answered the instant it lands, a tiny "↵" ripple from the notch each time;
a counter in the corner ticks "Enters pressed for you: 1, 2, 3 … 147". Headline: "auto-enter. finally."

## Frame 8 — One-click grid

- scene: A messy pile of agent windows snaps into a perfect grid when the grid button is pressed
- voiceover: ""
- duration: 4s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/08-grid.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: satisfaction + control
- blueprint: grid-card-assemble (Adapt)
- asset_candidates: assets/logo-claude.svg — window glyph; assets/logo-agy.svg — window glyph; assets/logo-opencode.svg — window glyph; assets/logo-kilo.svg — window glyph; assets/logo-copilot.svg — window glyph
- focal: the windows snapping into the grid
- roles: logo-*.svg = supporting (window title-bar glyphs)
- sfx: button click, whoosh, staggered soft snaps

Adapt grid-card-assemble: keep the staggered self-assembly into a grid; the items start as frame 1's messy pile instead of off-screen.
Scene 1 (0.0–1.0s): frame 1's six windows reappear calm (no shake) in their messy overlapping pile; the pill sits top-centre with its grid icon.
Scene 2 (1.0–2.6s): the "Ctrl+Alt+G" keycap presses bottom-right and the grid icon pulses; every window flies on a smooth spring into a tidy 3×2 grid, staggered left-to-right, straightening its rotation, with a soft settle.
Scene 3 (2.6–4.0s): "one click. every window." (second half blue) lands along the bottom-left above the keep-out line; hold.

narrativeRole: callback to frame 1's pile: the same windows, now in order.
keyMessage: one click lays them all out.

Frame 1's overlapping windows reappear (the same ones, now calm). The notch's grid button is pressed (keycap
"Ctrl+Alt+G" beside it); every window flies on a spring into a tidy 3×2 grid, staggered, with a soft settle.
Headline: "one click. every window."

## Frame 9 — Know before the wall

- scene: The limits card fills, 5-hour bar counts up to 82% and turns orange, the heads-up toast drops; a stopped agent reads "Stopped", not "Working"
- voiceover: ""
- duration: 4s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/09-limits.html
- type: feature_showcase
- persuasion: Negative contrast
- beat: confidence + peace of mind
- blueprint: dataviz-countup (Adapt)
- asset_candidates: assets/notch-toast-limits.png — the real limits heads-up toast; assets/notch-panel-open.png — limits card reference
- focal: assets/notch-toast-limits.png — reference for the rebuilt toast
- roles: notch-toast-limits.png = reference only (toast rebuilt in HTML) · notch-panel-open.png = reference for the limits card
- sfx: soft rising tone during the count-up, alert chime at the toast

Adapt dataviz-countup: keep the count-up to a hero metric; the metric is the 5-hour bar hitting 82% and flipping colour.
Scene 1 (0.0–1.8s): the limits card slides in left: Claude glyph, "5-hour" bar counts up 0 → 82% (blue turning orange past 70%), "Weekly" counts to 41% (blue) — asymmetric 50/50.
Scene 2 (1.8–2.6s): the toast drops from the top-centre notch: "Claude at 82% of your 5-hour limit · Resets Wed 11:06 PM" in orange.
Scene 3 (2.6–4.0s): below the card, frame 3's Claude row returns honest: red dot "Stopped", "Usage limit reached · resets 10:16 PM"; the headline "know before you hit the wall." ("the wall." blue) lands right; hold.

narrativeRole: fixes frame 3's lie: usage and stops are visible.
keyMessage: see your limits before you hit them.

The Claude limits card: "5-hour" bar counts up 0 → 82% (blue → orange at 70%), "Weekly" to 41%. The notch toast
drops: "Claude at 82% of your 5-hour limit · Resets 11:06 PM". Below, frame 3's Claude row reappears, now honest:
red dot, "Stopped · Usage limit reached · resets 10:16 PM". Headline: "know before you hit the wall."

## Frame 10 — One notch

- scene: The notch shrinks back to a pill, then the lockup: app icon, "Agent Notch", tagline, supported agents row
- voiceover: ""
- duration: 5s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/10-one-notch.html
- type: branding
- persuasion: Value stacking
- beat: triumph
- blueprint: logo-assemble-lockup (Adapt)
- asset_candidates: assets/agent-notch-icon.png — app icon; assets/logo-claude.svg — Claude glyph; assets/logo-agy.svg — Antigravity glyph; assets/logo-opencode.svg — OpenCode glyph; assets/logo-kilo.svg — Kilo glyph; assets/logo-copilot.svg — Copilot glyph
- focal: assets/agent-notch-icon.png
- roles: agent-notch-icon.png = hero mark · logo-*.svg = supporting row
- sfx: the notch goodbye whoosh-up, then a clean final chord hit on the lockup

Adapt logo-assemble-lockup: keep the mark coming to exist on a cleared stage and resolving into a centred lockup; it comes out of the notch's own goodbye stretch-up.
Scene 1 (0.0–1.0s): the notch pill at top-centre does its goodbye: a little stretch taller, then zips up off the top edge.
Scene 2 (1.0–2.4s): the app icon springs in at centre-upper, then "Agent Notch" rises in below it (display role, title case).
Scene 3 (2.4–3.0s): the tagline "All your coding agents. One notch." ("One notch." blue) fades up, then the row of five agent glyphs with "FOR WINDOWS" staggers in.
Scene 4 (3.0–5.0s): held still to the final frame.

narrativeRole: land the message and the name.
keyMessage: All your coding agents. One notch.

The pill does its goodbye stretch-up, then the lockup assembles on the black stage: the app icon springs in, "Agent
Notch" in large display type, the tagline "All your coding agents. One notch." below it, and a row of the five
agent glyphs with "for Windows". Holds to the last frame.
