import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { EventDocumentRead } from "../../legislation/persistence/queries/event-document-read.js"
import { projectEventDocument } from "./canonical-projection.js"
import { sourceProjectionContext, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface EventDocumentReadApi {
  getEventDocument: (input: Readonly<{ eventDocumentId: string; meetingId: string }>) => Promise<EventDocumentRead>
}

export function createEventDocumentReadApiHandler(
  service: EventDocumentReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      const route = routeMatch(request.method, url.pathname)
      if (route === undefined) {
        return false
      }
      assertAllowedQueryParameters(url, [])
      const data = await service.getEventDocument(route)
      sendApiJson(
        response,
        200,
        apiResource(
          request,
          projectEventDocument(
            {
              classification: data.classification,
              documentId: data.documentId,
              id: data.id,
              materialId: data.materialId,
              meetingId: data.meetingId,
              sourceUrl: data.sourceUrl,
              title: data.title
            },
            sourceProjectionContext(data, options.apiBaseUrl)
          )
        )
      )
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
    }
    return true
  }
}

function routeMatch(
  method: string | undefined,
  pathname: string
): Readonly<{ eventDocumentId: string; meetingId: string }> | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
      }
    })
  if (segments.length !== 5 || segments[0] !== "api" || segments[1] !== "meetings" || segments[3] !== "documents") {
    return undefined
  }
  return {
    eventDocumentId: canonicalPathId(segments[4], "eventDocumentId"),
    meetingId: canonicalPathId(segments[2], "meetingId")
  }
}

function canonicalPathId(value: string, name: string): string {
  if (value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
