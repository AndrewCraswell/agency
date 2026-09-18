import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("hosted Open States scraper task contract", () => {
  it("keeps extraction on the isolated queue worker and chains exact frozen batches", async () => {
    const source = await readFile(new URL("./openstates-scraper-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-alaska-events-cloud"')
    expect(source).toContain('id: "openstates-alaska-events-dispatch"')
    expect(source).toContain('id: "openstates-alaska-events-plan"')
    expect(source).toContain('id: "openstates-alaska-events-schedule"')
    expect(source).toContain('id: "openstates-north-carolina-events-cloud"')
    expect(source).toContain('id: "openstates-north-carolina-events-schedule"')
    expect(source).toContain('id: "openstates-alaska-events-reconcile"')
    expect(source).toContain("executeAlaskaEventCloudBatch")
    expect(source).toContain("executeNorthCarolinaEventCloudCycle")
    expect(source).toContain("reconcileAlaskaEventCycleBatch")
    expect(source).toContain("dispatchAlaskaEventReconciliation")
    expect(source).toContain("reconciliationRunId")
    expect(source).toContain("`ak-events:reconcile:${inventoryId}:0`")
    expect(source).toContain("acquireAlaskaEventPlan")
    expect(source).toContain("OPENSTATES_SCRAPER_ENABLED_STATES")
    expect(source).toContain("OPENSTATES_SCRAPER_QUEUE")
    expect(source).toContain("z.literal(approvedScraperBuildInputsSha256)")
    expect(source).toContain("z.literal(legacyAlaskaEventBuildInputsSha256)")
    expect(source).toContain("requireApprovedAlaskaEventReceiptBuild")
    expect(source).not.toContain("OPENSTATES_API_KEY")
    expect(source).not.toContain("openstates.cli.update")
  })
})
