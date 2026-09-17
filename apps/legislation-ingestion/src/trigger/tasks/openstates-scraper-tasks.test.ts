import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("hosted Open States scraper task contract", () => {
  it("keeps extraction on the isolated queue worker and chains exact frozen batches", async () => {
    const source = await readFile(new URL("./openstates-scraper-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-alaska-events-cloud"')
    expect(source).toContain('id: "openstates-alaska-events-dispatch"')
    expect(source).toContain("executeAlaskaEventCloudBatch")
    expect(source).toContain("OPENSTATES_SCRAPER_ENABLED_STATES")
    expect(source).toContain("OPENSTATES_SCRAPER_QUEUE")
    expect(source).not.toContain("OPENSTATES_API_KEY")
    expect(source).not.toContain("openstates.cli.update")
  })
})
