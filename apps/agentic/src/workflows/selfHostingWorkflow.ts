import { z } from "zod"
import {
  WorkflowDefinitionV2Schema,
  WorkflowResourceBindingV2Schema,
  type WorkflowConnectionV2Schema,
  type WorkflowDefinitionV2,
  type WorkflowStepInstance
} from "./definitionV2"
import { RepositoryAgentReferenceSchema } from "./repositoryAgents"

type ResourceBinding = z.infer<typeof WorkflowResourceBindingV2Schema>
type RepositoryAgentReference = z.infer<typeof RepositoryAgentReferenceSchema>
type WorkflowConnection = z.infer<typeof WorkflowConnectionV2Schema>

export type SelfHostingWorkflowInput = {
  repository: ResourceBinding
  linearTeam: ResourceBinding
  planners: RepositoryAgentReference[]
  implementer: RepositoryAgentReference
  reviewer: RepositoryAgentReference
  repairer: RepositoryAgentReference
}

function agentStep(
  id: string,
  label: string,
  position: { x: number; y: number },
  agentReference: RepositoryAgentReference,
  instructions: string
): WorkflowStepInstance {
  return {
    id,
    label,
    position,
    definition: { kind: "repository_agent", version: 1 },
    config: { agentReference, instructions },
    failurePolicy: { mode: "stop", maximumAttempts: 2 }
  }
}

function connection(
  id: string,
  sourceStepId: string,
  sourcePort: string,
  targetStepId: string,
  targetPort: string,
  loopBack = false
): WorkflowConnection {
  return {
    id,
    source: { stepId: sourceStepId, port: sourcePort },
    target: { stepId: targetStepId, port: targetPort },
    outcome: "success",
    ...(loopBack ? { loopBack: true } : {}),
    mappings: [{ sourcePath: [], targetPath: [] }]
  }
}

export function createSelfHostingWorkflowDefinition(input: SelfHostingWorkflowInput): WorkflowDefinitionV2 {
  const repository = WorkflowResourceBindingV2Schema.parse(input.repository)
  const linearTeam = WorkflowResourceBindingV2Schema.parse(input.linearTeam)
  if (repository.provider !== "github" || repository.resourceType !== "repository") {
    throw new Error("Self-hosting requires a GitHub repository binding")
  }
  if (linearTeam.provider !== "linear" || linearTeam.resourceType !== "team") {
    throw new Error("Self-hosting requires a Linear team binding")
  }
  const planners = z.array(RepositoryAgentReferenceSchema).min(2).max(4).parse(input.planners)
  const implementer = RepositoryAgentReferenceSchema.parse(input.implementer)
  const reviewer = RepositoryAgentReferenceSchema.parse(input.reviewer)
  const repairer = RepositoryAgentReferenceSchema.parse(input.repairer)
  const plannerSteps = planners.map((planner, index) =>
    agentStep(
      `planner-${index + 1}`,
      `Plan with ${planner.name}`,
      { x: 280, y: index * 180 },
      planner,
      `Produce a bounded implementation plan from the immutable Linear event and repository context. Return structured evidence, owned paths, risks, validation commands, and plannerKey "${planner.contentDigest}".`
    )
  )
  const steps: WorkflowStepInstance[] = [
    {
      id: "linear-task",
      label: "Linear task ready",
      position: { x: 0, y: 180 },
      definition: { kind: "provider_event", version: 1 },
      config: { provider: "linear", eventKey: "task.created", binding: linearTeam },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    },
    ...plannerSteps,
    {
      id: "planning-join",
      label: "Join planning evidence",
      position: { x: 600, y: 180 },
      definition: { kind: "collect", version: 1 },
      config: { mode: "keyed", keyField: "plannerKey", maximumItems: 4 },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    },
    agentStep(
      "implement",
      "Implement approved plan",
      { x: 880, y: 180 },
      implementer,
      "Implement from the joined immutable planning results. Preserve the supplied base commit and return the candidate commit plus validation evidence."
    ),
    agentStep(
      "initial-review",
      "Review candidate",
      { x: 1160, y: 180 },
      reviewer,
      "Review the immutable candidate commit. Return a structured result containing an approved boolean, stable findings, and evidence."
    ),
    {
      id: "review-loop",
      label: "Repair until approved",
      position: { x: 1440, y: 180 },
      definition: { kind: "bounded_loop", version: 1 },
      config: {
        maximumIterations: 3,
        maximumActivations: 12,
        condition: { path: ["approved"], operator: "not_equals", value: true },
        bodyStepId: "repair",
        exitStepId: "success",
        onExhaustion: "fail"
      },
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    },
    agentStep(
      "repair",
      "Repair candidate",
      { x: 1720, y: 80 },
      repairer,
      "Repair only the stable review findings against the immutable candidate and return a new candidate commit with validation evidence."
    ),
    agentStep(
      "re-review",
      "Re-review candidate",
      { x: 2000, y: 80 },
      reviewer,
      "Re-review the repaired candidate. Return a structured result containing an approved boolean, stable findings, and evidence."
    ),
    {
      id: "success",
      label: "Change approved",
      position: { x: 1720, y: 300 },
      definition: { kind: "success", version: 1 },
      config: {},
      failurePolicy: { mode: "stop", maximumAttempts: 1 }
    }
  ]
  const connections: WorkflowConnection[] = [
    ...plannerSteps.map((planner) => connection(`event-${planner.id}`, "linear-task", "event", planner.id, "context")),
    ...plannerSteps.map((planner) => connection(`${planner.id}-join`, planner.id, "result", "planning-join", "items")),
    connection("join-implement", "planning-join", "collection", "implement", "context"),
    connection("implement-review", "implement", "result", "initial-review", "context"),
    connection("review-loop", "initial-review", "result", "review-loop", "state"),
    {
      ...connection("loop-repair", "review-loop", "iteration", "repair", "context"),
      mappings: [{ sourcePath: ["state"], targetPath: [] }]
    },
    connection("repair-review", "repair", "result", "re-review", "context"),
    connection("re-review-loop", "re-review", "result", "review-loop", "state", true),
    connection("loop-success", "review-loop", "result", "success", "result")
  ]

  return WorkflowDefinitionV2Schema.parse({
    schemaVersion: "2",
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: { type: "object", additionalProperties: true },
    constants: {},
    resourceBindings: { repository, linearTeam },
    fixtures: [],
    steps,
    connections
  })
}
