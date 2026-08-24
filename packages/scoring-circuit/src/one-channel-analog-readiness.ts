import { z } from "zod"
import { parseCanonicalUtcTimestamp } from "./bench-prototype-evidence-time.js"

type PartSeed = readonly [
  reference: string,
  manufacturer: string,
  mpn: string,
  packageName: string,
  valueOrDescription: string,
  primaryEvidenceUrl: string
]

const vishayCrcwEvidence = "https://www.vishay.com/docs/20035/dcrcwe3.pdf"
const murataOneUfEvidence = "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A105KA12-01.pdf"
const kemetOneNfEvidence = "https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en"
const kemetOneHundredNfEvidence =
  "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"
const keystoneTestPointEvidence = "https://www.keyelco.com/product.cfm/product_id/13550"

/** REF5025A-Q1 local output-capacitor limits and selected stabilization part. */
export const ref5025OutputCapacitorRequirement = {
  manufacturerEsrTestCondition: "25 C, 100 kHz",
  reference: "C_REF_REG",
  requiredMaximumCapacitanceUf: 50,
  requiredMaximumEsrOhms: 1.5,
  requiredMinimumCapacitanceUf: 1,
  selectedCapacitanceUf: 10,
  selectedManufacturerMaximumEsrOhms: 0.1,
  selectedMpn: "T521B106M025ATE100"
} as const

/** ADS8881-local reference reservoir and the exact feed-isolation resistor. */
export const ads8881ReferenceNetworkRequirement = {
  capacitor: {
    reference: "C_REF",
    dielectric: "X7R",
    nominalCapacitanceUf: 10,
    package: "0805",
    tolerancePercent: 10,
    selectedMpn: "GRM21BR71A106KE51L"
  },
  feedResistor: {
    allowedMaximumOhms: 0.47,
    allowedMinimumOhms: 0.1,
    reference: "R_REF_SAR",
    selectedOhms: 0.22,
    selectedMpn: "RCWE0603R220FKEA"
  },
  lowerValueParallelCapacitorPermittedAtAdcRef: false
} as const

/** Exactly one row for each physical reference in the committed experiment circuit. */
const physicalPartSeeds = [
  [
    "U_ISO",
    "Murata Power Solutions",
    "NXE1S0505MC",
    "SIP-7",
    "1 W isolated 5 V to 5 V converter",
    "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
  ],
  [
    "U_NEGATIVE_RAIL",
    "Texas Instruments",
    "TPS60400DBVR",
    "DBV SOT-23-5",
    "negative 5 V charge pump",
    "https://www.ti.com/lit/ds/symlink/tps60400.pdf"
  ],
  [
    "U_3V3",
    "Texas Instruments",
    "TPS7A2033PDBVR",
    "DBV SOT-23-5",
    "3.3 V isolated-domain LDO",
    "https://www.ti.com/lit/ds/symlink/tps7a20.pdf"
  ],
  [
    "U_REF",
    "Texas Instruments",
    "REF5025AQDRQ1",
    "D SOIC-8",
    "2.5 V excitation and ADC reference",
    "https://www.ti.com/lit/gpn/REF5025A-Q1"
  ],
  [
    "U_ESD",
    "Texas Instruments",
    "TPD4E05U06DQAR",
    "DQA USON-10",
    "four-channel line shunt",
    "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf"
  ],
  ["R_ESD", "Vishay", "CRCW060322R0FKEAHP", "0603", "22 ohm, 1 percent", vishayCrcwEvidence],
  ["R_FAULT_GUARD", "Vishay", "CRCW120656K0FKEAHP", "1206", "56 kilohm, 1 percent", vishayCrcwEvidence],
  [
    "U_SOURCE_SWITCH",
    "Texas Instruments",
    "TMUX1112PWR",
    "PW TSSOP-16",
    "source-path switch",
    "https://www.ti.com/lit/ds/symlink/tmux1112.pdf"
  ],
  [
    "R_SOURCE",
    "Panasonic",
    "ERA3AEB2491V",
    "0603",
    "2.49 kilohm, 0.1 percent, 25 ppm/C",
    "https://industrial.panasonic.com/ww/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V"
  ],
  ["R_SOURCE_PD", "Vishay", "CRCW0603100KFKEAHP", "0603", "100 kilohm, 1 percent", vishayCrcwEvidence],
  [
    "U_OVP_BUFFER",
    "Analog Devices",
    "ADA4177-1ARZ",
    "R SOIC-8",
    "protected precision buffer",
    "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf"
  ],
  ["R_SAR", "Vishay", "CRCW060320R0FKEAHP", "0603", "20 ohm, 1 percent", vishayCrcwEvidence],
  ["C_SAR", "KEMET", "C0603C102J5GACTU", "0603", "1 nF C0G, 5 percent", kemetOneNfEvidence],
  [
    "U_SAR",
    "Texas Instruments",
    "ADS8881IDGS",
    "DGS VSSOP-10",
    "18-bit 1 MSPS SAR",
    "https://www.ti.com/lit/ds/symlink/ads8881.pdf"
  ],
  [
    "C_REF_REG",
    "KEMET",
    "T521B106M025ATE100",
    "1411 / 3528 B case",
    "10 uF, 25 V polymer tantalum; 100 mOhm maximum ESR at 25 C, 100 kHz",
    "https://search.kemet.com/download/specsheet/T521B106M025ATE100"
  ],
  ["C_REF_IN", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V REF5025A-Q1 input bypass", murataOneUfEvidence],
  [
    "C_REF_REG_HF",
    "KEMET",
    "C0603C104K3RACTU",
    "0603",
    "100 nF X7R, 25 V REF5025A-Q1 local high-frequency output bypass in parallel with C_REF_REG",
    kemetOneHundredNfEvidence
  ],
  [
    "R_REF_SAR",
    "Vishay Dale",
    "RCWE0603R220FKEA",
    "0603",
    "0.22 ohm, 1 percent ADS8881 reference-feed isolation resistor",
    "https://www.vishay.com/docs/20019/rcwe.pdf"
  ],
  [
    "C_REF",
    "Murata",
    "GRM21BR71A106KE51L",
    "0805",
    "10 uF X7R, 10 V, 10 percent ADS8881-local reference reservoir",
    "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf"
  ],
  [
    "C_BUFFER_POS",
    "KEMET",
    "C0603C104K3RACTU",
    "0603",
    "100 nF X7R, 25 V ADA4177-1 positive-rail local bypass",
    kemetOneHundredNfEvidence
  ],
  [
    "C_BUFFER_NEG",
    "KEMET",
    "C0603C104K3RACTU",
    "0603",
    "100 nF X7R, 25 V ADA4177-1 negative-rail local bypass",
    kemetOneHundredNfEvidence
  ],
  ["C_SAR_AVDD", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_SAR_DVDD", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_MUX", "KEMET", "C0603C104K3RACTU", "0603", "100 nF X7R, 25 V", kemetOneHundredNfEvidence],
  ["C_NEG_FLY", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_NEG_IN", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V TPS60400 input bypass", murataOneUfEvidence],
  ["C_NEG_OUT", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_3V3_IN", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_3V3_OUT", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  [
    "C_ISO_IN",
    "Murata",
    "GRM188R71A225KE15D",
    "0603",
    "2.2 uF X7R, 10 V NXE1 input characterization bypass",
    "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A225KE15-01.pdf"
  ],
  [
    "C_ISO_OUT",
    "Murata",
    "GRM188R71A225KE15D",
    "0603",
    "2.2 uF X7R, 10 V NXE1 output characterization bypass",
    "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A225KE15-01.pdf"
  ],
  [
    "J_FIXTURE",
    "Molex",
    "43650-0300",
    "Micro-Fit 3.0, 3-circuit right-angle THT header",
    "shrouded, polarized, locking normal-fixture header; mate 43645-0300",
    "https://www.molex.com/en-us/products/part-detail/436500300"
  ],
  [
    "J_GUARDED_FORCE",
    "JST",
    "B2B-PH-K-S(LF)(SN)",
    "PH, 2-circuit vertical THT",
    "shrouded, polarized, locking guarded-force header; mate PHR-2",
    "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf"
  ],
  [
    "J_UPSTREAM_5V",
    "Samtec",
    "TSW-102-07-G-S",
    "1x02, 2.54 mm THT",
    "isolated-converter input",
    "https://www.samtec.com/products/tsw-102-07-g-s"
  ],
  [
    "J_CONTROL",
    "Samtec",
    "TSW-102-07-G-S",
    "1x02, 2.54 mm THT",
    "source-enable control",
    "https://www.samtec.com/products/tsw-102-07-g-s"
  ],
  [
    "J_ADC_IO",
    "Samtec",
    "TSW-104-07-G-S",
    "1x04, 2.54 mm THT",
    "SPI and conversion I/O",
    "https://www.samtec.com/products/tsw-104-07-g-s"
  ],
  [
    "J_FIXTURE_STATUS",
    "Samtec",
    "TSW-105-07-G-S",
    "1x05, 2.54 mm THT",
    "observed safety status",
    "https://www.samtec.com/products/tsw-105-07-g-s"
  ],
  ["TP_LINE", "Keystone Electronics", "5000", "Keystone 5000 turret", "line probe point", keystoneTestPointEvidence],
  [
    "TP_QUIET",
    "Keystone Electronics",
    "5000",
    "Keystone 5000 turret",
    "quiet-node probe point",
    keystoneTestPointEvidence
  ],
  [
    "TP_BUFFER_IN",
    "Keystone Electronics",
    "5000",
    "Keystone 5000 turret",
    "buffer-input probe point",
    keystoneTestPointEvidence
  ],
  [
    "TP_BUFFER_OUT",
    "Keystone Electronics",
    "5000",
    "Keystone 5000 turret",
    "buffer-output probe point",
    keystoneTestPointEvidence
  ],
  ["TP_AINP", "Keystone Electronics", "5000", "Keystone 5000 turret", "AINP probe point", keystoneTestPointEvidence],
  ["TP_AINN", "Keystone Electronics", "5000", "Keystone 5000 turret", "AINN probe point", keystoneTestPointEvidence],
  [
    "TP_REF",
    "Keystone Electronics",
    "5000",
    "Keystone 5000 turret",
    "reference probe point",
    keystoneTestPointEvidence
  ],
  [
    "TP_S5V_NEG",
    "Keystone Electronics",
    "5000",
    "Keystone 5000 turret",
    "negative-rail probe point",
    keystoneTestPointEvidence
  ]
] as const satisfies readonly PartSeed[]

export const oneChannelAnalogExperimentBom = physicalPartSeeds.map(
  ([reference, manufacturer, mpn, packageName, valueOrDescription, primaryEvidenceUrl]) => ({
    reference,
    manufacturer,
    mpn,
    package: packageName,
    valueOrDescription,
    primaryEvidenceUrl,
    circuitPresent: true as const,
    sourceCircuit: "one-channel-analog-experiment" as const,
    dnp: true as const
  })
)

const mandatorySupportReferences = [
  "C_REF_IN",
  "C_REF_REG_HF",
  "R_REF_SAR",
  "C_BUFFER_POS",
  "C_BUFFER_NEG",
  "C_NEG_IN",
  "C_ISO_IN",
  "C_ISO_OUT"
] as const

/** Mandatory support references are present only in the standalone source circuit. */
export const mandatoryExperimentSupportParts = oneChannelAnalogExperimentBom.filter((part) =>
  (mandatorySupportReferences as readonly string[]).includes(part.reference)
)

const structurallyReconciled =
  mandatoryExperimentSupportParts.length === mandatorySupportReferences.length &&
  mandatoryExperimentSupportParts.every(
    (part) => part.circuitPresent && part.sourceCircuit === "one-channel-analog-experiment"
  )

if (!structurallyReconciled) {
  throw new Error("the standalone experiment source circuit is missing a mandatory support reference")
}

if (
  ref5025OutputCapacitorRequirement.selectedCapacitanceUf <
    ref5025OutputCapacitorRequirement.requiredMinimumCapacitanceUf ||
  ref5025OutputCapacitorRequirement.selectedCapacitanceUf >
    ref5025OutputCapacitorRequirement.requiredMaximumCapacitanceUf ||
  ref5025OutputCapacitorRequirement.selectedManufacturerMaximumEsrOhms >
    ref5025OutputCapacitorRequirement.requiredMaximumEsrOhms
) {
  throw new Error("the selected REF5025A-Q1 output capacitor violates the capacitance or ESR requirement")
}

export const supportCircuitReconciled = true as const

const equipmentCategories = [
  "isolated-supply",
  "dmm",
  "oscilloscope",
  "differential-voltage-probe",
  "isolated-current-probe",
  "resistance-standards",
  "capacitance-bank",
  "temperature-chamber"
] as const

const bringUpSteps = [
  "unpowered-inspection",
  "isolation-and-continuity",
  "isolated-rail-power",
  "reference-verification",
  "normal-fixture-permit",
  "normal-matrix",
  "guarded-fixture-permit",
  "guarded-matrix"
] as const

export const oneChannelAnalogExperimentReadiness = {
  authorization: false,
  fabrication: {
    apparatusBomIncluded: false,
    couponBomReleased: false,
    copperReleased: false,
    fabricationAuthorized: false,
    footprintState: "all-unreleased-dnp" as const
  },
  circuitPhysicalReferenceCount: 43,
  connectorSafety: {
    circuitGender: "male" as const,
    guarded: {
      boardMpn: "B2B-PH-K-S(LF)(SN)",
      mateMpn: "PHR-2",
      pinMap: { 1: "FORCE", 2: "SGND" },
      pitchMm: 2,
      positions: 2
    },
    normal: {
      boardDrawingUrl: "https://www.molex.com/en-us/products/part-detail/436500300",
      boardMpn: "43650-0300",
      mateDrawingUrl: "https://www.molex.com/en-us/products/part-detail/436450300",
      mateMpn: "43645-0300",
      orientation: "right-angle" as const,
      pinMap: { 1: "LINE", 2: "SGND", 3: "ESD_RETURN_RESERVED_NC" },
      pitchMm: 3,
      positions: 3
    },
    normalPin3Disposition:
      "J_FIXTURE pin 3 is reserved and electrically unconnected; no ESD_RETURN net or separate return path is released. U_ESD ground pins 3 and 8 connect to SGND.",
    physicallyMutuallyIncompatible: true
  },
  supportReconciliation: {
    circuitReconciled: supportCircuitReconciled,
    sourceCircuit: "one-channel-analog-experiment" as const,
    supportParts: mandatoryExperimentSupportParts,
    nxeOptionalEmiFilter: {
      population: "dnp-not-selected" as const,
      reason:
        "No optional NXE external EMI filter receives credit until isolated-harness ripple, startup, leakage, and emissions measurements select a topology without bridging isolation."
    }
  },
  poweredTestingAuthorized: false,
  footprintGate:
    "Every reference remains DNP until exact drawing, CAD, artwork, assembly, and independent-review evidence is bound to its MPN and package.",
  equipmentCategories,
  bringUpSteps
} as const

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const timestampSchema = z
  .string()
  .refine((value) => parseCanonicalUtcTimestamp(value) !== null, "timestamps must use canonical UTC milliseconds")

function canonicalUtcMilliseconds(value: string): number {
  const timestamp = parseCanonicalUtcTimestamp(value)
  if (timestamp === null) throw new RangeError("timestamps must use canonical UTC milliseconds")
  return timestamp.getTime()
}
const partIdentitySchema = z
  .object({ mpn: z.string().min(1), package: z.string().min(1), reference: z.string().min(1) })
  .strict()
const partEvidenceSchema = partIdentitySchema
  .extend({
    artworkDigest: digestSchema,
    manufacturerCadDigest: digestSchema,
    manufacturerDrawingDigest: digestSchema,
    passed: z.literal(true),
    reviewedAtUtc: timestampSchema,
    reviewerId: z.string().min(1)
  })
  .strict()
const asBuiltPartSchema = partIdentitySchema.extend({ lotCode: z.string().min(1), quantity: z.literal(1) }).strict()
const equipmentSchema = z
  .object({
    assetId: z.string().min(1),
    calibrationCertificateId: z.string().min(1),
    calibrationDueUtc: timestampSchema,
    calibrationValidFromUtc: timestampSchema,
    category: z.enum(equipmentCategories),
    settingsDigest: digestSchema
  })
  .strict()
const externalPermitSchema = z
  .object({ permitId: z.string().min(1), issuedAtUtc: timestampSchema, fixtureInterlockRevision: z.string().min(1) })
  .strict()
const observationNames = [
  "assembly-inspection-pass",
  "isolation-resistance",
  "positive-rail-voltage",
  "negative-rail-voltage",
  "reference-voltage",
  "normal-fixture-permit",
  "resistance-error",
  "guarded-fixture-permit",
  "guarded-force-current"
] as const
const observationUnits = ["boolean", "ohm", "volt", "ampere"] as const
const numericObservationSchema = z
  .object({
    kind: z.literal("numeric"),
    maximum: z.number().finite(),
    minimum: z.number().finite(),
    name: z.enum(observationNames),
    unit: z.enum(observationUnits),
    value: z.number().finite(),
    withinLimits: z.literal(true)
  })
  .strict()
  .superRefine((observation, context) => {
    if (
      observation.maximum < observation.minimum ||
      observation.value < observation.minimum ||
      observation.value > observation.maximum
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "numeric pass observation is outside its bounds" })
    }
  })
const booleanObservationSchema = z
  .object({
    expected: z.boolean(),
    kind: z.literal("boolean"),
    name: z.enum(observationNames),
    observed: z.boolean(),
    unit: z.literal("boolean"),
    withinLimits: z.literal(true)
  })
  .strict()
  .superRefine((observation, context) => {
    if (observation.observed !== observation.expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "boolean pass observation does not match its requirement"
      })
    }
  })
const observationSchema = z.union([numericObservationSchema, booleanObservationSchema])
const stepObservationRequirements = {
  "unpowered-inspection": [{ expected: true, kind: "boolean", name: "assembly-inspection-pass", unit: "boolean" }],
  "isolation-and-continuity": [
    { kind: "numeric", maximum: 1_000_000_000_000, minimum: 10_000_000, name: "isolation-resistance", unit: "ohm" }
  ],
  "isolated-rail-power": [
    { kind: "numeric", maximum: 5.25, minimum: 4.75, name: "positive-rail-voltage", unit: "volt" },
    { kind: "numeric", maximum: -4.5, minimum: -5.5, name: "negative-rail-voltage", unit: "volt" }
  ],
  "reference-verification": [
    { kind: "numeric", maximum: 2.51, minimum: 2.49, name: "reference-voltage", unit: "volt" }
  ],
  "normal-fixture-permit": [{ expected: true, kind: "boolean", name: "normal-fixture-permit", unit: "boolean" }],
  "normal-matrix": [{ kind: "numeric", maximum: 4.5, minimum: -4.5, name: "resistance-error", unit: "ohm" }],
  "guarded-fixture-permit": [{ expected: true, kind: "boolean", name: "guarded-fixture-permit", unit: "boolean" }],
  "guarded-matrix": [
    { kind: "numeric", maximum: 0.000_432_9, minimum: 0, name: "guarded-force-current", unit: "ampere" }
  ]
} as const
const bringUpResultSchema = z
  .object({
    artifactDigest: digestSchema,
    completedAtUtc: timestampSchema,
    externalPermit: externalPermitSchema.nullable(),
    limitsDigest: digestSchema,
    limitsId: z.string().min(1),
    observations: z.array(observationSchema).min(1),
    order: z.number().int().positive(),
    result: z.literal("pass"),
    resultId: z.string().min(1),
    step: z.enum(bringUpSteps),
    stopFailures: z.array(z.string()).max(0)
  })
  .strict()

const physicalEvidenceSchema = z
  .object({
    asBuiltManifest: z.array(asBuiltPartSchema).length(oneChannelAnalogExperimentBom.length),
    boardId: z.string().min(1),
    bringUpResults: z.array(bringUpResultSchema).min(2).max(bringUpSteps.length),
    capturedAtUtc: timestampSchema,
    equipment: z.array(equipmentSchema).length(equipmentCategories.length),
    fixtureInterlock: z
      .object({
        approvedAtUtc: timestampSchema,
        certificateId: z.string().min(1),
        designDigest: digestSchema,
        revision: z.string().min(1)
      })
      .strict(),
    partEvidence: z.array(partEvidenceSchema).length(oneChannelAnalogExperimentBom.length),
    supportCircuitReconciled: z.literal(supportCircuitReconciled)
  })
  .strict()
  .superRefine((evidence, context) => {
    const expectedParts = new Map<string, (typeof oneChannelAnalogExperimentBom)[number]>(
      oneChannelAnalogExperimentBom.map((part) => [part.reference, part])
    )
    for (const [path, records] of [
      ["partEvidence", evidence.partEvidence],
      ["asBuiltManifest", evidence.asBuiltManifest]
    ] as const) {
      const references = records.map((record) => record.reference)
      if (new Set(references).size !== expectedParts.size) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${path} has missing or duplicate references`,
          path: [path]
        })
      }
      records.forEach((record, index) => {
        const expected = expectedParts.get(record.reference)
        if (expected === undefined || record.mpn !== expected.mpn || record.package !== expected.package) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${path} does not match the exact BOM`,
            path: [path, index]
          })
        }
      })
    }

    const observedEquipment = evidence.equipment.map((item) => item.category)
    if (new Set(observedEquipment).size !== equipmentCategories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "equipment categories must appear exactly once",
        path: ["equipment"]
      })
    }
    if (new Set(evidence.equipment.map((item) => item.assetId)).size !== equipmentCategories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "equipment asset IDs must be unique",
        path: ["equipment"]
      })
    }
    if (new Set(evidence.equipment.map((item) => item.calibrationCertificateId)).size !== equipmentCategories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "calibration certificate IDs must be unique",
        path: ["equipment"]
      })
    }
    const capturedAtMs = canonicalUtcMilliseconds(evidence.capturedAtUtc)
    if (canonicalUtcMilliseconds(evidence.fixtureInterlock.approvedAtUtc) > capturedAtMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fixture approval must not occur after evidence capture",
        path: ["fixtureInterlock", "approvedAtUtc"]
      })
    }
    evidence.partEvidence.forEach((item, index) => {
      if (canonicalUtcMilliseconds(item.reviewedAtUtc) > capturedAtMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "part review must not occur after evidence capture",
          path: ["partEvidence", index]
        })
      }
    })

    if (!oneChannelAnalogExperimentReadiness.poweredTestingAuthorized && evidence.bringUpResults.length > 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unreleased footprint and fixture evidence prohibit powered or guarded evidence",
        path: ["bringUpResults"]
      })
    }

    evidence.bringUpResults.forEach((result, index) => {
      if (result.order !== index + 1 || result.step !== bringUpSteps[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bring-up results must be complete and ordered",
          path: ["bringUpResults", index]
        })
      }
      const completedAtMs = canonicalUtcMilliseconds(result.completedAtUtc)
      if (completedAtMs > capturedAtMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bring-up step must not occur after evidence capture",
          path: ["bringUpResults", index]
        })
      }
      if (index > 0 && completedAtMs <= canonicalUtcMilliseconds(evidence.bringUpResults[index - 1].completedAtUtc)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bring-up timestamps must be strictly ordered",
          path: ["bringUpResults", index]
        })
      }
      if (index >= 2 && result.externalPermit === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "powered evidence requires a prior external permit",
          path: ["bringUpResults", index]
        })
      }
      if (index < 2 && result.externalPermit !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "unpowered steps must not claim a powered external permit",
          path: ["bringUpResults", index]
        })
      }
      const requirements = stepObservationRequirements[result.step]
      if (result.observations.length !== requirements.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "step observations do not match the fixed limit contract",
          path: ["bringUpResults", index, "observations"]
        })
      }
      requirements.forEach((requirement, observationIndex) => {
        const observation = result.observations[observationIndex]
        if (
          observation === undefined ||
          observation.kind !== requirement.kind ||
          observation.name !== requirement.name ||
          observation.unit !== requirement.unit ||
          (requirement.kind === "numeric" &&
            (observation.kind !== "numeric" ||
              observation.minimum !== requirement.minimum ||
              observation.maximum !== requirement.maximum)) ||
          (requirement.kind === "boolean" &&
            (observation.kind !== "boolean" || observation.expected !== requirement.expected))
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "step observation identity, unit, or bounds mismatch",
            path: ["bringUpResults", index, "observations", observationIndex]
          })
        }
      })
      evidence.equipment.forEach((item, equipmentIndex) => {
        if (
          canonicalUtcMilliseconds(item.calibrationValidFromUtc) > completedAtMs ||
          canonicalUtcMilliseconds(item.calibrationDueUtc) <= completedAtMs
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "equipment calibration must be current at every step",
            path: ["equipment", equipmentIndex]
          })
        }
      })
      if (result.externalPermit !== null) {
        if (result.externalPermit.fixtureInterlockRevision !== evidence.fixtureInterlock.revision) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "permit fixture revision mismatch",
            path: ["bringUpResults", index]
          })
        }
        if (
          canonicalUtcMilliseconds(evidence.fixtureInterlock.approvedAtUtc) >=
          canonicalUtcMilliseconds(result.externalPermit.issuedAtUtc)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "fixture approval must precede the external permit",
            path: ["bringUpResults", index]
          })
        }
        if (
          canonicalUtcMilliseconds(result.externalPermit.issuedAtUtc) >= canonicalUtcMilliseconds(result.completedAtUtc)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "external permit must precede powered evidence",
            path: ["bringUpResults", index]
          })
        }
      }
    })
  })

export function assessOneChannelExperimentPhysicalEvidence(evidence: unknown) {
  const parsed = physicalEvidenceSchema.parse(evidence)
  return {
    authorization: false as const,
    evidenceCompleteForReview: false as const,
    fabricationAuthorized: false as const,
    poweredTestingAuthorized: false as const,
    reviewedBoardId: parsed.boardId,
    state: "deny" as const,
    supportCircuitReconciled
  }
}
