#!/bin/bash
#
# Downloads sound files for the mgs (Metal Gear Solid) theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
MGS_DIR="$TMP_DIR/MGS"

mkdir -p "$MGS_DIR"

BASE_URL="https://www.myinstants.com/media/sounds"

# All unique sound files needed by this theme
FILES=(
  codec.mp3
  metalgearcodec.mp3
  mgs2-snake-kept-you-waiting-huh.mp3
  codec-send.mp3
  metal_gear_solid_exit_sound_effect.mp3
  metal_gear_solid_exit_sound_effect_EQbXTbY.mp3
  mgs2-snake-sweet-dreams-boyscout.mp3
  sfx_s_mission_qualify.mp3
  mgs2-snake-roger-that-sir.mp3
  mgs2-snake-sounds-like-a-plan.mp3
  mgs2-snake-ill-do-my-best.mp3
  mgs2-snake-if-you-say-so.mp3
  mgs2-snake-good-shooting.mp3
  tindeck_1.mp3
  metal-gear-alert-sound-effect_XKoHReZ.mp3
  what-was-that-noise.mp3
  untitled_1150.mp3
  why_are_we_still_here_just_to_suffer_2.mp3
  cigar.mp3
  metalgeargameov5235.mp3
  metal-gear-solid-solid-snake-scream.mp3
  snake-dies-game-over.mp3
  metal_gear_solid_game_over_screen_clean_background-1.mp3
  mgs2-snake-what-the-hell-is-going-on-here.mp3
  youre-pretty-good_I5kzLtx.mp3
  metal-gear-item-drop.mp3
  metalgearsolid.swf.mp3
  original-metal-gear-solid-game-over-screen.mp3
  ocelot-meowing.mp3
  mgs2-snake-friendly-fire.mp3
)

echo "  Downloading Metal Gear Solid sounds..."

FAILED=0
for FILE in "${FILES[@]}"; do
  if ! curl -sL -o "$MGS_DIR/$FILE" "$BASE_URL/$FILE"; then
    echo "    Warning: Failed to download $FILE"
    rm -f "$MGS_DIR/$FILE"
    FAILED=$((FAILED + 1))
    continue
  fi

  # Verify we got a valid audio file (not an HTML error page)
  if file "$MGS_DIR/$FILE" | grep -q "HTML"; then
    echo "    Warning: $FILE returned HTML instead of audio"
    rm -f "$MGS_DIR/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo "  Warning: $FAILED file(s) failed to download."
fi

echo "  Download complete."
