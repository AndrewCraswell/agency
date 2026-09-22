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
    expect(workflow).toContain("CAPACITY_REVIEWED: ${{ inputs.capacity_reviewed }}")
    expect(workflow).toContain('if [ "$CAPACITY_REVIEWED" != "true" ]')
  })

  it("uses only protected endpoints and the concrete refresh command", async () => {
    const workflow = await readFile(workflowPath, "utf8")

    for (const name of [
      "LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL",
      "LEGISLATION_STAGING_PRIMARY_DATABASE_URL",
      "LEGISLATION_STAGING_PASSAGE_SEARCH_DATABASE_URL",
      "RAILWAY_API_TOKEN",
      "RAILWAY_TOKEN",
      "WORKOS_MCP_SMOKE_CLIENT_ID",
      "WORKOS_MCP_SMOKE_CLIENT_SECRET"
    ]) {
      expect(workflow).toContain(`secrets.${name}`)
    }
    expect(workflow).toContain("pnpm --filter legislation-ingestion refresh:staging \\")
    expect(workflow).not.toContain("pnpm --filter legislation-ingestion refresh:staging --")
    expect(workflow).toContain("RAILWAY_API_TOKEN: ${{ secrets.RAILWAY_API_TOKEN }}")
    expect(workflow).toContain("RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}")
    expect(workflow).toContain("postgresql-client-18")
    expect(workflow).toContain('echo "/usr/lib/postgresql/18/bin" >> "$GITHUB_PATH"')
    expect(workflow).not.toContain("--copy-engine")
    expect(workflow).toContain("--apply")
  })
})
