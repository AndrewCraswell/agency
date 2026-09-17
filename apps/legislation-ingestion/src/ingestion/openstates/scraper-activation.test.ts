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
    expect(approvedScraperBuildInputsSha256).toBe("a4137c890452eada7353e3cab71f95b8cd506425be2e7b9002e8f63a37a1628d")
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
