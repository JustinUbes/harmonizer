# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Migrate the app to TypeScript with strict typing across the codebase
- Add harmony interval selection, recording title editing, sharing, and empty-state UI
- Add Jest coverage for formatting helpers and Redux recording behavior

### Changed
- Upgrade the project to Expo SDK 54 and refresh the native dependency set
- Modernize the recording and playback flows with typed Redux state, playback seeking, and confirmation prompts
- Update app metadata, Babel config, and EAS config for the current Expo toolchain

### Fixed
- Correct time formatting and current-date formatting helpers
- Fix playback state tracking, delete handling, and the drawer header title styling
