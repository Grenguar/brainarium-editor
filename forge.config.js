const { MakerZIP } = require("@electron-forge/maker-zip");
const { WebpackPlugin } = require("@electron-forge/plugin-webpack");

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    extraResource: ["rust/target/release/brainarium-indexer"],
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ["darwin"])],
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
