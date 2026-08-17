import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { z } from "zod"

const sources = ["congress", "govinfo", "openstates"] as const
const documentFormats = ["html", "other", "pdf", "text", "xml"] as const
const requiredStateStrata = ["dense", "large", "older", "recent", "small", "sparse"] as const
const requiredStateFields = ["actions", "documents", "identifier", "sponsors", "title", "votes"] as const
const requiredFederalChecks = ["metadata", "official-text"] as const
const requiredExtractionFormats = ["html", "pdf", "text", "xml"] as const
const requiredD2Artifacts = [
  "command-parameters",
  "congress-sync-checkpoint",
  "corpus-validation",
  "coverage-report",
  "failure-report",
  "govinfo-discovery-manifest",
  "openstates-discovery-manifest",
  "run-records",
  "sample-records"
] as const
const requiredD3Artifacts = [
  "content-hashes",
  "document-exceptions",
  "document-inventory",
  "embedding-model",
  "embedding-report",
  "extraction-sampled-review",
  "idempotency-report",
  "processing-report"
] as const
const artifactCategories = [...requiredD2Artifacts, ...requiredD3Artifacts] as const
const taskIds = [
  "D2.6",
  "D2.10",
  "D2.12",
  "D2.14",
  "D2.15",
  "D3.1",
  "D3.4",
  "D3.6",
  "D3.7",
  "D3.8",
  "D3.9",
  "D3.10"
] as const

const timestamp = z.iso.datetime()
const nonemptyText = z.string().trim().min(1).max(2000)
const explanation = z.string().trim().min(12).max(4000)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 digest")
const nonnegativeInteger = z.number().int().nonnegative()
const relativeArtifactPath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => !isAbsolute(value), "must be relative to the evidence manifest")
  .refine((value) => !value.includes("\\"), "must use forward slashes")
  .refine(
    (value) => !value.split("/").some((segment) => segment === ".." || segment === ""),
    "must not contain empty or parent-directory segments"
  )

const fieldCheck = z
  .object({
    evidence: nonemptyText,
    field: z.enum(requiredStateFields),
    outcome: z.enum(["accepted-transformation", "defect", "match"])
  })
  .strict()

const stateSample = z
  .object({
    canonicalId: nonemptyText,
    checks: z.array(fieldCheck),
    jurisdictionId: nonemptyText,
    reviewedAt: timestamp,
    reviewer: nonemptyText,
    sessionIdentifier: nonemptyText,
    sourceArtifact: relativeArtifactPath,
    sourceUrl: z.url(),
    strata: z.array(z.enum(requiredStateStrata)).min(1)
  })
  .strict()

const federalCheck = z
  .object({
    evidence: nonemptyText,
    kind: z.enum(requiredFederalChecks),
    outcome: z.enum(["accepted-transformation", "defect", "match"])
  })
  .strict()

const federalSample = z
  .object({
    billType: z.string().trim().min(1).max(20),
    canonicalId: nonemptyText,
    checks: z.array(federalCheck),
    congress: z.string().regex(/^\d{3}$/),
    govinfoMetadataHash: sha256,
    officialTextHash: sha256,
    officialTextUrl: z.url(),
    reviewedAt: timestamp,
    reviewer: nonemptyText
  })
  .strict()

const convergenceVersion = z
  .object({
    congressCanonicalId: nonemptyText,
    govinfoCanonicalId: nonemptyText,
    versionCode: nonemptyText
  })
  .strict()

const convergenceSample = z
  .object({
    canonicalId: nonemptyText,
    checkedAt: timestamp,
    congressCanonicalId: nonemptyText,
    congressSourceUrl: z.url(),
    govinfoCanonicalId: nonemptyText,
    versions: z.array(convergenceVersion)
  })
  .strict()

const gapExplanation = z
  .object({
    action: explanation,
    category: z.enum([
      "known-implementation-defect",
      "policy-excluded",
      "upstream-empty",
      "upstream-partial",
      "upstream-unavailable"
    ]),
    explanation
  })
  .strict()

const upstreamArtifact = z
  .object({
    artifactId: nonemptyText,
    databaseRecordCount: nonnegativeInteger,
    discoveredAt: timestamp,
    gap: gapExplanation.optional(),
    material: z.boolean(),
    policyStatus: z.enum(["excluded", "in-policy"]),
    source: z.enum(sources),
    sourceRecordCount: nonnegativeInteger.nullable()
  })
  .strict()

const documentInventoryRecord = z
  .object({
    acquisitionState: z.enum(["acquired", "failed", "pending", "unsupported", "upstream-missing"]),
    capturedAt: timestamp,
    documentId: nonemptyText,
    embeddedSectionCount: nonnegativeInteger,
    embeddingState: z.enum(["complete", "missing", "not-applicable", "partial"]),
    extractionState: z.enum(["failed", "not-attempted", "pending", "processed", "unsupported"]),
    format: z.enum(documentFormats),
    sectionCount: nonnegativeInteger,
    source: z.enum(sources),
    versionStatus: z.enum(["current", "historical", "unknown"])
  })
  .strict()

const extractionSample = z
  .object({
    documentId: nonemptyText,
    extractedContentHash: sha256,
    format: z.enum(requiredExtractionFormats),
    officialContentHash: sha256,
    officialUrl: z.url(),
    reviewEvidence: explanation,
    reviewedAt: timestamp,
    reviewer: nonemptyText,
    sectionBoundaryOutcome: z.enum(["accepted-transformation", "defect", "match"]),
    textOutcome: z.enum(["accepted-transformation", "defect", "match"])
  })
  .strict()

const processingCohort = z
  .object({
    acquiredSupportedDocuments: nonnegativeInteger,
    acquisitionFailures: nonnegativeInteger,
    attemptedDocuments: nonnegativeInteger,
    availableDocuments: nonnegativeInteger,
    categorizedFailures: nonnegativeInteger,
    embeddedSections: nonnegativeInteger,
    emptyTextDocuments: nonnegativeInteger,
    extractedSections: nonnegativeInteger,
    extractionFailures: nonnegativeInteger,
    fallbackSegmentedDocuments: nonnegativeInteger,
    format: z.enum(documentFormats),
    lowTextDocuments: nonnegativeInteger,
    searchableDocuments: nonnegativeInteger,
    source: z.enum(sources),
    supported: z.boolean()
  })
  .strict()

const idempotencyRun = z
  .object({
    afterContentSetHash: sha256,
    baselineRunId: z.uuid(),
    beforeContentSetHash: sha256,
    canonicalMutations: nonnegativeInteger,
    downloads: nonnegativeInteger,
    embeddingsRequested: nonnegativeInteger,
    extractions: nonnegativeInteger,
    runId: z.uuid(),
    sectionsWritten: nonnegativeInteger,
    unchangedDocuments: z.number().int().positive()
  })
  .strict()

const cohortInvestigation = z
  .object({
    action: explanation,
    classification: z.enum(["implementation-defect", "policy-exception", "upstream-limitation"]),
    finding: explanation,
    format: z.enum(documentFormats),
    releaseBlocking: z.boolean(),
    rerunRunId: z.uuid().optional(),
    resolution: z.enum(["documented-upstream-exception", "fixed-and-rerun"]),
    source: z.enum(sources)
  })
  .strict()

const evidenceArtifact = z
  .object({
    category: z.enum(artifactCategories),
    generatedAt: timestamp,
    path: relativeArtifactPath,
    runIds: z.array(z.uuid()).min(1),
    sha256
  })
  .strict()

const corpusEvidenceBundleSchema = z
  .object({
    bundleId: nonemptyText,
    convergenceSamples: z.array(convergenceSample),
    documentInventory: z.array(documentInventoryRecord),
    documentInventoryExpectedCount: nonnegativeInteger,
    embedding: z.object({ dimensions: z.number().int().positive(), modelIdentifier: nonemptyText }).strict(),
    environment: z.literal("development"),
    evidenceArtifacts: z.array(evidenceArtifact),
    extractionSamples: z.array(extractionSample),
    federalSamples: z.array(federalSample),
    generatedAt: timestamp,
    idempotencyRuns: z.array(idempotencyRun),
    investigations: z.array(cohortInvestigation),
    processingCohorts: z.array(processingCohort),
    processingStartedAt: timestamp,
    stateSamples: z.array(stateSample),
    upstreamArtifactExpectedCount: nonnegativeInteger,
    upstreamArtifacts: z.array(upstreamArtifact),
    version: z.literal(1)
  })
  .strict()

export type CorpusEvidenceBundle = z.infer<typeof corpusEvidenceBundleSchema>
export type CorpusEvidenceTaskId = (typeof taskIds)[number]

export interface EvidenceArtifactVerification {
  actualSha256?: string
  category: (typeof artifactCategories)[number]
  path: string
  status: "mismatch" | "missing" | "read-error" | "verified"
}

export interface CorpusEvidenceTaskResult {
  evidenceCount: number
  id: CorpusEvidenceTaskId
  passed: boolean
  reasons: string[]
}

export interface CorpusEvidenceAudit {
  artifactVerification: EvidenceArtifactVerification[]
  bundleId: string
  environment: "development"
  generatedAt: string
  metrics: {
    acquiredSupportedDocuments: number
    availableDocuments: number
    categorizedFailures: number
    documentInventoryCount: number
    embeddedSections: number
    extractedSections: number
    failingCohorts: string[]
    federalSampleCount: number
    materialGapCount: number
    processingFailureCount: number
    rates: {
      attemptedAvailableDocuments: number
      categorizedFailures: number
      embeddedSections: number
      searchableDocuments: number
    }
    searchableDocuments: number
    stateSampleCount: number
    verifiedArtifactCount: number
  }
  ready: boolean
  tasks: CorpusEvidenceTaskResult[]
  version: 1
}

export function parseCorpusEvidenceBundle(value: unknown): CorpusEvidenceBundle {
  return corpusEvidenceBundleSchema.parse(value)
}

export async function verifyEvidenceArtifactFiles(
  value: unknown,
  manifestDirectory: string
): Promise<EvidenceArtifactVerification[]> {
  const bundle = parseCorpusEvidenceBundle(value)
  const baseDirectory = resolve(manifestDirectory)
  const artifacts = [...bundle.evidenceArtifacts].sort(compareArtifacts)
  const checks: EvidenceArtifactVerification[] = []

  for (const artifact of artifacts) {
    const artifactFile = resolve(baseDirectory, artifact.path)
    const relativePath = relative(baseDirectory, artifactFile)
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      checks.push({ category: artifact.category, path: artifact.path, status: "read-error" })
      continue
    }
    try {
      const bytes = await readFile(artifactFile)
      const actualSha256 = createHash("sha256").update(bytes).digest("hex")
      checks.push({
        actualSha256,
        category: artifact.category,
        path: artifact.path,
        status: actualSha256 === artifact.sha256 ? "verified" : "mismatch"
      })
    } catch (error) {
      checks.push({
        category: artifact.category,
        path: artifact.path,
        status: isMissingFileError(error) ? "missing" : "read-error"
      })
    }
  }

  return checks
}

export function createCorpusEvidenceAudit(
  value: unknown,
  artifactVerification: readonly EvidenceArtifactVerification[] = []
): CorpusEvidenceAudit {
  const bundle = parseCorpusEvidenceBundle(value)
  const verified = [...artifactVerification].sort(compareVerifications)
  const cohorts = [...bundle.processingCohorts].sort((left, right) => cohortKey(left).localeCompare(cohortKey(right)))
  const totals = cohorts.reduce(
    (result, cohort) => ({
      acquiredSupportedDocuments: result.acquiredSupportedDocuments + cohort.acquiredSupportedDocuments,
      acquisitionFailures: result.acquisitionFailures + cohort.acquisitionFailures,
      attemptedDocuments: result.attemptedDocuments + cohort.attemptedDocuments,
      availableDocuments: result.availableDocuments + cohort.availableDocuments,
      categorizedFailures: result.categorizedFailures + cohort.categorizedFailures,
      embeddedSections: result.embeddedSections + cohort.embeddedSections,
      extractedSections: result.extractedSections + cohort.extractedSections,
      extractionFailures: result.extractionFailures + cohort.extractionFailures,
      searchableDocuments: result.searchableDocuments + cohort.searchableDocuments
    }),
    {
      acquiredSupportedDocuments: 0,
      acquisitionFailures: 0,
      attemptedDocuments: 0,
      availableDocuments: 0,
      categorizedFailures: 0,
      embeddedSections: 0,
      extractedSections: 0,
      extractionFailures: 0,
      searchableDocuments: 0
    }
  )
  const processingFailureCount = totals.acquisitionFailures + totals.extractionFailures
  const failingCohorts = cohorts.filter((cohort) => cohortGateFailures(cohort).length > 0).map(cohortKey)
  const tasks = [
    stateSampleTask(bundle),
    federalSampleTask(bundle),
    convergenceTask(bundle),
    artifactReconciliationTask(bundle),
    evidenceArtifactTask("D2.15", bundle, verified, requiredD2Artifacts),
    documentInventoryTask(bundle, verified),
    extractionSampleTask(bundle),
    idempotencyTask(bundle),
    processingMetricsTask(bundle),
    processingGateTask(totals),
    cohortInvestigationTask(bundle, failingCohorts),
    developmentDocumentEvidenceTask(bundle, verified)
  ]

  return {
    artifactVerification: verified,
    bundleId: bundle.bundleId,
    environment: bundle.environment,
    generatedAt: bundle.generatedAt,
    metrics: {
      acquiredSupportedDocuments: totals.acquiredSupportedDocuments,
      availableDocuments: totals.availableDocuments,
      categorizedFailures: totals.categorizedFailures,
      documentInventoryCount: bundle.documentInventory.length,
      embeddedSections: totals.embeddedSections,
      extractedSections: totals.extractedSections,
      failingCohorts,
      federalSampleCount: bundle.federalSamples.length,
      materialGapCount: materialGaps(bundle).length,
      processingFailureCount,
      rates: {
        attemptedAvailableDocuments: rate(totals.attemptedDocuments, totals.availableDocuments),
        categorizedFailures: rate(totals.categorizedFailures, processingFailureCount),
        embeddedSections: rate(totals.embeddedSections, totals.extractedSections),
        searchableDocuments: rate(totals.searchableDocuments, totals.acquiredSupportedDocuments)
      },
      searchableDocuments: totals.searchableDocuments,
      stateSampleCount: bundle.stateSamples.length,
      verifiedArtifactCount: verified.filter((check) => check.status === "verified").length
    },
    ready: tasks.every((task) => task.passed),
    tasks,
    version: 1
  }
}

function stateSampleTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.stateSamples.length < 4) {
    reasons.push("at least four distinct Open States samples are required")
  }
  addMissingValues(
    reasons,
    "state strata",
    requiredStateStrata,
    bundle.stateSamples.flatMap((sample) => sample.strata)
  )
  addDuplicateReasons(
    reasons,
    "state canonical IDs",
    bundle.stateSamples.map((sample) => sample.canonicalId)
  )
  for (const sample of bundle.stateSamples) {
    addMissingValues(
      reasons,
      `state fields for ${sample.canonicalId}`,
      requiredStateFields,
      sample.checks.map((check) => check.field)
    )
    if (sample.checks.some((check) => check.outcome === "defect")) {
      reasons.push(`state sample ${sample.canonicalId} contains an unresolved defect`)
    }
  }
  return taskResult("D2.6", bundle.stateSamples.length, reasons)
}

function federalSampleTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.federalSamples.length < 4) {
    reasons.push("at least four distinct GovInfo samples are required")
  }
  if (new Set(bundle.federalSamples.map((sample) => sample.congress)).size < 2) {
    reasons.push("federal samples must cover at least two Congresses")
  }
  if (new Set(bundle.federalSamples.map((sample) => sample.billType)).size < 2) {
    reasons.push("federal samples must cover at least two bill types")
  }
  addDuplicateReasons(
    reasons,
    "federal canonical IDs",
    bundle.federalSamples.map((sample) => sample.canonicalId)
  )
  for (const sample of bundle.federalSamples) {
    addMissingValues(
      reasons,
      `federal checks for ${sample.canonicalId}`,
      requiredFederalChecks,
      sample.checks.map((check) => check.kind)
    )
    if (sample.checks.some((check) => check.outcome === "defect")) {
      reasons.push(`federal sample ${sample.canonicalId} contains an unresolved defect`)
    }
  }
  return taskResult("D2.10", bundle.federalSamples.length, reasons)
}

function convergenceTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.convergenceSamples.length < 2) {
    reasons.push("at least two synchronized federal bills are required")
  }
  addDuplicateReasons(
    reasons,
    "convergence canonical IDs",
    bundle.convergenceSamples.map((sample) => sample.canonicalId)
  )
  for (const sample of bundle.convergenceSamples) {
    if (sample.govinfoCanonicalId !== sample.canonicalId || sample.congressCanonicalId !== sample.canonicalId) {
      reasons.push(`bill sources do not converge for ${sample.canonicalId}`)
    }
    if (sample.versions.length === 0) {
      reasons.push(`no version convergence evidence exists for ${sample.canonicalId}`)
    }
    for (const version of sample.versions) {
      if (version.govinfoCanonicalId !== version.congressCanonicalId) {
        reasons.push(`version ${version.versionCode} does not converge for ${sample.canonicalId}`)
      }
    }
  }
  return taskResult("D2.12", bundle.convergenceSamples.length, reasons)
}

function artifactReconciliationTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.upstreamArtifactExpectedCount === 0) {
    reasons.push("the expected upstream artifact count must be greater than zero")
  }
  if (bundle.upstreamArtifacts.length !== bundle.upstreamArtifactExpectedCount) {
    reasons.push(
      `upstream reconciliation contains ${bundle.upstreamArtifacts.length} of ${bundle.upstreamArtifactExpectedCount} expected artifacts`
    )
  }
  addDuplicateReasons(
    reasons,
    "upstream artifact keys",
    bundle.upstreamArtifacts.map((artifact) => `${artifact.source}:${artifact.artifactId}`)
  )
  for (const artifact of bundle.upstreamArtifacts) {
    const hasGap = artifact.sourceRecordCount === null || artifact.sourceRecordCount !== artifact.databaseRecordCount
    if (artifact.policyStatus === "in-policy" && hasGap && artifact.gap === undefined) {
      reasons.push(`unexplained gap for ${artifact.source}:${artifact.artifactId}`)
    }
    if (artifact.policyStatus === "excluded" && artifact.gap?.category !== "policy-excluded") {
      reasons.push(`excluded artifact ${artifact.source}:${artifact.artifactId} lacks a policy explanation`)
    }
  }
  return taskResult("D2.14", bundle.upstreamArtifacts.length, reasons)
}

function documentInventoryTask(
  bundle: CorpusEvidenceBundle,
  verification: readonly EvidenceArtifactVerification[]
): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.documentInventoryExpectedCount === 0) {
    reasons.push("the expected document count must be greater than zero")
  }
  if (bundle.documentInventory.length !== bundle.documentInventoryExpectedCount) {
    reasons.push(
      `document inventory contains ${bundle.documentInventory.length} of ${bundle.documentInventoryExpectedCount} expected records`
    )
  }
  addDuplicateReasons(
    reasons,
    "document IDs",
    bundle.documentInventory.map((document) => document.documentId)
  )
  for (const document of bundle.documentInventory) {
    if (document.embeddedSectionCount > document.sectionCount) {
      reasons.push(`document ${document.documentId} embeds more sections than it inventories`)
    }
    if (new Date(document.capturedAt) > new Date(bundle.processingStartedAt)) {
      reasons.push(`document ${document.documentId} was inventoried after processing started`)
    }
  }
  addArtifactReasons(reasons, bundle, verification, ["document-inventory"])
  return taskResult("D3.1", bundle.documentInventory.length, reasons)
}

function extractionSampleTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  addMissingValues(
    reasons,
    "extraction formats",
    requiredExtractionFormats,
    bundle.extractionSamples.map((sample) => sample.format)
  )
  addDuplicateReasons(
    reasons,
    "extraction sample document IDs",
    bundle.extractionSamples.map((sample) => sample.documentId)
  )
  for (const sample of bundle.extractionSamples) {
    if (sample.textOutcome === "defect" || sample.sectionBoundaryOutcome === "defect") {
      reasons.push(`extraction sample ${sample.documentId} contains an unresolved defect`)
    }
  }
  return taskResult("D3.4", bundle.extractionSamples.length, reasons)
}

function idempotencyTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.idempotencyRuns.length === 0) {
    reasons.push("no unchanged-content replay was recorded")
  }
  for (const run of bundle.idempotencyRuns) {
    if (run.runId === run.baselineRunId) {
      reasons.push(`idempotency run ${run.runId} must be distinct from its baseline run`)
    }
    if (run.beforeContentSetHash !== run.afterContentSetHash) {
      reasons.push(`content set changed during idempotency run ${run.runId}`)
    }
    for (const [operation, count] of [
      ["canonical mutations", run.canonicalMutations],
      ["downloads", run.downloads],
      ["embedding requests", run.embeddingsRequested],
      ["extractions", run.extractions],
      ["section writes", run.sectionsWritten]
    ] as const) {
      if (count !== 0) {
        reasons.push(`${operation} were repeated during idempotency run ${run.runId}`)
      }
    }
  }
  return taskResult("D3.6", bundle.idempotencyRuns.length, reasons)
}

function processingMetricsTask(bundle: CorpusEvidenceBundle): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  if (bundle.processingCohorts.length === 0) {
    reasons.push("no source and format processing cohorts were recorded")
  }
  const inventoryCohorts = new Set(bundle.documentInventory.map(cohortKey))
  const processingCohortKeys = bundle.processingCohorts.map(cohortKey)
  addDuplicateReasons(reasons, "processing cohorts", processingCohortKeys)
  for (const key of [...inventoryCohorts].sort()) {
    if (!processingCohortKeys.includes(key)) {
      reasons.push(`missing processing metrics for cohort ${key}`)
    }
  }
  for (const cohort of bundle.processingCohorts) {
    reasons.push(...cohortConsistencyFailures(cohort).map((failure) => `${cohortKey(cohort)}: ${failure}`))
  }
  return taskResult("D3.7", bundle.processingCohorts.length, reasons)
}

function processingGateTask(totals: {
  acquiredSupportedDocuments: number
  acquisitionFailures: number
  attemptedDocuments: number
  availableDocuments: number
  categorizedFailures: number
  embeddedSections: number
  extractedSections: number
  extractionFailures: number
  searchableDocuments: number
}): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  const failures = totals.acquisitionFailures + totals.extractionFailures
  if (totals.availableDocuments === 0) {
    reasons.push("no available documents exist to establish the attempt gate")
  } else if (totals.attemptedDocuments !== totals.availableDocuments) {
    reasons.push("available-document attempt rate is below 100 percent")
  }
  if (totals.categorizedFailures !== failures) {
    reasons.push("failure categorization rate is below 100 percent")
  }
  if (totals.acquiredSupportedDocuments === 0) {
    reasons.push("no acquired supported documents exist to establish the searchable-text gate")
  } else if (rate(totals.searchableDocuments, totals.acquiredSupportedDocuments) < 0.95) {
    reasons.push("searchable-text rate is below 95 percent")
  }
  if (totals.extractedSections === 0) {
    reasons.push("no extracted sections exist to establish the embedding gate")
  } else if (rate(totals.embeddedSections, totals.extractedSections) < 0.99) {
    reasons.push("section embedding rate is below 99 percent")
  }
  return taskResult("D3.8", totals.availableDocuments, reasons)
}

function cohortInvestigationTask(
  bundle: CorpusEvidenceBundle,
  failingCohorts: readonly string[]
): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  const investigations = new Map(
    bundle.investigations.map((investigation) => [cohortKey(investigation), investigation])
  )
  addDuplicateReasons(reasons, "cohort investigations", bundle.investigations.map(cohortKey))
  for (const key of failingCohorts) {
    const investigation = investigations.get(key)
    if (investigation === undefined) {
      reasons.push(`missing investigation for below-gate cohort ${key}`)
      continue
    }
    if (investigation.releaseBlocking) {
      reasons.push(`cohort ${key} retains a release-blocking defect`)
    }
    if (
      investigation.classification === "implementation-defect" &&
      (investigation.resolution !== "fixed-and-rerun" || investigation.rerunRunId === undefined)
    ) {
      reasons.push(`implementation defect for cohort ${key} lacks a targeted successful rerun`)
    }
  }
  return taskResult("D3.9", bundle.investigations.length, reasons)
}

function developmentDocumentEvidenceTask(
  bundle: CorpusEvidenceBundle,
  verification: readonly EvidenceArtifactVerification[]
): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  addArtifactReasons(reasons, bundle, verification, requiredD3Artifacts)
  if (bundle.embedding.modelIdentifier !== "openai/text-embedding-3-small") {
    reasons.push("embedding model identifier is not openai/text-embedding-3-small")
  }
  if (bundle.embedding.dimensions !== 1536) {
    reasons.push("embedding dimensions are not 1,536")
  }
  return taskResult("D3.10", requiredD3Artifacts.length, reasons)
}

function evidenceArtifactTask(
  id: "D2.15",
  bundle: CorpusEvidenceBundle,
  verification: readonly EvidenceArtifactVerification[],
  required: readonly (typeof artifactCategories)[number][]
): CorpusEvidenceTaskResult {
  const reasons: string[] = []
  addDuplicateReasons(
    reasons,
    "evidence artifact paths",
    bundle.evidenceArtifacts.map((artifact) => artifact.path)
  )
  addArtifactReasons(reasons, bundle, verification, required)
  return taskResult(id, required.length, reasons)
}

function addArtifactReasons(
  reasons: string[],
  bundle: CorpusEvidenceBundle,
  verification: readonly EvidenceArtifactVerification[],
  required: readonly (typeof artifactCategories)[number][]
): void {
  for (const category of required) {
    const declaredArtifacts = bundle.evidenceArtifacts.filter((artifact) => artifact.category === category)
    const verifiedArtifact = declaredArtifacts.some((artifact) =>
      verification.some(
        (check) =>
          check.category === artifact.category &&
          check.path === artifact.path &&
          check.status === "verified" &&
          check.actualSha256 === artifact.sha256
      )
    )
    if (declaredArtifacts.length === 0) {
      reasons.push(`missing verified ${category} artifact`)
    } else if (!verifiedArtifact) {
      reasons.push(`${category} artifact failed integrity verification`)
    }
  }
}

function cohortConsistencyFailures(cohort: z.infer<typeof processingCohort>): string[] {
  const reasons: string[] = []
  const failures = cohort.acquisitionFailures + cohort.extractionFailures
  if (cohort.attemptedDocuments > cohort.availableDocuments) {
    reasons.push("attempted documents exceed available documents")
  }
  if (cohort.acquiredSupportedDocuments > cohort.attemptedDocuments) {
    reasons.push("acquired supported documents exceed attempted documents")
  }
  if (cohort.searchableDocuments > cohort.acquiredSupportedDocuments) {
    reasons.push("searchable documents exceed acquired supported documents")
  }
  if (cohort.categorizedFailures > failures) {
    reasons.push("categorized failures exceed recorded failures")
  }
  if (cohort.embeddedSections > cohort.extractedSections) {
    reasons.push("embedded sections exceed extracted sections")
  }
  for (const [name, count] of [
    ["empty-text documents", cohort.emptyTextDocuments],
    ["fallback-segmented documents", cohort.fallbackSegmentedDocuments],
    ["low-text documents", cohort.lowTextDocuments]
  ] as const) {
    if (count > cohort.attemptedDocuments) {
      reasons.push(`${name} exceed attempted documents`)
    }
  }
  return reasons
}

function cohortGateFailures(cohort: z.infer<typeof processingCohort>): string[] {
  const reasons = cohortConsistencyFailures(cohort)
  const failures = cohort.acquisitionFailures + cohort.extractionFailures
  if (cohort.attemptedDocuments !== cohort.availableDocuments) {
    reasons.push("attempt rate")
  }
  if (cohort.categorizedFailures !== failures) {
    reasons.push("failure categorization rate")
  }
  if (
    cohort.supported &&
    cohort.acquiredSupportedDocuments > 0 &&
    rate(cohort.searchableDocuments, cohort.acquiredSupportedDocuments) < 0.95
  ) {
    reasons.push("searchable-text rate")
  }
  if (cohort.extractedSections > 0 && rate(cohort.embeddedSections, cohort.extractedSections) < 0.99) {
    reasons.push("embedding rate")
  }
  return reasons
}

function materialGaps(bundle: CorpusEvidenceBundle): CorpusEvidenceBundle["upstreamArtifacts"] {
  return bundle.upstreamArtifacts.filter(
    (artifact) =>
      artifact.material &&
      artifact.policyStatus === "in-policy" &&
      (artifact.sourceRecordCount === null || artifact.sourceRecordCount !== artifact.databaseRecordCount)
  )
}

function taskResult(
  id: CorpusEvidenceTaskId,
  evidenceCount: number,
  reasons: readonly string[]
): CorpusEvidenceTaskResult {
  const uniqueReasons = [...new Set(reasons)].sort()
  return { evidenceCount, id, passed: uniqueReasons.length === 0, reasons: uniqueReasons }
}

function addMissingValues<T extends string>(
  reasons: string[],
  label: string,
  required: readonly T[],
  actual: readonly T[]
): void {
  const observed = new Set(actual)
  const missing = required.filter((value) => !observed.has(value))
  if (missing.length > 0) {
    reasons.push(`missing ${label}: ${missing.join(", ")}`)
  }
}

function addDuplicateReasons(reasons: string[], label: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) {
    reasons.push(`${label} must be unique`)
  }
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(6))
}

function cohortKey(value: { format: string; source: string }): string {
  return `${value.source}:${value.format}`
}

function compareArtifacts(
  left: CorpusEvidenceBundle["evidenceArtifacts"][number],
  right: CorpusEvidenceBundle["evidenceArtifacts"][number]
): number {
  return `${left.category}:${left.path}`.localeCompare(`${right.category}:${right.path}`)
}

function compareVerifications(left: EvidenceArtifactVerification, right: EvidenceArtifactVerification): number {
  return `${left.category}:${left.path}`.localeCompare(`${right.category}:${right.path}`)
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
