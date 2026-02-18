#!/bin/bash
set -e

# Normalize all audio files to consistent loudness (-16 LUFS)
# Requires: ffmpeg (brew install ffmpeg)

TARGET_LUFS="-16"
TARGET_TP="-1.5"
TARGET_LRA="11"
DIR="${1:-themes}"

if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg is required (brew install ffmpeg)"
  exit 1
fi

files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(find "$DIR" -type f \( -name "*.wav" -o -name "*.mp3" \) -print0)

total=${#files[@]}
if [ "$total" -eq 0 ]; then
  echo "No audio files found in $DIR"
  exit 0
fi

echo "Normalizing $total files to ${TARGET_LUFS} LUFS..."

count=0
for f in "${files[@]}"; do
  count=$((count + 1))
  ext="${f##*.}"
  tmp="${f}.tmp.${ext}"

  if [ "$ext" = "mp3" ]; then
    ffmpeg -y -nostdin -i "$f" -af "loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}" -b:a 192k "$tmp" 2>/dev/null
  else
    ffmpeg -y -nostdin -i "$f" -af "loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}" "$tmp" 2>/dev/null
  fi

  if [ -f "$tmp" ] && [ -s "$tmp" ]; then
    mv "$tmp" "$f"
  fi

  if [ $((count % 25)) -eq 0 ] || [ "$count" -eq "$total" ]; then
    printf "\r  %d / %d" "$count" "$total"
  fi
done

echo ""
echo "Done."
