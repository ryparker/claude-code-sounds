#!/bin/bash
#
# Downloads sound files for the star-wars theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
SW_DIR="$TMP_DIR/StarWars"

mkdir -p "$SW_DIR/empire" "$SW_DIR/return"

BASE_URL="https://www.thesoundarchive.com/starwars"
WAVSOURCE_URL="https://www.wavsource.com/snds_2020-10-01_3728627494378403/movies/star_wars"

# ── thesoundarchive.com — root-level files ──────────────────────────
ROOT_FILES=(
  light-saber-on.wav
  light-saber-off.wav
  light-saber-battle.wav
  blaster-firing.wav
  set-for-stun.wav
  force.wav
  forcestrong.wav
  forceisstrong.wav
  disturbence.wav
  chewy_roar.wav
  Chewie-chatting.wav
  R2D2.wav
  R2D2-do.wav
  R2D2-hey-you.wav
  R2D2-yeah.wav
  swvader01.wav
  swvader02.wav
  swvader03.wav
  swvader04.wav
  WilhelmScream.wav
  alwaystwo.wav
  Muchfear.wav
  Revenge.wav
  wipthemout.wav
  obiwan_chosenone.wav
  emp_lordvaderrise.wav
  dange-disturb.wav
  yoda_twisted.wav
  rescue.wav
  swluke01.wav
  fool.wav
)

echo "  Downloading Star Wars sounds from thesoundarchive.com..."

FAILED=0
for FILE in "${ROOT_FILES[@]}"; do
  curl -sL -o "$SW_DIR/$FILE" "$BASE_URL/$FILE"
  if [ ! -s "$SW_DIR/$FILE" ]; then
    echo "    Warning: Failed to download $FILE"
    rm -f "$SW_DIR/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

# ── thesoundarchive.com — subdirectory files ────────────────────────
EMPIRE_FILES=(
  yodalaughing.wav
)

for FILE in "${EMPIRE_FILES[@]}"; do
  curl -sL -o "$SW_DIR/empire/$FILE" "$BASE_URL/empire/$FILE"
  if [ ! -s "$SW_DIR/empire/$FILE" ]; then
    echo "    Warning: Failed to download empire/$FILE"
    rm -f "$SW_DIR/empire/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

RETURN_FILES=(
  jabba-the-hutt-laughing.wav
  900yearsold.wav
)

for FILE in "${RETURN_FILES[@]}"; do
  curl -sL -o "$SW_DIR/return/$FILE" "$BASE_URL/return/$FILE"
  if [ ! -s "$SW_DIR/return/$FILE" ]; then
    echo "    Warning: Failed to download return/$FILE"
    rm -f "$SW_DIR/return/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

# ── wavsource.com — supplemental clips ──────────────────────────────
echo "  Downloading supplemental clips from wavsource.com..."

WAVSOURCE_FILES=(
  bad_feeling.wav
  trap.wav
  your_father.wav
  do_or_do_not.wav
  dark_side.wav
  destroy_you.wav
  destiny.wav
)

for FILE in "${WAVSOURCE_FILES[@]}"; do
  curl -sL -o "$SW_DIR/$FILE" "$WAVSOURCE_URL/$FILE"
  if [ ! -s "$SW_DIR/$FILE" ]; then
    echo "    Warning: Failed to download $FILE from wavsource"
    rm -f "$SW_DIR/$FILE"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo "  Warning: $FAILED file(s) failed to download."
fi

echo "  Download complete."
