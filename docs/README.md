# Brainarium planning documentation

Status: proposed MVP specification, 2026-08-25.

Brainarium is a macOS-first, local-first editor and viewer for folder-based knowledge vaults. It combines a minimal Typora-like writing surface, Obsidian-style vaults and links, Notion-like editing assistance, and extensible agent actions starting with local Codex.

## Recommended direction

Build the first usable release with Electron and TypeScript:

- Sandboxed React renderer and a typed preload bridge.
- Two explicit document modes: rendered **Reading** and assisted Markdown **Editing**.
- CodeMirror 6 is the initial editor hypothesis; ADR-001's phase-zero fidelity and accessibility gate may select a different engine.
- Markdown shortcuts, selection toolbar, and insert/context menus for headings, lists, tasks, quotes, code, links, images, tables, and agents.
- Electron main process for vault access, file watching, indexing, and Codex process supervision.
- `codex app-server` over JSONL/stdio behind a provider-neutral agent adapter.
- Read-only CSV table viewing plus exact-source previews for plain text, JSON, XML, and HTML.
- In-memory, rebuildable document/link index; extract a Rust sidecar only after profiling.

If custom Rust from day one is non-negotiable, Tauri v2 is cleaner than Electron plus a custom Rust sidecar. The requested Electron design and the alternatives are compared in [ARCHITECTURE.md](ARCHITECTURE.md).

## MVP in one sentence

Choose any folder, browse its supported text files (Markdown, CSV, plain text, JSON, XML, and HTML), read or edit Markdown with rich assistance, follow links and backlinks, switch vaults, and ask Codex at the cursor or selection before explicitly applying its proposed text.

## Document map

| Document | Purpose |
|---|---|
| [PRODUCT-REQUIREMENTS.md](PRODUCT-REQUIREMENTS.md) | Scope, requirements, acceptance criteria, metrics, and open questions |
| [UX-SPEC.md](UX-SPEC.md) | Layout, Reading/Editing modes, themes, menus, connections, and agent interactions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technology decision, components, data model, IPC, extensions, security, and file safety |
| [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) | Milestones, work breakdown, tests, risks, and release gates |
| [RESEARCH.md](RESEARCH.md) | Evidence from the current brain, Typora, Hermes, Obsidian, Electron, editor frameworks, Codex, and Tauri |
| [OPEN-DECISIONS.md](OPEN-DECISIONS.md) | Unvalidated defaults and evidence needed to close them |
| [CONTEXT7-VERIFICATION.md](CONTEXT7-VERIFICATION.md) | Context7 status and required verification record |
| [TECHNICAL-CONTRACTS.md](TECHNICAL-CONTRACTS.md) | Normative source-fidelity, vault, agent, and performance contracts |
| [adr/001-editor-engine-gate.md](adr/001-editor-engine-gate.md) | Editor-engine decision gate |
| [GITHUB-ACTIONS-PLAN.md](GITHUB-ACTIONS-PLAN.md) | Staged CI, security, release, label-sync, and branch-protection plan |

## Default MVP decisions

- Vaults are ordinary user-selected folders; Brainarium never imports or relocates them.
- Reading mode is rendered; Editing mode is assisted Markdown with rich shortcuts and controls.
- Markdown remains the saved format. Unsupported syntax always has a raw-source escape hatch.
- CSV is read-only in v1; TXT, JSON, XML, and HTML are exact-source, read-only previews in v1.
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
