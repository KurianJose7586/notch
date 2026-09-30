# Agent Notch

A Dynamic-Island-style notch for Windows that tracks your coding agents (Claude Code CLI and desktop app, Antigravity CLI and IDE, OpenCode, Kilo, VS Code Copilot): what each one is doing, which need you, and one-click approve / jump / launch.

## Install

**Installer:** download `AgentNotch-Setup-<version>.exe` from the [latest release](https://github.com/KurianJose7586/notch/releases/latest) and run it. It installs for your user only (no admin), adds a Start Menu entry, and opens Notch. The first run shows a setup sheet where you pick which agents to connect.

The installer isn't code-signed yet, so Windows SmartScreen may say "Windows protected your PC": click **More info → Run anyway**.

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
| VS Code Copilot | `~/.copilot/hooks/agent-notch.json` |

Uninstalling removes these hooks before deleting the app. From source: `npm run remove-hooks`.

## Using it

Hover the notch, or press **Ctrl+Alt+N** anywhere. The ⓘ button lists every shortcut.

## Build the installer

```
npm run dist
```

## Release

Push a version tag and GitHub Actions builds the installer and attaches it to a release for that tag:

```
git tag v0.2.0
git push origin v0.2.0
```

The tag sets the version, so `package.json` doesn't need bumping first.

Output: `dist/Agent Notch Setup <version>.exe`. It isn't code-signed, so Windows SmartScreen will warn on first run ("More info" → "Run anyway").
