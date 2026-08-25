# Brainarium implementation plan

Status: proposed execution plan, 2026-08-25.

Assumption: one experienced engineer, macOS-first, iterative local releases. Estimates are ranges for sequencing, not commitments.

## Milestone 0 — risk spikes (2–4 days)

### Work

- Scaffold Electron Forge + TypeScript + React with secure defaults.
- Open the real second-brain folder and render a basic tree.
- Build representative Markdown fixtures from the corpus: frontmatter, tasks, wiki-links, relative links, tables, nested lists, fenced code, images, malformed YAML, and unknown syntax.
- Prototype CodeMirror assisted headings, selection italic, slash/context table insertion, and raw-source toggle.
- Prototype ProseMirror/Tiptap on the same fixtures and measure serialization changes.
- Spawn `codex app-server`, initialize, start one turn, stream text, interrupt, and capture stderr.
- Package a local `.app` and verify relaunch/file access.

### Exit gate

- Editor engine decision recorded with fixture diffs and accessibility/cursor findings.
- Codex integration uses structured protocol, not terminal scraping.
- Secure packaged app opens a user-selected folder.
- Any architecture change happens now, before feature implementation.

## Milestone 1 — application and vault foundation (3–5 days)

### Work

- Electron window, native menus, preload types, IPC schemas, CSP, sandbox, navigation guards.
- Native Choose Folder, recent vaults, reopen/switch/remove/locate flows.
- Path canonicalization, vault-boundary checks, symlink policy.
- Recursive scan, supported-type filter, tree model, watcher, periodic reconciliation.
- Settings store under app data; no `.brainarium` vault files.
- Light/Dark/System theme tokens and basic shell layout.

### Exit gate

- Switch repeatedly between fixture vaults and the real brain without stale events.
- Permission, missing folder, symlink escape, and large-tree tests pass.
- Renderer cannot call Node/filesystem or arbitrary IPC.

## Milestone 2 — Reading, Editing, and CSV (6–10 days)

### Reading

- Markdown AST pipeline, GFM, frontmatter view, custom wiki-links, sanitized HTML.
- Controlled local asset loading and validated external links.
- Reading/Editing mode control with scroll restoration.

### Editing

- Assisted and raw CodeMirror configurations behind `EditorAdapter`.
- Markdown shortcuts and semantic decorations.
- Selection bubble menu, right-click groups, slash registry, keyboard commands.
- Text transactions for formatting and block transforms.
- Table insertion dialog; raw-source fallback.
- Autosave, base versions, external conflict sheet, compare/reload/keep flow.

### CSV

- Streaming parser, virtualized grid, parse errors, raw-text fallback.

### Exit gate

- All supported fixture documents round-trip with no unintended changes.
- Each formatting action is undoable and produces valid Markdown.
- External edit during autosave never silently overwrites either version.
- 250 MB CSV opens incrementally without renderer hangs on reference hardware.

## Milestone 3 — links and navigation (3–5 days)

### Work

- Metadata/link parser in worker, deterministic resolver, reverse-edge index.
- Link navigation and heading fragments.
- Connections panel with outgoing/backlink/broken/ambiguous states.
- Browser-like back/forward history.
- Deliver title/path Quick Open as the P0 `IDX-04` picker; full-text search remains P1.

### Exit gate

- Link fixture accuracy >=99%; duplicate basenames never resolve arbitrarily.
- External create/rename/delete updates tree and connections within 500 ms after debounce.
- Index can be deleted and rebuilt entirely from files.

## Milestone 4 — Codex and agent extension seam (5–8 days)

### Work

- Provider-neutral request/event/session interfaces.
- Bundled action registry: Ask, Continue, Rewrite, Shorten, Expand, Grammar, Tone, Explain, Generate table.
- Codex discovery/version diagnostics and generated protocol-schema compatibility fixture.
- App-server lifecycle, streaming, cancel, disconnect, restart/backoff.
- Bounded context preview and explicit linked-context opt-in placeholder.
- Inline proposal card and Insert/Replace/Discard.
- `WorkspaceEdit` diff review, per-hunk accept, version revalidation, undo.
- Deny approval requests by default and show explanatory events.
- Fake app-server for deterministic tests.

### Exit gate

- Editing/saving works with Codex missing, unauthenticated, slow, crashed, and producing malformed events.
- No AI output changes a file before explicit apply.
- Stale-base proposals cannot apply.
- Live smoke test completes one inline insert using a local Codex installation.

## Milestone 5 — polish and distribution (3–5 days)

### Work

- Empty/loading/error/conflict/offline states; menu and shortcut audit.
- Keyboard-only and screen-reader pass; reduced motion and contrast.
- Performance profiling on 5k/10k file synthetic vaults.
- App icon, About, diagnostics export with redaction.
- Developer ID signing, notarization, update strategy, clean-machine smoke test.
- User-facing privacy and local-Codex disclosure.

### Exit gate

- P0 acceptance suite green on a packaged build.
- Cold start/tree and document-switch targets met or explicitly waived with evidence.
- No unsigned/unnotarized artifact is presented as a production release.

## Suggested repository structure

```text
brainarium/
├── docs/
├── src/
│   ├── main/
│   │   ├── vault/
│   │   ├── files/
│   │   ├── index/
│   │   ├── agents/
│   │   ├── extensions/
│   │   └── ipc/
│   ├── preload/
│   ├── renderer/
│   │   ├── app/
│   │   ├── editor/
│   │   ├── reading/
│   │   ├── csv/
│   │   ├── navigation/
│   │   ├── agents/
│   │   └── themes/
│   └── shared/
│       ├── contracts/
│       └── schemas/
├── tests/
│   ├── fixtures/vaults/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── forge.config.ts
```

If Rust is extracted later, add `crates/brainarium-core` and `crates/brainarium-sidecar`; do not fork business rules between TypeScript and Rust.

## Test strategy

### Unit

- Path containment and symlink cases.
- Frontmatter tolerance, link extraction/resolution, heading fragments.
- Formatting commands and Markdown shortcuts as input/output text transactions.
- CSV quoting/delimiter/error cases.
- Agent native-to-normalized event mapping and schema drift.

### Integration

- Temporary vault scan/watch/reconcile.
- Atomic save, crash/interruption, external conflict, newline preservation.
- Renderer-to-main IPC validation and unauthorized path rejection.
- Fake Codex server lifecycle, cancel, approval, overload, malformed message, crash, reconnect.
- Extension manifest/capability enforcement and ID collision.

### End-to-end

- Choose → browse → Read → Edit → save → reopen.
- Shortcut heading, italic selection, slash table insert, raw-source recovery.
- Follow wiki-link → view backlink → back navigation.
- Switch vault with save/conflict/agent states.
- Inline Codex → stream → replace → undo.
- CSV open and scroll large fixture.

### Manual packaged checks

- Clean macOS user, no development tools.
- Vault on local disk, iCloud Drive, removable disk, and a read-only folder.
- Dark/light/system appearance changes.
- IME, VoiceOver, keyboard-only, large text, and reduced motion.
- Codex missing, installed but logged out, and authenticated.

## Risk register

| Risk | Impact | Mitigation / trigger |
|---|---|---|
| Assisted Markdown cursor/IME bugs | High | Phase-zero spike; always keep raw source; reduce hidden syntax before sacrificing correctness |
| Rich editor normalizes source | High | Golden round-trip fixtures; CodeMirror default; opaque/raw fallback |
| External edits race autosave | High | Base hashes, conflict stop, compare/reload/keep tests |
| Codex app-server protocol changes | Medium/High | Generate schemas from installed version, adapter boundary, compatibility tests, useful diagnostics |
| Agent writes beyond intent | High | Proposal-only edits, path/version validation, read-only defaults, fail-closed approvals |
| Electron renderer compromise | High | Sandbox/context isolation/CSP, no Node, narrow validated bridge, sanitized Markdown |
| Watcher drops events | Medium | Periodic reconciliation and manual refresh |
| Electron Forge Vite churn | Medium | Prefer stable webpack template or pin exact Vite plugin and keep migration note |
| Rust extraction creates duplicate logic | Medium | One `CoreBackend` contract; move a component fully, not partially |
| Typora theme reuse ambiguity | Medium | Independently author CSS/assets and record third-party licenses |

## Delivery order after MVP

1. Quick Open/full-text search and safe rename preview.
2. Rich table editing and split view.
3. Local/global graph.
4. Opt-in agent retrieval across selected documents.
5. Persistent agent threads and user-defined actions.
6. Capability-managed extension packages.
7. Rust core extraction only if benchmarks justify it.
