import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import * as Sentry from "@sentry/node"
import { afterEach, expect, it } from "vitest"
import { createMcpTelemetry, mcpSentryOptions } from "./telemetry.js"

afterEach(async () => {
  await Sentry.close(1000)
})

it("uses Railway's exact deployed commit as the Sentry release", () => {
  expect(
    mcpSentryOptions({
      RAILWAY_GIT_COMMIT_SHA: "A".repeat(40),
      SENTRY_RELEASE: "manual-release"
    }).release
  ).toBe("a".repeat(40))
})

it("exports MCP errors with correlation and cause metadata but no credentials or source bodies", async () => {
  const envelopes: string[] = []
  Sentry.init({
    ...mcpSentryOptions({ SENTRY_DSN: "https://public@example.org/1", NODE_ENV: "test" }),
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope) => {
        envelopes.push(JSON.stringify(envelope))
        return { statusCode: 200 }
      },
      flush: async () => true
    })
  })
  const telemetry = createMcpTelemetry()
  await runWithRequestContext({ correlationId: "mcp-acceptance" }, async () => {
    telemetry.reportFailure?.(
      "mcp.search_bills",
      {
        stage: "execution",
        durationMs: 15000,
        query: "HR 1",
        recordId: "bill:us:116:hr:1",
        canaryMarker: "legislation-staging-123-1",
        deploymentCommitSha: "a".repeat(40),
        railway: {
          projectId: "project-context",
          environmentId: "environment-context",
          serviceId: "service-context",
          deploymentId: "deployment-context"
        },
        authorization: "Bearer private",
        body: "private-source"
      },
      Object.assign(new Error("Database deadline exceeded"), { code: "57014" })
    )
  })
  await Sentry.flush(2000)
  const output = envelopes.join("\n")
  expect(output).toContain("mcp-acceptance")
  expect(output).toContain("57014")
  expect(output).toContain("search_bills")
  expect(output).toContain("15000")
  expect(output).toContain("a".repeat(40))
  expect(output).toContain("project-context")
  expect(output).toContain("environment-context")
  expect(output).toContain("service-context")
  expect(output).toContain("deployment-context")
  expect(output).toContain("legislation-staging-123-1")
  expect(output).toContain('"canary":"legislation-staging-123-1"')
  expect(output).toContain("stacktrace")
  expect(output).not.toContain("private")
})
