This files holds a set of instructions for GitHub Copilot to follow when generating code for this repository. The instructions are intended to reduce the amount of time the agent spends searching for information about the codebase and to reduce the likelihood of generating code that fails validation or build steps.

This repository holds the code for the mobile app Harmonizer. Harmonizer is a music app that allows users to either sing or play a melody into their phone's microphone and then automatically generates harmonies for the melody. The app holds users' harmony history in their device's local storage and allows users to share their harmonies with other users by way of text messages, email, or social media.

- Reduce the likelihood of a cloud agent pull request getting rejected by the user due to generating code that fails to conform to high quality standards. 
- Allow the agent to complete its task more quickly by minimizing the need for exploration using grep, find, str_replace_editor, and code search tools.
- This repository is a mobile app built using React Native and TypeScript. The codebase is organized into the following directories:
  - `components`: Reusable UI components.
  - `screens`: Screen-level components used by React Navigation.
  - `store`: Redux Toolkit state (slices, persistence via redux-persist/AsyncStorage).
  - `utils`: Shared utilities.
  - `assets`: Contains images, fonts, and other static assets used in the app.
  - `tests`: Contains unit and integration tests for the app.
  - `App.tsx`, `styles.ts`, `app.json`, `eas.json`: app entry point, shared styles, and Expo configuration.
  - `package.json`: Contains metadata about the project, including dependencies, scripts, and other configuration information.
- The app uses the following libraries and frameworks:
  - React Native: A framework for building native mobile apps using React.
  - TypeScript: A typed superset of JavaScript that compiles to plain JavaScript.
  - Redux: A state management library for JavaScript apps.
  - React Navigation: A library for routing and navigation in React Native apps.
  - Jest: A testing framework for JavaScript and TypeScript.
- The app follows the following coding conventions:
  - Use camelCase for variable and function names.
  - Use PascalCase for component names.
  - Use single quotes for strings, except when the string contains a single quote, in which case use double quotes.
  - Use semicolons at the end of statements.
  - Use 2 spaces for indentation.
  - Use descriptive names for variables and functions.

Since this repository is a mobile app built using React Native and TypeScript, the agent should be familiar with these technologies and their associated libraries and frameworks. The agent should also be familiar with the coding conventions used in this repository and should follow them when generating code. This app requires a node.js runtime and is not static. Testing will be done using Jest/Expo and the agent should be familiar with these testing frameworks and their associated libraries and frameworks. Validate changes with `npx tsc --noEmit` and `npm run test:ci`.

## Agents and Skills

- Workspace agents are defined in `.github/agents/` and indexed in `.github/AGENTS.md`:
  - `harmonizer-owner` — product owner/orchestrator; triages GitHub Issues and delegates to the other agents.
  - `harmonizer-scrum` — scrum master; turns feature ideas into well-formed GitHub Issues via the `github-connect` skill.
  - `harmonizer-dev` — React Native/Expo development: audio, state, navigation, performance, accessibility, UI polish.
  - `harmony-expert` — music theory: harmony-generation rules, voicings, styles, key detection, education content.
  - `harmonizer-user` — everyday-musician persona for playtesting and usability feedback.
- Delegate to the most relevant agent when a task matches its domain; prefer `harmonizer-owner` for issue-driven or multi-agent work.
- Use the `github-connect` skill (`.github/skills/github-connect/`) for GitHub Issue/PR work via the `gh` CLI; write actions (commenting, closing, pushing) require explicit user approval.
- The app is local-first: no backend, accounts, or cloud sync — rescope feature requests that assume them.
- When adding or renaming agents or skills, keep `.github/AGENTS.md` in sync.


