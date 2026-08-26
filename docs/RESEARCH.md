# Brainarium research notes

Research date: 2026-08-25. Primary/official sources were preferred. Facts below are separated from Brainarium recommendations.

## Current second-brain corpus

Local inspection of `/Users/igorsoroka/development/brain` found:

- 39 Markdown files and no CSV files yet.
- YAML frontmatter with fields such as title, date, tags, client, status, and source.
- Wiki-links such as `[[agentic-development]]` and normal relative Markdown links.
- Markdown task checkboxes are an intentional source-of-truth workflow.
- Nested folders for clients, notes, transcripts, life, and internal company material.
- Plain-file interoperability is explicitly part of the brain's operating model.

Implications: the first real vault is small, but link resolution, frontmatter tolerance, task fidelity, and exact file preservation matter more than a sophisticated database. CSV requires dedicated fixtures because the current vault cannot validate it.

## Typora

### Findings

- The public [`typora` GitHub organization](https://github.com/typora) is not the application source. It contains default-theme/support/theme-tooling repositories; the commercial app is distributed as binaries.
- Default themes are separate CSS files plus optional asset folders: [`typora-default-themes/themes`](https://github.com/typora/typora-default-themes/tree/master/themes).
- Typora documents a CSS-first theme system, semantic editor selectors, variables, and layered overrides: [About Themes](https://support.typora.io/About-Themes/), [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/), and [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/).
- It supports separate light/dark selections and `prefers-color-scheme` behavior.
- The old [theme toolkit](https://github.com/typora/typora-theme-toolkit) is deprecated because internal classes can change.
- The default-theme repository has no clear reuse license in its root. Typora's [license agreement](https://support.typora.io/License-Agreement/) applies to the application.

### Brainarium recommendation

Copy the system idea, not code/assets: stable Brainarium-owned semantic tokens/classes, bundled Light/Dark themes, system default, and future global/theme-specific user overrides. Independently author every bundled theme unless a source has an explicit compatible license.

## Obsidian

### Findings

- A vault is an ordinary local folder containing Markdown/plain-text notes, folders, attachments, and a local `.obsidian` configuration directory. External editors can modify files: [Data storage](https://obsidian.md/help/data-storage).
- Vault Switcher supports opening a folder as a vault and managing recent vaults: [Manage vaults](https://obsidian.md/help/manage-vaults).
- It supports wiki-links and Markdown links, backlinks, and graph/local graph views: [Files and links settings](https://obsidian.md/help/settings), [Backlinks](https://obsidian.md/help/plugins/backlinks), [Graph view](https://obsidian.md/help/plugins/graph).
- CSV is not a native editable note format; the official importer converts CSV into Markdown/Base structures: [File formats](https://obsidian.md/help/file-formats), [CSV import](https://obsidian.md/help/import/csv).
- Extensibility uses TypeScript/CSS core/community plugins and themes; Restricted Mode disables community plugins: [Plugins](https://obsidian.md/help/plugins), [Developer docs](https://docs.obsidian.md/).

### Brainarium recommendation

Keep the vault authoritative and indexes disposable. Ship backlinks/outgoing links before a graph. Treat CSV as a first-class read-only viewer rather than pretending it is Markdown. Use an internal contribution registry from v1, but postpone arbitrary plugin loading until capabilities and isolation are designed.

## Notion-like behavior

The user requirement is not a clone of Notion's storage model. The valuable behaviors are discoverability:

- slash insert menu;
- selection bubble toolbar;
- block transformations and keyboard shortcuts;
- context-aware agent actions;
- structured edit proposals.

Brainarium should implement those over Markdown text transactions. Drag handles, arbitrary nested proprietary blocks, collaboration, and database blocks are outside v1.

## Editor frameworks

### CodeMirror 6

CodeMirror is a modular text editor whose state remains text. Its official docs show extensions, selection/document transactions, dynamic configuration, tooltips/panels, and multiple decoration types. Decorations can style lines, mark ranges, insert widgets, or replace visible text while keeping editor state: [Docs](https://codemirror.net/docs/), [Examples](https://codemirror.net/examples/), [Decorations](https://codemirror.net/examples/decoration/).

Brainarium fit: strongest fidelity and raw-source recovery; Typora-like live presentation is custom engineering, especially tables, cursor mapping, IME, and accessibility.

### ProseMirror and Tiptap

ProseMirror represents content as a schema-controlled tree with transactions, nodes, marks, and input rules: [Guide](https://prosemirror.net/docs/guide/). Its [Markdown example](https://prosemirror.net/examples/markdown/) provides Markdown parsing/serialization and a WYSIWYM view.

Tiptap wraps ProseMirror in a modular, headless API and supplies nodes/marks, menus, input rules, tables, and custom extensions: [Tiptap overview](https://tiptap.dev/docs/editor/getting-started/overview), [Table extension](https://tiptap.dev/docs/editor/extensions/nodes/table). Current Tiptap docs label its first-party Markdown area beta.

Brainarium fit: fastest route to Notion-like rich blocks and menus, but a structured model/serializer may normalize whitespace or fail to represent unknown Markdown. It needs a corpus round-trip gate before adoption.

### Decision

Prototype both in milestone zero. Default to CodeMirror assisted Markdown because source fidelity is P0. Use Tiptap only if representative vault fixtures round-trip safely or unsupported syntax has an opaque/raw escape hatch.

## Package legitimacy audit

Before the rendered Markdown reader was added, Brainarium checked the published package metadata and the maintainers' public source repositories, then pinned the accepted release line in `package-lock.json` rather than accepting floating ranges.

| Package | Pinned version | Public source/provenance | Accepted role |
| --- | --- | --- | --- |
| [`react-markdown`](https://github.com/remarkjs/react-markdown) | 10.1.0 | remark collective React renderer | CommonMark AST-to-React pipeline without `dangerouslySetInnerHTML` |
| [`remark-gfm`](https://github.com/remarkjs/remark-gfm) | 4.0.1 | remark collective | GFM tables, task lists, strikethrough, autolinks, and footnotes |
| [`remark-frontmatter`](https://github.com/remarkjs/remark-frontmatter) | 5.0.0 | remark collective | Recognize frontmatter while Brainarium preserves its exact source |
| [`rehype-raw`](https://github.com/rehypejs/rehype-raw) | 7.0.0 | rehype collective | Parse raw HTML before sanitization, never directly into the DOM |
| [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize) | 6.0.0 | rehype collective | Apply Brainarium's narrow semantic allowlist after raw HTML parsing |
| [`github-slugger`](https://github.com/Flet/github-slugger) | 2.0.0 | github-slugger maintainer | Stable GitHub-style heading IDs for vault fragments |

The Electron Webpack build is the compatibility gate because these rendering packages are ESM. Their use remains bounded by the renderer's strict sanitizer, a sandboxed preload bridge, and source-preserving Reading/Editing separation.

## Hermes Agent and extensibility

### Findings

- Hermes centralizes orchestration and normalizes providers into an internal format: [Agent loop](https://hermes-agent.nousresearch.com/docs/developer-guide/agent-loop), [Provider runtime](https://hermes-agent.nousresearch.com/docs/developer-guide/provider-runtime).
- Provider adapters isolate credentials, message/tool conversion, response normalization, usage, and finish reasons: [Adding providers](https://hermes-agent.nousresearch.com/docs/developer-guide/adding-providers).
- Tools self-register with schema, handler, availability, env requirements, and metadata; plugins may register tools, hooks, commands, memory, and context engines: [Tools runtime](https://hermes-agent.nousresearch.com/docs/developer-guide/tools-runtime), [Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture).
- External integration is protocol-oriented (ACP/gateway/API), and MCP supports local stdio and remote HTTP: [Programmatic integration](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration), [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).
- Hermes passes explicitly configured MCP variables plus a safe baseline rather than the whole environment and documents approval/protected-path/session controls: [Security](https://hermes-agent.nousresearch.com/docs/user-guide/security).

### Brainarium recommendation

Separate editor action registration, provider adaptation, context policy, transport, and permission enforcement. Menus should consume registries rather than hard-coded Codex actions. Future extensions receive capabilities and return commands/proposals; they do not receive unrestricted renderer or filesystem access.

## OpenAI Codex local integration

### Findings

- [`codex app-server`](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) is the structured interface used for rich Codex clients. It supports bidirectional JSON-RPC-like messages, with newline-delimited stdio as the supported default; WebSocket is experimental.
- Lifecycle is initialize, thread start/resume, turn start, streamed item/turn notifications, completion, and interrupt.
- It sends approval requests from server to client for commands/patches. Clients must decide explicitly.
- It can generate version-matched TypeScript and JSON Schema artifacts using `generate-ts` and `generate-json-schema`.
- The alternative [`codex mcp-server`](https://github.com/openai/codex/blob/main/codex-rs/docs/codex_mcp_interface.md) is explicitly experimental.
- Hermes itself contains a Codex app-server transport, confirming the stdio adapter pattern: [`codex_app_server.py`](https://github.com/NousResearch/hermes-agent/blob/main/agent/transports/codex_app_server.py).

### Brainarium recommendation

Spawn app-server, keep protocol stdout separate from diagnostic stderr, normalize events, and retain native metadata. Use ephemeral/read-only vault-scoped turns initially. Deny approvals by default, but design a visible approval event for later. Use proposals/diffs rather than allowing direct writes.

## Electron

### Findings

- Electron separates privileged main and sandboxed renderer processes; filesystem/process work should cross IPC: [Process model](https://www.electronjs.org/docs/latest/tutorial/process-model), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc).
- Official security guidance requires current Electron, context isolation, sandboxing, disabled Node integration for untrusted content, navigation controls, and IPC sender validation: [Security](https://www.electronjs.org/docs/latest/tutorial/security), [Context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation).
- The native dialog supports `openDirectory`; Mac App Store packages can request security-scoped bookmarks: [dialog API](https://www.electronjs.org/docs/latest/api/dialog).
- Electron Forge supplies first-party webpack/vite TypeScript templates and packaging. Its Vite plugin is documented as experimental: [Forge getting started](https://www.electronforge.io/), [Vite template](https://www.electronforge.io/templates/vite).

### Brainarium recommendation

Electron is the quickest requested shell, provided the renderer stays sandboxed and gets a narrow typed bridge. Use the stable Forge path for distribution or pin Vite deliberately. Sanitize rendered Markdown because local files are still untrusted input.

## Tauri and Rust option

Tauri v2 uses a Rust core and OS webview, with capability-scoped filesystem and sidecar access: [Architecture](https://v2.tauri.app/concept/architecture/), [Capabilities](https://v2.tauri.app/security/capabilities/), [Filesystem](https://v2.tauri.app/plugin/file-system/), [Sidecars](https://v2.tauri.app/develop/sidecar/).

Original recommendation: choose Tauri instead of Electron if owning the core in Rust and binary size are stronger requirements than fastest Electron delivery. This was superseded for the narrowly scoped, deterministic vault graph by [ADR-002](adr/002-rust-vault-link-graph.md); Electron remains the shell and Rust has no document-write authority.

## macOS file/distribution considerations

- Electron's dialog can select directories; security-scoped bookmark output is specific to Mac App Store packaging.
- Apple documents persistent security-scoped bookmarks for sandboxed access to user-selected folders: [App Sandbox file access](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox).
- Developer ID distribution is the lower-complexity v1 route. Signing/notarization still needs a clean-machine verification phase.

## Context7 verification status

The user requested a Context7 documentation check. Three resolution attempts were made for Electron, CodeMirror, and OpenAI Codex. The connector rejected each request with: `Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix.`

No Context7 result was treated as evidence. Once its key is repaired, rerun checks for:

1. Electron security, IPC, directory dialog, Forge packaging/signing.
2. CodeMirror Markdown, decorations, commands, IME/accessibility constraints.
3. Codex app-server lifecycle, current v2 schemas, approvals, and cancellation.

The architecture currently relies on the official sources linked above.

## Final synthesis

- Use Electron/TypeScript for the requested fast MVP.
- Use Reading + Assisted Editing + raw-source escape hatch.
- Start with CodeMirror but make editor choice a measured phase-zero gate.
- Model Notion-like controls as text transactions and extension contributions.
- Keep Obsidian's folder-as-vault and connection concepts without creating a proprietary vault.
- Adopt Typora's semantic theme principles without copying unlicensed assets.
- Adopt Hermes' provider/tool/transport separation for agents.
- Drive Codex through app-server and make every agent edit an explicit proposal.
