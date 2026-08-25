# Contributing to Brainarium

## Local development

Prerequisites: macOS, Node 22, Rust stable, and npm. From the repository root:

```sh
npm ci
npm run dev
```

Electron Forge starts the sandboxed desktop shell and recompiles the main,
preload, renderer, and packaged Rust indexer as source changes. Quit the app or
press `Ctrl+C` in the terminal to stop it. Do not use `npm run ci`: npm treats
that as its destructive dependency-reset command. The correct clean install
command is `npm ci`.

Use `npm run test:watch` while changing unit-tested code. `npm run quality`
runs the formatter check, linter, type check, complete TypeScript and Rust test
suites, strict Rust Clippy, and production package. `npm run make` creates an
unsigned local DMG and ZIP under `out/make/`; see [docs/RELEASING.md](docs/RELEASING.md)
for the signed GitHub-release path.

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
Claude Desktop, and per-vault configuration instructions.

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
