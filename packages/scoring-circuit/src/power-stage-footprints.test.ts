import { describe, expect, it } from "vitest"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import { findPowerStageFootprint, powerStageFootprints } from "./power-stage-footprints.js"

describe("power-stage footprint evidence library", () => {
  it("tracks every selected regulator, power inductor, shunt, polymer, and critical MLCC", () => {
    expect(powerStageFootprints.map((footprint) => footprint.mpn)).toEqual(
      expect.arrayContaining([
        "LMR43620MSC3RPERQ1",
        "XGL4030-222MEC",
        "TPS56A37RPAR",
        "744325330",
        "CRE2512-FZ-R002E-3",
        "T55A106M010C0200",
        "T523H107M035APE070",
        "GRM32ER7YA106KA12L",
        "GRM32ER71E226KE15L",
        "C2012X7S1A226M125AC",
        "C0603C104K3RACTU",
        "GRM188R71A105KA61"
      ])
    )
  })

  it("fails closed: no drawing entry clears the fabrication gate", () => {
    expect(powerStageFootprints.every((footprint) => footprint.releaseState === "deny")).toBe(true)
    expect(powerStageFootprints.every((footprint) => footprint.denyReasons.length > 0)).toBe(true)
  })

  it("uses unique MPNs and unique pad IDs with complete mappings", () => {
    const mpns = powerStageFootprints.map((footprint) => footprint.mpn)
    expect(new Set(mpns).size).toBe(mpns.length)

    for (const footprint of powerStageFootprints) {
      const padIds = footprint.pads.mapping.map((mapping) => mapping.pad)
      expect(new Set(padIds).size).toBe(padIds.length)
      expect(footprint.pads.mapping).toHaveLength(
        footprint.pads.geometry.reduce((count, geometry) => count + geometry.count, 0)
      )
    }
  })

  it("contains only positive finite mechanical and pad dimensions", () => {
    for (const footprint of powerStageFootprints) {
      for (const dimension of Object.values(footprint.body)) {
        expect(dimension).toBeGreaterThan(0)
        expect(Number.isFinite(dimension)).toBe(true)
      }

      for (const geometry of footprint.pads.geometry) {
        expect(geometry.count).toBeGreaterThan(0)
        expect(Number.isFinite(geometry.count)).toBe(true)

        const dimensions = Object.entries(geometry)
          .filter(([name]) => name.endsWith("Mm"))
          .map(([, value]) => value)
        for (const dimension of dimensions) {
          expect(dimension).toBeGreaterThan(0)
          expect(Number.isFinite(dimension)).toBe(true)
        }
      }
    }
  })

  it("preserves the manufacturer-specific high-current land dimensions", () => {
    const coilcraft = findPowerStageFootprint("XGL4030-222MEC")
    const wurth = findPowerStageFootprint("744325330")
    const shunt = findPowerStageFootprint("CRE2512-FZ-R002E-3")
    const kemet = findPowerStageFootprint("T523H107M035APE070")

    expect(coilcraft?.drawing).toMatchObject({ id: "Coilcraft document 1575-4, revised 2026-02-19", pages: [4] })
    expect(coilcraft?.pads.geometry[0]).toMatchObject({ gapMm: 2.37, padLengthMm: 3.4, padWidthMm: 0.98 })
    expect(wurth?.pads.geometry[0]).toMatchObject({ gapMm: 3.8, padLengthMm: 3.85, padWidthMm: 4 })
    expect(wurth?.body).toMatchObject({ maximumHeightMm: 5 })
    expect(shunt?.pads.geometry[0]).toMatchObject({ gapMm: 1.3, padLengthMm: 3.1, padWidthMm: 4 })
    expect(shunt?.body).toMatchObject({ lengthMm: 6.4, maximumHeightMm: 1.1 })
    expect(kemet?.pads.geometry[0]).toMatchObject({ gapMm: 3.27, padLengthMm: 2.67, padWidthMm: 4.48 })
    expect(kemet?.body).toMatchObject({ maximumHeightMm: 2 })
  })

  it("makes polarity and TI thermal/paste rules explicit", () => {
    const applicationBuck = findPowerStageFootprint("LMR43620MSC3RPERQ1")
    const v5Buck = findPowerStageFootprint("TPS56A37RPAR")
    const vishay = findPowerStageFootprint("T55A106M010C0200")
    const kemet = findPowerStageFootprint("T523H107M035APE070")

    expect(applicationBuck?.thermal.status).toBe("required")
    expect(applicationBuck?.paste.status).toBe("specified")
    expect(v5Buck?.thermal.status).toBe("required")
    expect(v5Buck?.paste.status).toBe("specified")
    expect(vishay?.body).toMatchObject({ maximumHeightMm: 1.8 })
    expect(vishay?.drawing).toMatchObject({
      id: "Vishay Polymer Guide 40076, revised 2026-05-20",
      pages: [12]
    })
    expect(vishay?.sources).toEqual([
      expect.objectContaining({
        id: "Vishay Polymer Guide 40076, revised 2026-05-20",
        pages: [12],
        role: "Case-A recommended pad geometry"
      }),
      expect.objectContaining({
        id: "Vishay T55 data sheet 40174, revised 2026-03-30",
        pages: [2],
        role: "Case-A 1.6 plus or minus 0.2 mm height, package dimensions, and anode polarity marking"
      })
    ])
    expect(vishay?.pads.mapping[0]).toMatchObject({ role: "positive", terminal: "anode" })
    expect(kemet?.courtyard).toMatchObject({ status: "specified" })
    expect(kemet?.drawing).toMatchObject({ id: "KEMET T2079_SSD, T523/T548 Table 2", pages: [13] })
    expect(kemet?.pads.mapping[0]).toMatchObject({ role: "positive", terminal: "anode" })
  })

  it("denies a generic package-only MLCC until its source drawing is imported", () => {
    const inputBank = findPowerStageFootprint("GRM32ER7YA106KA12L")
    expect(inputBank?.pads.geometry).toEqual([])
    expect(inputBank?.releaseState).toBe("deny")
    expect(inputBank?.denyReasons[0]).toContain("part-specific")
  })

  it("keeps all five exact critical MLCC records geometry-free", () => {
    const mlccMpns = [
      "GRM32ER7YA106KA12L",
      "GRM32ER71E226KE15L",
      "C2012X7S1A226M125AC",
      "C0603C104K3RACTU",
      "GRM188R71A105KA61"
    ]

    for (const mpn of mlccMpns) {
      const footprint = findPowerStageFootprint(mpn)
      expect(footprint?.pads.geometry).toEqual([])
      expect(footprint?.pads.mapping).toEqual([])
      expect(footprint?.releaseState).toBe("deny")
    }
  })

  it("covers every matching fabrication gate without changing the gate contract", () => {
    const libraryMpns = new Set<string>(powerStageFootprints.map((footprint) => footprint.mpn))
    const powerStageGateMpns = fabricationFootprintGates.map((gate) => gate.mpn).filter((mpn) => libraryMpns.has(mpn))

    expect(powerStageGateMpns).toEqual(
      expect.arrayContaining([
        "LMR43620MSC3RPERQ1",
        "XGL4030-222MEC",
        "TPS56A37RPAR",
        "744325330",
        "CRE2512-FZ-R002E-3",
        "T55A106M010C0200",
        "T523H107M035APE070"
      ])
    )
    expect(powerStageGateMpns.every((mpn) => findPowerStageFootprint(mpn)?.releaseState === "deny")).toBe(true)
  })
})
