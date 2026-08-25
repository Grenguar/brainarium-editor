# GitHub Actions plan

Status: CI and the tag-triggered release workflow are implemented, 2026-08-25. The release job remains intentionally blocked until protected `release` environment secrets are configured.

## Workflow sequence

| Workflow | Trigger | Required jobs | Gate |
|---|---|---|---|
| `ci.yml` | Pull request and push to `main` | dependency install with lockfile, format, lint, type check, unit tests, production build | Required before merge |
| `integration.yml` | Pull request when desktop/vault/agent paths change; nightly | fixture vault, fake Codex app-server, filesystem and IPC integration tests | Required for affected paths after stability is proven |
| `e2e.yml` | Pull request on macOS and release candidate | packaged-app smoke flows, accessibility/keyboard baseline | Required for release candidates |
| `codeql.yml` | Pull request, push to `main`, weekly | JavaScript/TypeScript analysis | Required after baseline is clean |
| `dependency-review.yml` | Pull request | dependency diff policy | Required once dependency management exists |
| `release.yml` | `vX.Y.Z` tag or explicit existing tag | validate, package, sign, notarize, verify, publish DMG/ZIP | `release` environment credentials and a matching immutable tag |
| `labels.yml` | manual first, then default-branch changes | sync `.github/labels.yml` | Never a merge gate |

## CI contract

The `ci.yml` workflow must invoke the exact package scripts documented in `CONTRIBUTING.md`; no separate CI-only quality commands. Use immutable action SHAs, least-privilege `permissions`, concurrency cancellation for superseded pull-request runs, dependency caching keyed by lockfile, and uploaded test/coverage artifacts only when they contain no vault contents or secrets.

## Repository protections to enable after the first green CI run

Require the `CI / Validate macOS build` check and a pull-request review for `main`; block force pushes and branch deletion; require conversation resolution; restrict release environment secrets to protected tags/manual approval. This private repository's current GitHub plan does not permit branch protection, so enable it when the plan or repository visibility supports it.

## Release safety

Release automation builds `arm64` and `x64` on macOS, runs the same quality gate as CI, signs and notarizes only after that succeeds, verifies the packaged app, and publishes DMG/ZIP artifacts plus SHA-256 checksums with generated release notes. Store signing and notarization credentials exclusively as protected GitHub environment secrets; never expose them to pull-request workflows. The exact setup and tag procedure is in [RELEASING.md](RELEASING.md).
