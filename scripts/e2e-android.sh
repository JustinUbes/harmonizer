#!/usr/bin/env bash
# Runs the Maestro E2E smoke flow(s) against a booted Android emulator while
# looping the committed mic fixture into the emulator's virtual microphone.
#
# Usage: npm run e2e:android [-- <flow file or directory>]
#
# Environment:
#   E2E_MIC_FIXTURE       WAV to feed the mic (default: tests/fixtures/mic-input-a4.wav)
#   E2E_SKIP_MIC_FIXTURE  Set to 1 to skip host audio routing (use your own input)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="${E2E_MIC_FIXTURE:-$ROOT_DIR/tests/fixtures/mic-input-a4.wav}"
FLOW="${1:-$ROOT_DIR/.maestro}"
SINK_NAME='harmonizer_e2e_mic'

PLAYER_PID=''
MODULE_ID=''
PREVIOUS_SOURCE=''

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' not found on PATH. $2" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "$PLAYER_PID" ]]; then
    # The player loop runs in its own process group; stop the loop and paplay together.
    kill -- "-$PLAYER_PID" 2>/dev/null || true
  fi
  if [[ -n "$PREVIOUS_SOURCE" ]]; then
    pactl set-default-source "$PREVIOUS_SOURCE" 2>/dev/null || true
  fi
  if [[ -n "$MODULE_ID" ]]; then
    pactl unload-module "$MODULE_ID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

require adb 'Install Android SDK platform-tools.'
require maestro 'Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro'

if [[ ! -f "$FIXTURE" ]]; then
  echo "error: mic fixture not found: $FIXTURE" >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo 'error: no single Android emulator/device is connected (set ANDROID_SERIAL if several are).' >&2
  exit 1
fi

if [[ "${E2E_SKIP_MIC_FIXTURE:-0}" == '1' ]]; then
  echo 'Skipping mic fixture routing (E2E_SKIP_MIC_FIXTURE=1).'
elif command -v pactl >/dev/null 2>&1 && command -v paplay >/dev/null 2>&1; then
  # Create a virtual sink, make its monitor the default input, and loop the
  # fixture into it so the emulator's host-backed mic "hears" the fixture.
  PREVIOUS_SOURCE="$(pactl info | sed -n 's/^Default Source: //p')"
  MODULE_ID="$(pactl load-module module-null-sink \
    sink_name="$SINK_NAME" sink_properties=device.description=HarmonizerE2EMic)"
  pactl set-default-source "$SINK_NAME.monitor"
  # shellcheck disable=SC2016 # $1/$2 expand inside the child shell.
  setsid bash -c 'while true; do paplay --device="$1" "$2"; done' _ "$SINK_NAME" "$FIXTURE" &
  PLAYER_PID=$!
  echo "Looping $FIXTURE into virtual mic '$SINK_NAME.monitor'."
else
  echo 'warning: pactl/paplay not found; the emulator mic will use your current host input.' >&2
  echo '         See README "End-to-end smoke test" for routing the fixture manually.' >&2
fi

if ! adb emu avd hostmicon >/dev/null 2>&1; then
  echo 'warning: could not enable host mic via "adb emu avd hostmicon";' >&2
  echo '         start the emulator with -allow-host-audio if recordings are silent.' >&2
fi

maestro test "$FLOW"
