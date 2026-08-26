# Brainarium UI/UX audit — 2026-08-26

## Scope and method

This is a retroactive six-pillar review of the current uncommitted Electron UI,
performed against `docs/UX-SPEC.md`. It is an audit and plan, not an
implementation change.

Playwright exercised the actual Electron 44 development build at version
`0.1.2` using a recent local vault, without editing any vault file. The
observed states were:

- first launch and recent-vault entry;
- a populated vault and its file tree;
- rendered Markdown reading;
- assisted Markdown editing; and
- a compact `785 × 700` application window.

The graph was intentionally not built: that action creates a derived cache in
the real vault, which is outside the scope of a non-destructive review.

Screenshots captured during the audit were stored temporarily outside the
repository: `/private/tmp/brainarium-welcome.png`,
`/private/tmp/brainarium-reading.png`, `/private/tmp/brainarium-editing.png`,
and `/private/tmp/brainarium-narrow.png`.

## Verdict

Brainarium already has a distinctive, calm, local-first visual voice. Its
warm paper surface, restrained palette, and reading typography make a note
feel more like a document than an application. The issue is not visual
quality; it is that the interaction model is currently much less capable and
discoverable than the product contract promises. The UI reads as a very good
viewer with a basic source editor, rather than a dependable knowledge-work
environment.

| Pillar | Score | Assessment |
| --- | ---: | --- |
| Copywriting | 3/4 | Clear local-first promise and reassuring file-safety language. A few controls rely on icons, so their otherwise good labels are invisible until hover. |
| Visuals | 3/4 | Strong, coherent editorial character. The shell is clean, but the large persistent graph action and dense tree compete with the document. |
| Color | 2/4 | The palette is coherent and body copy measures 4.90:1 against the canvas. Small uppercase labels measure only 3.00:1 on the sidebar, below WCAG AA for normal text. |
| Typography | 3/4 | Reading mode has an excellent measure, hierarchy, and line-height. The document filename and document H1 compete, and the editor becomes visually dense for long-form writing. |
| Spacing | 2/4 | Generous desktop reading space. At a 785 px window the fixed sidebar leaves a narrow canvas and clips the toolbar / Copy action. The only responsive breakpoint is 560 px. |
| Experience design | 1/4 | Basic browse/read/edit works, but quick open, connections, command discovery, navigation history, and nearly all specified shortcuts are absent. |

**Overall: 14/24.** The visual direction should be preserved; the next work
should turn it into a fluent application without adding visual noise.

## Findings and recommendations

### P0 — correct before additional feature polish

1. **The desktop shell fails at common compact desktop widths.**
   At 785 px, the 24rem sidebar is retained, the reading measure collapses to
   roughly 320 px, and the document toolbar runs beyond the viewport. This is
   particularly harmful in an Electron app where users commonly use split
   windows. Add a tablet/compact-desktop breakpoint around 900–1000 px:
   collapse the sidebar to an icon/overlay or a resizable narrower rail,
   allow toolbar actions to wrap or move into an overflow menu, and preserve a
   560–680 px writing measure where possible. Do not wait for the existing
   560 px mobile breakpoint.

2. **Make primary controls understandable without memorising symbols.**
   The toolbar visually presents a magnifier, eye, and code glyph; Playwright
   confirms their accessible names, but a sighted first-time user does not see
   them. Use a compact labelled segmented control (`Read`, `Edit`) and an
   explicit `Find` affordance. Icons may remain as supporting decoration.
   Put secondary actions (Copy, Raw source, Save) in a stable overflow at
   compact widths, with tooltips and shortcut hints.

3. **Fix small-text contrast.**
   `OPEN VAULT`, `FILES`, `RECENT VAULTS`, and similar 10.88 px labels render
   as `#76807a` on `#e0ddd2`, measured at 3.00:1. Use a darker semantic muted
   token or increase size/weight only after checking all background pairs to
   WCAG AA (4.5:1 for this text). Centralize palette values as semantic tokens
   before adding dark mode.

### P1 — make vault navigation feel intentional

4. **Build the navigation layer described in the UX spec.**
   The current sidebar is the only way to find a file. Implement title/path
   Quick Open (`Cmd+P`), an active-file state in the tree, browser-like back /
   forward, and a focused vault switcher. The inline search should include
   empty, loading, no-result, clear, and keyboard-escape states instead of
   appearing as a lone icon button.

5. **Add the closed-by-default Connections panel before promoting graph
   navigation.**
   Outgoing links, backlinks, broken links, and ambiguous links are the
   immediate, document-level navigation need. The prominent `Build & open
   vault graph` button and cache explanation consume prime sidebar space even
   though the UX contract places the graph behind Connections as a P1 action.
   Move graph entry there after connections exists; keep the cache disclosure
   contextual, at first build.

6. **Make the current document’s hierarchy less redundant.**
   The application header displays `CLAUDE`, immediately followed by Markdown
   content headed `Brain — Igor's Second Brain`. Treat the filename as a
   smaller breadcrumb/document metadata row, or suppress it when the first
   H1 is present. This lets the note’s own title lead.

### P2 — complete the writer workflow

7. **Implement command-first editing, not only mode switching.**
   Source safety is good, but the assisted editor currently exposes only
   `Cmd+S` in code. Deliver the documented `Cmd+E`, `Cmd+Shift+M`, formatting
   shortcuts, selection menu, slash insertion, and keyboard-accessible
   context menu through one command registry. Every command needs an enabled /
   disabled state and a text transaction covered by undo tests.

8. **Strengthen state feedback.**
   Add visible selected-tree styling, save state (`Saved`, `Saving`, `Could not
   save`), find match count, and a quiet status region. These cues are more
   valuable to repeated writing than additional static sidebar copy.

9. **Complete visual-system coverage.**
   Implement Light / Dark / System themes using tokens, then test Reading,
   CodeMirror, conflict comparison, CSV, graph, focus, selection, and disabled
   states in each. Respect reduced motion in graph/layout transitions.

## Implementation plan

### 1. Shell and accessibility foundation (P0)

**Outcome:** no clipping at 785 px, controls retain clear labels, and normal
text meets AA contrast.

- Extract semantic CSS tokens for canvas, sidebar, surface, text, muted,
  border, accent, danger, focus, and selection.
- Add sidebar width state (resizable plus collapsed) and a 900–1000 px
  compact-shell layout. Define focus restoration when the sidebar opens or
  closes.
- Replace the glyph-only view switcher with a labelled, pressed segmented
  control. Add explicit Find and an overflow/secondary-actions pattern.
- Add visual active-file and hover/focus states in the tree.
- Add Playwright Electron coverage at 1440, 1024, and 785 px that asserts no
  horizontal overflow, no clipped toolbar controls, and logical keyboard tab
  order. Add automated contrast checks for token pairs.

**Acceptance checks:** a 785 px window has either a collapsed sidebar or a
document canvas of at least 560 px; every interactive icon has visible text
or an adjacent label; all normal text/background pairs are at least 4.5:1.

### 2. Navigation and connections (P1)

**Outcome:** a user can find, open, return to, and understand relationships
between notes without scanning the whole tree.

- Build a `Cmd+P` title/path picker with fuzzy match, arrows, Enter, and
  Escape.
- Turn vault search into a persistent, focus-managed search flow with status
  and no-result states.
- Add a closed-by-default 260–340 px Connections panel with tabs for outgoing
  and backlinks, plus broken and ambiguous states.
- Add back/forward history and preserve reading scroll position.
- Move graph initiation into Connections; show the derived-cache notice only
  at the moment its creation matters.

**Acceptance checks:** keyboard-only users can Quick Open, navigate a link,
go Back, and return to their prior scroll position. Broken and ambiguous links
are distinguishable without color alone.

### 3. Writer command model (P2)

**Outcome:** Editing mode earns the word “assisted” while Markdown remains
canonical.

- Introduce a single command registry powering keyboard shortcuts, toolbar,
  selection bubble, slash menu, and context menu.
- Implement the documented mode toggles and basic formatting commands first,
  followed by block transforms and table insertion.
- Add save/error/match state and make the conflict panel’s recovery actions
  consistent with the rest of the command UI.
- Test each command’s exact Markdown transaction, undo, selection, and raw
  source escape path.

**Acceptance checks:** the documented P0 shortcuts work in the correct scope;
every editing action is keyboard reachable and undoable; unknown Markdown
survives all mode transitions.

### 4. Visual polish and release gate (P3)

**Outcome:** the existing visual character holds across all product states.

- Add theme variants, reduced-motion handling, empty/loading/error states,
  and large-text / VoiceOver verification.
- Run the Playwright Electron suite on the welcome, vault, reading, editor,
  conflict, CSV, connections, and graph states; use fixture vaults for any
  action that would otherwise write a real vault.
- Conduct a short human review of the editorial tone and title hierarchy after
  the functional changes; this is the remaining subjective portion of the
  audit.

## Suggested sequencing

Do not begin the graph or agent surface until steps 1 and 2 are complete. They
will otherwise add controls to an already crowded shell. Steps 1–2 establish
the navigation and responsive rules that every subsequent panel must obey;
step 3 then adds power without creating a second interaction system.
