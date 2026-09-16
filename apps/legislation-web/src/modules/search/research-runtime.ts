import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { loadConfig, type LegislationConfig } from "../configuration/config.js"
import { LegislationQueryService } from "../legislation/query-service.js"
import { OpenRouterRetrievalClient } from "./models/openrouter-retrieval.js"
import { createRankedPassageSearch } from "./ranked-passage-search.js"

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
    async run<Result>(operation: (service: LegislationQueryService) => Promise<Result>) {
      return await withReadOnlyDatabase(canonical.pool, config.database.apiStatementTimeoutMs, async (database) => {
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
