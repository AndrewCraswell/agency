import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyLegislationChanges, isLegislationDatabaseChange } from "./legislation-change-detection.mjs"

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

test("identifies canonical database artifacts and migration tooling", () => {
  const databasePaths = [
    "packages/legislation-core/src/database/migrations/0002_example.sql",
    "packages/legislation-core/src/database/migrations/meta/_journal.json",
    "packages/legislation-core/src/database/migrations/meta/0002_snapshot.json",
    "packages/legislation-core/src/database/schema/schema.ts",
    "packages/legislation-core/drizzle.config.ts",
    "packages/legislation-core/src/database/migrate.ts",
    "packages/legislation-core/scripts/database.ts",
    "apps/legislation-web/scripts/migrate.ts"
  ]

  for (const path of databasePaths) {
    assert.equal(isLegislationDatabaseChange(path), true, path)
    assert.equal(classifyLegislationChanges([path]).database, true, path)
  }
})

test("does not classify database tests, runtime access, or lookalike artifacts as migrations", () => {
  const nonDatabasePaths = [
    "packages/legislation-core/src/database/migrations/README.md",
    "packages/legislation-core/src/database/migrations/meta/notes.json",
    "packages/legislation-core/src/database/migrations/meta/manual_snapshot.json",
    "packages/legislation-core/src/database/migrations/manual.sql",
    "packages/legislation-core/src/database/migrations/0002_example.sql.bak",
    "packages/legislation-core/src/database/schema/schema.integration.test.ts",
    "packages/legislation-core/src/database/database.ts",
    "apps/legislation-web/src/modules/legislation/query-service.ts"
  ]

  for (const path of nonDatabasePaths) {
    assert.equal(isLegislationDatabaseChange(path), false, path)
    assert.equal(classifyLegislationChanges([path]).database, false, path)
  }
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
