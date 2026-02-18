# Contributing to claude-code-sounds

Thanks for your interest in contributing! This project adds sound themes to Claude Code lifecycle hooks.

> **Note:** Sound playback uses `afplay`, which is macOS-only.

## Adding a New Theme

1. Create a directory under `themes/<your-theme>/`
2. Add a `theme.json` with this structure:

```json
{
  "name": "Display Name",
  "description": "Short description of the theme",
  "author": "your-github-username",
  "sounds": {
    "start": {
      "description": "When this category plays",
      "files": [
        { "name": "descriptive-name.wav" }
      ]
    }
  }
}
```

3. Place audio files in `themes/<your-theme>/sounds/` with filenames matching the `name` field in `theme.json`.

### Required categories

Each theme should provide sounds for these hook events:

| Category | Hook Event | Description |
|---|---|---|
| `start` | SessionStart | Session begins |
| `end` | SessionEnd | Session ends |
| `permission` | Notification | Permission prompt |
| `idle` | Notification | Idle prompt |
| `stop` | Stop | Agent stopped |
| `subagent` | SubagentStart | Subagent spawned |
| `error` | PostToolUseFailure | Tool use failed |
| `prompt` | UserPromptSubmit | User sends prompt |
| `task-completed` | TaskCompleted | Task finished |
| `compact` | PreCompact | Context compaction |
| `teammate-idle` | TeammateIdle | Teammate went idle |

## Testing Locally

```bash
# Check Node syntax
node --check bin/cli.js

# Verify help output
node bin/cli.js --help

# Verify themes are listed
node bin/cli.js --list

# Run the interactive installer
node bin/cli.js --yes

# Preview installed sounds
./preview.sh
```

## ShellCheck

All `.sh` files must pass ShellCheck at warning severity:

```bash
shellcheck -S warning hooks/*.sh install.sh preview.sh
```

## Pull Request Expectations

- ShellCheck passes on all `.sh` files
- `theme.json` validates (valid JSON with required fields)
- `node --check bin/cli.js` passes
- `--help` and `--list` work correctly
- Smoke tests pass

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
