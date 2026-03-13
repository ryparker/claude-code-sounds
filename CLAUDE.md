# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Validate
node --check bin/cli.js

# Smoke tests
node bin/cli.js --help
node bin/cli.js --list

# Package check
npm pack --dry-run

# Full interactive install (macOS only — requires afplay)
node bin/cli.js --yes

# Formatting
npm run format           # Auto-fix with Prettier
npm run format:check     # Check only (used in CI)

# Tests
npm test

# Optimize audio (requires ffmpeg) — WAV→MP3, loudnorm, silence trim, strip tags
./optimize-audio.sh

# Detect audio watermarks (requires ffmpeg, numpy)
python3 scripts/detect-watermarks.py themes/*/sounds/         # Scan
python3 scripts/detect-watermarks.py --fix themes/*/sounds/   # Scan and trim
```

CI runs on Node 20, 22 and must pass: Prettier formatting, theme.json validation (including sound file existence and optimization check), ShellCheck (warning severity), Node syntax check, smoke tests, and package sanity.

## Architecture

**Sound theme installer for Claude Code lifecycle hooks.** macOS-only (`afplay`). Dependencies: `@clack/core`, `@clack/prompts` (ESM-only, requires Node 20+).

### Two install paths

- **`npx claude-code-sounds`** → `bin/cli.js` — Interactive Node.js TUI with theme selection, per-category sound customization, live preview, and sound borrowing across categories
- **`./install.sh`** → Legacy bash installer (requires `jq`)

### How it works

1. User picks a theme → sounds are copied from `themes/<id>/sounds/` (embedded in the npm package)
2. CLI reads `themes/<id>/theme.json` to map files into 11 hook categories
3. Selected sounds copied to `~/.claude/sounds/<category>/`
4. `hooks/play-sound.sh` copied to `~/.claude/hooks/`
5. Hook config merged into `~/.claude/settings.json` under `.hooks`
6. On each Claude Code event, the hook picks a random sound from the category and plays it via `afplay &`

### Theme structure

```
themes/<id>/
├── theme.json     # name, description, author, sources, sounds (11 categories)
└── sounds/        # .wav and .mp3 files referenced by name in theme.json
```

Each category in `theme.json` has `description` and `files[]` (each with `name` matching a file in `sounds/`). No download scripts — all audio is embedded directly in the repo.

### 11 hook categories

`start`, `end`, `prompt`, `stop`, `permission`, `idle`, `subagent`, `error`, `task-completed`, `compact`, `teammate-idle`

### Key files

- **`bin/cli.js`** (~975 lines) — Main CLI: arg parsing, interactive TUI (raw-mode ANSI menus with vim keys), theme discovery, sound customization with borrowing, hook installation
- **`hooks/play-sound.sh`** — Event handler: drains stdin, collects `.wav`/`.mp3` from category dir, picks random, plays background `afplay`
- **`helpers/mic-active.swift`** — macOS helper that checks if any video call app is actively using the microphone (used by DND feature)
- **`install.sh`** — Bash alternative installer (uses `jq` for JSON)
- **`optimize-audio.sh`** — Production audio pipeline: WAV→MP3 conversion, two-pass loudnorm (-16 LUFS), silence trimming, metadata stripping. Run on all new clips before committing. Supersedes `normalize-audio.sh`.
- **`scripts/detect-watermarks.py`** — Detects and trims audio watermarks using fingerprint matching and auto-clustering. Watermark references stored in `scripts/watermarks/`. Not tracked in git.

### Installation state

- `~/.claude/sounds/.installed.json` — Tracks active themes and file mappings
- `~/.claude/sounds/<category>/` — Active sound files
- `~/.claude/settings.json` — Hook config under `.hooks` key

## Conventions

- Bash scripts use `#!/bin/bash` (some use `set -e`, but `optimize-audio.sh` deliberately avoids it due to ffmpeg error handling)
- All hooks have 5-second timeout and run non-blocking
- `npm pack` only includes `bin/`, `commands/`, `helpers/`, `hooks/`, `themes/`, `images/`
- Publish uses npm Trusted Publishing (OIDC, no token) triggered by GitHub Release with `vX.Y.Z` tag matching `package.json` version
- Theme sound files use descriptive kebab-case names (e.g. `ready-to-work.wav`, `zealot-my-life-for-aiur.wav`)
- `scripts/` and `scripts/watermarks/` are not tracked in git
