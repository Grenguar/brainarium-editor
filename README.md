<p align="center">
  <img src="assets/icon.svg" width="128" alt="Brainarium">
</p>

<h1 align="center">Brainarium</h1>

<h3 align="center">
  Your local Markdown vault, with safe tools for you and your AI.
</h3>

<div align="center">
  <a href="https://github.com/Grenguar/brainarium-editor/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Grenguar/brainarium-editor/ci.yml?branch=main&style=flat-square&label=quality" alt="quality"></a>
  <a href="https://github.com/Grenguar/brainarium-editor"><img src="https://img.shields.io/badge/version-0.1.4-24312e?style=flat-square" alt="version 0.1.4"></a>
  <a href="#model-context-protocol-mcp"><img src="https://img.shields.io/badge/MCP-local%20stdio-24312e?style=flat-square" alt="local stdio MCP"></a>
  <a href="https://github.com/Grenguar/brainarium-editor/issues"><img src="https://img.shields.io/github/issues/Grenguar/brainarium-editor?style=flat-square&label=roadmap" alt="open roadmap issues"></a>
</div>

<br>

Brainarium is a **local-first desktop app** for folder-backed knowledge vaults.
Open the Markdown folder you already trust; Brainarium does not import it, move
it, or convert it into a proprietary format.

It gives you a focused place to read, edit, search, and connect your notes—then
offers a deliberately narrow [Model Context Protocol (MCP)](#model-context-protocol-mcp)
server so an AI client can help without becoming a broad filesystem agent.

> [!IMPORTANT]
> **v0.1.4 is a self-build release.** There is no signed public download yet:
> Apple signing and notarization are tracked in [#6](https://github.com/Grenguar/brainarium-editor/issues/6).
> You can build a native installer on your own platform today with
> [Quick start](#quick-start).

## Why Brainarium

| For your vault                                                                                                              | For your agent                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Your files stay yours.** Markdown remains the source of truth in an ordinary local folder.                                | **One explicit vault.** The MCP server starts with one canonicalized root, not access to your home directory.                                    |
| **A calm reading and editing surface.** Rendered Markdown, assisted/raw source editing, Find, Quick open, and local themes. | **Safe, useful tools.** Read files, inspect the source-derived graph, and only opt into writes when you mean to.                                 |
| **Connections without cloud magic.** Backlinks, outgoing links, and local/global graphs are rebuilt from Markdown source.   | **Conflict-aware writes.** Replacements require the SHA-256 version returned by a read, so stale context cannot silently overwrite a newer file. |

## What you can do today

- Browse a fixed sidebar tree and open Markdown, CSV, plain text, JSON, XML,
  and HTML from a selected vault.
- Search across the vault, jump with **Quick open**, find text without leaving
  Reading mode, and revisit recent vaults.
- Read sanitized CommonMark/GFM-style Markdown with deterministic wiki-links
  and safe local images.
- Edit Markdown in assisted or raw-source mode; saves are atomic and version
  checked. Non-Markdown formats remain read-only so their source stays exact.
- Build and filter a global or local note graph; inspect outgoing links and
  backlinks for the current note.
- Use native-feeling, cross-platform shortcuts: <kbd>⌘P</kbd>/<kbd>Ctrl+P</kbd>
  for Quick open, <kbd>⌘F</kbd>/<kbd>Ctrl+F</kbd> for Find, and
  <kbd>⇧⌘F</kbd>/<kbd>Ctrl+Shift+F</kbd> for vault search.

## How it fits together

```text
Your vault (ordinary local files)
        │
        ├── Brainarium desktop app
        │   ├── sandboxed renderer
        │   ├── typed, validated Electron IPC
        │   └── rebuildable Rust Markdown link graph
        │
        └── Optional Brainarium MCP server
            └── one configured vault · read-only by default
```

The app and MCP server are independent. The MCP can serve your vault while the
Electron app is closed; both preserve Markdown as the canonical content.

## Quick start

### Run the desktop app

**Prerequisites:** Node `24.19.0` ([.nvmrc](.nvmrc)), Corepack/pnpm `11.24.0`,
and Rust stable.

```sh
git clone git@github.com:Grenguar/brainarium-editor.git brainarium
cd brainarium
source "$HOME/.nvm/nvm.sh" && nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

The explicit `source` works in non-interactive shells. In a normal terminal
where NVM is already loaded, `nvm use` is enough.

### Make an installer for your platform

Build on the OS where you plan to run Brainarium:

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run make
```

| Platform                       | Local output                       | Install                                                                                                    |
| ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| macOS                          | Unsigned `.dmg` and `.zip`         | Open the DMG and drag **Brainarium** to Applications. A self-built app may need Control-click → Open once. |
| Windows x64                    | Squirrel Setup `.exe` and `.nupkg` | Run the generated Setup executable on Windows.                                                             |
| Debian/Ubuntu x64              | `.deb`                             | Install the package using your distribution's installer.                                                   |
| Fedora/RHEL/openSUSE-style x64 | `.rpm`                             | Install the package using your distribution's installer.                                                   |

Artifacts are below `out/make/`. The full [build guide](docs/BUILDING-ELECTRON-APPS.md)
and [release policy](docs/RELEASING.md) explain the trust boundary and native
package details.

## Model Context Protocol (MCP)

Brainarium's MCP server is a separate Rust stdio process. Configure it with the
one vault you intend to expose:

```sh
cd brainarium-mcp
export BRAINARIUM_VAULT="/absolute/path/to/your/vault"
export BRAINARIUM_MCP_ALLOW_WRITE=false
cargo run --release
```

It does not need the desktop app running.

| Tool                               | What an agent can do                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `vault_status`                     | Confirm the vault boundary, source limit, supported formats, and write state.                                               |
| `list_files` / `read_file`         | Discover visible supported files and read exact UTF-8 source.                                                               |
| `vault_graph` / `file_connections` | Ask for the global Markdown graph or links to and from a note.                                                              |
| `create_directory` / `write_file`  | Available only with explicit write access; create validated folders or atomically write supported text with version checks. |

There is intentionally **no** delete, rename, shell, network, arbitrary binary
upload, symlink traversal, or broad filesystem tool.

### Add it to your AI client

Ready-to-copy, read-only configurations are included for:

- [Claude Desktop](brainarium-mcp/config/claude-desktop.example.json)
- [Claude Code](brainarium-mcp/config/claude-code.docker.example.json)
- [Codex](brainarium-mcp/config/codex.docker.example.toml)
- [Docker and other stdio clients](brainarium-mcp/config/docker-mcp.example.json)

For the native/Docker launch commands, write-access rules, and safety details,
read the [Brainarium MCP guide](brainarium-mcp/README.md).

> [!TIP]
> Keep `BRAINARIUM_MCP_ALLOW_WRITE=false` until you specifically want an agent
> to edit this vault. When you enable it, existing-file replacements still need
> the version returned by `read_file`.

## Safety and privacy

Brainarium is designed around bounded local authority:

- The Electron renderer is sandboxed; privileged work stays behind typed,
  validated preload IPC.
- Vault paths are canonicalized. Traversal, hidden cache access, and symlink
  escapes are rejected where the relevant contract requires it.
- Rendered Markdown is sanitized and inert: raw HTML, scripts, and remote
  executable/embed content do not run.
- The graph cache is derived data at `.brainarium/graph-v1.json`, never a new
  proprietary document format.
- There is no account, sync service, cloud database, or telemetry requirement.

Read the [architecture](docs/ARCHITECTURE.md) and normative
[technical contracts](docs/TECHNICAL-CONTRACTS.md) for the full boundary.

## Roadmap

The roadmap is the open GitHub issue tracker—not aspirational dates.

<details>
<summary><strong>See the current plan</strong></summary>

| Priority | Outcome                                                                     | Issue                                                        |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P0       | CodeMirror-backed editing behind Markdown-fidelity and accessibility gates. | [#1](https://github.com/Grenguar/brainarium-editor/issues/1) |
| P0       | Complete CommonMark/GFM reading compatibility and fixtures.                 | [#2](https://github.com/Grenguar/brainarium-editor/issues/2) |
| P0       | Resolve external-edit conflicts with Compare, Reload Disk, and Keep Mine.   | [#3](https://github.com/Grenguar/brainarium-editor/issues/3) |
| Blocked  | Configure signing/notarization and prove the protected release gate.        | [#6](https://github.com/Grenguar/brainarium-editor/issues/6) |
| P1       | Stream and virtualize large CSV previews.                                   | [#4](https://github.com/Grenguar/brainarium-editor/issues/4) |
| P1       | Add native and Docker MCP protocol smoke tests.                             | [#5](https://github.com/Grenguar/brainarium-editor/issues/5) |
| P1       | Verify Windows/Linux packaging before a release tag.                        | [#7](https://github.com/Grenguar/brainarium-editor/issues/7) |
| P1       | Make Graphify documentation rebuilds deterministic.                         | [#8](https://github.com/Grenguar/brainarium-editor/issues/8) |
| Planned  | Import or paste vault-owned images into `<vault>/images`.                   | [#9](https://github.com/Grenguar/brainarium-editor/issues/9) |

</details>

## Develop, verify, contribute

```sh
pnpm run quality
```

Start with the [contributor guide](CONTRIBUTING.md), then use the
[documentation map](docs/README.md) for product requirements, UX, architecture,
contracts, decisions, and release operations.

---

Brainarium is built for people who want their notes to remain plain files—and
for agents that should earn exactly the authority they need.
