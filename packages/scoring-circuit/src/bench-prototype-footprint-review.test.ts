import { describe, expect, it } from "vitest"
import { benchPrototypeBom } from "./bench-prototype-bom.js"
import {
  benchPrototypeFootprintReviewTemplate,
  createBenchPrototypeFootprintReviewTemplate,
  validateBenchPrototypeFootprintReview
} from "./bench-prototype-footprint-review.js"

const hash = "A".repeat(64)

function reviewedFirstSelected() {
  const template = createBenchPrototypeFootprintReviewTemplate()
  const selectedIndex = template.records.findIndex((record) => record.bomDisposition === "selected")
  return {
    ...template,
    records: template.records.map((record, index) =>
      index === selectedIndex
        ? {
            ...record,
            manufacturerDrawing: {
              state: "acquired" as const,
              url: "https://manufacturer.example/drawing.pdf",
              revision: "drawing revision A",
              sha256: hash
            },
            manufacturerCad: {
              state: "acquired" as const,
              url: "https://manufacturer.example/cad.zip",
              revision: "CAD revision A",
              sha256: hash
            },
            artwork: {
              state: "generated" as const,
              artifactPath: "cad/footprints/U_SCORING.kicad_mod",
              generator: "KiCad 9.0.4",
              sha256: hash
            },
            orientation: {
              state: "documented" as const,
              assemblyRotationDeg: 0,
              datum: "Pin 1 at upper-left assembly marker",
              notes: "Overlay checked against manufacturer top view."
            },
            reviewer: "Independent footprint reviewer",
            reviewedAt: "2026-08-23T18:00:00.000Z",
            disposition: "evidence-reviewed" as const,
            findings: []
          }
        : record
    )
  }
}

describe("BP-030 bench prototype footprint review method", () => {
  it("creates one fail-closed record for every BP-020 BOM reference", () => {
    expect(validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)).toBe(true)
    expect(benchPrototypeFootprintReviewTemplate.records).toHaveLength(benchPrototypeBom.rows.length)
    expect(benchPrototypeFootprintReviewTemplate.records.map((record) => record.reference)).toEqual(
      benchPrototypeBom.rows.map((row) => row.reference)
    )
    expect(benchPrototypeFootprintReviewTemplate).toMatchObject({
      fabricationRelease: false,
      footprintClosure: false,
      releaseState: "deny"
    })
    expect(Object.isFrozen(benchPrototypeFootprintReviewTemplate)).toBe(true)
    expect(Object.isFrozen(benchPrototypeFootprintReviewTemplate.records)).toBe(true)
  })

  it("binds selected MPNs and packages while refusing to invent TBD or DNP selections", () => {
    for (const [index, record] of benchPrototypeFootprintReviewTemplate.records.entries()) {
      const row = benchPrototypeBom.rows[index]
      expect(record).toMatchObject({
        reference: row?.reference,
        bomDisposition: row?.disposition,
        exactMpn: row?.mpn ?? null,
        exactPackage: row?.package ?? null
      })
      if (row?.disposition === "TBD") expect(record.disposition).toBe("selection-blocked")
      if (row?.disposition === "DNP") expect(record.disposition).toBe("excluded-dnp")
    }

    expect(
      benchPrototypeFootprintReviewTemplate.records.find((record) => record.reference === "U_W5500")
    ).toMatchObject({
      exactMpn: "W5500",
      exactPackage: "LQFP-48, 7mm x 7mm body, 0.5mm pitch"
    })
  })

  it("accepts a completely evidenced review without granting footprint or fabrication closure", () => {
    const review = reviewedFirstSelected()
    expect(validateBenchPrototypeFootprintReview(review)).toBe(true)
    expect(review.footprintClosure).toBe(false)
    expect(review.fabricationRelease).toBe(false)
    expect(review.releaseState).toBe("deny")
  })

  it("rejects forged baseline identity, release claims, missing records, and sparse arrays", () => {
    const template = createBenchPrototypeFootprintReviewTemplate()
    const forgedMpn = {
      ...template,
      records: template.records.map((record, index) => (index === 0 ? { ...record, exactMpn: "FORGED" } : record))
    }
    expect(() => validateBenchPrototypeFootprintReview(forgedMpn)).toThrow(RangeError)
    expect(() => validateBenchPrototypeFootprintReview({ ...template, footprintClosure: true })).toThrow(RangeError)
    expect(() => validateBenchPrototypeFootprintReview({ ...template, records: template.records.slice(1) })).toThrow(
      RangeError
    )

    const sparseRecords: unknown[] = []
    sparseRecords.length = template.records.length
    expect(() =>
      validateBenchPrototypeFootprintReview({
        ...createBenchPrototypeFootprintReviewTemplate(),
        records: sparseRecords
      })
    ).toThrow(RangeError)
  })

  it("requires exact acquired-source, artwork, orientation, reviewer, and time evidence", () => {
    const review = reviewedFirstSelected()
    const incomplete = {
      ...review,
      records: review.records.map((record, index) =>
        index === 0
          ? { ...record, manufacturerCad: { state: "not-acquired" as const, url: null, revision: null, sha256: null } }
          : record
      )
    }
    expect(() => validateBenchPrototypeFootprintReview(incomplete)).toThrow(RangeError)

    const badDigest = {
      ...review,
      records: review.records.map((record, index) =>
        index === 0 ? { ...record, artwork: { ...record.artwork, sha256: "a".repeat(64) } } : record
      )
    }
    expect(() => validateBenchPrototypeFootprintReview(badDigest)).toThrow(RangeError)

    const noReviewer = {
      ...review,
      records: review.records.map((record, index) => (index === 0 ? { ...record, reviewer: null } : record))
    }
    expect(() => validateBenchPrototypeFootprintReview(noReviewer)).toThrow(RangeError)
  })

  it("rejects accessors, extra keys, symbol keys, and aliased nested evidence", () => {
    const accessor = createBenchPrototypeFootprintReviewTemplate()
    Object.defineProperty(accessor.records[0], "exactMpn", { enumerable: true, get: () => "STM32G474RET3TR" })
    expect(() => validateBenchPrototypeFootprintReview(accessor)).toThrow(RangeError)

    const extra = { ...createBenchPrototypeFootprintReviewTemplate(), unexpected: true }
    expect(() => validateBenchPrototypeFootprintReview(extra)).toThrow(RangeError)

    const symbolKey = createBenchPrototypeFootprintReviewTemplate()
    Object.defineProperty(symbolKey.records[0], Symbol("forged"), { enumerable: true, value: true })
    expect(() => validateBenchPrototypeFootprintReview(symbolKey)).toThrow(RangeError)

    const aliased = createBenchPrototypeFootprintReviewTemplate()
    const shared = aliased.records[0]?.manufacturerDrawing
    if (shared === undefined) throw new Error("BP-020 must have at least one row")
    Object.defineProperty(aliased.records[1], "manufacturerDrawing", { enumerable: true, value: shared })
    expect(() => validateBenchPrototypeFootprintReview(aliased)).toThrow(RangeError)
  })
})
