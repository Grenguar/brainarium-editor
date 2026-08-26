import type { JSX } from "react";

import type { VaultDocumentContent } from "../shared/contracts/vault";

const documentDetails = (text: string): string => {
  const lineEnding = text.includes("\r\n") ? "CRLF" : "LF";
  const endsWithNewline = /(?:\r\n|\n)$/.test(text)
    ? "final newline"
    : "no final newline";
  const lineCount = text === "" ? 0 : text.split(/\r\n|\n/).length;
  return `${lineCount} lines · ${lineEnding} · ${endsWithNewline}`;
};

const SourcePane = ({
  label,
  text,
  version,
}: {
  label: string;
  text: string;
  version?: string;
}): JSX.Element => (
  <section className="document-comparison-pane">
    <header>
      <div>
        <p className="section-label">{label}</p>
        <p>{documentDetails(text)}</p>
      </div>
      {version && <code title={version}>{version.slice(0, 10)}</code>}
    </header>
    <pre>{text}</pre>
  </section>
);

export const DocumentConflictPanel = ({
  base,
  disk,
  draft,
  isComparing,
  isConfirmingReload,
  isReloading,
  onCancelReload,
  onCompare,
  onKeepMine,
  onRequestReload,
  onReload,
  onRetry,
  state,
}: {
  base: VaultDocumentContent;
  disk?: VaultDocumentContent;
  draft: string;
  isComparing: boolean;
  isConfirmingReload: boolean;
  isReloading: boolean;
  onCancelReload: () => void;
  onCompare: () => void;
  onKeepMine: () => void;
  onRequestReload: () => void;
  onReload: () => void;
  onRetry: () => void;
  state: "conflict" | "missing";
}): JSX.Element => {
  if (state === "missing") {
    return (
      <section className="document-conflict-panel" role="status">
        <div>
          <p className="section-label">FILE UNAVAILABLE</p>
          <h3>This file was removed or renamed outside Brainarium.</h3>
          <p>
            Your unsaved copy remains here. Brainarium will not guess where the
            file moved or recreate it automatically.
          </p>
        </div>
        <div className="conflict-actions">
          <button type="button" onClick={onRetry}>
            Check again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="document-conflict-panel" role="alert">
      <div>
        <p className="section-label">EXTERNAL CHANGE</p>
        <h3>This file changed while you were editing it.</h3>
        <p>
          Your draft is safe. Choose how to resolve the difference before
          Brainarium saves again.
        </p>
      </div>
      <div className="conflict-actions">
        <button type="button" onClick={onCompare}>
          {isComparing ? "Hide comparison" : "Compare changes"}
        </button>
        {isConfirmingReload ? (
          <span className="reload-confirmation">
            Discard your copy?
            <button type="button" onClick={onReload} disabled={isReloading}>
              {isReloading ? "Reloading…" : "Yes, reload disk"}
            </button>
            <button type="button" onClick={onCancelReload}>
              Keep editing
            </button>
          </span>
        ) : (
          <button type="button" onClick={onRequestReload}>
            Reload disk
          </button>
        )}
        <button className="conflict-keep" type="button" onClick={onKeepMine}>
          Keep mine
        </button>
      </div>
      {isComparing && (
        <div className="document-comparison" aria-label="Source comparison">
          <SourcePane label="BASE" text={base.text} version={base.version} />
          <SourcePane
            label="DISK"
            text={disk?.text ?? "The external version is unavailable."}
            version={disk?.version}
          />
          <SourcePane label="MINE" text={draft} />
        </div>
      )}
    </section>
  );
};
