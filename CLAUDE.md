# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Validate
node --check bin/cli.js
shellcheck -S warning hooks/*.sh install.sh preview.sh themes/*/download.sh

# Smoke tests
node bin/cli.js --help
node bin/cli.js --list

# Package check
npm pack --dry-run

# Full interactive install (macOS only — requires afplay, curl, unzip)
node bin/cli.js --yes

# Preview installed sounds
./preview.sh
```

CI runs on Node 16, 18, 20, 22 and must pass: theme.json validation, ShellCheck (warning severity), Node syntax check, smoke tests, and package sanity.

## Architecture

**Sound theme installer for Claude Code lifecycle hooks.** macOS-only (`afplay`). Zero npm dependencies.

### Two install paths

- **`npx claude-code-sounds`** → `bin/cli.js` — Interactive Node.js TUI with theme selection, per-category sound customization, live preview, and sound borrowing across categories
- **`./install.sh`** → Legacy bash installer (requires `jq`)

### How it works

1. User picks a theme → `themes/<id>/download.sh` fetches audio files into a temp dir
2. CLI reads `themes/<id>/theme.json` to map files into 11 hook categories
3. Selected sounds copied to `~/.claude/sounds/<category>/`
4. `hooks/play-sound.sh` copied to `~/.claude/hooks/`
5. Hook config merged into `~/.claude/settings.json` under `.hooks`
6. On each Claude Code event, the hook picks a random sound from the category and plays it via `afplay &`

### Theme structure

```
themes/<id>/
├── theme.json     # name, description, author, srcBase, sounds (11 categories)
└── download.sh    # $1=sounds_dir, $2=tmp_dir — downloads to $2/<srcBase>/
```

Each category in `theme.json` has `description` and `files[]` (each with `src` and `name`). The `src` path is relative to `$TMP_DIR/<srcBase>/` after download. Special prefix `@soundfxcenter/` maps to supplemental downloads.

### 11 hook categories

`start`, `end`, `prompt`, `stop`, `permission`, `idle`, `subagent`, `error`, `task-completed`, `compact`, `teammate-idle`

### Key files

- **`bin/cli.js`** (~940 lines) — Main CLI: arg parsing, interactive TUI (raw-mode ANSI menus with vim keys), theme discovery, download orchestration, sound customization with borrowing, hook installation
- **`hooks/play-sound.sh`** — Event handler: drains stdin, collects `.wav`/`.mp3` from category dir, picks random, plays background `afplay`
- **`install.sh`** — Bash alternative installer (uses `jq` for JSON)
- **`preview.sh`** — Plays all installed sounds sequentially for testing

### Installation state

- `~/.claude/sounds/.installed.json` — Tracks active theme `{"theme":"wc3-peon"}`
- `~/.claude/sounds/<category>/` — Active sound files
- `~/.claude/sounds/<category>/.disabled/` — Deselected native sounds (for reconfigure)
- `~/.claude/settings.json` — Hook config under `.hooks` key

## Conventions

- All bash scripts use `set -e` and `#!/bin/bash`
- All hooks have 5-second timeout and run non-blocking
- `npm pack` only includes `bin/`, `hooks/`, `themes/`, `images/`
- Publish uses npm Trusted Publishing (OIDC, no token) triggered by GitHub Release with `vX.Y.Z` tag matching `package.json` version
