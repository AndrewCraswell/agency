import { describe, expect, it } from "vitest"
import { z } from "zod"
import { compileWorkflowDefinition } from "./compiler"
import type { WorkflowResourceBindingV2Schema } from "./definitionV2"
import { RepositoryAgentSnapshotSchema, type RepositoryAgentSnapshot } from "./repositoryAgents"
import { createSelfHostingWorkflowDefinition } from "./selfHostingWorkflow"
import { CURRENT_WORKFLOW_RELEASE_PHASE } from "./stepRegistry"

const workflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const connectionId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"

function binding(
  provider: "github" | "linear",
  resourceType: "repository" | "team",
  externalId: string,
  name: string,
  capabilities: string[]
): z.infer<typeof WorkflowResourceBindingV2Schema> {
  return { connectionId, provider, resourceType, externalId, name, capabilities }
}

function snapshot(role: string, index: number): RepositoryAgentSnapshot {
  const digestCharacter = (index + 10).toString(16)
  const contentDigest = digestCharacter.repeat(64)
  const body = `Act as the ${role}.`
  return {
    reference: {
      connectionId,
      repositoryId: "agency",
      repositoryName: "agency/agency",
      ref: "main",
      path: `.github/agents/${role}.agent.md`,
      observedCommitSha: "a".repeat(40),
      blobSha: digestCharacter.repeat(40),
      contentDigest,
      sourceUrl: `https://github.com/agency/agency/blob/main/.github/agents/${role}.agent.md`,
      name: role,
      description: `${role} for Agency`,
      requestedTools: ["read"]
    },
    content: `---\nname: ${role}\ndescription: ${role} for Agency\n---\n${body}`,
    body,
    parserVersion: "1",
    effectiveModel: null,
    effectiveTools: ["read"]
  }
}

describe("createSelfHostingWorkflowDefinition", () => {
  it("compiles a deterministic multi-agent planning and bounded review workflow", () => {
    const snapshots = [
      snapshot("architecture-planner", 1),
      snapshot("test-planner", 2),
      snapshot("implementer", 3),
      snapshot("reviewer", 4),
      snapshot("repairer", 5)
    ]
    const definition = createSelfHostingWorkflowDefinition({
      repository: binding("github", "repository", "agency", "agency/agency", ["repository.read"]),
      linearTeam: binding("linear", "team", "agency-team", "Agency", ["provider.events"]),
      planners: snapshots.slice(0, 2).map(({ reference }) => reference),
      implementer: snapshots[2]!.reference,
      reviewer: snapshots[3]!.reference,
      repairer: snapshots[4]!.reference
    })
    const compiled = compileWorkflowDefinition({
      workflowId,
      workflowVersion: 1,
      definition,
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE,
      agentSnapshots: snapshots
    })
    const reordered = compileWorkflowDefinition({
      workflowId,
      workflowVersion: 1,
      definition: {
        ...definition,
        steps: [...definition.steps].reverse(),
        connections: [...definition.connections].reverse()
      },
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE,
      agentSnapshots: [...snapshots].reverse()
    })

    expect(reordered.digest).toBe(compiled.digest)
    const pinnedSnapshots = z.array(RepositoryAgentSnapshotSchema).parse(compiled.content.agentSnapshots)
    expect(pinnedSnapshots.map(({ reference }) => reference.contentDigest)).toEqual(
      snapshots.map(({ reference }) => reference.contentDigest).sort()
    )
    expect(definition.steps.filter(({ id }) => id.startsWith("planner-"))).toHaveLength(2)
    expect(definition.steps.find(({ id }) => id === "planning-join")?.config).toEqual({
      mode: "keyed",
      keyField: "plannerKey",
      maximumItems: 4
    })
    expect(definition.steps.find(({ id }) => id === "review-loop")?.config).toEqual({
      maximumIterations: 3,
      maximumActivations: 12,
      condition: { path: ["approved"], operator: "not_equals", value: true },
      bodyStepId: "repair",
      exitStepId: "success",
      onExhaustion: "fail"
    })
    expect(definition.connections.filter(({ target }) => target.stepId === "planning-join")).toHaveLength(2)
    expect(definition.connections.find(({ id }) => id === "re-review-loop")?.loopBack).toBe(true)
  })

  it("requires bounded planning fan-out and explicit provider bindings", () => {
    const planner = snapshot("planner", 1)
    const implementer = snapshot("implementer", 2)
    const reviewer = snapshot("reviewer", 3)
    const repairer = snapshot("repairer", 4)
    const input = {
      repository: binding("github", "repository", "agency", "agency/agency", ["repository.read"]),
      linearTeam: binding("linear", "team", "agency-team", "Agency", ["provider.events"]),
      planners: [planner.reference],
      implementer: implementer.reference,
      reviewer: reviewer.reference,
      repairer: repairer.reference
    }

    expect(() => createSelfHostingWorkflowDefinition(input)).toThrow()
    expect(() =>
      createSelfHostingWorkflowDefinition({
        ...input,
        repository: binding("linear", "team", "agency-team", "Agency", ["provider.events"]),
        planners: [planner.reference, planner.reference]
      })
    ).toThrow("GitHub repository")
  })
})
