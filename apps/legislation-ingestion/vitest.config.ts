import { defineConfig } from "vitest/config"

const databaseTests = ["src/**/*.integration.test.ts", "src/search/passage-search-database.test.ts"]
const parsingTests = [
  "src/ingestion/regulations/{parser-*,fr-pdf*,fr-html,passage*,table-passages}.test.ts",
  "src/ingestion/documents/{extract,pdf-page-cleanup,ocr-page-mapping}.test.ts",
  "src/ingestion/govinfo/{committee-*-parser,committee-pdf-text}.test.ts"
]

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: process.env.LEGISLATION_COVERAGE_DIRECTORY ?? "coverage",
      include: ["src/**/*.ts", "tools/**/*.ts", "scripts/*.mjs"],
      exclude: ["**/*.test.{ts,mjs}"]
    },
    maxWorkers: process.env.VITEST_MAX_WORKERS ?? 4,
    projects: [
      {
        extends: true,
        test: {
          name: "ingestion",
          include: ["src/**/*.test.ts"],
          exclude: [...databaseTests, ...parsingTests],
          sequence: { groupOrder: 0 }
        }
      },
      {
        extends: true,
        test: { name: "parsing", include: parsingTests, exclude: databaseTests, sequence: { groupOrder: 1 } }
      },
      {
        extends: true,
        test: { name: "tools", include: ["tools/**/*.test.ts", "scripts/*.test.mjs"], sequence: { groupOrder: 1 } }
      },
      {
        extends: true,
        test: { name: "database", include: databaseTests, fileParallelism: false, sequence: { groupOrder: 2 } }
      }
    ]
  }
})
