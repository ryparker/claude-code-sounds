# claude-code-sounds

Sound themes for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) lifecycle hooks. Plays sound effects when sessions start, prompts are submitted, responses finish, errors occur, and more.

Ships with a **WC3 Orc Peon** theme. Bring your own sounds or create new themes.

## Quick Start

```bash
git clone https://github.com/ryparker/claude-code-sounds.git
cd claude-code-sounds
./install.sh
```

Requires macOS (uses `afplay`) and `jq` (`brew install jq`).

## Usage

```bash
./install.sh              # Install default theme (wc3-peon)
./install.sh <theme>      # Install a specific theme
./install.sh --list       # List available themes
./install.sh --uninstall  # Remove all sounds and hooks
```

## Hook Events

| Event | Hook | When |
|---|---|---|
| `start` | `SessionStart` | Session begins |
| `end` | `SessionEnd` | Session ends |
| `prompt` | `UserPromptSubmit` | You submit a prompt |
| `stop` | `Stop` | Claude finishes responding |
| `permission` | `Notification` | Permission prompt appears |
| `idle` | `Notification` | Waiting for your input |
| `subagent` | `SubagentStart` | Subagent spawned |
| `error` | `PostToolUseFailure` | Tool call failed |
| `task-completed` | `TaskCompleted` | Task marked done |
| `compact` | `PreCompact` | Context compaction |
| `teammate-idle` | `TeammateIdle` | Teammate went idle |

## Creating a Theme

Themes live in `themes/<name>/` with two files:

### `theme.json`

Defines metadata and maps source files to hook categories:

```json
{
  "name": "My Theme",
  "description": "A short description",
  "sounds": {
    "start": {
      "description": "Session starting",
      "files": [
        { "src": "path/to/file.wav", "name": "descriptive-name.wav" }
      ]
    }
  }
}
```

### `download.sh`

Downloads the sound files. Receives two arguments:
- `$1` — target sounds directory (`~/.claude/sounds`)
- `$2` — temp directory for downloads

The script should download and extract files so they're accessible at `$2/Orc/<src path>` (matching the `src` values in `theme.json`).

## How It Works

A single script (`~/.claude/hooks/play-sound.sh`) handles all events. It takes a category name as an argument, picks a random `.wav` or `.mp3` from `~/.claude/sounds/<category>/`, and plays it with `afplay`.

Hooks are configured in `~/.claude/settings.json` — each Claude Code lifecycle event calls the script with the appropriate category.

## Customizing

Drop any `.wav` or `.mp3` into the sound directories to add your own clips:

```
~/.claude/sounds/
├── start/        # add files here for session start
├── stop/         # add files here for response complete
├── error/        # add files here for failures
└── ...
```

The script picks randomly from whatever files are in each directory.

## Uninstalling

```bash
./install.sh --uninstall
```

This removes all sound files, the hook script, and the hooks config from `settings.json`.

## Disclaimer

Sound files are downloaded from third-party sources at install time and are not included in this repository. All game audio is property of Blizzard Entertainment.
