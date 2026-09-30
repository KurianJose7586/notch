# Promo video

Source of the 46s Agent Notch demo, made with [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP rendered to MP4).

| File | What |
|---|---|
| `BRIEF.md`, `STORYBOARD.md` | The brief and the scene-by-scene plan |
| `storyboard.html` | Sketch sheet of every scene |
| `build-frames.cjs` | Generates `compositions/frames/*.html`, one per scene |
| `index.html` | The assembled timeline |
| `audio_meta.json` | Music and sound-effect cues |
| `assets/` | Agent logos, the app icon and stills of the real notch UI |

## Rebuild

```bash
node build-frames.cjs
npx hyperframes check
npx hyperframes render --output renders/video.mp4
```

Not in the repo: the fonts (`assets/fonts/`, Segoe UI Variable and Cascadia Mono from `C:\Windows\Fonts`) and the HeyGen library music and sound effects (`assets/bgm/`, `assets/sfx/`). Copy the two fonts in, and fetch audio with `npx hyperframes auth login` plus the product-launch workflow's audio step, before rendering.
