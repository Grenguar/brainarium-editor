# Brainarium contributor guide

## Product boundary

Brainarium is a macOS-first, local-first editor for user-selected Markdown and CSV vaults. The vault is authoritative; Brainarium must not create a proprietary vault format or silently alter unsupported Markdown.

## Naming

Use **Brainarium** in user-facing text and `brainarium` in paths, package names, examples, and identifiers. Do not introduce the former product name.

## Current repository state

This checkout is a planning repository: it contains specifications, not an application scaffold. Clearly label a statement as proposed, verified, or unresolved. Do not invent build or test commands before the scaffold exists.

## Working rules

- Read [docs/README.md](docs/README.md) before changing product decisions.
- Preserve Markdown source fidelity, vault boundaries, explicit agent-edit review, and renderer isolation as MVP constraints.
- Record unresolved choices in [docs/OPEN-DECISIONS.md](docs/OPEN-DECISIONS.md); add an ADR when a cross-cutting decision is closed.
- Update the linked technical contract when changing compatibility, security, vault, or performance behavior.
- `.planning/graphs/` is derived: rebuild with Graphify after structural documentation changes; never hand-edit graph artifacts.
- Do not claim Context7 verification before a successful record appears in [docs/CONTEXT7-VERIFICATION.md](docs/CONTEXT7-VERIFICATION.md).

## Validation

For documentation changes, validate internal links, terminology, P0/P1 scope, and requirement consistency. When code exists, add the smallest suitable automated evidence and update the relevant test plan.

## Quality gate (mandatory for implementation changes)

Before claiming an implementation is complete, run and report the project's formatter/linter, type check, focused unit tests, full unit-test suite, and production build. Run affected integration or end-to-end tests when the change crosses a process, IPC, filesystem, or packaged-app boundary. Never replace a failing verification command with an assertion that it would pass.

Until the Electron scaffold exists, there are no executable application checks. Document-only changes must say so explicitly and must not be represented as a passing app build or test suite. Once package scripts are introduced, keep the canonical commands documented in [CONTRIBUTING.md](CONTRIBUTING.md) and require CI to run the same commands.
