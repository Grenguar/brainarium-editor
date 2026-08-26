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

import { SourceBuffer, type ProjectionChange } from "./source-buffer";

export type MarkdownEditorHandle = {
  focus(): void;
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
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
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
          ]),
          EditorView.domEventHandlers({
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

    return () => {
      view.destroy();
      if (viewRef.current === view) viewRef.current = null;
    };
    // The editor intentionally resets only for a newly opened/reloaded
    // document. Parent draft updates originate in this view and must not reset
    // its undo history, selection, or IME composition.
  }, [generation, mode]);

  return <div className="document-editor-codemirror" ref={parentRef} />;
});
