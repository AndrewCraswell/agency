import { z } from "zod"
import { JsonValueSchema, jsonValueDigest } from "./executionContracts"

export const WORKFLOW_STEP_REGISTRY_VERSION = "1" as const
export const CURRENT_WORKFLOW_RELEASE_PHASE = 7 as const

export const WorkflowStepCategorySchema = z.enum(["trigger", "data", "ai", "action", "logic"])
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
const validationIssueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "message"],
  properties: { path: { type: "string" }, message: { type: "string" } }
} as const
const invalidValidationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "issues", "schemaDigest"],
  properties: {
    value: objectSchema,
    issues: { type: "array", items: validationIssueSchema, maxItems: 100 },
    schemaDigest: { type: "string" }
  }
} as const
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
const modelParametersSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    temperature: { type: "number", minimum: 0, maximum: 2 },
    top_p: { type: "number", minimum: 0, maximum: 1 },
    top_k: { type: "integer", minimum: 0 },
    min_p: { type: "number", minimum: 0, maximum: 1 },
    top_a: { type: "number", minimum: 0, maximum: 1 },
    frequency_penalty: { type: "number", minimum: -2, maximum: 2 },
    presence_penalty: { type: "number", minimum: -2, maximum: 2 },
    repetition_penalty: { type: "number", minimum: Number.MIN_VALUE },
    seed: { type: "integer" },
    max_tokens: { type: "integer", minimum: 1, maximum: 65_536 },
    stop: { type: "array", items: { type: "string" }, maxItems: 16 },
    logprobs: { type: "boolean" },
    top_logprobs: { type: "integer", minimum: 0, maximum: 20 },
    reasoning: objectSchema,
    verbosity: { enum: ["low", "medium", "high"] }
  }
} as const
const modelTimeoutSchema = { type: "integer", minimum: 1_000, maximum: 300_000 } as const

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
  manual_trigger: [],
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
    field("onExhaustion", "On exhaustion", "Chooses whether reaching the limit routes or fails.", "select", {
      options: ["fail", "route"]
    })
  ],
  wait_event_github: [
    field("eventKey", "Event", "Selects the GitHub event that resumes the workflow.", "select", { required: true }),
    field("objectIdPath", "Object ID from input", "Selects the input path containing the GitHub object ID.", "json", {
      required: true
    }),
    field("onTimeout", "On timeout", "Chooses whether expiry routes or fails the run.", "select", {
      options: ["fail", "route"]
    }),
    field("expiresAfterSeconds", "Wait up to", "Sets how long the workflow waits.", "number", {
      minimum: 1,
      maximum: 2592000
    })
  ],
  wait_event_linear: [
    field("eventKey", "Event", "Selects the Linear event that resumes the workflow.", "select", { required: true }),
    field("objectIdPath", "Object ID from input", "Selects the input path containing the Linear object ID.", "json", {
      required: true
    }),
    field("onTimeout", "On timeout", "Chooses whether expiry routes or fails the run.", "select", {
      options: ["fail", "route"]
    }),
    field("expiresAfterSeconds", "Wait up to", "Sets how long the workflow waits.", "number", {
      minimum: 1,
      maximum: 2592000
    })
  ],
  delay: [
    field("duration", "Duration", "Sets how long the workflow pauses.", "number", {
      minimum: 1,
      maximum: 2592000,
      required: true
    }),
    field("unit", "Unit", "Sets the duration unit.", "select", {
      options: ["seconds", "minutes", "hours", "days"],
      required: true
    })
  ],
  child_workflow: [
    field("timeoutSeconds", "Timeout", "Limits how long the parent waits for the child.", "number", {
      minimum: 1,
      maximum: 604800
    }),
    field("maximumDepth", "Maximum invocation depth", "Limits nested workflow invocation.", "number", {
      minimum: 1,
      maximum: 20
    }),
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
    configSchema: { type: "object", additionalProperties: false },
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
    configSchema: {
      type: "object",
      required: ["fields"],
      properties: { fields: objectSchema },
      additionalProperties: false
    },
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
    configSchema: {
      type: "object",
      required: ["mappings"],
      properties: { mappings: objectSchema },
      additionalProperties: false
    },
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
    configSchema: {
      type: "object",
      required: ["schema"],
      properties: { schema: { type: "object" } },
      additionalProperties: false
    },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [
      port("true", "True", objectSchema, "optional"),
      port("false", "False", invalidValidationSchema, "optional")
    ],
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
    configSchema: {
      type: "object",
      required: ["template"],
      properties: { template: { type: "string" } },
      additionalProperties: false
    },
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
      required: ["mode", "maximumItems"],
      properties: {
        mode: { enum: ["array", "keyed"] },
        keyField: { type: "string" },
        maximumItems: { type: "integer", minimum: 1, maximum: 1000 }
      },
      additionalProperties: false
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
      properties: {
        operation: {
          enum: [
            "metadata",
            "file_content",
            "commit",
            "code_search",
            "pull_request",
            "pull_request_files",
            "checks",
            "reviews",
            "comments"
          ]
        },
        repository: {
          type: "object",
          required: ["owner", "name"],
          properties: {
            owner: { type: "string", minLength: 1, maxLength: 100 },
            name: { type: "string", minLength: 1, maxLength: 100 },
            ref: { type: "string", minLength: 1, default: "HEAD" }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
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
      required: ["agentReference", "validationCommands", "allowedPaths", "forbiddenPaths", "budgets"],
      properties: {
        agentReference: {
          type: "object",
          required: [
            "connectionId",
            "repositoryId",
            "repositoryName",
            "ref",
            "path",
            "observedCommitSha",
            "blobSha",
            "contentDigest",
            "sourceUrl",
            "name",
            "description",
            "requestedTools"
          ],
          properties: {
            connectionId: { type: "string", format: "uuid" },
            repositoryId: { type: "string", minLength: 1 },
            repositoryName: { type: "string", minLength: 3, maxLength: 201 },
            ref: { type: "string", minLength: 1 },
            path: { type: "string", minLength: 1, maxLength: 500 },
            observedCommitSha: { type: "string", minLength: 40, maxLength: 40 },
            blobSha: { type: "string", minLength: 40, maxLength: 40 },
            contentDigest: { type: "string", minLength: 64, maxLength: 64 },
            sourceUrl: { type: "string", format: "uri" },
            name: { type: "string", minLength: 1, maxLength: 120 },
            description: { type: "string", minLength: 1, maxLength: 500 },
            requestedModel: { type: "string", minLength: 1 },
            requestedTools: { type: "array", maxItems: 64, items: { type: "string", minLength: 1 } }
          },
          additionalProperties: false
        },
        instructions: { type: "string", minLength: 1, maxLength: 20000 },
        validationCommands: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            required: ["id", "command", "workingDirectory", "timeoutMs"],
            properties: {
              id: { type: "string", minLength: 1, maxLength: 100 },
              command: { type: "string", minLength: 1 },
              workingDirectory: { type: "string", minLength: 1 },
              timeoutMs: { type: "integer", minimum: 1, maximum: 3600000 }
            },
            additionalProperties: false
          }
        },
        allowedPaths: { type: "array", minItems: 1, maxItems: 100, items: { type: "string", minLength: 1 } },
        forbiddenPaths: { type: "array", maxItems: 100, items: { type: "string", minLength: 1 } },
        budgets: {
          type: "object",
          required: ["maxTurns", "maxTokens", "maxElapsedMs"],
          properties: {
            maxTurns: { type: "integer", minimum: 1, maximum: 200 },
            maxTokens: { type: "integer", minimum: 1000, maximum: 1000000 },
            maxElapsedMs: { type: "integer", minimum: 60000, maximum: 3600000 }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
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
        modelId: { type: "string", minLength: 1 },
        messages: {
          type: "array",
          minItems: 1,
          maxItems: 64,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "content"],
            properties: {
              role: { enum: ["system", "developer", "user"] },
              content: { type: "string", maxLength: 262_144 }
            }
          }
        },
        outputMode: { enum: ["text", "markdown", "structured"] },
        outputSchema: {},
        parameters: modelParametersSchema,
        timeoutMs: modelTimeoutSchema
      },
      additionalProperties: false
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
      properties: {
        modelId: { type: "string", minLength: 1 },
        criteria: { type: "string", minLength: 1, maxLength: 262_144 },
        outputSchema: {},
        parameters: modelParametersSchema,
        timeoutMs: modelTimeoutSchema
      },
      additionalProperties: false
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
        onExhaustion: { enum: ["fail", "route"] }
      }
    },
    inputs: [port("state", "Loop state", objectSchema)],
    outputs: [
      port("iteration", "Iteration", loopIterationSchema, "optional"),
      port("result", "Final result", objectSchema, "optional"),
      port(
        "exhausted",
        "Exhausted",
        {
          type: "object",
          additionalProperties: false,
          required: ["state", "iterations", "maximumIterations"],
          properties: {
            state: objectSchema,
            iterations: { type: "integer", minimum: 0 },
            maximumIterations: { type: "integer", minimum: 1 }
          }
        },
        "optional"
      )
    ],
    errorSchema
  },
  ...(
    [
      {
        kind: "wait_event_github",
        label: "Wait event (GitHub)",
        description: "Waits for a GitHub event in this workflow's repository.",
        provider: "github"
      },
      {
        kind: "wait_event_linear",
        label: "Wait event (Linear)",
        description: "Waits for a Linear event in a selected team.",
        provider: "linear"
      }
    ] as const
  ).map(({ kind, label, description, provider }) => ({
    kind,
    version: 1,
    phase: 7,
    category: "action" as const,
    label,
    description,
    executionClass: "control" as const,
    mutationPolicy: "none" as const,
    capabilities: ["provider.events"],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["eventKey", "objectIdPath", "binding", "expiresAfterSeconds", "onTimeout"],
      properties: {
        eventKey: { type: "string", minLength: 1 },
        objectIdPath: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        binding: objectSchema,
        expiresAfterSeconds: { type: "integer", minimum: 1, maximum: 2592000 },
        onTimeout: { enum: ["fail", "route"] },
        provider: { const: provider }
      }
    },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [
      port("event", "Event received", objectSchema, "optional"),
      port(
        "timeout",
        "Timed out",
        {
          type: "object",
          additionalProperties: false,
          required: ["deadline", "elapsedSeconds", "correlationDigest"],
          properties: {
            deadline: { type: "string" },
            elapsedSeconds: { type: "integer", minimum: 0 },
            correlationDigest: { type: "string", minLength: 64, maxLength: 64 }
          }
        },
        "optional"
      )
    ],
    errorSchema
  })),
  {
    kind: "delay",
    version: 1,
    phase: 7,
    category: "action",
    label: "Delay",
    description: "Continues after a set amount of time.",
    executionClass: "control",
    mutationPolicy: "none",
    capabilities: [],
    configSchema: {
      type: "object",
      additionalProperties: false,
      required: ["duration", "unit"],
      properties: {
        duration: { type: "integer", minimum: 1, maximum: 2592000 },
        unit: { enum: ["seconds", "minutes", "hours", "days"] }
      }
    },
    inputs: [port("input", "Input", objectSchema)],
    outputs: [port("continued", "Continued", objectSchema)],
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
      required: ["packageDigest", "interfaceDigest", "timeoutSeconds", "maximumDepth"],
      properties: {
        packageDigest: { type: "string", minLength: 64, maxLength: 64 },
        interfaceDigest: { type: "string", minLength: 64, maxLength: 64 },
        timeoutSeconds: { type: "integer", minimum: 1, maximum: 604800 },
        maximumDepth: { type: "integer", minimum: 1, maximum: 20 }
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
