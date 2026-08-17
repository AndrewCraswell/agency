import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { z } from "zod"

const artifactKinds = [
  "authenticated-mcp-smoke",
  "bicep-validation",
  "completion-record",
  "corpus-evidence-audit",
  "coverage-report",
  "deployment-smoke",
  "failure-report",
  "gap-reconciliation",
  "govinfo-discovery-manifest",
  "logs-and-traces",
  "migration-from-zero",
  "openstates-discovery-manifest",
  "operational-evidence",
  "orchestration-run",
  "package-verification",
  "workflow-validation"
] as const

const verificationChecks = [
  "authenticated-mcp-smoke",
  "bicep-build",
  "bicep-lint",
  "deployment-smoke",
  "migration-from-zero",
  "package-verify",
  "workflow-validation"
] as const

const observabilityChecks = [
  "azure-alerts",
  "azure-logs",
  "coverage-report",
  "evidence-retention",
  "langfuse-traces",
  "operator-runbooks"
] as const

const orchestrationSteps = ["coverage-report", "document-processing", "embedding-refresh", "source-ingestion"] as const

const expansionDomains = [
  "congress-amendments",
  "congress-events",
  "congress-house-votes",
  "federal-supporting-materials",
  "openstates-entities",
  "openstates-events",
  "openstates-supporting-materials"
] as const

const taskIds = [
  "D1.7",
  "D2.15",
  "D5.7",
  "D5.8",
  "D5.9",
  "E1.5",
  "E2.4",
  "E2.5",
  "E2.9",
  "E3.5",
  "E4.3",
  "E4.6",
  "E4.7",
  "M4.31",
  "M5.28",
  "M14.10",
  "M14.11",
  "M14.12"
] as const

const timestamp = z.iso.datetime()
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, "must be a lowercase SHA-256 digest")
const artifactId = z.string().trim().min(1).max(100)
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

const evidenceArtifact = z
  .object({
    generatedAt: timestamp,
    id: artifactId,
    kind: z.enum(artifactKinds),
    path: relativeArtifactPath,
    sha256
  })
  .strict()

const sourceCompletion = z
  .object({
    completedAt: timestamp,
    coverageArtifactId: artifactId,
    coverageFinal: z.boolean(),
    discoveredArtifacts: z.number().int().positive(),
    failureArtifactId: artifactId,
    manifestArtifactId: artifactId,
    runId: z.uuid(),
    source: z.enum(["govinfo", "openstates"]),
    status: z.enum(["failed", "in-progress", "succeeded"]),
    terminalArtifacts: z.number().int().nonnegative(),
    unexplainedMaterialGaps: z.number().int().nonnegative()
  })
  .strict()

const expansionCompletion = z
  .object({
    completedAt: timestamp,
    coverageArtifactId: artifactId,
    coverageFinal: z.boolean(),
    discoveredRecords: z.number().int().positive(),
    domain: z.enum(expansionDomains),
    failureArtifactId: artifactId,
    runId: z.uuid(),
    status: z.enum(["failed", "in-progress", "succeeded"]),
    terminalRecords: z.number().int().nonnegative(),
    unexplainedMaterialGaps: z.number().int().nonnegative()
  })
  .strict()

const orchestrationRun = z
  .object({
    artifactId,
    completedAt: timestamp,
    jobResults: z
      .array(
        z
          .object({
            applicationRunId: z.uuid(),
            operation: z.string().trim().min(1).max(100),
            status: z.enum(["failed", "partial", "succeeded"])
          })
          .strict()
      )
      .min(4),
    runId: z.uuid(),
    status: z.enum(["failed", "partial", "succeeded"]),
    steps: z.array(z.enum(orchestrationSteps)),
    workflowExecutionUrl: z.url()
  })
  .strict()

const corpusEvidence = z
  .object({
    artifactId,
    passedTasks: z.array(z.enum(["D2.6", "D2.10", "D2.12", "D2.14", "D2.15"])),
    ready: z.boolean()
  })
  .strict()

const gapReconciliation = z
  .object({
    artifactId,
    discoveredArtifacts: z.number().int().positive(),
    reconciledArtifacts: z.number().int().nonnegative(),
    unexplainedMaterialGaps: z.number().int().nonnegative()
  })
  .strict()

const verificationRun = z
  .object({
    artifactIds: z.array(artifactId).min(1),
    checks: z.array(z.enum(verificationChecks)),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    completedAt: timestamp,
    status: z.enum(["failed", "passed"])
  })
  .strict()

const observabilityRun = z
  .object({
    artifactIds: z.array(artifactId).min(1),
    checks: z.array(z.enum(observabilityChecks)),
    completedAt: timestamp,
    status: z.enum(["failed", "passed"])
  })
  .strict()

const completionRecord = z
  .object({
    activeSchedules: z.array(z.string().trim().min(1)).min(1),
    artifactId,
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    corpusCoverage: z.string().trim().min(1),
    evaluationBaseline: z.string().trim().min(1),
    image: z.string().regex(/@sha256:[a-f0-9]{64}$/),
    knownLimitations: z.array(z.string().trim().min(1)),
    migrationState: z.string().trim().min(1),
    performanceBaseline: z.string().trim().min(1),
    processingRates: z.string().trim().min(1),
    publishedAt: timestamp
  })
  .strict()

const developmentEvidenceBundleSchema = z
  .object({
    artifacts: z.array(evidenceArtifact),
    completionRecord: completionRecord.optional(),
    corpusEvidence: corpusEvidence.optional(),
    environment: z.literal("development"),
    expansionCompletions: z.array(expansionCompletion),
    gapReconciliation: gapReconciliation.optional(),
    generatedAt: timestamp,
    observability: observabilityRun.optional(),
    orchestration: orchestrationRun.optional(),
    sourceCompletions: z.array(sourceCompletion),
    verification: verificationRun.optional(),
    version: z.literal(1)
  })
  .strict()
  .superRefine((value, context) => {
    const sources = value.sourceCompletions.map((completion) => completion.source)
    if (new Set(sources).size !== sources.length) {
      context.addIssue({
        code: "custom",
        message: "source completion receipts must be unique",
        path: ["sourceCompletions"]
      })
    }
    const domains = value.expansionCompletions.map((completion) => completion.domain)
    if (new Set(domains).size !== domains.length) {
      context.addIssue({
        code: "custom",
        message: "expansion completion receipts must be unique",
        path: ["expansionCompletions"]
      })
    }
  })

export type DevelopmentEvidenceBundle = z.infer<typeof developmentEvidenceBundleSchema>
export type DevelopmentEvidenceTaskId = (typeof taskIds)[number]

export interface DevelopmentArtifactVerification {
  actualSha256?: string
  id: string
  kind: (typeof artifactKinds)[number]
  path: string
  status: "mismatch" | "missing" | "read-error" | "verified"
}

export interface DevelopmentEvidenceTaskResult {
  id: DevelopmentEvidenceTaskId
  passed: boolean
  reasons: string[]
}

export interface DevelopmentEvidenceAudit {
  artifactVerification: DevelopmentArtifactVerification[]
  environment: "development"
  generatedAt: string
  ready: boolean
  tasks: DevelopmentEvidenceTaskResult[]
  version: 1
}

export function parseDevelopmentEvidenceBundle(value: unknown): DevelopmentEvidenceBundle {
  const bundle = developmentEvidenceBundleSchema.parse(value)
  const ids = bundle.artifacts.map((artifact) => artifact.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error("evidence artifact IDs must be unique")
  }
  const paths = bundle.artifacts.map((artifact) => artifact.path)
  if (new Set(paths).size !== paths.length) {
    throw new Error("evidence artifact paths must be unique")
  }
  return bundle
}

export async function verifyDevelopmentEvidenceArtifacts(
  value: unknown,
  manifestDirectory: string
): Promise<DevelopmentArtifactVerification[]> {
  const bundle = parseDevelopmentEvidenceBundle(value)
  const baseDirectory = resolve(manifestDirectory)
  const results: DevelopmentArtifactVerification[] = []

  for (const artifact of [...bundle.artifacts].sort((left, right) => left.id.localeCompare(right.id))) {
    const artifactFile = resolve(baseDirectory, artifact.path)
    const relativePath = relative(baseDirectory, artifactFile)
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      results.push({ id: artifact.id, kind: artifact.kind, path: artifact.path, status: "read-error" })
      continue
    }
    try {
      const bytes = await readFile(artifactFile)
      const actualSha256 = createHash("sha256").update(bytes).digest("hex")
      results.push({
        actualSha256,
        id: artifact.id,
        kind: artifact.kind,
        path: artifact.path,
        status: actualSha256 === artifact.sha256 ? "verified" : "mismatch"
      })
    } catch (error) {
      results.push({
        id: artifact.id,
        kind: artifact.kind,
        path: artifact.path,
        status: isMissingFileError(error) ? "missing" : "read-error"
      })
    }
  }

  return results
}

export function createDevelopmentEvidenceAudit(
  value: unknown,
  artifactVerification: readonly DevelopmentArtifactVerification[]
): DevelopmentEvidenceAudit {
  const bundle = parseDevelopmentEvidenceBundle(value)
  const verifiedIds = new Set(
    artifactVerification.filter((artifact) => artifact.status === "verified").map((artifact) => artifact.id)
  )
  const tasks = [
    orchestrationTask(bundle, verifiedIds),
    corpusEvidenceTask(bundle, verifiedIds),
    verificationTask(bundle, verifiedIds),
    observabilityTask(bundle, verifiedIds),
    completionRecordTask(bundle, verifiedIds),
    expansionTask(bundle, verifiedIds, "openstates-entities", "E1.5"),
    expansionTask(bundle, verifiedIds, "openstates-events", "E2.4"),
    expansionTask(bundle, verifiedIds, "congress-events", "E2.5"),
    expansionTask(bundle, verifiedIds, "openstates-events", "E2.9", true),
    expansionTask(bundle, verifiedIds, "congress-house-votes", "E3.5"),
    expansionTask(bundle, verifiedIds, "congress-amendments", "E4.3"),
    expansionTask(bundle, verifiedIds, "federal-supporting-materials", "E4.6"),
    expansionTask(bundle, verifiedIds, "openstates-supporting-materials", "E4.7"),
    sourceTask(bundle, verifiedIds, "openstates", "M4.31"),
    sourceTask(bundle, verifiedIds, "govinfo", "M5.28"),
    finalCoverageTask(bundle, verifiedIds, "openstates", "M14.10"),
    finalCoverageTask(bundle, verifiedIds, "govinfo", "M14.11"),
    reconciliationTask(bundle, verifiedIds)
  ]

  return {
    artifactVerification: [...artifactVerification].sort((left, right) => left.id.localeCompare(right.id)),
    environment: bundle.environment,
    generatedAt: bundle.generatedAt,
    ready: tasks.every((task) => task.passed),
    tasks,
    version: 1
  }
}

function orchestrationTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const run = bundle.orchestration
  const reasons: string[] = []
  if (run === undefined) {
    reasons.push("no bounded end-to-end orchestration receipt was provided")
  } else {
    if (run.status !== "succeeded" || run.jobResults.some((result) => result.status !== "succeeded")) {
      reasons.push("the orchestration and every retained job result must succeed")
    }
    addMissingValues(reasons, "orchestration steps", orchestrationSteps, run.steps)
    requireArtifact(reasons, bundle, verifiedIds, run.artifactId, "orchestration-run")
  }
  return taskResult("D1.7", reasons)
}

function corpusEvidenceTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const evidence = bundle.corpusEvidence
  const reasons: string[] = []
  const required = ["D2.6", "D2.10", "D2.12", "D2.14", "D2.15"] as const
  if (evidence === undefined) {
    reasons.push("no passing corpus evidence audit was provided")
  } else {
    if (!evidence.ready) {
      reasons.push("the corpus evidence audit is not ready")
    }
    addMissingValues(reasons, "corpus evidence tasks", required, evidence.passedTasks)
    requireArtifact(reasons, bundle, verifiedIds, evidence.artifactId, "corpus-evidence-audit")
  }
  return taskResult("D2.15", reasons)
}

function verificationTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const run = bundle.verification
  const reasons: string[] = []
  if (run === undefined) {
    reasons.push("no complete development verification receipt was provided")
  } else {
    if (run.status !== "passed") {
      reasons.push("development verification did not pass")
    }
    addMissingValues(reasons, "verification checks", verificationChecks, run.checks)
    requireVerifiedReferences(reasons, bundle, verifiedIds, run.artifactIds)
    requireArtifactKind(reasons, bundle, run.artifactIds, "authenticated-mcp-smoke")
    requireArtifactKind(reasons, bundle, run.artifactIds, "deployment-smoke")
  }
  return taskResult("D5.7", reasons)
}

function observabilityTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const run = bundle.observability
  const reasons: string[] = []
  if (run === undefined) {
    reasons.push("no complete live observability receipt was provided")
  } else {
    if (run.status !== "passed") {
      reasons.push("live observability verification did not pass")
    }
    addMissingValues(reasons, "observability checks", observabilityChecks, run.checks)
    requireVerifiedReferences(reasons, bundle, verifiedIds, run.artifactIds)
    requireArtifactKind(reasons, bundle, run.artifactIds, "logs-and-traces")
    requireArtifactKind(reasons, bundle, run.artifactIds, "operational-evidence")
  }
  return taskResult("D5.8", reasons)
}

function completionRecordTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const record = bundle.completionRecord
  const reasons: string[] = []
  if (record === undefined) {
    reasons.push("no development completion record was provided")
  } else {
    requireArtifact(reasons, bundle, verifiedIds, record.artifactId, "completion-record")
    if (
      !taskPassed(bundle, verifiedIds, orchestrationTask) ||
      !taskPassed(bundle, verifiedIds, corpusEvidenceTask) ||
      !taskPassed(bundle, verifiedIds, verificationTask) ||
      !taskPassed(bundle, verifiedIds, observabilityTask)
    ) {
      reasons.push(
        "orchestration, corpus evidence, verification, and observability must pass before publishing the completion record"
      )
    }
  }
  return taskResult("D5.9", reasons)
}

function expansionTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  domain: (typeof expansionDomains)[number],
  id: "E1.5" | "E2.4" | "E2.5" | "E2.9" | "E3.5" | "E4.3" | "E4.6" | "E4.7",
  requireFinalCoverage = false
): DevelopmentEvidenceTaskResult {
  const completion = bundle.expansionCompletions.find((candidate) => candidate.domain === domain)
  const reasons: string[] = []
  if (completion === undefined) {
    reasons.push(`no ${domain} terminal expansion receipt was provided`)
  } else {
    if (completion.status !== "succeeded") {
      reasons.push(`${domain} expansion is not terminal and successful`)
    }
    if (completion.terminalRecords !== completion.discoveredRecords) {
      reasons.push(`${domain} has nonterminal discovered records`)
    }
    if (completion.unexplainedMaterialGaps !== 0) {
      reasons.push(`${domain} has unexplained material gaps`)
    }
    if (requireFinalCoverage && !completion.coverageFinal) {
      reasons.push(`${domain} coverage is marked as an interim report`)
    }
    requireArtifact(reasons, bundle, verifiedIds, completion.coverageArtifactId, "coverage-report")
    requireArtifact(reasons, bundle, verifiedIds, completion.failureArtifactId, "failure-report")
  }
  return taskResult(id, reasons)
}

function sourceTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  source: "govinfo" | "openstates",
  id: "M4.31" | "M5.28"
): DevelopmentEvidenceTaskResult {
  const completion = findSourceCompletion(bundle, source)
  const reasons: string[] = []
  if (completion === undefined) {
    reasons.push(`no ${source} terminal import receipt was provided`)
  } else {
    addSourceCompletionReasons(reasons, bundle, verifiedIds, completion)
  }
  return taskResult(id, reasons)
}

function finalCoverageTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  source: "govinfo" | "openstates",
  id: "M14.10" | "M14.11"
): DevelopmentEvidenceTaskResult {
  const completion = findSourceCompletion(bundle, source)
  const reasons: string[] = []
  if (completion === undefined) {
    reasons.push(`no ${source} final coverage receipt was provided`)
  } else {
    addSourceCompletionReasons(reasons, bundle, verifiedIds, completion)
    if (!completion.coverageFinal) {
      reasons.push(`${source} coverage is marked as an interim report`)
    }
  }
  return taskResult(id, reasons)
}

function reconciliationTask(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>
): DevelopmentEvidenceTaskResult {
  const reconciliation = bundle.gapReconciliation
  const reasons: string[] = []
  if (reconciliation === undefined) {
    reasons.push("no final discovery-to-coverage reconciliation was provided")
  } else {
    if (reconciliation.reconciledArtifacts !== reconciliation.discoveredArtifacts) {
      reasons.push("not every discovered artifact is represented in the reconciliation")
    }
    if (reconciliation.unexplainedMaterialGaps !== 0) {
      reasons.push("material gaps remain unexplained")
    }
    requireArtifact(reasons, bundle, verifiedIds, reconciliation.artifactId, "gap-reconciliation")
  }
  return taskResult("M14.12", reasons)
}

function addSourceCompletionReasons(
  reasons: string[],
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  completion: DevelopmentEvidenceBundle["sourceCompletions"][number]
): void {
  if (completion.status !== "succeeded") {
    reasons.push(`${completion.source} import is not terminal and successful`)
  }
  if (completion.terminalArtifacts !== completion.discoveredArtifacts) {
    reasons.push(`${completion.source} has nonterminal discovered artifacts`)
  }
  if (completion.unexplainedMaterialGaps !== 0) {
    reasons.push(`${completion.source} has unexplained material gaps`)
  }
  requireArtifact(reasons, bundle, verifiedIds, completion.coverageArtifactId, "coverage-report")
  requireArtifact(reasons, bundle, verifiedIds, completion.failureArtifactId, "failure-report")
  requireArtifact(
    reasons,
    bundle,
    verifiedIds,
    completion.manifestArtifactId,
    completion.source === "openstates" ? "openstates-discovery-manifest" : "govinfo-discovery-manifest"
  )
}

function findSourceCompletion(
  bundle: DevelopmentEvidenceBundle,
  source: "govinfo" | "openstates"
): DevelopmentEvidenceBundle["sourceCompletions"][number] | undefined {
  const completions = bundle.sourceCompletions.filter((completion) => completion.source === source)
  return completions.length === 1 ? completions[0] : undefined
}

function requireArtifact(
  reasons: string[],
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  id: string,
  kind: (typeof artifactKinds)[number]
): void {
  const artifact = bundle.artifacts.find((candidate) => candidate.id === id)
  if (artifact === undefined) {
    reasons.push(`referenced artifact ${id} is not declared`)
  } else if (artifact.kind !== kind) {
    reasons.push(`artifact ${id} must be ${kind}, not ${artifact.kind}`)
  } else if (!verifiedIds.has(id)) {
    reasons.push(`artifact ${id} did not pass SHA-256 verification`)
  }
}

function requireVerifiedReferences(
  reasons: string[],
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  ids: readonly string[]
): void {
  if (new Set(ids).size !== ids.length) {
    reasons.push("artifact references must be unique")
  }
  for (const id of ids) {
    const artifact = bundle.artifacts.find((candidate) => candidate.id === id)
    if (artifact === undefined) {
      reasons.push(`referenced artifact ${id} is not declared`)
    } else if (!verifiedIds.has(id)) {
      reasons.push(`artifact ${id} did not pass SHA-256 verification`)
    }
  }
}

function requireArtifactKind(
  reasons: string[],
  bundle: DevelopmentEvidenceBundle,
  ids: readonly string[],
  kind: (typeof artifactKinds)[number]
): void {
  if (!ids.some((id) => bundle.artifacts.some((artifact) => artifact.id === id && artifact.kind === kind))) {
    reasons.push(`no ${kind} artifact is referenced`)
  }
}

function taskPassed(
  bundle: DevelopmentEvidenceBundle,
  verifiedIds: ReadonlySet<string>,
  evaluate: (bundle: DevelopmentEvidenceBundle, verifiedIds: ReadonlySet<string>) => DevelopmentEvidenceTaskResult
): boolean {
  return evaluate(bundle, verifiedIds).passed
}

function taskResult(id: DevelopmentEvidenceTaskId, reasons: readonly string[]): DevelopmentEvidenceTaskResult {
  const uniqueReasons = [...new Set(reasons)].sort()
  return { id, passed: uniqueReasons.length === 0, reasons: uniqueReasons }
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
