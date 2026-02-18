#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
SOUNDS_DIR="$CLAUDE_DIR/sounds"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"
THEME="${1:-wc3-peon}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: ./install.sh [theme|--list|--uninstall|--help]"
  echo ""
  echo "Commands:"
  echo "  ./install.sh              Install the default theme (wc3-peon)"
  echo "  ./install.sh <theme>      Install a specific theme"
  echo "  ./install.sh --list       List available themes"
  echo "  ./install.sh --uninstall  Remove all sounds and hooks"
  echo "  ./install.sh --help       Show this help"
}

list_themes() {
  echo "Available themes:"
  echo ""
  for theme_dir in "$SCRIPT_DIR/themes"/*/; do
    [ -f "$theme_dir/theme.json" ] || continue
    name=$(basename "$theme_dir")
    desc=""
    if command -v jq &>/dev/null; then
      desc=$(jq -r '.description // ""' "$theme_dir/theme.json")
    fi
    if [ -n "$desc" ]; then
      echo "  $name — $desc"
    else
      echo "  $name"
    fi
  done
}

uninstall() {
  echo "Uninstalling claude-code-sounds..."
  rm -rf "$SOUNDS_DIR"
  rm -f "$HOOKS_DIR/play-sound.sh"
  if [ -f "$SETTINGS" ] && command -v jq &>/dev/null; then
    jq 'del(.hooks)' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
    echo "  Removed hooks from settings.json"
  fi
  echo "  Done. All sounds removed."
  exit 0
}

# ─── Args ─────────────────────────────────────────────────────────────────────

case "$THEME" in
  --help|-h)    usage; exit 0 ;;
  --list|-l)    list_themes; exit 0 ;;
  --uninstall)  uninstall ;;
esac

# ─── Preflight ────────────────────────────────────────────────────────────────

if ! command -v afplay &>/dev/null; then
  echo "Error: afplay not found. This tool requires macOS."
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq"
  exit 1
fi

THEME_DIR="$SCRIPT_DIR/themes/$THEME"
if [ ! -f "$THEME_DIR/theme.json" ]; then
  echo "Error: Theme '$THEME' not found."
  echo ""
  list_themes
  exit 1
fi

THEME_NAME=$(jq -r '.name' "$THEME_DIR/theme.json")

echo ""
echo "  claude-code-sounds"
echo "  ─────────────────────────"
echo "  Theme: $THEME_NAME"
echo ""

# ─── Create directories ──────────────────────────────────────────────────────

echo "[1/4] Creating directories..."
CATEGORIES=$(jq -r '.sounds | keys[]' "$THEME_DIR/theme.json")
for cat in $CATEGORIES; do
  mkdir -p "$SOUNDS_DIR/$cat"
done
mkdir -p "$HOOKS_DIR"

# ─── Download sounds ─────────────────────────────────────────────────────────

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "[2/4] Downloading sounds..."
if [ -f "$THEME_DIR/download.sh" ]; then
  bash "$THEME_DIR/download.sh" "$SOUNDS_DIR" "$TMP_DIR"
else
  echo "  No download script found — skipping."
fi

# ─── Sort sounds into categories ─────────────────────────────────────────────

echo "[3/4] Sorting sounds..."

# Clear existing sounds
for cat in $CATEGORIES; do
  rm -f "$SOUNDS_DIR/$cat"/*.wav "$SOUNDS_DIR/$cat"/*.mp3 2>/dev/null
done

# Read theme.json and copy files
SRC="$TMP_DIR/Orc"
jq -r '.sounds | to_entries[] | .key as $cat | .value.files[] | "\($cat)\t\(.src)\t\(.name)"' "$THEME_DIR/theme.json" | \
while IFS=$'\t' read -r category src name; do
  # Handle special sources
  case "$src" in
    @soundfxcenter/*)
      src_file="$TMP_DIR/Orc/$(basename "$src")"
      ;;
    *)
      src_file="$SRC/$src"
      ;;
  esac

  if [ -f "$src_file" ]; then
    cp "$src_file" "$SOUNDS_DIR/$category/$name"
  else
    echo "  Warning: $src not found, skipping"
  fi
done

# ─── Install hooks ───────────────────────────────────────────────────────────

echo "[4/4] Installing hooks..."

# Copy the play-sound script
cp "$SCRIPT_DIR/hooks/play-sound.sh" "$HOOKS_DIR/play-sound.sh"
chmod +x "$HOOKS_DIR/play-sound.sh"

# Build hooks config from the categories in the theme
HOOKS_JSON=$(cat << 'HOOKS'
{
  "SessionStart": [{"matcher":"startup","hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" start","timeout":5}]}],
  "SessionEnd": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" end","timeout":5}]}],
  "Notification": [
    {"matcher":"permission_prompt","hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" permission","timeout":5}]},
    {"matcher":"idle_prompt","hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" idle","timeout":5}]}
  ],
  "Stop": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" stop","timeout":5}]}],
  "SubagentStart": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" subagent","timeout":5}]}],
  "PostToolUseFailure": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" error","timeout":5}]}],
  "UserPromptSubmit": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" prompt","timeout":5}]}],
  "TaskCompleted": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" task-completed","timeout":5}]}],
  "PreCompact": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" compact","timeout":5}]}],
  "TeammateIdle": [{"hooks":[{"type":"command","command":"/bin/bash \"$HOME/.claude/hooks/play-sound.sh\" teammate-idle","timeout":5}]}]
}
HOOKS
)

if [ -f "$SETTINGS" ]; then
  jq --argjson hooks "$HOOKS_JSON" '.hooks = $hooks' "$SETTINGS" > "$SETTINGS.tmp"
  mv "$SETTINGS.tmp" "$SETTINGS"
else
  mkdir -p "$CLAUDE_DIR"
  echo "{}" | jq --argjson hooks "$HOOKS_JSON" '.hooks = $hooks' > "$SETTINGS"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "  Installed! Here's what you'll hear:"
echo "  ─────────────────────────────────────"

jq -r '.sounds | to_entries[] | "  \(.key) (\(.value.files | length)) — \(.value.description)"' "$THEME_DIR/theme.json"

TOTAL=$(find "$SOUNDS_DIR" -type f \( -name '*.wav' -o -name '*.mp3' \) | wc -l | xargs)
echo ""
echo "  $TOTAL sound files across $(echo "$CATEGORIES" | wc -w | xargs) events."
echo "  Start a new Claude Code session to hear it!"
echo ""
echo "  Zug zug."
echo ""
