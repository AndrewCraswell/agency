import { z } from "zod"

export const ASSIGNMENT_SCHEMA_VERSION = "1" as const

const GitCommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Expected a full lowercase Git commit SHA")
const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest")
const RelativePathPatternSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/") && !path.includes("\\") && !/(^|\/)\.\.(\/|$)/u.test(path), {
    message: "Expected a repository-relative POSIX path pattern without parent traversal"
  })

const RepositorySchema = z
  .object({
    provider: z.literal("github"),
    owner: z.string().min(1),
    name: z.string().min(1)
  })
  .strict()

const ValidationCommandSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    command: z.string().trim().min(1),
    workingDirectory: RelativePathPatternSchema,
    timeoutMs: z.number().int().positive().max(3_600_000)
  })
  .strict()

const AssignmentBudgetsSchema = z
  .object({
    maxTurns: z.number().int().positive(),
    maxTokens: z.number().int().positive(),
    maxElapsedMs: z.number().int().positive(),
    maxRepairAttempts: z.number().int().nonnegative()
  })
  .strict()

const AssignmentPathPolicySchema = z
  .object({
    allowed: z.array(RelativePathPatternSchema).min(1),
    forbidden: z.array(RelativePathPatternSchema)
  })
  .strict()

export const AssignmentSchema = z
  .object({
    schemaVersion: z.literal(ASSIGNMENT_SCHEMA_VERSION),
    runId: z.uuid(),
    roleExecutionId: z.uuid(),
    repository: RepositorySchema,
    baseCommitSha: GitCommitShaSchema,
    objective: z.string().trim().min(1),
    acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
    relevantPaths: z.array(RelativePathPatternSchema),
    validationCommands: z.array(ValidationCommandSchema).min(1),
    pathPolicy: AssignmentPathPolicySchema,
    budgets: AssignmentBudgetsSchema,
    contextBundle: z
      .object({
        uri: z.url(),
        sha256: Sha256DigestSchema
      })
      .strict(),
    promptVersion: z.string().trim().min(1),
    workerImageVersion: z.string().trim().min(1)
  })
  .strict()

export type Assignment = z.infer<typeof AssignmentSchema>
