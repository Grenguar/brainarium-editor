import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type {
  VaultDocumentContent,
  ImageImportResult,
  VaultImageContent,
  VaultImageRequest,
  VaultSnapshot,
} from "../../shared/contracts/vault";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const MIME_BY_EXTENSION = new Map<string, VaultImageContent["mimeType"]>([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function decodedLocalAssetPath(assetPath: string): string {
  if (
    !assetPath ||
    assetPath.includes("\u0000") ||
    assetPath.startsWith("//") ||
    assetPath.startsWith("\\\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(assetPath)
  ) {
    throw new Error("Only local vault images can be rendered.");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(assetPath);
  } catch {
    throw new Error("That local image path is malformed.");
  }
  if (decoded.includes("\u0000")) {
    throw new Error("That local image path is malformed.");
  }
  return decoded;
}

function expectedMimeType(resolvedPath: string): VaultImageContent["mimeType"] {
  const mimeType = MIME_BY_EXTENSION.get(
    path.extname(resolvedPath).toLowerCase(),
  );
  if (!mimeType) {
    throw new Error("That file type is not an allowed local image.");
  }
  return mimeType;
}

function hasExpectedSignature(
  bytes: Buffer,
  mimeType: VaultImageContent["mimeType"],
): boolean {
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  }
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mimeType === "image/gif") {
    return (
      bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
      bytes.subarray(0, 6).toString("ascii") === "GIF89a"
    );
  }
  if (mimeType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return (
    bytes.subarray(4, 8).toString("ascii") === "ftyp" &&
    (bytes.subarray(8, 12).toString("ascii") === "avif" ||
      bytes.subarray(8, 12).toString("ascii") === "avis")
  );
}

/**
 * Loads an inert image from the active vault. It intentionally does not share
 * the text-search/MCP extension set: image files can appear in the tree and
 * open in the document preview, but their bytes never enter text search or MCP.
 */
export async function readVaultImage(
  snapshot: VaultSnapshot,
  request: VaultImageRequest,
): Promise<VaultImageContent> {
  const source = snapshot.documents.find(
    (document) =>
      document.kind === "markdown" &&
      document.relativePath === request.sourceRelativePath,
  );
  if (!source) {
    throw new Error("The source note is not in the active vault.");
  }

  const assetPath = decodedLocalAssetPath(request.assetPath);
  const rootPath = await realpath(snapshot.rootPath);
  const localPath = assetPath.startsWith("/")
    ? assetPath.slice(1)
    : path.join(path.dirname(source.relativePath), assetPath);
  if (localPath.split(/[\\/]+/)[0] === ".brainarium") {
    throw new Error("That image is outside the visible vault.");
  }
  const unresolvedPath = path.resolve(
    rootPath,
    localPath.split("/").join(path.sep),
  );
  if (!isPathInside(rootPath, unresolvedPath)) {
    throw new Error("That image is outside the visible vault.");
  }
  const resolvedPath = await realpath(unresolvedPath);
  const relativePath = path.relative(rootPath, resolvedPath);
  if (
    !isPathInside(rootPath, resolvedPath) ||
    relativePath.split(path.sep)[0] === ".brainarium"
  ) {
    throw new Error("That image is outside the visible vault.");
  }

  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile() || fileStats.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is unavailable or too large to render.");
  }
  const mimeType = expectedMimeType(resolvedPath);
  const bytes = await readFile(resolvedPath);
  if (!hasExpectedSignature(bytes, mimeType)) {
    throw new Error("That image does not match its expected file type.");
  }
  return { bytes: new Uint8Array(bytes), mimeType };
}

/** Reads an indexed image as a standalone, inert vault document. */
export async function readVaultImageDocument(
  snapshot: VaultSnapshot,
  relativePath: string,
): Promise<VaultDocumentContent> {
  const document = snapshot.documents.find(
    (candidate) =>
      candidate.kind === "image" && candidate.relativePath === relativePath,
  );
  if (!document) throw new Error("That image is not part of the active vault.");

  const rootPath = await realpath(snapshot.rootPath);
  const resolvedPath = await realpath(
    path.join(rootPath, document.relativePath),
  );
  const resolvedRelativePath = path.relative(rootPath, resolvedPath);
  if (
    !isPathInside(rootPath, resolvedPath) ||
    resolvedRelativePath.split(path.sep)[0] === ".brainarium"
  ) {
    throw new Error("That image is outside the visible vault.");
  }
  const fileStats = await stat(resolvedPath);
  if (!fileStats.isFile() || fileStats.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is unavailable or too large to render.");
  }
  const mimeType = expectedMimeType(resolvedPath);
  const bytes = await readFile(resolvedPath);
  if (!hasExpectedSignature(bytes, mimeType)) {
    throw new Error("That image does not match its expected file type.");
  }
  return {
    image: { bytes: new Uint8Array(bytes), mimeType },
    kind: "image",
    relativePath: document.relativePath,
    text: "",
    title: document.title,
    version: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function importVaultImage(
  snapshot: VaultSnapshot,
  sourceRelativePath: string,
  pickedPath: string,
): Promise<ImageImportResult> {
  const source = snapshot.documents.find(
    (document) =>
      document.kind === "markdown" &&
      document.relativePath === sourceRelativePath,
  );
  if (!source) throw new Error("The source note is not in the active vault.");

  const imported = await readVerifiedImageFile(pickedPath);
  const rootPath = await realpath(snapshot.rootPath);
  const sourceDirectory = path.dirname(source.relativePath);
  const targetDirectory = path.join(rootPath, "images", sourceDirectory);
  await mkdir(targetDirectory, { recursive: true });
  const resolvedDirectory = await realpath(targetDirectory);
  if (!isPathInside(rootPath, resolvedDirectory)) {
    throw new Error("The source note is outside the active vault.");
  }
  const extension = path.extname(pickedPath).toLowerCase();
  const baseName =
    path.basename(pickedPath, extension).replace(/[^a-z0-9._-]+/gi, "-") ||
    "image";
  let name = `${baseName}${extension}`;
  let targetPath = path.join(resolvedDirectory, name);
  let suffix = 2;
  while (true) {
    try {
      const existing = await readVerifiedImageFile(targetPath);
      if (Buffer.from(existing.bytes).equals(Buffer.from(imported.bytes)))
        break;
      name = `${baseName}-${suffix}${extension}`;
      targetPath = path.join(resolvedDirectory, name);
      suffix += 1;
    } catch (error) {
      if (isMissingError(error)) {
        const temporaryPath = path.join(resolvedDirectory, `.${name}.tmp`);
        await writeFile(temporaryPath, imported.bytes);
        await rename(temporaryPath, targetPath);
        break;
      }
      throw error;
    }
  }
  const relativePath = path
    .relative(rootPath, targetPath)
    .split(path.sep)
    .join("/");
  if (path.resolve(pickedPath) !== targetPath) await unlink(pickedPath);
  const markdownPath = path
    .relative(sourceDirectory, relativePath)
    .split(path.sep)
    .join("/");
  return {
    markdown: `![${baseName.replace(/[-_]+/g, " ")}](${markdownPath.startsWith(".") ? markdownPath : `./${markdownPath}`})`,
    relativePath,
  };
}

async function readVerifiedImageFile(
  filePath: string,
): Promise<VaultImageContent> {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile() || fileStats.size > MAX_IMAGE_BYTES) {
    throw new Error("That image is unavailable or too large to render.");
  }
  const mimeType = expectedMimeType(filePath);
  const bytes = await readFile(filePath);
  if (!hasExpectedSignature(bytes, mimeType)) {
    throw new Error("That image does not match its expected file type.");
  }
  return { bytes: new Uint8Array(bytes), mimeType };
}

function isMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
