import { describe, expect, it } from "vitest"
import { getWorkflowStepDefinition, listWorkflowStepDefinitions } from "./stepRegistry"

describe("workflow step registry", () => {
  it("exposes executable steps through the Phase 7 release gate", () => {
    expect(listWorkflowStepDefinitions().map(({ kind }) => kind)).toEqual([
      "manual_trigger",
      "set_fields",
      "map_fields",
      "validate",
      "success",
      "failure",
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
      "wait",
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
        "wait",
        "child_workflow"
      ])
    )
    expect(definitions.every(({ executorDigest }) => /^[0-9a-f]{64}$/u.test(executorDigest))).toBe(true)
  })

  it("describes external mutations and prevents early lookup", () => {
    expect(getWorkflowStepDefinition("provider_action", 1).mutationPolicy).toBe("external_effect")
    expect(() => getWorkflowStepDefinition("provider_action", 1, 5)).toThrow("not available through phase 5")
  })
})
