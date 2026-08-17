import { z } from "zod"

const alertNames = [
  "document-failure-rate",
  "embedding-backlog",
  "infrastructure-health",
  "mcp-failures",
  "readiness-failure",
  "scheduled-sync-failure",
  "stalled-checkpoint"
] as const

const diagnosticScenarios = [
  "database-outage",
  "document-extraction-failure",
  "openrouter-failure",
  "provider-timeout"
] as const

const evidenceReference = z.string().trim().min(1).max(1000)
const immutableImage = z.string().regex(/@sha256:[a-f0-9]{64}$/, "must be an immutable SHA-256 image reference")
const timestamp = z.iso.datetime()

const alertEvidence = z
  .object({
    actionGroupIds: z.array(z.string().startsWith("/subscriptions/")).min(1),
    firedAt: timestamp,
    name: z.enum(alertNames),
    recoveryEvidence: evidenceReference,
    resolvedAt: timestamp,
    ruleId: z.string().startsWith("/subscriptions/"),
    state: z.literal("resolved")
  })
  .strict()
  .refine((value) => new Date(value.resolvedAt) >= new Date(value.firedAt), {
    message: "resolvedAt must not precede firedAt",
    path: ["resolvedAt"]
  })

const diagnosticEvidence = z
  .object({
    applicationEvidence: evidenceReference,
    checkpointPreserved: z.literal(true),
    correlationId: z.string().trim().min(1),
    recoveryEvidence: evidenceReference,
    recoveryVerified: z.literal(true),
    runId: z.uuid(),
    scenario: z.enum(diagnosticScenarios),
    workflowEvidence: evidenceReference,
    workflowExecutionId: z.string().trim().min(1)
  })
  .strict()

const databaseRestoreEvidence = z
  .object({
    activeTargetFingerprint: z.string().trim().min(1),
    activeTargetUnchanged: z.literal(true),
    backupId: z.string().trim().min(1),
    healthStatus: z.literal(200),
    migrationState: z.string().trim().min(1),
    pgvectorVersion: z.string().trim().min(1),
    readinessStatus: z.literal(200),
    restoredTargetFingerprint: z.string().trim().min(1),
    restoredWorkflowIds: z.array(z.string().trim().min(1)).min(10),
    smokeToolCalls: z.number().int().min(21),
    verifiedAt: timestamp
  })
  .strict()
  .refine((value) => value.activeTargetFingerprint !== value.restoredTargetFingerprint, {
    message: "restored target must be disposable and distinct from the active target",
    path: ["restoredTargetFingerprint"]
  })
  .refine((value) => new Set(value.restoredWorkflowIds).size === value.restoredWorkflowIds.length, {
    message: "restored workflow IDs must be unique",
    path: ["restoredWorkflowIds"]
  })

const deploymentRecoveryEvidence = z
  .object({
    failedImage: immutableImage,
    failedRevision: z.string().trim().min(1),
    failureObserved: z.literal(true),
    healthStatus: z.literal(200),
    readinessStatus: z.literal(200),
    recoveredImage: immutableImage,
    recoveredRevision: z.string().trim().min(1),
    recoveryEvidence: evidenceReference,
    smokeToolCalls: z.number().int().min(21),
    strategy: z.enum(["forward-fix", "rollback"]),
    verifiedAt: timestamp
  })
  .strict()
  .refine((value) => value.failedRevision !== value.recoveredRevision, {
    message: "recovery must end on a revision distinct from the failed revision",
    path: ["recoveredRevision"]
  })
  .refine((value) => value.failedImage !== value.recoveredImage, {
    message: "recovery must replace the failed immutable image",
    path: ["recoveredImage"]
  })

const operationalEvidenceSchema = z
  .object({
    alerts: z.array(alertEvidence),
    databaseRestore: databaseRestoreEvidence,
    deploymentRecovery: deploymentRecoveryEvidence,
    diagnostics: z.array(diagnosticEvidence),
    environment: z.enum(["development", "production", "staging"]),
    generatedAt: timestamp,
    version: z.literal(1)
  })
  .strict()
  .superRefine((value, context) => {
    for (const [path, actual, required] of [
      ["alerts", value.alerts.map((alert) => alert.name), alertNames],
      ["diagnostics", value.diagnostics.map((diagnostic) => diagnostic.scenario), diagnosticScenarios]
    ] as const) {
      const observed = new Set(actual)
      const missing = required.filter((name) => !observed.has(name))
      if (missing.length > 0) {
        context.addIssue({
          code: "custom",
          message: `missing required evidence: ${missing.join(", ")}`,
          path: [path]
        })
      }
      if (observed.size !== actual.length) {
        context.addIssue({ code: "custom", message: "evidence entries must be unique", path: [path] })
      }
    }
  })

export type OperationalEvidence = z.infer<typeof operationalEvidenceSchema>

export function validateOperationalEvidence(value: unknown): OperationalEvidence {
  return operationalEvidenceSchema.parse(value)
}
