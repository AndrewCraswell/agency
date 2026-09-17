import { describe, expect, it } from "vitest"
import { approvedScraperBuildInputsSha256, requireScraperActivation } from "./scraper-activation.js"

describe("shared scraper activation", () => {
  it("accepts only an explicitly enabled state", () => {
    expect(() => requireScraperActivation("ak", "nc, ak")).not.toThrow()
    expect(() => requireScraperActivation("nc", "ak")).toThrow("North Carolina")
    expect(() => requireScraperActivation("ak", undefined)).toThrow("Alaska")
  })

  it("pins one reviewed runtime fingerprint across state domains", () => {
    expect(approvedScraperBuildInputsSha256).toMatch(/^[a-f0-9]{64}$/)
  })
})
