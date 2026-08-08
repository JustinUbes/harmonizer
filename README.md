<h1>Harmonizer for iOS and Android</h1>
<p>Harmonizer is an Open Source mobile application currently in development. Harmonizer aims to help musicians create harmonies in their own music and become more skilled in hearing harmony in music.
Users will record voice or instrument input and the app will return a version of the audio with harmonized voices.
</p>
<br>
<p>
</p>

<p>App artwork by Kevin Sieving. You can find his work here: https://www.chronickevportfolio.com/</p>

## CI / Security

The `.github/workflows/security.yml` workflow runs on every pull request and push to `main`. It includes:

- **Dependency audit** (`npm audit --audit-level=high`): fails if any production dependency has a high or critical vulnerability.
- **CodeQL static analysis** (JavaScript/TypeScript, `security-extended` query suite): scans for common security issues and reports findings to the GitHub Security tab.

Dependabot is configured (`.github/dependabot.yml`) to open weekly npm and GitHub Actions dependency-update PRs automatically.

### False-positive handling

If a CodeQL alert is a confirmed false positive, dismiss it directly in the GitHub Security tab with a brief note explaining why. Do not disable queries in the workflow file. For `npm audit` findings in dev-only transitive dependencies that cannot be fixed, document the exception here or in a `.nsprc` / `overrides` entry in `package.json`.
