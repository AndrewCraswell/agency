import { loadConfig, type LegislationConfig } from "../../config/config.js"
import { createDatabase, type LegislationDatabase } from "../../db/database.js"
import { LegislationQueryService } from "../../legislation/query-service.js"
import { OpenRouterRetrievalClient } from "../../models/openrouter-retrieval.js"
import { createNextDatabaseReadiness, type NextDatabaseReadiness } from "./readiness.js"

export interface NextLegislationApplication {
  readonly config: LegislationConfig
  readonly database: LegislationDatabase
  readonly queryService: LegislationQueryService
  readonly retrievalClient: OpenRouterRetrievalClient | undefined
  readonly readiness: NextDatabaseReadiness
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

  return {
    close: async () => await pool.end(),
    config,
    database,
    queryService: new LegislationQueryService(database, retrievalClient),
    retrievalClient,
    readiness: createNextDatabaseReadiness(pool)
  }
}

function createRetrievalClient(config: LegislationConfig): OpenRouterRetrievalClient | undefined {
  return config.model.apiKey === undefined
    ? undefined
    : new OpenRouterRetrievalClient({ apiKey: config.model.apiKey, baseUrl: new URL(config.model.baseUrl) })
}
