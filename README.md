<div align="center">

<img src="images/peon.png" width="280" alt="WC3 Orc Peon" />

# claude-code-sounds

**Sound themes for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) lifecycle hooks.**

Plays sound effects when sessions start, prompts are submitted, responses finish, errors occur, and more.

Ships with a **WC3 Orc Peon** theme. Bring your own sounds or create new themes.

*"Something need doing?"*

</div>

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

## WC3 Orc Peon Theme

55 sounds from Warcraft 3 Orc units mapped across 11 Claude Code lifecycle events.

> After installing, preview all sounds with `./preview.sh` or a specific category with `./preview.sh start`

<details open>
<summary><b>start</b> — Session starting, being summoned (5 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `ready-to-work.wav` | *"Ready to work!"* | Peon |
| `something-need-doing.wav` | *"Something need doing?"* | Peon |
| `more-work.mp3` | *"More work?"* | Peon (WC2) |
| `how-can-i-help.wav` | *"How can I help?"* | Shaman |
| `someone-call-for-the-doctor.wav` | *"Someone call for the doctor?"* | Witch Doctor |

</details>

<details>
<summary><b>prompt</b> — User submitted a prompt, acknowledging order (7 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `yes.wav` | *"Yes"* | Peon |
| `dabu.wav` | *"Dabu"* | Grunt |
| `zug-zug.wav` | *"Zug zug"* | Grunt |
| `right-away.wav` | *"Right away"* | Shaman |
| `immediately.wav` | *"Immediately!"* | Tauren |
| `anything-you-want.wav` | *"Anything you want"* | Headhunter |
| `more-work.mp3` | *"More work?"* | Peon (WC2) |

</details>

<details>
<summary><b>stop</b> — Claude finished responding (8 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `zug-zug.wav` | *"Zug zug"* | Peon |
| `ok.wav` | *"OK"* | Peon |
| `i-can-do-that.wav` | *"I can do that"* | Peon |
| `be-happy-to.wav` | *"Be happy to"* | Peon |
| `understood.wav` | *"Understood"* | Shaman |
| `of-course.wav` | *"Of course"* | Far Seer |
| `it-is-certain.wav` | *"It is certain"* | Far Seer |
| `whatever-you-say.wav` | *"Whatever you say"* | Grom Hellscream |

</details>

<details>
<summary><b>permission</b> — Permission prompt, waiting for approval (5 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `hmmm.wav` | *"Hmmm?"* | Peon |
| `what-you-want.wav` | *"What you want?"* | Peon |
| `what-you-want-me-to-do.wav` | *"What you want me to do?"* | Headhunter |
| `who-you-want-me-kill.wav` | *"Who you want me kill?"* | Headhunter |
| `you-seek-me-help.wav` | *"You seek me help?"* | Witch Doctor |

</details>

<details>
<summary><b>subagent</b> — Spawning a subagent (6 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `work-work.wav` | *"Work, work"* | Peon |
| `zug-zug.wav` | *"Zug zug"* | Peon |
| `ill-try.wav` | *"I'll try"* | Peon |
| `why-not.wav` | *"Why not?"* | Peon |
| `for-the-horde.wav` | *"For the Horde!"* | Grunt |
| `taste-the-fury.wav` | *"Taste the fury of the Warsong!"* | Grom Hellscream |

</details>

<details>
<summary><b>idle</b> — Waiting for user input (7 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `me-busy-leave-me-alone.wav` | *"Me busy, leave me alone!"* | Peon |
| `no-time-for-play.wav` | *"No time for play!"* | Peon |
| `me-not-that-kind-of-orc.wav` | *"Me not that kind of orc!"* | Peon |
| `why-you-poking-me.wav` | *"Why are you poking me again?"* | Grunt |
| `not-easy-being-green.wav` | *"It's not easy being green"* | Grunt |
| `i-can-wait-no-longer.wav` | *"I can wait no longer!"* | Grom Hellscream |
| `outlook-not-so-good.wav` | *"Outlook... not so good"* | Far Seer |

</details>

<details>
<summary><b>error</b> — Tool call failed (4 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `peon-death.wav` | *(death sound)* | Peon |
| `grunt-death.wav` | *(death sound)* | Grunt |
| `headhunter-death.wav` | *(death sound)* | Headhunter |
| `reply-hazy-try-again.wav` | *"Reply hazy, try again"* | Far Seer |

</details>

<details>
<summary><b>end</b> — Session ending (3 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `well-done.wav` | *"Well done!"* | Tauren |
| `finally.wav` | *"Finally!"* | Grom Hellscream |
| `okie-dokie.wav` | *"Okie dokie"* | Peon |

</details>

<details>
<summary><b>task-completed</b> — Task marked done (2 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `well-done.wav` | *"Well done!"* | Tauren |
| `finally.wav` | *"Finally!"* | Grom Hellscream |

</details>

<details>
<summary><b>compact</b> — Context compaction, memory fading (4 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `concentrate-and-ask-again.wav` | *"Concentrate... and ask again"* | Far Seer |
| `reply-hazy-try-again.wav` | *"Reply hazy, try again"* | Far Seer |
| `i-can-wait-no-longer.wav` | *"I can wait no longer!"* | Grom Hellscream |
| `death.wav` | *(death sound)* | Peon |

</details>

<details>
<summary><b>teammate-idle</b> — Teammate went idle (4 sounds)</summary>

| Sound | Quote | Unit |
|---|---|---|
| `what.wav` | *"What?!"* | Peon |
| `me-busy-leave-me-alone.wav` | *"Me busy, leave me alone!"* | Peon |
| `no-time-for-play.wav` | *"No time for play!"* | Peon |
| `i-can-wait-no-longer.wav` | *"I can wait no longer!"* | Grom Hellscream |

</details>

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
