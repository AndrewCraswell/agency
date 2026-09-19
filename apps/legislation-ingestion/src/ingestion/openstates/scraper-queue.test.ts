import { describe, expect, it } from "vitest"
import { scraperQueueFor } from "./scraper-queue.js"

describe("shared scraper queue routing", () => {
  it("uses the configured common queue when no routing table is supplied", () => {
    expect(scraperQueueFor("nc", { OPENSTATES_SCRAPER_QUEUE: "scraper-dispatch" })).toBe("scraper-dispatch")
  })
  it("isolates candidate jurisdictions without changing other routes", () => {
    const environment = {
      OPENSTATES_SCRAPER_QUEUE_ROUTES: JSON.stringify({
        nc: "scraper-dispatch",
        ak: "scraper-dispatch",
        wa: "scraper-canary"
      })
    }
    expect(scraperQueueFor("wa", environment)).toBe("scraper-canary")
    expect(scraperQueueFor("nc", environment)).toBe("scraper-dispatch")
    expect(scraperQueueFor("ak", environment)).toBe("scraper-dispatch")
  })
  it("never falls back when an explicit table omits the state", () => {
    expect(() =>
      scraperQueueFor("wa", {
        OPENSTATES_SCRAPER_QUEUE: "wrong-build",
        OPENSTATES_SCRAPER_QUEUE_ROUTES: '{"nc":"scraper-dispatch"}'
      })
    ).toThrow(/Missing.*wa/)
  })
  it.each(["", "null", "[]", "{", '{"WA":"valid-queue"}', '{"wa":"bad--queue"}', '{"wa":"ab"}'])(
    "rejects invalid routing before dispatch: %s",
    (value) => {
      expect(() => scraperQueueFor("wa", { OPENSTATES_SCRAPER_QUEUE_ROUTES: value })).toThrow()
    }
  )
})
