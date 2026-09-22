import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const workflowPath = fileURLToPath(
  new URL("../../../../../.github/workflows/legislation-staging-database-refresh.yml", import.meta.url)
)

describe("protected staging refresh workflow", () => {
  it("is manual, protected, serialized, and requires explicit destructive confirmation", async () => {
    const workflow = await readFile(workflowPath, "utf8")

    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).not.toMatch(/\bschedule:/u)
    expect(workflow).toContain("inputs.confirmation == 'REFRESH STAGING'")
    expect(workflow).toContain("environment: staging")
    expect(workflow).toContain("group: legislation-staging-database-mutation")
    expect(workflow).toContain("cancel-in-progress: false")
  })

  it("uses only protected endpoints and the concrete refresh command", async () => {
    const workflow = await readFile(workflowPath, "utf8")

    for (const name of [
      "LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL",
      "LEGISLATION_STAGING_PRIMARY_DATABASE_URL",
      "LEGISLATION_STAGING_PASSAGE_SEARCH_DATABASE_URL",
      "WORKOS_MCP_SMOKE_CLIENT_ID",
      "WORKOS_MCP_SMOKE_CLIENT_SECRET"
    ]) {
      expect(workflow).toContain(`secrets.${name}`)
    }
    expect(workflow).toContain("pnpm --filter legislation-ingestion refresh:staging \\")
    expect(workflow).not.toContain("pnpm --filter legislation-ingestion refresh:staging --")
    expect(workflow).toContain('--copy-engine "${{ inputs.copy_engine }}"')
    expect(workflow).toContain("--apply")
  })
})
