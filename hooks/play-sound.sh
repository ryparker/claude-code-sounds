#!/bin/bash
SOUNDS_DIR="$HOME/.claude/sounds"
CATEGORY="${1:-}"

# Drain stdin so the hook system doesn't get a broken pipe
cat > /dev/null 2>&1

[[ -f "$SOUNDS_DIR/.muted" ]] && exit 0
[[ -z "$CATEGORY" ]] && exit 0
DIR="$SOUNDS_DIR/$CATEGORY"
[[ ! -d "$DIR" ]] && exit 0

# Collect all .wav and .mp3 files
FILES=()
for f in "$DIR"/*.wav "$DIR"/*.mp3; do
  [[ -f "$f" ]] && FILES+=("$f")
done
[[ ${#FILES[@]} -eq 0 ]] && exit 0

# Pick a random file and play it fully detached from this process group
# so Claude Code doesn't wait for playback to finish
RANDOM_FILE="${FILES[$RANDOM % ${#FILES[@]}]}"
(afplay "$RANDOM_FILE" &>/dev/null &)

exit 0
