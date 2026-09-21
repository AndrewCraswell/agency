import assert from "node:assert/strict"
import { test } from "vitest"
import {
  deploymentSmokeConfig,
  requestMachineAccessToken,
  sentryCanaryArguments,
  sentryCanaryRedactionValue
} from "./deployment-smoke-config.mjs"

const commit = "a".repeat(40)
const base = {
  LEGISLATION_MCP_SMOKE_BASE_URL: "https://legislation-mcp-staging.up.railway.app",
  LEGISLATION_SMOKE_BILL_ID: "bill:us:119:hr:1",
  LEGISLATION_DEPLOYMENT_COMMIT_SHA: commit,
  LEGISLATION_SENTRY_CANARY_MARKER: "legislation-staging-123-1",
  WORKOS_MCP_SMOKE_CLIENT_ID: "staging-smoke-client",
  WORKOS_MCP_SMOKE_CLIENT_SECRET: "staging-smoke-secret"
}

test("requires an explicit credential-free HTTPS origin and deployment identity", () => {
  assert.throws(
    () => deploymentSmokeConfig({ ...base, LEGISLATION_MCP_SMOKE_BASE_URL: "http://example.test" }),
    /credential-free HTTPS origin/
  )
  assert.throws(() => deploymentSmokeConfig({ ...base, LEGISLATION_DEPLOYMENT_COMMIT_SHA: "main" }), /full Git commit/)
  assert.equal(deploymentSmokeConfig(base).expectedCommitSha, commit)
})

test("requires dedicated WorkOS machine credentials", () => {
  assert.throws(
    () => deploymentSmokeConfig({ ...base, WORKOS_MCP_SMOKE_CLIENT_SECRET: "" }),
    /WORKOS_MCP_SMOKE_CLIENT_SECRET is required/
  )
})

test("obtains a bounded short-lived machine token from the discovered authorization server", async () => {
  const configuration = deploymentSmokeConfig(base)
  let request
  const token = await requestMachineAccessToken(configuration, "https://auth.example.test", async (input, init) => {
    request = { input, init }
    return Response.json({
      access_token: "machine.access-token",
      expires_in: 300,
      token_type: "Bearer"
    })
  })
  assert.equal(token, "machine.access-token")
  assert.equal(String(request.input), "https://auth.example.test/oauth2/token")
  assert.equal(request.init.method, "POST")
  assert.deepEqual(Object.fromEntries(request.init.body), {
    client_id: "staging-smoke-client",
    client_secret: "staging-smoke-secret",
    grant_type: "client_credentials",
    resource: "https://legislation-mcp-staging.up.railway.app/mcp"
  })
})

test("rejects unsafe issuers and invalid machine token responses", async () => {
  const configuration = deploymentSmokeConfig(base)
  await assert.rejects(
    requestMachineAccessToken(configuration, "http://auth.example.test", async () => Response.json({})),
    /credential-free HTTPS/
  )
  await assert.rejects(
    requestMachineAccessToken(configuration, "https://auth.example.test", async () =>
      Response.json({ access_token: "token", expires_in: 300, token_type: "Basic" })
    ),
    /response is invalid/
  )
})

test("fails closed when the controlled canary is not canonical staging", () => {
  assert.throws(
    () =>
      deploymentSmokeConfig({
        ...base,
        LEGISLATION_SENTRY_CANARY: "true",
        LEGISLATION_SENTRY_ENVIRONMENT: "production"
      }),
    /restricted to the canonical staging/
  )
  assert.throws(
    () =>
      deploymentSmokeConfig({
        ...base,
        LEGISLATION_SENTRY_CANARY: "true",
        LEGISLATION_SENTRY_ENVIRONMENT: "staging"
      }),
    /RAILWAY_PROJECT_ID is required/
  )
})

test("builds a bounded canary failure with commit and Railway context", () => {
  const configuration = deploymentSmokeConfig({
    ...base,
    LEGISLATION_SENTRY_CANARY: "true",
    LEGISLATION_SENTRY_ENVIRONMENT: "staging",
    RAILWAY_PROJECT_ID: "project",
    RAILWAY_ENVIRONMENT_ID: "environment",
    LEGISLATION_MCP_SERVICE_ID: "service",
    RAILWAY_DEPLOYMENT_ID: "deployment"
  })
  assert.deepEqual(sentryCanaryArguments(configuration), {
    id: "invalid",
    canaryMarker: "legislation-staging-123-1",
    deploymentCommitSha: commit,
    railway: {
      projectId: "project",
      environmentId: "environment",
      serviceId: "service",
      deploymentId: "deployment"
    },
    authorization: sentryCanaryRedactionValue
  })
})
