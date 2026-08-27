# Brainarium documentation

Status: implementation and MVP specification, 2026-08-25.

Brainarium is a macOS-first, local-first editor and viewer for folder-based knowledge vaults. It combines a minimal Typora-like writing surface, Obsidian-style vaults and links, Notion-like editing assistance, and extensible agent actions starting with local Codex.

## Recommended direction

Build the first usable release with Electron and TypeScript:

- Sandboxed React renderer and a typed preload bridge.
- Two explicit document modes: rendered **Reading** and assisted Markdown **Editing**.
- CodeMirror 6 is the initial editor hypothesis; ADR-001's phase-zero fidelity and accessibility gate may select a different engine.
- Markdown shortcuts, selection toolbar, and insert/context menus for headings, lists, tasks, quotes, code, links, images, tables, and agents.
- Electron main process for vault access, file watching, indexing, and Codex process supervision.
- `codex app-server` over JSONL/stdio behind a provider-neutral agent adapter.
- Read-only CSV table viewing, fit/zoom image previews, and exact-source previews for plain text, JSON, XML, and HTML.
- A reader-first change-review surface: external Markdown edits are marked in the tree and compared as readable whole blocks until explicitly marked reviewed, without writing or accepting anything.
- A first-party Rust sidecar builds a deterministic Markdown link graph on demand. It stores only a rebuildable, versioned cache at `.brainarium/graph-v1.json` in the explicitly opened vault, refreshes that cache after a Markdown change once graphing is enabled, never changes source documents, and does not need an LLM.
- A separate Rust stdio MCP server can be explicitly configured for one selected vault. It is independent of the Electron renderer and exposes only bounded, version-checked file operations and the same no-LLM graph cache.

The requested Electron shell remains the application host; the narrow Rust sidecar is limited to local graph indexing. The decision and boundaries are recorded in [ADR-002](adr/002-rust-vault-link-graph.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## MVP in one sentence

Choose any folder, browse its supported documents (Markdown, CSV, plain text, JSON, XML, HTML, and common images), read or edit Markdown with rich assistance, follow links and backlinks, switch vaults, and ask Codex at the cursor or selection before explicitly applying its proposed text.

## Document map

| Document                                                       | Purpose                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md)             | Scope, requirements, acceptance criteria, metrics, and open questions                                    |
| [UX-SPEC.md](UX-SPEC.md)                                       | Layout, Reading/Editing modes, themes, menus, connections, and agent interactions                        |
| [ARCHITECTURE.md](ARCHITECTURE.md)                             | Technology decision, components, data model, IPC, extensions, security, and file safety                  |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)               | Milestones, work breakdown, tests, risks, and release gates                                              |
| [RESEARCH.md](RESEARCH.md)                                     | Evidence from the current brain, Typora, Hermes, Obsidian, Electron, editor frameworks, Codex, and Tauri |
| [OPEN-DECISIONS.md](OPEN-DECISIONS.md)                         | Unvalidated defaults and evidence needed to close them                                                   |
| [CONTEXT7-VERIFICATION.md](CONTEXT7-VERIFICATION.md)           | Context7 status and required verification record                                                         |
| [TECHNICAL-CONTRACTS.md](TECHNICAL-CONTRACTS.md)               | Normative source-fidelity, vault, agent, and performance contracts                                       |
| [adr/001-editor-engine-gate.md](adr/001-editor-engine-gate.md) | Editor-engine decision gate                                                                              |
| [GITHUB-ACTIONS-PLAN.md](GITHUB-ACTIONS-PLAN.md)               | Staged CI, security, release, label-sync, and branch-protection plan                                     |
| [RELEASING.md](RELEASING.md)                                   | Native macOS, Windows, and Linux packages; signing setup, version tags, and manual updates               |
| [BUILDING-ELECTRON-APPS.md](BUILDING-ELECTRON-APPS.md)         | Create a separate Electron app, run Brainarium locally, and make native platform packages                |

## Default MVP decisions

- Vaults are ordinary user-selected folders; Brainarium never imports or relocates them.
- Reading mode is rendered; Editing mode is assisted Markdown with rich shortcuts and controls.
- Markdown remains the saved format. Unsupported syntax always has a raw-source escape hatch.
- CSV is read-only in v1; TXT, JSON, XML, and HTML are exact-source, read-only previews; images are inert, read-only fit/zoom previews.
- Backlinks and outgoing links are P0; a global graph is P1.
- AI and agent changes are proposals. Files change only after explicit Insert, Replace, or Apply Diff.
- Codex runs vault-scoped and read-only by default; approval requests fail closed in v1.
- No proprietary Typora CSS/assets are copied.
- No account, sync service, cloud database, telemetry, or proprietary vault format is required.

## First implementation spike

Prove these boundaries before visual polish:

1. Select `/Users/igorsoroka/development/brain` and render its tree.
2. Round-trip representative frontmatter, wiki-links, tables, tasks, code, and unknown Markdown without unintended changes.
3. Demonstrate `# ` heading conversion, selection-to-italic, and table insertion in the editing surface.
4. Spawn `codex app-server`, complete initialization, and stream a non-persistent inline answer.
5. Package and launch a local macOS build with renderer sandboxing and context isolation enabled.
