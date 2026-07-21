import { randomUUID } from "node:crypto"
import { z } from "zod"
import { ActionAvailabilitySchema } from "../contracts/actionAvailability"
import { WorkflowDefinitionSchema, WorkflowResourceBindingSchema, type WorkflowDefinition } from "./definition"
import { JsonValueSchema } from "./executionContracts"
import { RepositoryAgentReferenceSchema } from "./repositoryAgents"
import { ScheduleDefinitionShape } from "./scheduleDefinition"

export const WorkflowStatusSchema = z.enum(["draft", "archived"])
const StepIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)

export const WorkflowContentSchema = WorkflowDefinitionSchema

const WorkflowNameSchema = z.string().trim().min(1, "Enter a workflow name.").max(120)
const GitHubRepositoryBindingSchema = WorkflowResourceBindingSchema.refine(
  ({ provider, resourceType }) => provider === "github" && resourceType === "repository",
  "Select a GitHub repository."
)
const LinearTeamBindingSchema = WorkflowResourceBindingSchema.refine(
  ({ provider, resourceType }) => provider === "linear" && resourceType === "team",
  "Select a Linear team."
)

export const CreateWorkflowRequestSchema = z.discriminatedUnion("template", [
  z
    .object({
      template: z.literal("blank"),
      name: WorkflowNameSchema,
      description: z.string().trim().max(500).default(""),
      repository: GitHubRepositoryBindingSchema
    })
    .strict(),
  z
    .object({
      template: z.literal("agency_delivery"),
      name: WorkflowNameSchema,
      description: z.string().trim().max(500).default(""),
      repository: GitHubRepositoryBindingSchema,
      linearTeam: LinearTeamBindingSchema,
      modelId: z.string().trim().min(1, "Select a model."),
      agentReference: RepositoryAgentReferenceSchema
    })
    .strict()
])

export const UpdateWorkflowDraftRequestSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500),
    content: WorkflowContentSchema
  })
  .strict()

export const StartWorkflowRunRequestSchema = z
  .object({
    version: z.number().int().positive(),
    input: JsonValueSchema.default({}),
    trigger: z
      .object({
        type: z.enum(["manual", "webhook", "schedule"]),
        key: z
          .string()
          .trim()
          .min(1)
          .default(() => randomUUID()),
        stepId: StepIdSchema.optional()
      })
      .strict()
  })
  .strict()

export const WorkflowSummarySchema = z
  .object({
    workflowId: z.uuid(),
    name: z.string().min(1),
    description: z.string(),
    status: WorkflowStatusSchema,
    draftRevision: z.number().int().positive(),
    activePublishedVersion: z.number().int().positive().nullable(),
    triggers: z.array(
      z.object({ kind: z.enum(["manual", "webhook", "schedule"]), label: z.string(), enabled: z.boolean() }).strict()
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const WorkflowDraftViewSchema = z
  .object({
    schemaVersion: z.literal("3"),
    workflowId: z.uuid(),
    name: z.string().min(1),
    description: z.string(),
    status: WorkflowStatusSchema,
    draftRevision: z.number().int().positive(),
    activePublishedVersion: z.number().int().positive().nullable(),
    content: WorkflowContentSchema,
    versions: z.array(
      z
        .object({
          version: z.number().int().positive(),
          contentDigest: z.string().regex(/^[0-9a-f]{64}$/u),
          publishedAt: z.iso.datetime({ offset: true })
        })
        .strict()
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const WorkflowRunStartSchema = z
  .object({
    runId: z.uuid(),
    created: z.boolean(),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("published"), version: z.number().int().positive() }).strict(),
      z.object({ kind: z.literal("draft_test"), draftRevision: z.number().int().positive() }).strict()
    ])
  })
  .strict()

export const WorkflowRunListSchema = z
  .object({
    schemaVersion: z.literal("1"),
    runs: z.array(
      z
        .object({
          runId: z.uuid(),
          workflowId: z.uuid(),
          workflowName: z.string().min(1),
          source: z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("published"), version: z.number().int().positive() }).strict(),
            z.object({ kind: z.literal("draft_test"), draftRevision: z.number().int().positive() }).strict()
          ]),
          triggerIdentity: z.string().min(1),
          status: z.enum([
            "preparing",
            "runnable",
            "running",
            "waiting",
            "succeeded",
            "failed",
            "cancelled",
            "abandoned"
          ]),
          createdAt: z.iso.datetime({ offset: true }),
          updatedAt: z.iso.datetime({ offset: true }),
          terminalAt: z.iso.datetime({ offset: true }).nullable()
        })
        .strict()
    )
  })
  .strict()

export const WorkflowValidationSchema = z
  .object({
    schemaVersion: z.literal("1"),
    draftRevision: z.number().int().positive(),
    valid: z.boolean(),
    issues: z.array(
      z
        .object({
          code: z.string().min(1),
          message: z.string().min(1),
          nodeId: StepIdSchema.nullable(),
          connectionId: z.string().min(1).nullable(),
          field: z.string().min(1).nullable()
        })
        .strict()
    )
  })
  .strict()

export const WorkflowRunActionSchema = ActionAvailabilitySchema.safeExtend({
  key: z.enum(["cancel", "retry_step", "retry_from_here", "resume", "run_again", "resolve_effect"]),
  label: z.string().min(1),
  targetId: z.string().nullable()
})

export const WorkflowRunSummarySchema = z
  .object({
    outcome: z.enum(["preparing", "runnable", "running", "waiting", "succeeded", "failed", "cancelled", "abandoned"]),
    currentStep: z
      .object({ stepId: StepIdSchema, label: z.string().min(1) })
      .strict()
      .nullable(),
    failure: z
      .object({
        stepId: StepIdSchema,
        stepLabel: z.string().min(1),
        cause: z.string().min(1),
        downstreamEffect: z.string().min(1),
        occurredAt: z.iso.datetime({ offset: true }).nullable(),
        recommendedAction: z.string().min(1)
      })
      .strict()
      .nullable(),
    actions: z.array(WorkflowRunActionSchema)
  })
  .strict()

export const PublishedWorkflowScheduleSchema = z
  .object({
    workflowId: z.uuid(),
    version: z.number().int().positive(),
    nodeId: StepIdSchema,
    label: z.string().min(1),
    ...ScheduleDefinitionShape
  })
  .strict()
  .superRefine((definition, context) => {
    if ((definition.intervalSeconds === null) === (definition.scheduleExpression === null)) {
      context.addIssue({ code: "custom", message: "Choose either an interval or a CRON expression." })
    }
  })

export const WorkflowScheduleViewSchema = z
  .object({
    scheduleId: z.uuid(),
    workflowId: z.uuid(),
    workflowVersion: z.number().int().positive(),
    triggerNodeId: StepIdSchema,
    label: z.string().min(1),
    enabled: z.boolean(),
    intervalSeconds: z.number().int().min(10).max(86_400).nullable(),
    scheduleExpression: z.string().min(1).nullable(),
    timezone: z.string().min(1),
    nextRunAt: z.iso.datetime({ offset: true }),
    lastAttemptedAt: z.iso.datetime({ offset: true }).nullable(),
    lastSuccessfulAt: z.iso.datetime({ offset: true }).nullable(),
    health: z.enum(["disabled", "scheduled", "running", "retrying"]),
    latestError: z.string().min(1).nullable(),
    revision: z.number().int().positive()
  })
  .strict()

export const UpdateWorkflowScheduleRequestSchema = z.union([
  z
    .object({
      expectedRevision: z.number().int().positive(),
      enabled: z.boolean(),
      intervalSeconds: z.number().int().min(10).max(86_400),
      scheduleExpression: z.null().default(null),
      timezone: z.string().trim().min(1).default("UTC")
    })
    .strict(),
  z
    .object({
      expectedRevision: z.number().int().positive(),
      enabled: z.boolean(),
      intervalSeconds: z.null(),
      scheduleExpression: z.string().trim().min(1),
      timezone: z.string().trim().min(1)
    })
    .strict()
])

export type WorkflowContent = WorkflowDefinition
