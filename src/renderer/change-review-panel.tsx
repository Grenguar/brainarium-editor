import { useMemo } from "react";

import type { MarkdownChangeReview } from "../shared/contracts/vault";

type ChangeKind = "added" | "removed" | "replaced";

export type ReviewBlock = {
  kind: "code" | "heading" | "list" | "paragraph" | "quote" | "table";
  text: string;
};

export type BlockChange = {
  after?: ReviewBlock;
  before?: ReviewBlock;
  kind: ChangeKind;
};

export const markdownBlocks = (source: string): ReviewBlock[] => {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReviewBlock[] = [];
  let current: string[] = [];
  let kind: ReviewBlock["kind"] = "paragraph";

  const flush = (): void => {
    const text = current.join("\n").trim();
    if (text) blocks.push({ kind, text });
    current = [];
    kind = "paragraph";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) {
      flush();
      const fenced = [line];
      index += 1;
      while (index < lines.length) {
        fenced.push(lines[index]);
        if (lines[index].startsWith("```")) break;
        index += 1;
      }
      blocks.push({ kind: "code", text: fenced.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const nextKind: ReviewBlock["kind"] = line.startsWith("|")
      ? "table"
      : line.startsWith(">")
        ? "quote"
        : /^[-*+]\s|^\d+\.\s/.test(line)
          ? "list"
          : /^#{1,6}\s/.test(line)
            ? "heading"
            : "paragraph";
    if (current.length && (nextKind !== kind || nextKind === "heading"))
      flush();
    kind = nextKind;
    current.push(line);
  }
  flush();
  return blocks;
};

export const blockChanges = (before: string, after: string): BlockChange[] => {
  const oldBlocks = markdownBlocks(before);
  const newBlocks = markdownBlocks(after);
  const pairs = longestCommonSubsequence(oldBlocks, newBlocks);
  const changes: BlockChange[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  for (const [oldMatch, newMatch] of [
    ...pairs,
    [oldBlocks.length, newBlocks.length] as const,
  ]) {
    const oldSegment = oldBlocks.slice(oldIndex, oldMatch);
    const newSegment = newBlocks.slice(newIndex, newMatch);
    const paired = Math.min(oldSegment.length, newSegment.length);
    for (let index = 0; index < paired; index += 1) {
      changes.push({
        after: newSegment[index],
        before: oldSegment[index],
        kind: "replaced",
      });
    }
    for (let index = paired; index < oldSegment.length; index += 1) {
      changes.push({ before: oldSegment[index], kind: "removed" });
    }
    for (let index = paired; index < newSegment.length; index += 1) {
      changes.push({ after: newSegment[index], kind: "added" });
    }
    oldIndex = oldMatch + 1;
    newIndex = newMatch + 1;
  }
  return changes;
};

type WordPart = { changed: boolean; text: string };

const wordParts = (before: string, after: string): [WordPart[], WordPart[]] => {
  const oldWords = tokenize(before);
  const newWords = tokenize(after);
  const pairs = longestCommonSubsequence(oldWords, newWords);
  const oldParts: WordPart[] = [];
  const newParts: WordPart[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  for (const [oldMatch, newMatch] of [
    ...pairs,
    [oldWords.length, newWords.length] as const,
  ]) {
    oldParts.push(
      ...oldWords
        .slice(oldIndex, oldMatch)
        .map((text) => ({ changed: true, text })),
    );
    newParts.push(
      ...newWords
        .slice(newIndex, newMatch)
        .map((text) => ({ changed: true, text })),
    );
    if (oldMatch < oldWords.length)
      oldParts.push({ changed: false, text: oldWords[oldMatch] });
    if (newMatch < newWords.length)
      newParts.push({ changed: false, text: newWords[newMatch] });
    oldIndex = oldMatch + 1;
    newIndex = newMatch + 1;
  }
  return [oldParts, newParts];
};

const tokenize = (text: string): string[] =>
  text.match(/\s+|[\p{L}\p{N}_-]+|[^\s]/gu) ?? [];

function longestCommonSubsequence<T extends { text: string } | string>(
  before: readonly T[],
  after: readonly T[],
): Array<[number, number]> {
  const value = (item: T): string =>
    typeof item === "string" ? item : item.text;
  const lengths = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  );
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        value(before[left]) === value(after[right])
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (value(before[left]) === value(after[right])) {
      pairs.push([left, right]);
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      left += 1;
    } else {
      right += 1;
    }
  }
  return pairs;
}

const labelFor = (change: BlockChange): string => {
  const block = change.after ?? change.before;
  const noun = block?.kind === "list" ? "list item" : (block?.kind ?? "block");
  return `${change.kind === "replaced" ? "Updated" : change.kind === "added" ? "Added" : "Removed"} ${noun}`;
};

const ChangedText = ({
  after,
  before,
  kind,
}: {
  after?: string;
  before?: string;
  kind: "after" | "before";
}): React.JSX.Element => {
  const [oldParts, newParts] = wordParts(before ?? "", after ?? "");
  const parts = kind === "after" ? newParts : oldParts;
  return (
    <p className={`change-review-text change-review-text-${kind}`}>
      {parts.map((part, index) =>
        part.changed ? (
          <mark key={`${part.text}-${index}`}>{part.text}</mark>
        ) : (
          part.text
        ),
      )}
    </p>
  );
};

export const ChangeReviewPanel = ({
  panelWidth,
  review,
  onMarkReviewed,
  onPanelWidthChange,
}: {
  panelWidth: number;
  review: MarkdownChangeReview;
  onMarkReviewed: () => void;
  onPanelWidthChange: (width: number) => void;
}): React.JSX.Element => {
  const changes = useMemo(
    () =>
      review.previousText !== undefined && review.currentText !== undefined
        ? blockChanges(review.previousText, review.currentText)
        : [],
    [review.currentText, review.previousText],
  );
  const beginResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    const resize = (moveEvent: PointerEvent): void => {
      onPanelWidthChange(
        Math.max(576, Math.min(992, startWidth + startX - moveEvent.clientX)),
      );
    };
    const finish = (): void => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const resizeFromKeyboard = (event: React.KeyboardEvent): void => {
    const movement = event.key === "ArrowLeft" ? 32 : -32;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onPanelWidthChange(Math.max(576, Math.min(992, panelWidth + movement)));
  };

  return (
    <>
      <div
        aria-label="Resize change review panel"
        aria-orientation="vertical"
        aria-valuemax={992}
        aria-valuemin={576}
        aria-valuenow={panelWidth}
        className="change-review-resizer"
        onKeyDown={resizeFromKeyboard}
        onPointerDown={beginResize}
        role="separator"
        tabIndex={0}
      />
      <aside
        aria-label="Changes since you last reviewed"
        className="change-review-panel"
      >
        <div className="change-review-heading">
          <div>
            <p className="eyebrow">UPDATED DOCUMENT</p>
            <h2>Changes since you last reviewed</h2>
          </div>
          <button type="button" onClick={onMarkReviewed}>
            Mark reviewed
          </button>
        </div>
        <p className="change-review-intro">
          Whole blocks stay visible; highlighted words identify the exact edit.
        </p>
        {changes.length ? (
          <ol className="change-review-list">
            {changes.map((change, index) => (
              <li
                className={`change-review-card is-${change.kind}`}
                key={`${change.kind}-${index}`}
              >
                <p className="eyebrow">{labelFor(change)}</p>
                {change.before && (
                  <ChangedText
                    after={change.after?.text}
                    before={change.before.text}
                    kind="before"
                  />
                )}
                {change.after && (
                  <ChangedText
                    after={change.after.text}
                    before={change.before?.text}
                    kind="after"
                  />
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="change-review-unavailable">
            This change was detected, but its prior snapshot was too large or
            unavailable to compare.
          </p>
        )}
      </aside>
    </>
  );
};
