import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      // build.ts does its work on import, so it runs through `pnpm build` rather than under
      // Vitest. The browser app and the dev-server middleware are exercised in the preview.
      exclude: ["src/**/*.test.ts", "src/app/**", "src/preview/**", "src/build.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 75
      }
    }
  }
})
