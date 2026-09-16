import { fileURLToPath } from "node:url"
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin"
import { configDefaults, defineConfig } from "vitest/config"

const webTests = [
  "src/app/**/*.test.{ts,tsx}",
  "src/components/**/*.test.{ts,tsx}",
  "src/modules/{conversations,evaluations}/**/*.test.{ts,tsx}",
  "src/proxy.test.ts"
]
const databaseTests = [
  "**/*.integration.test.{ts,tsx,mjs}",
  "tests/database/**/*.test.{ts,tsx,mjs}",
  "src/modules/request-handling/api/subscription-repository.test.ts",
  "src/modules/request-handling/api/webhook-read-repository.test.ts"
]
const acceptanceTests = ["scripts/next-router-acceptance.test.ts", "tests/acceptance/**/*.test.{ts,tsx,mjs}"]
const nodeTests = ["scripts/webhook-verification-receiver/**/*.test.mjs"]

export default defineConfig({
  test: {
    coverage: { reportsDirectory: process.env.LEGISLATION_COVERAGE_DIRECTORY ?? "coverage" },
    maxWorkers: process.env.VITEST_MAX_WORKERS ?? 4,
    projects: [
      {
        extends: true,
        plugins: [vanillaExtractPlugin()],
        resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "web",
          include: webTests,
          exclude: [...configDefaults.exclude, ...databaseTests, ...acceptanceTests],
          sequence: { groupOrder: 0 }
        }
      },
      {
        extends: true,
        test: {
          name: "backend",
          include: ["**/*.test.{ts,tsx,mjs}"],
          exclude: [...configDefaults.exclude, ...webTests, ...databaseTests, ...acceptanceTests, ...nodeTests],
          sequence: { groupOrder: 0 }
        }
      },
      {
        extends: true,
        test: {
          name: "database",
          include: databaseTests,
          exclude: [...configDefaults.exclude, ...acceptanceTests],
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
