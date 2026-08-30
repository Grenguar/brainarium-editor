# Contributing to Brainarium

## Local development

Prerequisites: Node 24, Rust stable, and Corepack/pnpm. `.nvmrc` records the
required Node version but NVM is optional: use any Node 24 installation method
your system supports. Build and package an installer on the operating system
you target. From the repository root:

```sh
node --version # must report a Node 24 release
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Electron Forge starts the sandboxed desktop shell and recompiles the main,
preload, renderer, and packaged Rust indexer as source changes. Quit the app or
press `Ctrl+C` in the terminal to stop it. Use `pnpm install --frozen-lockfile`
for a reproducible dependency install; do not mix npm and pnpm lockfiles.

Use `pnpm run test:watch` while changing unit-tested code. `pnpm run quality`
runs the formatter check, linter, type check, complete TypeScript and Rust test
suites, strict Rust Clippy, and production package. `pnpm run make` creates the
native artifacts for the current host under `out/make/`: a macOS DMG/ZIP,
Windows Setup, Debian/Ubuntu `.deb`, or RPM `.rpm` as applicable. For the next
local installable build, use `pnpm run make:local-update`: it increments only
the patch version without a Git tag and then runs the native maker. See
[docs/BUILDING-ELECTRON-APPS.md](docs/BUILDING-ELECTRON-APPS.md) for the
package flow and [docs/RELEASING.md](docs/RELEASING.md) for protected releases.

### Ubuntu and other Linux development hosts

Electron must retain Chromium sandboxing. Before starting the app on Linux,
run:

```sh
pnpm run doctor:linux
```

The preflight succeeds when the host permits unprivileged user namespaces or
when Electron has a root-owned, setuid `chrome-sandbox` helper. A checkout's
`node_modules` normally does **not** own that helper, so do not run
`--no-sandbox`, `chmod`, or `chown` against it. If the preflight fails, ask
the system administrator to enable the distribution's supported user-namespace
policy. Alternatively, build and install Brainarium's native `.deb` or `.rpm`;
the installer, rather than an unprivileged development checkout, owns helper
permissions.

## Local MCP

The Rust MCP is independent of Electron; it can serve the configured vault even
when Brainarium is not running. Start it with one explicit vault:

```sh
cd brainarium-mcp
BRAINARIUM_VAULT="/absolute/path/to/vault" \
  BRAINARIUM_MCP_ALLOW_WRITE=true \
  uv run brainarium-mcp
```

See [brainarium-mcp/README.md](brainarium-mcp/README.md) for Cargo, Docker,
Claude Desktop, Claude Code, Codex, and per-vault configuration instructions.

## Required pull-request tags

Apply exactly one `type:*`, one `area:*`, and one `priority:*` label. Apply `status:*` labels only when they describe the current review state. The complete taxonomy is in [`.github/labels.yml`](.github/labels.yml).

## Changelog

Follow [CHANGELOG.md](CHANGELOG.md). A user-visible change needs an `Unreleased` entry; use `changelog:skip` only for the exceptions defined there.

## Required checks

Every implementation PR must run the same commands locally and in CI:

1. format check and lint;
2. type check;
3. focused and full unit tests;
4. production build;
5. affected integration/E2E tests.

Report exact commands and outcomes in the pull request. A failure needs either a fix or an explicitly approved waiver with a follow-up issue.
