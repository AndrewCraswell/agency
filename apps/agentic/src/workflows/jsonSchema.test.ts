import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import { isJsonSchemaAssignable, schemaAtPath, SupportedJsonSchemaSchema, validateJsonValue } from "./jsonSchema"

describe("supported workflow JSON Schema", () => {
  describe("validateJsonValue", () => {
    it.each([
      { name: "null", schema: { type: "null" }, value: null },
      { name: "boolean", schema: { type: "boolean" }, value: true },
      { name: "object", schema: { type: "object" }, value: { ok: true } },
      { name: "array", schema: { type: "array" }, value: [1, 2] },
      { name: "number", schema: { type: "number" }, value: 1.25 },
      { name: "integer", schema: { type: "integer" }, value: 3 },
      { name: "string", schema: { type: "string" }, value: "ok" }
    ])("accepts primitive type $name", ({ schema, value }) => {
      expect(validateJsonValue(schema, value)).toEqual([])
    })

    it("distinguishes integer, number, and null", () => {
      expect(validateJsonValue({ type: "number" }, 5)).toEqual([])
      expect(validateJsonValue({ type: "integer" }, 1.5)).toEqual([{ path: "$", message: "Expected integer" }])
      expect(validateJsonValue({ type: "number" }, null)).toEqual([{ path: "$", message: "Expected number" }])
    })

    it("validates enum and const using canonical JSON digests", () => {
      expect(validateJsonValue({ const: { a: 1, b: [2, 3] } }, { b: [2, 3], a: 1 })).toEqual([])
      expect(validateJsonValue({ enum: [{ a: 1, b: [2, 3] }, { a: 2 }] }, { b: [2, 3], a: 1 })).toEqual([])
      expect(validateJsonValue({ const: { x: 1 } }, { x: 2 })).toEqual([
        { path: "$", message: "Value does not match the required constant" }
      ])
      expect(validateJsonValue({ enum: ["a", "b"] }, "c")).toEqual([
        { path: "$", message: "Value is not one of the allowed values" }
      ])
    })

    it("validates objects with required fields, properties, and additionalProperties", () => {
      const schema = {
        type: "object" as const,
        required: ["name", "count"],
        additionalProperties: false,
        properties: {
          name: { type: "string" as const },
          count: { type: "integer" as const },
          enabled: { type: "boolean" as const }
        }
      }

      expect(validateJsonValue(schema, { name: "task", count: 2, enabled: false })).toEqual([])
      expect(validateJsonValue(schema, { name: 1, extra: true })).toEqual([
        { path: "$.count", message: "Required value is missing" },
        { path: "$.name", message: "Expected string" },
        { path: "$.extra", message: "Additional values are not allowed" }
      ])
    })

    it("validates arrays with item schemas and size bounds", () => {
      const schema = {
        type: "array" as const,
        minItems: 2,
        maxItems: 3,
        items: { type: "integer" as const }
      }

      expect(validateJsonValue(schema, [1, 2])).toEqual([])
      expect(validateJsonValue(schema, [1])).toEqual([{ path: "$", message: "Expected at least 2 items" }])
      expect(validateJsonValue(schema, [1, 2, 3, 4])).toEqual([{ path: "$", message: "Expected at most 3 items" }])
      expect(validateJsonValue(schema, [1, 2.5])).toEqual([{ path: "$.1", message: "Expected integer" }])
    })

    it("validates numeric minimum and maximum", () => {
      const schema = { type: "number" as const, minimum: 2, maximum: 4 }

      expect(validateJsonValue(schema, 3)).toEqual([])
      expect(validateJsonValue(schema, 1)).toEqual([{ path: "$", message: "Expected at least 2" }])
      expect(validateJsonValue(schema, 5)).toEqual([{ path: "$", message: "Expected at most 4" }])
    })

    it.each([
      {
        name: "minimum length",
        schema: { type: "string" as const, minLength: 3 },
        value: "ab",
        expected: [{ path: "$", message: "Expected at least 3 characters" }]
      },
      {
        name: "maximum length",
        schema: { type: "string" as const, maxLength: 2 },
        value: "abc",
        expected: [{ path: "$", message: "Expected at most 2 characters" }]
      },
      {
        name: "uuid format",
        schema: { type: "string" as const, format: "uuid" as const },
        value: "not-a-uuid",
        expected: [{ path: "$", message: "Expected a UUID" }]
      },
      {
        name: "date-time format",
        schema: { type: "string" as const, format: "date-time" as const },
        value: "2024-01-01T00:00:00",
        expected: [{ path: "$", message: "Expected an offset date-time" }]
      },
      {
        name: "uri format",
        schema: { type: "string" as const, format: "uri" as const },
        value: "nota-uri",
        expected: [{ path: "$", message: "Expected a URI" }]
      }
    ])("validates string constraints: $name", ({ schema, value, expected }) => {
      expect(validateJsonValue(schema, value)).toEqual(expected)
    })

    it("accepts valid string formats", () => {
      expect(validateJsonValue({ type: "string", format: "uuid" }, "019c230c-60c6-7bd8-a9f8-9e5f51b09e2f")).toEqual([])
      expect(validateJsonValue({ type: "string", format: "date-time" }, "2024-01-01T00:00:00Z")).toEqual([])
      expect(validateJsonValue({ type: "string", format: "uri" }, "https://example.com/resource")).toEqual([])
    })

    it("supports union types", () => {
      expect(validateJsonValue({ type: ["string", "null"] }, "hello")).toEqual([])
      expect(validateJsonValue({ type: ["string", "null"] }, null)).toEqual([])
      expect(validateJsonValue({ type: ["string", "null"] }, 1)).toEqual([
        { path: "$", message: "Expected string or null" }
      ])
    })

    it("throws strict parse errors for unsupported schema keywords, types, formats, and invalid shapes", () => {
      const unsupportedSchemas = [
        {
          name: "unsupported keyword",
          schema: { type: "string", pattern: "^[a-z]+$" },
          expected: [
            {
              code: "unrecognized_keys",
              path: [],
              message: 'Unrecognized key: "pattern"'
            }
          ]
        },
        {
          name: "unsupported type",
          schema: { type: "bigint" },
          expected: [
            {
              code: "invalid_union",
              path: ["type"],
              message: "Invalid input"
            }
          ]
        },
        {
          name: "unsupported format",
          schema: { type: "string", format: "email" },
          expected: [
            {
              code: "invalid_value",
              path: ["format"],
              message: 'Invalid option: expected one of "uuid"|"date-time"|"uri"'
            }
          ]
        },
        {
          name: "invalid schema shape",
          schema: { type: "array", minItems: -1 },
          expected: [
            {
              code: "too_small",
              path: ["minItems"],
              message: "Too small: expected number to be >=0"
            }
          ]
        }
      ]

      for (const candidate of unsupportedSchemas) {
        let issues: Array<{ code: string; path: Array<string | number>; message: string }> | null = null
        try {
          validateJsonValue(candidate.schema, "value")
        } catch (error: unknown) {
          if (error instanceof ZodError) {
            issues = error.issues.map((issue) => ({
              code: issue.code,
              path: issue.path.filter((segment): segment is string | number => typeof segment !== "symbol"),
              message: issue.message
            }))
          } else {
            throw error
          }
        }
        expect(issues, candidate.name).toEqual(candidate.expected)
      }
    })
  })

  describe("schemaAtPath", () => {
    const schema = {
      type: "object" as const,
      properties: {
        id: { type: "string" as const },
        tags: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              label: { type: "string" as const }
            }
          }
        },
        listWithoutItems: { type: "array" as const }
      }
    }

    it("resolves object and array item paths", () => {
      expect(schemaAtPath(schema, ["id"])).toEqual({ type: "string" })
      expect(schemaAtPath(schema, ["tags", "[]", "label"])).toEqual({ type: "string" })
    })

    it("returns null for missing properties or array items", () => {
      expect(schemaAtPath(schema, ["missing"])).toBeNull()
      expect(schemaAtPath(schema, ["listWithoutItems", "[]"])).toBeNull()
      expect(schemaAtPath(schema, ["tags", "[]", "missing"])).toBeNull()
    })
  })

  describe("isJsonSchemaAssignable", () => {
    it.each([
      {
        name: "integer source assignable to number target",
        source: { type: "integer" },
        target: { type: "number" },
        expected: true
      },
      {
        name: "number source not assignable to integer target",
        source: { type: "number" },
        target: { type: "integer" },
        expected: false
      },
      {
        name: "union subset is assignable",
        source: { type: ["integer", "string"] },
        target: { type: ["number", "string", "null"] },
        expected: true
      },
      {
        name: "union superset is not assignable",
        source: { type: ["integer", "null"] },
        target: { type: ["number", "string"] },
        expected: false
      },
      {
        name: "object target required property must exist",
        source: { type: "object", properties: {} },
        target: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } }
        },
        expected: false
      },
      {
        name: "object required property must be assignable",
        source: { type: "object", properties: { id: { type: "number" } } },
        target: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } }
        },
        expected: false
      },
      {
        name: "object required property assignable",
        source: { type: "object", properties: { id: { type: "integer" } } },
        target: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "number" } }
        },
        expected: true
      },
      {
        name: "array item compatibility checked when both item schemas exist",
        source: { type: "array", items: { type: "string" } },
        target: { type: "array", items: { type: "number" } },
        expected: false
      },
      {
        name: "array assignability skips item check when target items are absent",
        source: { type: "array", items: { type: "string" } },
        target: { type: "array" },
        expected: true
      }
    ])("checks assignability: $name", ({ source, target, expected }) => {
      expect(isJsonSchemaAssignable(source, target)).toBe(expected)
    })
  })

  describe("SupportedJsonSchemaSchema", () => {
    it("accepts default values and normalizes schema defaults through parsing", () => {
      const parsed = SupportedJsonSchemaSchema.parse({
        type: "object",
        default: { nested: { a: 1, b: [true, null, "x"] } },
        properties: {
          nested: {
            type: "object",
            default: { b: [true, null, "x"], a: 1 }
          }
        }
      })

      expect(parsed.default).toEqual({ nested: { a: 1, b: [true, null, "x"] } })
      expect(parsed.properties?.nested?.default).toEqual({ b: [true, null, "x"], a: 1 })
    })
  })
})
