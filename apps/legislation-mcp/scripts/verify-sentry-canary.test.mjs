import assert from "node:assert/strict"
import { test } from "vitest"
import { sentryVerificationConfig, verifySentryCanary } from "./verify-sentry-canary.mjs"

const environment = {
  LEGISLATION_SENTRY_CANARY_MARKER: "legislation-staging-123-2",
  SENTRY_MCP_PROJECT_SLUG: "legislation-mcp",
  SENTRY_ORGANIZATION_SLUG: "agency",
  SENTRY_STAGING_AUTH_TOKEN: "read-only-token"
}

test("requires a bounded marker, slugs and read token", () => {
  assert.equal(sentryVerificationConfig(environment).apiBase.href, "https://sentry.io/")
  assert.throws(
    () => sentryVerificationConfig({ ...environment, LEGISLATION_SENTRY_CANARY_MARKER: "customer@example.test" }),
    /MARKER is invalid/
  )
  assert.throws(
    () => sentryVerificationConfig({ ...environment, SENTRY_STAGING_AUTH_TOKEN: "" }),
    /SENTRY_STAGING_AUTH_TOKEN is required/
  )
})

test("polls recent project events and matches the exact canary tag client-side", async () => {
  const configuration = sentryVerificationConfig(environment)
  const requests = []
  await verifySentryCanary(configuration, {
    fetch: async (input, init) => {
      requests.push({ input: String(input), init })
      return Response.json(
        requests.length === 1
          ? [{ id: "other", tags: [{ key: "canary", value: "legislation-staging-123-20" }] }]
          : [{ id: "event", tags: [{ key: "canary", value: "legislation-staging-123-2" }] }]
      )
    },
    attempts: 2,
    delayMs: 0,
    delay: (callback) => callback()
  })
  assert.equal(requests.length, 2)
  const endpoint = new URL(requests[0].input)
  assert.equal(endpoint.pathname, "/api/0/projects/agency/legislation-mcp/events/")
  assert.equal(endpoint.searchParams.get("query"), null)
  assert.equal(endpoint.searchParams.get("full"), "true")
  assert.equal(endpoint.searchParams.get("per_page"), "100")
  assert.equal(requests[0].init.headers.authorization, "Bearer read-only-token")
})

test("fails closed for API errors and missing canaries", async () => {
  const configuration = sentryVerificationConfig(environment)
  await assert.rejects(
    verifySentryCanary(configuration, {
      fetch: async () => new Response("", { status: 403 }),
      attempts: 1
    }),
    /status 403/
  )
  await assert.rejects(
    verifySentryCanary(configuration, {
      fetch: async () => Response.json([]),
      attempts: 1
    }),
    /did not ingest/
  )
})
