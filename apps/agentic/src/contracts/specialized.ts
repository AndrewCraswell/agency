import { createHash } from "node:crypto"
import { z } from "zod"
import { LinearWorkItemSchema } from "./linear"
import { CommandResultSchema } from "./results"

export const SPECIALIZED_CONTRACT_SCHEMA_VERSION = "1" as const

const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Expected a full lowercase Git commit SHA")
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest")
const IsoTimestampSchema = z.iso.datetime({ offset: true })
const FindingIdSchema = z.string().regex(/^finding_[0-9a-f]{24}$/u, "Expected a stable review finding ID")
const RelativePathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/") && !path.includes("\\") && !/(^|\/)\.\.(\/|$)/u.test(path), {
    message: "Expected a repository-relative POSIX path without parent traversal"
  })

export const AgentRoleSchema = z.enum(["scrum_master", "coder", "reviewer", "repairer"])
export const PlanningDispositionSchema = z.enum(["ready", "blocked"])
export const CodingStatusSchema = z.enum(["completed", "blocked", "failed"])
export const ReviewDispositionSchema = z.enum(["approved", "changes_requested", "blocked"])
export const RepairStatusSchema = z.enum(["completed", "blocked", "failed"])

export const ModelProfileSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    profileId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    role: AgentRoleSchema,
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"])
  })
  .strict()

export const PromptVersionSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    role: AgentRoleSchema,
    version: z.string().regex(/^v[1-9][0-9]*$/u),
    sha256: Sha256DigestSchema
  })
  .strict()

export const WorkspaceIdentitySchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    provider: z.literal("daytona"),
    workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u),
    repositoryPath: z.string().startsWith("/"),
    commitSha: GitCommitShaSchema,
    conversationId: z.string().trim().min(1).nullable()
  })
  .strict()

export const RoleBudgetLimitsSchema = z
  .object({
    maxTurns: z.number().int().positive(),
    maxInputTokens: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    maxElapsedMs: z.number().int().positive(),
    maxEstimatedSpendUsd: z.number().nonnegative()
  })
  .strict()

export const BudgetConsumptionSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    limits: RoleBudgetLimitsSchema,
    turns: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    elapsedMs: z.number().int().nonnegative(),
    estimatedSpendUsd: z.number().nonnegative(),
    actualSpendUsd: z.number().nonnegative().nullable()
  })
  .strict()

const roleAttemptSchema = (role: z.infer<typeof AgentRoleSchema>) =>
  z
    .object({
      schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
      runId: z.uuid(),
      roleExecutionId: z.uuid(),
      role: z.literal(role),
      attempt: z.number().int().positive(),
      modelProfile: ModelProfileSchema,
      prompt: PromptVersionSchema,
      workspace: WorkspaceIdentitySchema.nullable(),
      budget: BudgetConsumptionSchema,
      startedAt: IsoTimestampSchema,
      endedAt: IsoTimestampSchema
    })
    .strict()
    .superRefine((attempt, context) => {
      if (attempt.modelProfile.role !== role) {
        context.addIssue({
          code: "custom",
          message: "Model profile role must match the attempt role",
          path: ["modelProfile", "role"]
        })
      }
      if (attempt.prompt.role !== role) {
        context.addIssue({
          code: "custom",
          message: "Prompt role must match the attempt role",
          path: ["prompt", "role"]
        })
      }
      if (Date.parse(attempt.endedAt) < Date.parse(attempt.startedAt)) {
        context.addIssue({
          code: "custom",
          message: "Role attempt end time must not precede its start time",
          path: ["endedAt"]
        })
      }
    })

export const ScrumMasterAttemptSchema = roleAttemptSchema("scrum_master")
export const CoderAttemptSchema = roleAttemptSchema("coder")
export const ReviewerAttemptSchema = roleAttemptSchema("reviewer")
export const RepairerAttemptSchema = roleAttemptSchema("repairer")
export const RoleAttemptSchema = z.union([
  ScrumMasterAttemptSchema,
  CoderAttemptSchema,
  ReviewerAttemptSchema,
  RepairerAttemptSchema
])

export const EvidenceReferenceSchema = z
  .object({
    uri: z.url(),
    sha256: Sha256DigestSchema
  })
  .strict()

export const RoleBlockerSchema = z
  .object({
    category: z.enum(["ambiguity", "dependency", "policy", "budget", "tool", "repository", "validation", "internal"]),
    message: z.string().trim().min(1),
    evidence: z.array(EvidenceReferenceSchema)
  })
  .strict()

const ValidationCommandSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    command: z.string().trim().min(1),
    workingDirectory: RelativePathSchema,
    timeoutMs: z.number().int().positive().max(3_600_000)
  })
  .strict()

export const PlanningResultSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleAttempt: ScrumMasterAttemptSchema,
    disposition: PlanningDispositionSchema,
    sourceWorkItem: LinearWorkItemSchema,
    objective: z.string().trim().min(1),
    acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
    baseCommitSha: GitCommitShaSchema,
    relevantPaths: z.array(RelativePathSchema),
    contextEvidence: z.array(EvidenceReferenceSchema),
    validationCommands: z.array(ValidationCommandSchema).min(1),
    pathPolicy: z
      .object({
        allowed: z.array(RelativePathSchema).min(1),
        forbidden: z.array(RelativePathSchema)
      })
      .strict(),
    risks: z.array(z.string().trim().min(1)),
    dependencies: z.array(z.string().trim().min(1)),
    blockers: z.array(RoleBlockerSchema),
    taskClass: z.enum(["small", "medium", "large"]),
    configuredBudget: RoleBudgetLimitsSchema
  })
  .strict()
  .superRefine((result, context) => {
    if (result.runId !== result.roleAttempt.runId) {
      context.addIssue({ code: "custom", message: "Planning run ID must match the role attempt", path: ["runId"] })
    }
    if (result.disposition === "ready" && result.blockers.length > 0) {
      context.addIssue({ code: "custom", message: "A ready plan cannot contain blockers", path: ["blockers"] })
    }
    if (result.disposition === "blocked" && result.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A blocked plan must contain a structured blocker",
        path: ["blockers"]
      })
    }
  })

const AgentCommandClaimSchema = z
  .object({
    command: z.string().trim().min(1),
    claimedOutcome: z.enum(["passed", "failed", "not_run"]),
    summary: z.string().trim().min(1)
  })
  .strict()

export const CodingResultSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleAttempt: CoderAttemptSchema,
    status: CodingStatusSchema,
    summary: z.string().trim().min(1),
    baseCommitSha: GitCommitShaSchema,
    resultingCommitSha: GitCommitShaSchema,
    changedFiles: z.array(RelativePathSchema),
    patchArtifact: EvidenceReferenceSchema.nullable(),
    agentCommandClaims: z.array(AgentCommandClaimSchema),
    independentValidationResults: z.array(CommandResultSchema),
    workspace: WorkspaceIdentitySchema,
    unresolvedBlockers: z.array(RoleBlockerSchema)
  })
  .strict()
  .superRefine((result, context) => {
    if (result.runId !== result.roleAttempt.runId) {
      context.addIssue({ code: "custom", message: "Coding run ID must match the role attempt", path: ["runId"] })
    }
    if (result.status === "completed" && result.unresolvedBlockers.length > 0) {
      context.addIssue({
        code: "custom",
        message: "A completed coding result cannot contain unresolved blockers",
        path: ["unresolvedBlockers"]
      })
    }
    if (result.status !== "completed" && result.unresolvedBlockers.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A non-completed coding result must contain a blocker",
        path: ["unresolvedBlockers"]
      })
    }
  })

export const ReviewFindingCategorySchema = z.enum([
  "correctness",
  "regression",
  "security",
  "data_loss",
  "test_gap",
  "scope",
  "maintainability"
])

export const FindingLocatorSchema = z
  .object({
    path: RelativePathSchema,
    line: z.number().int().positive().nullable(),
    symbol: z.string().trim().min(1).nullable()
  })
  .strict()
  .superRefine((locator, context) => {
    if (locator.line === null && locator.symbol === null) {
      context.addIssue({ code: "custom", message: "A finding locator requires a line or symbol", path: ["line"] })
    }
  })

const ReviewFindingIdentitySchema = z
  .object({
    runId: z.uuid(),
    reviewAttempt: z.number().int().positive(),
    locator: FindingLocatorSchema,
    category: ReviewFindingCategorySchema,
    finding: z.string().trim().min(1)
  })
  .strict()

function normalizeFindingText(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase()
}

function reviewFindingIdentity(input: z.input<typeof ReviewFindingIdentitySchema>) {
  return {
    runId: input.runId,
    reviewAttempt: input.reviewAttempt,
    locator: input.locator,
    category: input.category,
    finding: input.finding
  }
}

function hashReviewFindingIdentity(identity: z.output<typeof ReviewFindingIdentitySchema>): string {
  const canonicalIdentity = {
    runId: identity.runId,
    reviewAttempt: identity.reviewAttempt,
    locator: {
      path: identity.locator.path,
      line: identity.locator.line,
      symbol: identity.locator.symbol
    },
    category: identity.category,
    finding: normalizeFindingText(identity.finding)
  }
  return `finding_${createHash("sha256").update(JSON.stringify(canonicalIdentity)).digest("hex").slice(0, 24)}`
}

export function stableReviewFindingId(input: z.input<typeof ReviewFindingIdentitySchema>): string {
  return hashReviewFindingIdentity(ReviewFindingIdentitySchema.parse(reviewFindingIdentity(input)))
}

export const ReviewFindingSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    id: FindingIdSchema,
    runId: z.uuid(),
    reviewAttempt: z.number().int().positive(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    category: ReviewFindingCategorySchema,
    locator: FindingLocatorSchema,
    finding: z.string().trim().min(1),
    evidence: z.string().trim().min(1),
    expectedBehavior: z.string().trim().min(1),
    actionable: z.boolean(),
    confidence: z.number().min(0).max(1)
  })
  .strict()
  .superRefine((finding, context) => {
    const identity = ReviewFindingIdentitySchema.safeParse(reviewFindingIdentity(finding))
    if (identity.success && finding.id !== hashReviewFindingIdentity(identity.data)) {
      context.addIssue({ code: "custom", message: "Finding ID does not match its stable identity", path: ["id"] })
    }
  })

export const ReviewResultSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleAttempt: ReviewerAttemptSchema,
    reviewAttempt: z.number().int().positive(),
    candidateCommitSha: GitCommitShaSchema,
    disposition: ReviewDispositionSchema,
    findings: z.array(ReviewFindingSchema),
    blockedReasons: z.array(RoleBlockerSchema)
  })
  .strict()
  .superRefine((result, context) => {
    if (result.runId !== result.roleAttempt.runId) {
      context.addIssue({ code: "custom", message: "Review run ID must match the role attempt", path: ["runId"] })
    }
    const findingIds = new Set<string>()
    for (const [index, finding] of result.findings.entries()) {
      if (finding.runId !== result.runId || finding.reviewAttempt !== result.reviewAttempt) {
        context.addIssue({
          code: "custom",
          message: "Finding identity must match its review",
          path: ["findings", index]
        })
      }
      if (findingIds.has(finding.id)) {
        context.addIssue({
          code: "custom",
          message: "Review finding IDs must be unique",
          path: ["findings", index, "id"]
        })
      }
      findingIds.add(finding.id)
    }

    const hasActionableFinding = result.findings.some((finding) => finding.actionable)
    if (result.disposition === "changes_requested" && !hasActionableFinding) {
      context.addIssue({
        code: "custom",
        message: "Requested changes require an actionable finding",
        path: ["findings"]
      })
    }
    const hasApprovalBlockingFinding = result.findings.some(
      (finding) => finding.severity !== "low" || finding.actionable
    )
    if (result.disposition === "approved" && hasApprovalBlockingFinding) {
      context.addIssue({
        code: "custom",
        message: "An approved review cannot contain approval-blocking findings",
        path: ["findings"]
      })
    }
    if (result.disposition === "blocked" && result.blockedReasons.length === 0) {
      context.addIssue({
        code: "custom",
        message: "A blocked review requires a structured reason",
        path: ["blockedReasons"]
      })
    }
    if (result.disposition !== "blocked" && result.blockedReasons.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Only a blocked review can contain blocked reasons",
        path: ["blockedReasons"]
      })
    }
  })

const DeclinedFindingSchema = z
  .object({
    findingId: FindingIdSchema,
    reason: z.enum(["incorrect", "already_resolved", "out_of_scope", "blocked_by_dependency"]),
    explanation: z.string().trim().min(1)
  })
  .strict()

export const RepairResultSchema = z
  .object({
    schemaVersion: z.literal(SPECIALIZED_CONTRACT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleAttempt: RepairerAttemptSchema,
    repairAttempt: z.number().int().positive(),
    reviewedCandidateCommitSha: GitCommitShaSchema,
    resultingCommitSha: GitCommitShaSchema,
    status: RepairStatusSchema,
    addressedFindingIds: z.array(FindingIdSchema),
    declinedFindings: z.array(DeclinedFindingSchema),
    remainingActionableFindingIds: z.array(FindingIdSchema),
    changedFiles: z.array(RelativePathSchema),
    patchArtifact: EvidenceReferenceSchema.nullable(),
    independentValidationResults: z.array(CommandResultSchema),
    workspace: WorkspaceIdentitySchema,
    blockers: z.array(RoleBlockerSchema)
  })
  .strict()
  .superRefine((result, context) => {
    if (result.runId !== result.roleAttempt.runId) {
      context.addIssue({ code: "custom", message: "Repair run ID must match the role attempt", path: ["runId"] })
    }
    const handledFindingIds = [
      ...result.addressedFindingIds,
      ...result.declinedFindings.map((finding) => finding.findingId),
      ...result.remainingActionableFindingIds
    ]
    if (new Set(handledFindingIds).size !== handledFindingIds.length) {
      context.addIssue({
        code: "custom",
        message: "A finding can have only one repair outcome",
        path: ["addressedFindingIds"]
      })
    }
    if (
      result.status === "completed" &&
      (result.blockers.length > 0 || result.remainingActionableFindingIds.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "A completed repair cannot retain blockers or actionable findings",
        path: ["status"]
      })
    }
    if (result.status !== "completed" && result.blockers.length === 0) {
      context.addIssue({ code: "custom", message: "A non-completed repair requires a blocker", path: ["blockers"] })
    }
  })

export function repairResultSchemaFor(latestReviewInput: unknown) {
  const latestReview = ReviewResultSchema.parse(latestReviewInput)
  const latestFindingIds = new Set(latestReview.findings.map((finding) => finding.id))
  const actionableFindingIds = new Set(
    latestReview.findings.filter((finding) => finding.actionable).map((finding) => finding.id)
  )

  return RepairResultSchema.superRefine((result, context) => {
    if (result.runId !== latestReview.runId) {
      context.addIssue({ code: "custom", message: "Repair run ID must match the latest review", path: ["runId"] })
    }
    if (result.reviewedCandidateCommitSha !== latestReview.candidateCommitSha) {
      context.addIssue({
        code: "custom",
        message: "Repair candidate SHA must match the latest review",
        path: ["reviewedCandidateCommitSha"]
      })
    }
    const references = [
      ...result.addressedFindingIds,
      ...result.declinedFindings.map((finding) => finding.findingId),
      ...result.remainingActionableFindingIds
    ]
    for (const findingId of references) {
      if (!latestFindingIds.has(findingId)) {
        context.addIssue({
          code: "custom",
          message: "Repair references a finding absent from the latest review",
          path: ["addressedFindingIds"]
        })
      }
    }
    for (const findingId of result.remainingActionableFindingIds) {
      if (!actionableFindingIds.has(findingId)) {
        context.addIssue({
          code: "custom",
          message: "Remaining findings must be actionable in the latest review",
          path: ["remainingActionableFindingIds"]
        })
      }
    }
  })
}
