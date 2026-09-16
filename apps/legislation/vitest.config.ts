import { fileURLToPath } from "node:url"
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin"
import { defineConfig } from "vitest/config"

const webTests = ["app/**/*.test.{ts,tsx}", "src/{components,web}/**/*.test.{ts,tsx}", "proxy.test.ts"]
const databaseTests = [
  "src/**/*.integration.test.ts",
  "src/api/subscription-repository.test.ts",
  "src/api/webhook-read-repository.test.ts",
  "src/search/passage-search-database.test.ts"
]
const parsingTests = [
  "src/ingestion/regulations/{parser-*,fr-pdf*,fr-html,reader-text,passage*,table-passages}.test.ts",
  "src/ingestion/documents/{extract,pdf-page-cleanup,ocr-page-mapping}.test.ts",
  "src/ingestion/govinfo/{committee-*-parser,committee-pdf-text}.test.ts",
  "src/models/embedding-tokenizer.test.ts"
]
const ingestionTests = ["src/{ingestion,trigger}/**/*.test.ts"]
const acceptanceTests = ["scripts/next-router-acceptance.test.ts", "scripts/smoke*.test.mjs"]

export default defineConfig({
  test: {
    coverage: { reportsDirectory: process.env.LEGISLATION_COVERAGE_DIRECTORY ?? "coverage" },
    maxWorkers: process.env.VITEST_MAX_WORKERS ?? 4,
    projects: [
      {
        extends: true,
        plugins: [vanillaExtractPlugin()],
        resolve: { alias: { "@": fileURLToPath(new URL("./app", import.meta.url)) } },
        oxc: { jsx: { runtime: "automatic" } },
        test: { name: "web", include: webTests, sequence: { groupOrder: 0 } }
      },
      {
        extends: true,
        test: {
          name: "backend",
          include: ["src/**/*.test.ts"],
          exclude: [...webTests, ...databaseTests, ...parsingTests, ...ingestionTests],
          sequence: { groupOrder: 0 }
        }
      },
      {
        extends: true,
        test: {
          name: "ingestion",
          include: ingestionTests,
          exclude: [...databaseTests, ...parsingTests],
          sequence: { groupOrder: 1 }
        }
      },
      {
        extends: true,
        test: {
          name: "parsing",
          include: parsingTests,
          exclude: databaseTests,
          sequence: { groupOrder: 1 }
        }
      },
      {
        extends: true,
        test: {
          name: "tools",
          include: ["tools/**/*.test.ts", "scripts/*.test.mjs"],
          exclude: acceptanceTests,
          sequence: { groupOrder: 1 }
        }
      },
      {
        extends: true,
        test: {
          name: "database",
          include: databaseTests,
          fileParallelism: false,
          sequence: { groupOrder: 2 }
        }
      },
      {
        extends: true,
        test: {
          name: "acceptance",
          include: acceptanceTests,
          fileParallelism: false,
          sequence: { groupOrder: 3 }
        }
      }
    ]
  }
})
