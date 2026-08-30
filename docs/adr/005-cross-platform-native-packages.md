# ADR-005: Native packages on each supported desktop platform

Status: accepted, amended 2026-08-30.

## Context

Brainarium is designed first on macOS, but a local vault application must be
installable where its owner works. Cross-compiling Electron distributions hides
native packaging dependencies and makes installer behavior difficult to test.
The release needs a predictable artifact for Windows, Ubuntu/Debian, and common
RPM distributions without changing the vault or MCP security boundary.

## Decision

Use Electron Forge makers on their native GitHub Actions runners: Squirrel
Setup for Windows x64, `.deb` for Debian/Ubuntu x64, and `.rpm` for Fedora,
RHEL-family, and openSUSE-style x64 systems. Build unsigned macOS Apple-Silicon
and Intel artifacts until signing/notarization is deliberately enabled; the
publish job runs only after every platform package completes.

`pnpm run make` continues to create artifacts only for the contributor's current
platform. The CI workflow is the authoritative cross-platform packaging test.
Every release attaches SHA-256 checksums. Windows code signing and Linux
repository keys are explicitly deferred rather than implied by the macOS Apple
credentials.

## Consequences

- Users get native installers rather than an unsupported cross-compiled bundle.
- Tagged releases are not blocked by Apple credentials; macOS downloads are
  explicitly unsigned and may produce Gatekeeper warnings until signing is
  enabled.
- Windows SmartScreen and Linux package trust remain less polished until their
  own signing decisions are funded and configured.
- The app and the separate MCP remain local binaries; installers do not package
  a vault or grant an agent filesystem access.
