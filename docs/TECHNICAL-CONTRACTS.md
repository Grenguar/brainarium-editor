# Brainarium technical contracts

Status: normative MVP contracts, 2026-08-25.

## Markdown fidelity

Markdown text is the persisted representation. Reading and assisted editing are views over it. Support CommonMark/GFM headings, lists, task items, block quotes, fenced code, tables, links, images, frontmatter display, and documented wiki-links. Preserve newline convention, final-newline state, whitespace outside an explicit edit, frontmatter text, unknown syntax, and unrecognized source. Raw Source is available for every document. Raw HTML, scripts, Mermaid, and remote embeds are inert; rendered HTML is sanitized.

Milestone 0 must keep golden fixtures for CRLF/LF, malformed frontmatter, reference/inline links, escaped paths, fragments, nested lists/tasks, tables, code fences, duplicate titles, aliases, ambiguous wiki-links, case-sensitive volumes, local images, unknown syntax, external edits, formatter undo, and IME/selection behavior. An engine fails the MVP gate if it causes an unintended change, loses content, or cannot recover through Raw Source.

## Vault, watcher, and save behavior

The selected directory is the vault. Main-process file operations resolve a real path and check containment. Path traversal is rejected. A symlink may be followed only when its target remains inside the vault; external/unavailable targets are shown as unavailable. Index Markdown (`.md`, `.markdown`), CSV, plain text (`.txt`), JSON, XML, HTML (`.html`, `.htm`), and image files (`.avif`, `.gif`, `.jpeg`, `.jpg`, `.png`, `.webp`). Text formats remain UTF-8 only; images are limited to 25 MB and must match an approved extension and content signature before their bytes reach the renderer. A native image import validates the selected bytes, atomically places them under `images/<active-note-parent-path>/`, removes the original only after that placement succeeds, reuses identical bytes, and inserts a vault-relative Markdown reference; name collisions never overwrite different data. Markdown and CSV have dedicated views; TXT, JSON, XML, and HTML are inert, exact-source, read-only previews; images are inert, read-only fit/zoom previews. Images remain excluded from full-text search, MCP reads/writes, and copy-content actions. Copy always re-reads the active, vault-bound text document before placing its current text on the clipboard.

| Buffer state     | Disk event               | Required behavior                                         |
| ---------------- | ------------------------ | --------------------------------------------------------- |
| Clean            | modify/rename/delete     | Reconcile and reload or show a recoverable missing state  |
| Dirty            | modify                   | Freeze autosave; offer Compare, Reload Disk, or Keep Mine |
| Any              | rename pairing uncertain | Reconcile from a fresh scan; never guess a link rewrite   |
| Proposal pending | any version change       | Mark proposal stale; block application until regenerated  |

Saves use same-directory temporary replacement where supported and leave either the complete old or complete new file after interruption. The main process uses native recursive events as a fast path, debounces them for 350 ms, and reconciles every three seconds as a correctness backstop. A clean open file reloads from the fresh scan; a dirty Markdown editor remains untouched and shows an external-change notice. A missing open file becomes a recoverable missing state.

Markdown review state is bounded application-support data, keyed by the canonical vault path; it never becomes vault content or enters version control. The first reconciliation establishes a per-file reviewed baseline without reporting a change. Later external Markdown changes preserve that baseline and surface a readable block-level comparison until the person explicitly marks the file reviewed. The comparison includes whole affected prose, list, quote, code, or table blocks, with word-level emphasis where useful; it does not imply acceptance, rejection, or a write to the vault.

## Rebuildable link graph and search

Brainarium's vault navigation graph is first-party and deterministic: an explicitly invoked, packaged Rust indexer reads active-vault Markdown only, resolves explicit wiki and local Markdown links only when targets are unambiguous, and retains only resolved edges. It ignores dot-directories, invalid UTF-8, symlinks, inline code, and fenced code. It needs no LLM.

After validating the selected root and refusing a symlinked `.brainarium` directory, the indexer atomically writes the versioned, non-authoritative cache `.brainarium/graph-v1.json` within that same vault. The UI identifies this file before the user invokes the build action. It is disposable and must be rebuilt solely from Markdown source; it is never indexed as a document, never modifies source files, and failure leaves navigation, reading, editing, copying, and search available. Once this cache exists, an externally changed Markdown file triggers a debounced automatic rebuild and pushes the fresh graph to an open graph view; changes to other supported types do not rebuild the graph. The Electron main process supplies only the canonical active-vault path and a `PATH`-only environment, then validates every node and edge before exposing a typed graph to the renderer.

The initial global search is local, case-insensitive lexical search across supported documents; it returns bounded result metadata, match counts, and source snippets over the typed preload bridge. Semantic/vector search and graph persistence beyond the derived cache are later, benchmark-gated capabilities rather than dependencies of opening, searching, or graphing a vault.

## External Brainarium MCP

`brainarium-mcp` is a separately installed Rust stdio server, not a renderer bridge and not the built-in Codex adapter. Its authoritative per-process configuration lives outside a vault: `BRAINARIUM_VAULT` names one canonical active vault and `BRAINARIUM_MCP_ALLOW_WRITE=true` opts into write authority. Switching vaults requires starting a new process with the new explicit configuration; the server never accepts a client-supplied root or exposes configuration mutation as an MCP tool.

MCP file and directory paths are normalized and non-hidden relative paths. The server rejects absolute paths, traversal, symlinks, unsupported extensions, oversize reads/writes, and direct `.brainarium` access. `create_directory` is write-authorized and idempotently creates a requested non-hidden directory tree. `write_file` creates missing parents only when `createParents=true`; it otherwise reports the missing directory. It returns exact bytes/text with a SHA-256 version; replacing an existing file requires that version, performs a same-directory atomic replacement, and fails on a stale version. A successful Markdown write rebuilds the shared graph cache when enabled. Read-only `vault_graph` and `file_connections` derive resolved links directly from Markdown source and never read or modify `.brainarium/graph-v1.json`. JSON-RPC is stdout-only; redacted operational diagnostics are stderr-only.

This is intentional authority separation: the built-in Codex provider remains proposal-only under this document's agent contract, while an owner who installs `brainarium-mcp` and configures `read-write` for a vault grants that MCP server direct, capability-scoped write access. The MCP exposes no delete, rename, shell, network, arbitrary-folder, or graph-cache mutation tools.

## Distribution boundary

Release builds run on their native target OS: unsigned macOS DMG and ZIP
artifacts for Apple Silicon and Intel, a Windows x64 Squirrel Setup `.exe`, and
Linux x64 `.deb` and `.rpm` packages. A release is published only after every
package job succeeds; the version tag must equal `package.json`. Native
installers never include a vault, an MCP configuration, or a user-specific
filesystem permission. macOS, Windows, and Linux artifacts are unsigned in the
initial release policy, so their installer provenance is the GitHub Release
checksum until their respective signing decisions are closed.

## Agent safety and protocol

The main process starts `codex app-server` over JSONL stdio, keeps protocol stdout separate from redacted stderr diagnostics, scopes cwd to the active vault, and passes an explicit environment allowlist. It initializes before a thread/turn and normalizes native events. A native patch or tool request is never applied directly: it becomes a bounded `WorkspaceEdit`, is path/version-validated, and is shown as a proposal/diff.

| Capability                                 | MVP behavior                                         |
| ------------------------------------------ | ---------------------------------------------------- |
| Active selection/document                  | Allowed only after exact bounded context preview     |
| Additional document                        | Explicit per-document opt-in                         |
| Vault search, shell, network, direct write | Denied                                               |
| Reviewed text proposal                     | File service applies it after immediate revalidation |

`requested` approvals become `denied` on timeout, cancellation, disconnect, vault switch, app quit, stale base, malformed event, or policy violation. Nothing writes a vault file until a reviewed proposal is accepted. The implementation spike must set explicit context, file-count, queue-depth, and cancellation limits. Routine logs exclude document contents, credentials, and raw protocol payloads.

## Performance evidence

Record hardware, macOS version, filesystem, fixture-manifest hash, cold/warm state, p50/p95, and peak RSS. Targets are: first tree for 5,000 supported files in <=2 seconds; cached switch <=150 ms p95; responsive 10 MB Markdown; a non-blocking 250 MB CSV; graceful behavior for 10,000 files/1 GB text. Keep a sanitized real-vault compatibility corpus separate from synthetic scale fixtures. A missed target needs a dated waiver with result, root cause, mitigation, and re-measurement plan.
