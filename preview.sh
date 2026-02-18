#!/bin/bash
#
# Preview all installed sounds grouped by hook event.
# Usage: ./preview.sh [category]
#
set -e

SOUNDS_DIR="$HOME/.claude/sounds"
CATEGORY="${1:-}"

if [ ! -d "$SOUNDS_DIR" ]; then
  echo "No sounds installed. Run ./install.sh first."
  exit 1
fi

play_category() {
  local dir="$1"
  local name=$(basename "$dir")
  local files=()

  for f in "$dir"/*.wav "$dir"/*.mp3; do
    [ -f "$f" ] && files+=("$f")
  done

  [ ${#files[@]} -eq 0 ] && return

  echo ""
  echo "  $name (${#files[@]} sounds)"
  echo "  $(printf '─%.0s' $(seq 1 40))"

  for f in "${files[@]}"; do
    label=$(basename "$f" | sed 's/\.\(wav\|mp3\)$//')
    printf "    %-35s" "$label"
    afplay "$f" 2>/dev/null
    echo " ✓"
    sleep 0.2
  done
}

echo ""
echo "  claude-code-sounds preview"
echo "  ════════════════════════════"

if [ -n "$CATEGORY" ]; then
  if [ -d "$SOUNDS_DIR/$CATEGORY" ]; then
    play_category "$SOUNDS_DIR/$CATEGORY"
  else
    echo "  Category '$CATEGORY' not found."
    echo "  Available: $(ls "$SOUNDS_DIR" | paste -sd ', ' -)"
    exit 1
  fi
else
  for dir in "$SOUNDS_DIR"/*/; do
    [ -d "$dir" ] && play_category "$dir"
  done
fi

echo ""
echo "  Done!"
echo ""
