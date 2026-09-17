import { configuredRegulatoryEmbeddingRoute } from "@repo/legislation-core/embeddings/embedding-routing"
import { OpenRouterEmbeddingClient } from "@repo/legislation-core/embeddings/openrouter-embeddings"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { initializeLegalEmbeddingShards, runLegalEmbeddingShardJob } from "../../ingestion/regulations/vector-jobs.js"
import { completeLegalEmbeddingGeneration } from "../../ingestion/regulations/vector-storage.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const dispatchSchema = z.strictObject({ generationId: hash })
const shardSchema = z.strictObject({ generationId: hash, shardIndex: z.int().min(0).max(15) })

type SearchPool = pg.Pool

function searchDatabaseUrl() {
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const source = new URL(env.DATABASE_URL)
  const target = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (
    ![source.protocol, target.protocol].every((protocol) => ["postgres:", "postgresql:"].includes(protocol)) ||
    source.pathname === "/legislation_passage_search" ||
    target.pathname !== "/legislation_passage_search" ||
    source.host === target.host
  ) {
    throw new Error("Regulatory embeddings require the separate PostgreSQL search host")
  }
  return target
}

function configuredRoute() {
  const route = configuredRegulatoryEmbeddingRoute(process.env.REGULATORY_EMBEDDING_MODEL)
  invariant(route, "REGULATORY_EMBEDDING_MODEL is required for regulatory embeddings")
  return route
}

async function requireMatchingGeneration(pool: SearchPool, generationId: string, model: string) {
  const currentDatabase = (await pool.query<{ name: string }>("SELECT current_database() AS name")).rows[0]?.name
  invariant(currentDatabase === "legislation_passage_search", "legal_embedding_wrong_target")
  const generation = (
    await pool.query<{ model: string; state: string }>(
      "SELECT model,state FROM legislation.legal_embedding_generations WHERE id=$1",
      [generationId]
    )
  ).rows[0]
  invariant(generation, "legal_embedding_generation_missing")
  invariant(generation.model === model, "legal_embedding_configured_model_mismatch")
  invariant(["pending", "embedded"].includes(generation.state), "legal_embedding_generation_not_runnable")
  return generation
}

export interface RegulatoryEmbeddingDispatchDependencies {
  dispatch: (input: { generationId: string; shardIndex: number; idempotencyKey: string }) => Promise<string>
  openPool: () => SearchPool
}

/** Initializes and fans out one explicitly registered generation. No schedule invokes this task. */
export async function runRegulatoryEmbeddingDispatch(
  value: unknown,
  dependencies: RegulatoryEmbeddingDispatchDependencies = {
    dispatch: async ({ generationId, shardIndex, idempotencyKey }) => {
      const handle = await tasks.trigger(
        "regulatory-embedding-shard",
        { generationId, shardIndex },
        {
          idempotencyKey: await idempotencyKeys.create(idempotencyKey, { scope: "global" }),
          idempotencyKeyTTL: "7d"
        }
      )
      return handle.id
    },
    openPool: () => new pg.Pool({ connectionString: searchDatabaseUrl().href, max: 2, connectionTimeoutMillis: 10_000 })
  }
) {
  const input = dispatchSchema.parse(value)
  const route = configuredRoute()
  // Validate configuration before allocating a connection or submitting any child work.
  searchDatabaseUrl()
  const pool = dependencies.openPool()
  try {
    const generation = await requireMatchingGeneration(pool, input.generationId, route.model)
    if (generation.state === "embedded") {
      return { generationId: input.generationId, shardCount: 16 as const, runIds: [], reused: true }
    }
    await initializeLegalEmbeddingShards(pool, input.generationId)
    const runIds: string[] = []
    // Sixteen serial SDK submissions bound memory and outstanding network calls. Global keys make parent retries safe.
    for (let shardIndex = 0; shardIndex < 16; shardIndex += 1) {
      runIds.push(
        await dependencies.dispatch({
          generationId: input.generationId,
          shardIndex,
          idempotencyKey: `regulatory-embedding:${input.generationId}:shard:${shardIndex}`
        })
      )
    }
    return { generationId: input.generationId, shardCount: 16 as const, runIds, reused: false }
  } finally {
    await pool.end()
  }
}

export const regulatoryEmbeddingDispatch = task({
  id: "regulatory-embedding-dispatch",
  maxDuration: 300,
  queue: { name: "regulatory-embedding-dispatch", concurrencyLimit: 1 },
  retry: { maxAttempts: 4, minTimeoutInMs: 10_000, maxTimeoutInMs: 60_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryEmbeddingDispatch(payload)
})

export interface RegulatoryEmbeddingShardDependencies {
  continueShard: (input: { generationId: string; shardIndex: number; idempotencyKey: string }) => Promise<string>
  openPool: () => SearchPool
}

/** Runs one bounded provider page, checkpoints it, and schedules one durable continuation when work remains. */
export async function runRegulatoryEmbeddingShardTask(
  value: unknown,
  workflowRunId: string,
  dependencies: RegulatoryEmbeddingShardDependencies = {
    continueShard: async ({ generationId, shardIndex, idempotencyKey }) => {
      const handle = await tasks.trigger("regulatory-embedding-shard", { generationId, shardIndex }, { idempotencyKey })
      return handle.id
    },
    openPool: () => new pg.Pool({ connectionString: searchDatabaseUrl().href, max: 1, connectionTimeoutMillis: 10_000 })
  }
) {
  const input = shardSchema.parse(value)
  const runId = z.string().trim().min(1).max(256).parse(workflowRunId)
  const route = configuredRoute()
  const config = loadConfig()
  invariant(config.model.apiKey, "OPENROUTER_API_KEY is required for regulatory embeddings")
  searchDatabaseUrl()
  const pool = dependencies.openPool()
  try {
    const generation = await requireMatchingGeneration(pool, input.generationId, route.model)
    if (generation.state === "embedded") {
      return { ...input, state: "complete" as const, continuationRunId: null, reusedCheckpoint: true }
    }
    const client = new OpenRouterEmbeddingClient({
      apiKey: config.model.apiKey,
      baseUrl: new URL(config.model.baseUrl),
      maximumAttempts: config.ingestion.maxAttempts,
      route,
      timeoutMs: config.ingestion.requestTimeoutMs
    })
    const result = await runLegalEmbeddingShardJob(pool, input, client)
    if (result.state === "pending") {
      const continuationRunId = await dependencies.continueShard({
        ...input,
        idempotencyKey: `regulatory-embedding-shard:continue:${runId}`
      })
      return { ...result, continuationRunId }
    }
    const completedShards = (
      await pool.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM legislation.legal_embedding_shards
        WHERE generation_id=$1 AND shard_count=16 AND state='complete'`,
        [input.generationId]
      )
    ).rows[0]?.count
    if (completedShards === 16) {
      await completeLegalEmbeddingGeneration(pool, input.generationId)
    }
    return { ...result, continuationRunId: null }
  } finally {
    await pool.end()
  }
}

export const regulatoryEmbeddingShard = task({
  id: "regulatory-embedding-shard",
  maxDuration: 180,
  queue: { name: "regulatory-embedding-shard", concurrencyLimit: 4 },
  // The database lease is five minutes, so a killed run must not retry before the claim expires.
  retry: { maxAttempts: 4, minTimeoutInMs: 305_000, maxTimeoutInMs: 420_000, factor: 1.25, randomize: true },
  run: async (payload: unknown, { ctx }) => runRegulatoryEmbeddingShardTask(payload, ctx.run.id)
})
