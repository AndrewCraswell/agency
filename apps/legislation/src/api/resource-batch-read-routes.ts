import { LegislationError } from "../legislation/errors.js"
import {
  assertAllowedQueryParameters,
  correlationId,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler,
  type JsonRecord
} from "./http.js"
import {
  RESOURCE_TYPES,
  type CanonicalResource,
  type ResourceBatchReadRepository,
  type ResourceBatchRequestItem,
  type ResourceType
} from "./resource-batch-read-repository.js"

const MAX_BATCH_BODY_BYTES = 5 * 1024 * 1024
const MAX_BATCH_ITEMS = 25
const MAX_RESOURCE_ID_LENGTH = 256

const CANONICAL_RESOURCE_TYPES = [
  "jurisdiction",
  "session",
  "bill",
  "amendment",
  "vote",
  "document",
  "supporting-material",
  "person",
  "organization",
  "meeting",
  "calendar"
] as const

type CanonicalResourceType = (typeof CANONICAL_RESOURCE_TYPES)[number]

type BatchItem =
  | Readonly<{ id: string; status: "ok"; data: CanonicalResource }>
  | Readonly<{ id: string; status: "error"; error: BatchItemError }>

type BatchItemError = Readonly<{
  category: "not_found" | "forbidden" | "dependency_unavailable"
  message: string
  retryable: boolean
}>

export function createResourceBatchReadApiHandler(repository: ResourceBatchReadRepository): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/resources/batch") {
      return false
    }

    try {
      assertAllowedQueryParameters(url, [])
      const body = await readJsonBody(request, MAX_BATCH_BODY_BYTES)
      const requestedItems = parseRequestItems(body)
      const items = deduplicateRequestItems(requestedItems)
      const data = await Promise.all(items.map(async (item) => await resolveItem(repository, item)))

      sendApiJson(response, 200, {
        data,
        links: { self: `${url.pathname}${url.search}` },
        meta: {
          correlationId: correlationId(request),
          requested: items.length,
          returned: data.length,
          warnings: []
        }
      })
      return true
    } catch (error) {
      sendApiError(request, response, error)
      return true
    }
  }
}

async function resolveItem(
  repository: ResourceBatchReadRepository,
  item: ResourceBatchRequestItem
): Promise<BatchItem> {
  try {
    const resource = await repository.getResource(item)
    if (!matchesRequestedResource(resource, item)) {
      throw new LegislationError("dependency_unavailable", "Canonical resource did not match the requested item")
    }
    return { data: resource, id: item.id, status: "ok" }
  } catch (error) {
    return { error: toBatchItemError(error), id: item.id, status: "error" }
  }
}

function toBatchItemError(error: unknown): BatchItemError {
  if (error instanceof LegislationError) {
    if (error.category === "not_found" || error.category === "forbidden") {
      return { category: error.category, message: error.message, retryable: false }
    }
    if (error.category === "dependency_unavailable") {
      return { category: error.category, message: error.message, retryable: true }
    }
  }
  return {
    category: "dependency_unavailable",
    message: "The canonical resource is currently unavailable",
    retryable: true
  }
}

function parseRequestItems(body: JsonRecord): ResourceBatchRequestItem[] {
  if (!hasExactKeys(body, ["items"])) {
    throw new LegislationError("invalid_request", "Request body must contain only an items property")
  }
  const value = body.items
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BATCH_ITEMS) {
    throw new LegislationError("invalid_request", `items must contain between 1 and ${MAX_BATCH_ITEMS} resources`)
  }
  return value.map((item, index) => parseRequestItem(item, index))
}

function deduplicateRequestItems(items: readonly ResourceBatchRequestItem[]): ResourceBatchRequestItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}\u0000${item.id}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function parseRequestItem(value: unknown, index: number): ResourceBatchRequestItem {
  if (!isRecord(value) || !hasExactKeys(value, ["type", "id"])) {
    throw new LegislationError("invalid_request", `items[${index}] must contain only type and id`)
  }
  if (!isResourceType(value.type)) {
    throw new LegislationError("invalid_request", `items[${index}].type is not supported`)
  }
  if (typeof value.id !== "string") {
    throw new LegislationError("invalid_request", `items[${index}].id must be a string`)
  }
  const id = value.id.trim()
  if (id.length < 1 || id.length > MAX_RESOURCE_ID_LENGTH) {
    throw new LegislationError(
      "invalid_request",
      `items[${index}].id must be between 1 and ${MAX_RESOURCE_ID_LENGTH} characters`
    )
  }
  return { id, type: value.type }
}

function matchesRequestedResource(value: unknown, item: ResourceBatchRequestItem): value is CanonicalResource {
  if (!isRecord(value) || typeof value.id !== "string" || value.id !== item.id) {
    return false
  }
  return isCanonicalResourceType(value.type) && value.type === item.type
}

function isCanonicalResourceType(value: unknown): value is CanonicalResourceType {
  return typeof value === "string" && (CANONICAL_RESOURCE_TYPES as readonly string[]).includes(value)
}

function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}
