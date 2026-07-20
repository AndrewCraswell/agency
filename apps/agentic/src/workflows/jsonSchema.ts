import { z } from "zod"
import { JsonValueSchema, jsonValueDigest, type JsonValue } from "./executionContracts"

const JsonTypeSchema = z.enum(["null", "boolean", "object", "array", "number", "integer", "string"])

export type SupportedJsonSchema = {
  type?: z.infer<typeof JsonTypeSchema> | Array<z.infer<typeof JsonTypeSchema>>
  enum?: JsonValue[]
  const?: JsonValue
  properties?: Record<string, SupportedJsonSchema>
  required?: string[]
  items?: SupportedJsonSchema
  additionalProperties?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  format?: "uuid" | "date-time" | "uri"
  default?: JsonValue
  description?: string
}

export const SupportedJsonSchemaSchema: z.ZodType<SupportedJsonSchema> = z.lazy(() =>
  z
    .object({
      type: z.union([JsonTypeSchema, z.array(JsonTypeSchema).min(1)]).optional(),
      enum: z.array(JsonValueSchema).min(1).optional(),
      const: JsonValueSchema.optional(),
      properties: z.record(z.string(), SupportedJsonSchemaSchema).optional(),
      required: z.array(z.string()).optional(),
      items: SupportedJsonSchemaSchema.optional(),
      additionalProperties: z.boolean().optional(),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
      minLength: z.number().int().nonnegative().optional(),
      maxLength: z.number().int().nonnegative().optional(),
      minItems: z.number().int().nonnegative().optional(),
      maxItems: z.number().int().nonnegative().optional(),
      format: z.enum(["uuid", "date-time", "uri"]).optional(),
      default: JsonValueSchema.optional(),
      description: z.string().optional()
    })
    .strict()
)

export type JsonSchemaIssue = { path: string; message: string }

function valueType(value: JsonValue): z.infer<typeof JsonTypeSchema> {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "string") return "string"
  return "object"
}

function allowsType(schema: SupportedJsonSchema, actual: z.infer<typeof JsonTypeSchema>): boolean {
  if (schema.type === undefined) return true
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  return types.includes(actual) || (actual === "integer" && types.includes("number"))
}

function childPath(path: string, segment: string | number): string {
  return path === "$" ? `$.${segment}` : `${path}.${segment}`
}

function validateValue(schema: SupportedJsonSchema, value: JsonValue, path: string, issues: JsonSchemaIssue[]): void {
  const actualType = valueType(value)
  if (!allowsType(schema, actualType)) {
    issues.push({ path, message: `Expected ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}` })
    return
  }
  if (schema.const !== undefined && jsonValueDigest(schema.const) !== jsonValueDigest(value)) {
    issues.push({ path, message: "Value does not match the required constant" })
  }
  if (
    schema.enum !== undefined &&
    !schema.enum.some((candidate) => jsonValueDigest(candidate) === jsonValueDigest(value))
  ) {
    issues.push({ path, message: "Value is not one of the allowed values" })
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `Expected at least ${schema.minLength} characters` })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({ path, message: `Expected at most ${schema.maxLength} characters` })
    }
    if (schema.format === "uuid" && !z.uuid().safeParse(value).success)
      issues.push({ path, message: "Expected a UUID" })
    if (schema.format === "date-time" && !z.iso.datetime({ offset: true }).safeParse(value).success) {
      issues.push({ path, message: "Expected an offset date-time" })
    }
    if (schema.format === "uri" && !z.url().safeParse(value).success) issues.push({ path, message: "Expected a URI" })
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      issues.push({ path, message: `Expected at least ${schema.minimum}` })
    if (schema.maximum !== undefined && value > schema.maximum)
      issues.push({ path, message: `Expected at most ${schema.maximum}` })
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      issues.push({ path, message: `Expected at least ${schema.minItems} items` })
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      issues.push({ path, message: `Expected at most ${schema.maxItems} items` })
    if (schema.items !== undefined)
      value.forEach((item, index) => validateValue(schema.items ?? {}, item, childPath(path, index), issues))
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const properties = schema.properties ?? {}
    for (const required of schema.required ?? []) {
      if (!(required in value)) issues.push({ path: childPath(path, required), message: "Required value is missing" })
    }
    for (const [key, item] of Object.entries(value)) {
      const propertySchema = properties[key]
      if (propertySchema !== undefined) validateValue(propertySchema, item, childPath(path, key), issues)
      else if (schema.additionalProperties === false)
        issues.push({ path: childPath(path, key), message: "Additional values are not allowed" })
    }
  }
}

export function validateJsonValue(schemaInput: unknown, valueInput: unknown): JsonSchemaIssue[] {
  const schema = SupportedJsonSchemaSchema.parse(schemaInput)
  const value = JsonValueSchema.parse(valueInput)
  const issues: JsonSchemaIssue[] = []
  validateValue(schema, value, "$", issues)
  return issues
}

export function schemaAtPath(schemaInput: unknown, path: string[]): SupportedJsonSchema | null {
  let schema = SupportedJsonSchemaSchema.parse(schemaInput)
  for (const segment of path) {
    if (schema.type === "array" && segment === "[]") {
      if (schema.items === undefined) return null
      schema = schema.items
      continue
    }
    const property = schema.properties?.[segment]
    if (property === undefined) return null
    schema = property
  }
  return schema
}

function schemaTypes(schema: SupportedJsonSchema): Set<z.infer<typeof JsonTypeSchema>> {
  if (schema.type === undefined) return new Set(JsonTypeSchema.options)
  return new Set(Array.isArray(schema.type) ? schema.type : [schema.type])
}

export function isJsonSchemaAssignable(sourceInput: unknown, targetInput: unknown): boolean {
  const source = SupportedJsonSchemaSchema.parse(sourceInput)
  const target = SupportedJsonSchemaSchema.parse(targetInput)
  const targetTypes = schemaTypes(target)
  const hasCompatibleTypes = [...schemaTypes(source)].every(
    (type) => targetTypes.has(type) || (type === "integer" && targetTypes.has("number"))
  )
  if (!hasCompatibleTypes) return false
  if (target.type === "object") {
    for (const required of target.required ?? []) {
      const sourceProperty = source.properties?.[required]
      const targetProperty = target.properties?.[required]
      if (
        sourceProperty === undefined ||
        targetProperty === undefined ||
        !isJsonSchemaAssignable(sourceProperty, targetProperty)
      )
        return false
    }
  }
  if (target.type === "array" && source.items !== undefined && target.items !== undefined) {
    return isJsonSchemaAssignable(source.items, target.items)
  }
  return true
}
