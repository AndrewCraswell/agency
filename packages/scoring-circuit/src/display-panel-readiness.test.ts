import { describe, expect, it } from "vitest"
import {
  canonicalHub75HeaderPins,
  displayPanelReadiness,
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
