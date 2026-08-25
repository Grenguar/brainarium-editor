module.exports = [
  {
    exclude: /node_modules/,
    test: /\.[jt]sx?$/,
    use: {
      loader: "ts-loader",
      options: { transpileOnly: true },
    },
  },
  {
    test: /\.css$/,
    use: ["style-loader", "css-loader"],
  },
];
