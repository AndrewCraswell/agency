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
