const { MakerDeb } = require("@electron-forge/maker-deb");
const { MakerDMG } = require("@electron-forge/maker-dmg");
const { MakerRpm } = require("@electron-forge/maker-rpm");
const { MakerSquirrel } = require("@electron-forge/maker-squirrel");
const { MakerZIP } = require("@electron-forge/maker-zip");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
const { execFileSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const appDescription = "A local-first editor for the files you already trust.";

function macOSReleaseConfig() {
  if (process.env.BRAINARIUM_SIGN_MACOS !== "true") {
    return {};
  }

  const required = [
    "BRAINARIUM_MACOS_SIGNING_IDENTITY",
    "APPLE_API_KEY",
    "APPLE_API_KEY_ID",
    "APPLE_API_ISSUER",
  ];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Signed macOS release is missing: ${missing.join(", ")}. ` +
        "Use an unsigned local build or configure the release environment.",
    );
  }

  return {
    osxSign: {
      identity: process.env.BRAINARIUM_MACOS_SIGNING_IDENTITY,
      binaries: ["rust/target/release/brainarium-indexer"],
    },
    osxNotarize: {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    },
  };
}

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    appBundleId: "com.brainarium.app",
    appCategoryType: "public.app-category.productivity",
    // Linux makers derive their launcher name from package.json's `name`.
    // Keep the packaged executable aligned so .deb and .rpm creation works.
    executableName: "brainarium",
    // Extension omitted so packager picks .icns on macOS / .ico on Windows.
    icon: "./assets/icon",
    // Declares which documents Brainarium can open. This makes it eligible in
    // Finder's Open With list; macOS still requires the person to choose it as
    // the default. Rank is Alternate because Brainarium does not own either
    // format — they are plain files that many editors handle.
    // Windows and Linux associations are not wired yet.
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeExtensions: ["md", "markdown"],
          CFBundleTypeName: "Markdown Document",
          CFBundleTypeRole: "Editor",
          LSHandlerRank: "Alternate",
          LSItemContentTypes: ["net.daringfireball.markdown"],
        },
        {
          CFBundleTypeExtensions: ["csv"],
          CFBundleTypeName: "Comma-Separated Values",
          CFBundleTypeRole: "Editor",
          LSHandlerRank: "Alternate",
          LSItemContentTypes: ["public.comma-separated-values-text"],
        },
      ],
    },
    extraResource: [
      process.platform === "win32"
        ? "rust/target/release/brainarium-indexer.exe"
        : "rust/target/release/brainarium-indexer",
    ],
    ...macOSReleaseConfig(),
  },
  hooks: {
    /**
     * Ad-hoc signs an unsigned macOS build.
     *
     * Without this the packaged bundle carries a linker-signed executable but
     * no `_CodeSignature/CodeResources`, which `codesign --verify` reports as
     * "code has no resources but signature indicates they must be present".
     * Launching the app directly still works, so the breakage is invisible
     * until macOS is asked to open a *quarantined* document with it — then
     * Gatekeeper refuses and reports the document as damaged, which sends you
     * looking in entirely the wrong place.
     *
     * This is not notarization and does not pretend to be: `spctl` still
     * rejects an ad-hoc signature. It only makes the bundle self-consistent.
     * Signed release builds set BRAINARIUM_SIGN_MACOS and are skipped.
     */
    postPackage: async (_forgeConfig, options) => {
      if (options.platform !== "darwin") return;
      if (process.env.BRAINARIUM_SIGN_MACOS === "true") return;

      for (const outputPath of options.outputPaths) {
        const bundle = readdirSync(outputPath).find((entry) =>
          entry.endsWith(".app"),
        );
        if (!bundle) continue;
        execFileSync(
          "codesign",
          ["--force", "--deep", "--sign", "-", path.join(outputPath, bundle)],
          { stdio: "inherit" },
        );
      }
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({ format: "ULFO", icon: "./assets/icon.icns" }, ["darwin"]),
    new MakerSquirrel({
      authors: "Brainarium contributors",
      description: appDescription,
    }),
    new MakerDeb({
      options: {
        categories: ["Office", "Utility"],
        depends: [
          "libatk-bridge2.0-0",
          "libgtk-3-0 (>= 3.10.0)",
          "libnotify4",
          "libnss3",
          "libsecret-1-0",
          "libxss1",
          "libxtst6",
          "libuuid1",
          "xdg-utils",
        ],
        description: appDescription,
        genericName: "Local-first vault editor",
        homepage: "https://github.com/Grenguar/brainarium-editor",
        maintainer: "Brainarium contributors",
        productDescription:
          "Brainarium is a local-first editor for Markdown, CSV, and other text vault files.",
        section: "editors",
      },
    }),
    new MakerRpm({
      options: {
        categories: ["Office", "Utility"],
        description: appDescription,
        genericName: "Local-first vault editor",
        group: "Applications/Editors",
        homepage: "https://github.com/Grenguar/brainarium-editor",
        license: "Apache-2.0",
        productDescription:
          "Brainarium is a local-first editor for Markdown, CSV, and other text vault files.",
        requires: [
          "at-spi2-atk",
          "gtk3",
          "libXScrnSaver",
          "libnotify",
          "libsecret",
          "libuuid",
          "libXtst",
          "nss",
          "xdg-utils",
        ],
      },
    }),
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig: "./webpack.main.config.js",
      port: 3477,
      // 9000 is frequently occupied by local development tools.
      loggerPort: 9001,
      renderer: {
        config: "./webpack.renderer.config.js",
        entryPoints: [
          {
            html: "./src/renderer/index.html",
            js: "./src/renderer/index.tsx",
            name: "main_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
        ],
      },
    }),
  ],
};
