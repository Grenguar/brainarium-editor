const { MakerDMG } = require("@electron-forge/maker-dmg");
const { MakerZIP } = require("@electron-forge/maker-zip");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");
const process = require("node:process");

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
