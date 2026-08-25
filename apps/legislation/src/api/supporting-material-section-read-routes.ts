import { LegislationError } from "../legislation/errors.js"
import type { SupportingMaterialSectionRead } from "./canonical-read.js"
import { projectSupportingMaterialSectionRead, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface SupportingMaterialSectionReadApi {
  getSupportingMaterialSection: (
    input: Readonly<{ materialId: string; sectionId: string }>
  ) => Promise<SupportingMaterialSectionRead>
}

export function createSupportingMaterialSectionReadApiHandler(
  service: SupportingMaterialSectionReadApi,
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
      const data = await service.getSupportingMaterialSection(route)
      sendApiJson(response, 200, apiResource(request, projectSupportingMaterialSectionRead(data, options.apiBaseUrl)))
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
    }
    return true
  }
}

function routeMatch(
  method: string | undefined,
  pathname: string
): Readonly<{ materialId: string; sectionId: string }> | undefined {
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
  if (
    segments.length !== 5 ||
    segments[0] !== "api" ||
    segments[1] !== "supporting-materials" ||
    segments[3] !== "sections"
  ) {
    return undefined
  }
  return {
    materialId: canonicalPathId(segments[2], "materialId"),
    sectionId: canonicalPathId(segments[4], "sectionId")
  }
}

function canonicalPathId(value: string, name: string): string {
  if (value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
