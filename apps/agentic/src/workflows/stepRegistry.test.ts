import { describe, expect, it } from "vitest"
import { getWorkflowStepDefinition, listWorkflowStepDefinitions } from "./stepRegistry"

describe("workflow step registry", () => {
  it("exposes executable steps through the Phase 7 release gate", () => {
    expect(listWorkflowStepDefinitions().map(({ kind }) => kind)).toEqual([
      "manual_trigger",
      "set_fields",
      "map_fields",
      "validate",
      "compose_markdown",
      "collect",
      "repository_data",
      "repository_agent",
      "ai_model",
      "structured_judgment",
      "provider_event",
      "schedule",
      "provider_data",
      "provider_action",
      "condition",
      "switch",
      "exclusive_merge",
      "join",
      "for_each",
      "bounded_loop",
      "wait_event_github",
      "wait_event_linear",
      "delay",
      "child_workflow"
    ])
  })

  it("registers every planned family in its release phase", () => {
    const definitions = listWorkflowStepDefinitions(7)
    expect(definitions.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "collect",
        "repository_data",
        "repository_agent",
        "ai_model",
        "structured_judgment",
        "provider_event",
        "provider_data",
        "provider_action",
        "condition",
        "switch",
        "exclusive_merge",
        "join",
        "for_each",
        "bounded_loop",
        "wait_event_github",
        "wait_event_linear",
        "delay",
        "child_workflow"
      ])
    )
    expect(definitions.every(({ executorDigest }) => /^[0-9a-f]{64}$/u.test(executorDigest))).toBe(true)
  })

  it("describes external mutations and prevents early lookup", () => {
    expect(getWorkflowStepDefinition("provider_action", 1).mutationPolicy).toBe("external_effect")
    expect(() => getWorkflowStepDefinition("provider_action", 1, 5)).toThrow("not available through phase 5")
  })

  it("publishes explicit UI metadata for typed and advanced configuration", () => {
    expect(getWorkflowStepDefinition("manual_trigger", 1)).toMatchObject({
      configSchema: { type: "object", additionalProperties: false },
      ui: { fields: [] }
    })
    expect(getWorkflowStepDefinition("set_fields", 1).ui.fields).toContainEqual(
      expect.objectContaining({ key: "fields", label: "Fields", control: "object_rows", group: "basic" })
    )
    expect(getWorkflowStepDefinition("collect", 1).ui.fields).toContainEqual(
      expect.objectContaining({ key: "maximumItems", minimum: 1, maximum: 1000 })
    )
    expect(getWorkflowStepDefinition("validate", 1).ui.fields).toContainEqual(
      expect.objectContaining({ key: "schema", control: "json", group: "advanced", required: true })
    )
    expect(getWorkflowStepDefinition("child_workflow", 1).ui.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "packageDigest", immutable: true })])
    )
  })

  it("publishes closed model configuration contracts aligned with their executors", () => {
    const modelConfig = getWorkflowStepDefinition("ai_model", 1).configSchema
    expect(modelConfig).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["modelId", "messages", "outputMode"],
      properties: {
        modelId: { type: "string", minLength: 1 },
        messages: { type: "array", minItems: 1, maxItems: 64 },
        outputMode: { enum: ["text", "markdown", "structured"] },
        outputSchema: {},
        parameters: { type: "object", additionalProperties: false },
        timeoutMs: { type: "integer", minimum: 1_000, maximum: 300_000 }
      }
    })
    expect(getWorkflowStepDefinition("structured_judgment", 1).configSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["modelId", "criteria", "outputSchema"],
      properties: {
        modelId: { type: "string", minLength: 1 },
        criteria: { type: "string", minLength: 1, maxLength: 262_144 },
        outputSchema: {},
        parameters: { type: "object", additionalProperties: false },
        timeoutMs: { type: "integer", minimum: 1_000, maximum: 300_000 }
      }
    })
  })

  it("publishes closed repository node contracts aligned with their executors", () => {
    expect(getWorkflowStepDefinition("repository_data", 1).configSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
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
        repository: { type: "object", additionalProperties: false, required: ["owner", "name"] }
      }
    })
    expect(getWorkflowStepDefinition("repository_agent", 1).configSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["agentReference", "validationCommands", "allowedPaths", "forbiddenPaths", "budgets"],
      properties: {
        agentReference: { type: "object", additionalProperties: false },
        validationCommands: { type: "array", minItems: 1, maxItems: 20 },
        allowedPaths: { type: "array", minItems: 1, maxItems: 100 },
        forbiddenPaths: { type: "array", maxItems: 100 },
        budgets: { type: "object", additionalProperties: false }
      }
    })
  })
})
