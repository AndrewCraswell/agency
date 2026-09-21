import assert from "node:assert/strict"
import { test } from "vitest"
import { apiSmokeConfig, requestApiMachineAccessToken } from "./api-smoke-config.mjs"

const environment = {
  LEGISLATION_API_SMOKE_BASE_URL: "https://legislation-web-staging.up.railway.app",
  LEGISLATION_DEPLOYMENT_COMMIT_SHA: "a".repeat(40),
  WORKOS_API_SMOKE_CLIENT_ID: "staging-api-smoke",
  WORKOS_API_SMOKE_CLIENT_SECRET: "staging-api-secret",
  WORKOS_API_SMOKE_ISSUER: "https://auth.example.test"
}

test("requires a safe origin, issuer, commit and machine credentials", () => {
  assert.equal(apiSmokeConfig(environment).expectedCommitSha, "a".repeat(40))
  assert.throws(
    () => apiSmokeConfig({ ...environment, LEGISLATION_API_SMOKE_BASE_URL: "http://example.test" }),
    /credential-free HTTPS origin/
  )
  assert.throws(() => apiSmokeConfig({ ...environment, WORKOS_API_SMOKE_ISSUER: "" }), /WORKOS_API_SMOKE_ISSUER/)
  assert.throws(
    () => apiSmokeConfig({ ...environment, WORKOS_API_SMOKE_CLIENT_SECRET: "" }),
    /WORKOS_API_SMOKE_CLIENT_SECRET/
  )
})

test("mints a bounded short-lived API token with client credentials", async () => {
  const configuration = apiSmokeConfig(environment)
  let request
  const token = await requestApiMachineAccessToken(configuration, async (input, init) => {
    request = { input, init }
    return Response.json({ access_token: "api.machine-token", expires_in: 300, token_type: "Bearer" })
  })
  assert.equal(token, "api.machine-token")
  assert.equal(String(request.input), "https://auth.example.test/oauth2/token")
  assert.deepEqual(Object.fromEntries(request.init.body), {
    client_id: "staging-api-smoke",
    client_secret: "staging-api-secret",
    grant_type: "client_credentials"
  })
})

test("rejects unsuccessful or invalid token responses", async () => {
  const configuration = apiSmokeConfig(environment)
  await assert.rejects(
    requestApiMachineAccessToken(configuration, async () => new Response("", { status: 401 })),
    /request failed/
  )
  await assert.rejects(
    requestApiMachineAccessToken(configuration, async () =>
      Response.json({ access_token: "token", expires_in: 300, token_type: "Basic" })
    ),
    /response is invalid/
  )
})
