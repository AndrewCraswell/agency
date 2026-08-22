import { readFile, writeFile } from "node:fs/promises"

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

interface ConfigurationResult {
  configuration: { input: string; model: string }
  queries: { id: string; resultIds: string[] }[]
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback)
}

const manifestPath = argument("--manifest", "evals/embedding-model-bakeoff.json")
const resultsPath = argument("--results", "evals/embedding-model-bakeoff-results.json")
const outputPath = argument("--output", "evals/embedding-judgment-pool.json")
const top = Number.parseInt(argument("--top", "10"), 10)
if (!Number.isSafeInteger(top) || top < 1 || top > 25) {
  throw new Error("--top must be an integer from 1 through 25")
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest
const results = JSON.parse(await readFile(resultsPath, "utf8")) as { results: ConfigurationResult[] }
const records = new Map(manifest.records.map((record) => [record.id, record]))
const configurations = results.results.map(({ configuration }) => `${configuration.model}:${configuration.input}`)

const queries = manifest.queries.map((query) => {
  const pooledIds = new Set<string>(query.relevantIds)
  const rankings = new Map<string, Map<string, number>>()
  for (const result of results.results) {
    const key = `${result.configuration.model}:${result.configuration.input}`
    const ranked = result.queries.find(({ id }) => id === query.id)?.resultIds.slice(0, top) ?? []
    rankings.set(key, new Map(ranked.map((id, index) => [id, index + 1])))
    for (const id of ranked) {
      pooledIds.add(id)
    }
  }
  return {
    candidates: [...pooledIds].map((id) => {
      const record = records.get(id)
      if (!record) {
        throw new Error(`Query ${query.id} references missing record ${id}`)
      }
      return {
        contextualInput: record.contextualInput.slice(0, 4_000),
        currentInput: record.currentInput.slice(0, 4_000),
        id,
        judgment: query.relevantIds.includes(id) ? 3 : null,
        notes: "",
        ranks: Object.fromEntries(configurations.map((key) => [key, rankings.get(key)?.get(id) ?? null])),
        strata: record.strata
      }
    }),
    id: query.id,
    kind: query.kind,
    query: query.query
  }
})

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      configurations,
      instructions: {
        judgment: "Set to 3 for directly relevant, 2 for useful, 1 for marginal, or 0 for not relevant.",
        notes: "Explain ambiguous calls and missing relevant candidates. Do not judge from rank alone."
      },
      manifest: { records: manifest.records.length, seed: manifest.seed, version: manifest.version },
      queries
    },
    null,
    2
  )}\n`,
  "utf8"
)

process.stdout.write(
  `${JSON.stringify({ candidates: queries.reduce((sum, query) => sum + query.candidates.length, 0), queries: queries.length })}\n`
)
