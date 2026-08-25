# Contributing to Brainarium

## Local development

Install dependencies with `npm install`, then run `npm run dev`. Electron Forge
starts the sandboxed desktop shell and rebuilds the main, preload, and renderer
processes as their source changes. Quit the application or press `Ctrl+C` in
the terminal to stop the loop.

Use `npm run test:watch` while changing unit-tested code. The full local
quality gate is `npm run quality`, which runs format, lint, type check, the complete
TypeScript and Rust test suites, strict Rust Clippy, and the production package.
Run affected integration or end-to-end tests when they are introduced. `npm run
dev` and `npm run build` compile the packaged Rust indexer automatically.

## Required pull-request tags

Apply exactly one `type:*`, one `area:*`, and one `priority:*` label. Apply `status:*` labels only when they describe the current review state. The complete taxonomy is in [`.github/labels.yml`](.github/labels.yml).

## Changelog

Follow [CHANGELOG.md](CHANGELOG.md). A user-visible change needs an `Unreleased` entry; use `changelog:skip` only for the exceptions defined there.

## Required checks

Every implementation PR must run the same commands locally and in CI:

1. format check and lint;
2. type check;
3. focused and full unit tests;
4. production build;
5. affected integration/E2E tests.

Report exact commands and outcomes in the pull request. A failure needs either a fix or an explicitly approved waiver with a follow-up issue.
