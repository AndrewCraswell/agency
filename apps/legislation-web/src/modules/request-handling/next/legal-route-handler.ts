import { getNextLegislationApplication } from "../../legislation/runtime/runtime.js"
import { createLegalBrowseApiHandler } from "../api/legal-browse-routes.js"
import { createLegalCodesApiHandler } from "../api/legal-codes-routes.js"
import { createLegalSearchApiHandler } from "../api/legal-search-routes.js"
import { createLegalTextApiHandler } from "../api/legal-text-routes.js"
import { executeAuthenticatedApiRequest } from "./authenticated-api-request.js"

export async function handleLegalTextRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalTextApiHandler(application.readLegalText))
}

export async function handleLegalCodesRequest(request: Request): Promise<Response> {
  const application = getNextLegislationApplication()
  return executeAuthenticatedApiRequest(request, createLegalCodesApiHandler(application.listLegalCodes))
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
