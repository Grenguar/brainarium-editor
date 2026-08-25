import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import type { VaultSnapshot } from "../../shared/contracts/vault";

const executeFile = promisify(execFile);

export type GraphifyBuild = {
  graphPath: string;
  nodeCount: number;
  reportPath: string;
};

export class GraphifyService {
  constructor(
    private readonly binaryPath: string,
    private readonly outputRoot: string,
    private readonly run = executeFile,
  ) {}

  async build(snapshot: VaultSnapshot): Promise<GraphifyBuild> {
    const outputDirectory = path.join(
      this.outputRoot,
      createHash("sha256").update(snapshot.rootPath).digest("hex"),
    );
    await this.run(
      this.binaryPath,
      [
        "build",
        "--path",
        snapshot.rootPath,
        "--no-llm",
        "--output",
        outputDirectory,
        "--format",
        "json,report",
      ],
      {
        cwd: snapshot.rootPath,
        env: { HOME: process.env.HOME ?? "", PATH: process.env.PATH ?? "" },
        maxBuffer: 1024 * 1024,
        timeout: 120_000,
      },
    );
    const graphPath = path.join(outputDirectory, "graph.json");
    const reportPath = path.join(outputDirectory, "GRAPH_REPORT.md");
    await access(graphPath);
    const graph = JSON.parse(await readFile(graphPath, "utf8")) as {
      nodes?: unknown[];
    };
    return {
      graphPath,
      nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
      reportPath,
    };
  }
}
