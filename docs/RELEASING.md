# Releasing Brainarium for macOS

Status: implemented release pipeline, 2026-08-25. The first public release is blocked until the Apple signing and notarization secrets below are configured.

## What is shipped

A Git tag matching the package version (for example, `v0.1.0`) triggers [release.yml](../.github/workflows/release.yml). It builds and validates both Apple Silicon (`arm64`) and Intel (`x64`) artifacts, then attaches a signed, notarized DMG, companion ZIP, and `SHA256SUMS.txt` file to the GitHub Release.

Users update manually in v1: quit Brainarium, open the newer DMG, drag Brainarium to `/Applications`, and choose **Replace**. The ZIP is retained for a future in-app update feed; automatic updating is intentionally not enabled until the repository's distribution/privacy policy is decided.

## One-time GitHub setup

Create a `release` GitHub Actions environment and give only its workflows access to these encrypted secrets:

| Secret | Value |
| --- | --- |
| `BRAINARIUM_MACOS_CERTIFICATE_P12` | Base64-encoded Developer ID Application `.p12` certificate. |
| `BRAINARIUM_MACOS_CERTIFICATE_PASSWORD` | Password used when exporting that `.p12`. |
| `BRAINARIUM_MACOS_SIGNING_IDENTITY` | Exact Developer ID Application identity shown by `security find-identity -p codesigning -v`. |
| `APPLE_API_KEY_P8_BASE64` | Base64-encoded App Store Connect API key `.p8`. |
| `APPLE_API_KEY_ID` | The API key identifier. |
| `APPLE_API_ISSUER` | The App Store Connect API issuer UUID. |

The workflow creates an ephemeral keychain on each runner; do not commit a certificate, `.p8` file, password, or local `.env` to the repository. Apple Developer Program membership, a Developer ID Application certificate, and notarization credentials are prerequisites. A tagged release fails before packaging if any secret is absent, rather than publishing an unsigned DMG.

On the Mac that owns the certificate, export it from Keychain Access as a password-protected `.p12`, then create the two encoded values without placing their source files in the repository:

```sh
base64 -i developer-id-application.p12 | pbcopy
base64 -i AuthKey_ABCDEFGHIJ.p8 | pbcopy
```

Paste the first result into `BRAINARIUM_MACOS_CERTIFICATE_P12` and the second into `APPLE_API_KEY_P8_BASE64`. Create the **Team** API key in App Store Connect—an individual key cannot use `notarytool`—then copy its key ID and issuer UUID into the corresponding secrets.

## Cut a release

1. Update `package.json` and `package-lock.json` to the intended semantic version and add the user-visible [CHANGELOG.md](../CHANGELOG.md) entry.
2. From the release commit, run `npm run quality` and the MCP validation commands in [brainarium-mcp/README.md](../brainarium-mcp/README.md).
3. Commit and push the release preparation, then create a matching annotated tag:

   ```sh
   git tag -a v0.1.0 -m "Brainarium v0.1.0"
   git push origin v0.1.0
   ```

4. Watch the **Release macOS** workflow. It verifies that the tag and package version match, validates the app, signs and notarizes the two architecture builds, and creates the GitHub Release only after both succeed.
5. Download the DMG from the release and test it on a clean macOS account before announcing it.

To rebuild an existing tag after a transient failure, use **Run workflow** with that exact tag. Do not move a published version tag.

## Local packaging

`npm run make` creates unsigned local DMG and ZIP files under `out/make/`; macOS can build DMGs only on macOS. This is useful for development testing, but it is not a public distribution artifact and may be blocked by Gatekeeper.

For the supported build, test, and MCP startup commands, see [CONTRIBUTING.md](../CONTRIBUTING.md). The security and product rationale is recorded in [ADR-004](adr/004-macos-release-distribution.md).
