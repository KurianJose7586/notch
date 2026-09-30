# Asset inventory (no website; assets captured from the app itself)

- agent-notch-icon.png — app icon: black notch pill with agent-colour dots and a blue/violet rim, 256px. End card, reveal.
- notch-pill-working.png — the real collapsed notch pill: stacked agent dots + "4 working", black glass. 440x90 at 1x. Reference for the rebuilt pill.
- notch-pill-needs-you.png — collapsed pill in attention state: "OpenCode needs you · web-app" in orange, orange glow. 440x90. Needs-you beat.
- notch-toast-limits.png — limits heads-up toast in the notch: Claude glyph, "Claude at 82% of your 5-hour limit", "Resets Wed 11:06 PM". 440x90. Limits beat.
- notch-panel-open.png — the expanded panel: header "Agents · 1 need you · 3 working · 1 done", info/+/grid buttons, Claude limits card (5-hour 82% orange bar, weekly 41% blue), project groups web-app (OpenCode needs you, Kilo done), payments-api (Claude working with 3 of 7 progress bar, Antigravity working with AUTO on), docs (Copilot · VS Code tag, working), footer actions. 560x820 at 1x. Order act hero; grouped-by-project beat.
- logo-claude.svg — Claude starburst glyph (orange #D97757 on a cream tile in the app).
- logo-agy.svg — Antigravity arch glyph (yellow-green-blue gradient).
- logo-opencode.svg — OpenCode glyph (light on dark).
- logo-kilo.svg — Kilo "K1 L0" square glyph (yellow #F8F675).
- logo-copilot.svg — Copilot glyph (white on violet gradient tile).

Design source of truth for rebuilding the UI in HTML: ../../../../index.html (CSS variables at the top: black glass, --blue #0A84FF, --green #30D158, --orange #FF9F0A, --red #FF453A, --purple #BF5AF2; Segoe UI Variable; spring easing linear(...)).
