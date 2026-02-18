#!/bin/bash
#
# Downloads sound files for the zelda-oot theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
OOT_DIR="$TMP_DIR/OOT"

mkdir -p "$OOT_DIR"

BASE_URL="https://noproblo.dayjo.org/zeldasounds/oot"

# All unique sound files needed by this theme
FILES=(
  OOT_Navi_Hey1.wav
  OOT_Navi_Hello1.wav
  OOT_Navi_Listen1.wav
  OOT_Navi_Look1.wav
  OOT_Navi_WatchOut1.wav
  OOT_GreatFairy_Laugh1.wav
  OOT_Chest_Big.wav
  OOT_Chest_Small.wav
  OOT_MainMenu_Select.wav
  OOT_Dialogue_Next.wav
  OOT_Dialogue_Done_Mono.wav
  OOT_Get_Heart.wav
  OOT_Get_SmallItem1.wav
  OOT_Get_Rupee.wav
  OOT_Secret_Mono.wav
  OOT_Song_Correct_Mono.wav
  OOT_Song_Error.wav
  OOT_PauseMenu_Open_Mono.wav
  OOT_PauseMenu_Close_Mono.wav
  OOT_ZTarget_Enemy.wav
  OOT_Sword_Draw.wav
  OOT_Sword_Spin.wav
  OOT_AdultLink_Attack1.wav
  OOT_AdultLink_StrongAttack1.wav
  OOT_AdultLink_Hurt1.wav
  OOT_Fanfare_SmallItem.wav
  OOT_Error.wav
  OOT_LowHealth.wav
  OOT_Talon_Snore.wav
  OOT_Ganondorf_Heheh.wav
)

echo "  Downloading Zelda: Ocarina of Time sounds..."

FAILED=0
for FILE in "${FILES[@]}"; do
  curl -sL -o "$OOT_DIR/$FILE" "$BASE_URL/$FILE"
  if ! file "$OOT_DIR/$FILE" | grep -q "WAVE\|RIFF"; then
    echo "    Warning: Failed to download $FILE"
    rm -f "$OOT_DIR/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo "  Warning: $FAILED file(s) failed to download."
fi

echo "  Download complete."
