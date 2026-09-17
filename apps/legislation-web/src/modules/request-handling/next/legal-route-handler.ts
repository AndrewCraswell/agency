import { getNextLegislationApplication } from "../../legislation/runtime/runtime"
import { createLegalAgenciesApiHandler } from "../api/legal-agencies-routes"
import { createLegalBrowseApiHandler } from "../api/legal-browse-routes"
import { createLegalCodesApiHandler } from "../api/legal-codes-routes"
import { createLegalCoverageApiHandler } from "../api/legal-coverage-routes"
import { createLegalSearchApiHandler } from "../api/legal-search-routes"
import { createLegalTextApiHandler } from "../api/legal-text-routes"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request"

export async function handleLegalTextRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalTextApiHandler(application.readLegalText))
}

export async function handleLegalAgenciesRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalAgenciesApiHandler(application.legalAgencies))
}

export async function handleLegalCodesRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalCodesApiHandler(application.legalCodes))
}

export async function handleLegalCoverageRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalCoverageApiHandler(application.legalCoverage))
}

export async function handleLegalBrowseRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalBrowseApiHandler(application.legalBrowser))
}

export async function handleLegalSearchRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(
    request,
    createLegalSearchApiHandler(application.searchLegal, new URL(request.url).origin)
  )
}
