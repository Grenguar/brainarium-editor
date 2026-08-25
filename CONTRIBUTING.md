# Contributing to Brainarium

## Before the application scaffold

This repository currently contains specifications only. Do not claim application test or build success until package scripts and source code exist. For documentation changes, check internal links, terminology, tag usage, P0/P1 scope, and the changelog policy.

## Required pull-request tags

Apply exactly one `type:*`, one `area:*`, and one `priority:*` label. Apply `status:*` labels only when they describe the current review state. The complete taxonomy is in [`.github/labels.yml`](.github/labels.yml).

## Changelog

Follow [CHANGELOG.md](CHANGELOG.md). A user-visible change needs an `Unreleased` entry; use `changelog:skip` only for the exceptions defined there.

## Required checks after scaffolding

The canonical scripts will be added to `package.json`. Every implementation PR must run the same commands locally and in CI:

1. format check and lint;
2. type check;
3. focused and full unit tests;
4. production build;
5. affected integration/E2E tests.

Report exact commands and outcomes in the pull request. A failure needs either a fix or an explicitly approved waiver with a follow-up issue.
