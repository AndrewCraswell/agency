import { createDatabase, type LegislationDatabase } from "@repo/legislation-core/database/database"
import { OpenRouterRetrievalClient } from "../../../services/openrouter/openrouter-retrieval.js"
import { loadConfig, type LegislationConfig } from "../../configuration/config.js"
import { createLegalBrowser } from "../../request-handling/api/legal-browse-read.js"
import { createLegalCodesReader } from "../../request-handling/api/legal-codes-read.js"
import { createLegalSearch } from "../../request-handling/api/legal-search-read.js"
import { createLegalTextReader } from "../../request-handling/api/legal-text-read.js"
import { createRankedPassageSearch } from "../../search/ranked-passage-search.js"
import { LegislationQueryService } from "../query-service.js"
import { createNextDatabaseReadiness, type NextDatabaseReadiness } from "./readiness.js"

export interface NextLegislationApplication {
  readonly config: LegislationConfig
  readonly database: LegislationDatabase
  readonly queryService: LegislationQueryService
  readonly retrievalClient: OpenRouterRetrievalClient | undefined
  readonly readiness: NextDatabaseReadiness
  readonly readLegalText: ReturnType<typeof createLegalTextReader>
  readonly listLegalCodes: ReturnType<typeof createLegalCodesReader>
  readonly legalBrowser: ReturnType<typeof createLegalBrowser>
  readonly searchLegal: ReturnType<typeof createLegalSearch>
  close(): Promise<void>
}

/**
 * Composes framework-independent dependencies for Next Route Handlers and
 * Server Components. It deliberately imports neither Next nor route code.
 */
export function createNextLegislationApplication(config: LegislationConfig = loadConfig()): NextLegislationApplication {
  // This pool exists only in the Next HTTP process. PostgreSQL cancels a slow
  // API statement at the server, so abandoned client requests cannot continue
  // consuming I/O during maintenance. Trigger and CLI pools remain unlimited.
  const { database, pool } = createDatabase(config.database, {
    statementTimeoutMs: config.database.apiStatementTimeoutMs
  })
  const retrievalClient = createRetrievalClient(config)
  const passageSearchDatabase =
    config.passageSearch.enabled === true
      ? createDatabase(config.passageSearch.database, {
          statementTimeoutMs: config.passageSearch.database.apiStatementTimeoutMs
        })
      : undefined
  const rankedPassageSearch =
    passageSearchDatabase === undefined || config.passageSearch.enabled === false
      ? undefined
      : createRankedPassageSearch({
          canonicalDatabase: database,
          generation: config.passageSearch.rankingGeneration,
          searchDatabase: passageSearchDatabase.database
        })

  return {
    close: async () => {
      await Promise.all([pool.end(), passageSearchDatabase?.pool.end()])
    },
    config,
    database,
    readLegalText: createLegalTextReader(pool, config.legalApi.allowedOrganizationIds),
    listLegalCodes: createLegalCodesReader(pool, config.legalApi.allowedOrganizationIds),
    legalBrowser: createLegalBrowser(pool, config.legalApi.allowedOrganizationIds),
    searchLegal: createLegalSearch(pool, passageSearchDatabase?.pool, config.legalApi.allowedOrganizationIds),
    queryService: new LegislationQueryService(database, retrievalClient, rankedPassageSearch),
    retrievalClient,
    readiness: createNextDatabaseReadiness(pool, passageSearchDatabase?.pool)
  }
}

function createRetrievalClient(config: LegislationConfig): OpenRouterRetrievalClient | undefined {
  return config.model.apiKey === undefined
    ? undefined
    : new OpenRouterRetrievalClient({ apiKey: config.model.apiKey, baseUrl: new URL(config.model.baseUrl) })
}
