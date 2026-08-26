import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "../../api/amendment-search.js"
import { createCivicSearchApiHandler, type CivicSearchApi } from "../../api/civic-search.js"
import { createDocumentDiffApiHandler } from "../../api/document-diff-routes.js"
import { createCompositeHttpApiHandler, type HttpApiHandler } from "../../api/http.js"
import { executeNextHttpApiHandler } from "../../api/next/node-handler.js"
import { createPassageSearchApiHandler, type PassageSearchApi } from "../../api/passage-search.js"
import {
  createCanonicalResearchEvidenceRetriever,
  createOpenRouterResearchAnswerGenerator,
  createResearchAnswerApiHandler,
  createResearchAnswerService,
  createUnavailableResearchAnswerApi
} from "../../api/research-answers.js"
import { createProductionUniversalSearchApi } from "../../api/universal-search-adapter.js"
import { createUniversalSearchApiHandler } from "../../api/universal-search.js"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { readDocumentDiff } from "../../db/queries/document-diff-read.js"
import type { OpenRouterRetrievalClient } from "../../models/openrouter-retrieval.js"
import { getNextLegislationApplication } from "./runtime.js"

type Nx04QueryService = CivicSearchApi & AmendmentSearchApi & PassageSearchApi

type Nx04Application = Readonly<{
  config: Pick<LegislationConfig, "model" | "server">
  database: LegislationDatabase
  queryService: Nx04QueryService
  retrievalClient: OpenRouterRetrievalClient | undefined
}>

type NextHttpApiExecutor = (request: Request, handler: HttpApiHandler) => Promise<Response>

export type Nx04RequestHandlerDependencies = Readonly<{
  createHandler: () => HttpApiHandler
  execute: NextHttpApiExecutor
}>

let nx04Handler: HttpApiHandler | undefined

/** Handles only the NX-04 search, document-diff, and research-answer routes. */
export async function handleNx04Request(request: Request): Promise<Response> {
  nx04Handler ??= createNx04HttpApiHandler(getNextLegislationApplication())
  return await executeNextHttpApiHandler(request, nx04Handler)
}

export function createNx04RequestHandler(
  dependencies: Nx04RequestHandlerDependencies
): (request: Request) => Promise<Response> {
  let handler: HttpApiHandler | undefined
  return async (request) => {
    handler ??= dependencies.createHandler()
    return await dependencies.execute(request, handler)
  }
}

export function createNx04HttpApiHandler(application: Nx04Application): HttpApiHandler {
  const apiBaseUrl = requiredPublicApiBaseUrl(application)
  const options = { apiBaseUrl }

  return rejectTrailingSlashApiPaths(
    createCompositeHttpApiHandler([
      restrictToRoutes(createCivicSearchApiHandler(application.queryService, options), isCivicSearchRoute),
      restrictToRoutes(createAmendmentSearchApiHandler(application.queryService, options), isAmendmentSearchRoute),
      restrictToRoutes(createPassageSearchApiHandler(application.queryService, options), isPassageSearchRoute),
      restrictToRoutes(
        createUniversalSearchApiHandler(
          createProductionUniversalSearchApi(application.queryService, application.database, apiBaseUrl)
        ),
        isUniversalSearchRoute
      ),
      restrictToRoutes(
        createDocumentDiffApiHandler(
          { readDocumentDiff: async (input) => await readDocumentDiff(application.database, input) },
          options
        ),
        isDocumentDiffRoute
      ),
      restrictToRoutes(
        createResearchAnswerApiHandler(createResearchAnswerApi(application, apiBaseUrl)),
        isResearchAnswerRoute
      )
    ])
  )
}

function createResearchAnswerApi(application: Nx04Application, apiBaseUrl: string) {
  const retrievalClient = application.retrievalClient
  if (retrievalClient === undefined) {
    return createUnavailableResearchAnswerApi()
  }
  return createResearchAnswerService(
    createCanonicalResearchEvidenceRetriever(application.queryService, apiBaseUrl),
    createOpenRouterResearchAnswerGenerator(retrievalClient, application.config.model.researchAnswerModel)
  )
}

function requiredPublicApiBaseUrl(application: Nx04Application): string {
  const value = application.config.server.publicApiBaseUrl
  if (value === undefined) {
    throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required for Next API routes")
  }
  return value
}

function restrictToRoutes(
  handler: HttpApiHandler,
  matches: (request: Readonly<{ method?: string; url?: string }>) => boolean
): HttpApiHandler {
  return async (request, response) => (matches(request) ? await handler(request, response) : false)
}

function rejectTrailingSlashApiPaths(handler: HttpApiHandler): HttpApiHandler {
  return async (request, response) => (isTrailingSlashApiPath(request) ? false : await handler(request, response))
}

function isCivicSearchRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  const pathname = requestPathname(request)
  return (
    request.method === "POST" && (pathname === "/api/search/bills" || pathname === "/api/search/supporting-materials")
  )
}

function isAmendmentSearchRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/search/amendments"
}

function isPassageSearchRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/search/passages"
}

function isUniversalSearchRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/search/all"
}

function isDocumentDiffRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/document-diffs"
}

function isResearchAnswerRoute(request: Readonly<{ method?: string; url?: string }>): boolean {
  return request.method === "POST" && requestPathname(request) === "/api/research/answers"
}

function isTrailingSlashApiPath(request: Readonly<{ url?: string }>): boolean {
  const pathname = requestPathname(request)
  return pathname.startsWith("/api/") && pathname.endsWith("/")
}

function requestPathname(request: Readonly<{ url?: string }>): string {
  const value = request.url ?? ""
  const queryStart = value.indexOf("?")
  return queryStart === -1 ? value : value.slice(0, queryStart)
}
