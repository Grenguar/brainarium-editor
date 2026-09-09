import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentReviewState } from "../shared/contracts/vault";
import { ChangesView, formatChangedAt } from "./changes-view";

const NOW = 1_700_000_000_000;

const changedState = (
  relativePath: string,
  changedAt = NOW,
): DocumentReviewState => ({
  changed: true,
  changedAt,
  relativePath,
});

const render = (
  changed: DocumentReviewState[],
  documentPaths: string[],
): string =>
  renderToStaticMarkup(
    <ChangesView
      changed={changed}
      documentPaths={new Set(documentPaths)}
      now={NOW}
      onMarkAllReviewed={vi.fn()}
      onMarkReviewed={vi.fn()}
      onOpenDocument={vi.fn()}
      requestChangeReview={vi.fn()}
    />,
  );

describe("ChangesView", () => {
  it("lists one row per changed note that still exists in the vault", () => {
    const html = render(
      [changedState("plan.md"), changedState("notes/ideas.md")],
      ["plan.md", "notes/ideas.md"],
    );

    expect(html).toContain("plan.md");
    expect(html).toContain("notes/ideas.md");
    expect(html).toContain("Mark all as read");
  });

  it("drops changed notes that are no longer present in the vault", () => {
    const html = render(
      [changedState("plan.md"), changedState("deleted.md")],
      ["plan.md"],
    );

    expect(html).toContain("plan.md");
    expect(html).not.toContain("deleted.md");
  });

  it("shows the empty state and hides bulk review when nothing changed", () => {
    const html = render([], ["plan.md"]);

    expect(html).toContain("No changes since you last reviewed.");
    expect(html).not.toContain("Mark all as read");
  });

  it("always states that only Markdown notes are tracked", () => {
    expect(render([], [])).toContain(
      "Brainarium tracks changes for Markdown notes only.",
    );
  });

  it("requires a second click before marking everything read", () => {
    const html = render([changedState("plan.md")], ["plan.md"]);

    expect(html).toContain("Mark all as read");
    expect(html).not.toContain("Confirm mark all as read");
  });
});

describe("formatChangedAt", () => {
  it("describes recent edits in the largest settled unit", () => {
    expect(formatChangedAt(NOW - 5_000, NOW)).toBe("just now");
    expect(formatChangedAt(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(formatChangedAt(NOW - 5 * 60_000, NOW)).toBe("5 minutes ago");
    expect(formatChangedAt(NOW - 3 * 3_600_000, NOW)).toBe("3 hours ago");
    expect(formatChangedAt(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });
});
