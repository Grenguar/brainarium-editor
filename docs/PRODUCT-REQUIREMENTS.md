# Brainarium product requirements

Status: proposed MVP, 2026-08-25.

## Problem

The second brain is a useful set of ordinary files, but using it requires terminal tools or a general-purpose editor. Brainarium should open any folder in place, provide a focused Reading/Editing experience, reveal connections, and let agents help inside the document without introducing a proprietary storage format.

The current corpus uses nested folders, YAML frontmatter, tasks, relative Markdown links, and wiki-links. Those conventions must remain interoperable with Finder, Git, shell tools, Obsidian, and other editors.

## Goals

1. Open or switch to any folder-backed vault and show useful content within two seconds for a normal personal vault.
2. Provide a clean rendered Reading mode and a discoverable, Markdown-native Editing mode.
3. Read CSV as a usable table.
4. Navigate links, backlinks, and document relationships.
5. Let Codex answer, rewrite, expand, and propose edits at the cursor or selection.
6. Establish extension contracts for future editor features and agents without allowing arbitrary renderer privileges.

## Non-goals for v1

- Cloud sync, collaboration, mobile/web apps, accounts, or hosted storage.
- CSV editing or spreadsheet formulas.
- Perfect Typora-compatible WYSIWYG or Notion-compatible block behavior.
- Automatic vault-wide RAG, embeddings, or sending the entire vault to an agent.
- Community plugin execution, automatic link rewriting on rename, or a global graph.
- Mac App Store distribution; Developer ID signing/notarization is the first target.

## Core user stories

- As a vault owner, I can choose any folder, reopen recent vaults, and switch without moving files.
- As a reader, I can view fully rendered Markdown without editor syntax.
- As a writer, I can type Markdown shortcuts such as `# `, `- `, `1. `, `> `, and `- [ ] ` and see the block take on its semantic form.
- As a writer, I can select text and apply italic, bold, strike, code, highlight, or link formatting.
- As a writer, I can use right-click or `/` to insert headings, lists, tasks, quotes, code blocks, rules, images, links, and tables.
- As a writer, I can fall back to raw Markdown for syntax the assisted editor does not understand.
- As a data reader, I can inspect CSV in a virtualized table.
- As a navigator, I can open Markdown/wiki-links and see broken, ambiguous, incoming, and outgoing connections.
- As an agent user, I can ask Codex inline and choose whether to insert, replace, discard, or apply a reviewed multi-range edit.
- As a user of other editors, I see external changes without losing my own work.

## P0 requirements and acceptance criteria

### Vaults

**VLT-01 Choose any folder.** Use the native macOS directory picker; the selected directory remains the source of truth.

- Cancel changes nothing.
- Unreadable/missing folders produce a recoverable error.
- Brainarium creates no files inside the vault in v1.

**VLT-02 Switch and remember vaults.** Store display name, path, and last-opened time in app data.

- Reopen the last available vault on launch.
- Switching stops the old watcher and closes active document/agent state safely.
- Remove from Recents never deletes the folder.
- An unavailable vault offers Locate Again or Remove.

**VLT-03 Enforce the boundary.** Validate real paths in the main process. Follow symlinks only when their targets remain in the vault; never accept path traversal.

### Discovery and connections

**IDX-01 Supported content.** Index `.md`, `.markdown`, and `.csv` case-insensitively. Ignore `.git`, `node_modules`, caches, and hidden files by default.

**IDX-02 Resilient metadata.** Derive relative path, filename, title/first heading, frontmatter, mtime, size, and content hash. Malformed frontmatter must still open as text.

**IDX-03 External changes.** Recursively watch and debounce create, modify, rename, and delete events; periodically reconcile because watchers can lose events.

**IDX-04 Quick Open.** `Cmd+P` opens a title/path-only picker over the current vault. It does not require a full-text index; full-text search remains P1.

**LNK-01 Links.** Support relative/vault-relative Markdown links, heading fragments, `[[note]]`, `[[path/note]]`, `[[note#heading]]`, and aliases.

Wiki-link resolution order:

1. Exact relative path from the source document.
2. Exact vault-relative path.
3. Unique normalized basename or title.
4. Otherwise show broken or ambiguous; never choose arbitrarily.

**LNK-02 Connections panel.** Show outgoing links and backlinks for the active Markdown document with status and navigation.

### Reading and editing

**EDT-01 Reading mode.** Render GFM, headings, lists, tasks, tables, quotes, code, frontmatter, wiki-links, and local images. Sanitize raw HTML; never execute scripts or remote pages.

**EDT-02 Assisted Editing mode.** Edit Markdown through a semantic presentation while preserving Markdown as the persisted representation.

- `# ` through `###### ` at a new block create heading levels.
- `- `, `* `, `1. `, `> `, triple backticks, and `- [ ] ` create their corresponding blocks.
- Formatting commands wrap/toggle selected Markdown and are undoable.
- Inactive syntax may be dimmed/hidden only when cursor mapping remains correct; the active block exposes enough source to understand and repair it.
- Unknown/unsupported constructs remain editable as raw Markdown and are never dropped.

**EDT-03 Formatting UI.** A selection bubble menu and context menu offer Italic, Bold, Strike, Inline Code, Highlight, Link, Ask Codex, Rewrite, and Explain. Keyboard shortcuts remain canonical.

**EDT-04 Insert UI.** Right-click and `/` open a searchable element menu. P0 items: paragraph, H1-H6, bullet/number/task list, quote, code block, horizontal rule, link, image reference, and Markdown table. Insert Table asks for rows, columns, and header row, then writes valid GFM Markdown.

**EDT-05 Save safely.** Autosave after 750 ms idle and on blur. Track the base hash/mtime; if disk changed, stop and show Keep Mine, Reload Disk, and Compare. Preserve newline style and final newline unless edited.

**EDT-06 Mode switching.** The top bar has Reading and Editing controls with shortcuts. Switching preserves scroll/selection as closely as possible. Raw Source is an Editing-mode escape hatch, not a third primary product mode.

### CSV

**CSV-01 Read-only table.** Parse UTF-8 quoted values, separators, and embedded newlines in a worker/stream; render a virtualized grid.

- Parse errors identify the row and allow Open as Raw Text.
- Large files do not block the renderer.
- Editing is clearly unavailable rather than silently ignored.

### Codex and agents

**AGT-01 Inline entry.** `Cmd+K` opens a prompt anchored to the selection or current block and previews the context to be sent.

**AGT-02 Structured actions.** Built-in Codex actions include Ask, Continue, Rewrite, Shorten, Expand, Fix grammar, Change tone, Explain, and Generate table. Each action maps to the same provider-neutral request model.

**AGT-03 Local Codex transport.** Detect `codex`, spawn `codex app-server` via stdio, initialize it, normalize streaming events, and expose actionable auth/connection errors. Do not scrape a terminal UI.

**AGT-04 Explicit application.** Stream into an inline card. Single-range results offer Insert Below/Replace/Discard. Multi-range or multi-file results use an Apply Diff review with per-hunk acceptance and one-step undo.

**AGT-05 Safe defaults.** Codex is vault-scoped and read-only by default. Approval requests fail closed in v1. Disconnect/timeout/app close denies pending approvals. The UI says that a local Codex process may call a remote model.

**AGT-06 Extensible contract.** Editor and agent contributions register through manifests:

- Editor commands: id, label, placement, shortcut, applicable selection/block types, execute.
- Agent actions: id, label, context policy, prompt/template, output type.
- Agent providers: capabilities, start/send/approve/interrupt/close and normalized events.
- All privileged extension work executes outside the renderer and receives declared capabilities only.

### Themes and app behavior

**THM-01 Themes.** Ship independently authored Brainarium Light and Brainarium Dark; Default follows macOS. Persist and apply immediately.

**THM-02 Tokens.** Use stable semantic CSS variables for background, surface, text, muted, accent, borders, selection, code, sidebar, hover, and editor typography.

**APP-01 Safe close.** Flush non-conflicting saves and prompt for conflicts or running agent proposals before vault switch/quit.

**APP-02 Accessibility.** Primary actions are keyboard reachable; visible focus, semantic labels, contrast, and reduced motion are required.

## P1 requirements

- Full-text search.
- Split Reading/Editing view and local/global graphs.
- Rich table cell editing with deterministic Markdown serialization.
- Safe rename with link-update preview.
- Opt-in linked-document/vault retrieval for agents.
- Persistent agent conversations and user-defined action templates.
- Independently selectable app-chrome and writing themes plus CSS overrides.
- Sandboxed signed extension packages and a capability manager.

## Non-functional targets

- First tree visible in <=2 s for 5,000 supported files; cached document switch <=150 ms p95.
- Design envelope: 10,000 files, 1 GB text, 10 MB Markdown, 250 MB CSV.
- Renderer sandbox and context isolation on; Node integration off.
- One validated preload method per capability; no generic IPC/filesystem bridge.
- Every cache/index is disposable and rebuildable from the vault.
- Parser, index, or AI failures cannot block reading, editing, or saving other files.
- Interrupted save leaves the complete prior or complete new file, never a partial file.

## Open questions with defaults

| Question | Default for planning |
|---|---|
| CodeMirror assisted Markdown or Tiptap/ProseMirror rich document? | CodeMirror first for fidelity; phase-zero round-trip spike can overturn this |
| How Notion-like should v1 blocks be? | Shortcuts and menus, no drag/reorder block handles yet |
| Custom Rust in v1? | No; keep a backend port and extract only with performance evidence |
| Whole-vault Codex access? | No automatic context; read-only search only after explicit user opt-in |
| Conversation persistence? | Ephemeral per-document sessions in v1 |
| CSV editing? | Read-only until concrete workflows justify it |

## Release definition

MVP is ready when all P0 flows pass against a fixture vault and the real second brain, no conflict test loses data, representative Markdown round-trips without unsupported constructs disappearing, and inline Codex works against both a fake protocol server and one live local installation.
