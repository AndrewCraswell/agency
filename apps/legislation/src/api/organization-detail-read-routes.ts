import type { IncomingMessage, ServerResponse } from "node:http"
import { LegislationError } from "../legislation/errors.js"
import { toProjectionLegislationError } from "./canonical-read.js"
import {
  assertAllowedQueryParameters,
  apiResource,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http.js"
import type {
  OrganizationDetailReadInput,
  OrganizationDetailReadRepository
} from "./organization-detail-read-repository.js"

const DEFAULT_CHILD_LIMIT = 25

export interface OrganizationDetailReadApi {
  getOrganizationDetail(
    input: OrganizationDetailReadInput
  ): ReturnType<OrganizationDetailReadRepository["getOrganizationDetail"]>
}

export function createOrganizationDetailReadApiHandler(service: OrganizationDetailReadApi): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      return await handleOrganizationDetailRequest(service, request, response, url)
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
      return true
    }
  }
}

async function handleOrganizationDetailRequest(
  service: OrganizationDetailReadApi,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<boolean> {
  const organizationId = routeOrganizationId(request.method, url.pathname)
  if (organizationId === undefined) {
    return false
  }
  assertAllowedQueryParameters(url, [])
  const detail = await service.getOrganizationDetail({
    childLimit: DEFAULT_CHILD_LIMIT,
    organizationId
  })
  sendApiJson(response, 200, apiResource(request, detail))
  return true
}

function routeOrganizationId(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const rawSegments = pathname.split("/")
  if (
    rawSegments.length !== 4 ||
    rawSegments[0] !== "" ||
    rawSegments[1] !== "api" ||
    rawSegments[2] !== "organizations"
  ) {
    return undefined
  }
  const organizationId = (() => {
    const segment = rawSegments[3]
    try {
      return decodeURIComponent(segment ?? "")
    } catch {
      throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
    }
  })().trim()
  if (organizationId.length === 0 || organizationId.length > 256) {
    throw new LegislationError("invalid_request", "organizationId must be between 1 and 256 characters")
  }
  return organizationId
}
