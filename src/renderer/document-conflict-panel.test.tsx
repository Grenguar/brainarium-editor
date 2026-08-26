import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentConflictPanel } from "./document-conflict-panel";

const note = (text: string, version: string) => ({
  kind: "markdown" as const,
  relativePath: "note.md",
  text,
  title: "note",
  version,
});

describe("DocumentConflictPanel", () => {
  it("keeps comparison read-only and names all three exact sources", () => {
    const html = renderToStaticMarkup(
      <DocumentConflictPanel
        base={note("# Base\r\n", "base-version")}
        disk={note("# Disk\r\n", "disk-version")}
        draft="# Mine\r\n"
        isComparing
        isConfirmingReload={false}
        isReloading={false}
        onCancelReload={vi.fn()}
        onCompare={vi.fn()}
        onKeepMine={vi.fn()}
        onReload={vi.fn()}
        onRequestReload={vi.fn()}
        onRetry={vi.fn()}
        state="conflict"
      />,
    );

    expect(html).toContain("BASE");
    expect(html).toContain("DISK");
    expect(html).toContain("MINE");
    expect(html).toContain("CRLF");
    expect(html).toContain("Hide comparison");
    expect(html).not.toContain("textarea");
  });

  it("does not offer an overwrite action for a missing file", () => {
    const html = renderToStaticMarkup(
      <DocumentConflictPanel
        base={note("# Base\n", "base-version")}
        draft="# Mine\n"
        isComparing={false}
        isConfirmingReload={false}
        isReloading={false}
        onCancelReload={vi.fn()}
        onCompare={vi.fn()}
        onKeepMine={vi.fn()}
        onReload={vi.fn()}
        onRequestReload={vi.fn()}
        onRetry={vi.fn()}
        state="missing"
      />,
    );

    expect(html).toContain("Check again");
    expect(html).not.toContain("Keep mine");
  });
});
