import { randomUUID } from "node:crypto"
import { z } from "zod"
import { WorkflowDefinitionV2Schema, WorkflowResourceBindingV2Schema, type WorkflowDefinitionV2 } from "./definitionV2"
import { JsonValueSchema } from "./executionContracts"

export const WORKFLOW_DEFINITION_SCHEMA_VERSION = "2" as const
export const WorkflowStatusSchema = z.enum(["draft", "published", "archived"])
const StepIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)

export const WorkflowContentSchema = WorkflowDefinitionV2Schema

export const CreateWorkflowRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(""),
    repository: WorkflowResourceBindingV2Schema.refine(
      ({ provider, resourceType }) => provider === "github" && resourceType === "repository",
      "Select a GitHub repository."
    ),
    linearTeam: WorkflowResourceBindingV2Schema.refine(
      ({ provider, resourceType }) => provider === "linear" && resourceType === "team",
      "Select a Linear team."
    ),
    modelId: z.string().trim().min(1)
  })
  .strict()

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
    publishedVersion: z.number().int().positive().nullable(),
    triggers: z.array(
      z.object({ kind: z.enum(["manual", "webhook", "schedule"]), label: z.string(), enabled: z.boolean() }).strict()
    ),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const WorkflowDraftViewSchema = z
  .object({
    schemaVersion: z.literal(WORKFLOW_DEFINITION_SCHEMA_VERSION),
    workflowId: z.uuid(),
    name: z.string().min(1),
    description: z.string(),
    status: WorkflowStatusSchema,
    draftRevision: z.number().int().positive(),
    publishedVersion: z.number().int().positive().nullable(),
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
  .object({ runId: z.uuid(), created: z.boolean(), version: z.number().int().positive() })
  .strict()

export const PublishedWorkflowScheduleSchema = z
  .object({
    workflowId: z.uuid(),
    version: z.number().int().positive(),
    nodeId: StepIdSchema,
    label: z.string().min(1),
    intervalSeconds: z.number().int().min(10).max(86_400)
  })
  .strict()

export type WorkflowContent = WorkflowDefinitionV2
