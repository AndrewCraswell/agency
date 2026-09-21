import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const deploymentUrl = new URL("../.github/workflows/legislation-production-deployment.yml", import.meta.url)
const rollbackUrl = new URL("../.github/workflows/legislation-production-rollback.yml", import.meta.url)
const recoveryUrl = new URL("../.github/workflows/legislation-production-database-recovery.yml", import.meta.url)

test("gates production after exact staging acceptance and deploys W before M", async () => {
  const workflow = await readFile(deploymentUrl, "utf8")
  const evidence = workflow.indexOf("- name: Verify exact staging acceptance")
  const approval = workflow.indexOf("name: Approve and deploy production")
  const backup = workflow.indexOf("- name: Back up the production primary")
  const migration = workflow.indexOf("- name: Migrate the production primary")
  const web = workflow.indexOf("- name: Deploy production legislation-web")
  const webBrowser = workflow.indexOf("- name: Verify production legislation-web in a browser")
  const mcp = workflow.indexOf("- name: Deploy production legislation-mcp")
  assert.ok(evidence >= 0)
  assert.ok(evidence < approval)
  assert.ok(approval < backup)
  assert.ok(backup < migration)
  assert.ok(migration < web)
  assert.ok(web < webBrowser)
  assert.ok(webBrowser < mcp)
  assert.match(workflow, /environment:\s+name: production/u)
  assert.match(workflow, /cancel-in-progress: false/u)
  assert.match(workflow, /LEGISLATION_PRODUCTION_MIGRATION_DATABASE_URL/u)
  assert.doesNotMatch(workflow, /db:down/u)
})

test("requires explicit approval and forward migration after a production database restore", async () => {
  const workflow = await readFile(recoveryUrl, "utf8")
  assert.match(workflow, /inputs\.confirmation == 'RESTORE PRODUCTION DATABASE'/u)
  assert.match(workflow, /environment:\s+name: production/u)
  assert.match(workflow, /environmentStagedChanges/u)
  assert.match(workflow, /volumeInstanceBackupRestore/u)
  assert.match(workflow, /environmentPatchCommitStaged/u)
  assert.match(workflow, /Reapply canonical forward migrations/u)
  assert.doesNotMatch(workflow, /db:down/u)
  assert.ok(
    workflow.indexOf("Deploy and verify recovered production legislation-web") <
      workflow.indexOf("Deploy and verify recovered production legislation-mcp")
  )
})

test("keeps rollback manual, approved, exact-commit, and free of down migrations", async () => {
  const workflow = await readFile(rollbackUrl, "utf8")
  assert.match(workflow, /workflow_dispatch:/u)
  assert.match(workflow, /inputs\.confirmation == 'ROLLBACK PRODUCTION'/u)
  assert.match(workflow, /environment:\s+name: production/u)
  assert.match(workflow, /production-rollback-check\.mjs/u)
  assert.match(workflow, /serviceInstanceDeployV2/u)
  assert.doesNotMatch(workflow, /db:down/u)
  assert.ok(
    workflow.indexOf("- name: Roll back production legislation-web") <
      workflow.indexOf("- name: Roll back production legislation-mcp")
  )
})
