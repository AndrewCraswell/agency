import { z } from "zod"

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

/** Exactly one row for each of the 36 physical references in the committed experiment circuit. */
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
    "ADA4177-1BRZ",
    "R SOIC-8",
    "protected precision buffer",
    "https://www.analog.com/media/en/technical-documentation/data-sheets/ada4177-1_4177-2_4177-4.pdf"
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
    "C_REF",
    "KEMET",
    "T491A106K010AT",
    "1206 A case",
    "10 uF, 10 V tantalum",
    "https://yageogroup.com/component-documentation/download/specsheet/T491A106K010AT?lang=en"
  ],
  ["C_SAR_AVDD", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_SAR_DVDD", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_MUX", "KEMET", "C0603C104K3RACTU", "0603", "100 nF X7R, 25 V", kemetOneHundredNfEvidence],
  ["C_NEG_FLY", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_NEG_OUT", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_3V3_IN", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
  ["C_3V3_OUT", "Murata", "GRM188R71A105KA12D", "0603", "1 uF X7R, 10 V", murataOneUfEvidence],
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
    dnp: true as const
  })
)

function missingSupport(reference: string, mpn: string, purpose: string, primaryEvidenceUrl: string) {
  return {
    reference,
    mpn,
    package: "0603" as const,
    purpose,
    primaryEvidenceUrl,
    circuitPresent: false as const,
    dnp: true as const
  }
}

/** Exact selections which must be reconciled into the experiment circuit before any layout review. */
export const requiredUnmodeledSupportParts = [
  missingSupport("C_REF_IN", "GRM188R71A105KA12D", "REF5025A-Q1 1 uF input bypass", murataOneUfEvidence),
  missingSupport("C_REF_OUT_HF", "C0603C104K3RACTU", "REF5025A-Q1 100 nF output bypass", kemetOneHundredNfEvidence),
  missingSupport("C_BUFFER_POS", "C0603C104K3RACTU", "ADA4177-1 positive-rail bypass", kemetOneHundredNfEvidence),
  missingSupport("C_BUFFER_NEG", "C0603C104K3RACTU", "ADA4177-1 negative-rail bypass", kemetOneHundredNfEvidence),
  missingSupport("C_NEG_IN", "GRM188R71A105KA12D", "TPS60400 required 1 uF input bypass", murataOneUfEvidence),
  missingSupport(
    "C_ISO_IN",
    "GRM188R71A225KE15D",
    "NXE1 input 2.2 uF characterization candidate",
    "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A225KE15-01.pdf"
  ),
  missingSupport(
    "C_ISO_OUT",
    "GRM188R71A225KE15D",
    "NXE1 output 2.2 uF characterization candidate",
    "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A225KE15-01.pdf"
  )
] as const

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
  circuitPhysicalReferenceCount: 36,
  connectorSafety: {
    circuitGender: "male" as const,
    guarded: { boardMpn: "B2B-PH-K-S(LF)(SN)", mateMpn: "PHR-2", pitchMm: 2, positions: 2 },
    normal: {
      boardDrawingUrl: "https://www.molex.com/en-us/products/part-detail/436500300",
      boardMpn: "43650-0300",
      mateDrawingUrl: "https://www.molex.com/en-us/products/part-detail/436450300",
      mateMpn: "43645-0300",
      orientation: "right-angle" as const,
      pitchMm: 3,
      positions: 3
    },
    physicallyMutuallyIncompatible: true
  },
  supportReconciliation: {
    circuitReconciled: false,
    missingExactParts: requiredUnmodeledSupportParts,
    nxeOptionalEmiFilter: {
      population: "dnp-not-selected" as const,
      reason:
        "No optional NXE external EMI filter receives credit until isolated-harness ripple, startup, leakage, and emissions measurements select a topology without bridging isolation."
    }
  },
  footprintGate:
    "Every reference remains DNP until exact drawing, CAD, artwork, assembly, and independent-review evidence is bound to its MPN and package.",
  equipmentCategories,
  bringUpSteps
} as const

const digestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const timestampSchema = z.string().datetime()
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
    supportCircuitReconciled: z.literal(false)
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
    const capturedAtMs = Date.parse(evidence.capturedAtUtc)
    if (Date.parse(evidence.fixtureInterlock.approvedAtUtc) > capturedAtMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fixture approval must not occur after evidence capture",
        path: ["fixtureInterlock", "approvedAtUtc"]
      })
    }
    evidence.partEvidence.forEach((item, index) => {
      if (Date.parse(item.reviewedAtUtc) > capturedAtMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "part review must not occur after evidence capture",
          path: ["partEvidence", index]
        })
      }
    })

    if (evidence.bringUpResults.length > 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unreconciled support parts prohibit powered or guarded evidence",
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
      const completedAtMs = Date.parse(result.completedAtUtc)
      if (completedAtMs > capturedAtMs) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bring-up step must not occur after evidence capture",
          path: ["bringUpResults", index]
        })
      }
      if (index > 0 && completedAtMs <= Date.parse(evidence.bringUpResults[index - 1].completedAtUtc)) {
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
          Date.parse(item.calibrationValidFromUtc) > completedAtMs ||
          Date.parse(item.calibrationDueUtc) <= completedAtMs
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
        if (Date.parse(evidence.fixtureInterlock.approvedAtUtc) >= Date.parse(result.externalPermit.issuedAtUtc)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "fixture approval must precede the external permit",
            path: ["bringUpResults", index]
          })
        }
        if (Date.parse(result.externalPermit.issuedAtUtc) >= Date.parse(result.completedAtUtc)) {
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
    reviewedBoardId: parsed.boardId,
    state: "deny" as const,
    supportCircuitReconciled: false as const
  }
}
