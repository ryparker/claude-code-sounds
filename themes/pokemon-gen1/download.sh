#!/bin/bash
#
# Downloads sound files for the pokemon-gen1 theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
PKM_DIR="$TMP_DIR/PokemonGen1"

mkdir -p "$PKM_DIR/SFX" "$PKM_DIR/Cries" "$PKM_DIR/Attacks"

# --- General sound effects (menu, items, battle UI) ---
echo "  Downloading Pokemon Red/Blue general sound effects..."
SFX_ZIP="$TMP_DIR/pokemon-sfx.zip"
curl -sL -o "$SFX_ZIP" \
  "https://sounds.spriters-resource.com/media/assets/408/410769.zip?updated=1755537434"

if ! file "$SFX_ZIP" | grep -q "Zip"; then
  echo "  Error: Failed to download general sound effects pack."
  exit 1
fi

unzip -qo "$SFX_ZIP" -d "$TMP_DIR"
cp "$TMP_DIR/Pokemon Red_Blue Sound Effects/"*.wav "$PKM_DIR/SFX/"

# --- Pokemon cries (151 original cries) ---
echo "  Downloading Pokemon Gen 1 cries..."
CRIES_ZIP="$TMP_DIR/pokemon-cries.zip"
curl -sL -o "$CRIES_ZIP" \
  "https://sounds.spriters-resource.com/media/assets/411/413821.zip?updated=1755538954"

if ! file "$CRIES_ZIP" | grep -q "Zip"; then
  echo "  Error: Failed to download Pokemon cries pack."
  exit 1
fi

unzip -qo "$CRIES_ZIP" -d "$TMP_DIR"
cp "$TMP_DIR/Pokemon RBY Cries/"*.wav "$PKM_DIR/Cries/"

# --- Attack move sound effects ---
echo "  Downloading Pokemon Gen 1 attack move sounds..."
ATTACKS_ZIP="$TMP_DIR/pokemon-attacks.zip"
curl -sL -o "$ATTACKS_ZIP" \
  "https://sounds.spriters-resource.com/media/assets/408/410768.zip?updated=1755537433"

if ! file "$ATTACKS_ZIP" | grep -q "Zip"; then
  echo "  Error: Failed to download attack move sound effects pack."
  exit 1
fi

unzip -qo "$ATTACKS_ZIP" -d "$TMP_DIR/pokemon-attacks-raw"

# Copy only the specific attack sounds used by this theme
ATTACK_FILES=(
  "Screech.wav"
  "Rest.wav"
  "Teleport.wav"
  "Confused.wav"
  "SelfDestruct.wav"
  "Splash.wav"
  "Substitute.wav"
)

for FILE in "${ATTACK_FILES[@]}"; do
  if [ -f "$TMP_DIR/pokemon-attacks-raw/$FILE" ]; then
    cp "$TMP_DIR/pokemon-attacks-raw/$FILE" "$PKM_DIR/Attacks/"
  else
    echo "    Warning: Attack sound $FILE not found in archive."
  fi
done

echo "  Download complete."
