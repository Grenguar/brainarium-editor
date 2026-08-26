import { describe, expect, it } from "vitest";

import { validatedExternalUrl } from "./external-links";

describe("validatedExternalUrl", () => {
  it("allows canonical HTTP(S) browser links", () => {
    expect(validatedExternalUrl("https://example.com/path?q=one#part")).toBe(
      "https://example.com/path?q=one#part",
    );
    expect(validatedExternalUrl("http://example.com")).toBe(
      "http://example.com/",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///Users/igorsoroka/secret.txt",
    "//example.com/path",
    "https://name:password@example.com/",
    " https://example.com",
    "https://example.com\nnext",
    "not a url",
  ])("rejects a non-browser or unsafe target: %s", (value) => {
    expect(validatedExternalUrl(value)).toBeUndefined();
  });
});
