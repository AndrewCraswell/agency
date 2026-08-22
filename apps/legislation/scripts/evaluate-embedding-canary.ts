import { readFile, writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { rankingMetrics, type RelevanceJudgment } from "../src/evaluation/embedding.js"

type SearchMode = "hybrid" | "lexical" | "semantic" | "semantic-rerank"
type SearchTool = "search_bill_text" | "search_bills"

interface CanaryQuery {
  billId?: string
  cohort?: "control" | "treatment"
  expectedIds?: string[]
  id: string
  judgments?: RelevanceJudgment[]
  jurisdictionIds?: string[]
  query: string
  queryClass?: "broad-topic" | "known-item" | "passage-paraphrase"
  sessionIds?: string[]
  tool: SearchTool
}

interface CanaryManifest {
  queries: CanaryQuery[]
  rolloutId: string
}

interface SearchItem {
  id?: string
  sectionId?: string
  snippet?: string
  sourceUrl?: string
  summary?: null | string
  title?: string
}

interface SearchOutput {
  items?: SearchItem[]
}

interface McpStructuredOutput {
  data?: SearchOutput
}

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function resultId(tool: SearchTool, item: SearchItem): string | undefined {
  return tool === "search_bills" ? item.id : item.sectionId
}

function judgmentsFor(query: CanaryQuery): RelevanceJudgment[] {
  if (query.judgments !== undefined) {
    return query.judgments
  }
  if (query.cohort === undefined || query.expectedIds === undefined) {
    throw new Error(`Query ${query.id} requires judgments or a cohort with expectedIds`)
  }
  const cohort = query.cohort
  return query.expectedIds.map((id) => ({ cohort, id, relevance: 1 }))
}

const RERANK_MODEL = "cohere/rerank-v3.5"

async function rerank(query: string, items: SearchItem[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (apiKey === undefined) {
    throw new Error("OPENROUTER_API_KEY is required for semantic-rerank mode")
  }
  const documents = items.map((item) =>
    [item.title, item.summary, item.snippet]
      .filter((value): value is string => value !== null && value !== undefined)
      .join("\n")
  )
  const baseUrl = (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "")
  const response = await fetch(`${baseUrl}/rerank`, {
    body: JSON.stringify({
      documents,
      model: RERANK_MODEL,
      provider: { allow_fallbacks: false, data_collection: "deny" },
      query,
      top_n: documents.length
    }),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    throw new Error(`OpenRouter rerank failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`)
  }
  const result = (await response.json()) as {
    results: { index: number; relevance_score: number }[]
    usage?: { search_units?: number; total_tokens?: number }
  }
  return {
    items: result.results.map((entry) => items[entry.index]).filter((item): item is SearchItem => item !== undefined),
    searchUnits: result.usage?.search_units ?? 0,
    tokens: result.usage?.total_tokens ?? 0
  }
}

const mode = argument("--mode", "lexical") as SearchMode
if (!(["hybrid", "lexical", "semantic", "semantic-rerank"] as const).includes(mode)) {
  throw new Error("--mode must be lexical, semantic, semantic-rerank, or hybrid")
}
const manifestPath = argument("--manifest", new URL("../evals/embedding-canary.json", import.meta.url).pathname)
const outputPath = argument("--output")
const endpoint = argument("--endpoint", "http://127.0.0.1:3100/mcp")
if (manifestPath === undefined || endpoint === undefined) {
  throw new Error("Missing manifest or endpoint")
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CanaryManifest
const transport = new StreamableHTTPClientTransport(new URL(endpoint))
const client = new Client({ name: "embedding-canary-evaluator", version: "1.0.0" })
await client.connect(transport)

try {
  const queries = []
  let rerankSearchUnits = 0
  let rerankTokens = 0
  for (const query of manifest.queries) {
    const judgments = judgmentsFor(query)
    const startedAt = performance.now()
    const response = await client.callTool({
      arguments: {
        ...(query.billId === undefined ? {} : { billId: query.billId }),
        ...(query.jurisdictionIds === undefined ? {} : { jurisdictionIds: query.jurisdictionIds }),
        limit: 25,
        mode: mode === "semantic-rerank" ? "semantic" : mode,
        query: query.query,
        ...(query.sessionIds === undefined ? {} : { sessionIds: query.sessionIds })
      },
      name: query.tool
    })
    const elapsedMs = performance.now() - startedAt
    const structured = response.structuredContent as McpStructuredOutput | undefined
    const output = structured?.data
    let items = output?.items ?? []
    if (mode === "semantic-rerank" && response.isError !== true && items.length > 0) {
      const result = await rerank(query.query, items)
      items = result.items
      rerankSearchUnits += result.searchUnits
      rerankTokens += result.tokens
    }
    const ids = items.flatMap((item) => {
      const id = resultId(query.tool, item)
      return id === undefined ? [] : [id]
    })
    const treatmentJudgments = judgments.filter((judgment) => judgment.cohort === "treatment")
    const controlJudgments = judgments.filter((judgment) => judgment.cohort === "control")
    queries.push({
      elapsedMs,
      error: response.isError === true,
      expectedIds: judgments.map((judgment) => judgment.id),
      judgments,
      metrics: {
        all: rankingMetrics(ids, judgments),
        control: controlJudgments.length === 0 ? undefined : rankingMetrics(ids, controlJudgments),
        treatment: treatmentJudgments.length === 0 ? undefined : rankingMetrics(ids, treatmentJudgments)
      },
      id: query.id,
      missingSourceAttribution: items.filter((item) => item.sourceUrl === undefined).length,
      queryClass: query.queryClass,
      resultIds: ids,
      tool: query.tool
    })
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  const metrics = (cohort: "all" | "control" | "treatment") => {
    const items = queries.filter((query) => query.metrics[cohort] !== undefined)
    const ranking = items.map((query) => query.metrics[cohort]!)
    return {
      errors: items.filter((query) => query.error).length,
      meanLatencyMs: mean(items.map((query) => query.elapsedMs)),
      meanReciprocalRank: mean(ranking.map((query) => query.meanReciprocalRank)),
      missingSourceAttribution: items.reduce((sum, query) => sum + query.missingSourceAttribution, 0),
      ndcgAt10: mean(ranking.map((query) => query.ndcgAt10)),
      precisionAt10: mean(ranking.map((query) => query.precisionAt10)),
      queries: items.length,
      capacityAdjustedRecallAt5: mean(ranking.map((query) => query.capacityAdjustedRecallAt5)),
      capacityAdjustedRecallAt10: mean(ranking.map((query) => query.capacityAdjustedRecallAt10)),
      capacityAdjustedRecallAt25: mean(ranking.map((query) => query.capacityAdjustedRecallAt25)),
      recallAt5: mean(ranking.map((query) => query.recallAt5)),
      recallAt10: mean(ranking.map((query) => query.recallAt10)),
      recallAt25: mean(ranking.map((query) => query.recallAt25))
    }
  }
  const report = {
    endpoint,
    evaluatedAt: new Date().toISOString(),
    metrics: {
      all: metrics("all"),
      control: metrics("control"),
      treatment: metrics("treatment")
    },
    mode,
    queries,
    rerank:
      mode === "semantic-rerank"
        ? { model: RERANK_MODEL, searchUnits: rerankSearchUnits, totalTokens: rerankTokens }
        : undefined,
    rolloutId: manifest.rolloutId
  }
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (outputPath === undefined) {
    process.stdout.write(serialized)
  } else {
    await writeFile(outputPath, serialized, "utf8")
    process.stdout.write(`${JSON.stringify(report.metrics)}\n`)
  }
} finally {
  await transport.close()
}
