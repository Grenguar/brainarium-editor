import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";

const source = `# Reading source\n\n${Array.from(
  { length: 80 },
  (_, index) =>
    `Paragraph ${index + 1}: needle source text that keeps this document readable.`,
).join("\n\n")}\n\n![Fixture image](image.png)\n`;

const fixturePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6owAAAABJRU5ErkJggg==",
  "base64",
);

let application: ElectronApplication | undefined;
let page: Page | undefined;
let fixtureRoot = "";
let userDataDirectory = "";

async function packagedExecutable(): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("Electron UI validation is currently run on macOS.");
  }
  const outputDirectory = path.join(process.cwd(), "out");
  const candidates = await readdir(outputDirectory);
  const packageDirectory = candidates.find((candidate) =>
    candidate.endsWith(`-darwin-${process.arch}`),
  );
  if (!packageDirectory)
    throw new Error("No packaged Brainarium app was found.");
  return path.join(
    outputDirectory,
    packageDirectory,
    "Brainarium.app",
    "Contents",
    "MacOS",
    "Brainarium",
  );
}

async function launch(): Promise<Page> {
  application = await electron.launch({
    args: [`--user-data-dir=${userDataDirectory}`],
    executablePath: await packagedExecutable(),
  });
  page = await application.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return page;
}

test.beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "brainarium-e2e-vault-"));
  userDataDirectory = await mkdtemp(
    path.join(os.tmpdir(), "brainarium-e2e-user-data-"),
  );
  await writeFile(path.join(fixtureRoot, "reading.md"), source, "utf8");
  await writeFile(path.join(fixtureRoot, "image.png"), fixturePng);
  await writeFile(
    path.join(fixtureRoot, "skills-lock.json"),
    JSON.stringify({ name: "dark theme fixture", version: 1 }, null, 2),
    "utf8",
  );
  await mkdir(userDataDirectory, { recursive: true });
  await writeFile(
    path.join(userDataDirectory, "vault-session.json"),
    JSON.stringify({
      activeDocumentPath: "reading.md",
      scrollPositions: { "reading.md": 360 },
      vaultPath: fixtureRoot,
    }),
    "utf8",
  );
  await launch();
});

test.afterAll(async () => {
  await application?.close();
});

test("keeps search focused, copies plain source, and restores the reading workspace", async () => {
  if (!page) throw new Error("Brainarium did not launch.");

  await expect(
    page.getByRole("heading", { name: "Reading source" }),
  ).toBeVisible();
  const workspace = page.locator(".document-workspace");
  await expect
    .poll(() => workspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(200);

  await page.keyboard.press("Meta+Shift+F");
  const search = page.getByRole("searchbox", { name: "Search this vault" });
  await expect(search).toBeFocused();
  const searchForm = page.locator(".vault-search-form");
  const triggerBox = await page.locator(".vault-search-trigger").boundingBox();
  const formBox = await searchForm.boundingBox();
  const searchBox = await search.boundingBox();
  expect(formBox?.width).toBeGreaterThan(220);
  expect(
    Math.abs((formBox?.width ?? 0) - (triggerBox?.width ?? 0)),
  ).toBeLessThan(1);
  expect(searchBox?.width).toBeGreaterThan(150);
  expect(formBox?.y).toBeGreaterThan(
    (triggerBox?.y ?? 0) + (triggerBox?.height ?? 0),
  );
  await search.fill("needle");
  await search.press("Enter");
  await expect(
    page.getByRole("region", { name: "Vault search results" }),
  ).toContainText("Reading source");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("Meta+Shift+C");
  await expect
    .poll(() => page?.evaluate(() => navigator.clipboard.readText()))
    .toBe(source);

  await page
    .getByRole("heading", { name: "Reading source" })
    .evaluate((node) => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(node);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  await page.keyboard.press("Meta+C");
  await expect
    .poll(() => page?.evaluate(() => navigator.clipboard.readText()))
    .toBe("Reading source");

  await workspace.evaluate((element) => {
    element.scrollTop = 520;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(250);
  await page.keyboard.press("Meta+R");
  await expect(
    page.getByRole("heading", { name: "Reading source" }),
  ).toBeVisible();
  await expect
    .poll(() => workspace.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(400);

  await page.getByRole("button", { name: "Use night theme" }).click();
  await page.getByRole("button", { name: "skills-lock.json" }).click();
  const jsonSource = page.locator(".document-source");
  await expect(jsonSource).toBeVisible();
  await expect(jsonSource).toContainText("dark theme fixture");
  await expect
    .poll(() =>
      jsonSource.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      }),
    )
    .toEqual({ background: "rgb(40, 49, 46)", color: "rgb(230, 238, 232)" });
});

test("decodes verified images in Markdown and the standalone image preview", async () => {
  if (!page) throw new Error("Brainarium did not launch.");

  await page.getByRole("button", { name: "reading.md" }).click();
  const embedded = page.getByRole("img", { name: "Fixture image" });
  await expect(embedded).toBeVisible();
  await expect
    .poll(() =>
      embedded.evaluate((image) => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
      })),
    )
    .toEqual({ complete: true, naturalWidth: 1 });

  await page.getByRole("button", { name: "image.png" }).click();
  await expect(
    page.getByRole("region", { name: "Image preview" }),
  ).toBeVisible();
  const standalone = page.getByRole("img", { name: "image" });
  await expect
    .poll(() =>
      standalone.evaluate((image) => ({
        complete: image.complete,
        naturalWidth: image.naturalWidth,
      })),
    )
    .toEqual({ complete: true, naturalWidth: 1 });
});
