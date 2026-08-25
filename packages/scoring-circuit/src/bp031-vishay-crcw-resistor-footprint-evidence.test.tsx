import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { benchPrototypeAnalogFootprintClosure } from "./bench-prototype-analog-footprint-closure.js"
import {
  Bp031VishayCrcw0603100KfkeaHpFootprint,
  Bp031VishayCrcw060320R0FkeaHpFootprint,
  Bp031VishayCrcw060322R0FkeaHpFootprint,
  Bp031VishayCrcw120656K0FkeaHpFootprint,
  bp031VishayCrcwResistorFootprintEvidence,
  validateBp031VishayCrcwResistorFootprintEvidence
} from "./bp031-vishay-crcw-resistor-footprint-evidence.js"
import { M404_SINGLE_CHANNEL_COUPON } from "./m4-04-single-channel-coupon.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function renderedGeometryHash(json: readonly CircuitElement[]) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of json) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isRectPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

function inflatePdfStreams(bytes: Buffer) {
  let decoded = ""
  let cursor = 0
  while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
    const streamStart =
      bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
        ? cursor + 8
        : bytes[cursor + 6] === 10
          ? cursor + 7
          : cursor + 6
    const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
    if (streamEnd < 0) break
    try {
      decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
    } catch {
      // Non-content or uncompressed streams do not contribute to marker checks.
    }
    cursor = streamEnd + "endstream".length
  }
  return decoded
}

const exactMpnRows = [
  ["R_ESD", "CRCW060322R0FKEAHP", "0603", 22, "vishay-d11-crcw0603-e3"],
  ["R_SAR", "CRCW060320R0FKEAHP", "0603", 20, "vishay-d11-crcw0603-e3"],
  ["R_SOURCE_PD", "CRCW0603100KFKEAHP", "0603", 100000, "vishay-d11-crcw0603-e3"],
  ["R_FAULT_GUARD", "CRCW120656K0FKEAHP", "1206", 56000, "vishay-d25-crcw1206-e3"]
] as const

describe("BP-031 exact Vishay CRCW resistor candidate footprints", () => {
  it("keeps exact selected MPN identity separate from hash-bound series geometry", () => {
    expect(validateBp031VishayCrcwResistorFootprintEvidence()).toEqual([])
    expect(bp031VishayCrcwResistorFootprintEvidence).toMatchObject({
      artifactKind: "bp031-vishay-crcw-selected-resistor-footprint-evidence",
      workUnit: "BP-031",
      manufacturer: "Vishay",
      sourceControl: {
        basisCommit: "d29c549b9da078b7c2e6f23487eb4c613eb4798f",
        upstreamLedgers: [
          {
            id: "M4-04",
            artifactKind: "m4-04-single-channel-sensing-coupon",
            path: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
            sha256: "2CBA495FC2746C038FB09A13793B1DBF7F7D0B4D8F55D7F748AD2E0E9E12D0E0"
          },
          {
            id: "BP-031",
            artifactKind: "bench-prototype-analog-footprint-closure",
            path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
            sha256: "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144"
          }
        ]
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(
      bp031VishayCrcwResistorFootprintEvidence.sources.find(
        (source) => source.id === "vishay-dcrcwe3-series-rev-2026-04-14"
      )
    ).toMatchObject({
      authority: "manufacturer-primary",
      documentNumber: "20035",
      revision: "14-Apr-2026",
      reviewedPages: "1, 11",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
      sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3",
      scope: expect.stringContaining("does not name the four selected exact orderable MPNs")
    })
    expect(
      bp031VishayCrcwResistorFootprintEvidence.sources.find(
        (source) => source.id === "bp031-selected-vishay-mpn-records"
      )
    ).toMatchObject({
      authority: "project-canonical-source",
      artifactPath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
      sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d",
      url: null,
      reviewedPages: null
    })
    expect(bp031VishayCrcwResistorFootprintEvidence.exactSelectedParts).toEqual(
      exactMpnRows.map(([canonicalReference, manufacturerPartNumber, packageSize, resistanceOhms, seriesGeometryId]) =>
        expect.objectContaining({
          canonicalReference,
          manufacturerPartNumber,
          package: packageSize,
          resistanceOhms,
          seriesGeometryId,
          exactMpnNamedInManufacturerSource: false
        })
      )
    )
    const canonicalByReference = new Map(oneChannelAnalogExperimentBom.map((part) => [part.reference, part]))
    const m404ByReference = new Map(M404_SINGLE_CHANNEL_COUPON.footprints.map((part) => [part.reference, part]))
    const closureByBaseReference = new Map(
      benchPrototypeAnalogFootprintClosure.records
        .filter((record) => record.sourceContract === "BP-103")
        .map((record) => [record.sourceBaseReference, record])
    )
    for (const part of bp031VishayCrcwResistorFootprintEvidence.exactSelectedParts) {
      const canonical = canonicalByReference.get(part.canonicalReference)
      const m404 = m404ByReference.get(part.canonicalReference)
      const closure = closureByBaseReference.get(part.canonicalReference)
      expect(canonical).toMatchObject({
        reference: part.canonicalReference,
        manufacturer: "Vishay",
        mpn: part.manufacturerPartNumber,
        package: part.package,
        primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf"
      })
      expect(m404).toMatchObject({
        reference: part.canonicalReference,
        manufacturer: "Vishay",
        exactMpn: part.manufacturerPartNumber,
        package: part.package,
        footprintRelease: "deny",
        independentDrawingReview: { reviewerId: "root-final-reviewer", status: "pending" }
      })
      expect(closure).toMatchObject({
        sourceBaseReference: part.canonicalReference,
        exactMpn: part.manufacturerPartNumber,
        exactPackage: part.package,
        sourceContract: "BP-103",
        sourceSubcontract: "BP-102",
        sharedManufacturerSourceId: `M4-04:${part.manufacturerPartNumber}`,
        disposition: "DNP-unresolved",
        existingFootprintEvidence: { eligibleForPcb: false, existingLedgerReleaseState: "deny" }
      })
      expect(part.upstreamLedgerBinding).toMatchObject({
        m404: { reference: part.canonicalReference, exactMpn: part.manufacturerPartNumber, package: part.package },
        bp031: {
          sourceBaseReference: part.canonicalReference,
          sharedManufacturerSourceId: `M4-04:${part.manufacturerPartNumber}`
        }
      })
    }
    const seriesSource = bp031VishayCrcwResistorFootprintEvidence.sources[0]
    const identitySource = bp031VishayCrcwResistorFootprintEvidence.sources[1]
    if (seriesSource === undefined || identitySource === undefined) throw new Error("source fixtures are missing")
    const seriesBytes = readFileSync(
      new URL(`../${seriesSource.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    const identityBytes = readFileSync(
      new URL(`../${identitySource.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    expect(createHash("sha256").update(seriesBytes).digest("hex").toUpperCase()).toBe(seriesSource.sha256)
    expect(createHash("sha256").update(identityBytes).digest("hex")).toBe(identitySource.sha256)
    const seriesContent = `${seriesBytes.toString("latin1")}\n${inflatePdfStreams(seriesBytes)}`
    for (const pageEvidence of seriesSource.pageEvidence) {
      for (const marker of pageEvidence.markers) expect(seriesContent).toContain(marker)
    }
    for (const part of bp031VishayCrcwResistorFootprintEvidence.exactSelectedParts) {
      expect(seriesContent).not.toContain(part.manufacturerPartNumber)
    }
    for (const upstream of bp031VishayCrcwResistorFootprintEvidence.sourceControl.upstreamLedgers) {
      const bytes = readFileSync(
        new URL(`../${upstream.path.replace("packages/scoring-circuit/", "")}`, import.meta.url)
      )
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(upstream.sha256)
    }
  })

  it("shares only the two proven Vishay series land patterns and derives review geometry", () => {
    const d11 = bp031VishayCrcwResistorFootprintEvidence.seriesGeometry.find(
      (family) => family.id === "vishay-d11-crcw0603-e3"
    )
    const d25 = bp031VishayCrcwResistorFootprintEvidence.seriesGeometry.find(
      (family) => family.id === "vishay-d25-crcw1206-e3"
    )
    expect(d11).toMatchObject({
      package: {
        family: "D11/CRCW0603 e3",
        imperialSize: "0603",
        bodyLengthMm: { minimum: 1.5, maximum: 1.65 },
        bodyWidthMm: { minimum: 0.75, maximum: 0.95 },
        bodyHeightMm: { minimum: 0.4, maximum: 0.5 }
      },
      landPattern: {
        wave: {
          gapMm: 0.65,
          padLengthAlongTerminalAxisMm: 1.1,
          padWidthAcrossTerminalAxisMm: 1.25,
          overallSpanMm: 2.85
        },
        reflow: {
          gapMm: 0.75,
          padLengthAlongTerminalAxisMm: 0.75,
          padWidthAcrossTerminalAxisMm: 1,
          overallSpanMm: 2.25
        }
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      artwork: { state: "generated-project-review-only", authority: "deny" },
      projectFootprint: {
        padLengthMm: 0.75,
        padWidthMm: 1,
        padCenterSpanMm: 1.5,
        padGapMm: 0.75,
        solderMask: { openingLengthMm: 0.85, openingWidthMm: 1.1, sourceStatus: "not-published" },
        paste: { openingLengthMm: 0.65, openingWidthMm: 0.9, sourceStatus: "not-published" },
        courtyard: { widthMm: 2.55, heightMm: 1.3, sourceStatus: "not-published" },
        accepted: false,
        fabricationAuthority: "deny"
      }
    })
    expect(d25).toMatchObject({
      package: {
        family: "D25/CRCW1206 e3",
        imperialSize: "1206",
        bodyLengthMm: { minimum: 3, maximum: 3.3 },
        bodyWidthMm: { minimum: 1.45, maximum: 1.75 },
        bodyHeightMm: { minimum: 0.5, maximum: 0.6 }
      },
      landPattern: {
        wave: { gapMm: 1.4, padLengthAlongTerminalAxisMm: 1.4, padWidthAcrossTerminalAxisMm: 1.95, overallSpanMm: 4.2 },
        reflow: {
          gapMm: 1.5,
          padLengthAlongTerminalAxisMm: 1.05,
          padWidthAcrossTerminalAxisMm: 1.8,
          overallSpanMm: 3.6
        }
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      artwork: { state: "generated-project-review-only", authority: "deny" },
      projectFootprint: {
        padLengthMm: 1.05,
        padWidthMm: 1.8,
        padCenterSpanMm: 2.55,
        padGapMm: 1.5,
        solderMask: { sourceStatus: "not-published" },
        paste: { sourceStatus: "not-published" },
        courtyard: { sourceStatus: "not-published" },
        accepted: false,
        fabricationAuthority: "deny"
      }
    })
    if (d11 === undefined || d25 === undefined) throw new Error("series geometry fixtures are missing")
    expect(d11.projectFootprint.solderMask.openingLengthMm).toBeCloseTo(0.85, 10)
    expect(d11.projectFootprint.solderMask.openingWidthMm).toBeCloseTo(1.1, 10)
    expect(d11.projectFootprint.paste.openingLengthMm).toBeCloseTo(0.65, 10)
    expect(d11.projectFootprint.paste.openingWidthMm).toBeCloseTo(0.9, 10)
    expect(d11.projectFootprint.courtyard.widthMm).toBeCloseTo(2.55, 10)
    expect(d11.projectFootprint.courtyard.heightMm).toBeCloseTo(1.3, 10)
    expect(d25.projectFootprint.solderMask.openingLengthMm).toBeCloseTo(1.15, 10)
    expect(d25.projectFootprint.solderMask.openingWidthMm).toBeCloseTo(1.9, 10)
    expect(d25.projectFootprint.paste.openingLengthMm).toBeCloseTo(0.95, 10)
    expect(d25.projectFootprint.paste.openingWidthMm).toBeCloseTo(1.7, 10)
    expect(d25.projectFootprint.courtyard.widthMm).toBeCloseTo(3.9, 10)
    expect(d25.projectFootprint.courtyard.heightMm).toBeCloseTo(2.1, 10)
    expect(d11.landPattern.reflow.gapMm + 2 * d11.landPattern.reflow.padLengthAlongTerminalAxisMm).toBe(
      d11.landPattern.reflow.overallSpanMm
    )
    expect(d25.landPattern.reflow.gapMm + 2 * d25.landPattern.reflow.padLengthAlongTerminalAxisMm).toBe(
      d25.landPattern.reflow.overallSpanMm
    )
    expect(d11.projectFootprint.orientation).toMatchObject({ polarity: "non-polar", pinOne: "not-applicable" })
    expect(d25.projectFootprint.orientation).toMatchObject({ polarity: "non-polar", pinOne: "not-applicable" })
  })

  it.each([
    ["CRCW060322R0FKEAHP", <Bp031VishayCrcw060322R0FkeaHpFootprint />, "vishay-d11-crcw0603-e3"],
    ["CRCW060320R0FKEAHP", <Bp031VishayCrcw060320R0FkeaHpFootprint />, "vishay-d11-crcw0603-e3"],
    ["CRCW0603100KFKEAHP", <Bp031VishayCrcw0603100KfkeaHpFootprint />, "vishay-d11-crcw0603-e3"],
    ["CRCW120656K0FKEAHP", <Bp031VishayCrcw120656K0FkeaHpFootprint />, "vishay-d25-crcw1206-e3"]
  ])("renders the exact %s candidate with source ports and no tscircuit errors", (mpn, component, familyId) => {
    const json = renderTestCircuit(component)
    const pads = json.filter(isRectSmtPad)
    const paste = json.filter(isRectPaste)
    expect(pads).toHaveLength(2)
    expect(paste).toHaveLength(2)
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toHaveLength(1)
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "1", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 2, name: "2", port_hints: expect.arrayContaining(["pin2"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
    const family = bp031VishayCrcwResistorFootprintEvidence.seriesGeometry.find(({ id }) => id === familyId)
    if (family === undefined) throw new Error(`missing family ${familyId}`)
    expect(renderedGeometryHash(json)).toBe(family.artwork.sha256)
    expect(mpn).toBeTruthy()
  })

  it.each([
    [
      "exact MPN",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.exactSelectedParts[0], "manufacturerPartNumber", "FORGED")
    ],
    [
      "cross-family MPN substitution",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.exactSelectedParts[0], "manufacturerPartNumber", "CRCW120656K0FKEAHP")
    ],
    [
      "cross-family geometry substitution",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.exactSelectedParts[0], "seriesGeometryId", "vishay-d25-crcw1206-e3")
    ],
    [
      "series source hash",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) => Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "series geometry",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.seriesGeometry[0]?.landPattern.reflow, "overallSpanMm", 99)
    ],
    [
      "manufacturer CAD",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.seriesGeometry[0]?.manufacturerCad, "authority", "allow")
    ],
    [
      "upstream ledger binding",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.exactSelectedParts[0]?.upstreamLedgerBinding.bp031, "sourceBaseReference", "FORGED")
    ],
    [
      "orientation disposition",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.seriesGeometry[0]?.projectFootprint.orientation, "polarity", "polarized")
    ],
    [
      "rendered artwork digest",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) =>
        Reflect.set(copy.seriesGeometry[0]?.artwork, "sha256", "0".repeat(64))
    ],
    [
      "fabrication acceptance",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) => Reflect.set(copy, "accepted", true)
    ],
    [
      "fabrication authority",
      (copy: typeof bp031VishayCrcwResistorFootprintEvidence) => Reflect.set(copy, "fabricationAuthority", "allow")
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = structuredClone(bp031VishayCrcwResistorFootprintEvidence)
    mutate(copy)
    expect(validateBp031VishayCrcwResistorFootprintEvidence(copy)).not.toEqual([])
  })
})
