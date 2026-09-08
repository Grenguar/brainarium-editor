import { useState } from "react";

import type {
  DocumentReviewState,
  MarkdownChangeReview,
} from "../shared/contracts/vault";
import { ChangeList, blockChanges } from "./change-review-panel";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatChangedAt = (changedAt: number, now: number): string => {
  const elapsed = now - changedAt;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(elapsed / DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const ChangeRow = ({
  onOpen,
  onMarkReviewed,
  requestChangeReview,
  state,
  now,
}: {
  now: number;
  onMarkReviewed: (relativePath: string) => void;
  onOpen: (relativePath: string) => void;
  requestChangeReview: (
    relativePath: string,
  ) => Promise<MarkdownChangeReview | undefined>;
  state: DocumentReviewState;
}): React.JSX.Element => {
  const [review, setReview] = useState<MarkdownChangeReview | undefined>();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = (): void => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }
    setIsExpanded(true);
    if (review || isLoading) return;
    setIsLoading(true);
    void requestChangeReview(state.relativePath)
      .then(setReview)
      .finally(() => setIsLoading(false));
  };

  const changes =
    review?.previousText !== undefined && review?.currentText !== undefined
      ? blockChanges(review.previousText, review.currentText)
      : [];

  return (
    <li className="changes-row">
      <div className="changes-row-heading">
        <button
          className="changes-row-open"
          type="button"
          onClick={() => onOpen(state.relativePath)}
        >
          {state.relativePath}
        </button>
        <div className="changes-row-actions">
          {state.changedAt !== undefined && (
            <span className="changes-row-time">
              {formatChangedAt(state.changedAt, now)}
            </span>
          )}
          <button aria-expanded={isExpanded} type="button" onClick={toggle}>
            {isExpanded ? "Hide changes" : "Show changes"}
          </button>
          <button
            type="button"
            onClick={() => onMarkReviewed(state.relativePath)}
          >
            Mark reviewed
          </button>
        </div>
      </div>
      {isExpanded &&
        (isLoading ? (
          <p className="changes-row-loading">Loading changes…</p>
        ) : review ? (
          <ChangeList changes={changes} />
        ) : (
          <p className="change-review-unavailable">
            This note is no longer changed since you last reviewed it.
          </p>
        ))}
    </li>
  );
};

/**
 * Vault-wide inbox of notes that changed since they were last reviewed.
 *
 * Rows are filtered against the current snapshot so a note deleted between a
 * reconcile and a render disappears instead of opening a missing file. Marking
 * everything reviewed only moves the stored baseline — it never touches a file
 * on disk or an unsaved draft, so it deliberately skips the leave-document
 * confirmation that opening a note performs.
 */
export const ChangesView = ({
  changed,
  documentPaths,
  now = Date.now(),
  onMarkAllReviewed,
  onMarkReviewed,
  onOpenDocument,
  requestChangeReview,
}: {
  changed: DocumentReviewState[];
  documentPaths: ReadonlySet<string>;
  now?: number;
  onMarkAllReviewed: () => void;
  onMarkReviewed: (relativePath: string) => void;
  onOpenDocument: (relativePath: string) => void;
  requestChangeReview: (
    relativePath: string,
  ) => Promise<MarkdownChangeReview | undefined>;
}): React.JSX.Element => {
  const [isConfirmingMarkAll, setIsConfirmingMarkAll] = useState(false);
  const present = changed.filter((state) =>
    documentPaths.has(state.relativePath),
  );

  return (
    <section aria-labelledby="changes-title" className="changes-view">
      <header className="document-toolbar">
        <div>
          <p className="eyebrow">CHANGED SINCE YOU LAST REVIEWED</p>
          <h2 id="changes-title">Changes</h2>
        </div>
        <div className="toolbar-actions">
          {present.length > 0 &&
            (isConfirmingMarkAll ? (
              <>
                <button type="button" onClick={onMarkAllReviewed}>
                  Confirm mark all as read
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingMarkAll(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingMarkAll(true)}
              >
                Mark all as read
              </button>
            ))}
        </div>
      </header>
      <p className="changes-scope">
        Brainarium tracks changes for Markdown notes only. Your files on disk
        are never modified by marking them read.
      </p>
      {present.length ? (
        <ul className="changes-list">
          {present.map((state) => (
            <ChangeRow
              key={state.relativePath}
              now={now}
              onMarkReviewed={onMarkReviewed}
              onOpen={onOpenDocument}
              requestChangeReview={requestChangeReview}
              state={state}
            />
          ))}
        </ul>
      ) : (
        <p className="changes-empty">No changes since you last reviewed.</p>
      )}
    </section>
  );
};
