#!/bin/bash
#
# Downloads sound files for the wc3-peon theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

SOUNDS_DIR="$1"
TMP_DIR="$2"

echo "  Downloading WC3 Orc sounds..."
ZIP="$TMP_DIR/orc-sounds.zip"
curl -sL -o "$ZIP" "https://sounds.spriters-resource.com/media/assets/422/425494.zip?updated=1755544622"

if ! file "$ZIP" | grep -q "Zip"; then
  echo "  Error: Failed to download WC3 sound pack."
  return 1
fi

unzip -qo "$ZIP" \
  "Orc/Peon/*" "Orc/Grunt/*" "Orc/HeadHunter/*" "Orc/Shaman/*" \
  "Orc/Hellscream/*" "Orc/HeroFarseer/*" "Orc/Tauren/*" "Orc/WitchDoctor/*" \
  -d "$TMP_DIR"

# Download supplemental clips not in the zip
echo "  Downloading supplemental clips..."
curl -sL -o "$TMP_DIR/Orc/more-work.mp3" \
  "https://soundfxcenter.com/video-games/warcraft-2/8d82b5_Warcraft_2_Peasant_More_Work_Sound_Effect.mp3"

echo "  Download complete."
