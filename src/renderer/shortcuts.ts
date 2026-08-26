export type ShortcutPlatform = "macos" | "other";

export type ShortcutLabels = {
  back: string;
  connections: string;
  copyContent: string;
  findInFile: string;
  forward: string;
  globalGraph: string;
  quickOpen: string;
  searchVault: string;
  toggleEditorMode: string;
  toggleReadEdit: string;
};

export const shortcutPlatform = (userAgent: string): ShortcutPlatform =>
  /macintosh|mac os x|mac_powerpc/i.test(userAgent) ? "macos" : "other";

export const usesPrimaryModifier = (
  platform: ShortcutPlatform,
  event: Pick<KeyboardEvent, "ctrlKey" | "metaKey">,
): boolean =>
  platform === "macos"
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;

export const shortcutLabels = (platform: ShortcutPlatform): ShortcutLabels => {
  if (platform === "macos") {
    return {
      back: "⌥←",
      connections: "⇧⌘G",
      copyContent: "⇧⌘C",
      findInFile: "⌘F",
      forward: "⌥→",
      globalGraph: "⌘G",
      quickOpen: "⌘P",
      searchVault: "⇧⌘F",
      toggleEditorMode: "⇧⌘M",
      toggleReadEdit: "⌘E",
    };
  }

  return {
    back: "Alt+←",
    connections: "Ctrl+Shift+G",
    copyContent: "Ctrl+Shift+C",
    findInFile: "Ctrl+F",
    forward: "Alt+→",
    globalGraph: "Ctrl+G",
    quickOpen: "Ctrl+P",
    searchVault: "Ctrl+Shift+F",
    toggleEditorMode: "Ctrl+Shift+M",
    toggleReadEdit: "Ctrl+E",
  };
};
