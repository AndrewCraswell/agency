import { describe, expect, it } from "vitest"
import {
  approvedScraperBuildInputsSha256,
  legacyAlaskaEventBuildInputsSha256,
  requireApprovedAlaskaEventReceiptBuild,
  requireScraperActivation
} from "./scraper-activation.js"

describe("shared scraper activation", () => {
  it("accepts only an explicitly enabled state", () => {
    expect(() => requireScraperActivation("ak", "nc, ak")).not.toThrow()
    expect(() => requireScraperActivation("nc", "ak")).toThrow("North Carolina")
    expect(() => requireScraperActivation("ak", undefined)).toThrow("Alaska")
  })

  it("pins one reviewed runtime fingerprint across state domains", () => {
    expect(approvedScraperBuildInputsSha256).toBe("6cb046eae6f9572b98b9686c50d9bbbada5e8e7dc64811cbcc7685f32b3ea2e9")
  })

  it("admits only the current runtime and the exact retained Alaska event build for receipt replay", () => {
    expect(requireApprovedAlaskaEventReceiptBuild(approvedScraperBuildInputsSha256)).toBe(
      approvedScraperBuildInputsSha256
    )
    expect(requireApprovedAlaskaEventReceiptBuild(legacyAlaskaEventBuildInputsSha256)).toBe(
      legacyAlaskaEventBuildInputsSha256
    )
    expect(() => requireApprovedAlaskaEventReceiptBuild("0".repeat(64))).toThrow("not approved")
  })
})
