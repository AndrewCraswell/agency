import { describe, expect, it } from "vitest"
import { createScraperScheduleManifest, parseScheduledScraperJurisdictions } from "./scraper-schedule-manifest.js"

describe("self-hosted scraper schedule manifest", () => {
  it("keeps every schedule inactive unless explicitly activated", () => {
    const manifest = createScraperScheduleManifest({
      active: false,
      enabledJurisdictions: ["ak", "nc"],
      environment: "production"
    })
    expect(manifest).toHaveLength(6)
    expect(manifest.every((entry) => !entry.active)).toBe(true)
  })

  it("activates only schedules belonging to an enabled jurisdiction", () => {
    const manifest = createScraperScheduleManifest({
      active: true,
      enabledJurisdictions: ["ak"],
      environment: "production"
    })
    expect(manifest.filter((entry) => entry.active)).toHaveLength(3)
    expect(manifest.filter((entry) => entry.active).map((entry) => entry.deduplicationKey)).toEqual([
      "production:openstates-scraper:bills:ak",
      "production:openstates-scraper:events:ak",
      "production:openstates-scraper:content:ak"
    ])
  })

  it("rejects duplicate and unsupported activation values", () => {
    expect(parseScheduledScraperJurisdictions("ak,nc")).toEqual(["ak", "nc"])
    expect(() => parseScheduledScraperJurisdictions("ak,ak")).toThrow("duplicate")
    expect(() => parseScheduledScraperJurisdictions("ca")).toThrow("unsupported")
  })
})
