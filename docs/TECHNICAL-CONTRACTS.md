# Brainarium technical contracts

Status: normative MVP contracts, 2026-08-25.

## Markdown fidelity

Markdown text is the persisted representation. Reading and assisted editing are views over it. Support CommonMark/GFM headings, lists, task items, block quotes, fenced code, tables, links, images, frontmatter display, and documented wiki-links. Preserve newline convention, final-newline state, whitespace outside an explicit edit, frontmatter text, unknown syntax, and unrecognized source. Raw Source is available for every document. Raw HTML, scripts, Mermaid, and remote embeds are inert; rendered HTML is sanitized.

Milestone 0 must keep golden fixtures for CRLF/LF, malformed frontmatter, reference/inline links, escaped paths, fragments, nested lists/tasks, tables, code fences, duplicate titles, aliases, ambiguous wiki-links, case-sensitive volumes, local images, unknown syntax, external edits, formatter undo, and IME/selection behavior. An engine fails the MVP gate if it causes an unintended change, loses content, or cannot recover through Raw Source.

## Vault, watcher, and save behavior

The selected directory is the vault. Main-process file operations resolve a real path and check containment. Path traversal is rejected. A symlink may be followed only when its target remains inside the vault; external/unavailable targets are shown as unavailable. Index only Markdown (`.md`, `.markdown`), CSV, plain text (`.txt`), JSON, XML, and HTML (`.html`, `.htm`); binary, invalid-UTF-8, and oversize files are never silently coerced. Markdown and CSV have dedicated views; TXT, JSON, XML, and HTML are inert, exact-source, read-only previews. Copy always re-reads the active, vault-bound document before placing its current text on the clipboard.

| Buffer state | Disk event | Required behavior |
|---|---|---|
| Clean | modify/rename/delete | Reconcile and reload or show a recoverable missing state |
| Dirty | modify | Freeze autosave; offer Compare, Reload Disk, or Keep Mine |
| Any | rename pairing uncertain | Reconcile from a fresh scan; never guess a link rewrite |
| Proposal pending | any version change | Mark proposal stale; block application until regenerated |

Saves use same-directory temporary replacement where supported and leave either the complete old or complete new file after interruption. Periodic reconciliation is the watcher-correctness backstop.

## Agent safety and protocol

The main process starts `codex app-server` over JSONL stdio, keeps protocol stdout separate from redacted stderr diagnostics, scopes cwd to the active vault, and passes an explicit environment allowlist. It initializes before a thread/turn and normalizes native events. A native patch or tool request is never applied directly: it becomes a bounded `WorkspaceEdit`, is path/version-validated, and is shown as a proposal/diff.

| Capability | MVP behavior |
|---|---|
| Active selection/document | Allowed only after exact bounded context preview |
| Additional document | Explicit per-document opt-in |
| Vault search, shell, network, direct write | Denied |
| Reviewed text proposal | File service applies it after immediate revalidation |

`requested` approvals become `denied` on timeout, cancellation, disconnect, vault switch, app quit, stale base, malformed event, or policy violation. Nothing writes a vault file until a reviewed proposal is accepted. The implementation spike must set explicit context, file-count, queue-depth, and cancellation limits. Routine logs exclude document contents, credentials, and raw protocol payloads.

## Performance evidence

Record hardware, macOS version, filesystem, fixture-manifest hash, cold/warm state, p50/p95, and peak RSS. Targets are: first tree for 5,000 supported files in <=2 seconds; cached switch <=150 ms p95; responsive 10 MB Markdown; a non-blocking 250 MB CSV; graceful behavior for 10,000 files/1 GB text. Keep a sanitized real-vault compatibility corpus separate from synthetic scale fixtures. A missed target needs a dated waiver with result, root cause, mitigation, and re-measurement plan.
