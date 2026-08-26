import { describe, expect, it } from "vitest";

import {
  shortcutLabels,
  shortcutPlatform,
  usesPrimaryModifier,
} from "./shortcuts";

describe("keyboard shortcut presentation", () => {
  it("uses macOS symbols only on macOS", () => {
    expect(shortcutPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe(
      "macos",
    );
    expect(shortcutLabels("macos").searchVault).toBe("⇧⌘F");
    expect(shortcutLabels("macos").copyContent).toBe("⇧⌘C");
  });

  it("uses Ctrl labels and rejects Meta on Windows and Linux", () => {
    expect(shortcutPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "other",
    );
    expect(shortcutPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
    expect(shortcutLabels("other").findInFile).toBe("Ctrl+F");
    expect(
      usesPrimaryModifier("other", { ctrlKey: true, metaKey: false }),
    ).toBe(true);
    expect(
      usesPrimaryModifier("other", { ctrlKey: false, metaKey: true }),
    ).toBe(false);
  });

  it("uses Command rather than Control on macOS", () => {
    expect(
      usesPrimaryModifier("macos", { ctrlKey: false, metaKey: true }),
    ).toBe(true);
    expect(
      usesPrimaryModifier("macos", { ctrlKey: true, metaKey: false }),
    ).toBe(false);
  });
});
