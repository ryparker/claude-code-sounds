---
name: new-theme
description: Research and create a new sound theme for claude-code-sounds
argument-hint: <theme-name> <description>
---

# Create a New Sound Theme

You are adding a new sound theme to the claude-code-sounds project.

**Theme to create:** $ARGUMENTS

## Step 1: Research Sound Sources

Search the web for freely downloadable sound effects for this theme. Good sources include:
- The Sounds Resource (sounds-resource.com) — game sound rips as zip files
- themushroomkingdom.net, noproblo.dayjo.org — individual file downloads
- GitHub repos with game audio (e.g., sourcesounds)
- Soundboard sites with direct download links

**Verify URLs work** by testing a sample with:
```bash
curl -sL -o /dev/null -w "%{http_code}" <URL>
```

## Step 2: Read Existing Themes for Reference

Read these files to match the exact format:
- `themes/wc3-peon/theme.json` — theme.json structure
- `themes/zelda-oot/download.sh` — individual-file download pattern
- `themes/wc3-peon/download.sh` — zip-based download pattern

## Step 3: Create theme.json

Create `themes/<id>/theme.json` with this structure:

```json
{
  "name": "Display Name",
  "description": "Short description",
  "author": "ryparker",
  "srcBase": "DirectoryName",
  "sounds": { ... }
}
```

### Required categories (all 11 must be present):

| Category | Hook Event | Sound Vibe |
|---|---|---|
| `start` | SessionStart | Welcoming, summoning, hello |
| `end` | SessionEnd | Farewell, completion, goodbye |
| `prompt` | UserPromptSubmit | Acknowledgment, ready, listening |
| `stop` | Stop | Task done, finished |
| `permission` | Notification (permission) | Alert, attention, warning |
| `idle` | Notification (idle) | Waiting, bored, impatient |
| `subagent` | SubagentStart | Summoning helper, reinforcements |
| `error` | PostToolUseFailure | Failure, damage, oops |
| `task-completed` | TaskCompleted | Victory, reward, celebration |
| `compact` | PreCompact | Transformation, transition, compress |
| `teammate-idle` | TeammateIdle | Notification, ping |

Each category needs `description` (string) and `files` (array of `{src, name}`).

**Target: 2-5 sounds per category, 30-50 total.**

## Step 4: Create download.sh

Create `themes/<id>/download.sh`:

```bash
#!/bin/bash
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
```

- Download files into `$2/<srcBase>/`
- Validate downloads (check file type with `file`)
- Track and report failures
- Must pass `shellcheck -S warning`

## Step 5: Validate

Run all checks:

```bash
# JSON valid
node -e "JSON.parse(require('fs').readFileSync('themes/<id>/theme.json'))"

# ShellCheck clean
shellcheck -S warning themes/<id>/download.sh

# Count sounds per category
node -e "
  const d = JSON.parse(require('fs').readFileSync('themes/<id>/theme.json','utf8'));
  const cats = Object.keys(d.sounds);
  console.log(cats.length + ' categories');
  cats.forEach(c => console.log('  ' + c + ': ' + d.sounds[c].files.length + ' sounds'));
  console.log('Total: ' + cats.reduce((s,c) => s + d.sounds[c].files.length, 0));
"

# Verify --list shows the new theme
node bin/cli.js --list
```
