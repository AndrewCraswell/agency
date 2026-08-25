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
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf"
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
    expect(benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings).toHaveLength(9)
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
        .filter(
          (record) =>
            record.sourceBaseReference !== "U_ESD" &&
            record.sourceBaseReference !== "U_SOURCE_SWITCH" &&
            record.sourceBaseReference !== "U_SAR" &&
            record.sourceBaseReference !== "U_OVP_BUFFER" &&
            record.sourceBaseReference !== "U_REF" &&
            record.sourceBaseReference !== "C_SAR" &&
            record.sourceBaseReference !== "C_REF_IN" &&
            record.sourceBaseReference !== "C_REF_REG_HF" &&
            !["R_ESD", "R_SOURCE_PD", "R_SAR", "R_FAULT_GUARD"].includes(record.sourceBaseReference)
        )
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

  it("maps the seven U_SAR references to the root-reviewed ADS8881 evidence without opening release authority", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-ads8881idgs-dgs-footprint-candidate"
      )
    ).toMatchObject({
      mappingId: "bp031-ads8881idgs-dgs-footprint-candidate",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25T10:18:00.000Z",
      artifactKind: "bp031-ads8881idgs-dgs-footprint-candidate",
      artifactPath: "packages/scoring-circuit/src/bp031-ads8881idgs-dgs-footprint-candidate.tsx",
      baseReference: "U_SAR",
      sourceContract: "BP-101",
      exactMpn: "ADS8881IDGS",
      exactPackage: "DGS VSSOP-10",
      affectedReferences: ["U_SAR_1", "U_SAR_2", "U_SAR_3", "U_SAR_4", "U_SAR_5", "U_SAR_6", "U_SAR_7"],
      manufacturerDrawingInput: {
        state: "source-controlled-pending-review",
        acquisition: "exact-drawing-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf",
        revision: "D",
        reviewedPages: "6-7, 50, 55-57",
        sha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8",
        authority: "deny"
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, sha256: null, authority: "deny" },
      renderedArtwork: {
        state: "generated-project-review-only",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: "7A3D47D9C7F6B7F8BC1C67CB6329B579B21C9353581F510A18888B6A87D19783",
        authority: "deny"
      },
      pinOneOrientation: {
        state: "root-reviewed-manufacturer-drawing-match",
        pin: 1,
        boardCoordinatesMm: { x: -2.2, y: -1 },
        boardRotationDegrees: 0,
        authority: "deny"
      },
      projectGeometry: {
        state: "review-only",
        padCount: 10,
        courtyard: { sourceStatus: "not-published", status: "project-review-input" },
        orientationStatus: "root-reviewed-manufacturer-drawing-match",
        accepted: true,
        fabricationAuthority: "deny"
      },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        pinFunctionsReviewed: true,
        projectGeometryAccepted: true,
        pinOneOrientationAccepted: true,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })

    const adcRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "U_SAR"
    )
    expect(adcRecords.map((record) => record.reference)).toEqual([
      "U_SAR_1",
      "U_SAR_2",
      "U_SAR_3",
      "U_SAR_4",
      "U_SAR_5",
      "U_SAR_6",
      "U_SAR_7"
    ])
    expect(
      adcRecords.every((record) => record.reviewEvidenceMappingId === "bp031-ads8881idgs-dgs-footprint-candidate")
    ).toBe(true)
  })

  it("maps the seven U_OVP_BUFFER references to the root-reviewed ADA4177-1ARZ evidence without opening release authority", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-ada4177-1arz-r8-footprint-evidence"
      )
    ).toMatchObject({
      mappingId: "bp031-ada4177-1arz-r8-footprint-evidence",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25T10:31:00.000Z",
      artifactKind: "bp031-ada4177-1arz-r8-footprint-evidence",
      artifactPath: "packages/scoring-circuit/src/bp031-ada4177-r8-footprint-evidence.tsx",
      baseReference: "U_OVP_BUFFER",
      sourceContract: "BP-103",
      manufacturer: "Analog Devices",
      exactMpn: "ADA4177-1ARZ",
      exactPackage: "R SOIC-8",
      affectedReferences: [
        "U_OVP_BUFFER_1",
        "U_OVP_BUFFER_2",
        "U_OVP_BUFFER_3",
        "U_OVP_BUFFER_4",
        "U_OVP_BUFFER_5",
        "U_OVP_BUFFER_6",
        "U_OVP_BUFFER_7"
      ],
      manufacturerDrawingInputs: {
        state: "source-controlled-pending-review",
        exactSources: [
          expect.objectContaining({
            id: "adi-ada4177-datasheet-rev-e",
            revision: "E",
            artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-ada4177-datasheet-rev-e.pdf",
            sha256: "363C6BB4B4DB88F197F4FB3A0D286CD041FB492B9BFD1900382078B1489078CC"
          }),
          expect.objectContaining({
            id: "adi-r-8-package-outline",
            drawingIdentifier: "012407-A",
            artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-r-8-package-outline.pdf",
            sha256: "83932339A984A08A714727BA5F7F836B6451B9194C3C8DAD160FF4408F28FCAF"
          })
        ],
        authority: "deny"
      },
      familyLandPatternInput: {
        state: "family-reference-only",
        exactAda4177Approval: false,
        authority: "deny"
      },
      manufacturerCad: {
        state: "not-acquired",
        artifactPath: null,
        sha256: null,
        authority: "deny"
      },
      partnerCad: {
        availability: "listed-by-adi-not-retrieved",
        retainedArtifactPath: null,
        sha256: null,
        authority: "deny"
      },
      pinOneOrientation: {
        state: "root-reviewed-r8-drawing-match",
        sourceId: "adi-r-8-package-outline",
        topViewPinOneDatum: "lower-left pin-one identifier",
        projectBoardRotationDegrees: 0,
        projectPinOnePad: { pin: 1, xMm: -1.905, yMm: -2.465 },
        independentOrientationReview: "root-reviewed",
        authority: "deny"
      },
      projectFootprintInput: {
        state: "review-only",
        orientationStatus: "pending-independent-review",
        fabricationAuthority: "deny",
        accepted: false
      },
      renderedArtwork: {
        state: "not-generated",
        artifactPath: null,
        generator: null,
        sha256: null,
        authority: "deny"
      },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        referenceMappingReviewed: true,
        familyLandPatternAcceptedForExactMpn: false,
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: true,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })

    const bufferRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "U_OVP_BUFFER"
    )
    expect(bufferRecords.map((record) => record.reference)).toEqual([
      "U_OVP_BUFFER_1",
      "U_OVP_BUFFER_2",
      "U_OVP_BUFFER_3",
      "U_OVP_BUFFER_4",
      "U_OVP_BUFFER_5",
      "U_OVP_BUFFER_6",
      "U_OVP_BUFFER_7"
    ])
    expect(
      bufferRecords.every((record) => record.reviewEvidenceMappingId === "bp031-ada4177-1arz-r8-footprint-evidence")
    ).toBe(true)
  })

  it("maps the seven U_REF references to the root-reviewed REF5025 D SOIC-8 evidence without opening release authority", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-ref5025aqdrq1-d-soic8-candidate-footprint"
      )
    ).toMatchObject({
      mappingId: "bp031-ref5025aqdrq1-d-soic8-candidate-footprint",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      exactMpn: "REF5025AQDRQ1",
      exactPackage: "D SOIC-8",
      affectedReferences: ["U_REF_1", "U_REF_2", "U_REF_3", "U_REF_4", "U_REF_5", "U_REF_6", "U_REF_7"],
      renderedArtwork: {
        sha256: "BEB1A3CA6092E5488ACB6C0485D5002ED78A666DB043CC5AC7A83B4A7113C375",
        authority: "deny"
      },
      pinOneOrientation: { state: "root-reviewed-manufacturer-drawing-match", authority: "deny" },
      acceptance: {
        projectGeometryAccepted: true,
        pinOneOrientationAccepted: true,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const records = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "U_REF"
    )
    expect(records).toHaveLength(7)
    expect(
      records.every((record) => record.reviewEvidenceMappingId === "bp031-ref5025aqdrq1-d-soic8-candidate-footprint")
    ).toBe(true)
  })

  it("maps the seven C_SAR references to root-reviewed KEMET 0603 evidence without opening release authority", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-kemet-c0603c102j5gactu-project-footprint"
      )
    ).toMatchObject({
      mappingId: "bp031-kemet-c0603c102j5gactu-project-footprint",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      exactMpn: "C0603C102J5GACTU",
      exactPackage: "0603",
      affectedReferences: ["C_SAR_1", "C_SAR_2", "C_SAR_3", "C_SAR_4", "C_SAR_5", "C_SAR_6", "C_SAR_7"],
      renderedArtwork: {
        sha256: "F88A68AD1C2F808FD5CF38F97A26B843BB68FAE50A046250385E2E55A7C2CF84",
        authority: "deny"
      },
      orientation: {
        state: "root-reviewed-non-polar-design-inference",
        polarity: "non-polar",
        authority: "deny"
      },
      acceptance: {
        projectGeometryAccepted: true,
        nonPolarOrientationReviewed: true,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const records = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "C_SAR"
    )
    expect(records).toHaveLength(7)
    expect(
      records.every((record) => record.reviewEvidenceMappingId === "bp031-kemet-c0603c102j5gactu-project-footprint")
    ).toBe(true)
  })

  it("maps the seven C_REF_IN references to root-reviewed TDK 0603 evidence without opening release authority", () => {
    expect(
      benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
        (mapping) => mapping.mappingId === "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint"
      )
    ).toMatchObject({
      mappingId: "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      exactMpn: "CGA3E3X7R1H105K080AB",
      exactPackage: "0603",
      affectedReferences: [
        "C_REF_IN_1",
        "C_REF_IN_2",
        "C_REF_IN_3",
        "C_REF_IN_4",
        "C_REF_IN_5",
        "C_REF_IN_6",
        "C_REF_IN_7"
      ],
      renderedArtwork: {
        sha256: "D1DB1A503674A4E51CFB8E529C93CD02ACF6C30D025C284FD08431E239D945EC",
        authority: "deny"
      },
      orientation: {
        state: "root-reviewed-non-polar",
        polarity: "non-polar",
        pinOne: "not-applicable",
        placementStatus: "not-reviewed",
        authority: "deny"
      },
      acceptance: {
        projectGeometryAccepted: true,
        nonPolarOrientationReviewed: true,
        guaranteedEffectiveCapacitanceAccepted: false,
        cadImportAccepted: false,
        boardPlacementAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const records = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "C_REF_IN"
    )
    expect(records).toHaveLength(7)
    expect(
      records.every((record) => record.reviewEvidenceMappingId === "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint")
    ).toBe(true)
  })

  it("maps the seven C_REF_REG_HF references to reviewed-unapproved KEMET evidence", () => {
    const mapping = benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
      (candidate) => candidate.mappingId === "bp031-032-c0603c104k3ractu-footprint-evidence"
    )
    expect(mapping).toMatchObject({
      mappingId: "bp031-032-c0603c104k3ractu-footprint-evidence",
      reviewState: "reviewed-unapproved",
      reviewer: null,
      reviewedAt: null,
      artifactKind: "bp031-032-c0603c104k3ractu-footprint-evidence",
      artifactPath: "packages/scoring-circuit/src/bp031-032-c0603c104k3ractu-footprint-evidence.tsx",
      workUnit: "BP-031",
      baseReference: "C_REF_REG_HF",
      sourceContract: "BP-101",
      manufacturer: "KEMET",
      exactMpn: "C0603C104K3RACTU",
      exactPackage: "EIA 0603 / IEC 1608",
      affectedReferences: [
        "C_REF_REG_HF_1",
        "C_REF_REG_HF_2",
        "C_REF_REG_HF_3",
        "C_REF_REG_HF_4",
        "C_REF_REG_HF_5",
        "C_REF_REG_HF_6",
        "C_REF_REG_HF_7"
      ],
      manufacturerDrawingInput: {
        state: "source-controlled-pending-review",
        acquisition: "exact-primary-identity-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
        reviewedPages: [1],
        sha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
        authority: "deny"
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      renderedArtwork: {
        state: "generated-project-review-only",
        sha256: "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8",
        authority: "deny"
      },
      orientation: {
        state: "pending-review",
        polarity: "non-polar",
        pinOne: "not-applicable",
        authority: "deny"
      },
      projectGeometry: { state: "review-only", accepted: false, fabricationAuthority: "deny" },
      acceptance: {
        exactIdentityHashBound: true,
        projectGeometryAccepted: false,
        nonPolarOrientationReviewed: false,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const records = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.sourceBaseReference === "C_REF_REG_HF"
    )
    expect(records.map((record) => record.reference)).toEqual([
      "C_REF_REG_HF_1",
      "C_REF_REG_HF_2",
      "C_REF_REG_HF_3",
      "C_REF_REG_HF_4",
      "C_REF_REG_HF_5",
      "C_REF_REG_HF_6",
      "C_REF_REG_HF_7"
    ])
    expect(
      records.every((record) => record.reviewEvidenceMappingId === "bp031-032-c0603c104k3ractu-footprint-evidence")
    ).toBe(true)
    expect(records.every((record) => record.disposition === "DNP-unresolved")).toBe(true)
  })

  it("maps all 28 selected Vishay CRCW references to root-reviewed series geometry without opening release authority", () => {
    const mapping = benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
      (candidate) => candidate.mappingId === "bp031-vishay-crcw-selected-resistor-footprint-evidence"
    )
    expect(mapping).toMatchObject({
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25T11:06:00.000Z",
      artifactKind: "bp031-vishay-crcw-selected-resistor-footprint-evidence",
      artifactPath: "packages/scoring-circuit/src/bp031-vishay-crcw-resistor-footprint-evidence.tsx",
      manufacturer: "Vishay",
      manufacturerSeriesDrawingInput: {
        state: "root-reviewed-series-geometry",
        documentNumber: "20043",
        revision: "17-Mar-2026",
        reviewedPages: "1, 9",
        sha256: "949CC96331F62B1BF8E5CEEA628ADB2D8A58E981D4EF9EA8E77B2C6D530E4E20",
        exactOrderablesNamed: false,
        authority: "deny"
      },
      acceptance: {
        exactSelectionIdentityReviewed: true,
        seriesPackageBindingReviewed: true,
        recommendedReflowGeometryAccepted: true,
        nonPolarOrientationAccepted: true,
        exactOrderableCadAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(
      mapping && "exactSelectedParts" in mapping
        ? mapping.exactSelectedParts.map((part) => part.manufacturerPartNumber)
        : null
    ).toEqual(["CRCW060322R0FKEAHP", "CRCW060320R0FKEAHP", "CRCW0603100KFKEAHP", "CRCW120656K0FKEAHP"])
    const mappedRecords = benchPrototypeAnalogFootprintClosure.records.filter(
      (record) => record.reviewEvidenceMappingId === "bp031-vishay-crcw-selected-resistor-footprint-evidence"
    )
    expect(mappedRecords).toHaveLength(28)
    expect(new Set(mappedRecords.map((record) => record.sourceBaseReference))).toEqual(
      new Set(["R_ESD", "R_SOURCE_PD", "R_SAR", "R_FAULT_GUARD"])
    )
    expect(mappedRecords.every((record) => record.disposition === "DNP-unresolved")).toBe(true)
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
    ],
    [
      "forged ADS8881 review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[2], "projectGeometry", { accepted: false })
    ],
    [
      "forged ADA4177 review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[3], "exactMpn", "ADA4177-2ARUZ")
    ],
    [
      "forged Vishay CRCW review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[4], "reviewedAt", "2026-08-25T00:00:00.000Z")
    ],
    [
      "forged REF5025 review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[5], "exactMpn", "REF5050AQDRQ1")
    ],
    [
      "forged KEMET C_SAR review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[6], "exactMpn", "C0603C102J5RACTU")
    ],
    [
      "forged TDK C_REF_IN review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[7], "exactMpn", "CGA3E3X7R1H105K080AA")
    ],
    [
      "forged KEMET C_REF_REG_HF review mapping",
      (copy: typeof benchPrototypeAnalogFootprintClosure) =>
        Reflect.set(copy.reviewEvidenceMappings[8], "releaseState", "allow")
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
