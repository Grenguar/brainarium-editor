# Changelog

All notable Brainarium changes are documented here, following the structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and using [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.6] - 2026-08-30

### Added

- A Linux sandbox preflight and Ubuntu setup guidance that preserve Electron sandboxing. (#53)
- Downloadable unsigned macOS, Windows, Debian/Ubuntu, and RPM release assets without an Apple signing prerequisite.
- Cross-platform keyboard shortcuts for vault search, Find in file, and Copy content.
- Planning documentation, quality gates, tag taxonomy, and future GitHub Actions plan.
- Local macOS DMG packaging and a signed, notarized GitHub Release pipeline for version tags.
- Native Windows Setup and Debian/RPM Linux release artifacts with published checksums.
- Docker-first, per-vault Brainarium MCP configuration examples for Claude Desktop, Claude Code, Codex, and other stdio MCP clients.
- Brainarium product identity, version, and description in the Electron shell.
- CommonMark/GFM Reading mode with safe raw-HTML sanitization, frontmatter properties, reliable Markdown/wiki-links, and verified local images.
- Conflict-safe Markdown editing with external-change comparison, deliberate reload/overwrite choices, and CodeMirror-assisted source editing.
- Safe MCP folder creation, nested file creation, and read-only source-derived graph and connection queries.
- A source-safe Markdown Insert menu and slash palette for supported block types.
- Inline note connections, a prose-first reading measure with a wide canvas for tables, code, and images, read-only image documents with fit/zoom controls, and verified image moves into structured vault paths beside the active note's hierarchy.

### Changed

- Refresh the project README with human and agent quick starts, MCP safety guidance, and the issue-backed roadmap.
- Product renamed to Brainarium.

### Fixed

- Package Windows and Linux installers consistently in the GitHub Release workflow.
- Keep the active vault, file, and reading position after reload or relaunch.
- Keep JSON, source code, CSV, preview, and comparison surfaces readable in dark theme.

### Security

- None.

## Changelog rules

- Add one user-meaningful entry under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or `Security` in the same pull request as a releasable change.
- Omit entries only for internal refactors, test-only work, dependency-only updates, or documentation-only changes that do not alter user-facing behavior; label those pull requests `changelog:skip`.
- Write in imperative, user-visible language and link an issue/PR when available.
- Keep entries under `Unreleased`; the release workflow moves them into a dated version heading without rewriting their meaning.
