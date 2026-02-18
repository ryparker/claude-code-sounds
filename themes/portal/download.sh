#!/bin/bash
#
# Downloads sound files for the portal theme.
# Called by install.sh with $1 = target sounds directory, $2 = temp directory.
#
set -e

# shellcheck disable=SC2034  # passed by install.sh, reserved for theme use
SOUNDS_DIR="$1"
TMP_DIR="$2"
PORTAL_DIR="$TMP_DIR/Portal2"

BASE_URL="https://raw.githubusercontent.com/sourcesounds/portal2/master/sound"

# All unique sound files needed by this theme, organized by subdirectory
declare -A DIRS
DIRS=(
  [weapons/portalgun]="
    portalgun_powerup1.wav
    portal_open1.wav
    portal_close1.wav
    portal_close2.wav
    portal_enter_01.wav
    portal_exit_01.wav
    portalgun_shoot_blue1.wav
    portalgun_shoot_red1.wav
    portal_fizzle_01.wav
    portal_invalid_surface_01.wav
  "
  [npc/turret_floor]="
    active.wav
    alert.wav
    ping.wav
    retract.wav
    turret_active_1.wav
    turret_autosearch_1.wav
    turret_autosearch_2.wav
    turret_search_1.wav
    turret_search_2.wav
    turret_deploy_1.wav
    turret_retire_1.wav
    turret_retire_2.wav
    turret_shotat_1.wav
    turret_disabled_1.wav
  "
  [npc/sphere]="
    corrupt_core_attach_01.wav
    sphere_attach.wav
  "
  [buttons]="
    button_synth_positive_01.wav
    button_synth_negative_01.wav
    portal_button_down_01.wav
    portal_button_up_01.wav
    og_test_chamber_pos_01.wav
  "
  [ui]="
    buttonclick.wav
  "
  [alarms]="
    klaxon1.wav
  "
  [vfx]="
    fizzler_start_01.wav
    fizzler_shutdown_01.wav
  "
  [props]="
    material_emancipation_01.wav
    post_message_announcer_01.wav
  "
)

echo "  Downloading Portal 2 sounds..."

FAILED=0
TOTAL=0

for DIR in "${!DIRS[@]}"; do
  mkdir -p "$PORTAL_DIR/$DIR"
  for FILE in ${DIRS[$DIR]}; do
    TOTAL=$((TOTAL + 1))
    curl -sL -o "$PORTAL_DIR/$DIR/$FILE" "$BASE_URL/$DIR/$FILE"
    if [ ! -s "$PORTAL_DIR/$DIR/$FILE" ]; then
      echo "    Warning: Failed to download $DIR/$FILE"
      rm -f "$PORTAL_DIR/$DIR/$FILE"
      FAILED=$((FAILED + 1))
    fi
  done
done

if [ "$FAILED" -gt 0 ]; then
  echo "  Warning: $FAILED of $TOTAL file(s) failed to download."
fi

echo "  Download complete ($((TOTAL - FAILED))/$TOTAL files)."
