import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { PlanningResultSchema } from "../contracts/specialized"
import { OPENHANDS_AGENT_SERVER_IMAGE } from "../openhands/profiles"

const RepositorySchema = z
  .object({ provider: z.literal("github"), owner: z.string().trim().min(1), name: z.string().trim().min(1) })
  .strict()

export function assignmentFromPlan(
  planInput: unknown,
  repositoryInput: unknown,
  roleExecutionId: () => string = randomUUID
): Assignment {
  const plan = PlanningResultSchema.parse(planInput)
  const repository = RepositorySchema.parse(repositoryInput)
  if (plan.disposition !== "ready") {
    throw new Error("Only a ready planning result can become an engineering assignment")
  }
  const contextBundle = plan.contextEvidence[0] ?? {
    uri: plan.sourceWorkItem.url,
    sha256: createHash("sha256").update(JSON.stringify(plan.sourceWorkItem)).digest("hex")
  }
  return AssignmentSchema.parse({
    schemaVersion: "1",
    runId: plan.runId,
    roleExecutionId: roleExecutionId(),
    repository,
    baseCommitSha: plan.baseCommitSha,
    objective: plan.objective,
    acceptanceCriteria: plan.acceptanceCriteria,
    relevantPaths: plan.relevantPaths,
    validationCommands: plan.validationCommands,
    pathPolicy: plan.pathPolicy,
    budgets: {
      maxTurns: plan.configuredBudget.maxTurns,
      maxTokens: plan.configuredBudget.maxInputTokens + plan.configuredBudget.maxOutputTokens,
      maxElapsedMs: plan.configuredBudget.maxElapsedMs,
      maxRepairAttempts: 3
    },
    contextBundle,
    promptVersion: "coder-v1",
    workerImageVersion: OPENHANDS_AGENT_SERVER_IMAGE
  })
}
