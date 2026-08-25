# Graph Report - brainarium  (2026-08-25)

## Corpus Check
- 59 files · ~128,687 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 596 nodes · 918 edges · 41 communities (36 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dc3f5647`
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
- AGENTS.md
- ADR-003: Separate, capability-scoped Brainarium MCP
- ADR-002: First-party Rust vault link graph
- __init__.py
- brainarium-mcp-launcher
- vault-watcher.ts
- main/index.ts
- Brainarium — Engineering Onboarding
- VaultSnapshot
- index.tsx
- vault-reader.ts
- preload/index.ts
- ADR-004: Signed, notarized DMGs from immutable version tags
- Releasing Brainarium for macOS

## God Nodes (most connected - your core abstractions)
1. `Communities (32 total, 6 thin omitted)` - 26 edges
2. `VaultError` - 24 edges
3. `Vault` - 23 edges
4. `scripts` - 17 edges
5. `Brainarium architecture` - 14 edges
6. `Brainarium research notes` - 13 edges
7. `Brainarium UX specification` - 13 edges
8. `Graph Report - brainarium  (2026-08-25)` - 11 edges
9. `Brainarium implementation plan` - 11 edges
10. `build_graph()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `SigmaGraphPreview()` --references--> `sigma`  [EXTRACTED]
  src/renderer/index.tsx → package.json
- `as_mcp_error()` --references--> `VaultError`  [EXTRACTED]
  brainarium-mcp/src/main.rs → brainarium-mcp/src/lib.rs
- `BrainariumVaultServer` --references--> `Vault`  [EXTRACTED]
  brainarium-mcp/src/main.rs → brainarium-mcp/src/lib.rs
- `searchVault()` --calls--> `readVaultDocument()`  [EXTRACTED]
  src/main/vault/vault-search.ts → src/main/vault/vault-reader.ts
- `App()` --indirect_call--> `relativePath()`  [INFERRED]
  src/renderer/index.tsx → src/main/vault/vault-scanner.ts

## Import Cycles
- None detected.

## Communities (41 total, 5 thin omitted)

### Community 0 - "Brainarium research notes"
Cohesion: 0.08
Nodes (26): Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium research notes, CodeMirror 6, Context7 verification status (+18 more)

### Community 1 - "Brainarium implementation plan"
Cohesion: 0.07
Nodes (29): Brainarium implementation plan, CSV, Delivery order after MVP, Editing, End-to-end, Exit gate, Exit gate, Exit gate (+21 more)

### Community 2 - "Brainarium UX specification"
Cohesion: 0.09
Nodes (23): Accessibility and motion, Brainarium UX specification, Connections, CSV viewer, Editing mode, Entry points, Extension UX contract, File tree (+15 more)

### Community 3 - "Brainarium architecture"
Cohesion: 0.08
Nodes (26): Agent edit protocol, Agent provider contract, Brainarium architecture, Codex adapter, CSV pipeline, Data model, Decision summary, Editor and extension model (+18 more)

### Community 4 - "Brainarium product requirements"
Cohesion: 0.12
Nodes (16): Brainarium product requirements, Codex and agents, Core user stories, CSV, Discovery and connections, Goals, Non-functional targets, Non-goals for v1 (+8 more)

### Community 5 - "docs/README.md"
Cohesion: 0.16
Nodes (11): documentKind(), IGNORED_DIRECTORY_NAMES, isIgnoredDirectory(), isSupportedVaultDocument(), temporaryRoots, DocumentKind, VaultDocument, VaultScanIssue (+3 more)

### Community 7 - "Main components"
Cohesion: 0.05
Nodes (43): css-loader, electron, @electron-forge/cli, @electron-forge/maker-dmg, @electron-forge/maker-zip, @electron-forge/plugin-webpack, eslint, @eslint/js (+35 more)

### Community 8 - "Milestone 2 — Reading, Editing, and CSV (6–10 days)"
Cohesion: 0.18
Nodes (32): BTreeMap, build_graph(), clean_link_target(), collect_markdown(), extract_line_links(), extract_links(), find_pair(), fingerprint() (+24 more)

### Community 9 - "Brainarium technical contracts"
Cohesion: 0.05
Nodes (36): Communities (32 total, 6 thin omitted), Community 0 - "Brainarium research notes", Community 10 - "[Unreleased]", Community 11 - "GitHub Actions plan", Community 12 - "main/index.ts", Community 13 - "compilerOptions", Community 14 - "RecentVaultStore", Community 15 - "csv-preview.tsx" (+28 more)

### Community 10 - "[Unreleased]"
Cohesion: 0.33
Nodes (6): Changelog, Contributing to Brainarium, Local development, Local MCP, Required checks, Required pull-request tags

### Community 11 - "GitHub Actions plan"
Cohesion: 0.06
Nodes (35): graphology, graphology-layout-forceatlas2, dependencies, graphology, graphology-layout-forceatlas2, react, react-dom, sigma (+27 more)

### Community 12 - "main/index.ts"
Cohesion: 0.11
Nodes (32): AsRef, applies_the_configured_size_limit(), extension_for(), FileContent, FileInfo, is_markdown(), is_supported_file(), lists_only_supported_non_hidden_files() (+24 more)

### Community 13 - "compilerOptions"
Cohesion: 0.12
Nodes (15): node, src/**/*.ts, src/**/*.tsx, vitest/globals, compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, jsx (+7 more)

### Community 14 - "RecentVaultStore"
Cohesion: 0.22
Nodes (5): isStoredRecentVault(), RecentVaultStore, StoredRecentVault, temporaryRoots, RecentVault

### Community 15 - "csv-preview.tsx"
Cohesion: 0.24
Nodes (13): RFC-4180, candidates, cellValue(), csvDialectDirective(), CsvPreview(), CsvRow, CsvTable, detectDelimiter() (+5 more)

### Community 16 - "webpack.main.config.js"
Cohesion: 0.33
Nodes (3): ForkTsCheckerWebpackPlugin, rules, rules

### Community 17 - "forge.config.js"
Cohesion: 0.33
Nodes (4): { MakerDMG }, { MakerZIP }, process, { WebpackPlugin }

### Community 20 - "brainarium-mcp/src/main.rs"
Cohesion: 0.23
Nodes (15): Arc, as_mcp_error(), BrainariumVaultServer, encode(), FilePathParams, ListFilesParams, Option, Result (+7 more)

### Community 21 - "Brainarium MCP"
Cohesion: 0.25
Nodes (8): Brainarium MCP, Claude configuration examples, Configure one vault, Run directly with Cargo, Run in Docker, Run through uv, Safety boundary, Validation

### Community 22 - "Brainarium contributor guide"
Cohesion: 0.29
Nodes (7): Brainarium contributor guide, Commands and validation, Documentation and decisions, GitHub and releases, Product boundary, Start here, Working rules

### Community 23 - "[Unreleased]"
Cohesion: 0.29
Nodes (7): Added, Changed, Changelog, Changelog rules, Fixed, Security, [Unreleased]

### Community 24 - "Brainarium technical contracts"
Cohesion: 0.29
Nodes (7): Agent safety and protocol, Brainarium technical contracts, External Brainarium MCP, Markdown fidelity, Performance evidence, Rebuildable link graph and search, Vault, watcher, and save behavior

### Community 25 - "GitHub Actions plan"
Cohesion: 0.33
Nodes (5): CI contract, GitHub Actions plan, Release safety, Repository protections to enable after the first green CI run, Workflow sequence

### Community 26 - "Brainarium planning documentation"
Cohesion: 0.33
Nodes (6): Brainarium planning documentation, Default MVP decisions, Document map, First implementation spike, MVP in one sentence, Recommended direction

### Community 28 - "ADR-003: Separate, capability-scoped Brainarium MCP"
Cohesion: 0.40
Nodes (4): ADR-003: Separate, capability-scoped Brainarium MCP, Consequences, Context, Decision

### Community 29 - "ADR-002: First-party Rust vault link graph"
Cohesion: 0.50
Nodes (4): ADR-002: First-party Rust vault link graph, Consequences, Context, Decision

### Community 32 - "vault-watcher.ts"
Cohesion: 0.21
Nodes (7): isDerivedGraphPath(), OnSnapshot, Scan, snapshotFingerprint(), temporaryRoots, VaultWatcher, VaultWatcherOptions

### Community 33 - "main/index.ts"
Cohesion: 0.24
Nodes (8): indexer(), markdownFingerprint(), openVault(), recentVaults(), refreshCachedGraphAfterMarkdownChange(), scanVault(), searchVault(), roots

### Community 34 - "Brainarium — Engineering Onboarding"
Cohesion: 0.18
Nodes (10): Architecture, Brainarium — Engineering Onboarding, Build / test / run, Coding standards & conventions, Important notes & gotchas, Key directories & files, Overview, Pull-request requirements (+2 more)

### Community 35 - "VaultSnapshot"
Cohesion: 0.25
Nodes (7): executeFile, IndexerOutput, RustIndexerService, snapshot, validateGraph(), VaultLinkGraph, VaultSnapshot

### Community 36 - "index.tsx"
Cohesion: 0.27
Nodes (7): relativePath(), App(), findPositions(), graphScope(), MarkdownReading(), renderInline(), root

### Community 37 - "vault-reader.ts"
Cohesion: 0.44
Nodes (6): isPathInside(), readVaultDocument(), resolveDocument(), saveVaultDocument(), temporaryRoots, versionFor()

### Community 38 - "preload/index.ts"
Cohesion: 0.38
Nodes (5): BrainariumApi, ChooseVaultResult, Window, VaultDocumentContent, VaultSearchResult

### Community 39 - "ADR-004: Signed, notarized DMGs from immutable version tags"
Cohesion: 0.40
Nodes (4): ADR-004: Signed, notarized DMGs from immutable version tags, Consequences, Context, Decision

### Community 40 - "Releasing Brainarium for macOS"
Cohesion: 0.40
Nodes (5): Cut a release, Local packaging, One-time GitHub setup, Releasing Brainarium for macOS, What is shipped

## Knowledge Gaps
- **278 isolated node(s):** `brainarium-mcp-launcher`, `{ MakerDMG }`, `{ MakerZIP }`, `{ WebpackPlugin }`, `process` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SigmaGraphPreview()` connect `GitHub Actions plan` to `index.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `brainarium-mcp-launcher`, `{ MakerDMG }`, `{ MakerZIP }` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Brainarium research notes` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Brainarium implementation plan` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Brainarium UX specification` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Brainarium architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Brainarium product requirements` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._