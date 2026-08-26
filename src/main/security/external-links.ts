/**
 * Returns a canonical browser URL only for plain HTTP(S) links. Renderer code
 * must use the returned value through main-process shell.openExternal rather
 * than navigating an Electron window directly.
 */
export function validatedExternalUrl(value: string): string | undefined {
  if (
    !value ||
    value.trim() !== value ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    return undefined;
  }

  return url.toString();
}
