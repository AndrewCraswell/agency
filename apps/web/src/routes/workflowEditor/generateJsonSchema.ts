import type { JsonValue } from "@/services/api"
import { isJsonValue } from "./DraftJsonField"

const schemaKeys = new Set([
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "items",
  "additionalProperties",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "format",
  "default",
  "description"
])
const schemaTypes = new Set(["null", "boolean", "object", "array", "number", "integer", "string"])

function extractJson(source: string): JsonValue {
  const candidates = [source.trim()]
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(source)?.[1]
  if (fenced !== undefined) {
    candidates.push(fenced.trim())
  }
  const objectStart = source.indexOf("{")
  const objectEnd = source.lastIndexOf("}")
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(source.slice(objectStart, objectEnd + 1))
  }
  const arrayStart = source.indexOf("[")
  const arrayEnd = source.lastIndexOf("]")
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(source.slice(arrayStart, arrayEnd + 1))
  }
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (isJsonValue(parsed)) {
        return parsed
      }
    } catch {
      continue
    }
  }
  throw new Error("Include a JSON example in the prompt or paste an example output.")
}

function inferSchema(value: JsonValue): JsonValue {
  if (value === null) {
    return { type: "null" }
  }
  if (typeof value === "boolean") {
    return { type: "boolean" }
  }
  if (typeof value === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number" }
  }
  if (typeof value === "string") {
    return { type: "string" }
  }
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length === 0 ? {} : inferSchema(value[0] ?? null)
    }
  }
  const entries = Object.entries(value)
  return {
    type: "object",
    properties: Object.fromEntries(entries.map(([key, child]) => [key, inferSchema(child)])),
    required: entries.map(([key]) => key),
    additionalProperties: false
  }
}

export function generateJsonSchema(source: string): JsonValue {
  return inferSchema(extractJson(source))
}

export function supportedJsonSchemaError(value: JsonValue, path = "$schema"): string | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return `${path} must be an object.`
  }
  const unsupported = Object.keys(value).find((key) => !schemaKeys.has(key))
  if (unsupported !== undefined) {
    return `${path}.${unsupported} is not a supported schema keyword.`
  }
  const type = value.type
  const types = Array.isArray(type) ? type : [type]
  if (type !== undefined && types.some((item) => typeof item !== "string" || !schemaTypes.has(item))) {
    return `${path}.type contains an unsupported JSON type.`
  }
  if (value.additionalProperties !== undefined && typeof value.additionalProperties !== "boolean") {
    return `${path}.additionalProperties must be true or false.`
  }
  if (value.required !== undefined) {
    if (!Array.isArray(value.required) || value.required.some((item) => typeof item !== "string")) {
      return `${path}.required must be an array of property names.`
    }
  }
  if (value.properties !== undefined) {
    if (value.properties === null || Array.isArray(value.properties) || typeof value.properties !== "object") {
      return `${path}.properties must be an object.`
    }
    for (const [key, property] of Object.entries(value.properties)) {
      const error = supportedJsonSchemaError(property, `${path}.properties.${key}`)
      if (error !== null) {
        return error
      }
    }
  }
  if (value.items !== undefined) {
    const error = supportedJsonSchemaError(value.items, `${path}.items`)
    if (error !== null) {
      return error
    }
  }
  return null
}
