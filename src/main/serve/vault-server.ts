import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import type {
  VaultDocument,
  VaultSnapshot,
} from "../../shared/contracts/vault";
import { hasTextContent } from "../../shared/documents";
import {
  readVaultImage,
  readVaultImageDocument,
} from "../vault/vault-image-reader";
import { readVaultPdfDocument } from "../vault/vault-pdf-reader";
import { readVaultDocument } from "../vault/vault-reader";
import {
  buildIndexPage,
  buildMessagePage,
  buildNotePage,
  buildPairPage,
  WEB_CSP,
} from "./web-document";
import { webStyles } from "./web-styles";

/**
 * Text documents have no read limit anywhere in the app — the caps live only in
 * the image and PDF readers. Over HTTP an unbounded read is memory
 * amplification, one request per connection, so the boundary imposes its own.
 */
export const MAX_SERVED_TEXT_BYTES = 5 * 1024 * 1024;

const COOKIE_NAME = "brainarium_pair";
/** Omits characters that are easy to misread when typed off a screen. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export type VaultServerOptions = {
  host?: string;
  port?: number;
};

export type VaultServerAddress = {
  code: string;
  host: string;
  port: number;
};

const pairingCode = (): string => {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
};

const constantTimeEquals = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const cookieValue = (
  header: string | undefined,
  name: string,
): string | undefined =>
  header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

/** Decodes a URL path into vault-relative form, or undefined if malformed. */
export const decodeRelativePath = (
  pathname: string,
  prefix: string,
): string | undefined => {
  if (!pathname.startsWith(prefix)) return undefined;
  const raw = pathname.slice(prefix.length);
  if (!raw) return undefined;
  try {
    const decoded = raw.split("/").map(decodeURIComponent).join("/");
    // Structural guards. Lookup is an exact match against the scanned document
    // list, so traversal cannot succeed anyway, but the boundary states its own
    // rules rather than inheriting an invariant from the scanner.
    if (decoded.includes("\0") || decoded.includes("..")) return undefined;
    if (decoded.split("/").some((segment) => segment.startsWith(".")))
      return undefined;
    return decoded;
  } catch {
    return undefined;
  }
};

export const findDocument = (
  snapshot: VaultSnapshot,
  relativePath: string,
): VaultDocument | undefined =>
  // Exact match only: relativePath is stored case-preserved, and a
  // case-insensitive match would break the allowlist equivalence the readers
  // rely on.
  snapshot.documents.find(
    (candidate) => candidate.relativePath === relativePath,
  );

/**
 * A read-only HTTP view of the opened vault.
 *
 * Binds loopback and nothing else; reachability from another device is left to
 * `tailscale serve`, so the process never listens on an externally reachable
 * socket. Serves no write, MCP, search or agent surface.
 */
export class VaultServer {
  private server: Server | undefined;
  private code = "";
  private generation = 0;

  constructor(
    private readonly getSnapshot: () => VaultSnapshot | undefined,
    private readonly options: VaultServerOptions = {},
  ) {}

  get address(): VaultServerAddress | undefined {
    const info = this.server?.address() as AddressInfo | null | undefined;
    if (!info || typeof info === "string") return undefined;
    return { code: this.code, host: info.address, port: info.port };
  }

  async start(): Promise<VaultServerAddress> {
    await this.stop();
    const generation = ++this.generation;
    this.code = pairingCode();
    const server = createServer((request, response) => {
      // A vault switch or a stop must never let an in-flight request answer
      // from the previous generation's state.
      if (generation !== this.generation) {
        response.writeHead(503).end();
        return;
      }
      void this.handle(request, response).catch(() => {
        if (!response.headersSent) response.writeHead(500);
        response.end();
      });
    });
    this.server = server;

    const host = this.options.host ?? "127.0.0.1";
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.options.port ?? 0, host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    const address = this.address;
    if (!address)
      throw new Error("The vault server did not report an address.");
    return address;
  }

  async stop(): Promise<void> {
    this.generation += 1;
    const server = this.server;
    this.server = undefined;
    this.code = "";
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private send(
    response: ServerResponse,
    status: number,
    body: string | Buffer,
    contentType: string,
  ): void {
    response.writeHead(status, {
      "Content-Security-Policy": WEB_CSP,
      "Content-Type": contentType,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  }

  private isPaired(request: IncomingMessage): boolean {
    const presented = cookieValue(request.headers.cookie, COOKIE_NAME);
    return Boolean(
      presented && this.code && constantTimeEquals(presented, this.code),
    );
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURI(url.pathname);

    if (pathname === "/style.css") {
      this.send(response, 200, webStyles, "text/css; charset=utf-8");
      return;
    }

    if (pathname === "/pair") {
      await this.handlePairing(request, response);
      return;
    }

    if (!this.isPaired(request)) {
      this.send(
        response,
        401,
        buildPairPage(false),
        "text/html; charset=utf-8",
      );
      return;
    }

    const snapshot = this.getSnapshot();
    if (!snapshot) {
      this.send(
        response,
        503,
        buildMessagePage(
          "No vault open",
          "Open a vault in Brainarium to read it here.",
        ),
        "text/html; charset=utf-8",
      );
      return;
    }

    if (pathname === "/") {
      this.send(
        response,
        200,
        buildIndexPage(snapshot.tree, snapshot.documents.length),
        "text/html; charset=utf-8",
      );
      return;
    }

    if (pathname.startsWith("/asset/")) {
      await this.handleAsset(snapshot, pathname, url, response);
      return;
    }

    if (pathname.startsWith("/n/")) {
      await this.handleDocument(snapshot, pathname, response);
      return;
    }

    this.send(
      response,
      404,
      buildMessagePage("Not found", "No such page."),
      "text/html; charset=utf-8",
    );
  }

  private async handlePairing(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== "POST") {
      this.send(
        response,
        200,
        buildPairPage(false),
        "text/html; charset=utf-8",
      );
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      size += (chunk as Buffer).length;
      if (size > 1024) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const submitted =
      new URLSearchParams(Buffer.concat(chunks).toString("utf8")).get("code") ??
      "";
    if (
      !this.code ||
      !constantTimeEquals(submitted.trim().toUpperCase(), this.code)
    ) {
      this.send(response, 401, buildPairPage(true), "text/html; charset=utf-8");
      return;
    }
    response.writeHead(303, {
      Location: "/",
      "Set-Cookie": `${COOKIE_NAME}=${this.code}; HttpOnly; Path=/; SameSite=Strict; Max-Age=2592000`,
    });
    response.end();
  }

  private notFound(response: ServerResponse): void {
    this.send(
      response,
      404,
      buildMessagePage("Not found", "That file is not part of the open vault."),
      "text/html; charset=utf-8",
    );
  }

  private async handleAsset(
    snapshot: VaultSnapshot,
    pathname: string,
    url: URL,
    response: ServerResponse,
  ): Promise<void> {
    const notePath = decodeRelativePath(pathname, "/asset/");
    const reference = url.searchParams.get("ref");
    if (!notePath) {
      this.notFound(response);
      return;
    }
    try {
      if (reference) {
        const image = await readVaultImage(snapshot, {
          assetPath: reference,
          sourceRelativePath: notePath,
        });
        this.send(response, 200, Buffer.from(image.bytes), image.mimeType);
        return;
      }
      const document = await readVaultImageDocument(snapshot, notePath);
      const bytes = document.image?.bytes;
      if (!bytes) {
        this.notFound(response);
        return;
      }
      this.send(
        response,
        200,
        Buffer.from(bytes),
        document.image?.mimeType ?? "application/octet-stream",
      );
    } catch {
      this.notFound(response);
    }
  }

  private async handleDocument(
    snapshot: VaultSnapshot,
    pathname: string,
    response: ServerResponse,
  ): Promise<void> {
    const relativePath = decodeRelativePath(pathname, "/n/");
    if (!relativePath) {
      this.notFound(response);
      return;
    }
    const listed = findDocument(snapshot, relativePath);
    if (!listed) {
      this.notFound(response);
      return;
    }

    if (listed.kind === "image") {
      const document = await readVaultImageDocument(snapshot, relativePath);
      const bytes = document.image?.bytes;
      if (!bytes) {
        this.notFound(response);
        return;
      }
      this.send(
        response,
        200,
        Buffer.from(bytes),
        document.image?.mimeType ?? "application/octet-stream",
      );
      return;
    }

    if (listed.kind === "pdf") {
      const document = await readVaultPdfDocument(snapshot, relativePath);
      const bytes = document.pdf?.bytes;
      if (!bytes) {
        this.notFound(response);
        return;
      }
      this.send(response, 200, Buffer.from(bytes), "application/pdf");
      return;
    }

    if (!hasTextContent(listed.kind)) {
      this.notFound(response);
      return;
    }

    if (listed.size > MAX_SERVED_TEXT_BYTES) {
      this.send(
        response,
        413,
        buildMessagePage(
          "Too large to read here",
          `This file is ${Math.round(listed.size / 1_048_576)} MB. Open it on your computer instead.`,
        ),
        "text/html; charset=utf-8",
      );
      return;
    }

    try {
      const document = await readVaultDocument(snapshot, relativePath);
      this.send(
        response,
        200,
        await buildNotePage(document, snapshot),
        "text/html; charset=utf-8",
      );
    } catch {
      this.notFound(response);
    }
  }
}
