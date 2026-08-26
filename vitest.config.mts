import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/out/**", "**/dist/**", "tests/e2e/**"],
  },
});
