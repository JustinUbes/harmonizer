# Repository Agents

This repository uses workspace-local Harmonizer agents:

- [harmonizer-owner](agents/harmonizer-owner.agent.md) — Product owner and orchestrator. Triages GitHub Issues, plans work, delegates to the specialist agents below, and verifies results before closing the loop. Start here for "work on issue #N" or roadmap/priority decisions.
- [harmonizer-scrum](agents/harmonizer-scrum.agent.md) — Scrum master. Feed it a feature idea and it breaks it into well-formed GitHub Issues (user stories, acceptance criteria, duplicate checks) and files them via the `gh` CLI with your approval.
- [harmonizer-dev](agents/harmonizer-dev.agent.md) — Expert React Native/Expo developer. Fixes bugs and improves audio recording/playback, Redux state, navigation, performance, accessibility, and UI polish to match mainstream music apps.
- [harmony-expert](agents/harmony-expert.agent.md) — Music-theory specialist. Designs and critiques harmony-generation rules, voicings, styles, and key-detection heuristics; writes in-app music education content.
- [harmonizer-user](agents/harmonizer-user.agent.md) — Everyday-musician persona. Use for playtesting, harmony-quality-by-ear verdicts, and usability reviews comparing Harmonizer to popular music apps.

Repository-wide guidance is also defined in [copilot-instructions.md](copilot-instructions.md), and the [github-connect](skills/github-connect/SKILL.md) skill covers GitHub Issue/PR workflows via the `gh` CLI.
