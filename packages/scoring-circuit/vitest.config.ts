import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/build.ts", "vitest.config.ts"],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  }
})
