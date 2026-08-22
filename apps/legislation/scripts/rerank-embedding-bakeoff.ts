import { readFile, writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"
import { z } from "zod"
import { rankingMetrics } from "../src/evaluation/embedding.js"

type RecordKind = "amendment" | "bill" | "document-section" | "material-section"

interface CandidateRecord {
  contextualInput: string
  currentInput: string
  id: string
  kind: RecordKind
}

interface BakeoffQuery {
  id: string
  kind: RecordKind
  query: string
  relevantIds: string[]
}

interface Manifest {
  queries: BakeoffQuery[]
  records: CandidateRecord[]
}

interface ConfigurationResult {
  configuration: { input: "contextualInput" | "currentInput"; model: string }
  metrics: Record<string, unknown>
  queries: { id: string; kind: RecordKind; resultIds: string[] }[]
}

const responseSchema = z.object({
  results: z.array(z.object({ index: z.number().int().nonnegative(), relevance_score: z.number() })),
  usage: z
    .object({
      cost: z.number().nonnegative().optional(),
      search_units: z.number().nonnegative().optional(),
      total_tokens: z.number().nonnegative().optional()
    })
    .optional()
})

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

const manifestPath = argument("--manifest", "evals/embedding-model-bakeoff.json")
const resultsPath = argument("--results", "evals/embedding-model-bakeoff-results.json")
const outputPath = argument("--output", "evals/embedding-model-bakeoff-rerank.json")
const model = argument("--model", "cohere/rerank-v3.5")
const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required")
}
const baseUrl = (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "")
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest
const source = JSON.parse(await readFile(resultsPath, "utf8")) as { results: ConfigurationResult[] }
const records = new Map(manifest.records.map((record) => [record.id, record]))
const queries = new Map(manifest.queries.map((query) => [query.id, query]))
const results = []

for (const configurationResult of source.results) {
  const startedAt = performance.now()
  let cost = 0
  let requests = 0
  let searchUnits = 0
  let tokens = 0
  const rerankedQueries = []
  for (const queryResult of configurationResult.queries) {
    const query = queries.get(queryResult.id)
    if (!query) {
      throw new Error(`Missing query ${queryResult.id}`)
    }
    const candidates = queryResult.resultIds.slice(0, 25).map((id) => {
      const record = records.get(id)
      if (!record) {
        throw new Error(`Missing record ${id}`)
      }
      return { id, text: record[configurationResult.configuration.input].slice(0, 4_000) }
    })
    const response = await fetch(`${baseUrl}/rerank`, {
      body: JSON.stringify({
        documents: candidates.map(({ text }) => text),
        model,
        provider: { allow_fallbacks: false, data_collection: "deny" },
        query: query.query,
        top_n: candidates.length
      }),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(60_000)
    })
    if (!response.ok) {
      throw new Error(`${model} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
    }
    const parsed = responseSchema.parse(await response.json())
    const resultIds = parsed.results.flatMap(({ index }) => {
      const candidate = candidates[index]
      return candidate ? [candidate.id] : []
    })
    requests += 1
    cost += parsed.usage?.cost ?? 0
    searchUnits += parsed.usage?.search_units ?? 0
    tokens += parsed.usage?.total_tokens ?? 0
    rerankedQueries.push({
      id: query.id,
      kind: query.kind,
      metrics: rankingMetrics(
        resultIds,
        query.relevantIds.map((id) => ({ cohort: "treatment" as const, id, relevance: 3 as const }))
      ),
      resultIds
    })
    process.stdout.write(
      `${configurationResult.configuration.model} ${configurationResult.configuration.input} ${rerankedQueries.length}/${configurationResult.queries.length}\r`
    )
  }
  const metrics = Object.fromEntries(
    (["bill", "document-section", "amendment", "material-section"] as const).map((kind) => {
      const selected = rerankedQueries.filter((query) => query.kind === kind)
      return [
        kind,
        {
          meanReciprocalRank: mean(selected.map((query) => query.metrics.meanReciprocalRank)),
          ndcgAt10: mean(selected.map((query) => query.metrics.ndcgAt10)),
          recallAt10: mean(selected.map((query) => query.metrics.recallAt10)),
          recallAt25: mean(selected.map((query) => query.metrics.recallAt25))
        }
      ]
    })
  )
  results.push({
    baselineMetrics: configurationResult.metrics,
    configuration: configurationResult.configuration,
    elapsedMs: performance.now() - startedAt,
    metrics,
    queries: rerankedQueries,
    usage: { cost, requests, searchUnits, tokens }
  })
  await writeFile(outputPath, `${JSON.stringify({ evaluatedAt: new Date().toISOString(), model, results }, null, 2)}\n`)
  process.stdout.write(
    `\n${configurationResult.configuration.model} (${configurationResult.configuration.input}) complete\n`
  )
}
