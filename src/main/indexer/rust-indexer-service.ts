import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  VaultLinkGraph,
  VaultSnapshot,
} from "../../shared/contracts/vault";

const executeFile = promisify(execFile);

type IndexerOutput = {
  edges?: Array<{ source?: unknown; target?: unknown }>;
  nodes?: Array<{ relativePath?: unknown; title?: unknown }>;
};

/**
 * Runs the packaged Rust indexer for an explicitly active vault. The indexer
 * owns only derived `.brainarium` metadata; it receives no renderer input or
 * broad environment, and it never writes Markdown source.
 */
export class RustIndexerService {
  constructor(
    private readonly binaryPath: string,
    private readonly run = executeFile,
  ) {}

  async build(snapshot: VaultSnapshot): Promise<VaultLinkGraph> {
    const { stdout } = await this.run(
      this.binaryPath,
      ["--vault", snapshot.rootPath],
      {
        cwd: snapshot.rootPath,
        env: { PATH: process.env.PATH ?? "" },
        maxBuffer: 8 * 1024 * 1024,
        timeout: 30_000,
      },
    );
    return validateGraph(JSON.parse(stdout) as IndexerOutput);
  }
}

function validateGraph(output: IndexerOutput): VaultLinkGraph {
  if (!Array.isArray(output.nodes) || !Array.isArray(output.edges)) {
    throw new Error("The Brainarium indexer returned an invalid graph.");
  }
  const nodes = output.nodes.map((node) => {
    if (
      !node ||
      typeof node.relativePath !== "string" ||
      typeof node.title !== "string"
    ) {
      throw new Error("The Brainarium indexer returned an invalid node.");
    }
    return { relativePath: node.relativePath, title: node.title };
  });
  const paths = new Set(nodes.map((node) => node.relativePath));
  const edges = output.edges.map((edge) => {
    if (
      !edge ||
      typeof edge.source !== "string" ||
      typeof edge.target !== "string" ||
      !paths.has(edge.source) ||
      !paths.has(edge.target)
    ) {
      throw new Error("The Brainarium indexer returned an invalid edge.");
    }
    return { source: edge.source, target: edge.target };
  });
  return { edges, nodes };
}
