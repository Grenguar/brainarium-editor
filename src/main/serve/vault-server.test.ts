import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { VaultSnapshot } from "../../shared/contracts/vault";
import { scanVault } from "../vault/vault-scanner";
import { VaultServer, decodeRelativePath, findDocument } from "./vault-server";

const temporaryRoots: string[] = [];
const servers: VaultServer[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-serve-"));
  temporaryRoots.push(directory);
  return directory;
}

async function serving(snapshot: VaultSnapshot | undefined): Promise<{
  code: string;
  origin: string;
}> {
  const server = new VaultServer(() => snapshot);
  servers.push(server);
  const address = await server.start();
  return { code: address.code, origin: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  // Not in the test body: a failed assertion would otherwise leave a listening
  // socket open and hang the run.
  await Promise.all(servers.splice(0).map((server) => server.stop()));
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function vaultWithNote(): Promise<VaultSnapshot> {
  const root = await temporaryDirectory();
  await writeFile(
    path.join(root, "plan.md"),
    "# The plan\n\nShip it. See [[other-note]] and [[nowhere]].\n",
    "utf8",
  );
  await writeFile(path.join(root, "other-note.md"), "# Other note\n", "utf8");
  return scanVault(root);
}

describe("decodeRelativePath", () => {
  it("accepts a normal encoded path under the prefix", () => {
    expect(decodeRelativePath("/n/notes/my%20plan.md", "/n/")).toBe(
      "notes/my plan.md",
    );
  });

  it("refuses traversal, dot segments, and NUL", () => {
    expect(decodeRelativePath("/n/../secret.md", "/n/")).toBeUndefined();
    expect(
      decodeRelativePath("/n/.brainarium/graph-v1.json", "/n/"),
    ).toBeUndefined();
    expect(decodeRelativePath("/n/notes/%00.md", "/n/")).toBeUndefined();
    expect(decodeRelativePath("/n/%E0%A4%A", "/n/")).toBeUndefined();
  });

  it("refuses a path outside its prefix or with nothing after it", () => {
    expect(decodeRelativePath("/asset/x.png", "/n/")).toBeUndefined();
    expect(decodeRelativePath("/n/", "/n/")).toBeUndefined();
  });
});

describe("findDocument", () => {
  it("matches exactly, never case-insensitively", async () => {
    const snapshot = await vaultWithNote();
    expect(findDocument(snapshot, "plan.md")?.relativePath).toBe("plan.md");
    expect(findDocument(snapshot, "PLAN.MD")).toBeUndefined();
  });
});

describe("VaultServer", () => {
  it("refuses every vault route until the device is paired", async () => {
    const { origin } = await serving(await vaultWithNote());

    for (const route of ["/", "/n/plan.md", "/asset/plan.md?ref=x.png"]) {
      const response = await fetch(`${origin}${route}`, { redirect: "manual" });
      expect(response.status).toBe(401);
    }
  });

  it("serves the stylesheet without pairing so the pairing page is legible", async () => {
    const { origin } = await serving(await vaultWithNote());
    const response = await fetch(`${origin}/style.css`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
  });

  it("rejects a wrong pairing code and accepts the right one", async () => {
    const { code, origin } = await serving(await vaultWithNote());

    const wrong = await fetch(`${origin}/pair`, {
      body: new URLSearchParams({ code: "AAAAAA" }),
      method: "POST",
      redirect: "manual",
    });
    expect(wrong.status).toBe(401);

    const right = await fetch(`${origin}/pair`, {
      body: new URLSearchParams({ code }),
      method: "POST",
      redirect: "manual",
    });
    expect(right.status).toBe(303);
    expect(right.headers.get("set-cookie")).toContain("HttpOnly");
    expect(right.headers.get("set-cookie")).toContain("SameSite=Strict");
  });

  it("renders a paired note with wiki links rewritten to routes", async () => {
    const snapshot = await vaultWithNote();
    const { code, origin } = await serving(snapshot);
    const cookie = `brainarium_pair=${code}`;

    const index = await fetch(`${origin}/`, { headers: { cookie } });
    expect(index.status).toBe(200);
    expect(await index.text()).toContain("plan.md");

    const note = await fetch(`${origin}/n/plan.md`, { headers: { cookie } });
    const html = await note.text();
    expect(note.status).toBe(200);
    expect(html).toContain("The plan");
    expect(html).toContain('href="/n/other-note.md"');
    expect(html).not.toContain("brainarium-wiki:");
    // An unresolvable target stays readable but inert, as in the desktop reader.
    expect(html).toContain("wiki-link-missing");
    expect(html).toContain("This note is not in the vault.");
  });

  it("sets hardening headers on served pages", async () => {
    const { code, origin } = await serving(await vaultWithNote());
    const response = await fetch(`${origin}/n/plan.md`, {
      headers: { cookie: `brainarium_pair=${code}` },
    });

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  });

  it("returns 404 for a path that is not a scanned document", async () => {
    const { code, origin } = await serving(await vaultWithNote());
    const response = await fetch(`${origin}/n/absent.md`, {
      headers: { cookie: `brainarium_pair=${code}` },
    });

    expect(response.status).toBe(404);
  });

  it("reports no vault rather than failing when none is open", async () => {
    const { code, origin } = await serving(undefined);
    const response = await fetch(`${origin}/`, {
      headers: { cookie: `brainarium_pair=${code}` },
    });

    expect(response.status).toBe(503);
  });

  it("refuses to read a text document past the served size cap", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "huge.txt"), "x".repeat(6 * 1024 * 1024));
    const { code, origin } = await serving(await scanVault(root));

    const response = await fetch(`${origin}/n/huge.txt`, {
      headers: { cookie: `brainarium_pair=${code}` },
    });
    expect(response.status).toBe(413);
  });

  it("stops listening when stopped", async () => {
    const snapshot = await vaultWithNote();
    const server = new VaultServer(() => snapshot);
    const address = await server.start();
    await server.stop();

    await expect(
      fetch(`http://127.0.0.1:${address.port}/style.css`),
    ).rejects.toThrow();
  });
});
