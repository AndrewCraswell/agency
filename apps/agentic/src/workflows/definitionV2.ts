import { z } from "zod"
import { JsonValueSchema } from "./executionContracts"
import { SupportedJsonSchemaSchema } from "./jsonSchema"

export const WORKFLOW_DEFINITION_V2_SCHEMA_VERSION = "2" as const
const IdentifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
const PortNameSchema = z.string().regex(/^[a-z][a-z0-9_]*$/u)
const PositionSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()

export const WorkflowStepInstanceSchema = z
  .object({
    id: IdentifierSchema,
    label: z.string().trim().min(1).max(120),
    position: PositionSchema,
    definition: z
      .object({ kind: z.string().regex(/^[a-z][a-z0-9_]*$/u), version: z.number().int().positive() })
      .strict(),
    config: z.record(z.string(), JsonValueSchema).default({}),
    failurePolicy: z
      .object({ mode: z.enum(["stop", "route"]), maximumAttempts: z.number().int().min(1).max(10).default(1) })
      .strict()
      .default({ mode: "stop", maximumAttempts: 1 })
  })
  .strict()

export const WorkflowPortReferenceSchema = z.object({ stepId: IdentifierSchema, port: PortNameSchema }).strict()

export const WorkflowFieldMappingSchema = z
  .object({ sourcePath: z.array(z.string()).default([]), targetPath: z.array(z.string()).default([]) })
  .strict()

export const WorkflowConnectionV2Schema = z
  .object({
    id: IdentifierSchema,
    source: WorkflowPortReferenceSchema,
    target: WorkflowPortReferenceSchema,
    outcome: z.enum(["success", "failure"]).default("success"),
    branchKey: IdentifierSchema.optional(),
    loopBack: z.boolean().optional(),
    mappings: z
      .array(WorkflowFieldMappingSchema)
      .min(1)
      .default([{ sourcePath: [], targetPath: [] }])
  })
  .strict()

export const WorkflowResourceBindingV2Schema = z
  .object({
    connectionId: z.uuid(),
    provider: z.enum(["github", "linear"]),
    resourceType: z.enum(["repository", "team"]),
    externalId: z.string().min(1),
    name: z.string().min(1),
    capabilities: z.array(z.string().min(1)).min(1)
  })
  .strict()

export const WorkflowFixtureSchema = z
  .object({
    id: IdentifierSchema,
    name: z.string().trim().min(1).max(120),
    revision: z.number().int().positive(),
    workflowInput: JsonValueSchema,
    providerResponses: z.record(z.string(), JsonValueSchema).default({}),
    modelResponses: z.record(z.string(), JsonValueSchema).default({}),
    agentResponses: z.record(z.string(), JsonValueSchema).default({})
  })
  .strict()

export const WorkflowDefinitionV2Schema = z
  .object({
    schemaVersion: z.literal(WORKFLOW_DEFINITION_V2_SCHEMA_VERSION),
    inputSchema: SupportedJsonSchemaSchema,
    outputSchema: SupportedJsonSchemaSchema,
    steps: z.array(WorkflowStepInstanceSchema),
    connections: z.array(WorkflowConnectionV2Schema),
    constants: z.record(z.string(), JsonValueSchema).default({}),
    resourceBindings: z.record(z.string(), WorkflowResourceBindingV2Schema).default({}),
    fixtures: z.array(WorkflowFixtureSchema).default([])
  })
  .strict()

export type WorkflowDefinitionV2 = z.infer<typeof WorkflowDefinitionV2Schema>
export type WorkflowStepInstance = z.infer<typeof WorkflowStepInstanceSchema>
