import { mkdtemp, mkdir, readdir, realpath, writeFile } from "node:fs/promises";
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

const fixturePdf = (() => {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n",
  ];
  let source = "%PDF-1.4\n";
  const offsets = objects.map((object) => {
    const offset = Buffer.byteLength(source, "ascii");
    source += object;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(source, "ascii");
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  source += offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(source, "ascii");
})();

let application: ElectronApplication | undefined;
let page: Page | undefined;
let fixtureRoot = "";
let userDataDirectory = "";
const githubPlanPath = "soroka-tech/projects/hackathons/webmcp/github-plan.md";
const githubPlanSource = "# GitHub plan\n\nShip the working plan first.\n";

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
  await writeFile(path.join(fixtureRoot, "paper.pdf"), fixturePdf);
  await mkdir(path.join(fixtureRoot, path.dirname(githubPlanPath)), {
    recursive: true,
  });
  await writeFile(
    path.join(fixtureRoot, githubPlanPath),
    githubPlanSource,
    "utf8",
  );
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

test("opens a verified PDF in the local read-only preview without a file URL", async () => {
  if (!page) throw new Error("Brainarium did not launch.");

  await page.getByRole("button", { name: "paper.pdf" }).click();
  const preview = page.getByRole("region", { name: "PDF preview" });
  await expect(preview).toBeVisible();
  const viewer = page.getByLabel("paper PDF page 1");
  await expect(viewer).toBeVisible();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in PDF" })).toBeEnabled();
  const frame = page.locator(".pdf-preview-frame");
  const widthBeforeZoom = (await viewer.boundingBox())?.width ?? 0;
  await page.getByRole("button", { name: "Zoom in PDF" }).click();
  await expect
    .poll(async () => (await viewer.boundingBox())?.width ?? 0)
    .toBeGreaterThan(widthBeforeZoom);
  await page.getByRole("button", { name: "Fit PDF page" }).click();
  await expect
    .poll(async () => {
      const [canvas, container] = await Promise.all([
        viewer.boundingBox(),
        frame.boundingBox(),
      ]);
      return (canvas?.width ?? Infinity) <= (container?.width ?? 0);
    })
    .toBe(true);
  await expect
    .poll(async () => (await viewer.boundingBox())?.width ?? Infinity)
    .toBeLessThan(widthBeforeZoom * 1.1);
  await page.keyboard.press("Meta+Equal");
  await expect
    .poll(async () => (await viewer.boundingBox())?.width ?? 0)
    .toBeGreaterThan(widthBeforeZoom);
  await page.keyboard.press("Meta+0");
  await expect
    .poll(async () => (await viewer.boundingBox())?.width ?? Infinity)
    .toBeLessThan(widthBeforeZoom * 1.1);
  await expect
    .poll(() =>
      page
        ?.locator(".document-workspace")
        .evaluate(
          (workspace) => workspace.scrollWidth <= workspace.clientWidth + 1,
        ),
    )
    .toBe(true);
});

test("shows readable blocks changed by an external writer until explicitly reviewed", async () => {
  if (!page) throw new Error("Brainarium did not launch.");

  await page.getByRole("button", { name: "reading.md" }).click();
  await writeFile(
    path.join(fixtureRoot, "reading.md"),
    source.replace(
      "Paragraph 1: needle source text that keeps this document readable.",
      "Paragraph 1: revised source text that keeps this document readable.",
    ),
    "utf8",
  );

  await expect(
    page.getByText(
      "Updated since you last reviewed — open Read mode to inspect it.",
    ),
  ).toBeVisible();
  const review = page.getByRole("complementary", {
    name: "Changes since you last reviewed",
  });
  await expect(review).toContainText("Updated paragraph");
  await expect(review).toContainText("revised source text");
  const reviewWidth = await review.boundingBox();
  expect(reviewWidth?.width).toBeGreaterThanOrEqual(544);
  const resizeHandle = page.getByRole("separator", {
    name: "Resize change review panel",
  });
  const widthBeforeKeyboardResize = Number(
    await resizeHandle.getAttribute("aria-valuenow"),
  );
  await resizeHandle.press("ArrowLeft");
  await expect(resizeHandle).toHaveAttribute(
    "aria-valuenow",
    String(widthBeforeKeyboardResize + 32),
  );
  await expect(page.getByLabel("Changed since reviewed")).toBeVisible();

  await review.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByLabel("Changed since reviewed")).toHaveCount(0);
});

test("reveals changed nested files and offers copy actions from their context menu", async () => {
  if (!page) throw new Error("Brainarium did not launch.");

  await writeFile(
    path.join(fixtureRoot, githubPlanPath),
    "# GitHub plan\n\nShip the revised working plan first.\n",
    "utf8",
  );

  for (const name of ["soroka-tech", "projects", "hackathons", "webmcp"]) {
    await expect(page.getByRole("button", { name })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  }
  const githubPlan = page.getByRole("button", { name: "github-plan.md" });
  await expect(githubPlan).toBeVisible();
  await expect(githubPlan.getByLabel("Changed since reviewed")).toBeVisible();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await githubPlan.click({ button: "right" });
  const menu = page.getByRole("menu", {
    name: `Actions for ${githubPlanPath}`,
  });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Copy full path" }).click();
  await expect
    .poll(() => page?.evaluate(() => navigator.clipboard.readText()))
    .toBe(path.join(await realpath(fixtureRoot), githubPlanPath));

  await githubPlan.click({ button: "right" });
  await page
    .getByRole("menu", { name: `Actions for ${githubPlanPath}` })
    .getByRole("menuitem", { name: "Copy content" })
    .click();
  await expect
    .poll(() => page?.evaluate(() => navigator.clipboard.readText()))
    .toBe("# GitHub plan\n\nShip the revised working plan first.\n");
});
