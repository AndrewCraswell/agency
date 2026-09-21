import assert from "node:assert/strict"
import { test } from "vitest"
import { verifyStagingVariables } from "./verify-staging-variables.mjs"

test("requires isolated staging telemetry configuration", () => {
  assert.doesNotThrow(() =>
    verifyStagingVariables("web", {
      NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.test/1"
    })
  )
  assert.throws(
    () =>
      verifyStagingVariables("mcp", {
        SENTRY_ENVIRONMENT: "production",
        SENTRY_DSN: "https://public@example.test/1",
        MCP_API_BASE_URL: "https://legislation-web-staging.up.railway.app"
      }),
    /staging Sentry/
  )
})

test("requires staging M to route to staging W", () => {
  assert.doesNotThrow(() =>
    verifyStagingVariables("mcp", {
      SENTRY_ENVIRONMENT: "staging",
      SENTRY_DSN: "https://public@example.test/1",
      MCP_API_BASE_URL: "https://legislation-web-staging.up.railway.app"
    })
  )
  assert.throws(
    () =>
      verifyStagingVariables("mcp", {
        SENTRY_ENVIRONMENT: "staging",
        SENTRY_DSN: "https://public@example.test/1",
        MCP_API_BASE_URL: "https://legislation-web-production.up.railway.app"
      }),
    /route exclusively/
  )
})
