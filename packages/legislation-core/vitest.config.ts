import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: { reportsDirectory: process.env.LEGISLATION_COVERAGE_DIRECTORY ?? "coverage" },
    maxWorkers: process.env.VITEST_MAX_WORKERS ?? 4,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "database",
          environment: "node",
          include: ["src/database/**/*.integration.test.ts"],
          fileParallelism: false,
          maxWorkers: 1,
          sequence: { concurrent: false, groupOrder: 1 }
        }
      }
    ]
  }
})
