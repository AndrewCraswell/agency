import { describe, expect, it } from "vitest"
import {
  communicationsFootprintEvidence,
  findCommunicationsFootprintEvidence,
  validateCommunicationsFootprintEvidence
} from "./communications-footprint-evidence.js"

describe("communications-module footprint evidence", () => {
  it("keeps the exact three-part audit unique and fabrication-denied", () => {
    expect(validateCommunicationsFootprintEvidence(communicationsFootprintEvidence)).toEqual([])
    expect(communicationsFootprintEvidence).toHaveLength(3)
    expect(new Set(communicationsFootprintEvidence.map((record) => record.mpn)).size).toBe(3)
    for (const record of communicationsFootprintEvidence) {
      expect(record.releaseState).toBe("deny")
      expect(record.primarySources.length).toBeGreaterThan(0)
      expect(record.missingReleaseEvidence.length).toBeGreaterThan(0)
    }
  })

  it("retains the complete manufacturer KiCad hole model for the Würth MagJack as review-only data", () => {
    const record = findCommunicationsFootprintEvidence("7499011121A")
    expect(record).toMatchObject({
      geometry: {
        copper: "manufacturer-eda-source",
        courtyard: "manufacturer-eda-source",
        paste: "not-applicable-through-hole"
      },
      releaseState: "deny"
    })
    expect(record?.exactPads).toHaveLength(16)
    expect(record?.exactPads.filter((pad) => pad.kind === "plated-hole")).toHaveLength(14)
    expect(record?.exactPads.filter((pad) => pad.kind === "non-plated-hole")).toHaveLength(2)
    expect(record?.exactPads.find((pad) => pad.id === "1")).toMatchObject({
      drillMm: 0.9,
      heightMm: 1.408,
      shape: "rect",
      widthMm: 1.408,
      xMm: 0,
      yMm: 0
    })
    expect(record?.exactPads.find((pad) => pad.id === "NPTH1")).toMatchObject({
      drillMm: 3.25,
      heightMm: 3.25,
      kind: "non-plated-hole",
      shape: "circle",
      widthMm: 3.25
    })
    expect(record?.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "eda-library", revision: expect.stringContaining("rev26b") }),
        expect.objectContaining({ kind: "step-model", revision: expect.stringContaining("rev1") })
      ])
    )
  })

  it("does not invent W5500 or Amphenol USB-C geometry when source release data is incomplete", () => {
    expect(findCommunicationsFootprintEvidence("W5500")).toMatchObject({
      exactPads: [],
      geometry: {
        copper: "manufacturer-eda-source",
        courtyard: "not-published",
        paste: "not-published"
      }
    })
    expect(findCommunicationsFootprintEvidence("10177070-00011LF")).toMatchObject({
      exactPads: [],
      geometry: {
        copper: "manufacturer-listed-not-acquired",
        orientation: "not-acquired",
        pinMapping: "not-acquired"
      },
      primarySources: expect.arrayContaining([
        expect.objectContaining({ access: "access-blocked", kind: "product-drawing" })
      ])
    })
  })

  it("rejects duplicate, missing, or malformed source and geometry evidence", () => {
    const wurth = findCommunicationsFootprintEvidence("7499011121A")
    if (wurth === undefined) throw new Error("Würth fixture is missing")
    const pad = wurth.exactPads[0]
    if (pad === undefined) throw new Error("Würth pad fixture is missing")

    expect(
      validateCommunicationsFootprintEvidence([
        { ...wurth, exactPads: [...wurth.exactPads, pad] },
        {
          ...wurth,
          mpn: "W5500",
          exactPads: [],
          primarySources: [{ ...wurth.primarySources[0], url: "http://invalid.example", revision: "" }]
        },
        {
          ...wurth,
          mpn: "10177070-00011LF",
          exactPads: [],
          primarySources: []
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        "7499011121A: duplicate pad 1",
        "W5500: source URL must use HTTPS",
        "W5500: source revision is required",
        "10177070-00011LF: primary sources are required"
      ])
    )
  })

  it("rejects unverified acquisition and empty manufacturer hole patterns", () => {
    const wurth = findCommunicationsFootprintEvidence("7499011121A")
    if (wurth === undefined) throw new Error("Würth fixture is missing")
    const source = wurth.primarySources.find((candidate) => candidate.kind === "eda-library")
    if (source === undefined) throw new Error("Würth source fixture is missing")

    expect(
      validateCommunicationsFootprintEvidence([
        {
          ...wurth,
          exactPads: [],
          geometry: { ...wurth.geometry, copper: "manufacturer-hole-pattern" },
          primarySources: [{ ...source, sha256: undefined }]
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        "7499011121A: acquired source requires SHA-256",
        "7499011121A: manufacturer hole pattern requires exact pads"
      ])
    )
  })

  it("rejects unsupported pad shapes and non-circular circle dimensions", () => {
    const wurth = findCommunicationsFootprintEvidence("7499011121A")
    if (wurth === undefined) throw new Error("Würth fixture is missing")
    const pad = wurth.exactPads[0]
    if (pad === undefined) throw new Error("Würth pad fixture is missing")
    const malformed = {
      ...wurth,
      exactPads: [
        { ...pad, id: "TRIANGLE", shape: "triangle" },
        { ...pad, heightMm: 1.4, id: "UNEQUAL_CIRCLE", shape: "circle", widthMm: 1.5 }
      ]
    }

    // @ts-expect-error Deliberately pass an unsupported shape to exercise runtime validation.
    const errors = validateCommunicationsFootprintEvidence([malformed])
    expect(errors).toEqual(
      expect.arrayContaining([
        "7499011121A: pad TRIANGLE shape must be circle or rect",
        "7499011121A: circular pad UNEQUAL_CIRCLE must have equal width and height"
      ])
    )
  })
})
