import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: { reportsDirectory: process.env.LEGISLATION_COVERAGE_DIRECTORY ?? "coverage" },
    fileParallelism: process.env.LEGISLATION_TEST_DATABASE_URL === undefined,
    include: [
      "src/**/*.test.ts",
      "app/**/*.test.ts",
      "scripts/**/*.test.ts",
      "scripts/smoke-foundation.test.mjs",
      "proxy.test.ts"
    ]
  }
})
