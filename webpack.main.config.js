const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const rules = require("./webpack.rules");

module.exports = {
  entry: "./src/main/index.ts",
  module: { rules },
  plugins: [new ForkTsCheckerWebpackPlugin()],
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  },
};
