import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "server/__tests__/**/*.test.ts"],
    testTimeout: 15000,
    pool: "forks",
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
