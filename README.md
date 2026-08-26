# Brainarium

**Brainarium** is a local-first desktop app for folder-backed knowledge vaults.
It keeps the folder and its Markdown files authoritative: there is no account,
cloud sync, telemetry, or proprietary database to adopt.

**Current version:** `0.1.3`

**Status:** macOS-first; buildable locally for macOS, Windows, and Linux. There
is not yet an official downloadable release because the protected macOS signing
and notarization environment is still being configured.

## What works today

- Open any local vault and browse a safe, fixed sidebar file tree. Brainarium
  supports Markdown, CSV, text, JSON, XML, and HTML; hidden files, symlinks,
  and its derived `.brainarium` cache stay out of the vault UI.
- Search the vault, use **Quick open** (`Cmd+P`), reopen recent vaults, and
  switch between light and dark themes.
- Read Markdown in a rendered, sanitized CommonMark/GFM-style preview with
  local links, deterministic wiki-links, local image display, and in-preview
  Find that highlights and cycles through matches without leaving Reading mode.
- Edit Markdown in assisted or raw-source mode, save atomically with version
  checks, and see when the document was last saved. CSV and the other supported
  non-Markdown formats remain read-only previews so their source is preserved.
- Build a deterministic, source-derived vault graph, filter it, explore a local
  graph, and inspect a note's outgoing links and backlinks. The rebuildable
  cache lives only at `.brainarium/graph-v1.json` inside the chosen vault.
- Keep privileged work in the Electron main process: the renderer is sandboxed,
  filesystem IPC is typed and validated, external links are constrained, and
  rendered Markdown is inert.

## Install or build the app

### Official downloads

No official release artifact is published yet. The remaining prerequisite is
[Apple signing and notarization setup](https://github.com/Grenguar/brainarium-editor/issues/6).
Until then, build Brainarium from this checkout on the platform where you will
run it.

### Prerequisites

- Node `24.19.0` (the repository's [.nvmrc](.nvmrc) selects it)
- Corepack and pnpm `11.24.0`
- Rust stable, for the local link-graph sidecar

Clone the repository, then install and run it:

```sh
git clone git@github.com:Grenguar/brainarium-editor.git brainarium
cd brainarium
source "$HOME/.nvm/nvm.sh" && nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

`source "$HOME/.nvm/nvm.sh"` makes this work in non-interactive shells too;
in a terminal where NVM is already loaded, `nvm use` is sufficient.

### Create a local installer

Build on the operating system you are targeting:

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run make
```

Artifacts are written below `out/make/`.

| Platform                       | Local artifact                     | Install it                                                                                                              |
| ------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| macOS                          | Unsigned `.dmg` and `.zip`         | Open the DMG and drag **Brainarium** to Applications. Gatekeeper may require Control-click → Open for a self-built app. |
| Windows x64                    | Squirrel Setup `.exe` and `.nupkg` | Run the generated Setup executable on Windows.                                                                          |
| Debian/Ubuntu x64              | `.deb`                             | Install the generated package with your distribution's package installer.                                               |
| Fedora/RHEL/openSUSE-style x64 | `.rpm`                             | Install the generated package with your distribution's package installer.                                               |

Use this to locate a macOS DMG after a build:

```sh
find out/make -name '*.dmg' -print
```

Local macOS packages are intentionally unsigned. The tagged release workflow
will provide signed/notarized macOS packages once issue #6 is complete. The
full release and packaging policy is in [docs/RELEASING.md](docs/RELEASING.md).

## Connect an AI client through MCP

Brainarium includes a separate, local Rust MCP server. It does not need the
Electron app to be running and serves exactly one vault that you explicitly
configure.

By default it is read-only and can report vault status, list supported visible
files, read exact UTF-8 source, and return the global Markdown graph and
per-file connections.

Optional write access must be enabled explicitly. When enabled, it can create
validated folders and atomically write supported text files with SHA-256
version checks; Markdown writes rebuild the derived graph cache. It cannot
delete, rename, execute shell commands, use the network, follow symlinks, or
access outside the configured vault.

For a native local server:

```sh
cd brainarium-mcp
export BRAINARIUM_VAULT="/absolute/path/to/your/vault"
export BRAINARIUM_MCP_ALLOW_WRITE=false
cargo run --release
```

Copy one of the ready-made configurations for Claude Desktop, Claude Code,
Codex, or another stdio MCP client from
[brainarium-mcp/config](brainarium-mcp/config). Docker is also supported with a
read-only vault mount by default. See the complete
[MCP setup and safety guide](brainarium-mcp/README.md).

## Roadmap

This is the current roadmap, derived from the open GitHub issues rather than
speculative dates.

| Priority | Next outcome                                                                                                     | Tracking issue                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P0       | Add CodeMirror behind Markdown-fidelity and accessibility gates.                                                 | [#1](https://github.com/Grenguar/brainarium-editor/issues/1) |
| P0       | Complete the documented CommonMark/GFM reading compatibility surface and fixtures.                               | [#2](https://github.com/Grenguar/brainarium-editor/issues/2) |
| P0       | Resolve external-edit conflicts with Compare, Reload Disk, and Keep Mine.                                        | [#3](https://github.com/Grenguar/brainarium-editor/issues/3) |
| Blocked  | Configure Apple signing/notarization and prove the protected release gate.                                       | [#6](https://github.com/Grenguar/brainarium-editor/issues/6) |
| P1       | Stream and virtualize large CSV previews while keeping source exact.                                             | [#4](https://github.com/Grenguar/brainarium-editor/issues/4) |
| P1       | Add host-level MCP protocol smoke tests for native and Docker launchers.                                         | [#5](https://github.com/Grenguar/brainarium-editor/issues/5) |
| P1       | Run non-publishing Windows and Linux native package checks before releases.                                      | [#7](https://github.com/Grenguar/brainarium-editor/issues/7) |
| P1       | Make generated Graphify documentation deterministic and tracked-source-only.                                     | [#8](https://github.com/Grenguar/brainarium-editor/issues/8) |
| Planned  | Import or paste vault-owned images into `<vault>/images` with safe names, deduplication, and Markdown insertion. | [#9](https://github.com/Grenguar/brainarium-editor/issues/9) |

## Development and documentation

Run the full implementation gate before sharing a change:

```sh
pnpm run quality
```

- [CONTRIBUTING.md](CONTRIBUTING.md) — development, validation, and packaging
- [docs/README.md](docs/README.md) — product, UX, architecture, and contracts
- [docs/BUILDING-ELECTRON-APPS.md](docs/BUILDING-ELECTRON-APPS.md) — native builds
- [docs/RELEASING.md](docs/RELEASING.md) — release trust and signing policy
- [brainarium-mcp/README.md](brainarium-mcp/README.md) — MCP configuration and safety boundary
