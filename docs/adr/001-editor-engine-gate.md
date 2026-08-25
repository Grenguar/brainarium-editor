# ADR-001: Editor engine decision gate

Status: proposed — resolve in Milestone 0.

CodeMirror is the default hypothesis because Markdown text remains authoritative. Tiptap/ProseMirror may be selected only after both candidates are measured against the Markdown-fidelity fixture gate in [technical contracts](../TECHNICAL-CONTRACTS.md). The result must record intentional/unintentional byte changes, transformation correctness, cursor/selection/copy-paste, IME, undo, keyboard-only use, screen-reader behavior, fixture revision, environment, owner, and date.
