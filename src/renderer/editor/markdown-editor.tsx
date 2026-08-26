import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type JSX,
} from "react";

import {
  filterMarkdownInsertCommands,
  insertionSelection,
  type MarkdownInsertCommand,
  slashCommandQueryAt,
} from "./markdown-insert-menu";
import { SourceBuffer, type ProjectionChange } from "./source-buffer";

export type MarkdownEditorHandle = {
  focus(): void;
  insertText(text: string): void;
  openInsertMenu(): void;
  selectSourceRange(from: number, to: number): void;
};

export type MarkdownEditorMode = "assisted" | "source";

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    generation: number;
    mode: MarkdownEditorMode;
    onChange: (source: string) => void;
    onSave: () => void;
    value: string;
  }
>(function MarkdownEditor(
  { generation, mode, onChange, onSave, value },
  ref,
): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const insertMenuRef = useRef<MarkdownInsertMenu | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    insertText: (text) => {
      const view = viewRef.current;
      if (!view) return;
      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, insert: text, to: selection.to },
        selection: { anchor: selection.from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    openInsertMenu: () => insertMenuRef.current?.openAtSelection(),
    selectSourceRange: (from, to) => {
      const view = viewRef.current;
      const source = sourceBufferRef.current;
      if (!view || !source) return;
      const anchor = source.projectionOffsetForSourceOffset(from);
      const head = source.projectionOffsetForSourceOffset(to);
      view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
      view.focus();
    },
  }));

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const sourceBuffer = new SourceBuffer(value);
    sourceBufferRef.current = sourceBuffer;
    const insertMenu = new MarkdownInsertMenu(parent);
    insertMenuRef.current = insertMenu;

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: sourceBuffer.projection(),
        extensions: [
          basicSetup,
          ...(mode === "assisted" ? [markdown()] : []),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            {
              key: "Mod-Shift-i",
              run: () => {
                insertMenu.openAtSelection();
                return true;
              },
            },
          ]),
          EditorView.domEventHandlers({
            keydown: (_event, currentView) =>
              insertMenu.handleKeydown(_event, currentView),
            blur: () => {
              onSaveRef.current();
              return false;
            },
          }),
          EditorView.contentAttributes.of({
            "aria-label":
              mode === "assisted"
                ? "Assisted Markdown editor"
                : "Raw Markdown source editor",
            spellcheck: "true",
          }),
          EditorView.updateListener.of((update) => {
            insertMenu.updateFromEditor(update.view);
            if (!update.docChanged) return;
            const changes: ProjectionChange[] = [];
            update.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
              changes.push({ from, insert: inserted.toString(), to });
            });
            onChangeRef.current(sourceBuffer.applyProjectionChanges(changes));
          }),
        ],
      }),
    });
    viewRef.current = view;
    insertMenu.updateFromEditor(view);

    return () => {
      view.destroy();
      insertMenu.destroy();
      if (viewRef.current === view) viewRef.current = null;
      if (insertMenuRef.current === insertMenu) insertMenuRef.current = null;
    };
    // The editor intentionally resets only for a newly opened/reloaded
    // document. Parent draft updates originate in this view and must not reset
    // its undo history, selection, or IME composition.
  }, [generation, mode]);

  return <div className="document-editor-codemirror" ref={parentRef} />;
});

type InsertRange = { from: number; to: number };

/**
 * A small DOM overlay rather than a rich-text extension: choosing an item
 * produces one normal CodeMirror text transaction, which SourceBuffer maps
 * back to the authoritative source bytes.
 */
class MarkdownInsertMenu {
  private readonly element: HTMLDivElement;
  private activeIndex = 0;
  private commands: MarkdownInsertCommand[] = [];
  private range: InsertRange | null = null;
  private view: EditorView | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "markdown-insert-menu";
    this.element.setAttribute("role", "menu");
    this.element.setAttribute("aria-label", "Insert Markdown");
    this.element.hidden = true;
    parent.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  openAtSelection(): void {
    const view = this.view;
    if (!view) return;
    const selection = view.state.selection.main;
    this.range = { from: selection.from, to: selection.to };
    this.show(filterMarkdownInsertCommands(""));
  }

  updateFromEditor(view: EditorView): void {
    this.view = view;
    const selection = view.state.selection.main;
    if (!selection.empty) {
      if (this.range && this.range.from !== selection.from) this.close();
      return;
    }
    const line = view.state.doc.lineAt(selection.head);
    const slashQuery = slashCommandQueryAt(
      line.text,
      line.from,
      selection.head,
    );
    if (!slashQuery) {
      if (this.element.hidden) return;
      this.close();
      return;
    }
    this.range = { from: slashQuery.from, to: selection.head };
    this.show(filterMarkdownInsertCommands(slashQuery.query));
  }

  handleKeydown(event: KeyboardEvent, view: EditorView): boolean {
    if (this.element.hidden) return false;
    if (event.key === "Escape") {
      this.close();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!this.commands.length) return true;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      this.activeIndex =
        (this.activeIndex + direction + this.commands.length) %
        this.commands.length;
      this.render();
      return true;
    }
    if (event.key === "Enter" && this.commands[this.activeIndex]) {
      this.insert(this.commands[this.activeIndex], view);
      return true;
    }
    return false;
  }

  private show(commands: MarkdownInsertCommand[]): void {
    this.commands = commands;
    this.activeIndex = Math.min(
      this.activeIndex,
      Math.max(commands.length - 1, 0),
    );
    this.element.hidden = false;
    this.render();
    this.positionAtCursor();
  }

  private close(): void {
    this.element.hidden = true;
    this.commands = [];
    this.range = null;
  }

  private render(): void {
    this.element.replaceChildren();
    if (!this.commands.length) {
      const empty = document.createElement("div");
      empty.className = "markdown-insert-menu-empty";
      empty.textContent = "No Markdown blocks found";
      this.element.append(empty);
      return;
    }
    this.element.setAttribute(
      "aria-activedescendant",
      `markdown-insert-command-${this.activeIndex}`,
    );
    this.commands.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "markdown-insert-menu-item";
      button.id = `markdown-insert-command-${index}`;
      button.setAttribute("role", "menuitem");
      button.tabIndex = -1;
      button.setAttribute("aria-current", String(index === this.activeIndex));
      button.textContent = `${command.label} — ${command.description}`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const view = this.view;
        if (view) this.insert(command, view);
      });
      this.element.append(button);
    });
  }

  /** Keep the palette next to the insertion point, like a native editor menu. */
  private positionAtCursor(): void {
    const view = this.view;
    if (!view) return;
    const cursor = view.coordsAtPos(view.state.selection.main.head);
    if (!cursor) return;

    const viewportPadding = 12;
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    const left = Math.max(
      viewportPadding,
      Math.min(cursor.left, window.innerWidth - width - viewportPadding),
    );
    const below = cursor.bottom + 8;
    const top =
      below + height <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, cursor.top - height - 8);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private insert(command: MarkdownInsertCommand, view: EditorView): void {
    const range = this.range;
    if (!range) return;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: command.text },
      selection: insertionSelection(range.from, command),
      scrollIntoView: true,
    });
    view.focus();
    this.close();
  }
}
