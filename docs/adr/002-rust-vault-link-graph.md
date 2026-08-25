# ADR-002: First-party Rust vault link graph

Status: accepted — 2026-08-25.

## Context

Brainarium needs an Obsidian-style, local/global Markdown graph for every opened vault. The original optional Graphify integration produced a code-oriented result that was not appropriate for Markdown vault navigation. The graph must work without an LLM, preserve Markdown source exactly, and remain available without a cloud service.

The user explicitly asked for the app to keep the graph inside the opened vault. That conflicts with the earlier broad preference to avoid a proprietary vault format unless the stored item is clearly disclosed, derived, versioned, and disposable.

## Decision

Use a packaged Rust CLI, `brainarium-indexer`, invoked by the Electron main process only for the active vault and only after an explicit Build/Open or Refresh action. It scans Markdown files, resolves unambiguous wiki and local Markdown links, returns a validated JSON graph, and atomically writes `.brainarium/graph-v1.json` inside the selected vault.

The file is a versioned cache, not user content: it is rebuilt from source, ignored by the scanner, never parsed as a note, and may be deleted safely. The indexer refuses a symlinked `.brainarium` directory, receives a canonical vault path and a `PATH`-only environment, and never writes Markdown. React renders the graph with a WebGL force-directed view; visual positions are not persisted in this first slice.

## Consequences

- Brainarium owns its Markdown graph semantics and has no Graphify, LLM, provider, or network dependency for graphing.
- A new visible folder can appear in a user vault only after the disclosed graph action. Its cache schema needs forward-compatible migration rules.
- Electron packaging must include and launch the Rust binary on supported platforms.
- Lexical vault search stays independent. Vector search, a graph database, richer parsing, watch refresh, and persisted layout require separate measured decisions.
