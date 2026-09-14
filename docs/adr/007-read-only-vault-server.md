# ADR-007: Opt-in, loopback-bound read-only vault server

Status: proposed, 2026-09-09.

## Context

The owner wants to read an opened vault on a tablet. Brainarium has never opened a port or made a network call: there is no `createServer`, no `fetch`, and no server framework anywhere in the tree, and `brainarium-mcp` deliberately builds `rmcp` with stdio transport and `tokio` without the `net` feature. Nothing in the codebase protects a listener, because none has ever existed.

The obvious alternative is an account system with cloud sync — S3 for the files, Cognito for identity. That answers "who are you and which bucket is yours". On a private mesh network (Tailscale) the question is already answered at the device level, with encrypted transport and no exposed ports, so the account system would carry the cost of a hosting and privacy contract while solving a problem the owner does not have. ADR-004 rejected a self-updater on exactly that reasoning: networking is avoided because it creates a privacy and hosting contract, not because connectivity is inherently unwelcome.

The accepted trade-off is that reading requires the host machine awake, the app running, and connectivity. There is no offline reading on the tablet. Offline reading would require files on the device, which is a sync product, not this.

## Decision

Ship a read-only HTTP view of the already-opened vault, off by default, started only when the owner asks for it.

The server binds `127.0.0.1` and nothing else. It never binds `0.0.0.0` and never binds a mesh interface. Reaching it from another device is a deliberate step the owner takes outside the app with `tailscale serve`, which proxies the loopback port onto the tailnet over TLS. The process therefore never listens on an externally reachable socket, and the app ships no code that could make it do so.

Access requires a pairing code generated per start, shown in the app, and typed once on the reading device, then held in an `HttpOnly; SameSite=Strict` cookie and compared in constant time. This sits beneath the mesh, not instead of it: it bounds what any other device on the tailnet, or any local process that finds the port, can read.

The surface is reading only. There is no write, MCP, search, graph, or agent route, and none of them is reachable by any URL.

The request boundary states its own rules rather than inheriting them. A URL resolves to a document by exact match against the scanned document list, so no path is ever concatenated and traversal cannot succeed. It additionally re-asserts the dot-directory rejection and imposes a served-read size limit, because `resolveDocument()` has neither — it is safe today only because the scanner never emits dotfiles, and the six text kinds have no read limit anywhere in the app. Vault HTML is served as escaped source, never as `text/html`, because rendering it would execute vault-authored script under the server's origin.

## Consequences

- The owner reads their vault on a tablet with the desktop reading experience, without an account, a bucket, a sync engine, conflict resolution, or a recurring bill.
- Files never leave the owner's devices, and the local-first promise in `docs/README.md` holds: no account, sync service, or cloud database is required.
- Reading depends on the host being awake and reachable. Offline reading is explicitly not delivered.
- The app gains its first network listener. `node:http` appearing in exactly one module is a deliberate, greppable event, and the security scope in `SECURITY.md` widens to cover it.
- Publishing the port onto a tailnet is the owner's action, taken outside the app, and is documented rather than automated. Brainarium never configures Tailscale.
- The PDF exporter's renderer becomes shared infrastructure: styles, policy, image strategy, and transforms are now supplied by the caller.
