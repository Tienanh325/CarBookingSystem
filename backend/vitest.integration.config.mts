import "dotenv/config";
import { defineConfig } from "vitest/config";

process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.integration.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000
  }
});
