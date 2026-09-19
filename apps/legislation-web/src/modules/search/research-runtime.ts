import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { OpenRouterRetrievalClient } from "../../services/openrouter/openrouter-retrieval"
import { loadConfig, type LegislationConfig } from "../configuration/config"
import { LegislationQueryService } from "../legislation/query-service"
import { createRankedPassageSearch } from "./ranked-passage-search"

declare global {
  var __legislationResearchRuntime: ReturnType<typeof createResearchRuntime> | undefined
}

function createResearchRuntime(config: LegislationConfig = loadConfig()) {
  const canonical = createDatabase({ ...config.database, maxConnections: Math.min(config.database.maxConnections, 2) })
  const search = config.passageSearch.enabled
    ? createDatabase({
        ...config.passageSearch.database,
        maxConnections: Math.min(config.passageSearch.database.maxConnections, 2)
      })
    : undefined
  const retrieval =
    config.model.apiKey === undefined
      ? undefined
      : new OpenRouterRetrievalClient({
          apiKey: config.model.apiKey,
          baseUrl: new URL(config.model.baseUrl)
        })

  return {
    async run<Result>(operation: (service: LegislationQueryService) => Promise<Result>, signal?: AbortSignal) {
      const deadline = AbortSignal.timeout(30000)
      const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
      return await withReadOnlyDatabase(
        canonical.pool,
        config.database.apiStatementTimeoutMs,
        async (database) => {
          const passageConfig = config.passageSearch
          const ranked =
            search && passageConfig.enabled
              ? createRankedPassageSearch({
                  canonicalDatabase: database,
                  searchDatabase: search.database,
                  generation: passageConfig.rankingGeneration,
                  executeRankedQuery: (query) =>
                    withReadOnlyDatabase(
                      search.pool,
                      passageConfig.database.apiStatementTimeoutMs,
                      async (searchDatabase) => (await searchDatabase.execute(query)).rows
                    )
                })
              : undefined
          return await operation(new LegislationQueryService(database, retrieval, ranked))
        },
        requestSignal
      ).catch((error: unknown) => {
        if (deadline.aborted && !signal?.aborted) {
          throw new LegislationError("dependency_unavailable", "The research query timed out. Narrow the selection.", {
            cause: error,
            details: { reason: "timeout", retryable: true }
          })
        }
        throw error
      })
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
