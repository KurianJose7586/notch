---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "All your coding agents. One notch."
destination: x-feed
aspect: 1920x1080
language: en
audience: "Developers who run several AI coding agents (Claude Code, Antigravity, OpenCode, Kilo, Copilot) at once"
length: 45s
angle: chaos-to-order
---

## Intent

A launch promo for Agent Notch, a Dynamic-Island-style notch for Windows that tracks and manages coding agents.
Fun and chaotic, with the notch as the premium, shiny thing that brings order. Act 1 is loud chaos: terminals
multiplying, permission prompts piling up, "needs you" everywhere, a usage limit hitting mid-task. Everything freezes,
a glossy black notch drops from the top with a light glint, and Act 2 is calm Apple-like order: five feature beats,
then the goodbye animation and an end card.

## Assets

- ../../build/icon.png — the app icon; end card.
- ../../index.html — the real notch UI (CSS, agent glyph SVGs, colors); rebuild the notch from it so it matches the app.

## Customizations

- Music + SFX, no voiceover; on-screen text carries the words. Chaotic track that drops into a clean beat at the reveal.
- Five feature beats: grouped by project; "needs you" peek + one-key approve; agy auto-Enter; grid tiling; usage-limits bar.
- Tagline: "All your coding agents. One notch."
- Generated chaos shots via Higgsfield were requested, but the connector isn't available in this session, so Act 1 is
  built as HTML motion graphics instead.

## Notes

- End card: icon, "Agent Notch", tagline. No link yet.
- Agent logos (Claude, Antigravity, OpenCode, Kilo, Copilot) appear as they do in the app.
- The notch must be the only perfectly crisp, polished thing on screen during the chaos-to-order turn.
