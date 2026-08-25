const { MakerDeb } = require("@electron-forge/maker-deb");
const { MakerDMG } = require("@electron-forge/maker-dmg");
const { MakerRpm } = require("@electron-forge/maker-rpm");
const { MakerSquirrel } = require("@electron-forge/maker-squirrel");
const { MakerZIP } = require("@electron-forge/maker-zip");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
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
    extraResource: ["rust/target/release/brainarium-indexer"],
    ...macOSReleaseConfig(),
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ["darwin"]),
    new MakerDMG({ format: "ULFO" }, ["darwin"]),
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
        license: "UNLICENSED",
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
