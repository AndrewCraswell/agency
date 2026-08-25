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

  it("maps the seven U_ESD references to the TPD4E05 review inputs without opening release authority", () => {
    expect(benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings).toHaveLength(2)
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-tpd4e05u06-dqa-project-footprint"
      )
    ).toMatchObject({
      mappingId: "bp031-tpd4e05u06-dqa-project-footprint",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25T08:15:00.000Z",
      artifactKind: "bp031-tpd4e05u06-dqa-project-footprint",
      artifactPath: "packages/scoring-circuit/src/bp031-tpd4e05u06-dqa-project-footprint.tsx",
      baseReference: "U_ESD",
      sourceContract: "BP-103",
      exactMpn: "TPD4E05U06DQAR",
      exactPackage: "DQA0010A USON-10",
      affectedReferences: ["U_ESD_1", "U_ESD_2", "U_ESD_3", "U_ESD_4", "U_ESD_5", "U_ESD_6", "U_ESD_7"],
      manufacturerDrawingInput: {
        state: "source-controlled-pending-review",
        acquisition: "exact-drawing-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf",
        revision: "Rev. O",
        reviewedPages: "4, 20, 28-30, 37",
        sha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
        authority: "deny"
      },
      manufacturerCad: {
        state: "not-acquired",
        artifactPath: null,
        sha256: null,
        authority: "deny"
      },
      renderedArtwork: {
        state: "generated-project-review-only",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: "15706D98382BA8B1C0BB569AE04A34B2AEEAA665C2EB69CA1063D13ECDA6DCC9",
        authority: "deny"
      },
      pinOneOrientation: {
        state: "source-controlled-pending-review",
        sourceDatum: "TI DQA0010A top-view top-left pin-one index area and optional pin-one ID",
        pin: 1,
        boardCoordinatesMm: { x: -0.4175, y: -1 },
        boardRotationDegrees: 0,
        orientationVerified: false,
        authority: "deny"
      },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        pinFunctionsReviewed: true,
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: false,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })

    const esdRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "U_ESD"
    )
    expect(esdRecords.map((record) => record.reference)).toEqual([
      "U_ESD_1",
      "U_ESD_2",
      "U_ESD_3",
      "U_ESD_4",
      "U_ESD_5",
      "U_ESD_6",
      "U_ESD_7"
    ])
    expect(
      esdRecords.every((record) => record.reviewEvidenceMappingId === "bp031-tpd4e05u06-dqa-project-footprint")
    ).toBe(true)
    expect(
      benchPrototypeAnalogFootprintClosure.records
        .filter((record) => record.sourceBaseReference !== "U_ESD" && record.sourceBaseReference !== "U_SOURCE_SWITCH")
        .every((record) => record.reviewEvidenceMappingId === null)
    ).toBe(true)
  })

  it("maps the seven U_SOURCE_SWITCH references to the retained TMUX1112PWR review input without accepting it", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-tmux1112pwr-pw-footprint-evidence"
      )
    ).toMatchObject({
      mappingId: "bp031-tmux1112pwr-pw-footprint-evidence",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25T08:56:12.543Z",
      artifactKind: "bp031-ti-tmux1112pwr-pw-tssop16-footprint-evidence",
      artifactPath: "packages/scoring-circuit/src/bp031-ti-tmux1112pwr-pw-footprint-evidence.tsx",
      baseReference: "U_SOURCE_SWITCH",
      sourceContract: "BP-102",
      manufacturer: "Texas Instruments",
      exactMpn: "TMUX1112PWR",
      exactPackage: "PW TSSOP-16",
      affectedReferences: [
        "U_SOURCE_SWITCH_1",
        "U_SOURCE_SWITCH_2",
        "U_SOURCE_SWITCH_3",
        "U_SOURCE_SWITCH_4",
        "U_SOURCE_SWITCH_5",
        "U_SOURCE_SWITCH_6",
        "U_SOURCE_SWITCH_7"
      ],
      manufacturerDrawingInput: {
        state: "source-controlled-pending-review",
        acquisition: "exact-drawing-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf",
        revision: "C",
        reviewedPages: "3, 33, 41-43",
        sha256: "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D",
        authority: "deny"
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, sha256: null, authority: "deny" },
      renderedArtwork: {
        state: "generated-project-review-only",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: "9ABFB669F4BE57EED397C1AF2B812653D9B56032F492433BFEAF20EF1F959A7B",
        authority: "deny"
      },
      pinOneOrientation: {
        state: "source-controlled-pending-review",
        pin: 1,
        boardCoordinatesMm: { x: -2.9, y: 2.275 },
        boardRotationDegrees: 0,
        orientationVerified: false,
        authority: "deny"
      },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        pinFunctionsReviewed: true,
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: false,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })

    const switchRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "U_SOURCE_SWITCH"
    )
    expect(switchRecords.map((record) => record.reference)).toEqual([
      "U_SOURCE_SWITCH_1",
      "U_SOURCE_SWITCH_2",
      "U_SOURCE_SWITCH_3",
      "U_SOURCE_SWITCH_4",
      "U_SOURCE_SWITCH_5",
      "U_SOURCE_SWITCH_6",
      "U_SOURCE_SWITCH_7"
    ])
    expect(
      switchRecords.every((record) => record.reviewEvidenceMappingId === "bp031-tmux1112pwr-pw-footprint-evidence")
    ).toBe(true)
    expect(switchRecords.every((record) => record.disposition === "DNP-unresolved")).toBe(true)
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
    ],
    [
      "forged TPD4 review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[0], "manufacturerCad", { state: "acquired" })
    ],
    [
      "forged TMUX review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[1], "accepted", { fabricationAuthorized: true })
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
