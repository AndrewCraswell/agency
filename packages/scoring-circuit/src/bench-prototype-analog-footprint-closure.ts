/**
 * BP-031: lane-B analog, protection, reference, and weapon-fixture footprint
 * evidence ledger.
 *
 * This contract freezes source-backed identities and the complete set of
 * repeated cell references. It deliberately does not manufacture land,
 * courtyard, paste, mask, or orientation geometry. Every record remains
 * denied until independent drawing, CAD, artwork, and assembly evidence is
 * archived and reviewed.
 */

import {
  benchPrototypeFixtureHarness,
  validateBenchPrototypeFixtureHarness
} from "./bench-prototype-fixture-harness.js"
import {
  benchPrototypeFootprintReviewTemplate,
  validateBenchPrototypeFootprintReview
} from "./bench-prototype-footprint-review.js"
import {
  benchPrototypeSevenChannelAnalog,
  validateBenchPrototypeSevenChannelAnalog
} from "./bench-prototype-seven-channel-analog.js"
import { findFootprintReleaseEvidence } from "./footprint-release-evidence.js"
import { M404_SINGLE_CHANNEL_COUPON, validateM404SingleChannelCoupon } from "./m4-04-single-channel-coupon.js"
import { manufacturerFootprintEligibility } from "./manufacturer-footprint-adapter.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

type FootprintSourceEvidence = {
  readonly state: "not-acquired"
  readonly url: null
  readonly revision: null
  readonly sha256: null
}

type FootprintArtworkEvidence = {
  readonly state: "not-generated"
  readonly artifactPath: null
  readonly generator: null
  readonly sha256: null
}

type FootprintOrientationEvidence = {
  readonly state: "unreviewed"
  readonly assemblyRotationDeg: null
  readonly datum: null
  readonly notes: null
}

type SourcePart = (typeof oneChannelAnalogExperimentBom)[number]

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
  if (seen.has(value)) throw new RangeError("BP-031 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-031 may contain only enumerable data properties")
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

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (
      !Array.isArray(actual) ||
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype ||
      actual.length !== expected.length
    ) {
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
    return expected.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable &&
        sameDataGraph(descriptor.value, entry, seen)
      )
    })
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
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
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const cellReferenceBindings = [
  { key: "esd", baseReference: "U_ESD", role: "connector-side ESD shunt" },
  { key: "series", baseReference: "R_ESD", role: "normal-path protection series resistor" },
  { key: "switch", baseReference: "U_SOURCE_SWITCH", role: "source and sink analog switch" },
  { key: "source", baseReference: "R_SOURCE", role: "reference excitation series resistor" },
  { key: "sourcePullDown", baseReference: "R_SOURCE_PD", role: "source-enable safe-state pull-down" },
  { key: "buffer", baseReference: "U_OVP_BUFFER", role: "over-voltage-tolerant unity buffer" },
  { key: "sarSeries", baseReference: "R_SAR", role: "SAR input isolation resistor" },
  { key: "sarCap", baseReference: "C_SAR", role: "SAR input charge-bucket capacitor" },
  { key: "adc", baseReference: "U_SAR", role: "18-bit SAR converter" },
  { key: "reference", baseReference: "U_REF", role: "2.5 V reference" },
  { key: "referenceInputBypass", baseReference: "C_REF_IN", role: "reference input bypass" },
  { key: "referenceRegulatorOutput", baseReference: "C_REF_REG", role: "reference output reservoir" },
  { key: "referenceRegulatorHighFrequency", baseReference: "C_REF_REG_HF", role: "reference high-frequency bypass" },
  { key: "referenceFeed", baseReference: "R_REF_SAR", role: "SAR reference-feed isolation resistor" },
  { key: "referenceReservoir", baseReference: "C_REF", role: "SAR reference reservoir" },
  { key: "guard", baseReference: "R_FAULT_GUARD", role: "externally interlocked guarded-force resistor" }
] as const

type CellReferenceKey = (typeof cellReferenceBindings)[number]["key"]

const expectedReplicatedCellCount = 7
const expectedCellReferenceCount = 16
const expectedReplicatedCellRecordCount = expectedReplicatedCellCount * expectedCellReferenceCount
const expectedConnectorRecordCount = 1
const expectedTotalRecordCount = expectedReplicatedCellRecordCount + expectedConnectorRecordCount
const expectedSharedManufacturerSourceCount = 13
const expectedSharedSourceLinkedRecordCount = expectedReplicatedCellCount * expectedSharedManufacturerSourceCount
const expectedSharedSourceUnresolvedRecordCount =
  expectedReplicatedCellRecordCount - expectedSharedSourceLinkedRecordCount

function findUniqueSourcePart(reference: string): SourcePart {
  const matches = oneChannelAnalogExperimentBom.filter((part) => part.reference === reference)
  if (matches.length !== 1 || matches[0] === undefined) {
    throw new RangeError(`BP-031 requires exactly one source-backed part row for ${reference}`)
  }
  return matches[0]
}

function emptySourceEvidence(): FootprintSourceEvidence {
  return { state: "not-acquired", url: null, revision: null, sha256: null }
}

function emptyArtworkEvidence(): FootprintArtworkEvidence {
  return { state: "not-generated", artifactPath: null, generator: null, sha256: null }
}

function emptyOrientationEvidence(): FootprintOrientationEvidence {
  return { state: "unreviewed", assemblyRotationDeg: null, datum: null, notes: null }
}

function existingFootprintEvidence(mpn: string) {
  const eligibility = manufacturerFootprintEligibility(mpn)
  const ledger = findFootprintReleaseEvidence(mpn)
  return {
    eligibleForPcb: false as const,
    reviewGeometryStatus: eligibility.reviewGeometryStatus,
    missingReleaseData: [...eligibility.missingReleaseData],
    existingLedgerLibrary: ledger?.library ?? "unresolved",
    existingLedgerReleaseState: ledger?.releaseState ?? "deny",
    existingGateReferences: [...(ledger?.gateReferences ?? [])]
  }
}

function sharedManufacturerSourcesFor(parts: readonly SourcePart[]) {
  return parts.flatMap((part) => {
    const m404Footprint = M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === part.mpn)
    if (
      m404Footprint === undefined ||
      m404Footprint.manufacturer !== part.manufacturer ||
      m404Footprint.package !== part.package ||
      m404Footprint.evidence.exactMpn !== part.mpn ||
      m404Footprint.evidence.manufacturerPrimaryDocument.url !== part.primaryEvidenceUrl ||
      (m404Footprint.evidence.manufacturerPrimaryDocument.status !== "hash-bound" &&
        m404Footprint.evidence.manufacturerPrimaryDocument.status !== "series-hash-bound") ||
      (m404Footprint.evidence.manufacturerDrawing.acquisition !== "exact-drawing-hash-bound" &&
        m404Footprint.evidence.manufacturerDrawing.acquisition !== "series-drawing-hash-bound") ||
      m404Footprint.evidence.manufacturerDrawing.artifactPath === null ||
      m404Footprint.evidence.manufacturerDrawing.drawingUrl === null ||
      m404Footprint.evidence.manufacturerDrawing.sha256 === null
    ) {
      return []
    }

    return [
      {
        sourceId: `M4-04:${part.mpn}`,
        sourceWorkUnit: "M4-04" as const,
        exactMpn: part.mpn,
        manufacturer: part.manufacturer,
        package: part.package,
        primaryEvidenceUrl: part.primaryEvidenceUrl,
        sourceStatus: m404Footprint.evidence.manufacturerPrimaryDocument.status,
        acquisition: m404Footprint.evidence.manufacturerDrawing.acquisition,
        artifactPath: m404Footprint.evidence.manufacturerDrawing.artifactPath,
        drawingIdentifier: m404Footprint.evidence.manufacturerDrawing.drawingIdentifier,
        drawingUrl: m404Footprint.evidence.manufacturerDrawing.drawingUrl,
        sha256: m404Footprint.evidence.manufacturerDrawing.sha256,
        geometry: null,
        reviewStatus: "not-reviewed-for-bp-031" as const,
        scope:
          "Imported source identity only. BP-031 has not reviewed the source against project artwork, CAD, orientation, assembly, schematic integration, or fabrication acceptance."
      }
    ]
  })
}

const sourceParts = cellReferenceBindings.map((binding) => findUniqueSourcePart(binding.baseReference))
const sharedManufacturerSources = sharedManufacturerSourcesFor(sourceParts)
const sharedManufacturerSourceByMpn = new Map(
  sharedManufacturerSources.map((source) => [source.exactMpn, source] as const)
)

function sourceContractFor(reference: string): "BP-101" | "BP-102" {
  if (["U_REF", "C_REF_IN", "C_REF_REG", "C_REF_REG_HF", "R_REF_SAR", "C_REF", "U_SAR"].includes(reference)) {
    return "BP-101"
  }
  return "BP-102"
}

function createCellRecord(
  channelIndex: number,
  conductor: string,
  connectorNet: string,
  binding: (typeof cellReferenceBindings)[number],
  reference: string
) {
  const sourcePart = findUniqueSourcePart(binding.baseReference)
  return {
    reference,
    sourceContract: "BP-103" as const,
    sourceBaseReference: binding.baseReference,
    sourceSubcontract: sourceContractFor(binding.baseReference),
    channelIndex,
    conductor,
    connectorNet,
    role: binding.role,
    manufacturer: sourcePart.manufacturer,
    exactMpn: sourcePart.mpn,
    exactPackage: sourcePart.package,
    primaryEvidenceUrl: sourcePart.primaryEvidenceUrl,
    sharedManufacturerSourceId: sharedManufacturerSourceByMpn.get(sourcePart.mpn)?.sourceId ?? null,
    manufacturerDrawing: emptySourceEvidence(),
    manufacturerCad: emptySourceEvidence(),
    artwork: emptyArtworkEvidence(),
    orientation: emptyOrientationEvidence(),
    existingFootprintEvidence: existingFootprintEvidence(sourcePart.mpn),
    disposition: "DNP-unresolved" as const,
    findings: [
      "Exact identity is source-backed, but no exact manufacturer drawing, CAD, generated artwork, or independently reviewed orientation evidence is archived."
    ]
  }
}

function createConnectorRecord() {
  const header = benchPrototypeFixtureHarness.connector.header
  return {
    reference: benchPrototypeFixtureHarness.connector.boardReference,
    sourceContract: "BP-104" as const,
    sourceBaseReference: "J_WEAPON_FIXTURE",
    sourceSubcontract: "BP-104" as const,
    channelIndex: null,
    conductor: null,
    connectorNet: null,
    role: "12-position weapon and piste fixture board header",
    manufacturer: header.manufacturer,
    exactMpn: header.mpn,
    exactPackage: header.family,
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/43045-1200",
    manufacturerDrawing: emptySourceEvidence(),
    manufacturerCad: emptySourceEvidence(),
    artwork: emptyArtworkEvidence(),
    orientation: emptyOrientationEvidence(),
    existingFootprintEvidence: existingFootprintEvidence(header.mpn),
    disposition: "DNP-unresolved" as const,
    findings: [
      "The exact polarized 43045-1200 header is selected by BP-104, but its drawing, CAD, generated artwork, circuit-1 orientation, edge clearance, and mating envelope still require independent review."
    ]
  }
}

const records = benchPrototypeSevenChannelAnalog.channels.flatMap((channel) =>
  cellReferenceBindings.map((binding) =>
    createCellRecord(
      channel.chainIndex,
      channel.conductor,
      channel.connectorNet,
      binding,
      channel.references[binding.key as CellReferenceKey]
    )
  )
)

const connectorRecord = createConnectorRecord()

const connectorClosure = {
  boardReference: benchPrototypeFixtureHarness.connector.boardReference,
  harnessReference: benchPrototypeFixtureHarness.connector.bomReference,
  header: {
    manufacturer: benchPrototypeFixtureHarness.connector.header.manufacturer,
    mpn: benchPrototypeFixtureHarness.connector.header.mpn,
    package: benchPrototypeFixtureHarness.connector.header.family,
    positions: benchPrototypeFixtureHarness.connector.header.positions,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/43045-1200"
  },
  mate: {
    manufacturer: benchPrototypeFixtureHarness.connector.mate.manufacturer,
    mpn: benchPrototypeFixtureHarness.connector.mate.mpn,
    package: benchPrototypeFixtureHarness.connector.mate.family,
    positions: benchPrototypeFixtureHarness.connector.mate.positions,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/0430251200"
  },
  terminal: {
    manufacturer: "Molex",
    mpn: benchPrototypeFixtureHarness.connector.mate.terminalMpn,
    package: benchPrototypeFixtureHarness.connector.mate.terminalForm,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/430300007"
  },
  pinMap: structuredClone(benchPrototypeFixtureHarness.connector.pinMap),
  continuityMap: structuredClone(benchPrototypeFixtureHarness.connector.continuityMap),
  populatedBoardPins: [1, 2, 3, 4, 5, 6, 7],
  unpopulatedBoardPins: [8, 9, 10, 11, 12],
  orientationRule:
    "Circuit 1 and the polarized latch/lock must be established from the manufacturer drawing; an independent fixture stop remains mandatory.",
  releaseState: "deny" as const
}

const upstreamSnapshot = deepFreeze({
  bp030: {
    artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
    methodId: benchPrototypeFootprintReviewTemplate.methodId,
    bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
    releaseState: benchPrototypeFootprintReviewTemplate.releaseState,
    recordCount: benchPrototypeFootprintReviewTemplate.records.length
  },
  bp103: {
    channelOrder: structuredClone(benchPrototypeSevenChannelAnalog.channelOrder),
    channels: structuredClone(
      benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
        chainIndex: channel.chainIndex,
        conductor: channel.conductor,
        connectorNet: channel.connectorNet,
        references: channel.references
      }))
    ),
    cellIdentity: structuredClone(benchPrototypeSevenChannelAnalog.cellIdentity)
  },
  bp104: {
    boardReference: benchPrototypeFixtureHarness.connector.boardReference,
    bomReference: benchPrototypeFixtureHarness.connector.bomReference,
    header: structuredClone(benchPrototypeFixtureHarness.connector.header),
    mate: structuredClone(benchPrototypeFixtureHarness.connector.mate),
    pinMap: structuredClone(benchPrototypeFixtureHarness.connector.pinMap)
  },
  sourceParts: structuredClone(
    cellReferenceBindings.map((binding) => ({
      reference: binding.baseReference,
      part: findUniqueSourcePart(binding.baseReference)
    }))
  ),
  m404SharedManufacturerSources: structuredClone(sharedManufacturerSources)
})

function liveUpstreamSnapshot() {
  return {
    bp030: {
      artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
      methodId: benchPrototypeFootprintReviewTemplate.methodId,
      bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
      releaseState: benchPrototypeFootprintReviewTemplate.releaseState,
      recordCount: benchPrototypeFootprintReviewTemplate.records.length
    },
    bp103: {
      channelOrder: benchPrototypeSevenChannelAnalog.channelOrder,
      channels: benchPrototypeSevenChannelAnalog.channels.map((channel) => ({
        chainIndex: channel.chainIndex,
        conductor: channel.conductor,
        connectorNet: channel.connectorNet,
        references: channel.references
      })),
      cellIdentity: benchPrototypeSevenChannelAnalog.cellIdentity
    },
    bp104: {
      boardReference: benchPrototypeFixtureHarness.connector.boardReference,
      bomReference: benchPrototypeFixtureHarness.connector.bomReference,
      header: benchPrototypeFixtureHarness.connector.header,
      mate: benchPrototypeFixtureHarness.connector.mate,
      pinMap: benchPrototypeFixtureHarness.connector.pinMap
    },
    sourceParts: cellReferenceBindings.map((binding) => ({
      reference: binding.baseReference,
      part: findUniqueSourcePart(binding.baseReference)
    })),
    m404SharedManufacturerSources: sharedManufacturerSourcesFor(
      cellReferenceBindings.map((binding) => findUniqueSourcePart(binding.baseReference))
    )
  }
}

const definition = {
  artifactKind: "bench-prototype-analog-footprint-closure",
  workUnit: "BP-031",
  targetAssembly: "one-board bench prototype",
  methodId: "BP-030",
  upstream: {
    baselineFootprintReview: "BP-030",
    sevenChannelAnalog: "BP-103",
    weaponFixtureHarness: "BP-104",
    sharedManufacturerSources: "M4-04"
  },
  scope: {
    replicatedCellCount: expectedReplicatedCellCount,
    referencesPerReplicatedCell: expectedCellReferenceCount,
    replicatedCellRecordCount: expectedReplicatedCellRecordCount,
    connectorRecordCount: expectedConnectorRecordCount,
    totalRecordCount: expectedTotalRecordCount,
    sharedManufacturerSourceCount: expectedSharedManufacturerSourceCount,
    sharedSourceLinkedRecordCount: expectedSharedSourceLinkedRecordCount,
    sharedSourceUnresolvedRecordCount: expectedSharedSourceUnresolvedRecordCount,
    closedFootprintCount: 0,
    deniedUnresolvedFootprintCount: expectedTotalRecordCount,
    rule: "Exact identity may be carried forward; no geometry or placement permission is carried forward without independent evidence."
  },
  records: [...records, connectorRecord],
  sharedManufacturerSources,
  connectorClosure,
  authority: {
    identityReconciled: true,
    manufacturerDrawingEvidenceReviewed: false,
    manufacturerCadEvidenceReviewed: false,
    artworkEvidenceReviewed: false,
    orientationEvidenceReviewed: false,
    footprintClosureAuthorized: false,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny" as const
  },
  openGates: [
    "For every record without a shared source record, acquire the exact manufacturer package drawing and record its revision and SHA-256 without substituting a family or generic footprint.",
    "For every M4-04 source record, review its exact or explicitly series-only scope against the seven-channel reference before treating it as BP-031 manufacturer-drawing evidence.",
    "For every record, acquire the exact manufacturer CAD object or explicitly document that no CAD is published; do not infer pads, courtyard, paste, or mask geometry from package prose.",
    "Generate and hash one project artwork object per exact reference only after the drawing/CAD comparison; independently overlay pad mapping, pin one or polarity, orientation, edge clearance, courtyard, and assembly constraints.",
    "Reconcile all seven channel copies, every C0603C102J5GACTU SAR capacitor, the reference loops, and the 43045-1200 connector against one schematic revision before BP-035.",
    "Keep every record DNP-unresolved and keep footprint, schematic integration, layout, and fabrication authority denied until all four evidence classes are independently reviewed."
  ],
  sources: [
    { title: "BP-030 footprint evidence method", url: "src/bench-prototype-footprint-review.ts" },
    { title: "BP-103 seven-channel analog architecture", url: "src/bench-prototype-seven-channel-analog.ts" },
    { title: "BP-104 weapon fixture harness", url: "src/bench-prototype-fixture-harness.ts" },
    { title: "BP-101 reference drive", url: "src/bench-prototype-reference-drive.ts" },
    { title: "BP-102 fault protection", url: "src/bench-prototype-fault-protection.ts" },
    { title: "M4-04 single-channel source registry", url: "src/m4-04-single-channel-coupon.ts" },
    { title: "Molex 43045-1200", url: "https://www.molex.com/en-us/products/part-detail/43045-1200" },
    { title: "Molex 43025-1200", url: "https://www.molex.com/en-us/products/part-detail/0430251200" },
    { title: "Molex 43030-0007", url: "https://www.molex.com/en-us/products/part-detail/430300007" }
  ]
} as const

export const benchPrototypeAnalogFootprintClosure = deepFreeze(definition)
export const benchPrototypeAnalogFootprintClosureUpstreamSnapshot = upstreamSnapshot

function assertUpstreamContracts(): void {
  validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)
  validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)
  validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
  validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)
  if (!sameDataGraph(liveUpstreamSnapshot(), upstreamSnapshot)) {
    throw new RangeError("BP-030, BP-103, BP-104, M4-04, or analog source-part evidence drifted")
  }
}

export function validateBenchPrototypeAnalogFootprintClosure(value: unknown): true {
  assertUpstreamContracts()
  if (!sameDataGraph(value, benchPrototypeAnalogFootprintClosure)) {
    throw new RangeError("BP-031 footprint ledger must exactly match the reviewed deny-by-default contract")
  }

  const contract = benchPrototypeAnalogFootprintClosure
  const cellRecords = contract.records.filter((record) => record.sourceContract === "BP-103")
  const connectorRecords = contract.records.filter((record) => record.sourceContract === "BP-104")
  if (
    cellReferenceBindings.length !== expectedCellReferenceCount ||
    cellRecords.length !== expectedReplicatedCellRecordCount ||
    connectorRecords.length !== expectedConnectorRecordCount ||
    contract.scope.replicatedCellCount !== expectedReplicatedCellCount ||
    contract.scope.referencesPerReplicatedCell !== expectedCellReferenceCount ||
    contract.scope.replicatedCellRecordCount !== expectedReplicatedCellRecordCount ||
    contract.scope.connectorRecordCount !== expectedConnectorRecordCount ||
    contract.scope.totalRecordCount !== expectedTotalRecordCount ||
    contract.scope.totalRecordCount !== contract.records.length ||
    contract.scope.sharedManufacturerSourceCount !== expectedSharedManufacturerSourceCount ||
    contract.scope.sharedSourceLinkedRecordCount !== expectedSharedSourceLinkedRecordCount ||
    contract.scope.sharedSourceUnresolvedRecordCount !== expectedSharedSourceUnresolvedRecordCount ||
    contract.scope.closedFootprintCount !== 0 ||
    contract.scope.deniedUnresolvedFootprintCount !== contract.records.length ||
    contract.authority.footprintClosureAuthorized ||
    contract.authority.schematicIntegrationAuthorized ||
    contract.authority.fabricationAuthorized ||
    contract.authority.releaseState !== "deny" ||
    contract.connectorClosure.releaseState !== "deny" ||
    contract.records.some(
      (record) =>
        record.disposition !== "DNP-unresolved" ||
        record.manufacturerDrawing.state !== "not-acquired" ||
        record.manufacturerCad.state !== "not-acquired" ||
        record.artwork.state !== "not-generated" ||
        record.orientation.state !== "unreviewed" ||
        record.existingFootprintEvidence.eligibleForPcb
    )
  ) {
    throw new RangeError("BP-031 must retain complete per-reference evidence denial")
  }

  const sharedSourcesByMpn = new Map(contract.sharedManufacturerSources.map((source) => [source.exactMpn, source]))
  const sharedSourceIds = new Set(contract.sharedManufacturerSources.map((source) => source.sourceId))
  const sourceLinkedRecords = cellRecords.filter((record) => record.sharedManufacturerSourceId !== null)
  if (
    sharedSourcesByMpn.size !== expectedSharedManufacturerSourceCount ||
    sharedSourceIds.size !== expectedSharedManufacturerSourceCount ||
    sourceLinkedRecords.length !== expectedSharedSourceLinkedRecordCount ||
    cellRecords.length - sourceLinkedRecords.length !== expectedSharedSourceUnresolvedRecordCount ||
    contract.sharedManufacturerSources.some(
      (source) =>
        source.sourceId !== `M4-04:${source.exactMpn}` ||
        source.sourceWorkUnit !== "M4-04" ||
        (source.sourceStatus !== "hash-bound" && source.sourceStatus !== "series-hash-bound") ||
        (source.acquisition !== "exact-drawing-hash-bound" && source.acquisition !== "series-drawing-hash-bound") ||
        source.artifactPath === null ||
        source.drawingUrl === null ||
        source.sha256 === null ||
        source.geometry !== null ||
        source.reviewStatus !== "not-reviewed-for-bp-031"
    ) ||
    cellRecords.some(
      (record) => record.sharedManufacturerSourceId !== (sharedSourcesByMpn.get(record.exactMpn)?.sourceId ?? null)
    )
  ) {
    throw new RangeError("BP-031 shared M4-04 source provenance must remain exact, centralized, and unreviewed")
  }

  const channelCounts = new Map<number, number>()
  for (const record of cellRecords)
    channelCounts.set(record.channelIndex, (channelCounts.get(record.channelIndex) ?? 0) + 1)
  if (
    channelCounts.size !== 7 ||
    [...channelCounts.values()].some((count) => count !== expectedCellReferenceCount) ||
    !sameDataGraph(
      cellRecords.map((record) => record.conductor).filter((value, index, values) => values.indexOf(value) === index),
      benchPrototypeSevenChannelAnalog.channelOrder
    )
  ) {
    throw new RangeError("BP-031 replicated channel references do not reconcile to BP-103")
  }

  const connector = connectorRecords[0]
  if (
    connector === undefined ||
    connector.reference !== "J_WEAPON_FIXTURE" ||
    connector.exactMpn !== "43045-1200" ||
    contract.connectorClosure.header.mpn !== "43045-1200" ||
    contract.connectorClosure.mate.mpn !== "43025-1200" ||
    contract.connectorClosure.terminal.mpn !== "43030-0007" ||
    contract.connectorClosure.pinMap.length !== 12 ||
    !sameDataGraph(contract.connectorClosure.populatedBoardPins, [1, 2, 3, 4, 5, 6, 7]) ||
    !sameDataGraph(contract.connectorClosure.unpopulatedBoardPins, [8, 9, 10, 11, 12])
  ) {
    throw new RangeError("BP-031 weapon-fixture connector identity or pin map drifted")
  }
  return true
}

validateBenchPrototypeAnalogFootprintClosure(benchPrototypeAnalogFootprintClosure)
