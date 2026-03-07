#!/bin/bash
# Build vjam-fx-bundle.js for iOS WKWebView injection
# Concatenates: p5.min.js + base-preset.js + text-overlay.js + all presets + content-ios.js

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/ios/VJamFX/VJamFX/Resources"
OUTPUT_FILE="$OUTPUT_DIR/vjam-fx-bundle.js"

mkdir -p "$OUTPUT_DIR"

echo "Building vjam-fx-bundle.js..."

# Start with empty file
> "$OUTPUT_FILE"

# 1. p5.min.js
echo "// === p5.min.js ===" >> "$OUTPUT_FILE"
cat "$PROJECT_ROOT/lib/p5.min.js" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 2. base-preset.js
echo "// === base-preset.js ===" >> "$OUTPUT_FILE"
cat "$PROJECT_ROOT/content/base-preset.js" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 3. text-overlay.js
echo "// === text-overlay.js ===" >> "$OUTPUT_FILE"
cat "$PROJECT_ROOT/content/text-overlay.js" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 4. All presets (sorted for deterministic builds)
PRESET_COUNT=0
for preset in $(find "$PROJECT_ROOT/content/presets" -name '*.js' | sort); do
  echo "// === $(basename "$preset") ===" >> "$OUTPUT_FILE"
  cat "$preset" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
  PRESET_COUNT=$((PRESET_COUNT + 1))
done

# 5. content-ios.js (iOS-adapted engine)
if [ -f "$PROJECT_ROOT/content/content-ios.js" ]; then
  echo "// === content-ios.js ===" >> "$OUTPUT_FILE"
  cat "$PROJECT_ROOT/content/content-ios.js" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
else
  echo "WARNING: content/content-ios.js not found — bundle will be incomplete"
fi

SIZE=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
echo "Done: $OUTPUT_FILE ($SIZE bytes, $PRESET_COUNT presets)"
