/** BP-035: fail-closed convergence of the lane-B prototype BOM artifacts. */

import { benchPrototypeAnalogFootprintClosure } from "./bench-prototype-analog-footprint-closure.js"
import { benchPrototypeApplicationFootprints } from "./bench-prototype-application-footprints.js"
import { benchPrototypeBom } from "./bench-prototype-bom.js"
import { benchPrototypeConnectorPreorder } from "./bench-prototype-connector-preorder.js"
import { isBenchPrototypeFootprintApproved } from "./bench-prototype-footprint-approval-decisions.js"
import { benchPrototypeProcessorFootprints } from "./bench-prototype-processor-footprints.js"

export type LaneBomSource = "BP-010" | "BP-031" | "BP-032" | "BP-033" | "BP-034" | "BP-035"

export type LaneBomPopulation = "populate" | "DNP" | "TBD"

export type LaneBomClassification = "board-populated" | "external-sample-test"

export type LaneBomFootprintEvidenceState = "not-started" | "reviewed-unapproved" | "approved"

export type LaneBomRow = {
  readonly source: LaneBomSource
  readonly reference: string
  readonly mpn: string | null
  readonly package: string | null
  readonly population: LaneBomPopulation
  readonly classification: LaneBomClassification
  readonly footprintEvidenceRequired: boolean
  readonly footprintEvidenceComplete: boolean
  readonly footprintEvidenceState: LaneBomFootprintEvidenceState
  readonly orderCandidateProjection?: true
  readonly sampleEvidenceRequired: boolean
  readonly sampleEvidenceComplete: boolean
}

export type LaneBomBlockerCode =
  | "duplicate-reference"
  | "duplicate-source-artifact"
  | "missing-source-artifact"
  | "source-artifact-review-open"
  | "missing-baseline-reference"
  | "missing-lane-reference"
  | "unresolved-mpn"
  | "unresolved-package"
  | "mpn-drift"
  | "package-drift"
  | "population-drift"
  | "unresolved-population"
  | "footprint-evidence-open"
  | "selection-blocked"

export type LaneBomBlocker = {
  readonly code: LaneBomBlockerCode
  readonly reference: string
  readonly sources: readonly LaneBomSource[]
  readonly detail: string
}

export type LaneBomConvergenceEvaluation = {
  readonly artifactKind: "bench-prototype-lane-bom-convergence-evaluation"
  readonly workUnit: "BP-035"
  readonly targetAssembly: "one-board bench prototype"
  readonly orderCandidateReady: boolean
  readonly prototypeOrderDisposition: "READY" | "DENY"
  readonly fabricationDisposition: "DENY"
  readonly productionRelease: false
  readonly blockers: readonly LaneBomBlocker[]
  readonly unresolvedPopulatedReferences: readonly string[]
}

export type LaneBomSourceArtifact =
  | { readonly source: LaneBomSource; readonly status: "provided" }
  | {
      readonly source: LaneBomSource
      readonly status: "reviewed-not-applicable"
      readonly reviewer: string
      readonly rationale: string
    }

type EvaluationInput = {
  readonly rows: readonly LaneBomRow[]
  readonly sourceArtifacts: readonly LaneBomSourceArtifact[]
  readonly selectionBlockers: readonly { reference: string; detail: string }[]
}

const footprintSources = new Set<LaneBomSource>(["BP-031", "BP-032", "BP-033"])
const requiredSources = ["BP-010", "BP-031", "BP-032", "BP-033", "BP-034"] as const satisfies readonly LaneBomSource[]

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function compareText(
  rows: readonly LaneBomRow[],
  key: "mpn" | "package",
  code: "mpn-drift" | "package-drift",
  reference: string,
  blockers: LaneBomBlocker[]
): void {
  const values = new Set(rows.map((row) => row[key]).filter((value): value is string => value !== null))
  if (values.size <= 1) return
  blockers.push({
    code,
    reference,
    sources: rows.map((row) => row.source),
    detail: `${key} values disagree exactly: ${[...values].join(" | ")}`
  })
}

/**
 * Evaluates already extracted lane rows. It intentionally performs no alias,
 * package-name, or population normalization: those changes belong upstream.
 */
export function evaluateLaneBomConvergence(input: EvaluationInput): LaneBomConvergenceEvaluation {
  const blockers: LaneBomBlocker[] = []
  for (const source of requiredSources) {
    const declarations = input.sourceArtifacts.filter((artifact) => artifact.source === source)
    if (declarations.length === 0) {
      blockers.push({
        code: "missing-source-artifact",
        reference: "GLOBAL",
        sources: [source],
        detail: `${source} was neither supplied nor declared reviewed not applicable`
      })
      continue
    }
    if (declarations.length > 1) {
      blockers.push({
        code: "duplicate-source-artifact",
        reference: "GLOBAL",
        sources: [source],
        detail: `${source} has ${declarations.length} artifact declarations`
      })
    }
    const declaration = declarations[0]!
    if (declaration.status === "provided" && !input.rows.some((row) => row.source === source)) {
      blockers.push({
        code: "missing-source-artifact",
        reference: "GLOBAL",
        sources: [source],
        detail: `${source} is declared supplied but contributes no extracted rows`
      })
    }
    if (
      declaration.status === "reviewed-not-applicable" &&
      (declaration.reviewer.trim().length === 0 || declaration.rationale.trim().length === 0)
    ) {
      blockers.push({
        code: "source-artifact-review-open",
        reference: "GLOBAL",
        sources: [source],
        detail: `${source} not-applicable status lacks a named reviewer or rationale`
      })
    }
    if (declaration.status === "reviewed-not-applicable" && input.rows.some((row) => row.source === source)) {
      blockers.push({
        code: "source-artifact-review-open",
        reference: "GLOBAL",
        sources: [source],
        detail: `${source} contributes rows despite being declared not applicable`
      })
    }
  }
  const isReviewedNotApplicable = (source: LaneBomSource) =>
    input.sourceArtifacts.some(
      (artifact) =>
        artifact.source === source &&
        artifact.status === "reviewed-not-applicable" &&
        artifact.reviewer.trim().length > 0 &&
        artifact.rationale.trim().length > 0
    )
  if (!input.rows.some((row) => row.source === "BP-010") && !isReviewedNotApplicable("BP-010")) {
    blockers.push({
      code: "missing-baseline-reference",
      reference: "GLOBAL",
      sources: [],
      detail: "no BP-010 baseline rows were supplied"
    })
  }
  if (
    !input.rows.some((row) => footprintSources.has(row.source)) &&
    ![...footprintSources].every(isReviewedNotApplicable)
  ) {
    blockers.push({
      code: "missing-lane-reference",
      reference: "GLOBAL",
      sources: [],
      detail: "no BP-031, BP-032, or BP-033 footprint rows were supplied"
    })
  }
  const rowsBySourceAndReference = new Map<string, LaneBomRow[]>()
  for (const row of input.rows) {
    const key = `${row.source}\u0000${row.reference}`
    const matches = rowsBySourceAndReference.get(key) ?? []
    matches.push(row)
    rowsBySourceAndReference.set(key, matches)
  }
  for (const rows of rowsBySourceAndReference.values()) {
    if (rows.length <= 1) continue
    blockers.push({
      code: "duplicate-reference",
      reference: rows[0]!.reference,
      sources: [rows[0]!.source],
      detail: `${rows[0]!.source} assigns the reference ${rows.length} times`
    })
  }

  const byReference = new Map<string, LaneBomRow[]>()
  for (const row of input.rows) {
    const matches = byReference.get(row.reference) ?? []
    matches.push(row)
    byReference.set(row.reference, matches)
  }

  for (const [reference, rows] of byReference) {
    const boardRows = rows.filter((row) => row.classification === "board-populated")
    const baseline = boardRows.find((row) => row.source === "BP-010" || row.orderCandidateProjection === true)
    const laneRows = boardRows.filter((row) => row.source !== "BP-010" && row.orderCandidateProjection !== true)
    const unresolvedDemand = rows.some((row) => row.population !== "DNP")
    if (baseline === undefined && laneRows.length > 0) {
      blockers.push({
        code: "missing-baseline-reference",
        reference,
        sources: laneRows.map((row) => row.source),
        detail: "a board-populated lane declares this reference but BP-010 has no exact reference row"
      })
    }
    if (baseline?.population === "populate" && laneRows.length === 0) {
      blockers.push({
        code: "missing-lane-reference",
        reference,
        sources: ["BP-010"],
        detail: "BP-010 selects this populated reference but no BP-031, BP-032, or BP-033 row closes it"
      })
    }
    if (unresolvedDemand && rows.some((row) => row.mpn === null)) {
      blockers.push({
        code: "unresolved-mpn",
        reference,
        sources: rows.filter((row) => row.mpn === null).map((row) => row.source),
        detail: "a populated or TBD lane row lacks an exact orderable MPN"
      })
    }
    if (
      unresolvedDemand &&
      rows.some((row) => row.classification === "board-populated" && row.population !== "DNP" && row.package === null)
    ) {
      blockers.push({
        code: "unresolved-package",
        reference,
        sources: rows
          .filter((row) => row.classification === "board-populated" && row.population !== "DNP" && row.package === null)
          .map((row) => row.source),
        detail: "a populated or TBD board row lacks an exact package identity"
      })
    }
    compareText(boardRows, "mpn", "mpn-drift", reference, blockers)
    compareText(boardRows, "package", "package-drift", reference, blockers)
    const populations = new Set(boardRows.map((row) => row.population))
    if (populations.size > 1) {
      blockers.push({
        code: "population-drift",
        reference,
        sources: rows.map((row) => row.source),
        detail: `population values disagree: ${[...populations].join(" | ")}`
      })
    }
    for (const row of rows.filter((candidate) => candidate.population === "TBD")) {
      blockers.push({
        code: "unresolved-population",
        reference,
        sources: [row.source],
        detail: `${row.source} leaves population TBD`
      })
    }
    for (const row of rows) {
      if (
        row.population !== "DNP" &&
        row.footprintEvidenceRequired &&
        (row.footprintEvidenceState !== "approved" || !row.footprintEvidenceComplete)
      ) {
        blockers.push({
          code: "footprint-evidence-open",
          reference,
          sources: [row.source],
          detail:
            row.footprintEvidenceState === "reviewed-unapproved"
              ? `${row.source} has reviewed but unapproved footprint evidence`
              : `${row.source} has no completed drawing, CAD, artwork, and independent orientation review`
        })
      }
    }
  }

  for (const selection of input.selectionBlockers) {
    blockers.push({
      code: "selection-blocked",
      reference: selection.reference,
      sources: ["BP-034"],
      detail: selection.detail
    })
  }

  blockers.sort((left, right) =>
    left.reference === right.reference
      ? left.code.localeCompare(right.code)
      : left.reference.localeCompare(right.reference)
  )
  const unresolvedPopulatedReferences = [
    ...new Set(blockers.filter((blocker) => blocker.reference !== "GLOBAL").map((blocker) => blocker.reference))
  ].sort()
  const orderCandidateReady = blockers.length === 0
  return deepFreeze({
    artifactKind: "bench-prototype-lane-bom-convergence-evaluation",
    workUnit: "BP-035",
    targetAssembly: "one-board bench prototype",
    orderCandidateReady,
    prototypeOrderDisposition: orderCandidateReady ? "READY" : "DENY",
    fabricationDisposition: "DENY",
    productionRelease: false,
    blockers,
    unresolvedPopulatedReferences
  })
}

function evidenceState(hasReviewEvidence: boolean, accepted: boolean): LaneBomFootprintEvidenceState {
  if (accepted) return "approved"
  return hasReviewEvidence ? "reviewed-unapproved" : "not-started"
}

function analogEvidenceState(
  record: (typeof benchPrototypeAnalogFootprintClosure.records)[number]
): LaneBomFootprintEvidenceState {
  const mapping = benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find(
    (candidate) => candidate.mappingId === record.reviewEvidenceMappingId
  )
  return evidenceState(
    mapping !== undefined,
    mapping !== undefined && isBenchPrototypeFootprintApproved("BP-031", record.reference, mapping.artifactKind)
  )
}

function processorEvidenceState(record: {
  readonly evidence: { readonly footprintEvidence: { readonly accepted: boolean } | null }
}): LaneBomFootprintEvidenceState {
  return evidenceState(record.evidence.footprintEvidence !== null, record.evidence.footprintEvidence?.accepted === true)
}

function applicationEvidenceState(
  record: (typeof benchPrototypeApplicationFootprints.records)[number]
): LaneBomFootprintEvidenceState {
  const projectMapping = benchPrototypeApplicationFootprints.projectFootprintMappings.some(
    (mapping) => mapping.reference === record.reference
  )
  const recordReview =
    ("projectFootprintCandidate" in record && record.projectFootprintCandidate !== undefined) ||
    ("pinMapOrientationOverlay" in record && record.pinMapOrientationOverlay !== undefined)
  return evidenceState(projectMapping || recordReview, false)
}

export function projectExactLaneRowsOntoOrderCandidateBaseline(
  historicalBaseline: readonly LaneBomRow[],
  laneRows: readonly LaneBomRow[]
): readonly LaneBomRow[] {
  const historicalReferences = new Set(historicalBaseline.map((row) => row.reference))
  const projectedByReference = new Map<string, LaneBomRow>()
  const conflictingReferences = new Set<string>()
  for (const row of laneRows) {
    if (
      !["BP-031", "BP-032", "BP-033"].includes(row.source) ||
      row.classification !== "board-populated" ||
      row.mpn === null ||
      row.package === null ||
      row.mpn === "TBD" ||
      row.package === "TBD" ||
      row.population === "TBD" ||
      historicalReferences.has(row.reference)
    ) {
      continue
    }
    const existing = projectedByReference.get(row.reference)
    if (
      existing !== undefined &&
      (existing.mpn !== row.mpn || existing.package !== row.package || existing.population !== row.population)
    ) {
      conflictingReferences.add(row.reference)
      projectedByReference.delete(row.reference)
      continue
    }
    if (!conflictingReferences.has(row.reference)) projectedByReference.set(row.reference, row)
  }
  return [...projectedByReference.values()].map((row) => ({
    ...row,
    source: "BP-035" as const,
    orderCandidateProjection: true as const,
    footprintEvidenceRequired: false,
    footprintEvidenceComplete: false,
    footprintEvidenceState: "not-started" as const,
    sampleEvidenceRequired: false,
    sampleEvidenceComplete: false
  }))
}

function canonicalRows(): LaneBomRow[] {
  const baseline: LaneBomRow[] = benchPrototypeBom.rows.map((row) => ({
    source: "BP-010",
    reference: row.reference,
    mpn: row.mpn ?? null,
    package: row.package ?? null,
    population: row.disposition === "selected" ? "populate" : row.disposition,
    classification: "board-populated",
    footprintEvidenceRequired: false,
    footprintEvidenceComplete: false,
    footprintEvidenceState: "not-started",
    sampleEvidenceRequired: false,
    sampleEvidenceComplete: false
  }))
  const analog: LaneBomRow[] = benchPrototypeAnalogFootprintClosure.records.map((row) => {
    const footprintEvidenceState = analogEvidenceState(row)
    return {
      source: "BP-031",
      reference: row.reference,
      mpn: row.exactMpn,
      package: row.exactPackage,
      population: "populate",
      classification: "board-populated",
      footprintEvidenceRequired: true,
      footprintEvidenceComplete: footprintEvidenceState === "approved",
      footprintEvidenceState,
      sampleEvidenceRequired: false,
      sampleEvidenceComplete: false
    }
  })
  const processorSupportReferenceSet = new Set<string>(
    benchPrototypeProcessorFootprints.processorSupportReferences.map((row) => row.reference)
  )
  const processorRecords = [
    ...benchPrototypeProcessorFootprints.populatedReferences,
    ...benchPrototypeProcessorFootprints.debugReferences
  ].filter((row) => !processorSupportReferenceSet.has(row.reference))
  const processor: LaneBomRow[] = processorRecords.map((row) => ({
    source: "BP-032",
    reference: row.reference,
    mpn: row.mpn,
    package: row.package,
    population: row.population.startsWith("DNP") ? "DNP" : "populate",
    classification: "board-populated",
    footprintEvidenceRequired: !row.population.startsWith("DNP"),
    footprintEvidenceComplete: processorEvidenceState(row) === "approved",
    footprintEvidenceState: processorEvidenceState(row),
    sampleEvidenceRequired: false,
    sampleEvidenceComplete: false
  }))
  const processorSupport: LaneBomRow[] = benchPrototypeProcessorFootprints.processorSupportReferences.map((row) => ({
    source: "BP-032",
    reference: row.reference,
    mpn: row.selectedMpn,
    package: row.package,
    population: row.selectedMpn === null ? "TBD" : "populate",
    classification: "board-populated",
    footprintEvidenceRequired: row.selectedMpn !== null,
    footprintEvidenceComplete: processorEvidenceState(row) === "approved",
    footprintEvidenceState: processorEvidenceState(row),
    sampleEvidenceRequired: false,
    sampleEvidenceComplete: false
  }))
  const application: LaneBomRow[] = benchPrototypeApplicationFootprints.records.map((row) => ({
    source: "BP-033",
    reference: row.reference,
    mpn: row.mpn,
    package: row.package,
    population: "populate",
    classification: "board-populated",
    footprintEvidenceRequired: true,
    footprintEvidenceComplete: false,
    footprintEvidenceState: applicationEvidenceState(row),
    sampleEvidenceRequired: false,
    sampleEvidenceComplete: false
  }))
  const blockedApplication: LaneBomRow[] = benchPrototypeApplicationFootprints.bp140SelectionBlockedReferences.map(
    (row) => ({
      source: "BP-033",
      reference: row.reference,
      mpn: null,
      package: null,
      population: "TBD",
      classification: "board-populated",
      footprintEvidenceRequired: false,
      footprintEvidenceComplete: false,
      footprintEvidenceState: "not-started",
      sampleEvidenceRequired: false,
      sampleEvidenceComplete: false
    })
  )
  const externalOnlySampleIds = new Set(["weapon-test-plug", "hub75-panel-power"])
  const connector: LaneBomRow[] = benchPrototypeConnectorPreorder.samples.flatMap((sample) => {
    if (externalOnlySampleIds.has(sample.id)) {
      return sample.requiredComponents.map((component, index) => ({
        source: "BP-034" as const,
        reference: `BP034_SAMPLE:${sample.id}:${index + 1}:${component.mpn}`,
        mpn: component.mpn,
        package: null,
        population: "populate" as const,
        classification: "external-sample-test" as const,
        footprintEvidenceRequired: false,
        footprintEvidenceComplete: false,
        footprintEvidenceState: "not-started",
        sampleEvidenceRequired: true,
        sampleEvidenceComplete: false
      }))
    }
    const boardComponent = sample.requiredComponents[0]
    const boardRows: LaneBomRow[] = sample.interfaceReferences.map((reference) => ({
      source: "BP-034",
      reference,
      mpn: boardComponent?.mpn ?? null,
      package: null,
      population: "TBD",
      classification: "board-populated",
      footprintEvidenceRequired: false,
      footprintEvidenceComplete: false,
      footprintEvidenceState: "not-started",
      sampleEvidenceRequired: true,
      sampleEvidenceComplete: false
    }))
    const externalRows: LaneBomRow[] = sample.requiredComponents.slice(1).map((component, index) => ({
      source: "BP-034",
      reference: `BP034_SAMPLE:${sample.id}:${index + 1}:${component.mpn}`,
      mpn: component.mpn,
      package: null,
      population: "populate",
      classification: "external-sample-test",
      footprintEvidenceRequired: false,
      footprintEvidenceComplete: false,
      footprintEvidenceState: "not-started",
      sampleEvidenceRequired: true,
      sampleEvidenceComplete: false
    }))
    return [...boardRows, ...externalRows]
  })
  const laneRows = [...analog, ...processor, ...processorSupport, ...application, ...blockedApplication]
  const orderCandidateProjection = projectExactLaneRowsOntoOrderCandidateBaseline(baseline, laneRows)
  return [...baseline, ...orderCandidateProjection, ...laneRows, ...connector]
}

/** Current BP-031 through BP-034 truth, reconciled against the BP-010 baseline BOM. */
export function evaluateBenchPrototypeLaneBomConvergence(): LaneBomConvergenceEvaluation {
  return evaluateLaneBomConvergence({
    rows: benchPrototypeLaneBomRows,
    sourceArtifacts: requiredSources.map((source) => ({ source, status: "provided" as const })),
    selectionBlockers: benchPrototypeConnectorPreorder.samples.flatMap((sample) =>
      sample.selectionState === "exact"
        ? []
        : sample.interfaceReferences.map((reference) => ({ reference, detail: sample.selectionBlocker }))
    )
  })
}

export const benchPrototypeLaneBomRows = deepFreeze(canonicalRows())
export const benchPrototypeLaneBomConvergence = deepFreeze(evaluateBenchPrototypeLaneBomConvergence())
