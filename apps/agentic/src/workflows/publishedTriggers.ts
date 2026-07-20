import { z } from "zod"
import { CompiledWorkflowGraphSchema } from "./compiler"
import { PublishedWorkflowScheduleSchema } from "./contracts"
import { ExecutionPackageContentSchema } from "./executionContracts"
import { scheduleDefinitionFromConfig } from "./scheduleDefinition"

const PublishedWebhookTriggerSchema = z
  .object({
    kind: z.literal("webhook"),
    workflowId: z.uuid(),
    version: z.number().int().positive(),
    nodeId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    label: z.string().min(1),
    provider: z.enum(["github", "linear"]),
    eventKey: z.string().trim().min(1)
  })
  .strict()

export type PublishedWebhookTrigger = z.infer<typeof PublishedWebhookTriggerSchema>
export type PublishedWorkflowSchedule = z.infer<typeof PublishedWorkflowScheduleSchema>

type PublishedTriggerStore = {
  list(): Promise<Array<{ workflowId: string; activePublishedVersion: number | null }>>
  getExecutionPackage(workflowId: string, workflowVersion: number): Promise<{ content: unknown } | null>
}

type PublishedTriggerCatalog = {
  webhooks: PublishedWebhookTrigger[]
  schedules: PublishedWorkflowSchedule[]
}

function compareTrigger(
  left: { workflowId: string; version: number; nodeId: string },
  right: { workflowId: string; version: number; nodeId: string }
) {
  return (
    left.workflowId.localeCompare(right.workflowId) ||
    left.version - right.version ||
    left.nodeId.localeCompare(right.nodeId)
  )
}

export async function resolvePublishedTriggerCatalog(store: PublishedTriggerStore): Promise<PublishedTriggerCatalog> {
  const workflows = await store.list()
  const catalogs = await Promise.all(
    workflows.flatMap((workflow) => {
      const activePublishedVersion = workflow.activePublishedVersion
      if (activePublishedVersion === null) return []
      return [
        (async () => {
          const executionPackage = await store.getExecutionPackage(workflow.workflowId, activePublishedVersion)
          if (executionPackage === null) {
            throw new Error(
              `Active workflow ${workflow.workflowId} version ${activePublishedVersion} has no execution package`
            )
          }
          const content = ExecutionPackageContentSchema.parse(executionPackage.content)
          const graph = CompiledWorkflowGraphSchema.parse(content.graph)
          const webhooks: PublishedWebhookTrigger[] = []
          const schedules: PublishedWorkflowSchedule[] = []
          for (const step of graph.steps) {
            if (step.definition.kind === "provider_event") {
              const config = z
                .object({ provider: z.enum(["github", "linear"]), eventKey: z.string().trim().min(1) })
                .passthrough()
                .parse(step.config)
              webhooks.push(
                PublishedWebhookTriggerSchema.parse({
                  kind: "webhook",
                  workflowId: workflow.workflowId,
                  version: activePublishedVersion,
                  nodeId: step.id,
                  label: step.label,
                  provider: config.provider,
                  eventKey: config.eventKey
                })
              )
            }
            if (step.definition.kind === "schedule") {
              const schedule = scheduleDefinitionFromConfig(step.config)
              schedules.push(
                PublishedWorkflowScheduleSchema.parse({
                  workflowId: workflow.workflowId,
                  version: activePublishedVersion,
                  nodeId: step.id,
                  label: step.label,
                  ...schedule
                })
              )
            }
          }
          return { webhooks, schedules }
        })()
      ]
    })
  )
  return {
    webhooks: catalogs.flatMap(({ webhooks }) => webhooks).sort(compareTrigger),
    schedules: catalogs.flatMap(({ schedules }) => schedules).sort(compareTrigger)
  }
}

export function matchPublishedWebhookTriggers(
  catalog: PublishedTriggerCatalog,
  event: { provider: "github" | "linear"; eventKey: string }
): PublishedWebhookTrigger[] {
  return catalog.webhooks.filter(
    (trigger) => trigger.provider === event.provider && trigger.eventKey === event.eventKey
  )
}
