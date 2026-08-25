import { describe, expect, it } from "vitest"
import {
  benchPrototypeAnalogFootprintClosure,
  benchPrototypeAnalogFootprintClosureUpstreamSnapshot,
  validateBenchPrototypeAnalogFootprintClosure
} from "./bench-prototype-analog-footprint-closure.js"

describe("BP-031 analog and weapon-fixture footprint closure", () => {
  it("covers every replicated cell reference and keeps footprint release denied", () => {
    expect(validateBenchPrototypeAnalogFootprintClosure(benchPrototypeAnalogFootprintClosure)).toBe(true)
    expect(benchPrototypeAnalogFootprintClosure.scope).toMatchObject({
      replicatedCellCount: 7,
      referencesPerReplicatedCell: 16,
      replicatedCellRecordCount: 112,
      connectorRecordCount: 1,
      totalRecordCount: 113,
      sharedManufacturerSourceCount: 16,
      sharedSourceLinkedRecordCount: 112,
      sharedSourceUnresolvedRecordCount: 0,
      closedFootprintCount: 0,
      deniedUnresolvedFootprintCount: 113
    })
    expect(benchPrototypeAnalogFootprintClosure.records).toHaveLength(113)
    expect(
      benchPrototypeAnalogFootprintClosure.records.filter((record) => record.sourceContract === "BP-103")
    ).toHaveLength(112)
    expect(
      benchPrototypeAnalogFootprintClosure.records.filter((record) => record.sourceContract === "BP-104")
    ).toHaveLength(1)
    expect(benchPrototypeAnalogFootprintClosure.authority).toMatchObject({
      footprintClosureAuthorized: false,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("centralizes only matching M4-04 manufacturer sources without promoting a footprint gate", () => {
    expect(benchPrototypeAnalogFootprintClosure.sharedManufacturerSources).toHaveLength(16)
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:TPD4E05U06DQAR"
      )
    ).toMatchObject({
      sourceStatus: "hash-bound",
      acquisition: "exact-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tpd4e05u06-dqar-datasheet.pdf"
    })
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:CRCW060322R0FKEAHP"
      )
    ).toMatchObject({
      sourceStatus: "series-hash-bound",
      acquisition: "series-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf"
    })
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:GRM21BR71A106KE51L"
      )
    ).toMatchObject({
      sourceStatus: "hash-bound",
      acquisition: "exact-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf"
    })
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:CGA3E3X7R1H105K080AB"
      )
    ).toMatchObject({
      sourceStatus: "hash-bound",
      acquisition: "exact-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf",
      reviewStatus: "not-reviewed-for-bp-031"
    })
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:ADA4177-1ARZ"
      )
    ).toMatchObject({
      sourceStatus: "identity-hash-bound",
      acquisition: "exact-primary-identity-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/analog-devices-ada4177-1arz-product.html",
      drawingIdentifier: null,
      drawingUrl: null,
      identityIdentifier: "Analog Devices ADA4177-1 product page and Rev. E data-sheet identity, R-8 package option",
      identityUrl: "https://www.analog.com/en/products/ADA4177-1.html",
      reviewStatus: "not-reviewed-for-bp-031"
    })
    expect(
      benchPrototypeAnalogFootprintClosure.sharedManufacturerSources.find(
        (source) => source.sourceId === "M4-04:ERA3AEB2491V"
      )
    ).toMatchObject({
      sourceStatus: "hash-bound",
      acquisition: "exact-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
      drawingIdentifier: "Panasonic ERAA type, ERA3A 0603 manufacturer dimensions",
      drawingUrl: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf",
      sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79",
      reviewStatus: "not-reviewed-for-bp-031"
    })
    for (const record of benchPrototypeAnalogFootprintClosure.records.filter(
      (candidate) => candidate.sourceContract === "BP-103"
    )) {
      expect(record.sharedManufacturerSourceId).toBe(`M4-04:${record.exactMpn}`)
    }
    for (const record of benchPrototypeAnalogFootprintClosure.records) {
      expect(record.manufacturerDrawing).toMatchObject({
        state: "not-acquired",
        url: null,
        revision: null,
        sha256: null
      })
      expect(record.disposition).toBe("DNP-unresolved")
    }
  })

  it("reconciles all seven BP-103 cells to the exact identity set", () => {
    const cellRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceContract === "BP-103"
    )
    expect(new Set(cellRecords.map((record) => record.channelIndex))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]))
    for (const channelIndex of [1, 2, 3, 4, 5, 6, 7]) {
      const channelRecords = cellRecords.filter((record) => record.channelIndex === channelIndex)
      expect(channelRecords).toHaveLength(16)
      expect(channelRecords.map((record) => record.reference)).toEqual([
        `U_ESD_${channelIndex}`,
        `R_ESD_${channelIndex}`,
        `U_SOURCE_SWITCH_${channelIndex}`,
        `R_SOURCE_${channelIndex}`,
        `R_SOURCE_PD_${channelIndex}`,
        `U_OVP_BUFFER_${channelIndex}`,
        `R_SAR_${channelIndex}`,
        `C_SAR_${channelIndex}`,
        `U_SAR_${channelIndex}`,
        `U_REF_${channelIndex}`,
        `C_REF_IN_${channelIndex}`,
        `C_REF_REG_${channelIndex}`,
        `C_REF_REG_HF_${channelIndex}`,
        `R_REF_SAR_${channelIndex}`,
        `C_REF_${channelIndex}`,
        `R_FAULT_GUARD_${channelIndex}`
      ])
      expect(channelRecords.find((record) => record.reference === `C_SAR_${channelIndex}`)).toMatchObject({
        exactMpn: "C0603C102J5GACTU",
        exactPackage: "0603"
      })
      expect(channelRecords.find((record) => record.reference === `U_SAR_${channelIndex}`)).toMatchObject({
        exactMpn: "ADS8881IDGS",
        exactPackage: "DGS VSSOP-10"
      })
      expect(channelRecords.find((record) => record.reference === `R_SOURCE_${channelIndex}`)).toMatchObject({
        sourceContract: "BP-103",
        sourceBaseReference: "R_SOURCE",
        sourceSubcontract: "BP-102",
        manufacturer: "Panasonic",
        exactMpn: "ERA3AEB2491V",
        exactPackage: "0603",
        primaryEvidenceUrl:
          "https://industrial.panasonic.com/ww/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V"
      })
      expect(channelRecords.find((record) => record.reference === `U_OVP_BUFFER_${channelIndex}`)).toMatchObject({
        exactMpn: "ADA4177-1ARZ",
        exactPackage: "R SOIC-8",
        primaryEvidenceUrl:
          "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf",
        sharedManufacturerSourceId: "M4-04:ADA4177-1ARZ"
      })
      expect(channelRecords.find((record) => record.reference === `R_SOURCE_PD_${channelIndex}`)).toMatchObject({
        sourceContract: "BP-103",
        sourceBaseReference: "R_SOURCE_PD",
        sourceSubcontract: "BP-102",
        manufacturer: "Vishay",
        exactMpn: "CRCW0603100KFKEAHP",
        exactPackage: "0603",
        primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf"
      })
    }
  })

  it("freezes the exact Molex connector and BP-104 pin disposition", () => {
    const connectorRecord = benchPrototypeAnalogFootprintClosure.records.find(
      (record) => record.sourceContract === "BP-104"
    )
    expect(connectorRecord).toMatchObject({
      reference: "J_WEAPON_FIXTURE",
      manufacturer: "Molex",
      exactMpn: "43045-1200",
      disposition: "DNP-unresolved"
    })
    expect(benchPrototypeAnalogFootprintClosure.connectorClosure).toMatchObject({
      boardReference: "J_WEAPON_FIXTURE",
      harnessReference: "J_WEAPON_HARNESS",
      header: { mpn: "43045-1200", positions: 12 },
      mate: { mpn: "43025-1200", positions: 12 },
      terminal: { mpn: "43030-0007" },
      populatedBoardPins: [1, 2, 3, 4, 5, 6, 7],
      unpopulatedBoardPins: [8, 9, 10, 11, 12],
      releaseState: "deny"
    })
  })

  it("does not claim geometry, artwork, orientation, or PCB eligibility", () => {
    for (const record of benchPrototypeAnalogFootprintClosure.records) {
      expect(record).toMatchObject({
        manufacturerDrawing: { state: "not-acquired", url: null, revision: null, sha256: null },
        manufacturerCad: { state: "not-acquired", url: null, revision: null, sha256: null },
        artwork: { state: "not-generated", artifactPath: null, generator: null, sha256: null },
        orientation: { state: "unreviewed", assemblyRotationDeg: null, datum: null, notes: null },
        disposition: "DNP-unresolved",
        existingFootprintEvidence: { eligibleForPcb: false }
      })
      expect(record.findings.length).toBeGreaterThan(0)
    }
    expect(Object.isFrozen(benchPrototypeAnalogFootprintClosure)).toBe(true)
    expect(Object.isFrozen(benchPrototypeAnalogFootprintClosure.records)).toBe(true)
    expect(Object.isFrozen(benchPrototypeAnalogFootprintClosureUpstreamSnapshot)).toBe(true)
  })

  it("rejects the stale 14-reference, 98-cell-record ledger", () => {
    const stale = structuredClone(benchPrototypeAnalogFootprintClosure)
    Reflect.set(
      stale,
      "records",
      stale.records.filter(
        (record) => record.sourceBaseReference !== "R_SOURCE" && record.sourceBaseReference !== "R_SOURCE_PD"
      )
    )
    Reflect.set(stale.scope, "referencesPerReplicatedCell", 14)
    Reflect.set(stale.scope, "replicatedCellRecordCount", 98)
    Reflect.set(stale.scope, "totalRecordCount", 99)
    Reflect.set(stale.scope, "deniedUnresolvedFootprintCount", 99)
    expect(() => validateBenchPrototypeAnalogFootprintClosure(stale)).toThrow(RangeError)
  })

  it.each([
    [
      "forged exact MPN",
      (copy: typeof benchPrototypeAnalogFootprintClosure) => Reflect.set(copy.records[0], "exactMpn", "FORGED")
    ],
    [
      "forged geometry evidence",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.records[0]?.manufacturerDrawing, "state", "acquired")
    ],
    [
      "forged shared source link",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.records[0], "sharedManufacturerSourceId", "M4-04:FORGED")
    ],
    [
      "promoted shared source review",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.sharedManufacturerSources[0], "reviewStatus", "reviewed")
    ],
    [
      "wrong replicated capacitor",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.records[5], "exactMpn", "C0603C104K3RACTU")
    ],
    [
      "wrong connector",
      (copy: typeof benchPrototypeAnalogFootprintClosure) => Reflect.set(copy.records[112], "exactMpn", "43045-0400")
    ],
    [
      "fabrication release",
      (copy: typeof benchPrototypeAnalogFootprintClosure) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ],
    [
      "footprint closure",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.authority, "footprintClosureAuthorized", true)
    ]
  ])("rejects %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeAnalogFootprintClosure)
    mutate(copy)
    expect(() => validateBenchPrototypeAnalogFootprintClosure(copy)).toThrow(RangeError)
  })

  it("rejects aliases and accessors without reading forged values", () => {
    const alias = structuredClone(benchPrototypeAnalogFootprintClosure)
    Reflect.set(alias.records, "1", alias.records[0])
    expect(() => validateBenchPrototypeAnalogFootprintClosure(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeAnalogFootprintClosure)
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-031"
      }
    })
    expect(() => validateBenchPrototypeAnalogFootprintClosure(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
