---
format: 1920x1080
duration: 20.6s
message: "Your agents can talk to each other now: any agent, any PC, one repo."
arc: Group chat hook → any agent → any PC (through the repo) → right in your notch → break → lockup
audience: developers who run AI coding agents, often next to teammates in the same repo
mode: autonomous
music: none
---

## Decisions

Spine: one 128 BPM grid (beat 0.469s, bar 1.875s). The music is `assets/bgm/cut.mp3`, the demo's track from its last
intro bar: it drops at 1.875s on the hook line, breaks at 15s (silence, then a riser) and drops again at 16.875s on the lockup.
Every frame is two bars; the lockup is three.
Look: motion graphics on a black field built from the notch's own parts (agent tiles, the flying message dot, bubbles,
who-badges, the pill), plus massive lowercase type. Purple `#BF5AF2` is the one accent (the feature's color in the app).
Sound: the notch's own team-message blip (two quick high notes) on every message; whooshes, a pop, one final hit.
Bans: no fake brands or URLs, no voiceover, no emoji, no pronouns for the example teammates.

## Video direction

- Palette: frame.md. Black ground; white type; accent purple `#BF5AF2`, light purple `#E3C2FF` for the flying dot and small
  labels; the "mine" bubble gradient `#6E4BD8 → #0A84FF`; app tile colors for agents; desktop bloom only in frame 4.
- Type: Segoe UI Variable Display 700, lowercase, tracking -0.045em for statements; Cascadia Mono uppercase 0.14em for labels.
- Motion grammar: entrances spring (back.out) like the notch; statements slam (scale 1.25 → 1 with blur clearing, power4.out);
  messages fly as a glowing dot along dashed wires (power2.inOut); the receiver pops and rings. Cuts are hard, on the bar.
- Rhythm: reveals land on beats; nothing holds still for more than a beat (wires march, stacks scroll, slow pushes).
- Negative list: no stock imagery, no gradients beyond the app's own, nothing below y 900.

## Frame 1 — Group chat

- scene: A chat thread fills up on the beat with messages between agents; on the drop it falls back and "your agents can talk now." slams over it
- voiceover: ""
- duration: 3.75s
- transition_in: cut
- status: animated
- src: compositions/frames/01-group-chat.html
- type: hook
- beat: curiosity
- blueprint: kinetic-type-beats (Adapt)
- asset_candidates: assets/logo-claude.svg — Claude glyph; assets/logo-opencode.svg — OpenCode glyph; assets/logo-agy.svg — Antigravity glyph
- focal: the thread, then the statement
- sfx: message blip ×5

Scene 1 (0.0–1.875s): black, faint violet glow. Bubbles pop in on each beat (0, .47, .94, 1.41), sender tiles with who-badges;
the stack scrolls up as each lands. bob/claude: "Starting on checkout. I'll call the orders API." · kurian/opencode (mine):
"Heads up: /cart/checkout is now POST /orders." · alice/agy: "Webhooks are signed now. Add X-Signature to tests." ·
bob/claude: "Got it. Switching to /orders."
Scene 2 (1.875–3.75s): the drop. The thread recedes (scale .92, blur, 28%); "your agents" slams centre (1.875), "can talk now."
in purple on the next beat (2.34); a fifth bubble lands behind at 2.81; the statement pushes in slowly to the cut.

## Frame 2 — Any agent

- scene: Five agent tiles spring into a ring; message dots fly between them along dashed wires, each receiver pops; then a star burst
- voiceover: ""
- duration: 3.75s
- transition_in: cut
- status: animated
- src: compositions/frames/02-any-agent.html
- type: key_feature
- beat: breadth
- blueprint: constellation-hub (Adapt)
- asset_candidates: assets/logo-claude.svg; assets/logo-copilot.svg; assets/logo-opencode.svg; assets/logo-kilo.svg; assets/logo-agy.svg
- focal: the ring of agents
- sfx: pop, blips on arrivals, ding cascade on the burst

Scene 1 (0.0–0.47s): Claude Code, Copilot, OpenCode, Kilo, Antigravity tiles spring into a pentagon (stagger .06) with mono
labels; a full mesh of dashed wires fades in and keeps marching.
Scene 2 (0.47–2.81s): one flight per beat: Claude → Copilot → Antigravity → OpenCode → Kilo → Claude; each arrival pops and
rings the receiver. Caption, bottom: "any agent." (.47), "any provider." in purple (1.41).
Scene 3 (2.81–3.75s): five dots at once along the star (2.81), five more along the ring (3.28).

## Frame 3 — Any PC

- scene: Two PCs swing in from opposite sides like an opening book; a message leaves one notch, goes up through the repo's remote and down into the other, which opens the message
- voiceover: ""
- duration: 3.75s
- transition_in: cut
- status: animated
- src: compositions/frames/03-any-pc.html
- type: key_feature
- beat: reach
- blueprint: comparison-split (Adapt)
- asset_candidates: assets/logo-claude.svg; assets/logo-opencode.svg
- focal: the message crossing between the two notches
- sfx: whoosh on entry, tap on push, blip on arrival

Scene 1 (0.0–0.47s): "KURIAN · DESKTOP" from the left and "BOB · LAPTOP" from the right, mirrored rotateY tilts landing at ±8°;
the remote node "ORIGIN" pops top centre; dashed arcs draw to it.
Scene 2 (0.47–2.06s): a bubble rises under the left notch: "Pushed the orders API. Pull when ready." (mine). At .94 a dot leaves
the left notch, the "GIT PUSH" badge pops on the left card's inner edge, the dot arcs up to ORIGIN (pulse at 1.5), then
"GIT FETCH" pops on the right card and the dot arcs down. Caption: "across PCs." (.47).
Scene 3 (2.06–3.75s): the right notch springs open into the message card (relay: kurian/claude → bob/claude); caption completes
"nothing to host." in purple (2.06); slow push to the cut.

## Frame 4 — Right in your notch

- scene: On the desktop, the real notch pill turns into a message card with the dot flying from bob/claude to kurian/opencode, then opens into the team view with teammates and the thread
- voiceover: ""
- duration: 3.75s
- transition_in: cut
- status: animated
- src: compositions/frames/04-in-the-notch.html
- type: product_intro
- beat: proof
- blueprint: cursor-ui-demo (Adapt, cursorless)
- asset_candidates: assets/logo-claude.svg; assets/logo-opencode.svg; assets/logo-agy.svg
- focal: the notch
- sfx: blip on arrival, pop on open, blips as replies land

Scene 1 (0.0–1.875s): the notch at 2.4× on the desktop: "2 working" with the comet rim. At .23 it springs into the team card:
bob/claude → kurian/opencode · shop · "Does /orders paginate?"; the dot flies the wire three times, the receiver pops.
Caption, lower left: "right in" (.47), "your notch." in purple (.94).
Scene 2 (1.875–3.75s): the card opens into the panel's team view (scale eases to 1.8×): shop · 2 agents · 2 teammates, the
roster (kurian/claude, kurian/opencode, bob/claude, alice/agy), and the thread rising: "Does /orders paginate?",
"Cursor-based: ?after=<id>&limit=50." (mine, 2.55), "Webhook tests are green." (3.0).

## Frame 5 — Team messages

- scene: In the music's break the five agents are pulled into the notch, which charges into a glowing dot; on the drop it bursts into the lockup
- voiceover: ""
- duration: 5.625s
- transition_in: cut
- status: animated
- src: compositions/frames/05-lockup.html
- type: cta
- beat: payoff
- blueprint: logo-assemble-lockup (Adapt)
- asset_candidates: assets/logo-claude.svg; assets/logo-copilot.svg; assets/logo-opencode.svg; assets/logo-kilo.svg; assets/logo-agy.svg
- focal: "team messages"
- sfx: whoosh as the agents are pulled in, final hit on the drop

Scene 1 (0.0–1.875s): black; the five tiles around the notch pill (purple rim). From .5 they're pulled in one by one
(power3.in), each arrival bumps the pill; at 1.6 the pill collapses into a bright dot.
Scene 2 (1.875–5.625s): on the drop the dot bursts (ring + flash): the team icon pops, "team messages" slams (1.95),
"NEW IN AGENT NOTCH" (2.15), "any agent · any PC · one repo" (2.6), the five agent tiles + "FOR WINDOWS" (3.0); a slow settle push to
the end while the music fades.
