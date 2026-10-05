# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Migrate the app to TypeScript with strict typing across the codebase
- Add harmony interval selection, recording title editing, sharing, and empty-state UI
- Add Jest coverage for formatting helpers and Redux recording behavior
- Add a Maestro E2E smoke flow (`npm run e2e:android`) that records from a fixture-fed emulator mic and verifies the new history entry

### Changed
- Upgrade the project to Expo SDK 57 and refresh the native dependency set
- Modernize the recording and playback flows with typed Redux state, playback seeking, and confirmation prompts
- Update app metadata, Babel config, and EAS config for the current Expo toolchain

### Fixed
- Correct time formatting and current-date formatting helpers
- Fix playback state tracking, delete handling, and the drawer header title styling
- Make seeking and scrubbing reliable: playback starts exactly from the seeker, the position follows the thumb while dragging, audio pauses during a drag and resumes from the release point, and play/pause stays responsive around seeks
- Delete recordings with the expo-file-system `File` API so audio files (and cached harmony renders) are actually removed
