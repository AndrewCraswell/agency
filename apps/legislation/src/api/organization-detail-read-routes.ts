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
const MAX_CHILD_LIMIT = 25

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
  assertAllowedQueryParameters(url, ["childLimit"])
  assertSingleQueryParameter(url, "childLimit")
  const detail = await service.getOrganizationDetail({
    childLimit: queryChildLimit(url),
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

function assertSingleQueryParameter(url: URL, name: string): void {
  if (url.searchParams.getAll(name).length > 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
}

function queryChildLimit(url: URL): number {
  const raw = url.searchParams.get("childLimit")
  if (raw === null) {
    return DEFAULT_CHILD_LIMIT
  }
  const value = raw.trim()
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", `childLimit must be between 1 and ${MAX_CHILD_LIMIT}`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_CHILD_LIMIT) {
    throw new LegislationError("invalid_request", `childLimit must be between 1 and ${MAX_CHILD_LIMIT}`)
  }
  return parsed
}
