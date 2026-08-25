# GitHub Actions plan

Status: planned; do not create workflows until the Electron/TypeScript scaffold defines its package manager, Node version, package scripts, and signing secrets.

## Workflow sequence

| Workflow | Trigger | Required jobs | Gate |
|---|---|---|---|
| `ci.yml` | Pull request and push to `main` | dependency install with lockfile, format, lint, type check, unit tests, production build | Required before merge |
| `integration.yml` | Pull request when desktop/vault/agent paths change; nightly | fixture vault, fake Codex app-server, filesystem and IPC integration tests | Required for affected paths after stability is proven |
| `e2e.yml` | Pull request on macOS and release candidate | packaged-app smoke flows, accessibility/keyboard baseline | Required for release candidates |
| `codeql.yml` | Pull request, push to `main`, weekly | JavaScript/TypeScript analysis | Required after baseline is clean |
| `dependency-review.yml` | Pull request | dependency diff policy | Required once dependency management exists |
| `release.yml` | protected version tag/manual approval | verify, package, sign, notarize, publish release notes | Manual environment approval |
| `labels.yml` | manual first, then default-branch changes | sync `.github/labels.yml` | Never a merge gate |

## CI contract

The `ci.yml` workflow must invoke the exact package scripts documented in `CONTRIBUTING.md`; no separate CI-only quality commands. Use immutable action SHAs, least-privilege `permissions`, concurrency cancellation for superseded pull-request runs, dependency caching keyed by lockfile, and uploaded test/coverage artifacts only when they contain no vault contents or secrets.

## Repository protections to enable after the first green CI run

Require the `ci` check and a pull-request review for `main`; block force pushes and branch deletion; require conversation resolution; restrict release environment secrets to protected tags/manual approval. Do not require a check before it exists and has a demonstrated green baseline.

## Release safety

Release automation must build on macOS, sign/notarize only after all checks pass, generate notes from the changelog, attach checksums, and retain a rollback artifact. Store signing and notarization credentials exclusively as protected GitHub environment secrets; never expose them to pull-request workflows.
