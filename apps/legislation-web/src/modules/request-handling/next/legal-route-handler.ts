import { getNextLegislationApplication } from "../../legislation/runtime/runtime"
import { createLegalBrowseApiHandler } from "../api/legal-browse-routes"
import { createLegalCodesApiHandler } from "../api/legal-codes-routes"
import { createLegalSearchApiHandler } from "../api/legal-search-routes"
import { createLegalTextApiHandler } from "../api/legal-text-routes"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request"

export async function handleLegalTextRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalTextApiHandler(application.readLegalText))
}

export async function handleLegalCodesRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalCodesApiHandler(application.legalCodes))
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
