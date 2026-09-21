import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "scripts/{deployment-smoke-config,deployment-workflow,verify-sentry-canary,verify-staging-variables}.test.mjs"
    ],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/main.ts"]
    }
  }
})
