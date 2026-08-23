import { describe, expect, it } from "vitest"
import { usbPdFootprints, validateUsbPdFootprints } from "./usb-pd-footprints.js"

const byMpn = new Map(usbPdFootprints.map((footprint) => [footprint.mpn, footprint]))

describe("USB-C and PD footprint library", () => {
  it("fails closed while retaining only primary-source copper data", () => {
    expect(validateUsbPdFootprints(usbPdFootprints)).toEqual([])
    for (const footprint of usbPdFootprints) {
      expect(footprint.fabricationRelease).toBe("deny")
      expect(footprint.drawing.url).toMatch(/^https:\/\//)
      expect(footprint.missingReleaseEvidence.length).toBeGreaterThan(0)
    }

    expect(byMpn.get("10177070-00011LF")).toMatchObject({
      copperEvidence: "missing-primary-drawing",
      pads: []
    })
  })

  it("encodes the two-ThermalPad TPS25730A package, its pin map, and documented stencil coverage", () => {
    const controller = byMpn.get("TPS25730ADREFR")
    expect(controller?.pads).toHaveLength(38)
    expect(controller?.thermalPads).toMatchObject([
      { id: "39", pasteCoveragePercent: 78, role: "GND thermal pad" },
      { id: "40", pasteCoveragePercent: 80, role: "DRAIN thermal pad" }
    ])
    expect(controller?.pads.find((candidate) => candidate.id === "28")?.role).toBe("CC1")
    expect(controller?.pads.find((candidate) => candidate.id === "29")?.role).toBe("CC2")
    expect(controller?.pads.find((candidate) => candidate.id === "38")?.role).toBe("VIN_3V3")
    expect(controller?.paste.sourceStatus).toBe("manufacturer-example")
  })

  it("keeps the CC protector, surge TVS, and eFuse terminal maps tied to their exact package drawings", () => {
    const protector = byMpn.get("TPD4S201TRGRRQ1")
    expect(protector?.pads).toHaveLength(20)
    expect(protector?.thermalPads).toMatchObject([{ id: "21", role: "GND thermal pad" }])
    expect(protector?.pads.find((candidate) => candidate.id === "4")?.role).toBe("C_CC1")
    expect(protector?.pads.find((candidate) => candidate.id === "12")?.role).toBe("CC1")
    expect(protector?.pads.find((candidate) => candidate.id === "9")?.role).toBe("FLT")
    expect(protector?.pads.find((candidate) => candidate.id === "1")).toMatchObject({
      xMm: -1.35,
      yMm: 1,
      widthMm: 0.6,
      heightMm: 0.24
    })
    expect(protector?.paste).toMatchObject({
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.125,
      coverage: [{ padIds: ["21"], printedAreaPercent: 81 }]
    })

    const tvs = byMpn.get("TVS2200DRVR")
    expect(tvs?.pads.map((candidate) => candidate.role)).toEqual(["GND", "GND", "GND", "IN", "IN", "IN"])
    expect(tvs?.thermalPads).toMatchObject([{ id: "7", role: "GND thermal pad" }])
    expect(tvs?.pads.find((candidate) => candidate.id === "6")).toMatchObject({
      xMm: 0.75,
      yMm: 0.65,
      widthMm: 0.45,
      heightMm: 0.3
    })
    expect(tvs?.paste).toMatchObject({
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.125,
      coverage: [{ padIds: ["7"], printedAreaPercent: 88 }]
    })

    const efuse = byMpn.get("TPS259474ARPWR")
    expect(efuse?.pads.find((candidate) => candidate.id === "5")?.role).toBe("IN")
    expect(efuse?.pads.find((candidate) => candidate.id === "6")?.role).toBe("OUT")
    expect(efuse?.pads.find((candidate) => candidate.id === "9")?.role).toBe("ILM")
    expect(efuse?.pads.find((candidate) => candidate.id === "5")).toMatchObject({
      xMm: -0.275,
      yMm: -0.325,
      widthMm: 0.3,
      heightMm: 1.75
    })
    expect(efuse?.paste).toMatchObject({
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.1,
      coverage: [
        { padIds: ["1", "4", "7", "10"], printedAreaPercent: 93 },
        { padIds: ["5", "6"], printedAreaPercent: 82 }
      ]
    })
  })

  it("preserves manufacturer polarity and land dimensions for the high-current diode and polymer capacitors", () => {
    expect(byMpn.get("B340A-13-F")?.pads).toMatchObject([
      { id: "A", role: "anode", widthMm: 2.5, heightMm: 1.7 },
      { id: "K", role: "cathode", widthMm: 2.5, heightMm: 1.7 }
    ])
    expect(byMpn.get("T523H107M035APE070")).toMatchObject({
      courtyard: { sourceStatus: "manufacturer-verified", widthMm: 9.12, heightMm: 6.8 },
      pads: [
        { id: "+", role: "anode", widthMm: 2.37, heightMm: 4.13 },
        { id: "-", role: "cathode", widthMm: 2.37, heightMm: 4.13 }
      ]
    })
    expect(byMpn.get("T55A106M010C0200")?.pads).toMatchObject([
      { id: "+", role: "anode", widthMm: 1.35, heightMm: 1.35 },
      { id: "-", role: "cathode", widthMm: 1.35, heightMm: 1.35 }
    ])
  })

  it("rejects duplicate pads, non-positive geometry, and unearned connector geometry", () => {
    const controller = byMpn.get("TPS25730ADREFR")
    const connector = byMpn.get("10177070-00011LF")
    const firstControllerPad = controller?.pads.at(0)
    if (controller === undefined || connector === undefined || firstControllerPad === undefined) {
      throw new Error("test fixtures are incomplete")
    }

    expect(
      validateUsbPdFootprints([
        { ...controller, pads: [...controller.pads, firstControllerPad] },
        { ...connector, pads: [firstControllerPad] }
      ])
    ).toEqual(
      expect.arrayContaining([
        "TPS25730ADREFR: duplicated pad 1",
        "10177070-00011LF: unavailable primary drawing must not generate pads"
      ])
    )
  })

  it("rejects malformed coordinates, courtyard, paste, and drawing metadata", () => {
    const controller = byMpn.get("TPS25730ADREFR")
    const capacitor = byMpn.get("T523H107M035APE070")
    if (controller === undefined || capacitor === undefined) throw new Error("test fixtures are incomplete")
    const firstControllerPad = controller.pads.at(0)
    if (firstControllerPad === undefined) throw new Error("controller requires pads")

    expect(
      validateUsbPdFootprints([
        {
          ...controller,
          drawing: { ...controller.drawing, document: "", pages: [0, 63, 63], revision: "" },
          pads: [{ ...firstControllerPad, xMm: Number.NaN, yMm: Number.POSITIVE_INFINITY }],
          paste: {
            ...controller.paste,
            coverage: [{ padIds: ["unknown"], printedAreaPercent: 101 }],
            stencilThicknessMm: 0
          },
          thermalPads: []
        },
        { ...capacitor, courtyard: { ...capacitor.courtyard, widthMm: Number.NaN } }
      ])
    ).toEqual(
      expect.arrayContaining([
        "TPS25730ADREFR: drawing document is required",
        "TPS25730ADREFR: drawing revision is required",
        "TPS25730ADREFR: drawing pages must be positive integers",
        "TPS25730ADREFR: drawing page 63 is duplicated",
        "TPS25730ADREFR: pad 1 x must be finite",
        "TPS25730ADREFR: pad 1 y must be finite",
        "TPS25730ADREFR: manufacturer paste example requires a positive stencil thickness",
        "TPS25730ADREFR: paste coverage must be in (0, 100]",
        "TPS25730ADREFR: paste coverage references unknown pad unknown",
        "T523H107M035APE070: courtyard width must be finite and positive"
      ])
    )
  })
})
