import { describe, expect, it, vi } from "vitest";

import { RustIndexerService } from "./rust-indexer-service";

const snapshot = {
  documents: [],
  issues: [],
  rootPath: "/vault",
  tree: {
    children: [],
    kind: "directory" as const,
    name: "vault",
    relativePath: "",
  },
};

describe("RustIndexerService", () => {
  it("runs the vault-bound indexer and returns only valid graph records", async () => {
    const run = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        edges: [{ source: "alpha.md", target: "beta.md" }],
        nodes: [
          { relativePath: "alpha.md", title: "Alpha" },
          { relativePath: "beta.md", title: "Beta" },
        ],
      }),
    });
    const service = new RustIndexerService("/app/brainarium-indexer", run);

    await expect(service.build(snapshot)).resolves.toEqual({
      edges: [{ source: "alpha.md", target: "beta.md" }],
      nodes: [
        { relativePath: "alpha.md", title: "Alpha" },
        { relativePath: "beta.md", title: "Beta" },
      ],
    });
    expect(run).toHaveBeenCalledWith(
      "/app/brainarium-indexer",
      ["--vault", "/vault"],
      expect.objectContaining({ cwd: "/vault", timeout: 30_000 }),
    );
  });

  it("rejects malformed indexer output before it reaches the renderer", async () => {
    const run = vi.fn().mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({ edges: [], nodes: [{ title: "Missing path" }] }),
    });
    const service = new RustIndexerService("/app/brainarium-indexer", run);

    await expect(service.build(snapshot)).rejects.toThrow("invalid node");
  });
});
