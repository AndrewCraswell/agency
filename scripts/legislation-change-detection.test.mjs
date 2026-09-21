import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyLegislationChanges } from "./legislation-change-detection.mjs"

const none = { web: false, mcp: false, core: false, database: false, ingestion: false }

test("routes app-only changes to the owning runtime", () => {
  assert.deepEqual(classifyLegislationChanges(["apps/legislation-web/src/app/page.tsx"]), {
    ...none,
    web: true
  })
  assert.deepEqual(classifyLegislationChanges(["apps/legislation-mcp/src/server.ts"]), {
    ...none,
    mcp: true
  })
  assert.deepEqual(classifyLegislationChanges(["apps/legislation-ingestion/src/cli.ts"]), {
    ...none,
    ingestion: true
  })
})

test("routes shared package changes to every consuming runtime", () => {
  assert.deepEqual(classifyLegislationChanges(["packages/legislation-core/src/index.ts"]), {
    web: true,
    mcp: true,
    core: true,
    database: false,
    ingestion: true
  })
  assert.deepEqual(classifyLegislationChanges(["packages/legislation-diffing/src/index.ts"]), {
    ...none,
    web: true
  })
  assert.deepEqual(classifyLegislationChanges(["packages/typescript-config/base.json"]), {
    ...none,
    web: true,
    mcp: true,
    ingestion: true
  })
})

test("identifies canonical database schema changes", () => {
  assert.deepEqual(classifyLegislationChanges(["packages/legislation-core/src/database/migrations/0002_example.sql"]), {
    web: true,
    mcp: true,
    core: true,
    database: true,
    ingestion: true
  })
})

test("routes root dependency changes to every Node runtime", () => {
  for (const path of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    assert.deepEqual(classifyLegislationChanges([path]), {
      ...none,
      web: true,
      mcp: true,
      ingestion: true
    })
  }
})

test("combines targets and ignores unrelated product paths", () => {
  assert.deepEqual(
    classifyLegislationChanges([
      "apps/legislation-mcp/src/server.ts",
      "apps/legislation-web/src/app/page.tsx",
      "packages/fc-theme-base/src/index.ts"
    ]),
    {
      ...none,
      web: true,
      mcp: true
    }
  )
  assert.deepEqual(classifyLegislationChanges(["apps/fencing-club-shopify/app/routes/app.tsx"]), none)
})
