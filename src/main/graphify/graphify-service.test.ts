import { describe, expect, it, vi } from "vitest";

import { GraphifyService } from "./graphify-service";

describe("GraphifyService", () => {
  it("runs an explicit no-LLM build with output outside the vault", async () => {
    const run = vi.fn().mockResolvedValue({ stderr: "", stdout: "" });
    const service = new GraphifyService("graphify-rs", "/app-data/graphs", run);

    await expect(
      service.build({
        documents: [],
        issues: [],
        rootPath: "/vault",
        tree: {
          children: [],
          kind: "directory",
          name: "vault",
          relativePath: "",
        },
      }),
    ).rejects.toThrow();

    expect(run).toHaveBeenCalledWith(
      "graphify-rs",
      expect.arrayContaining([
        "build",
        "--path",
        "/vault",
        "--no-llm",
        "--output",
        expect.stringMatching(/^\/app-data\/graphs\//),
        "--format",
        "json,report",
      ]),
      expect.objectContaining({ cwd: "/vault", timeout: 120_000 }),
    );
  });
});
