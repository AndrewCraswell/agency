/**
 * M4-04 single-channel sensing coupon release boundary.
 *
 * The circuit drawing remains `one-channel-analog-experiment.circuit.tsx`.
 * This compact companion provides the reviewable ERC net list and one
 * drawing-review record for every exact BOM reference. It intentionally does
 * not produce PCB artwork or grant fabrication authority.
 */

import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom, supportCircuitReconciled } from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-04 coupon data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-04 coupon data may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype
    ) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const ercNets = [
  {
    net: "LINE",
    source: "J_FIXTURE.pin1 external fixture",
    sinks: ["U_ESD.pin1", "R_ESD.pin1", "R_FAULT_GUARD.pin2", "TP_LINE"],
    rule: "Connector line remains separated from the quiet acquisition node by R_ESD."
  },
  {
    net: "QUIET",
    source: "R_ESD.pin2",
    sinks: ["U_SOURCE_SWITCH.pin2", "U_OVP_BUFFER.pin3", "TP_QUIET"],
    rule: "The protected line has one named acquisition branch."
  },
  {
    net: "BUFFER_OUTPUT",
    source: "U_OVP_BUFFER.pin6",
    sinks: ["U_OVP_BUFFER.pin2", "R_SAR.pin1", "TP_BUFFER_OUT"],
    rule: "The unity-gain feedback is explicit before the SAR series resistor."
  },
  {
    net: "AINP",
    source: "R_SAR.pin2",
    sinks: ["U_SAR.pin3", "C_SAR.pin1", "TP_AINP"],
    rule: "The SAR input has its defined 20-ohm and 1-nF charge bucket."
  },
  {
    net: "AINN",
    source: "SGND",
    sinks: ["U_SAR.pin4", "TP_AINN"],
    rule: "The differential SAR negative input is explicitly grounded."
  },
  {
    net: "REF_2V5",
    source: "U_REF.pin6",
    sinks: ["R_SOURCE.pin1", "C_REF_REG", "C_REF_REG_HF", "R_REF_SAR.pin1"],
    rule: "The source and converter reference derive from the same reference; R_REF_SAR isolates the converter reservoir."
  },
  {
    net: "SAR_REF",
    source: "R_REF_SAR.pin2",
    sinks: ["U_SAR.pin1", "C_REF", "TP_REF"],
    rule: "The converter-side reservoir is present and separately named."
  },
  {
    net: "SOURCE_PATH",
    source: "R_SOURCE.pin2",
    sinks: ["U_SOURCE_SWITCH.pin3"],
    rule: "The 2.49-kilohm excitation reaches the line only through the selected switch."
  },
  {
    net: "SOURCE_EN",
    source: "J_CONTROL.pin1 external controller",
    sinks: ["U_SOURCE_SWITCH.pin1", "R_SOURCE_PD.pin1"],
    rule: "The source control has a hardware low default."
  },
  {
    net: "FORCE",
    source: "J_GUARDED_FORCE.pin1 interlocked fixture",
    sinks: ["R_FAULT_GUARD.pin1"],
    rule: "Guarded force is isolated by the 56-kilohm source-envelope resistor."
  },
  {
    net: "SYSTEM_5V",
    source: "J_UPSTREAM_5V.pin1 external isolated supply",
    sinks: ["U_ISO.pin1", "C_ISO_IN.pin1"],
    rule: "Coupon power enters through the isolated converter only."
  },
  {
    net: "S5V_ISO",
    source: "U_ISO.pin6",
    sinks: ["U_NEGATIVE_RAIL.pin2", "U_3V3.pin1", "U_REF.pin2", "C_ISO_OUT.pin1"],
    rule: "All analog-domain rails are downstream of the isolated converter."
  },
  {
    net: "S5V_NEG",
    source: "U_NEGATIVE_RAIL.pin1",
    sinks: ["U_OVP_BUFFER.pin4", "C_NEG_OUT.pin1", "C_BUFFER_NEG.pin1", "TP_S5V_NEG"],
    rule: "The buffer negative rail is explicitly decoupled and observable."
  },
  {
    net: "S3V3_ISO",
    source: "U_3V3.pin5",
    sinks: ["U_SOURCE_SWITCH.pin13", "U_SAR.pin2", "U_SAR.pin10", "C_3V3_OUT.pin1"],
    rule: "Switch and SAR supplies share the isolated 3.3-volt rail only."
  },
  {
    net: "SGND",
    source: "U_ISO.pin7",
    sinks: ["J_FIXTURE.pin2", "J_GUARDED_FORCE.pin2", "U_ESD.pin3", "U_ESD.pin8", "U_SAR.pin5"],
    rule: "The reserved fixture pin three is not assigned as a second return."
  },
  {
    net: "SPI",
    source: "J_ADC_IO external host",
    sinks: ["U_SAR.pins6-9"],
    rule: "Only converter digital pins cross the coupon I/O connector."
  }
] as const

type CouponBomPart = (typeof oneChannelAnalogExperimentBom)[number]

type AcquiredDrawing = {
  acquisition: "exact-drawing-hash-bound" | "series-drawing-hash-bound"
  artifactPath: `packages/scoring-circuit/docs/evidence/m4-04/${string}`
  drawingIdentifier: string
  drawingUrl: string
  geometry: null
  byteMarkers: readonly string[]
  scope: string
  sha256: string
}

const acquiredDrawingEvidenceByMpn: Readonly<Record<string, AcquiredDrawing>> = {
  ADS8881IDGS: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-ads8881-dgs-datasheet.pdf",
    drawingIdentifier: "TI SBAS547D, revision D, DGS0010A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    geometry: null,
    byteMarkers: ["ADS8881IDGS", "DGS0010A", "VSSOP"],
    scope:
      "Texas Instruments ADS8881 datasheet. The orderable table names the exact ADS8881IDGS MPN and DGS package; the mechanical section contains the manufacturer DGS0010A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8"
  },
  REF5025AQDRQ1: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-ref5025a-q1-datasheet.pdf",
    drawingIdentifier: "TI SBOS456H, revision H, D0008A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/gpn/REF5025A-Q1",
    geometry: null,
    byteMarkers: ["REF5025AQDRQ1", "D0008A", "SOIC"],
    scope:
      "Texas Instruments REF50xxA-Q1 datasheet. The orderable table names the exact REF5025AQDRQ1 MPN and D SOIC-8 package; the mechanical section contains the manufacturer D0008A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B"
  },
  TPS60400DBVR: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf",
    drawingIdentifier: "TI SLVS324C, revision C, DBV0005A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/ds/symlink/tps60400.pdf",
    geometry: null,
    byteMarkers: ["TPS60400DBVR", "DBV0005A", "SOT-23"],
    scope:
      "Texas Instruments TPS60400 datasheet. The orderable table names the exact TPS60400DBVR MPN and DBV SOT-23-5 package; the mechanical section contains the manufacturer DBV0005A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347"
  },
  TPS7A2033PDBVR: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf",
    drawingIdentifier: "TI SBVS338H, revision H, DBV0005A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/ds/symlink/tps7a20.pdf",
    geometry: null,
    byteMarkers: ["TPS7A2033PDBVR", "DBV0005A", "SOT-23"],
    scope:
      "Texas Instruments TPS7A20 datasheet. The orderable table names the exact TPS7A2033PDBVR MPN and DBV SOT-23-5 package; the mechanical section contains the manufacturer DBV0005A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1"
  },
  TMUX1112PWR: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tmux1112-pwr-datasheet.pdf",
    drawingIdentifier: "TI SCDS408C, revision C, PW0016A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
    geometry: null,
    byteMarkers: ["TMUX1112PWR", "PW0016A", "TSSOP"],
    scope:
      "Texas Instruments TMUX1112 datasheet. The orderable table names the exact TMUX1112PWR MPN and PW TSSOP-16 package; the mechanical section contains the manufacturer PW0016A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D"
  },
  TPD4E05U06DQAR: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tpd4e05u06-dqar-datasheet.pdf",
    drawingIdentifier: "TI SLVSBO7O, revision O, DQA0010A mechanical drawing",
    drawingUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
    geometry: null,
    byteMarkers: ["TPD4E05U06DQAR", "DQA", "USON"],
    scope:
      "Texas Instruments TPD4E05U06 datasheet. The orderable table names the exact TPD4E05U06DQAR MPN and DQA USON-10 package; the mechanical section contains the manufacturer DQA0010A package drawing. No project land pattern or geometry is inferred from this source.",
    sha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6"
  },
  C0603C102J5GACTU: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c102j5gactu-datasheet.pdf",
    drawingIdentifier: "YAGEO SMD Comm C0G, 0603/1608 manufacturer dimensions",
    drawingUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en",
    geometry: null,
    byteMarkers: ["C0603C102J5GACTU", "0603", "1.6"],
    scope:
      "YAGEO/KEMET product specsheet. The exact C0603C102J5GACTU MPN, 0603/1608 case, and manufacturer dimensions are present in the retained source. No project land pattern or geometry is inferred from this source.",
    sha256: "B62452DE5A68C2E26AE145A4F4F4DF1D989AA5482AF4746C93A86155D5910221"
  },
  C0603C104K3RACTU: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
    drawingIdentifier: "YAGEO SMD Comm X7R, 0603/1608 manufacturer dimensions",
    drawingUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en",
    geometry: null,
    byteMarkers: ["C0603C104K3RACTU", "0603", "1.6"],
    scope:
      "YAGEO/KEMET product specsheet. The exact C0603C104K3RACTU MPN, 0603/1608 case, and manufacturer dimensions are present in the retained source. No project land pattern or geometry is inferred from this source.",
    sha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064"
  },
  T521B106M025ATE100: {
    acquisition: "exact-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
    drawingIdentifier: "KEMET T521, 1411/3528 manufacturer dimensions",
    drawingUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
    geometry: null,
    byteMarkers: ["T521B106M025ATE100"],
    scope:
      "KEMET product specsheet. The exact T521B106M025ATE100 MPN and 1411/3528 B-case package are named in the retained manufacturer source. No project land pattern or geometry is inferred from this source.",
    sha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD"
  }
}

const acquiredSeriesDrawingEvidenceByMpn: Readonly<
  Record<
    string,
    {
      acquisition: "series-drawing-hash-bound"
      artifactPath: `packages/scoring-circuit/docs/evidence/m4-04/${string}`
      drawingIdentifier: string
      drawingUrl: string
      geometry: null
      byteMarkers: readonly string[]
      scope: string
      sha256: string
    }
  >
> = {
  "B2B-PH-K-S(LF)(SN)": {
    acquisition: "series-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/jst-ph-series-datasheet.pdf",
    drawingIdentifier: "JST ePH, PH series header layout, manufacturer dimensions",
    drawingUrl: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf",
    geometry: null,
    byteMarkers: ["PH", "B2B"],
    scope:
      "JST PH-series manufacturer source. The retained source covers the B2B-PH-K-S(LF)(SN) two-circuit header family and its 2.00 mm pitch and board-layout guidance, but it does not prove the exact suffix or grant a project land pattern. No project geometry or footprint authority is inferred.",
    sha256: "447624F4F2F7D37C58C1EAA7EE314AD757FE7AFF48F6186491EF6F69FBC00B96"
  },
  CRCW0603100KFKEAHP: {
    acquisition: "series-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
    drawingIdentifier: "Vishay D/CRCW e3, revision 14-Apr-2026, document 20035, D11/CRCW0603e3 series drawing",
    drawingUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    geometry: null,
    byteMarkers: ["D/CRCW e3", "D11/CRCW0603", "D25/CRCW1206", "0603", "1206", "20035"],
    scope:
      "Vishay D/CRCW e3 series datasheet. The retained source verifies the 0603 and 1206 package families and manufacturer dimensions, but it does not name this exact CRCW orderable MPN; no exact-MPN drawing identity or project geometry is inferred.",
    sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
  },
  CRCW060320R0FKEAHP: {
    acquisition: "series-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
    drawingIdentifier: "Vishay D/CRCW e3, revision 14-Apr-2026, document 20035, D11/CRCW0603e3 series drawing",
    drawingUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    geometry: null,
    byteMarkers: ["D/CRCW e3", "D11/CRCW0603", "D25/CRCW1206", "0603", "1206", "20035"],
    scope:
      "Vishay D/CRCW e3 series datasheet. The retained source verifies the 0603 and 1206 package families and manufacturer dimensions, but it does not name this exact CRCW orderable MPN; no exact-MPN drawing identity or project geometry is inferred.",
    sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
  },
  CRCW060322R0FKEAHP: {
    acquisition: "series-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
    drawingIdentifier: "Vishay D/CRCW e3, revision 14-Apr-2026, document 20035, D11/CRCW0603e3 series drawing",
    drawingUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    geometry: null,
    byteMarkers: ["D/CRCW e3", "D11/CRCW0603", "D25/CRCW1206", "0603", "1206", "20035"],
    scope:
      "Vishay D/CRCW e3 series datasheet. The retained source verifies the 0603 and 1206 package families and manufacturer dimensions, but it does not name this exact CRCW orderable MPN; no exact-MPN drawing identity or project geometry is inferred.",
    sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
  },
  CRCW120656K0FKEAHP: {
    acquisition: "series-drawing-hash-bound",
    artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
    drawingIdentifier: "Vishay D/CRCW e3, revision 14-Apr-2026, document 20035, D25/CRCW1206e3 series drawing",
    drawingUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    geometry: null,
    byteMarkers: ["D/CRCW e3", "D11/CRCW0603", "D25/CRCW1206", "0603", "1206", "20035"],
    scope:
      "Vishay D/CRCW e3 series datasheet. The retained source verifies the 0603 and 1206 package families and manufacturer dimensions, but it does not name this exact CRCW orderable MPN; no exact-MPN drawing identity or project geometry is inferred.",
    sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
  }
}

function drawingEvidenceFor(part: CouponBomPart) {
  const acquiredDrawing = acquiredDrawingEvidenceByMpn[part.mpn]
  if (acquiredDrawing !== undefined) {
    return { ...acquiredDrawing, byteMarkers: [...acquiredDrawing.byteMarkers] }
  }
  const acquiredSeriesDrawing = acquiredSeriesDrawingEvidenceByMpn[part.mpn]
  if (acquiredSeriesDrawing !== undefined) {
    return { ...acquiredSeriesDrawing, byteMarkers: [...acquiredSeriesDrawing.byteMarkers] }
  }
  if (part.mpn === "43650-0300") {
    return {
      acquisition: "series-drawing-identified-not-hash-acquired" as const,
      artifactPath: null,
      drawingUrl:
        "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43650/436500400_sd.pdf",
      drawingIdentifier: "SD-43650-001, revision D8",
      scope:
        "Manufacturer 43650-series right-angle Micro-Fit drawing lead only. The exact drawing bytes have not been acquired or hashed; root review must still confirm its 0300 circuit count and orientation before accepting a footprint.",
      geometry:
        "Three 1.02 mm plus or minus 0.05 mm component-side layout holes on a 3.00 mm pitch, 1.57 mm recommended board thickness, circuit-one marking, and 10.16 mm maximum board-edge placement.",
      byteMarkers: [],
      sha256: null
    }
  }
  return {
    acquisition: "not-acquired" as const,
    artifactPath: null,
    drawingUrl: null,
    drawingIdentifier: null,
    byteMarkers: [],
    scope:
      "No exact drawing bytes or revision have been acquired for this MPN; the manufacturer-primary technical link is discovery evidence only.",
    geometry: null,
    sha256: null
  }
}

function footprintEvidenceFor(part: CouponBomPart) {
  const manufacturerDrawing = drawingEvidenceFor(part)
  return {
    exactMpn: part.mpn,
    manufacturerPrimaryDocument: {
      url: part.primaryEvidenceUrl,
      scope:
        "Bound only to this exact MPN record. A shared package family must receive its own record and cannot inherit this review.",
      status:
        manufacturerDrawing.acquisition === "exact-drawing-hash-bound"
          ? ("hash-bound" as const)
          : manufacturerDrawing.acquisition === "series-drawing-hash-bound"
            ? ("series-hash-bound" as const)
            : ("identified-not-hash-acquired" as const)
    },
    manufacturerDrawing,
    manufacturerCad: {
      availability: "not-verified" as const,
      sourceUrl: null,
      artifactPath: null,
      sha256: null,
      status: "not-acquired" as const
    },
    reviewArtwork: {
      sourceFile: "src/one-channel-analog-experiment.circuit.tsx",
      status: "schematic-reference-only" as const,
      artifactPath: null,
      sha256: null,
      overlayStatus: "not-generated" as const
    }
  }
}

const footprintReviews = oneChannelAnalogExperimentBom.map((part) => ({
  reference: part.reference,
  manufacturer: part.manufacturer,
  exactMpn: part.mpn,
  package: part.package,
  evidence: footprintEvidenceFor(part),
  implementationEvidence: {
    reviewerId: "m4-04-implementation-agent",
    status: "bom-and-schematic-identity-reconciled" as const,
    scope: "Exact reference, MPN, package, and named footprint family are reconciled to the coupon BOM."
  },
  independentDrawingReview: {
    reviewerId: "root-final-reviewer",
    status: "pending" as const,
    required:
      "Acquire the exact manufacturer package drawing and CAD or record an explicit source absence; compare pad, pin-one or polarity, courtyard, and assembly orientation against generated artwork."
  },
  footprintRelease: "deny" as const
}))

const definition = {
  artifactKind: "m4-04-single-channel-sensing-coupon",
  workUnit: "M4-04",
  schematic: {
    sourceFile: "src/one-channel-analog-experiment.circuit.tsx",
    sourceModel: "src/one-channel-analog-experiment.ts",
    title: "One-channel protected analog experiment",
    sourcePath: "REF5025AQDRQ1 -> ERA3AEB2491V -> TMUX1112PWR -> LINE",
    acquisitionPath: "LINE -> TPD4E05U06DQAR / 22 ohm -> ADA4177-1BRZ -> 20 ohm / 1 nF -> ADS8881IDGS",
    normalPower:
      "USB-C PD remains the apparatus normal input; this isolated coupon accepts no USB-C, VBUS, CC, or PD controller connection."
  },
  erc: {
    engine: "source-bound static net ERC",
    status: "pass" as const,
    checks: ercNets,
    excluded:
      "No electrical-rule check substitutes for a tscircuit renderer result, a physical short/open inspection, or an energized test."
  },
  footprints: footprintReviews,
  authority: {
    schematicIntegrationAuthorized: false,
    footprintsIndependentlyReviewed: false,
    copperArtworkReleased: false,
    fabricationAuthorized: false,
    energizedTestAuthorized: false,
    scoringAuthority: false,
    releaseState: "deny" as const
  },
  blockers: [
    "Every reference needs an exact manufacturer drawing and CAD-or-absence record plus a root independent drawing review.",
    "Generated footprint artwork, overlay evidence, and assembly orientation remain unreviewed.",
    "The tscircuit renderer test for the existing coupon timed out in this environment; this static ERC is not evidence that renderer or generated board output is healthy.",
    "M4-06 owns any fabrication package and M4-07 onward own physical inspection and powered evidence."
  ],
  upstream: {
    m402: "candidate clamp and rail-protection boundary",
    m403: "source/sink, reference, ADC, and calibration error ledger",
    couponModel: structuredClone(oneChannelAnalogExperiment),
    bom: structuredClone(oneChannelAnalogExperimentBom),
    supportCircuitReconciled
  }
} as const

export const M404_SINGLE_CHANNEL_COUPON = deepFreeze(definition)

/** Reject topology drift, missing review records, and all authority escalation. */
export function validateM404SingleChannelCoupon(value: unknown): true {
  if (!sameDataGraph(value, M404_SINGLE_CHANNEL_COUPON)) {
    throw new RangeError("M4-04 coupon must exactly match the source-bound schematic and review queue")
  }
  const coupon = M404_SINGLE_CHANNEL_COUPON
  const referenceSet = new Set(coupon.footprints.map((footprint) => footprint.reference))
  const mpnSourceRecords = new Map<string, string>()
  for (const footprint of coupon.footprints) {
    const existingSourceUrl = mpnSourceRecords.get(footprint.exactMpn)
    if (existingSourceUrl === undefined) {
      mpnSourceRecords.set(footprint.exactMpn, footprint.evidence.manufacturerPrimaryDocument.url)
    } else if (existingSourceUrl !== footprint.evidence.manufacturerPrimaryDocument.url) {
      throw new RangeError("M4-04 exact MPN source records must not drift between repeated references")
    }
  }
  if (
    coupon.workUnit !== "M4-04" ||
    coupon.erc.status !== "pass" ||
    coupon.erc.checks.length !== ercNets.length ||
    coupon.erc.checks.some((check) => check.source.trim() === "" || check.rule.trim() === "") ||
    referenceSet.size !== coupon.footprints.length ||
    coupon.footprints.length !== oneChannelAnalogExperimentBom.length ||
    coupon.footprints.some(
      (footprint) =>
        footprint.exactMpn.trim() === "" ||
        footprint.package.trim() === "" ||
        footprint.evidence.exactMpn !== footprint.exactMpn ||
        !footprint.evidence.manufacturerPrimaryDocument.url.startsWith("https://") ||
        footprint.evidence.manufacturerPrimaryDocument.status !==
          (footprint.evidence.manufacturerDrawing.acquisition === "exact-drawing-hash-bound"
            ? "hash-bound"
            : footprint.evidence.manufacturerDrawing.acquisition === "series-drawing-hash-bound"
              ? "series-hash-bound"
              : "identified-not-hash-acquired") ||
        ((footprint.evidence.manufacturerDrawing.acquisition === "exact-drawing-hash-bound" ||
          footprint.evidence.manufacturerDrawing.acquisition === "series-drawing-hash-bound") &&
          (!footprint.evidence.manufacturerDrawing.drawingUrl.startsWith("https://") ||
            footprint.evidence.manufacturerDrawing.drawingIdentifier.trim() === "" ||
            footprint.evidence.manufacturerDrawing.artifactPath === null ||
            !footprint.evidence.manufacturerDrawing.artifactPath.startsWith(
              "packages/scoring-circuit/docs/evidence/m4-04/"
            ) ||
            !/^[0-9A-F]{64}$/u.test(footprint.evidence.manufacturerDrawing.sha256 ?? "") ||
            footprint.evidence.manufacturerDrawing.geometry !== null ||
            footprint.evidence.manufacturerDrawing.byteMarkers.length === 0)) ||
        (footprint.evidence.manufacturerDrawing.acquisition !== "exact-drawing-hash-bound" &&
          footprint.evidence.manufacturerDrawing.acquisition !== "series-drawing-hash-bound" &&
          (footprint.exactMpn === "43650-0300"
            ? footprint.evidence.manufacturerDrawing.acquisition !== "series-drawing-identified-not-hash-acquired" ||
              footprint.evidence.manufacturerDrawing.drawingIdentifier !== "SD-43650-001, revision D8" ||
              footprint.evidence.manufacturerDrawing.geometry === null
            : footprint.evidence.manufacturerDrawing.acquisition !== "not-acquired" ||
              footprint.evidence.manufacturerDrawing.drawingUrl !== null ||
              footprint.evidence.manufacturerDrawing.geometry !== null)) ||
        footprint.evidence.manufacturerCad.status !== "not-acquired" ||
        footprint.evidence.manufacturerCad.availability !== "not-verified" ||
        footprint.evidence.reviewArtwork.status !== "schematic-reference-only" ||
        footprint.evidence.reviewArtwork.overlayStatus !== "not-generated" ||
        footprint.implementationEvidence.status !== "bom-and-schematic-identity-reconciled" ||
        footprint.independentDrawingReview.reviewerId !== "root-final-reviewer" ||
        footprint.independentDrawingReview.status !== "pending" ||
        footprint.footprintRelease !== "deny"
    ) ||
    !coupon.upstream.supportCircuitReconciled ||
    coupon.authority.schematicIntegrationAuthorized ||
    coupon.authority.footprintsIndependentlyReviewed ||
    coupon.authority.copperArtworkReleased ||
    coupon.authority.fabricationAuthorized ||
    coupon.authority.energizedTestAuthorized ||
    coupon.authority.scoringAuthority ||
    coupon.authority.releaseState !== "deny"
  ) {
    throw new RangeError("M4-04 coupon must retain complete review evidence and denied physical authority")
  }
  return true
}

validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)
