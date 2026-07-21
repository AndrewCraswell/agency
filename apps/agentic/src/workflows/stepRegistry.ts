import { z } from "zod"
import { JsonValueSchema, jsonValueDigest } from "./executionContracts"

export const WORKFLOW_STEP_REGISTRY_VERSION = "1" as const
export const CURRENT_WORKFLOW_RELEASE_PHASE = 7 as const

export const WorkflowStepCategorySchema = z.enum(["trigger", "data", "ai", "action", "logic", "terminal"])
export const WorkflowExecutionClassSchema = z.enum(["control", "provider", "model", "workspace"])
export const WorkflowMutationPolicySchema = z.enum(["none", "external_effect"])
export const WorkflowPortCardinalitySchema = z.enum(["one", "optional", "many"])
export const WorkflowConfigControlSchema = z.enum([
  "text",
  "multiline",
  "number",
  "boolean",
  "select",
  "object_rows",
  "json"
])

export const WorkflowConfigFieldUiSchema = z
  .object({
    key: z.string().regex(/^[a-z][A-Za-z0-9]*$/u),
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    control: WorkflowConfigControlSchema,
    group: z.enum(["basic", "advanced"]),
    required: z.boolean(),
    secret: z.boolean(),
    immutable: z.boolean(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    options: z.array(z.string()).optional()
  })
  .strict()

export const WorkflowPortDefinitionSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/u),
    label: z.string().trim().min(1),
    schema: JsonValueSchema,
    cardinality: WorkflowPortCardinalitySchema.default("one")
  })
  .strict()

export const WorkflowStepDefinitionSchema = z
  .object({
    kind: z.string().regex(/^[a-z][a-z0-9_]*$/u),
    version: z.number().int().positive(),
    phase: z.number().int().min(2).max(7),
    category: WorkflowStepCategorySchema,
    label: z.string().trim().min(1),
    description: z.string().trim().min(1),
    executionClass: WorkflowExecutionClassSchema,
    mutationPolicy: WorkflowMutationPolicySchema,
    capabilities: z.array(z.string().trim().min(1)),
    configSchema: JsonValueSchema,
    inputs: z.array(WorkflowPortDefinitionSchema),
    outputs: z.array(WorkflowPortDefinitionSchema),
    errorSchema: JsonValueSchema,
    ui: z.object({ fields: z.array(WorkflowConfigFieldUiSchema) }).strict(),
    executorDigest: z.string().regex(/^[0-9a-f]{64}$/u)
  })
  .strict()

type StepSeed = Omit<z.input<typeof WorkflowStepDefinitionSchema>, "executorDigest" | "ui">

const objectSchema = { type: "object", additionalProperties: true } as const
const emptyObjectSchema = { type: "object", additionalProperties: false } as const
const deterministicExpressionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "operator"],
  properties: {
    path: { type: "array", items: { type: "string" } },
    operator: {
      enum: [
        "equals",
        "not_equals",
        "greater_than",
        "greater_than_or_equal",
        "less_than",
        "less_than_or_equal",
        "exists",
        "truthy"
      ]
    },
    value: {}
  }
} as const
const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "message"],
  properties: { code: { type: "string" }, message: { type: "string" }, retryable: { type: "boolean" } }
} as const
const artifactReferenceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifactId",
    "kind",
    "mediaType",
    "sha256",
    "byteLength",
    "producerActivationId",
    "producerAttemptId",
    "classification"
  ],
  properties: {
    artifactId: { type: "string" },
    kind: { type: "string" },
    mediaType: { type: "string" },
    sha256: { type: "string" },
    byteLength: { type: "integer", minimum: 0 },
    producerActivationId: { type: "string" },
    producerAttemptId: { type: "string" },
    classification: { enum: ["internal", "sensitive"] }
  }
} as const
const loopIterationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["state", "index"],
  properties: { state: objectSchema, index: { type: "integer", minimum: 0 } }
} as const

function port(
  name: string,
  label: string,
  schema: z.input<typeof JsonValueSchema>,
  cardinality: "one" | "optional" | "many" = "one"
) {
  return { name, label, schema, cardinality }
}

function step(seed: StepSeed): z.infer<typeof WorkflowStepDefinitionSchema> {
  return WorkflowStepDefinitionSchema.parse({
    ...seed,
    ui: { fields: workflowConfigFields[seed.kind] ?? [] },
    executorDigest: jsonValueDigest({
      registryVersion: WORKFLOW_STEP_REGISTRY_VERSION,
      kind: seed.kind,
      version: seed.version,
      executionClass: seed.executionClass
    })
  })
}

type ConfigFieldUi = z.input<typeof WorkflowConfigFieldUiSchema>

function field(
  key: string,
  label: string,
  description: string,
  control: z.input<typeof WorkflowConfigControlSchema>,
  options: Partial<Omit<ConfigFieldUi, "key" | "label" | "description" | "control">> = {}
): ConfigFieldUi {
  return {
    key,
    label,
    description,
    control,
    group: options.group ?? "basic",
    required: options.required ?? false,
    secret: options.secret ?? false,
    immutable: options.immutable ?? false,
    ...options
  }
}

const workflowConfigFields: Record<string, ConfigFieldUi[]> = {
  manual_trigger: [
    field("inputSchema", "Input schema", "Defines accepted manual input.", "json", { group: "advanced" })
  ],
  set_fields: [
    field("fields", "Fields", "Creates named values from constants and input.", "object_rows", { required: true })
  ],
  map_fields: [field("mappings", "Mappings", "Maps source paths to output fields.", "object_rows", { required: true })],
  validate: [
    field("schema", "Validation schema", "Defines the shape the incoming value must match.", "json", {
      group: "advanced",
      required: true
    })
  ],
  failure: [
    field("code", "Failure code", "Identifies this failure for downstream handling.", "text", { required: true }),
    field("message", "Message", "Explains why the path failed.", "multiline", { required: true })
  ],
  compose_markdown: [
    field("template", "Markdown template", "Creates Markdown and supports declared value placeholders.", "multiline", {
      required: true
    })
  ],
  collect: [
    field("mode", "Collection mode", "Returns an ordered array or keyed object.", "select", {
      options: ["array", "keyed"]
    }),
    field("keyField", "Key field", "Selects the field used as each object key.", "text"),
    field("maximumItems", "Maximum items", "Limits collected results.", "number", { minimum: 1, maximum: 1000 })
  ],
  condition: [
    field("expression", "Condition", "Tests an input path with a deterministic operator.", "json", { required: true })
  ],
  switch: [
    field("cases", "Cases", "Evaluates ordered branch conditions.", "json", { group: "advanced", required: true }),
    field("defaultKey", "Default branch key", "Selects the branch used when no case matches.", "text"),
    field("joinStepId", "Merge step", "Identifies the exclusive merge for these branches.", "select")
  ],
  join: [
    field("policy", "Join policy", "Controls when parallel inputs continue.", "select", {
      options: ["all", "any", "quorum"]
    }),
    field("quorum", "Quorum", "Sets the number of required inputs.", "number", { minimum: 1 })
  ],
  for_each: [
    field("maximumItems", "Maximum items", "Limits items expanded by the loop.", "number", {
      minimum: 1,
      maximum: 1000
    }),
    field("concurrency", "Concurrency", "Limits simultaneous item work.", "number", { minimum: 1, maximum: 1000 }),
    field("bodyStepId", "Body step", "Selects the first step in the loop body.", "select", { required: true }),
    field("joinStepId", "Join step", "Selects the step that collects loop results.", "select", { required: true })
  ],
  bounded_loop: [
    field("condition", "Condition", "Tests whether another iteration should run.", "json", { required: true }),
    field("maximumIterations", "Maximum iterations", "Limits loop repetitions.", "number", {
      minimum: 1,
      maximum: 1000
    }),
    field("maximumActivations", "Maximum activations", "Limits total work created by the loop.", "number", {
      minimum: 1,
      maximum: 100000
    }),
    field("bodyStepId", "Body step", "Selects the first step in the loop body.", "select", { required: true }),
    field("exitStepId", "Exit step", "Selects where the workflow continues.", "select", { required: true }),
    field("onExhaustion", "On exhaustion", "Chooses whether reaching the limit completes or fails.", "select", {
      options: ["fail", "complete"]
    })
  ],
  wait: [
    field("correlation", "Correlation key", "Matches the external event that resumes this run.", "text", {
      required: true
    }),
    field("expiresAfterSeconds", "Expires after seconds", "Sets how long the workflow waits.", "number", {
      minimum: 1
    }),
    field("eventSchema", "Resume event schema", "Defines accepted resume event data.", "json", {
      group: "advanced",
      required: true
    })
  ],
  child_workflow: [
    field("packageDigest", "Execution package digest", "Pins the child workflow package.", "text", {
      group: "advanced",
      required: true,
      immutable: true
    }),
    field("interfaceDigest", "Interface digest", "Pins the child workflow interface.", "text", {
      group: "advanced",
      required: true,
      immutable: true
    })
  ]
}

const seeds: StepSeed[] = [
  {
    kind: "manual_trigger",
    version: 1,
    phase: 2,
    category: "trigger",
    label: "Manual run",
    description: "Starts the workflow with input provided by a person.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object", properties: { inputSchema: { type: "object" } } },
    inputs: [],
    outputs: [port("input", "Workflow input", objectSchema)],
    errorSchema
  },
  {
    kind: "set_fields",
    version: 1,
    phase: 2,
    category: "data",
    label: "Set fields",
    description: "Creates an object from constants and workflow input.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object", required: ["fields"], properties: { fields: objectSchema } },
    inputs: [port("input", "Input", objectSchema, "optional")],
    outputs: [port("value", "Value", objectSchema)],
    errorSchema
  },
  {
    kind: "map_fields",
    version: 1,
    phase: 2,
    category: "data",
    label: "Map fields",
    description: "Selects and renames fields without running code.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object", required: ["mappings"], properties: { mappings: objectSchema } },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [port("value", "Mapped value", objectSchema)],
    errorSchema
  },
  {
    kind: "validate",
    version: 1,
    phase: 2,
    category: "data",
    label: "Validate",
    description: "Checks a value against a JSON schema.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object", required: ["schema"], properties: { schema: { type: "object" } } },
    inputs: [port("value", "Value", objectSchema)],
    outputs: [port("value", "Validated value", objectSchema)],
    errorSchema
  },
  {
    kind: "success",
    version: 1,
    phase: 2,
    category: "terminal",
    label: "Success",
    description: "Ends the current path successfully.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: emptyObjectSchema,
    inputs: [port("result", "Result", objectSchema, "optional")],
    outputs: [port("result", "Result", objectSchema)],
    errorSchema
  },
  {
    kind: "failure",
    version: 1,
    phase: 2,
    category: "terminal",
    label: "Failure",
    description: "Ends the current path with an error.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } }
    },
    inputs: [port("error", "Error details", objectSchema, "optional")],
    outputs: [],
    errorSchema
  },
  {
    kind: "compose_markdown",
    version: 1,
    phase: 3,
    category: "data",
    label: "Compose Markdown",
    description: "Creates Markdown from a template and workflow input.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: { type: "object", required: ["template"], properties: { template: { type: "string" } } },
    inputs: [port("values", "Template values", objectSchema)],
    outputs: [port("markdown", "Markdown artifact", artifactReferenceSchema)],
    errorSchema
  },
  {
    kind: "collect",
    version: 1,
    phase: 3,
    category: "data",
    label: "Collect",
    description: "Collects parallel results in source order.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      properties: {
        mode: { enum: ["array", "keyed"] },
        keyField: { type: "string" },
        maximumItems: { type: "integer", minimum: 1, maximum: 1000 }
      }
    },
    inputs: [port("items", "Items", objectSchema, "many")],
    outputs: [port("collection", "Collection", { type: ["array", "object"] })],
    errorSchema
  },
  {
    kind: "repository_data",
    version: 1,
    phase: 4,
    category: "data",
    label: "Repository data",
    description: "Reads repository details or content.",
    executionClass: "provider",
    mutationPolicy: "none",
    capabilities: ["repository.read"],
    configSchema: {
      type: "object",
      required: ["operation", "repository"],
      properties: { operation: { type: "string" }, repository: objectSchema }
    },
    inputs: [port("query", "Query", objectSchema, "optional")],
    outputs: [port("result", "Repository result", objectSchema)],
    errorSchema
  },
  {
    kind: "repository_agent",
    version: 1,
    phase: 4,
    category: "ai",
    label: "Repository agent",
    description: "Runs a selected repository agent in its own workspace.",
    executionClass: "workspace",
    mutationPolicy: "none",
    capabilities: ["repository.read", "workspace.create"],
    configSchema: {
      type: "object",
      required: ["agentReference"],
      properties: { agentReference: objectSchema, instructions: { type: "string" } }
    },
    inputs: [port("context", "Agent context", objectSchema)],
    outputs: [port("result", "Agent result", objectSchema)],
    errorSchema
  },
  {
    kind: "ai_model",
    version: 1,
    phase: 5,
    category: "ai",
    label: "AI model",
    description: "Runs a selected OpenRouter model.",
    executionClass: "model",
    mutationPolicy: "none",
    capabilities: ["model.inference"],
    configSchema: {
      type: "object",
      required: ["modelId", "messages", "outputMode"],
      properties: {
        modelId: { type: "string" },
        messages: { type: "array" },
        outputMode: { enum: ["text", "markdown", "structured"] }
      }
    },
    inputs: [port("context", "Prompt context", objectSchema, "optional")],
    outputs: [port("response", "Model response", objectSchema)],
    errorSchema
  },
  {
    kind: "structured_judgment",
    version: 1,
    phase: 5,
    category: "ai",
    label: "Structured judgment",
    description: "Uses a model to make a decision and provide evidence.",
    executionClass: "model",
    mutationPolicy: "none",
    capabilities: ["model.inference", "model.structured_output"],
    configSchema: {
      type: "object",
      required: ["modelId", "criteria", "outputSchema"],
      properties: { modelId: { type: "string" }, criteria: { type: "string" }, outputSchema: objectSchema }
    },
    inputs: [port("evidence", "Evidence", objectSchema)],
    outputs: [port("judgment", "Judgment", objectSchema)],
    errorSchema
  },
  {
    kind: "provider_event",
    version: 1,
    phase: 6,
    category: "trigger",
    label: "Provider event",
    description: "Starts the workflow from a GitHub or Linear event.",
    executionClass: "provider",
    mutationPolicy: "none",
    capabilities: ["provider.events"],
    configSchema: {
      type: "object",
      required: ["provider", "eventKey", "binding"],
      properties: { provider: { enum: ["github", "linear"] }, eventKey: { type: "string" }, binding: objectSchema }
    },
    inputs: [],
    outputs: [port("event", "Normalized event", objectSchema)],
    errorSchema
  },
  {
    kind: "schedule",
    version: 1,
    phase: 6,
    category: "trigger",
    label: "Schedule",
    description: "Starts the workflow on a recurring schedule.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      required: ["timezone"],
      properties: {
        cron: { type: "string" },
        intervalSeconds: { type: "integer", minimum: 10, maximum: 86400 },
        timezone: { type: "string" }
      }
    },
    inputs: [],
    outputs: [port("fire", "Schedule fire", objectSchema)],
    errorSchema
  },
  {
    kind: "provider_data",
    version: 1,
    phase: 6,
    category: "data",
    label: "Provider data",
    description: "Reads GitHub or Linear records.",
    executionClass: "provider",
    mutationPolicy: "none",
    capabilities: ["provider.read"],
    configSchema: {
      type: "object",
      required: ["provider", "operation", "binding"],
      properties: { provider: { enum: ["github", "linear"] }, operation: { type: "string" }, binding: objectSchema }
    },
    inputs: [port("query", "Query", objectSchema, "optional")],
    outputs: [port("result", "Provider result", objectSchema)],
    errorSchema
  },
  {
    kind: "provider_action",
    version: 1,
    phase: 6,
    category: "action",
    label: "Provider action",
    description: "Creates or updates one GitHub or Linear record.",
    executionClass: "provider",
    mutationPolicy: "external_effect",
    capabilities: ["provider.write"],
    configSchema: {
      type: "object",
      required: ["provider", "operation", "binding"],
      properties: { provider: { enum: ["github", "linear"] }, operation: { type: "string" }, binding: objectSchema }
    },
    inputs: [port("request", "Action request", objectSchema)],
    outputs: [port("result", "Action result", objectSchema)],
    errorSchema
  },
  {
    kind: "condition",
    version: 1,
    phase: 7,
    category: "logic",
    label: "Condition",
    description: "Chooses a path based on a true or false condition.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["expression", "joinStepId"],
      properties: { expression: deterministicExpressionSchema, joinStepId: { type: "string" } }
    },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [port("true", "True", objectSchema, "optional"), port("false", "False", objectSchema, "optional")],
    errorSchema
  },
  {
    kind: "switch",
    version: 1,
    phase: 7,
    category: "logic",
    label: "Switch",
    description: "Chooses a matching path or the default path.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["cases", "joinStepId"],
      properties: {
        cases: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "when"],
            properties: { key: { type: "string" }, when: deterministicExpressionSchema }
          }
        },
        defaultKey: { type: "string" },
        joinStepId: { type: "string" }
      }
    },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [
      port("branch", "Selected branch", {
        type: "object",
        additionalProperties: false,
        required: ["key", "value"],
        properties: { key: { type: "string" }, value: objectSchema }
      })
    ],
    errorSchema
  },
  {
    kind: "exclusive_merge",
    version: 1,
    phase: 7,
    category: "logic",
    label: "Exclusive merge",
    description: "Continues after the one path that ran.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: emptyObjectSchema,
    inputs: [port("branches", "Branches", objectSchema, "many")],
    outputs: [port("value", "Merged value", objectSchema)],
    errorSchema
  },
  {
    kind: "join",
    version: 1,
    phase: 7,
    category: "logic",
    label: "Join",
    description: "Waits for all paths, any path, or a required number of paths.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      required: ["policy"],
      properties: { policy: { enum: ["all", "any", "quorum"] }, quorum: { type: "integer", minimum: 1 } }
    },
    inputs: [port("branches", "Branches", objectSchema, "many")],
    outputs: [port("results", "Joined results", { type: "array", items: objectSchema })],
    errorSchema
  },
  {
    kind: "for_each",
    version: 1,
    phase: 7,
    category: "logic",
    label: "For each",
    description: "Runs the selected steps for each item in a collection.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["maximumItems", "concurrency", "bodyStepId", "joinStepId"],
      properties: {
        maximumItems: { type: "integer", minimum: 1, maximum: 1000 },
        concurrency: { type: "integer", minimum: 1, maximum: 1000 },
        bodyStepId: { type: "string" },
        joinStepId: { type: "string" }
      }
    },
    inputs: [port("items", "Items", { type: "array", items: objectSchema })],
    outputs: [port("item", "Item", objectSchema, "many")],
    errorSchema
  },
  {
    kind: "bounded_loop",
    version: 1,
    phase: 7,
    category: "logic",
    label: "Repeat",
    description: "Repeats the selected steps while a condition is true.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["maximumIterations", "maximumActivations", "condition", "bodyStepId", "exitStepId", "onExhaustion"],
      properties: {
        maximumIterations: { type: "integer", minimum: 1, maximum: 1000 },
        maximumActivations: { type: "integer", minimum: 1, maximum: 100000 },
        condition: deterministicExpressionSchema,
        bodyStepId: { type: "string" },
        exitStepId: { type: "string" },
        onExhaustion: { enum: ["fail", "complete"] }
      }
    },
    inputs: [port("state", "Loop state", objectSchema)],
    outputs: [
      port("iteration", "Iteration", loopIterationSchema, "optional"),
      port("result", "Final result", objectSchema, "optional")
    ],
    errorSchema
  },
  {
    kind: "wait",
    version: 1,
    phase: 7,
    category: "action",
    label: "Wait",
    description: "Waits for a matching event or until the time limit.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      required: ["correlation", "expiresAfterSeconds", "eventSchema"],
      properties: {
        correlation: { type: "string" },
        expiresAfterSeconds: { type: "integer", minimum: 1 },
        eventSchema: objectSchema
      }
    },
    inputs: [port("context", "Wait context", objectSchema, "optional")],
    outputs: [port("event", "Resume event", objectSchema)],
    errorSchema
  },
  {
    kind: "child_workflow",
    version: 1,
    phase: 7,
    category: "action",
    label: "Invoke workflow",
    description: "Runs a specific version of another workflow.",
    executionClass: "control",
    mutationPolicy: "external_effect",
    capabilities: ["workflow.invoke"],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["packageDigest", "interfaceDigest"],
      properties: {
        packageDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
        interfaceDigest: { type: "string", pattern: "^[0-9a-f]{64}$" }
      }
    },
    inputs: [port("input", "Child input", objectSchema)],
    outputs: [port("output", "Child output", objectSchema)],
    errorSchema
  }
]

const registry = seeds.map(step)

export function listWorkflowStepDefinitions(maximumPhase: number = CURRENT_WORKFLOW_RELEASE_PHASE) {
  const phase = z.number().int().min(2).max(7).parse(maximumPhase)
  return registry.filter((definition) => definition.phase <= phase)
}

export function getWorkflowStepDefinition(kind: string, version: number, maximumPhase = 7) {
  const definition = listWorkflowStepDefinitions(maximumPhase).find(
    (candidate) => candidate.kind === kind && candidate.version === version
  )
  if (definition === undefined) {
    throw new Error(`Workflow step ${kind}@${version} is not available through phase ${maximumPhase}`)
  }
  return definition
}

export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>
