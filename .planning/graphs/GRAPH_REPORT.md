# Graph Report - brainarium  (2026-08-25)

## Corpus Check
- 56 files · ~97,842 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 560 nodes · 873 edges · 32 communities (26 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4d0a98cf`
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

## God Nodes (most connected - your core abstractions)
1. `VaultError` - 24 edges
2. `Vault` - 23 edges
3. `Communities (20 total, 2 thin omitted)` - 18 edges
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
- `App()` --indirect_call--> `relativePath()`  [INFERRED]
  src/renderer/index.tsx → src/main/vault/vault-scanner.ts
- `openVault()` --calls--> `scanVault()`  [EXTRACTED]
  src/main/index.ts → src/main/vault/vault-scanner.ts

## Import Cycles
- None detected.

## Communities (32 total, 6 thin omitted)

### Community 0 - "Brainarium research notes"
Cohesion: 0.08
Nodes (26): Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium recommendation, Brainarium research notes, CodeMirror 6, Context7 verification status (+18 more)

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
Nodes (43): indexer(), markdownFingerprint(), openVault(), recentVaults(), refreshCachedGraphAfterMarkdownChange(), executeFile, IndexerOutput, RustIndexerService (+35 more)

### Community 7 - "Main components"
Cohesion: 0.05
Nodes (41): css-loader, electron, @electron-forge/cli, @electron-forge/maker-zip, @electron-forge/plugin-webpack, eslint, @eslint/js, fork-ts-checker-webpack-plugin (+33 more)

### Community 8 - "Milestone 2 — Reading, Editing, and CSV (6–10 days)"
Cohesion: 0.18
Nodes (32): BTreeMap, build_graph(), clean_link_target(), collect_markdown(), extract_line_links(), extract_links(), find_pair(), fingerprint() (+24 more)

### Community 9 - "Brainarium technical contracts"
Cohesion: 0.07
Nodes (28): Communities (20 total, 2 thin omitted), Community 0 - "Brainarium research notes", Community 10 - "[Unreleased]", Community 11 - "GitHub Actions plan", Community 12 - "main/index.ts", Community 13 - "compilerOptions", Community 14 - "RecentVaultStore", Community 15 - "csv-preview.tsx" (+20 more)

### Community 10 - "[Unreleased]"
Cohesion: 0.29
Nodes (5): Changelog, Contributing to Brainarium, Local development, Required checks, Required pull-request tags

### Community 11 - "GitHub Actions plan"
Cohesion: 0.06
Nodes (32): graphology, graphology-layout-forceatlas2, dependencies, graphology, graphology-layout-forceatlas2, react, react-dom, description (+24 more)

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
Cohesion: 0.11
Nodes (24): RFC-4180, sigma, sigma, relativePath(), candidates, cellValue(), csvDialectDirective(), CsvPreview() (+16 more)

### Community 16 - "webpack.main.config.js"
Cohesion: 0.33
Nodes (3): ForkTsCheckerWebpackPlugin, rules, rules

### Community 20 - "brainarium-mcp/src/main.rs"
Cohesion: 0.23
Nodes (15): Arc, as_mcp_error(), BrainariumVaultServer, encode(), FilePathParams, ListFilesParams, Option, Result (+7 more)

### Community 21 - "Brainarium MCP"
Cohesion: 0.22
Nodes (8): Brainarium MCP, Claude configuration examples, Configure one vault, Run directly with Cargo, Run in Docker, Run through uv, Safety boundary, Validation

### Community 22 - "Brainarium contributor guide"
Cohesion: 0.29
Nodes (7): Brainarium contributor guide, Current repository state, Naming, Product boundary, Quality gate (mandatory for implementation changes), Validation, Working rules

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

## Knowledge Gaps
- **251 isolated node(s):** `brainarium-mcp-launcher`, `{ MakerZIP }`, `{ WebpackPlugin }`, `name`, `productName` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `GitHub Actions plan` to `csv-preview.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `sigma` connect `csv-preview.tsx` to `GitHub Actions plan`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `brainarium-mcp-launcher`, `{ MakerZIP }`, `{ WebpackPlugin }` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Brainarium research notes` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Brainarium implementation plan` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Brainarium UX specification` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Brainarium architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._