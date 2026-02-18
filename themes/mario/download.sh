#!/bin/bash
#
# Downloads sound files for the mario theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
MARIO_DIR="$TMP_DIR/Mario"

mkdir -p "$MARIO_DIR/smb" "$MARIO_DIR/sm64" "$MARIO_DIR/smw" "$MARIO_DIR/smb3"

BASE="https://themushroomkingdom.net/sounds/wav"

# --- Super Mario Bros. (NES) ---
SMB_FILES=(
  smb_1-up.wav
  smb_breakblock.wav
  smb_bump.wav
  smb_coin.wav
  smb_fireball.wav
  smb_flagpole.wav
  smb_gameover.wav
  smb_mariodie.wav
  smb_pause.wav
  smb_pipe.wav
  smb_powerup.wav
  smb_powerup_appears.wav
  smb_stage_clear.wav
  smb_stomp.wav
  smb_vine.wav
  smb_world_clear.wav
)

# --- Super Mario 64 (N64) ---
SM64_FILES=(
  sm64_mario_burned.wav
  sm64_mario_doh.wav
  sm64_mario_haha.wav
  sm64_mario_hello.wav
  sm64_mario_here_we_go.wav
  sm64_mario_hurt.wav
  sm64_mario_its_me.wav
  sm64_mario_lets_go.wav
  sm64_mario_mamma-mia.wav
  sm64_mario_okey-dokey.wav
  sm64_mario_oof.wav
  sm64_mario_snore_part1.wav
  sm64_mario_tired.wav
  sm64_mario_waha.wav
  sm64_mario_whoa.wav
  sm64_mario_yahoo.wav
  sm64_mario_yawn.wav
  sm64_mario_yippee.wav
  sm64_happy_message.wav
  sm64_star_appears.wav
  sm64_warp.wav
)

# --- Super Mario World (SNES) ---
SMW_FILES=(
  smw_1-up.wav
  smw_message_block.wav
  smw_pipe.wav
  smw_power-up.wav
)

# --- Super Mario Bros. 3 (NES) ---
SMB3_FILES=(
  smb3_level_clear.wav
  smb3_lost_suit.wav
  smb3_power-up.wav
  smb3_raccoon_transform.wav
  smb3_whistle.wav
)

echo "  Downloading Super Mario sounds..."

FAILED=0

for FILE in "${SMB_FILES[@]}"; do
  curl -sL -o "$MARIO_DIR/smb/$FILE" "$BASE/smb/$FILE"
  if ! file "$MARIO_DIR/smb/$FILE" | grep -q "WAVE\|RIFF"; then
    echo "    Warning: Failed to download smb/$FILE"
    rm -f "$MARIO_DIR/smb/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

for FILE in "${SM64_FILES[@]}"; do
  curl -sL -o "$MARIO_DIR/sm64/$FILE" "$BASE/sm64/$FILE"
  if ! file "$MARIO_DIR/sm64/$FILE" | grep -q "WAVE\|RIFF"; then
    echo "    Warning: Failed to download sm64/$FILE"
    rm -f "$MARIO_DIR/sm64/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

for FILE in "${SMW_FILES[@]}"; do
  curl -sL -o "$MARIO_DIR/smw/$FILE" "$BASE/smw/$FILE"
  if ! file "$MARIO_DIR/smw/$FILE" | grep -q "WAVE\|RIFF"; then
    echo "    Warning: Failed to download smw/$FILE"
    rm -f "$MARIO_DIR/smw/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

for FILE in "${SMB3_FILES[@]}"; do
  curl -sL -o "$MARIO_DIR/smb3/$FILE" "$BASE/smb3/$FILE"
  if ! file "$MARIO_DIR/smb3/$FILE" | grep -q "WAVE\|RIFF"; then
    echo "    Warning: Failed to download smb3/$FILE"
    rm -f "$MARIO_DIR/smb3/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo "  Warning: $FAILED file(s) failed to download."
fi

echo "  Download complete."
