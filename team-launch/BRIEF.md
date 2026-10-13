---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Your agents can talk to each other now: any agent, any PC, one repo."
destination: website
aspect: 1920x1080
language: en
audience: "Developers who run AI coding agents (Claude Code, Antigravity, OpenCode, Kilo, Copilot), often next to teammates in the same repo"
length: 20s
angle: feature-reveal
style_preset: broadside
---

## Intent

The user asked to "make a video using motion graphics a quick 20-25 second video maybe even shorter, it is a new feature launch video".
The feature is **Team messages** in Agent Notch: agents working in the same git repo, yours and your teammates', any provider,
message each other (`team_send` / `team_check`) and see who is working on what. It travels through the repo's own git remote
(`refs/notch/*`), so there is nothing to host. In the notch, a message flies from the sender's icon to the receiver's, and the
panel shows teammates' agents and the whole thread.

Design-led motion graphics, not a fake screen recording: the notch's own pieces (pill, relay, bubbles, roster, agent tiles) as
graphic elements on a black field, big lowercase kinetic type, cut on the beat.

## Assets

- ../demo/assets/fonts/SegUIVar.ttf, CascadiaMono.ttf — the app's fonts (Segoe UI Variable, Cascadia Mono).
- ../demo/assets/logo-*.svg — agent glyphs as the app draws them; agent-notch-icon.png — app icon for the lockup.
- ../demo/assets/bgm/track.mp3 — the 128 BPM HeyGen library track the demo used; cut here to its last intro bar, the drop, and the break before the second drop.
- ../demo/assets/sfx/*.mp3 — whooshes, pop, final hit from the demo.
- ../index.html — the real notch UI: team CSS (`.relay`, `.wire`, `.bubble`, `.roster`, `.who-badge`), colors and the `blip()` message sound.

## Customizations

- No voiceover. Music + SFX; short kinetic captions carry every word.
- The message sound is the notch's own `blip()` (sine 1567.98 Hz then 2093 Hz, 80 ms apart), synthesized to a file.

## Notes

- Inferred, not asked this run (remembered from the earlier promo and demo): automation, no storyboard review, 1920x1080, English, Broadside preset, no URL on the end card.
- Truths to keep: names look like `kurian/claude`, `bob/api`; a message goes to everyone, one teammate's agents, or one agent;
  messages arrive by themselves; it's off until switched on in Setup → Team messages.
- Must work muted (landing page autoplay): every beat reads from picture + captions.
- No pronouns for the example teammates; no real people's names beyond the placeholder handles.
