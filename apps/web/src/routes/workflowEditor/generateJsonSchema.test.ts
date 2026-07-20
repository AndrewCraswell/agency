import { describe, expect, it } from "vitest"
import { generateJsonSchema, supportedJsonSchemaError } from "./generateJsonSchema"

describe("generateJsonSchema", () => {
  it("infers a strict nested schema from example output", () => {
    expect(
      generateJsonSchema(JSON.stringify({ category: "bug", score: 0.75, count: 2, accepted: true, tags: ["urgent"] }))
    ).toEqual({
      type: "object",
      properties: {
        category: { type: "string" },
        score: { type: "number" },
        count: { type: "integer" },
        accepted: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } }
      },
      required: ["category", "score", "count", "accepted", "tags"],
      additionalProperties: false
    })
  })

  it("extracts a JSON example embedded in prompt text", () => {
    expect(generateJsonSchema('Return a decision like {"decision":"approve","evidence":null}.')).toEqual({
      type: "object",
      properties: { decision: { type: "string" }, evidence: { type: "null" } },
      required: ["decision", "evidence"],
      additionalProperties: false
    })
  })

  it("requires an explicit JSON example", () => {
    expect(() => generateJsonSchema("Return a category and confidence score.")).toThrow(
      "Include a JSON example in the prompt or paste an example output."
    )
  })

  it("rejects unsupported keywords in an edited proposal", () => {
    expect(supportedJsonSchemaError({ type: "object", oneOf: [] })).toBe(
      "$schema.oneOf is not a supported schema keyword."
    )
    expect(supportedJsonSchemaError({ type: "object", properties: { score: { type: "number" } } })).toBeNull()
  })
})
