# ADR-004: Signed, notarized DMGs from immutable version tags

Status: accepted, 2026-08-25.

## Context

Brainarium is a macOS-first local application. Users need an installable artifact and a reliable path to replace it with a newer version without uploading their vaults to a Brainarium service. Unsigned Electron applications are interrupted by macOS Gatekeeper, while a self-updater adds a separate network, release-hosting, and privacy contract.

## Decision

Use an annotated, immutable semantic version tag (`vX.Y.Z`) to trigger GitHub Actions. The release pipeline builds native `arm64` and `x64` packages on macOS runners, validates the normal production build, signs the app with a Developer ID Application certificate, notarizes it with App Store Connect API credentials, verifies the result, and publishes a DMG plus ZIP to the matching GitHub Release.

The first delivery mechanism is a manual DMG update: replace the installed application in `/Applications`. The ZIP is published because Electron's macOS updater requires it, but no automatic update client or release feed is enabled in v1. The `release` environment owns all Apple credentials. Missing credentials fail the workflow before a public release is created.

## Consequences

- The vault remains local and no update service sees its contents.
- Release tags must exactly match `package.json`; a new version is a new tag, never a moved tag.
- Local `npm run make` remains intentionally unsigned so contributors can package without Apple credentials.
- Automatic updates, delta downloads, update channels, and a private-repository update feed remain an explicit future decision under OPN-08.
