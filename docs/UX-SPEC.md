# Brainarium UX specification

Status: proposed MVP, 2026-08-25.

## Product character

Quiet, fast, local, and text-first. Typora supplies the restrained writing canvas, Obsidian supplies vault navigation and connections, and Notion supplies discoverable block/selection actions. Brainarium must still feel like one editor, not three products layered together.

## Primary layout

```text
┌──────────────────────────────────────────────────────────────────┐
│ vault ▾     quick open                         Read | Edit   ··· │
├───────────────┬──────────────────────────────────┬───────────────┤
│ Files         │                                  │ Connections   │
│ ▾ notes       │          document canvas         │ Outgoing (3)  │
│   README.md   │       680–760 px readable width  │ Backlinks (2) │
│   llms.md     │                                  │               │
│ ▾ clients     │                                  │               │
│   …           │                                  │               │
└───────────────┴──────────────────────────────────┴───────────────┘
```

- Left sidebar: 220–320 px, resizable and collapsible.
- Center: single focused canvas; no permanent toolbar row.
- Right Connections panel: closed by default, 260–340 px when open.
- Top chrome uses native macOS spacing and leaves room for traffic-light controls.

## Vault experience

### First launch

Show one sentence, **Choose a folder as your vault**, a primary Choose Folder button, and recent vaults if any. Explain that files stay where they are.

### Vault switcher

The sidebar header shows the current vault name and menu:

- Switch to recent vault.
- Open another folder.
- Reveal current vault in Finder.
- Remove current vault from Recents.

Switching with unresolved save conflicts or an unreviewed agent proposal requires confirmation.

### File tree

- Folders before files, alphabetic by default.
- Icons distinguish Markdown and CSV without visual noise.
- Broken/unavailable external symlinks show a lock indicator.
- Context menu: Open, Reveal in Finder, Copy Relative Path, Copy Wiki-link. Rename is P1.
- Empty folder, permission error, and deleted file have local recovery states rather than global error pages.

## Reading mode

Reading is fully rendered and never shows Markdown delimiters unless inside code.

- Comfortable measure, generous line height, restrained heading scale.
- Local links navigate in Brainarium; external links open in the system browser after URL validation.
- Task boxes are interactive only if toggling can produce an exact one-character Markdown change; otherwise they are read-only in the first slice.
- Frontmatter is collapsed into a compact Properties row with an expand control.
- A hover/focus affordance on headings provides Copy Link.
- CSV opens directly in its table viewer, not in Markdown Reading mode.

## Editing mode

Editing is a semantic view over Markdown, not an HTML document that later guesses how to serialize.

### Markdown shortcuts

At the start of an empty block:

| Input | Result after Space/Enter |
|---|---|
| `# ` … `###### ` | Heading 1–6 |
| `- ` or `* ` | Bullet list |
| `1. ` | Numbered list |
| `- [ ] ` | Task item |
| `> ` | Block quote |
| triple backticks | Code block |
| `---` + Enter | Horizontal rule |

The visual block updates immediately. Undo once restores the typed source. On the active block, syntax markers remain visible or reveal on cursor entry; inactive blocks may dim/hide markers only when cursor/selection behavior stays predictable.

### Selection bubble menu

Appears above a non-empty selection, remains keyboard accessible, and contains:

`B` Bold, *Italic*, Strike, Code, Highlight, Link, Ask Codex, Rewrite, More.

Actions update Markdown delimiters and participate in the same undo history. If the selection crosses incompatible blocks, disable invalid marks with a short explanation.

### Right-click menu

Order by intent:

1. Agent: Ask, Rewrite, Shorten, Expand, Fix grammar, Change tone, Explain.
2. Format: Bold, Italic, Strike, Code, Highlight, Link.
3. Transform block: Paragraph, Heading, Quote, bullet/number/task list, code block.
4. Insert: Table, Link, Image reference, Horizontal rule.
5. Standard editing: Cut, Copy, Paste, Select All.

### Slash insert menu

Typing `/` at an empty block opens the same searchable element registry used by right-click Insert. Keyboard navigation is first-class. Each item has label, one-line description, shortcut if any, and extension owner.

Insert Table opens a small grid or row/column fields plus Header Row. Confirmation inserts valid GFM Markdown. P0 shows source-aware table text; a spreadsheet-like table node is P1 after round-trip behavior is proven.

### Raw source escape hatch

`Cmd+Shift+M` toggles the active document between Assisted and Raw Source editing. The raw view is always available for frontmatter, custom syntax, or recovery. Switching cannot discard unsupported nodes.

## Connections

The right panel has Outgoing and Backlinks tabs.

- Resolved item: title and relative path.
- Broken item: warning and original target.
- Ambiguous item: target plus candidate picker.
- Clicking navigates without losing the current scroll position in history.
- A local graph is P1 and opens from this panel, not as permanent chrome.

## CSV viewer

- Sticky header, virtual rows, horizontal scroll, alternating subtle row surfaces.
- Status line shows delimiter, row/column count when known, file size, and Read only.
- Parse errors highlight the row and offer Open as Raw Text.
- Search/sort are P1; v1 never writes transformed CSV.

## Inline agents

### Entry points

- `Cmd+K` at cursor/selection.
- Selection bubble menu and right-click Agent group.
- Slash items contributed by the agent-action registry.
- Future command palette entries use the same action registry.

### Inline flow

```text
selection → prompt/action → context preview → streaming proposal
                                             ├─ Insert below
                                             ├─ Replace selection
                                             ├─ Review diff
                                             └─ Discard
```

The prompt is anchored near the selected block. Context preview names the active file and shows the exact bounded excerpt; additional linked documents require explicit opt-in.

Streaming appears in a visually distinct but theme-consistent card. Escape cancels, but never deletes already written user text. Provider/tool/approval events can collapse under Details. V1 denies write/command approvals and explains why.

For a multi-range or multi-file proposal, open a diff sheet with per-hunk checkboxes. Applying is one undoable operation where possible. The agent never types directly into the live file buffer without a proposal boundary.

## Extension UX contract

Extensions may contribute commands, slash items, context-menu items, agent actions, providers, panels, renderers, and link resolvers. Every contribution declares:

- stable id and owner;
- applicable file/block/selection types;
- requested capabilities;
- placement and optional shortcut;
- whether it reads context or proposes edits.

Name collisions, missing capabilities, and disabled extensions fail visibly. V1 ships only built-in extensions, but uses the same registry internally to prevent hard-coded menus.

## Themes

Settings offer Default (follow system), Brainarium Light, and Brainarium Dark.

- Light: warm-neutral canvas, slightly cooler sidebar, near-black text, restrained blue accent.
- Dark: charcoal rather than pure black, low-contrast borders, non-neon syntax colors.
- App chrome and document canvas share tokens in v1; independent writing themes are P1.
- Semantic tokens cover `bg`, `surface`, `surface-raised`, `text`, `muted`, `accent`, `border`, `selection`, `code-bg`, `sidebar-bg`, `hover`, `danger`, and editor font families.

Themes style Brainarium-owned semantic classes/data attributes. Do not copy Typora CSS/assets whose reuse license is unclear.

## Keyboard baseline

| Action | Shortcut |
|---|---|
| Quick Open | `Cmd+P` |
| Agent prompt | `Cmd+K` |
| Reading / Editing | `Cmd+E` |
| Assisted / Raw Source | `Cmd+Shift+M` |
| Toggle sidebar | `Cmd+Shift+L` |
| Toggle connections | `Cmd+Shift+B` |
| Bold / Italic | `Cmd+B` / `Cmd+I` |
| Save now | `Cmd+S` |

Shortcuts are provisional and must be checked for macOS/editor conflicts during the UX spike.

## Accessibility and motion

- All menus work with arrows, Enter, Escape, and type-ahead.
- Visible focus is never conveyed by color alone.
- Reading mode has semantic headings, lists, links, tables, and code labels.
- Respect reduced motion; streaming text does not force-scroll after the user scrolls away.
- Maintain WCAG AA contrast for body text and controls.
