# Graph Report - brainarium  (2026-08-26)

## Corpus Check
- 92 files · ~221,607 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 883 nodes · 1439 edges · 78 communities (50 shown, 28 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `683f64eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Brainarium research notes
- Brainarium implementation plan
- Brainarium UX specification
- Brainarium architecture
- Brainarium product requirements
- docs/README.md
- Brainarium contributor guide
- Main components
- Milestone 2 — Reading, Editing, and CSV (6–10 days)
- Brainarium technical contracts
- [Unreleased]
- GitHub Actions plan
- main/index.ts
- compilerOptions
- RecentVaultStore
- csv-preview.tsx
- webpack.main.config.js
- forge.config.js
- main.rs
- brainarium-mcp/src/main.rs
- Brainarium MCP
- Brainarium contributor guide
- [Unreleased]
- Brainarium technical contracts
- GitHub Actions plan
- Brainarium planning documentation
- ADR-003: Separate, capability-scoped Brainarium MCP
- ADR-002: First-party Rust vault link graph
- __init__.py
- brainarium-mcp-launcher
- vault-watcher.ts
- main/index.ts
- Brainarium — Engineering Onboarding
- vault.ts
- dependencies
- vault-reader.ts
- preload/index.ts
- ADR-004: Signed, notarized DMGs from immutable version tags
- Releasing Brainarium for macOS
- @electron-forge/maker-rpm
- @electron-forge/maker-squirrel
- @electron-forge/maker-zip
- @electron-forge/plugin-webpack
- eslint
- @eslint/js
- html-webpack-plugin
- prettier
- style-loader
- @types/electron-squirrel-startup
- @types/node
- @types/react
- @types/react-dom
- typescript
- typescript-eslint
- vitest
- webpack
- webpack-cli
- markdown-reading.tsx
- SourceBuffer
- RecentVaultStore
- vault-image-reader.ts
- vault-watcher.ts
- fork-ts-checker-webpack-plugin
- VaultSessionStore
- Brainarium UI/UX audit — 2026-08-26
- vault-scanner.ts
- VaultSnapshot
- ADR-006: Safe MCP folder creation and source-derived graph queries
- ADR-002: First-party Rust vault link graph
- workspace-shortcuts.spec.ts
- @electron-forge/cli
- @playwright/test
- ts-loader
- @types/mdast

## God Nodes (most connected - your core abstractions)
1. `Communities (80 total, 29 thin omitted)` - 48 edges
2. `VaultError` - 28 edges
3. `Vault` - 27 edges
4. `scripts` - 19 edges
5. `Brainarium architecture` - 14 edges
6. `Brainarium research notes` - 14 edges
7. `Brainarium UX specification` - 13 edges
8. `encode()` - 12 edges
9. `MarkdownInsertMenu` - 11 edges
10. `VaultSnapshot` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GraphConnection` --references--> `LinkKind`  [EXTRACTED]
  brainarium-mcp/src/lib.rs → rust/src/lib.rs
- `SigmaGraphPreview()` --references--> `sigma`  [EXTRACTED]
  src/renderer/index.tsx → package.json
- `App()` --indirect_call--> `relativePath()`  [INFERRED]
  src/renderer/index.tsx → src/main/vault/vault-scanner.ts
- `App()` --indirect_call--> `emptyDocumentSession()`  [INFERRED]
  src/renderer/index.tsx → src/renderer/document-session.ts
- `App()` --indirect_call--> `documentSessionReducer()`  [INFERRED]
  src/renderer/index.tsx → src/renderer/document-session.ts

## Import Cycles
- None detected.

## Communities (78 total, 28 thin omitted)

### Community 0 - "Brainarium research notes"
Cohesion: 0.07
Nodes (27): Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium research notes, CodeMirror 6, Context7 verification status (+19 more)

### Community 1 - "Brainarium implementation plan"
Cohesion: 0.07
Nodes (29): Brainarium implementation plan, CSV, Delivery order after MVP, Editing, End-to-end, Exit gate, Exit gate, Exit gate (+21 more)

### Community 2 - "Brainarium UX specification"
Cohesion: 0.08
Nodes (23): Accessibility and motion, Brainarium UX specification, Connections, CSV viewer, Editing mode, Entry points, Extension UX contract, File tree (+15 more)

### Community 3 - "Brainarium architecture"
Cohesion: 0.08
Nodes (26): Agent edit protocol, Agent provider contract, Brainarium architecture, Codex adapter, CSV pipeline, Data model, Decision summary, Editor and extension model (+18 more)

### Community 4 - "Brainarium product requirements"
Cohesion: 0.12
Nodes (16): Brainarium product requirements, Codex and agents, Core user stories, CSV, Discovery and connections, Goals, Non-functional targets, Non-goals for v1 (+8 more)

### Community 5 - "docs/README.md"
Cohesion: 0.06
Nodes (37): indexer(), markdownFingerprint(), openVault(), recentVaults(), refreshCachedGraphAfterMarkdownChange(), vaultSessions(), executeFile, IndexerOutput (+29 more)

### Community 6 - "Brainarium contributor guide"
Cohesion: 0.24
Nodes (3): ADR-001: Editor engine decision gate, Context7 verification register, Brainarium open decisions and validation register

### Community 8 - "Milestone 2 — Reading, Editing, and CSV (6–10 days)"
Cohesion: 0.18
Nodes (33): BTreeMap, build_graph(), build_vault_graph(), clean_link_target(), collect_markdown(), extract_line_links(), extract_links(), find_pair() (+25 more)

### Community 9 - "Brainarium technical contracts"
Cohesion: 0.04
Nodes (48): Communities (80 total, 29 thin omitted), Community 0 - "Brainarium research notes", Community 10 - "[Unreleased]", Community 11 - "GitHub Actions plan", Community 12 - "main/index.ts", Community 13 - "compilerOptions", Community 14 - "RecentVaultStore", Community 15 - "csv-preview.tsx" (+40 more)

### Community 10 - "[Unreleased]"
Cohesion: 0.33
Nodes (6): Changelog, Contributing to Brainarium, Local development, Local MCP, Required checks, Required pull-request tags

### Community 11 - "GitHub Actions plan"
Cohesion: 0.06
Nodes (31): author, description, engines, node, pnpm, homepage, license, main (+23 more)

### Community 12 - "main/index.ts"
Cohesion: 0.10
Nodes (38): AsRef, applies_the_configured_size_limit(), concurrent_directory_creation_is_idempotent(), creates_directories_without_following_symlinks(), DirectoryReceipt, extension_for(), FileConnections, FileContent (+30 more)

### Community 13 - "compilerOptions"
Cohesion: 0.12
Nodes (15): node, src/**/*.ts, src/**/*.tsx, vitest/globals, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, jsx (+7 more)

### Community 14 - "RecentVaultStore"
Cohesion: 0.29
Nodes (7): css-loader, @electron-forge/maker-dmg, @electron-forge/maker-squirrel, devDependencies, css-loader, @electron-forge/maker-dmg, @electron-forge/maker-squirrel

### Community 15 - "csv-preview.tsx"
Cohesion: 0.24
Nodes (13): RFC-4180, candidates, cellValue(), csvDialectDirective(), CsvPreview(), CsvRow, CsvTable, detectDelimiter() (+5 more)

### Community 16 - "webpack.main.config.js"
Cohesion: 0.33
Nodes (3): ForkTsCheckerWebpackPlugin, rules, rules

### Community 17 - "forge.config.js"
Cohesion: 0.22
Nodes (7): { MakerDeb }, { MakerDMG }, { MakerRpm }, { MakerSquirrel }, { MakerZIP }, process, { WebpackPlugin }

### Community 20 - "brainarium-mcp/src/main.rs"
Cohesion: 0.24
Nodes (15): Arc, as_mcp_error(), BrainariumVaultServer, encode(), FilePathParams, ListFilesParams, Option, Result (+7 more)

### Community 21 - "Brainarium MCP"
Cohesion: 0.22
Nodes (9): Brainarium MCP, Configure one vault, Docker MCP configuration, Run directly with Cargo, Run in Docker, Run through uv, Safety boundary, Validation (+1 more)

### Community 22 - "Brainarium contributor guide"
Cohesion: 0.29
Nodes (7): Brainarium contributor guide, Commands and validation, Documentation and decisions, GitHub and releases, Product boundary, Start here, Working rules

### Community 23 - "[Unreleased]"
Cohesion: 0.29
Nodes (7): Added, Changed, Changelog, Changelog rules, Fixed, Security, [Unreleased]

### Community 24 - "Brainarium technical contracts"
Cohesion: 0.25
Nodes (8): Agent safety and protocol, Brainarium technical contracts, Distribution boundary, External Brainarium MCP, Markdown fidelity, Performance evidence, Rebuildable link graph and search, Vault, watcher, and save behavior

### Community 25 - "GitHub Actions plan"
Cohesion: 0.33
Nodes (5): CI contract, GitHub Actions plan, Release safety, Repository protections to enable after the first green CI run, Workflow sequence

### Community 26 - "Brainarium planning documentation"
Cohesion: 0.33
Nodes (6): Brainarium documentation, Default MVP decisions, Document map, First implementation spike, MVP in one sentence, Recommended direction

### Community 28 - "ADR-003: Separate, capability-scoped Brainarium MCP"
Cohesion: 0.40
Nodes (4): ADR-003: Separate, capability-scoped Brainarium MCP, Consequences, Context, Decision

### Community 29 - "ADR-002: First-party Rust vault link graph"
Cohesion: 0.40
Nodes (4): ADR-005: Native packages on each supported desktop platform, Consequences, Context, Decision

### Community 32 - "vault-watcher.ts"
Cohesion: 0.50
Nodes (4): Building and running Electron apps, Create your own Electron Forge app, Package Brainarium for the current platform, Run Brainarium from this checkout

### Community 33 - "main/index.ts"
Cohesion: 0.17
Nodes (11): Add it to your AI client, Develop, verify, contribute, How it fits together, Make an installer for your platform, Model Context Protocol (MCP), Quick start, Roadmap, Run the desktop app (+3 more)

### Community 34 - "Brainarium — Engineering Onboarding"
Cohesion: 0.18
Nodes (10): Architecture, Brainarium — Engineering Onboarding, Build / test / run, Coding standards & conventions, Important notes & gotchas, Key directories & files, Overview, Pull-request requirements (+2 more)

### Community 35 - "vault.ts"
Cohesion: 0.47
Nodes (3): DocumentConflictPanel(), documentDetails(), SourcePane()

### Community 36 - "dependencies"
Cohesion: 0.05
Nodes (40): codemirror, @codemirror/commands, @codemirror/lang-markdown, @codemirror/state, @codemirror/view, electron-squirrel-startup, github-slugger, graphology (+32 more)

### Community 38 - "preload/index.ts"
Cohesion: 0.20
Nodes (15): BrainariumApi, ChooseVaultResult, Window, BrainariumAppInfo, DocumentSaveInput, DocumentSaveResult, ImageImportResult, RestoredVaultSession (+7 more)

### Community 39 - "ADR-004: Signed, notarized DMGs from immutable version tags"
Cohesion: 0.40
Nodes (4): ADR-004: Signed, notarized DMGs from immutable version tags, Consequences, Context, Decision

### Community 40 - "Releasing Brainarium for macOS"
Cohesion: 0.40
Nodes (5): Cut a release, Local packaging, One-time GitHub setup, Releasing Brainarium, What is shipped

### Community 42 - "@electron-forge/maker-squirrel"
Cohesion: 0.14
Nodes (16): relativePath(), App(), currentShortcutPlatform, defaultAppInfo, documentLabel(), findPositions(), graphScope(), IconName (+8 more)

### Community 59 - "markdown-reading.tsx"
Cohesion: 0.11
Nodes (28): exactCandidates(), markdownDocuments(), MarkdownLinkResolution, normalizePath(), ParsedTarget, resolved(), resolveMarkdownLink(), resolveWikiLink() (+20 more)

### Community 60 - "SourceBuffer"
Cohesion: 0.11
Nodes (15): InsertRange, MarkdownEditor, MarkdownEditorHandle, MarkdownEditorMode, MarkdownInsertMenu, filterMarkdownInsertCommands(), insertionSelection(), insertMarkdownAtRange() (+7 more)

### Community 61 - "RecentVaultStore"
Cohesion: 0.22
Nodes (5): isStoredRecentVault(), RecentVaultStore, StoredRecentVault, temporaryRoots, RecentVault

### Community 62 - "vault-image-reader.ts"
Cohesion: 0.30
Nodes (13): decodedLocalAssetPath(), expectedMimeType(), hasExpectedSignature(), importVaultImage(), isMissingError(), isPathInside(), MIME_BY_EXTENSION, readVaultImage() (+5 more)

### Community 63 - "vault-watcher.ts"
Cohesion: 0.26
Nodes (9): applySaveResult(), DocumentSessionAction, documentSessionReducer(), DocumentSessionState, DocumentSessionStatus, editDocumentSession(), emptyDocumentSession(), PendingSave (+1 more)

### Community 65 - "VaultSessionStore"
Cohesion: 0.22
Nodes (5): isScrollPositions(), isStoredVaultSession(), StoredVaultSession, temporaryRoots, VaultSessionStore

### Community 66 - "Brainarium UI/UX audit — 2026-08-26"
Cohesion: 0.14
Nodes (13): 1. Shell and accessibility foundation (P0), 2. Navigation and connections (P1), 3. Writer command model (P2), 4. Visual polish and release gate (P3), Brainarium UI/UX audit — 2026-08-26, Findings and recommendations, Implementation plan, P0 — correct before additional feature polish (+5 more)

### Community 67 - "vault-scanner.ts"
Cohesion: 0.18
Nodes (8): documentKind(), IGNORED_DIRECTORY_NAMES, isIgnoredDirectory(), isSupportedVaultDocument(), temporaryRoots, DocumentKind, VaultScanIssue, VaultTreeDirectory

### Community 69 - "ADR-006: Safe MCP folder creation and source-derived graph queries"
Cohesion: 0.40
Nodes (4): ADR-006: Safe MCP folder creation and source-derived graph queries, Consequences, Context, Decision

### Community 70 - "ADR-002: First-party Rust vault link graph"
Cohesion: 0.50
Nodes (4): ADR-002: First-party Rust vault link graph, Consequences, Context, Decision

### Community 74 - "@playwright/test"
Cohesion: 0.18
Nodes (10): Community Hubs (Navigation), Corpus Check, God Nodes (most connected - your core abstractions), Graph Freshness, Graph Report - brainarium  (2026-08-26), Import Cycles, Knowledge Gaps, Suggested Questions (+2 more)

## Knowledge Gaps
- **381 isolated node(s):** `brainarium-mcp-launcher`, `{ MakerDeb }`, `{ MakerDMG }`, `{ MakerRpm }`, `{ MakerSquirrel }` (+376 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `GitHub Actions plan`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `SigmaGraphPreview()` connect `dependencies` to `@electron-forge/maker-squirrel`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `brainarium-mcp-launcher`, `{ MakerDeb }`, `{ MakerDMG }` to the rest of the system?**
  _381 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Brainarium research notes` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Brainarium implementation plan` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Brainarium UX specification` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Brainarium architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._