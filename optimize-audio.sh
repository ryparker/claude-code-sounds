#!/bin/bash

# Optimize all audio clips for production:
#   1. Convert WAV → MP3 (update theme.json references)
#   2. Strip silence from start/end
#   3. Normalize loudness to -16 LUFS (two-pass)
#   4. Encode as MP3 CBR 192 kbps (transparent quality)
#   5. Strip metadata/tags to minimize file size
#
# Requires: ffmpeg (brew install ffmpeg)
#
# Usage:
#   ./optimize-audio.sh                    # optimize all themes
#   ./optimize-audio.sh themes/star-wars   # optimize one theme

TARGET_LUFS="-16"
TARGET_TP="-1.5"
TARGET_LRA="11"
SILENCE_DB="-40dB"
SILENCE_DUR="0.1"
DIR="${1:-themes}"

if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg is required (brew install ffmpeg)"
  exit 1
fi

# --- Pass 1: Convert WAV → MP3 and update theme.json ---

wavs=()
while IFS= read -r -d '' f; do
  wavs+=("$f")
done < <(find "$DIR" -type f -name "*.wav" -print0)

if [ ${#wavs[@]} -gt 0 ]; then
  echo "Converting ${#wavs[@]} WAV files to MP3..."
  for f in "${wavs[@]}"; do
    mp3="${f%.wav}.mp3"
    (ffmpeg -y -nostdin -i "$f" -b:a 192k -map_metadata -1 "$mp3" 2>/dev/null) || true
    if [ -f "$mp3" ] && [ -s "$mp3" ]; then
      rm -f "$f"
      # Update theme.json references in the same theme dir
      theme_dir="$(dirname "$(dirname "$f")")"
      theme_json="$theme_dir/theme.json"
      if [ -f "$theme_json" ]; then
        wav_name="$(basename "$f")"
        mp3_name="$(basename "$mp3")"
        node -e "
          const fs = require('fs');
          const p = process.argv[1];
          const old_name = process.argv[2];
          const new_name = process.argv[3];
          let raw = fs.readFileSync(p, 'utf8');
          const updated = raw.split(old_name).join(new_name);
          if (updated !== raw) {
            fs.writeFileSync(p, updated);
            process.stdout.write('  ' + old_name + ' → ' + new_name + '\n');
          }
        " "$theme_json" "$wav_name" "$mp3_name"
      fi
    fi
  done
fi

# --- Pass 2: Optimize all MP3s (trim silence, normalize, re-encode) ---

files=()
while IFS= read -r -d '' f; do
  files+=("$f")
done < <(find "$DIR" -type f -name "*.mp3" ! -name "*.tmp.mp3" -print0)

total=${#files[@]}
if [ "$total" -eq 0 ]; then
  echo "No audio files found in $DIR"
  exit 0
fi

echo "Optimizing $total MP3 files (trim silence, normalize, strip metadata)..."

saved_total=0
count=0
errors=0
failed_files=()

for f in "${files[@]}"; do
  count=$((count + 1))
  tmp="${f}.tmp.mp3"
  size_before=$(wc -c < "$f" | tr -d ' ')

  # Get duration to handle very short clips differently
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null || echo "0")

  TRIM="silenceremove=start_periods=1:start_duration=${SILENCE_DUR}:start_silence=${SILENCE_DUR}:start_threshold=${SILENCE_DB},areverse,silenceremove=start_periods=1:start_duration=${SILENCE_DUR}:start_silence=${SILENCE_DUR}:start_threshold=${SILENCE_DB},areverse"

  # Very short clips (< 0.5s): just re-encode and strip metadata, skip loudnorm
  if [ "$(echo "$dur < 0.5" | bc 2>/dev/null || echo 0)" = "1" ]; then
    (ffmpeg -y -nostdin -i "$f" -map 0:a:0 \
      -b:a 192k -map_metadata -1 -id3v2_version 0 \
      "$tmp" 2>/dev/null) || true
  else
    # Two-pass loudnorm for accurate normalization
    # Pass 1: measure loudness (run in subshell to catch SIGABRT)
    stats=$( (ffmpeg -nostdin -i "$f" -map 0:a:0 -af "loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json" -f null - 2>&1) || true )
    stats=$(echo "$stats" | grep -A 20 '"input_i"' || true)

    if [ -n "$stats" ]; then
      input_i=$(echo "$stats" | grep '"input_i"' | sed 's/[^0-9.-]//g')
      input_tp=$(echo "$stats" | grep '"input_tp"' | sed 's/[^0-9.-]//g')
      input_lra=$(echo "$stats" | grep '"input_lra"' | sed 's/[^0-9.-]//g')
      input_thresh=$(echo "$stats" | grep '"input_thresh"' | sed 's/[^0-9.-]//g')
      offset=$(echo "$stats" | grep '"target_offset"' | sed 's/[^0-9.-]//g')

      # Skip two-pass if loudnorm couldn't measure (too short / silent)
      if echo "$input_i" | grep -q "inf" || echo "$offset" | grep -q "inf" || [ -z "$input_i" ]; then
        NORM="loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}"
      else
        NORM="loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:measured_I=${input_i}:measured_TP=${input_tp}:measured_LRA=${input_lra}:measured_thresh=${input_thresh}:offset=${offset}:linear=true"
      fi
    else
      NORM="loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}"
    fi

    # Try with silence trimming + normalize
    (ffmpeg -y -nostdin -i "$f" -map 0:a:0 \
      -af "${TRIM},${NORM}" \
      -b:a 192k -map_metadata -1 -id3v2_version 0 \
      "$tmp" 2>/dev/null) || true

    # If silence trimming produced empty output, retry without it
    if [ ! -f "$tmp" ] || [ ! -s "$tmp" ]; then
      rm -f "$tmp"
      (ffmpeg -y -nostdin -i "$f" -map 0:a:0 \
        -af "${NORM}" \
        -b:a 192k -map_metadata -1 -id3v2_version 0 \
        "$tmp" 2>/dev/null) || true
    fi

    # If normalize also failed, just re-encode and strip metadata
    if [ ! -f "$tmp" ] || [ ! -s "$tmp" ]; then
      rm -f "$tmp"
      (ffmpeg -y -nostdin -i "$f" -map 0:a:0 \
        -b:a 192k -map_metadata -1 -id3v2_version 0 \
        "$tmp" 2>/dev/null) || true
    fi
  fi

  if [ -f "$tmp" ] && [ -s "$tmp" ]; then
    mv "$tmp" "$f"
    size_after=$(wc -c < "$f" | tr -d ' ')
    saved=$((size_before - size_after))
    saved_total=$((saved_total + saved))
  else
    rm -f "$tmp"
    errors=$((errors + 1))
    failed_files+=("$f")
  fi

  if [ $((count % 10)) -eq 0 ] || [ "$count" -eq "$total" ]; then
    printf "\r  %d / %d" "$count" "$total"
  fi
done

echo ""
if [ "$saved_total" -gt 0 ]; then
  if [ "$saved_total" -gt 1048576 ]; then
    echo "Saved $(( saved_total / 1024 / 1024 )) MB"
  else
    echo "Saved $(( saved_total / 1024 )) KB"
  fi
fi
if [ "$errors" -gt 0 ]; then
  echo "Warning: $errors files failed to process:"
  for ff in "${failed_files[@]}"; do
    echo "  $ff"
  done
fi
echo "Done."
