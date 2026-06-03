#!/bin/sh
set -eu

PROFILE="${1:-coach}"

case "$PROFILE" in
  coach|player|player_setup)
    ;;
  *)
    echo "Usage: sh scripts/start-ios-screenshot-mode.sh [coach|player|player_setup]" >&2
    exit 1
    ;;
esac

EXPO_PUBLIC_SCREENSHOT_MODE=1 \
EXPO_PUBLIC_SCREENSHOT_PROFILE="$PROFILE" \
npx expo start --ios
