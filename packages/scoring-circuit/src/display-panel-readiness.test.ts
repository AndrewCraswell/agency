import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  canonicalHub75HeaderPins,
  displayPanelReadiness,
  displayPanelPrimarySources,
  evaluateSelectedDisplayPanel,
  validateDisplayPanelReadiness,
  type DisplayPanelReadiness
} from "./display-panel-readiness.js"

describe("selected HUB75 display panel", () => {
  it("records the concrete Adafruit 64x32 EVT candidate", () => {
    expect(validateDisplayPanelReadiness(displayPanelReadiness)).toEqual([])
    expect(displayPanelReadiness).toMatchObject({
      dimensionsMm: { height: 158, width: 318 },
      headerPins: ["R1", "G1", "B1", "GND1", "R2", "G2", "B2", "GND2", "A", "B", "C", "D", "CLK", "LAT", "OE", "GND3"],
      model: "64x32 RGB LED Matrix - 5mm pitch",
      resolution: { height: 32, width: 64 },
      scanRatio: "1/16",
      sku: "2277"
    })
    expect(displayPanelReadiness.productionApproved).toBe(false)
    expect(displayPanelReadiness.blockers.length).toBeGreaterThan(0)
  })

  it("binds the exact panel, cable, header, and power-mate source bytes", () => {
    expect(displayPanelPrimarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exactPart: "Adafruit Industries product 2277",
          access: "manufacturer-acquired-hash-bound"
        }),
        expect.objectContaining({
          exactPart: "Adafruit Industries product 4170",
          access: "manufacturer-acquired-hash-bound"
        }),
        expect.objectContaining({
          exactPart: "Adafruit Industries product 4767",
          access: "manufacturer-acquired-hash-bound"
        }),
        expect.objectContaining({ exactPart: "Samtec TST-108-04-G-D-RA", kind: "series-print" }),
        expect.objectContaining({ exactPart: "JST SMR-04V-N, SYM-001T-P0.6, SMP-04V-NC, SHF-001T-0.8BS" })
      ])
    )

    const sourceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/evidence/bp-143")
    for (const source of displayPanelPrimarySources) {
      if (!("acquiredArtifact" in source)) continue
      const fileName = basename(source.acquiredArtifact.evidenceFile)
      const digest = createHash("sha256")
        .update(readFileSync(resolve(sourceDirectory, fileName)))
        .digest("hex")
        .toUpperCase()
      expect(digest, source.acquiredArtifact.evidenceFile).toBe(source.acquiredArtifact.sha256)
    }
  })

  it("fits the provisional continuous and 100 ms screen envelopes", () => {
    const evaluation = evaluateSelectedDisplayPanel(displayPanelReadiness)

    expect(evaluation.loadCheck).toEqual({ continuousPass: true, peakPass: true })
    expect(evaluation.budget.continuous.displayAllocationW).toBeGreaterThan(20)
    expect(evaluation.budget.peak.displayAllocationW).toBeGreaterThan(20)
  })

  it("rejects swapped HUB75 pins and an E line replacing D", () => {
    const swappedHeader = [...canonicalHub75HeaderPins]
    swappedHeader[12] = "LAT"
    swappedHeader[13] = "CLK"
    const eLineHeader = canonicalHub75HeaderPins.map((pin) => (pin === "D" ? "E" : pin))

    expect(validateDisplayPanelReadiness({ ...displayPanelReadiness, headerPins: swappedHeader })).toContain(
      "display panel header must match the canonical 64x32 HUB75 pin order"
    )
    expect(validateDisplayPanelReadiness({ ...displayPanelReadiness, headerPins: eLineHeader })).toContain(
      "display panel header must match the canonical 64x32 HUB75 pin order"
    )
  })

  it("rejects malformed or unsafe panel records", () => {
    const malformed: DisplayPanelReadiness = {
      ...displayPanelReadiness,
      declaredLoad: { continuousW: 21, peakW: 20 },
      evidenceUrls: ["http://example.invalid/panel"],
      headerPins: ["R1"]
    }

    expect(validateDisplayPanelReadiness(malformed)).toEqual(
      expect.arrayContaining([
        "display panel header must match the canonical 64x32 HUB75 pin order",
        "display panel peak load must be greater than or equal to continuous load",
        "display panel continuous load exceeds its published voltage/current envelope",
        "display panel evidence URL must use HTTPS"
      ])
    )
    expect(() => evaluateSelectedDisplayPanel(malformed)).toThrow(RangeError)
  })

  it("rejects unbound or malformed primary source records", () => {
    const malformedSource = structuredClone(displayPanelReadiness) as DisplayPanelReadiness
    malformedSource.primarySources = [
      {
        ...displayPanelPrimarySources[0],
        acquiredArtifact: {
          ...displayPanelPrimarySources[0].acquiredArtifact!,
          evidenceFile: "packages/scoring-circuit/docs/evidence/bp-146/other.pdf" as never,
          sha256: "not-a-hash"
        }
      }
    ]
    expect(validateDisplayPanelReadiness(malformedSource)).toEqual(
      expect.arrayContaining(["hash-bound display panel source requires the BP-143 artifact path and SHA-256"])
    )
    expect(() => evaluateSelectedDisplayPanel(malformedSource)).toThrow(RangeError)

    const vendorWithArtifact = structuredClone(displayPanelReadiness) as DisplayPanelReadiness
    vendorWithArtifact.primarySources = [
      {
        ...displayPanelPrimarySources[displayPanelPrimarySources.length - 1],
        acquiredArtifact: {
          acquiredDate: "2026-08-24",
          evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/not-acquired.html",
          sha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        }
      }
    ]
    expect(validateDisplayPanelReadiness(vendorWithArtifact)).toContain(
      "vendor-listed display panel source must not claim an acquired artifact"
    )
    expect(() => evaluateSelectedDisplayPanel(vendorWithArtifact)).toThrow(RangeError)

    const missingSource = structuredClone(displayPanelReadiness) as DisplayPanelReadiness
    missingSource.primarySources = missingSource.primarySources.slice(1)
    expect(validateDisplayPanelReadiness(missingSource)).toContain(
      "display panel primary sources must match the reviewed ordered source set"
    )

    const mutatedIdentity = structuredClone(displayPanelReadiness) as DisplayPanelReadiness
    mutatedIdentity.primarySources = mutatedIdentity.primarySources.map((source, index) =>
      index === 0 ? { ...source, exactPart: "FORGED" } : source
    )
    expect(validateDisplayPanelReadiness(mutatedIdentity)).toContain(
      "display panel primary sources must match the reviewed ordered source set"
    )
  })

  it("rejects each nonfinite, negative, or over-envelope display load", () => {
    const cases: Array<[DisplayPanelReadiness, string]> = [
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: Number.NaN, peakW: 20 } },
        "display panel continuous load must be finite and non-negative"
      ],
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: 20, peakW: Number.POSITIVE_INFINITY } },
        "display panel peak load must be finite and non-negative"
      ],
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: -1, peakW: 20 } },
        "display panel continuous load must be finite and non-negative"
      ],
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: 0, peakW: -1 } },
        "display panel peak load must be finite and non-negative"
      ],
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: 21, peakW: 21 } },
        "display panel continuous load exceeds its published voltage/current envelope"
      ],
      [
        { ...displayPanelReadiness, declaredLoad: { continuousW: 20, peakW: 21 } },
        "display panel peak load exceeds its published voltage/current envelope"
      ]
    ]

    for (const [panel, expectedError] of cases) {
      expect(validateDisplayPanelReadiness(panel)).toContain(expectedError)
      expect(() => evaluateSelectedDisplayPanel(panel)).toThrow(RangeError)
    }
  })
})
