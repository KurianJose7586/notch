# Agent Notch

A Dynamic-Island-style notch for Windows that tracks your coding agents (Claude Code, Antigravity `agy`, OpenCode, Kilo): what each one is doing, which need you, and one-click approve / jump / launch.

## Install

**Installer:** run `Agent Notch Setup.exe`. It installs for your user only (no admin), adds a Start Menu entry, and opens Notch. The first run shows a setup sheet where you pick which agents to connect.

**From source** (needs Node 20+):

```
npm run setup
```

This installs dependencies, connects every agent it finds, and starts Notch.

Requirements: Windows 10/11 with Windows Terminal.

## What "connecting" changes

Each switch in **Setup** adds (or removes) one small hook in that agent's own config. A `.bak` copy of the file is kept the first time:

| Agent | File |
|---|---|
| Claude Code | `~/.claude/settings.json` |
| Antigravity | `~/.gemini/config/hooks.json` |
| OpenCode | `~/.config/opencode/plugins/agent-notch.js` |
| Kilo | `~/.config/kilo/plugins/agent-notch.js` |

Uninstalling removes these hooks before deleting the app. From source: `npm run remove-hooks`.

## Using it

Hover the notch, or press **Ctrl+Alt+N** anywhere. The ⓘ button lists every shortcut.

## Build the installer

```
npm run dist
```

Output: `dist/Agent Notch Setup <version>.exe`. It isn't code-signed, so Windows SmartScreen will warn on first run ("More info" → "Run anyway").
