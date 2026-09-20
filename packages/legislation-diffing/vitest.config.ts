import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 }
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"]
        }
      }
    ]
  }
})
