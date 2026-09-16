import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  CanonicalSupportingMaterialSectionRead,
  DocumentPage,
  SupportingMaterialSectionListInput
} from "../../legislation/persistence/queries/document-reads.js"
import type { SupportingMaterialSectionRead } from "./canonical-read.js"
import { projectSupportingMaterialSectionRead, toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiPage,
  apiResource,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"

export interface SupportingMaterialSectionReadApi {
  assertSupportingMaterialExists?: (materialId: string) => Promise<void>
  getSupportingMaterialSection: (
    input: Readonly<{ materialId: string; sectionId: string }>
  ) => Promise<SupportingMaterialSectionRead>
  listSupportingMaterialSections?: (
    input: SupportingMaterialSectionListInput
  ) => Promise<DocumentPage<CanonicalSupportingMaterialSectionRead>>
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
      if (route.name === "list") {
        if (
          service.assertSupportingMaterialExists === undefined ||
          service.listSupportingMaterialSections === undefined
        ) {
          return false
        }
        assertAllowedQueryParameters(url, ["cursor", "heading", "limit", "pageFrom", "pageTo"])
        const limit = optionalPositiveInteger(url, "limit") ?? 20
        const pageFrom = optionalPositiveInteger(url, "pageFrom")
        const pageTo = optionalPositiveInteger(url, "pageTo")
        const cursor = singleNonBlankQueryString(url, "cursor")
        const heading = singleNonBlankQueryString(url, "heading")
        if (pageFrom !== undefined && pageTo !== undefined && pageFrom > pageTo) {
          throw new LegislationError("invalid_request", "pageFrom must not be greater than pageTo")
        }
        await service.assertSupportingMaterialExists(route.materialId)
        const page = await service.listSupportingMaterialSections({
          cursor,
          heading,
          limit,
          materialId: route.materialId,
          pageFrom,
          pageTo
        })
        sendApiJson(
          response,
          200,
          apiPage(request, projectSupportingMaterialSectionPage(page, options.apiBaseUrl), limit)
        )
      } else {
        assertAllowedQueryParameters(url, [])
        const data = await service.getSupportingMaterialSection({
          materialId: route.materialId,
          sectionId: route.sectionId
        })
        sendApiJson(response, 200, apiResource(request, projectSupportingMaterialSectionRead(data, options.apiBaseUrl)))
      }
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
    }
    return true
  }
}

type SupportingMaterialSectionRoute =
  | Readonly<{ materialId: string; name: "list" }>
  | Readonly<{ materialId: string; name: "get"; sectionId: string }>

function projectSupportingMaterialSectionPage(
  page: DocumentPage<CanonicalSupportingMaterialSectionRead>,
  apiBaseUrl: string
) {
  return {
    ...page,
    items: page.items.map((item) => projectSupportingMaterialSectionRead(item, apiBaseUrl))
  }
}

function routeMatch(method: string | undefined, pathname: string): SupportingMaterialSectionRoute | undefined {
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
  if (segments[0] !== "api" || segments[1] !== "supporting-materials" || segments[3] !== "sections") {
    return undefined
  }
  if (segments.length === 4) {
    return { materialId: canonicalPathId(segments[2] ?? "", "materialId"), name: "list" }
  }
  if (segments.length !== 5) {
    return undefined
  }
  return {
    materialId: canonicalPathId(segments[2] ?? "", "materialId"),
    name: "get",
    sectionId: canonicalPathId(segments[4] ?? "", "sectionId")
  }
}

function optionalPositiveInteger(url: URL, name: string): number | undefined {
  const value = singleNonBlankQueryString(url, name)
  if (value === undefined) {
    return undefined
  }
  const parameterUrl = new URL("http://localhost")
  parameterUrl.searchParams.set(name, value)
  return queryInteger(parameterUrl, name, 1)
}

function singleNonBlankQueryString(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length > 1) {
    throw new LegislationError("invalid_request", `${name} must not be repeated`)
  }
  const value = values[0]
  if (value === undefined || value.trim().length === 0) {
    throw new LegislationError("invalid_request", `${name} must not be blank`)
  }
  return value.trim()
}

function canonicalPathId(value: string, name: string): string {
  if (value.length < 1 || value.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return value
}
