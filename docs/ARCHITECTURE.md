# Brainarium architecture

Status: proposed MVP architecture, 2026-08-25.

## Decision summary

Use Electron + TypeScript for the MVP. Keep the renderer sandboxed, put filesystem/process privileges in the main process, and define ports around vault, index, editor contributions, and agent providers. Do not add custom Rust until profiling identifies a component worth extracting.

This is a delivery decision, not a rejection of Rust. Electron plus a Rust sidecar combines two custom runtimes and a supervision protocol; Tauri is the more coherent option if Rust must own the application core from day one.

## Shell options

| Option | Time to usable MVP | Strengths | Costs | Verdict |
|---|---:|---|---|---|
| Electron + TypeScript | Fastest | One language across shell/UI, mature web editor ecosystem, direct filesystem/subprocess APIs, Forge packaging | Large bundle; strict Electron security discipline required | **MVP choice** |
| Electron + Rust sidecar | Medium | Rust can own parsing/index/search and isolate failures | Two custom runtimes, RPC, lifecycle/debug/packaging overhead | Extract later if measured |
| Tauri v2 + TypeScript UI | Medium | Natural Rust core, smaller binary, explicit capabilities | Different webviews, more Rust integration/setup, not the requested Electron plan | Best Rust-first alternative |

## High-level design

```text
┌──────────────────── Electron renderer (sandboxed) ────────────────────┐
│ React shell │ File tree │ Read renderer │ Editor host │ CSV │ Panels │
│                         contribution + agent-action registries        │
└──────────────────────── typed contextBridge API ──────────────────────┘
                                  │ validated IPC
┌───────────────────────── Electron main process ───────────────────────┐
│ Window/menu │ Vault service │ File service │ Index coordinator       │
│ Settings    │ Watcher       │ Extension host │ Agent provider host    │
└───────────────┬───────────────────┬──────────────────────┬────────────┘
                │ worker messages   │ JSONL stdio          │ filesystem
          ┌─────▼─────┐       ┌─────▼──────────┐       ┌──▼──────────┐
          │ index     │       │ codex          │       │ selected    │
          │ worker    │       │ app-server     │       │ vault       │
          └───────────┘       └────────────────┘       └─────────────┘
```

The renderer never receives arbitrary filesystem or process APIs. It receives immutable data and narrow operations.

## Suggested stack

- Electron Forge with TypeScript. The Vite plugin is currently documented as experimental; use the first-party webpack-typescript template for the stable build path, or pin the Vite template during the spike if its speed matters more.
- React for component composition.
- CodeMirror 6 for the default assisted/raw Markdown editor.
- `unified`/`remark-parse`/`remark-gfm` plus a custom wiki-link plugin for rendered Reading mode and link extraction.
- A strict sanitizer such as `rehype-sanitize` before renderer output.
- Pure-JS streaming CSV parser plus a virtualized table.
- `chokidar` or a small watcher adapter in the main process, with reconciliation.
- Zod or equivalent runtime schemas at every IPC and agent boundary.
- Electron Forge makers/signing/notarization for macOS artifacts.

Versions must be pinned after the implementation spike. Context7 verification was attempted but blocked by an invalid configured key; official documentation is the current evidence source.

## Editor engine decision

### Why CodeMirror first

The file text is the canonical editor state, so exact frontmatter, whitespace, unknown directives, and mixed syntax survive. CodeMirror extensions support syntax trees, commands, tooltips, panels, line/mark/widget/replacement decorations, and dynamic configuration. Those primitives can implement Typora-like visual assistance without HTML-to-Markdown round trips.

### What CodeMirror must prove

- Style headings/lists/quotes/code semantically.
- Reveal markers on the active block and optionally hide/dim them elsewhere.
- Maintain cursor, IME, selection, copy/paste, undo, and screen-reader behavior.
- Apply formatting and insert-block commands as deterministic text transactions.
- Render or assist GFM tables without corrupting source.

### ProseMirror/Tiptap alternative

ProseMirror provides schemas, input rules, commands, nodes, marks, and Markdown parser/serializer support. Tiptap wraps it with a modular extension API, selection menus, and tables, making the Notion-like UI faster. The cost is normalization: a structured document has one canonical representation and Markdown serialization may change whitespace or unsupported syntax. Tiptap's first-party Markdown surface is labeled beta in its current docs.

Phase zero must round-trip representative vault fixtures through both approaches. Switch to Tiptap only if it preserves all P0 syntax or has a safe opaque-node/raw-source strategy. Regardless of engine, the rest of the app talks to an `EditorAdapter`.

```ts
interface EditorAdapter {
  open(input: { path: string; text: string; version: string }): void;
  getText(): string;
  getSelection(): TextSelection;
  applyTransaction(tx: TextTransaction): void;
  setMode(mode: 'assisted' | 'source'): void;
  register(contribution: EditorContribution): Disposable;
}
```

## Main components

### Vault service

- Opens a directory selected through Electron's native dialog.
- Persists recent paths under `app.getPath('userData')`, not in the vault.
- Canonicalizes and authorizes every file operation against the active root.
- Treats recent entries as references; Remove never touches the folder.

### File service

- Reads supported UTF-8 files and returns text plus version metadata.
- Saves with base-version conflict detection and a same-directory temporary file/atomic replacement where supported.
- Preserves newline and final-newline behavior.
- Resolves local assets through a controlled custom protocol or validated byte API, never `file://` access exposed generally.

### Index worker

Runs off the renderer thread. It parses metadata and links, builds folder/document maps and reverse edges, and emits incremental snapshots. Its state is fully reconstructible.

MVP keeps the index in memory and may persist a versioned JSON snapshot under app data. Avoid a native SQLite dependency before it provides measured value. Full-text search or large-vault pressure can justify SQLite/Rust later.

### Watcher

Normalizes create/change/delete/rename events and debounces noisy sequences. On resume, watcher error, and a periodic interval, compare directory metadata with the index. Network/removable volumes can miss native events, so correctness cannot rely on notifications alone.

### Reading renderer

Parses Markdown into a controlled AST, resolves wiki/Markdown links through the index, sanitizes output, and renders only allowed local assets. It never executes raw HTML scripts or remote content.

### CSV pipeline

Streams/segments parsing outside the renderer UI loop and sends bounded row pages to a virtual grid. CSV documents have no save capability in v1.

## Data model

```ts
type VaultRecord = {
  id: string;               // hash/UUID associated with normalized path
  name: string;
  path: string;
  lastOpenedAt: string;
};

type DocumentRecord = {
  vaultId: string;
  relativePath: string;
  kind: 'markdown' | 'csv';
  title: string;
  frontmatter?: Record<string, unknown>;
  mtimeMs: number;
  size: number;
  hash: string;
  parseIssues: ParseIssue[];
};

type LinkEdge = {
  sourcePath: string;
  rawTarget: string;
  kind: 'markdown' | 'wiki' | 'image';
  targetPath?: string;
  fragment?: string;
  status: 'resolved' | 'broken' | 'ambiguous' | 'external';
  candidates?: string[];
};

type TextTransaction = {
  baseVersion: string;
  edits: Array<{ from: number; to: number; insert: string }>;
  origin: 'user' | 'command' | 'agent';
  label: string;
};
```

Document IDs must not be permanent content identity in v1 because files can move outside Brainarium. Relative paths plus content/version metadata are the practical keys.

## IPC surface

Expose named, schema-validated methods through preload, not `ipcRenderer` itself:

```text
vault.choose / vault.list / vault.open / vault.removeRecent
tree.snapshot / tree.subscribe
document.read / document.save / document.reveal
links.forDocument / links.resolve
csv.open / csv.page / csv.close
agent.providers / agent.start / agent.send / agent.approve / agent.interrupt
settings.get / settings.update
```

Validate sender frame, arguments, active vault, resolved target path, payload size, and response shape. Streaming subscriptions return unsubscribe functions and are cleaned up on navigation/window close.

## Editor and extension model

Brainarium uses internal extensions from the start so built-in menus exercise the same contracts future packages will use.

```ts
type Capability =
  | 'document.readActive'
  | 'document.proposeEdit'
  | 'vault.search'
  | 'vault.readSelected'
  | 'process.agentProvider'
  | 'ui.panel';

type EditorContribution = {
  id: string;
  owner: string;
  label: string;
  placements: Array<'slash' | 'context' | 'selection' | 'commandPalette'>;
  when: Applicability;
  capabilities: Capability[];
  execute: (ctx: CommandContext) => Promise<CommandResult>;
};
```

Rules:

- Contributions return text transactions or UI models, never mutate files directly.
- Agent/provider code runs in the main process or a supervised child/utility process, not the renderer.
- A future package manifest is signed/identified, versioned, and capability-scoped.
- Unknown extension data is namespaced; one extension cannot override a built-in ID silently.
- V1 loads only bundled extensions. Dynamic third-party loading is P2 after threat modeling.

## Agent provider contract

Inspired by Hermes' separation of orchestration, providers, tools, and transports:

```ts
interface AgentProvider {
  id: string;
  capabilities(): AgentCapabilities;
  start(config: ProviderConfig): Promise<ProviderSession>;
  send(sessionId: string, request: AgentRequest): AsyncIterable<AgentEvent>;
  approve(requestId: string, decision: 'allow-once' | 'deny'): Promise<void>;
  interrupt(sessionId: string, turnId?: string): Promise<void>;
  close(): Promise<void>;
}
```

Normalized events: `started`, `textDelta`, `reasoningDelta`, `toolStarted`, `toolFinished`, `approvalRequired`, `editProposal`, `completed`, and `failed`. Provider-native metadata is retained separately for diagnostics and forward compatibility.

### Codex adapter

1. Resolve a configured Codex binary or PATH entry and report its version.
2. Spawn `codex app-server --listen stdio://` (stdio is the supported initial transport).
3. Keep stdout exclusively for newline-delimited protocol messages; capture stderr diagnostics separately.
4. Perform `initialize`/`initialized`, then `thread/start` or `thread/resume`, and `turn/start`.
5. Map Codex thread/turn/item events to normalized events; map Brainarium Cancel to interrupt.
6. Generate TypeScript/JSON schemas from the installed Codex version during compatibility tests because the protocol evolves.
7. Scope cwd/workspace to the active vault and use read-only/fail-closed defaults.
8. Surface server-to-client approval requests; v1 answers deny. P1 may add reviewed, time-bounded approvals.

`codex mcp-server` is explicitly experimental and is not the primary adapter. Terminal scraping and `codex exec` lose structured approvals/session events and are fallback-only.

### Agent edit protocol

Agents propose `WorkspaceEdit` objects rather than writing files:

```ts
type WorkspaceEdit = {
  baseVersions: Record<string, string>;
  files: Array<{ path: string; edits: TextTransaction['edits'] }>;
  summary: string;
};
```

The main process revalidates paths and versions, the renderer previews diffs, and accepted hunks return to the file service. A stale base blocks apply and asks the agent/user to rebase.

## Security and privacy

- `nodeIntegration: false`, `contextIsolation: true`, renderer sandbox enabled.
- Packaged local UI only; deny renderer navigation and new windows.
- Validate IPC sender and expose narrow contextBridge functions.
- Sanitize rendered Markdown and URL schemes; external links go through the system browser allowlist.
- Never make user Markdown executable. Mermaid, HTML, plugins, or JS code blocks are inert in v1.
- Pass child processes an explicit environment allowlist plus required Codex variables; do not leak the entire shell environment into UI/logs.
- Keep protocol diagnostics on stderr and redact secrets before persisted logs.
- A local connector is not local inference; the context preview must make remote model use understandable.
- Mac App Sandbox security-scoped bookmarks matter if pursuing the Mac App Store; Developer ID distribution avoids making that a v1 dependency.

## Reliability and observability

- Structured local logs with component, vault id, relative path, operation, duration, and redacted error.
- No file contents in routine logs.
- Metrics are local unless the user explicitly opts in.
- Timeouts and bounded queues for indexing, CSV pages, IPC, and agent events.
- Kill supervised child processes on app exit; restart Codex only with bounded backoff.
- Crash recovery reopens the last vault/document but never auto-applies an unreviewed agent proposal.

## Rust extraction path

Keep a `CoreBackend` port around scan/watch/index/search/links. Extract it to a Rust JSONL sidecar if one of these is measured:

- initial/incremental indexing misses performance targets;
- full-text/semantic search needs a native index;
- watcher correctness needs platform-specific handling;
- parsing untrusted or very large inputs benefits from process isolation;
- the core will be reused outside Electron.

The sidecar should own indexing/search/graph first, not document writes or UI state. That bounds failure and avoids two competing save authorities.
