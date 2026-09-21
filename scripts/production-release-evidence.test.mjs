import assert from "node:assert/strict"
import { test } from "node:test"
import { findStagingAcceptance, productionReleaseConfig } from "./production-release-evidence.mjs"

const environment = {
  DEPLOY_MCP: "true",
  DEPLOY_WEB: "true",
  GITHUB_REPOSITORY: "AndrewCraswell/agency",
  GITHUB_TOKEN: "token",
  MIGRATE_DATABASE: "false",
  PRODUCTION_COMMIT_SHA: "a".repeat(40)
}

test("validates a bounded production release selection", () => {
  assert.equal(productionReleaseConfig(environment).commitSha, "a".repeat(40))
  assert.throws(
    () =>
      productionReleaseConfig({
        ...environment,
        DEPLOY_MCP: "false",
        DEPLOY_WEB: "false",
        MIGRATE_DATABASE: "false"
      }),
    /At least one/
  )
  assert.throws(() => productionReleaseConfig({ ...environment, PRODUCTION_COMMIT_SHA: "main" }), /full Git commit/)
})

test("requires one staging run to cover every selected service", async () => {
  const configuration = productionReleaseConfig(environment)
  const responses = [
    {
      workflow_runs: [
        { id: 1, html_url: "https://github.test/run/1" },
        { id: 2, html_url: "https://github.test/run/2" }
      ]
    },
    {
      jobs: [
        {
          steps: [
            { name: "Deploy staging legislation-web", conclusion: "success" },
            { name: "Verify staging legislation-web in a browser", conclusion: "success" }
          ]
        }
      ]
    },
    {
      jobs: [
        {
          steps: [
            { name: "Deploy staging legislation-web", conclusion: "success" },
            { name: "Verify staging legislation-web in a browser", conclusion: "success" },
            { name: "Deploy staging legislation-mcp", conclusion: "success" },
            { name: "Verify staging legislation-mcp", conclusion: "success" },
            { name: "Verify controlled staging Sentry canary", conclusion: "success" }
          ]
        }
      ]
    }
  ]
  const requests = []
  const result = await findStagingAcceptance(configuration, async (input) => {
    requests.push(String(input))
    return Response.json(responses.shift())
  })
  assert.equal(result.runId, 2)
  assert.equal(requests.length, 3)
  assert.match(requests[0], new RegExp(`head_sha=${"a".repeat(40)}`))
})

test("fails closed without exact staging evidence", async () => {
  await assert.rejects(
    findStagingAcceptance(productionReleaseConfig(environment), async () => Response.json({ workflow_runs: [] })),
    /No successful staging acceptance/
  )
})
