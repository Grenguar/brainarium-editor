# ADR-006: Safe MCP folder creation and source-derived graph queries

Status: accepted, 2026-08-26.

## Context

The original external MCP could create a supported file only when its parent
directory already existed. That made ordinary vault authoring fail for an agent
that needed to introduce a note in a new, valid folder. Agents also need the
same resolved-link information as Brainarium's graph without receiving direct
access to the derived `.brainarium` cache.

## Decision

Keep the existing fixed-vault, explicit-write, supported-format, hidden-path,
symlink, size, and optimistic-version boundaries. Add two opt-in write
operations:

- `create_directory` creates a requested non-hidden relative directory tree and
  is idempotent. It requires `BRAINARIUM_MCP_ALLOW_WRITE=true`.
- `write_file` accepts `createParents: true` when a single supported file and
  all of its missing non-hidden parent folders should be created together. The
  default remains `false` so the request is deliberate. Existing-file
  replacement still requires `expectedVersion`.

Add read-only `vault_graph` and `file_connections` tools. They use the shared
Rust indexer's source-only graph builder at query time, rather than reading or
writing `.brainarium/graph-v1.json`. The existing indexer continues to be the
only component that writes the disposable graph cache.

## Consequences

- Agents can build legitimate vault structure without an arbitrary filesystem
  capability, directory deletion, rename, or hidden-path access.
- A graph query is current with source even when the cache does not exist, but
  has the cost of scanning Markdown at request time.
- MCP consumers receive deterministic resolved links and titles, while the
  cache remains an implementation detail rather than vault content.
