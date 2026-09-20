import { createDatabase } from "@repo/legislation-core/database/database"
import { createReadOnlyDatabase } from "@repo/legislation-core/database/read-only-database"
import { OpenRouterRetrievalClient } from "../../services/openrouter/openrouter-retrieval"
import {
  createDatabaseQueryObserver,
  recordDatabaseConnectionAcquired
} from "../../services/sentry/databaseQueryTelemetry"
import { loadConfig, type LegislationConfig } from "../configuration/config"
import { LegislationQueryService } from "../legislation/query-service"
import { createRankedPassageSearch } from "./ranked-passage-search"

declare global {
  var __legislationResearchRuntime: ReturnType<typeof createResearchRuntime> | undefined
}

function createResearchRuntime(config: LegislationConfig = loadConfig()) {
  const canonical = createDatabase(config.database, { waitForConnection: true })
  const search = config.passageSearch.enabled
    ? createDatabase(config.passageSearch.database, { waitForConnection: true })
    : undefined
  const observeDatabaseQuery = createDatabaseQueryObserver({
    canonical: canonical.pool,
    passageSearch: search?.pool
  })

  return {
    async run<Result>(operation: (service: LegislationQueryService) => Promise<Result>, signal?: AbortSignal) {
      signal?.throwIfAborted()
      const database = createReadOnlyDatabase(
        canonical.pool,
        config.database.apiStatementTimeoutMs,
        signal,
        (observation) => recordDatabaseConnectionAcquired("canonical", observation)
      )
      const retrieval =
        config.model.apiKey === undefined
          ? undefined
          : new OpenRouterRetrievalClient({
              apiKey: config.model.apiKey,
              baseUrl: new URL(config.model.baseUrl),
              embeddingTimeoutMs: config.model.embeddingTimeoutMs,
              generationTimeoutMs: config.model.generationTimeoutMs,
              rerankTimeoutMs: config.model.rerankTimeoutMs,
              signal
            })
      const passageConfig = config.passageSearch
      const searchDatabase =
        search && passageConfig.enabled
          ? createReadOnlyDatabase(search.pool, passageConfig.database.apiStatementTimeoutMs, signal, (observation) =>
              recordDatabaseConnectionAcquired("passage_search", observation)
            )
          : undefined
      const ranked =
        searchDatabase && passageConfig.enabled
          ? createRankedPassageSearch({
              canonicalDatabase: database,
              searchDatabase,
              generation: passageConfig.rankingGeneration,
              executeRankedQuery: async (query) => (await searchDatabase.execute(query)).rows
            })
          : undefined
      try {
        const result = await operation(new LegislationQueryService(database, retrieval, ranked, observeDatabaseQuery))
        signal?.throwIfAborted()
        return result
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    },
    async close() {
      await Promise.all([canonical.pool.end(), search?.pool.end()])
    }
  }
}

export function getResearchRuntime() {
  globalThis.__legislationResearchRuntime ??= createResearchRuntime()
  return globalThis.__legislationResearchRuntime
}
