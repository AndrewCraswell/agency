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
  strata: string[]
}

interface BakeoffQuery {
  candidateIds?: string[]
  id: string
  kind: RecordKind
  query: string
  relevantIds: string[]
}

interface Manifest {
  queries: BakeoffQuery[]
  records: CandidateRecord[]
  seed: string
  version: number
}

interface Configuration {
  input: "contextualInput" | "currentInput"
  inputTypes: boolean
  model: string
  pricePerToken: number
}

interface BakeoffResult {
  configuration: Configuration
  costUsd: number
  dimensions: number
  elapsedMs: number
  metrics: Record<string, unknown>
  queries: unknown[]
  requests: number
  tokens: number
}

const configurations: Configuration[] = [
  { input: "currentInput", inputTypes: false, model: "openai/text-embedding-3-small", pricePerToken: 0.000_000_02 },
  { input: "contextualInput", inputTypes: false, model: "openai/text-embedding-3-small", pricePerToken: 0.000_000_02 },
  { input: "contextualInput", inputTypes: false, model: "openai/text-embedding-3-large", pricePerToken: 0.000_000_13 },
  { input: "currentInput", inputTypes: false, model: "openai/text-embedding-3-large", pricePerToken: 0.000_000_13 },
  { input: "contextualInput", inputTypes: true, model: "voyageai/voyage-4", pricePerToken: 0.000_000_06 },
  { input: "currentInput", inputTypes: true, model: "voyageai/voyage-4", pricePerToken: 0.000_000_06 },
  { input: "contextualInput", inputTypes: true, model: "voyageai/voyage-4-large", pricePerToken: 0.000_000_12 },
  { input: "currentInput", inputTypes: true, model: "voyageai/voyage-4-large", pricePerToken: 0.000_000_12 },
  { input: "contextualInput", inputTypes: true, model: "qwen/qwen3-embedding-8b", pricePerToken: 0.000_000_01 },
  { input: "currentInput", inputTypes: true, model: "qwen/qwen3-embedding-8b", pricePerToken: 0.000_000_01 },
  { input: "contextualInput", inputTypes: true, model: "google/gemini-embedding-2", pricePerToken: 0.000_000_2 },
  { input: "currentInput", inputTypes: true, model: "google/gemini-embedding-2", pricePerToken: 0.000_000_2 }
]

const responseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().int().nonnegative() })),
  usage: z
    .object({ prompt_tokens: z.number().nonnegative().optional(), total_tokens: z.number().nonnegative().optional() })
    .optional()
})

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

function cosine(left: number[], right: number[]): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

async function embed(
  apiKey: string,
  baseUrl: string,
  configuration: Configuration,
  input: string[],
  inputType: "document" | "query"
): Promise<{ dimensions: number; tokens: number; vectors: number[][] }> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/embeddings`, {
      body: JSON.stringify({
        encoding_format: "float",
        input,
        ...(configuration.inputTypes ? { input_type: inputType } : {}),
        model: configuration.model,
        provider: { allow_fallbacks: false, data_collection: "deny" }
      }),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(60_000)
    })
    if (response.ok) {
      const parsed = responseSchema.parse(await response.json())
      const vectors = parsed.data.toSorted((left, right) => left.index - right.index).map((item) => item.embedding)
      const dimensions = vectors[0]?.length ?? 0
      if (
        vectors.length !== input.length ||
        dimensions === 0 ||
        vectors.some((vector) => vector.length !== dimensions)
      ) {
        throw new Error(`${configuration.model} returned an invalid embedding batch`)
      }
      return { dimensions, tokens: parsed.usage?.total_tokens ?? parsed.usage?.prompt_tokens ?? 0, vectors }
    }
    const detail = (await response.text()).replaceAll(/\s+/g, " ").slice(0, 500)
    if ((response.status !== 429 && response.status < 500) || attempt === 3) {
      throw new Error(`${configuration.model} failed with HTTP ${response.status}: ${detail}`)
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
  }
  throw new Error(`${configuration.model} exhausted retries`)
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

const manifestPath = argument("--manifest", "evals/embedding-model-bakeoff.json")
const outputPath = argument("--output", "evals/embedding-model-bakeoff-results.json")
const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required")
}
const baseUrl = (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "")
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest
const prior = await readFile(outputPath, "utf8")
  .then((value) => JSON.parse(value) as { results?: BakeoffResult[] })
  .catch(() => ({ results: [] as BakeoffResult[] }))
const results = prior.results ?? []

for (const configuration of configurations) {
  if (
    results.some(
      (result) =>
        result.configuration.model === configuration.model && result.configuration.input === configuration.input
    )
  ) {
    process.stdout.write(`${configuration.model} (${configuration.input}) already complete\n`)
    continue
  }
  const startedAt = performance.now()
  const queryEmbedding = await embed(
    apiKey,
    baseUrl,
    configuration,
    manifest.queries.map((query) => query.query),
    "query"
  )
  let tokens = queryEmbedding.tokens
  let requests = 1
  let dimensions = queryEmbedding.dimensions
  const rankings = new Map<string, { id: string; score: number }[]>(manifest.queries.map((query) => [query.id, []]))
  const candidateSets = new Map(
    manifest.queries.map((query) => [query.id, query.candidateIds ? new Set(query.candidateIds) : undefined])
  )

  const batchSize = configuration.model === "voyageai/voyage-4-large" ? 32 : 64
  const parallelBatches = 4
  for (let offset = 0; offset < manifest.records.length; offset += batchSize * parallelBatches) {
    const batches = Array.from({ length: parallelBatches }, (_, index) =>
      manifest.records.slice(offset + index * batchSize, offset + (index + 1) * batchSize)
    ).filter((batch) => batch.length > 0)
    const embeddedBatches = await Promise.all(
      batches.map(async (batch) => ({
        batch,
        result: await embed(
          apiKey,
          baseUrl,
          configuration,
          batch.map((record) => record[configuration.input].slice(0, 24_000)),
          "document"
        )
      }))
    )
    for (const { batch, result } of embeddedBatches) {
      dimensions = result.dimensions
      tokens += result.tokens
      requests += 1
      for (let recordIndex = 0; recordIndex < batch.length; recordIndex += 1) {
        const record = batch[recordIndex]
        const vector = result.vectors[recordIndex]
        if (!record || !vector) {
          continue
        }
        for (let queryIndex = 0; queryIndex < manifest.queries.length; queryIndex += 1) {
          const query = manifest.queries[queryIndex]
          const queryVector = queryEmbedding.vectors[queryIndex]
          if (
            !query ||
            !queryVector ||
            query.kind !== record.kind ||
            candidateSets.get(query.id)?.has(record.id) === false
          ) {
            continue
          }
          const ranking = rankings.get(query.id)
          if (!ranking) {
            continue
          }
          ranking.push({ id: record.id, score: cosine(queryVector, vector) })
          ranking.sort((left, right) => right.score - left.score)
          if (ranking.length > 25) {
            ranking.length = 25
          }
        }
      }
    }
    process.stdout.write(
      `${configuration.model} ${Math.min(offset + batchSize * parallelBatches, manifest.records.length)}/${manifest.records.length}\r`
    )
  }

  const queryResults = manifest.queries.map((query) => {
    const ids = (rankings.get(query.id) ?? []).map((item) => item.id)
    const metrics = rankingMetrics(
      ids,
      query.relevantIds.map((id) => ({ cohort: "treatment", id, relevance: 3 }))
    )
    return { id: query.id, kind: query.kind, metrics, resultIds: ids }
  })
  const byKind = Object.fromEntries(
    (["bill", "document-section", "amendment", "material-section"] as const).map((kind) => {
      const selected = queryResults.filter((query) => query.kind === kind)
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
    configuration,
    costUsd: tokens * configuration.pricePerToken,
    dimensions,
    elapsedMs: performance.now() - startedAt,
    metrics: byKind,
    queries: queryResults,
    requests,
    tokens
  })
  await writeFile(
    outputPath,
    `${JSON.stringify({ evaluatedAt: new Date().toISOString(), manifest: { records: manifest.records.length, seed: manifest.seed, version: manifest.version }, results }, null, 2)}\n`,
    "utf8"
  )
  process.stdout.write(`\n${configuration.model} (${configuration.input}) complete\n`)
}
