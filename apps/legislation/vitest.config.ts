import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
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
