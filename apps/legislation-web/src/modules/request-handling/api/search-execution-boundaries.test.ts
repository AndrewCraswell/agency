import { createServer } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { afterEach, describe, expect, it } from "vitest"
import { createAmendmentSearchApiHandler, type AmendmentSearchApi } from "./amendment-search"
import { createCivicSearchApiHandler } from "./civic-search"
import type { HttpApiHandler } from "./http"
import { createPassageSearchApiHandler } from "./passage-search"
import { createCanonicalResearchEvidenceRetriever, type ResearchSearchApi } from "./research-answers"
import { createUniversalSearchApiHandler } from "./universal-search"
import { createProductionUniversalSearchApi } from "./universal-search-adapter"

const products = [
  { product: "bill", path: "bills", model: "voyageai/voyage-4", dimensions: 1024, provider: "voyageai" },
  {
    product: "passage",
    path: "passages",
    model: "openai/text-embedding-3-small",
    dimensions: 1536,
    provider: "openai"
  },
  {
    product: "amendment",
    path: "amendments",
    model: "openai/text-embedding-3-small",
    dimensions: 1536,
    provider: "openai"
  },
  {
    product: "supporting-material",
    path: "supporting-materials",
    model: "voyageai/voyage-4",
    dimensions: 1024,
    provider: "voyageai"
  }
] as const
const servers = new Set<ReturnType<typeof createServer>>()
const options = { apiBaseUrl: "https://api.example.test" }

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  servers.clear()
})

function service(model: string | undefined, isReranked = false): ResearchSearchApi & AmendmentSearchApi {
  const page = {
    items: [],
    search: {
      isReranked: false as const,
      models: model === undefined ? [] : [{ model, purpose: "embedding" as const }]
    },
    truncated: false,
    warnings: []
  }
  return {
    searchAmendmentHits: async () => page,
    searchAmendments: async () => page,
    searchBillText: async () => ({ ...page, search: { ...page.search, isReranked } }),
    searchBills: async () => ({ ...page, search: { ...page.search, isReranked } }),
    searchSupportingMaterialHits: async () => page
  }
}

async function start(handlers: readonly HttpApiHandler[]) {
  const server = createServer(async (request, response) => {
    for (const handler of handlers) {
      if (await handler(request, response)) {
        return
      }
    }
    response.writeHead(404).end()
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  return `http://127.0.0.1:${address.port}`
}

function handlers(api: ResearchSearchApi & AmendmentSearchApi) {
  return [
    createCivicSearchApiHandler(api, options),
    createPassageSearchApiHandler(api, options),
    createAmendmentSearchApiHandler(api, options),
    createUniversalSearchApiHandler(createProductionUniversalSearchApi(api, undefined, options.apiBaseUrl))
  ]
}

async function post(baseUrl: string, path: string, body: unknown) {
  return await fetch(`${baseUrl}/api/search/${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  })
}

describe.each(products)("$product model metadata boundaries", ({ product, path, model, dimensions, provider }) => {
  it.each(["lexical", "semantic", "hybrid"] as const)(
    "agrees across product, universal and research %s search",
    async (mode) => {
      const api = service(mode === "lexical" ? undefined : model)
      const models = mode === "lexical" ? [] : [{ model, dimensions, provider, purpose: "embedding" }]
      const baseUrl = await start(handlers(api))
      for (const endpoint of [path, "all"]) {
        const response = await post(baseUrl, endpoint, {
          mode,
          query: "housing",
          recordTypes: endpoint === "all" ? [product] : undefined
        })
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ meta: { isReranked: false, models } })
      }
      await expect(
        createCanonicalResearchEvidenceRetriever(api, options.apiBaseUrl).retrieve({
          answerFormat: "concise",
          question: "housing",
          retrieval: { maxEvidence: 5, mode, recordTypes: [product] },
          scope: {}
        })
      ).resolves.toMatchObject({ models, rerankedProducts: [] })
    }
  )

  it.each([
    { model: "openai/unapproved-embedding", isReranked: false },
    { model: undefined, isReranked: false }
  ])("rejects incomplete or disallowed execution across all adapters: %j", async (execution) => {
    const api = service(execution.model, execution.isReranked)
    const baseUrl = await start(handlers(api))
    for (const endpoint of [path, "all"]) {
      const response = await post(baseUrl, endpoint, {
        mode: "semantic",
        query: "housing",
        recordTypes: endpoint === "all" ? [product] : undefined
      })
      expect(response.status).toBe(422)
      await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
    }
    await expect(
      createCanonicalResearchEvidenceRetriever(api, options.apiBaseUrl).retrieve({
        answerFormat: "concise",
        question: "housing",
        retrieval: { maxEvidence: 5, mode: "semantic", recordTypes: [product] },
        scope: {}
      })
    ).rejects.toThrow(LegislationError)
  })
})

it.each(products.filter(({ product }) => product === "bill" || product === "passage"))(
  "does not discard a contradictory $product reranking flag in universal adaptation",
  async ({ product, model }) => {
    const baseUrl = await start(handlers(service(model, true)))
    const response = await post(baseUrl, "all", { mode: "hybrid", query: "housing", recordTypes: [product] })
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  }
)

it("rejects contradictory expanded metadata at the universal merger boundary", async () => {
  const baseUrl = await start([
    createUniversalSearchApiHandler({
      search: async () => ({
        items: [],
        models: [{ dimensions: 1024, model: "voyageai/voyage-4", provider: "openai", purpose: "embedding" }],
        truncated: false
      })
    })
  ])
  const response = await post(baseUrl, "all", { mode: "semantic", query: "housing", recordTypes: ["bill"] })
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
})

it.each(["dimensions", "provider"] as const)("rejects missing %s at the universal merger boundary", async (field) => {
  const model = { dimensions: 1024, model: "voyageai/voyage-4", provider: "voyageai", purpose: "embedding" } as const
  Reflect.deleteProperty(model, field)
  const baseUrl = await start([
    createUniversalSearchApiHandler({
      search: async () => ({ items: [], models: [model], truncated: false })
    })
  ])
  const response = await post(baseUrl, "all", { mode: "semantic", query: "housing", recordTypes: ["bill"] })
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
})
