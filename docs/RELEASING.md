# Releasing Brainarium

Status: implemented release pipeline, 2026-08-30. Tagged releases publish
downloadable installers for every supported platform. macOS artifacts are
unsigned and not notarized until Apple signing is deliberately enabled.

## What is shipped

A Git tag matching the package version (for example, `v0.1.0`) triggers
[release.yml](../.github/workflows/release.yml). It builds and validates native
artifacts on their target OS, then attaches the following to the GitHub Release:

| Platform                   | Architectures           | Artifacts                          | Production trust state                                   |
| -------------------------- | ----------------------- | ---------------------------------- | -------------------------------------------------------- |
| macOS                      | Apple Silicon and Intel | unsigned DMG and ZIP               | Gatekeeper warning until signing/notarization is enabled |
| Windows                    | x64                     | Squirrel Setup `.exe` and `.nupkg` | unsigned until Windows code signing is configured        |
| Debian/Ubuntu              | x64                     | `.deb`                             | SHA-256 checksum until repository signing is configured  |
| Fedora/RHEL/openSUSE-style | x64                     | `.rpm`                             | SHA-256 checksum until repository signing is configured  |

The release is published only after all target jobs succeed. Windows and Linux
installers are published with SHA-256 checksums; macOS downloads are clearly
unsigned until Apple signing/notarization is enabled.

Users update manually in v1: quit Brainarium, run the new native installer for
their platform, and replace the existing application when asked. The macOS ZIP
is retained for a future in-app update feed; automatic updating is intentionally
not enabled until the repository's distribution/privacy policy is decided.

## Optional macOS signing setup

When a notarized macOS release is required, create a `release` GitHub Actions
environment and give only its workflows access to these encrypted secrets:

| Secret                                  | Value                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `BRAINARIUM_MACOS_CERTIFICATE_P12`      | Base64-encoded Developer ID Application `.p12` certificate.                                  |
| `BRAINARIUM_MACOS_CERTIFICATE_PASSWORD` | Password used when exporting that `.p12`.                                                    |
| `BRAINARIUM_MACOS_SIGNING_IDENTITY`     | Exact Developer ID Application identity shown by `security find-identity -p codesigning -v`. |
| `APPLE_API_KEY_P8_BASE64`               | Base64-encoded App Store Connect API key `.p8`.                                              |
| `APPLE_API_KEY_ID`                      | The API key identifier.                                                                      |
| `APPLE_API_ISSUER`                      | The App Store Connect API issuer UUID.                                                       |

Do not commit a certificate, `.p8` file, password, or local `.env` to the
repository. Apple Developer Program membership, a Developer ID Application
certificate, and notarization credentials are required only when the separate
signing/notarization enhancement is enabled.

On the Mac that owns the certificate, export it from Keychain Access as a password-protected `.p12`, then create the two encoded values without placing their source files in the repository:

```sh
base64 -i developer-id-application.p12 | pbcopy
base64 -i AuthKey_ABCDEFGHIJ.p8 | pbcopy
```

Paste the first result into `BRAINARIUM_MACOS_CERTIFICATE_P12` and the second into `APPLE_API_KEY_P8_BASE64`. Create the **Team** API key in App Store Connect—an individual key cannot use `notarytool`—then copy its key ID and issuer UUID into the corresponding secrets.

## Cut a release

1. Update `package.json` and `pnpm-lock.yaml` to the intended semantic version and add the user-visible [CHANGELOG.md](../CHANGELOG.md) entry.
2. From the release commit, run `pnpm run quality` and the MCP validation commands in [brainarium-mcp/README.md](../brainarium-mcp/README.md).
3. Commit and push the release preparation, then create a matching annotated tag:

   ```sh
   git tag -a v0.1.0 -m "Brainarium v0.1.0"
   git push origin v0.1.0
   ```

4. Watch the **Release Brainarium** workflow. It verifies that the tag and
   package version match, validates the app on each native target, and creates
   the GitHub Release only after all package jobs succeed.
5. Download the artifact for each supported platform and test it on a clean
   account before announcing it. Verify `SHA256SUMS.txt` before installing an
   unsigned Windows or Linux package.

To rebuild an existing tag after a transient failure, use **Run workflow** with that exact tag. Do not move a published version tag.

## Local packaging

`pnpm run make` creates artifacts for the current host OS under `out/make/`:
macOS creates an unsigned DMG/ZIP, Windows creates Squirrel Setup, and Linux
creates `.deb`/`.rpm` packages. Build on the OS you intend to test; the tagged
GitHub Actions workflow is the authoritative cross-platform build. Local macOS
artifacts are not public distribution artifacts and may be blocked by Gatekeeper.

For a convenient local update, `pnpm run make:local-update` increments the patch
version without creating a Git tag, then runs `pnpm run make`. Quit the installed
app, open the new DMG, and replace Brainarium in Applications.

For the supported build, test, and MCP startup commands, see
[CONTRIBUTING.md](../CONTRIBUTING.md) and
[BUILDING-ELECTRON-APPS.md](BUILDING-ELECTRON-APPS.md). The security and
distribution rationale is recorded in [ADR-004](adr/004-macos-release-distribution.md)
and [ADR-005](adr/005-cross-platform-native-packages.md).
