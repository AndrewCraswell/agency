import { describe, expect, it, vi } from "vitest"
import { compileWorkflowDefinition } from "./compiler"
import type { WorkflowDefinition } from "./definition"
import { matchPublishedWebhookTriggers, resolvePublishedTriggerCatalog } from "./publishedTriggers"
import { CURRENT_WORKFLOW_RELEASE_PHASE } from "./stepRegistry"

const workflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f"
const linearTeam = {
  connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
  provider: "linear" as const,
  resourceType: "team" as const,
  externalId: "agency-team",
  name: "Agency",
  capabilities: ["provider.events"]
}

function publishedDefinition(): WorkflowDefinition {
  return {
    schemaVersion: "2",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    constants: {},
    resourceBindings: { linearTeam },
    steps: [
      {
        id: "linear-event",
        label: "Linear task created",
        position: { x: 0, y: 0 },
        definition: { kind: "provider_event", version: 1 },
        config: { provider: "linear", eventKey: "task.created", binding: linearTeam },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "event-success",
        label: "Event complete",
        position: { x: 200, y: 0 },
        definition: { kind: "success", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "hourly",
        label: "Every hour",
        position: { x: 0, y: 200 },
        definition: { kind: "schedule", version: 1 },
        config: { intervalSeconds: 3600, timezone: "UTC" },
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      },
      {
        id: "schedule-success",
        label: "Schedule complete",
        position: { x: 200, y: 200 },
        definition: { kind: "success", version: 1 },
        config: {},
        failurePolicy: { mode: "stop", maximumAttempts: 1 }
      }
    ],
    connections: [
      {
        id: "event-success",
        source: { stepId: "linear-event", port: "event" },
        target: { stepId: "event-success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      },
      {
        id: "schedule-success",
        source: { stepId: "hourly", port: "fire" },
        target: { stepId: "schedule-success", port: "result" },
        outcome: "success",
        mappings: [{ sourcePath: [], targetPath: [] }]
      }
    ]
  }
}

describe("published trigger resolution", () => {
  it("uses the active execution package after the mutable draft changes", async () => {
    const executionPackage = compileWorkflowDefinition({
      workflowId,
      source: { kind: "published", version: 1 },
      definition: publishedDefinition(),
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE
    })
    const changedDraft = publishedDefinition()
    changedDraft.steps[0] = {
      ...changedDraft.steps[0]!,
      config: { ...changedDraft.steps[0]!.config, eventKey: "task.updated" }
    }
    changedDraft.steps[2] = {
      ...changedDraft.steps[2]!,
      config: { ...changedDraft.steps[2]!.config, intervalSeconds: 10 }
    }
    const store = {
      list: vi.fn(async () => [
        { workflowId, activePublishedVersion: 1, draft: changedDraft },
        { workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e30", activePublishedVersion: null, draft: changedDraft }
      ]),
      getExecutionPackage: vi.fn(async () => ({ content: executionPackage.content }))
    }

    const catalog = await resolvePublishedTriggerCatalog(store)

    expect(
      matchPublishedWebhookTriggers(catalog, {
        provider: "linear",
        eventKey: "task.created",
        resourceType: "team",
        resourceId: "agency-team"
      })
    ).toEqual([expect.objectContaining({ workflowId, version: 1, nodeId: "linear-event" })])
    expect(
      matchPublishedWebhookTriggers(catalog, {
        provider: "linear",
        eventKey: "task.updated",
        resourceType: "team",
        resourceId: "agency-team"
      })
    ).toEqual([])
    expect(
      matchPublishedWebhookTriggers(catalog, {
        provider: "linear",
        eventKey: "task.created",
        resourceType: "team",
        resourceId: "another-team"
      })
    ).toEqual([])
    expect(catalog.schedules).toEqual([
      {
        workflowId,
        version: 1,
        nodeId: "hourly",
        label: "Every hour",
        intervalSeconds: 3600,
        scheduleExpression: null,
        timezone: "UTC"
      }
    ])
    expect(store.getExecutionPackage).toHaveBeenCalledOnce()
    expect(store.getExecutionPackage).toHaveBeenCalledWith(workflowId, 1)
  })

  it("projects CRON and timezone from the immutable execution package", async () => {
    const definition = publishedDefinition()
    definition.steps[2] = {
      ...definition.steps[2]!,
      label: "Weekday delivery",
      config: { cron: "0 9 * * 1-5", timezone: "America/New_York" }
    }
    const executionPackage = compileWorkflowDefinition({
      workflowId,
      source: { kind: "published", version: 1 },
      definition,
      maximumPhase: CURRENT_WORKFLOW_RELEASE_PHASE
    })

    await expect(
      resolvePublishedTriggerCatalog({
        list: async () => [{ workflowId, activePublishedVersion: 1 }],
        getExecutionPackage: async () => ({ content: executionPackage.content })
      })
    ).resolves.toMatchObject({
      schedules: [
        {
          workflowId,
          version: 1,
          nodeId: "hourly",
          label: "Weekday delivery",
          intervalSeconds: null,
          scheduleExpression: "0 9 * * 1-5",
          timezone: "America/New_York"
        }
      ]
    })
  })

  it("rejects an active workflow with no immutable execution package", async () => {
    await expect(
      resolvePublishedTriggerCatalog({
        list: async () => [{ workflowId, activePublishedVersion: 1 }],
        getExecutionPackage: async () => null
      })
    ).rejects.toThrow(`Active workflow ${workflowId} version 1 has no execution package`)
  })
})
