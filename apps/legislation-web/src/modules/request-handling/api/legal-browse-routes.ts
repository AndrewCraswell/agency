import { pageSchema } from "@repo/legislation-core/api-client/envelopes"
import {
  legalEditionsRequestSchema,
  legalProvisionEditionsRequestSchema,
  legalProvisionRequestSchema,
  legalProvisionVersionsRequestSchema,
  legalProvisionsRequestSchema,
  validateLegalEditionResponse,
  validateLegalEditionsResponse,
  validateLegalProvisionEditionsResponse,
  validateLegalProvisionResponse,
  validateLegalProvisionVersionsResponse,
  validateLegalProvisionsResponse
} from "@repo/legislation-core/api-client/legal-browse-contract"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  queryInteger,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import type { createLegalBrowser } from "./legal-browse-read"

export function createLegalBrowseApiHandler(browser: ReturnType<typeof createLegalBrowser>): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    const detail = /^\/api\/legal\/editions\/([^/]+)$/.exec(url.pathname)
    const provisionCollection = /^\/api\/legal\/provisions\/([^/]+)\/(versions|editions)$/.exec(url.pathname)
    const provision = /^\/api\/legal\/provisions\/([^/]+)$/.exec(url.pathname)
    const match = /^\/api\/legal\/codes\/([^/]+)\/(editions|provisions)$/.exec(url.pathname)
    if (request.method !== "GET" || (!match?.[1] && !detail?.[1] && !provision?.[1] && !provisionCollection?.[1])) {
      return false
    }
    response.setHeader("cache-control", "private, no-store")
    try {
      if (provisionCollection?.[1]) {
        let provisionId: string
        try {
          provisionId = z.uuid().parse(decodeURIComponent(provisionCollection[1]))
        } catch {
          throw new LegislationError("invalid_request", "Invalid legal provision ID")
        }
        const versions = provisionCollection[2] === "versions"
        assertAllowedQueryParameters(
          url,
          versions ? ["sourceId", "cursor", "limit"] : ["versionId", "sourceId", "cursor", "limit"]
        )
        for (const key of url.searchParams.keys()) {
          if (url.searchParams.getAll(key).length !== 1) {
            throw new LegislationError("invalid_request", "Duplicate query parameter")
          }
        }
        const raw = { ...Object.fromEntries(url.searchParams), limit: queryInteger(url, "limit", 20) }
        if (versions) {
          const parsed = legalProvisionVersionsRequestSchema.safeParse(raw)
          if (!parsed.success) {
            throw new LegislationError("invalid_request", "Invalid provision version filters or continuation")
          }
          const page = await browser.listProvisionVersions(provisionId, parsed.data)
          sendApiJson(
            response,
            200,
            validateLegalProvisionVersionsResponse(apiPage(request, page, parsed.data.limit), provisionId, parsed.data)
          )
        } else {
          const parsed = legalProvisionEditionsRequestSchema.safeParse(raw)
          if (!parsed.success) {
            throw new LegislationError("invalid_request", "Invalid provision edition filters or continuation")
          }
          const page = await browser.listProvisionEditions(provisionId, parsed.data)
          sendApiJson(
            response,
            200,
            validateLegalProvisionEditionsResponse(apiPage(request, page, parsed.data.limit), provisionId, parsed.data)
          )
        }
        return true
      }
      if (provision?.[1]) {
        assertAllowedQueryParameters(url, ["editionId", "versionId", "asOf"])
        let provisionId: string
        try {
          provisionId = z.uuid().parse(decodeURIComponent(provision[1]))
        } catch {
          throw new LegislationError("invalid_request", "Invalid legal provision ID")
        }
        for (const key of url.searchParams.keys()) {
          if (url.searchParams.getAll(key).length !== 1) {
            throw new LegislationError("invalid_request", "Duplicate query parameter")
          }
        }
        const parsed = legalProvisionRequestSchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) {
          throw new LegislationError("invalid_request", "Invalid provision selection")
        }
        const item = await browser.getProvision(provisionId, parsed.data)
        sendApiJson(response, 200, validateLegalProvisionResponse(apiResource(request, item), provisionId, parsed.data))
        return true
      }
      if (detail?.[1]) {
        assertAllowedQueryParameters(url, [])
        let editionId: string
        try {
          editionId = z.uuid().parse(decodeURIComponent(detail[1]))
        } catch {
          throw new LegislationError("invalid_request", "Invalid legal edition ID")
        }
        const edition = await browser.getEdition(editionId)
        sendApiJson(response, 200, validateLegalEditionResponse(apiResource(request, edition), editionId))
        return true
      }
      if (!match?.[1]) {
        return false
      }
      let codeId: string
      try {
        codeId = z.uuid().parse(decodeURIComponent(match[1]))
      } catch {
        throw new LegislationError("invalid_request", "Invalid legal code ID")
      }
      const editions = match[2] === "editions"
      assertAllowedQueryParameters(
        url,
        editions
          ? ["sourceId", "issuedFrom", "issuedTo", "cursor", "limit"]
          : ["editionId", "asOf", "traversal", "parentId", "nodeKind", "cursor", "limit"]
      )
      for (const key of url.searchParams.keys()) {
        if (url.searchParams.getAll(key).length !== 1) {
          throw new LegislationError("invalid_request", "Duplicate query parameter")
        }
      }
      const raw = { ...Object.fromEntries(url.searchParams), limit: queryInteger(url, "limit", 20) }
      if (editions) {
        const parsed = legalEditionsRequestSchema.safeParse(raw)
        if (!parsed.success) {
          throw new LegislationError("invalid_request", "Invalid edition filters or continuation")
        }
        const page = await browser.listEditions(codeId, parsed.data)
        sendApiJson(
          response,
          200,
          validateLegalEditionsResponse(apiPage(request, page, parsed.data.limit), codeId, parsed.data)
        )
      } else {
        const parsed = legalProvisionsRequestSchema.safeParse(raw)
        if (!parsed.success) {
          throw new LegislationError("invalid_request", "Invalid provision selection or continuation")
        }
        const page = await browser.listProvisions(codeId, parsed.data)
        const envelope = pageSchema.parse(apiPage(request, page, parsed.data.limit))
        const result = { ...envelope, meta: { ...envelope.meta, selectedEdition: page.selectedEdition } }
        sendApiJson(response, 200, validateLegalProvisionsResponse(result, codeId, parsed.data))
      }
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
