const rules = require("./webpack.rules");

module.exports = {
  // The renderer CSP intentionally disallows eval. Use external source maps so
  // development bundles remain debuggable without requiring unsafe-eval.
  devtool: "source-map",
  module: { rules },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json"],
  },
};
