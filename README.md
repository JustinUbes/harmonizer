<h1>Harmonizer for iOS and Android</h1>
<p>Harmonizer is an Open Source mobile application currently in development. Harmonizer aims to help musicians create harmonies in their own music and become more skilled in hearing harmony in music.
Users will record voice or instrument input and the app will return a version of the audio with harmonized voices.
</p>
<br>
<p>
</p>

<p>App artwork by Kevin Sieving. You can find his work here: https://www.chronickevportfolio.com/</p>

## Testing

- Unit / flow tests: `npm run test:ci` (Jest) and `npx tsc --noEmit`.

### End-to-end smoke test (Maestro, Android emulator)

`.maestro/record-smoke.yaml` launches the app, records ~3 seconds, stops, then opens Playback and checks that a new history entry exists. `npm run e2e:android` runs it while looping the committed fixture `tests/fixtures/mic-input-a4.wav` (440 Hz sine) into the emulator's virtual microphone.

Prerequisites: Android SDK (`adb`, emulator), [Maestro](https://docs.maestro.dev/getting-started/installing-maestro), and on Linux PulseAudio/PipeWire (`pactl`, `paplay`).

1. Boot an emulator with host audio input enabled:
   `emulator -avd <your_avd> -allow-host-audio`
2. Install and start an Expo dev build of the app (debug build, JS served by Metro):
   `npx expo run:android`
   (This generates the git-ignored `android/` folder. A standalone `eas build -p android --profile preview` APK installed with `adb install` also works.)
3. Run the flow from the repo root:
   `npm run e2e:android`

The script creates a temporary PulseAudio null sink, makes its monitor the default input, loops the fixture into it, enables the emulator host mic (`adb emu avd hostmicon`), runs `maestro test .maestro`, and restores your audio setup on exit. Pass a single flow with `npm run e2e:android -- .maestro/record-smoke.yaml`. Without `pactl` (e.g. macOS), route the fixture manually with a loopback device such as BlackHole set as the system input, or set `E2E_SKIP_MIC_FIXTURE=1` to record from your current input.

## CI / Security

The `.github/workflows/security.yml` workflow runs on every pull request and push to `main`. It includes:

- **Dependency audit** (`npm audit --audit-level=critical`): fails if any production dependency has a critical vulnerability.
- **CodeQL static analysis** (JavaScript/TypeScript, `security-extended` query suite): scans for common security issues and reports findings to the GitHub Security tab.

Dependabot is configured (`.github/dependabot.yml`) to open weekly npm and GitHub Actions dependency-update PRs automatically.

### False-positive handling

If a CodeQL alert is a confirmed false positive, dismiss it directly in the GitHub Security tab with a brief note explaining why. Do not disable queries in the workflow file. For `npm audit` findings in dev-only transitive dependencies that cannot be fixed, document the exception here or in a `.nsprc` / `overrides` entry in `package.json`.
