import { readFile } from "node:fs/promises"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { embedBills, embedDocumentSections } from "../src/ingestion/embeddings/jobs.js"
import { embeddingRouteFor, type EmbeddingRouteProduct } from "../src/models/embedding-routing.js"
import { OpenRouterEmbeddingClient } from "../src/models/openrouter-embeddings.js"

interface CanaryManifest {
  limits: {
    maximumBills: number
    maximumDocumentSections: number
    maximumSupportingMaterialSections: number
  }
  rolloutId: string
  treatmentBillIds: string[]
  treatmentSectionIds: string[]
}

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function requireUnique(values: string[], label: string): void {
  if (values.length !== new Set(values).size) {
    throw new Error(`${label} must not contain duplicate identifiers`)
  }
}

const manifestPath = argument("--manifest", "evals/embedding-canary.json")
if (manifestPath === undefined) {
  throw new Error("Missing --manifest")
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CanaryManifest
requireUnique(manifest.treatmentBillIds, "treatmentBillIds")
requireUnique(manifest.treatmentSectionIds, "treatmentSectionIds")
if (
  manifest.limits.maximumSupportingMaterialSections !== 0 ||
  manifest.treatmentBillIds.length > manifest.limits.maximumBills ||
  manifest.treatmentSectionIds.length > manifest.limits.maximumDocumentSections
) {
  throw new Error("Canary manifest exceeds its provider-call safety limits")
}
if (manifest.treatmentBillIds.length === 0 && manifest.treatmentSectionIds.length === 0) {
  throw new Error("Canary requires at least one explicit treatment identifier")
}

const config = loadConfig()
if (config.model.apiKey === undefined) {
  throw new Error("OPENROUTER_API_KEY is required")
}
const { database, pool } = createDatabase({ ...config.database, maxConnections: 1 })
let promptTokens = 0
const createClient = (product: EmbeddingRouteProduct) => {
  const provider = new OpenRouterEmbeddingClient({
    apiKey: config.model.apiKey,
    baseUrl: new URL(config.model.baseUrl),
    route: embeddingRouteFor(product)
  })
  return {
    client: {
      embed: async (input: string[], inputType?: "document" | "query") => {
        const result = await provider.embed(input, inputType)
        promptTokens += result.promptTokens ?? result.totalTokens ?? 0
        return result
      }
    },
    provider
  }
}
const bill = createClient("bill")
const section = createClient("document-section")

try {
  let embeddedBills = 0
  let embeddedDocumentSections = 0
  for (const billId of manifest.treatmentBillIds) {
    const result = await embedBills(database, bill.client, {
      billId,
      limit: 1,
      rolloutId: manifest.rolloutId,
      scanLimit: 1
    })
    if (result.scanned !== 1) {
      throw new Error(`Treatment bill was not found: ${billId}`)
    }
    embeddedBills += result.embedded
  }
  for (const sectionId of manifest.treatmentSectionIds) {
    const result = await embedDocumentSections(database, section.client, {
      limit: 1,
      rolloutId: manifest.rolloutId,
      scanLimit: 1,
      sectionId
    })
    if (result.scanned !== 1) {
      throw new Error(`Treatment document section was not found: ${sectionId}`)
    }
    embeddedDocumentSections += result.embedded
  }
  process.stdout.write(
    `${JSON.stringify({
      embeddedBills,
      embeddedDocumentSections,
      promptTokens,
      models: {
        bills: embeddingRouteFor("bill").model,
        documentSections: embeddingRouteFor("document-section").model
      },
      providerMetrics: { bills: bill.provider.metrics, documentSections: section.provider.metrics },
      rolloutId: manifest.rolloutId,
      supportingMaterialSections: 0
    })}\n`
  )
} finally {
  await pool.end()
}
