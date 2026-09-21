import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const workflowUrl = new URL("../../../.github/workflows/legislation-staging-deployment.yml", import.meta.url)

test("deploys and verifies W before deploying M", async () => {
  const workflow = await readFile(workflowUrl, "utf8")
  const webDeploy = workflow.indexOf("- name: Deploy staging legislation-web")
  const webVerify = workflow.indexOf("- name: Verify staging legislation-web in a browser")
  const mcpDeploy = workflow.indexOf("- name: Deploy staging legislation-mcp")
  const mcpVerify = workflow.indexOf("- name: Verify staging legislation-mcp\n")
  assert.ok(webDeploy >= 0)
  assert.ok(webDeploy < webVerify)
  assert.ok(webVerify < mcpDeploy)
  assert.ok(mcpDeploy < mcpVerify)
})

test("keeps MCP staging acceptance fail closed and enables the controlled canary", async () => {
  const workflow = await readFile(workflowUrl, "utf8")
  assert.doesNotMatch(workflow, /LEGISLATION_STAGING_MCP_ENABLED/)
  assert.doesNotMatch(workflow, /LEGISLATION_MCP_SMOKE_TOKEN/)
  assert.match(workflow, /WORKOS_MCP_SMOKE_CLIENT_ID: \$\{\{ secrets\.WORKOS_MCP_SMOKE_CLIENT_ID \}\}/)
  assert.match(workflow, /WORKOS_MCP_SMOKE_CLIENT_SECRET: \$\{\{ secrets\.WORKOS_MCP_SMOKE_CLIENT_SECRET \}\}/)
  assert.match(workflow, /LEGISLATION_SENTRY_CANARY: "true"/)
  assert.match(workflow, /RAILWAY_DEPLOYMENT_ID: \$\{\{ steps\.mcp-deployment\.outputs\.deployment_id \}\}/)
  assert.match(workflow, /node apps\/legislation-web\/scripts\/wait-readiness\.mjs/)
  assert.match(workflow, /verify-staging-variables\.mjs mcp/)
  assert.match(workflow, /pnpm --filter legislation-mcp verify:sentry-canary/)
  assert.match(workflow, /SENTRY_STAGING_AUTH_TOKEN: \$\{\{ secrets\.SENTRY_STAGING_AUTH_TOKEN \}\}/)
  const prerequisiteCheck = workflow.indexOf("- name: Verify staging deployment credentials")
  const firstDeploy = workflow.indexOf("- name: Deploy staging legislation-web")
  assert.ok(prerequisiteCheck >= 0)
  assert.ok(prerequisiteCheck < firstDeploy)
})

test("mints API smoke access without a static bearer", async () => {
  const workflow = await readFile(workflowUrl, "utf8")
  assert.doesNotMatch(workflow, /LEGISLATION_API_SMOKE_TOKEN/)
  assert.match(workflow, /WORKOS_API_SMOKE_CLIENT_ID: \$\{\{ secrets\.WORKOS_API_SMOKE_CLIENT_ID \}\}/)
  assert.match(workflow, /WORKOS_API_SMOKE_CLIENT_SECRET: \$\{\{ secrets\.WORKOS_API_SMOKE_CLIENT_SECRET \}\}/)
  assert.match(workflow, /WORKOS_API_SMOKE_ISSUER: \$\{\{ vars\.WORKOS_API_SMOKE_ISSUER \}\}/)
})
