#!/bin/sh
set -eu

NAME="${1:-}"
SIZE_FOLDER="${2:-6.9-inch}"
BASE_DIR="app-store-assets/screenshots/ios/${SIZE_FOLDER}"

if [ -z "$NAME" ]; then
  echo "Usage: sh scripts/capture-ios-screenshot.sh <filename-without-extension> [size-folder]" >&2
  exit 1
fi

mkdir -p "$BASE_DIR"
OUTPUT_PATH="${BASE_DIR}/${NAME}.png"

xcrun simctl io booted screenshot "$OUTPUT_PATH"

echo "Saved screenshot to ${OUTPUT_PATH}"
