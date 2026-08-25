# Brainarium contributor guide

This guide is intentionally short (under 200 lines). Read it before editing.

## Product boundary

Brainarium is a macOS-first, local-first Electron/Rust viewer and editor for a
user-selected vault. The vault is authoritative: preserve source fidelity,
vault boundaries, explicit agent-edit review, and renderer isolation. Never
create a proprietary vault format or silently rewrite unsupported Markdown.

Use **Brainarium** in user-facing text and `brainarium` in paths, package names,
examples, and identifiers.

## Start here

- Product/specification map: [docs/README.md](docs/README.md)
- Architecture and IPC/security boundaries: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Normative compatibility/performance contracts: [docs/TECHNICAL-CONTRACTS.md](docs/TECHNICAL-CONTRACTS.md)
- Local development, testing, and MCP startup: [CONTRIBUTING.md](CONTRIBUTING.md)
- Rust per-vault MCP: [brainarium-mcp/README.md](brainarium-mcp/README.md)
- Native release packages and tags: [docs/RELEASING.md](docs/RELEASING.md)
- Electron setup, local run, and packaging: [docs/BUILDING-ELECTRON-APPS.md](docs/BUILDING-ELECTRON-APPS.md)

## Working rules

- Support only `.md`, `.csv`, `.txt`, `.json`, `.xml`, and `.html` in the vault
  UI and MCP unless a product contract is deliberately extended.
- Canonicalize every vault path; reject traversal, hidden `.brainarium` cache
  access, and symlinks where the relevant contract requires it.
- Keep Electron's renderer sandboxed. Expose only validated, typed preload IPC;
  never expose Node, arbitrary filesystem access, or shell execution.
- Markdown source is canonical. Rendering must be sanitized and inert; raw HTML
  is never executable. CSV is read-only in v1.
- MCP is a separate Rust stdio process with one configured `BRAINARIUM_VAULT`.
  It works without Electron, and direct writes remain opt-in and version-checked.
- `.brainarium/graph-v1.json` is derived cache data, not vault content. Do not
  hand-edit it or let it enter vault listings, search, or MCP operations.
- Preserve unrelated working-tree changes. Do not reset, clean, delete, or
  overwrite user files without explicit authorization.

## Documentation and decisions

- Read [docs/OPEN-DECISIONS.md](docs/OPEN-DECISIONS.md) before choosing an
  unresolved behavior. Add an ADR in [docs/adr](docs/adr) when a cross-cutting
  decision is closed; update the linked technical contract at the same time.
- `.planning/graphs/` is derived documentation. After structural documentation
  changes, rebuild it with Graphify; never hand-edit graph artifacts.
- Do not claim Context7 verification without a successful record in
  [docs/CONTEXT7-VERIFICATION.md](docs/CONTEXT7-VERIFICATION.md).

## Commands and validation

```sh
npm ci
npm run dev
npm run quality
npm run make
```

`npm run quality` is the mandatory implementation gate: format, lint, type
check, full TypeScript/Rust tests, strict Clippy, and production package. Run
focused and relevant IPC/filesystem/packaged-app integration tests as well.
Use `npm ci`, never `npm run ci`.

For MCP changes, run from `brainarium-mcp`:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release
```

## GitHub and releases

- Every implementation PR uses exactly one `type:*`, `area:*`, and `priority:*`
  label; see [.github/labels.yml](.github/labels.yml).
- Add a user-visible entry to [CHANGELOG.md](CHANGELOG.md), or use
  `changelog:skip` only for the documented exceptions.
- Do not create or move a release tag casually. `vX.Y.Z` must match
  `package.json`, then [release.yml](.github/workflows/release.yml) produces
  signed/notarized Apple Silicon and Intel DMGs plus native Windows/Linux
  packages after protected Apple secrets are available. The full setup is
  [docs/RELEASING.md](docs/RELEASING.md).
