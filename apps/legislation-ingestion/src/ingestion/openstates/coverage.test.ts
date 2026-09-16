import { describe, expect, it } from "vitest"
import { createOpenStatesCoverageManifest } from "./coverage.js"

describe("Open States coverage policy", () => {
  it("keeps supported sessions in range and identifies missing jurisdictions", () => {
    const report = createOpenStatesCoverageManifest(
      [
        { jurisdictionCode: "wa", session: "2025-2026", url: new URL("https://example.test/wa-2025.zip") },
        { jurisdictionCode: "wa", session: "2015-2016", url: new URL("https://example.test/wa-2015.zip") },
        { jurisdictionCode: "vi", session: "2025", url: new URL("https://example.test/vi-2025.zip") }
      ],
      2017
    )

    expect(report.archives).toEqual([
      { jurisdictionCode: "wa", session: "2025-2026", url: "https://example.test/wa-2025.zip" }
    ])
    expect(report.excludedArchives).toBe(2)
    expect(report.missingJurisdictions).toContain("pr")
    expect(report.missingJurisdictions).not.toContain("wa")
  })
})
