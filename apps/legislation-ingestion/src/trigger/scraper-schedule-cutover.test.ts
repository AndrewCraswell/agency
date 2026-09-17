import { describe, expect, it } from "vitest"
import type { RemoteSynchronizationSchedule } from "./reconciliation.js"
import { isLegacyAlaskaOrNorthCarolinaApiSchedule, isManagedScraperSchedule } from "./scraper-schedule-cutover.js"

function schedule(overrides: Partial<RemoteSynchronizationSchedule>): RemoteSynchronizationSchedule {
  return {
    active: true,
    cron: "0 * * * *",
    deduplicationKey: null,
    externalId: null,
    id: "schedule-1",
    taskIdentifier: "task",
    timezone: "UTC",
    ...overrides
  }
}

describe("Open States schedule cutover selection", () => {
  it("selects only the six Alaska and North Carolina API pollers", () => {
    expect(isLegacyAlaskaOrNorthCarolinaApiSchedule(schedule({ externalId: "openstates:bills:ak" }))).toBe(true)
    expect(
      isLegacyAlaskaOrNorthCarolinaApiSchedule(schedule({ deduplicationKey: "production:openstates:events:nc" }))
    ).toBe(true)
    expect(isLegacyAlaskaOrNorthCarolinaApiSchedule(schedule({ externalId: "openstates:bills:ca" }))).toBe(false)
    expect(isLegacyAlaskaOrNorthCarolinaApiSchedule(schedule({ externalId: "congress:bills:current" }))).toBe(false)
  })

  it("does not confuse self-hosted scraper schedules with API pollers", () => {
    const scraper = schedule({
      externalId: "openstates-scraper:bills:ak:34",
      deduplicationKey: "production:openstates-scraper:bills:ak"
    })
    expect(isManagedScraperSchedule(scraper, "production")).toBe(true)
    expect(isLegacyAlaskaOrNorthCarolinaApiSchedule(scraper)).toBe(false)
  })
})
