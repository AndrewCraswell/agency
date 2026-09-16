import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { createLegislationApiHandler } from "./handlers"
import {
  createCanonicalResearchEvidenceRetriever,
  createOpenRouterResearchAnswerGenerator,
  createResearchAnswerApiHandler,
  createResearchAnswerService,
  createUnavailableResearchAnswerApi,
  fuseResearchEvidence,
  type ModelUsage,
  type ResearchAnswerApi,
  type ResearchCitation
} from "./research-answers"

const servers = new Set<ReturnType<typeof createServer>>()
const citation: ResearchCitation = {
  billId: "bill:wa:2026:hb:1",
  documentId: "document:wa:2026:hb:1:engrossed",
  id: "evidence:passage:1",
  recordId: "section:wa:2026:hb:1:1",
  recordType: "passage",
  sectionId: "section:wa:2026:hb:1:1",
  snippet: "The bill requires annual publication of the report.",
  sourceUpdatedAt: "2026-01-10T00:00:00.000Z",
  sourceUrl: "https://leg.wa.gov/bills/1",
  sources: [
    {
      isOfficial: true,
      provider: "wa-legislature",
      retrievedAt: "2026-01-11T00:00:00.000Z",
      sourceUpdatedAt: "2026-01-10T00:00:00.000Z",
      sourceUrl: "https://leg.wa.gov/bills/1"
    }
  ],
  title: "HB 1, section 1"
}
const generationModel: ModelUsage = {
  dimensions: null,
  model: "openai/gpt-5-mini",
  provider: "openai",
  purpose: "generation"
}

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
  servers.clear()
})

async function start(service: ResearchAnswerApi): Promise<string> {
  const handler = createResearchAnswerApiHandler(service)
  const server = createServer(async (request, response) => {
    if (!(await handler(request, response))) {
      response.writeHead(404).end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

async function startComposed(service: ResearchAnswerApi): Promise<string> {
  const handler = createLegislationApiHandler({} as never, {
    apiBaseUrl: "https://api.example.test",
    researchAnswerApi: service
  })
  const server = createServer(async (request, response) => {
    if (!(await handler(request, response))) {
      response.writeHead(404).end()
    }
  })
  servers.add(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address")
  }
  return `http://127.0.0.1:${address.port}`
}

async function post(baseUrl: string, body: unknown) {
  return await fetch(`${baseUrl}/api/research/answers`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST"
  })
}

function answerService(overrides: Partial<ResearchAnswerApi> = {}): ResearchAnswerApi {
  return {
    answer: async () => ({
      answer: "The bill requires annual publication.",
      citations: [citation],
      claims: [{ citationIds: [citation.id], confidence: "supported", text: "Annual publication is required." }],
      generatedAt: "2026-08-25T00:00:00.000Z",
      id: "research-answer:fixture",
      question: "What does the bill require?",
      retrieval: {
        candidateCount: 1,
        evidenceCount: 1,
        maxEvidence: 20,
        mode: "lexical",
        models: [generationModel],
        recordTypes: ["passage"],
        rerankedProducts: [],
        rrfK: 60
      },
      warnings: []
    }),
    ...overrides
  }
}

describe("research answer HTTP API", () => {
  it("enforces scope and applies the documented defaults before calling the answer service", async () => {
    let received: Parameters<ResearchAnswerApi["answer"]>[0] | undefined
    const baseUrl = await start(
      answerService({
        answer: async (input) => {
          received = input
          return await answerService().answer(input)
        }
      })
    )

    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(200)
    expect(received).toMatchObject({
      answerFormat: "concise",
      retrieval: { maxEvidence: 20, mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })
    await expect(response.json()).resolves.toMatchObject({
      data: { citations: [expect.objectContaining({ id: citation.id })], retrieval: { rrfK: 60 } }
    })
  })

  it("rejects an unscoped request before retrieval", async () => {
    let calls = 0
    const baseUrl = await start(
      answerService({
        answer: async (input) => {
          calls += 1
          return await answerService().answer(input)
        }
      })
    )

    const response = await post(baseUrl, {
      question: "What happened?",
      retrieval: { mode: "lexical", recordTypes: ["bill"] },
      scope: {}
    })

    expect(response.status).toBe(422)
    expect(calls).toBe(0)
  })

  it("returns an explicit insufficient-evidence answer without invoking generation", async () => {
    let generationCalls = 0
    const service = createResearchAnswerService(
      {
        retrieve: async () => ({ candidateCount: 0, citations: [], models: [], rerankedProducts: [] })
      },
      {
        generate: async () => {
          generationCalls += 1
          return { answer: "unexpected", claims: [], model: generationModel }
        }
      },
      { newId: () => "research-answer:empty", now: () => new Date("2026-08-25T00:00:00.000Z") }
    )
    const baseUrl = await start(service)

    const response = await post(baseUrl, {
      question: "What happened?",
      retrieval: { mode: "lexical", recordTypes: ["bill"], maxEvidence: 1 },
      scope: { jurisdictionIds: ["jurisdiction:wa"] }
    })

    expect(response.status).toBe(200)
    expect(generationCalls).toBe(0)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        answer: expect.stringContaining("Insufficient evidence"),
        citations: [],
        claims: [{ confidence: "insufficient" }],
        retrieval: { evidenceCount: 0, models: [] }
      }
    })
  })

  it("rejects generated claims that cite anything outside retrieved evidence", async () => {
    const service = createResearchAnswerService(
      {
        retrieve: async () => ({ candidateCount: 1, citations: [citation], models: [], rerankedProducts: [] })
      },
      {
        generate: async () => ({
          answer: "The bill requires publication.",
          claims: [{ citationIds: ["fabricated-citation"], confidence: "supported", text: "Publication is required." }],
          model: generationModel
        })
      }
    )
    const baseUrl = await start(service)

    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { category: "unprocessable", message: expect.stringContaining("valid evidence citations") }
    })
  })

  it("surfaces an absent retrieval dependency as a typed 503", async () => {
    const baseUrl = await start(createUnavailableResearchAnswerApi())
    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "semantic", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "dependency_unavailable" } })
  })

  it("rejects research responses beyond the documented 256 KiB response ceiling", async () => {
    const base = await answerService().answer({
      answerFormat: "concise",
      question: "What does the bill require?",
      retrieval: { maxEvidence: 20, mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })
    const baseUrl = await start(
      answerService({
        answer: async () => ({ ...base, answer: "a".repeat(270_000) })
      })
    )

    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "payload_too_large" } })
  })

  it("rejects retrieved evidence without canonical source provenance", async () => {
    const service = createResearchAnswerService(
      {
        retrieve: async () => ({
          candidateCount: 1,
          citations: [{ ...citation, sources: [] }],
          models: [],
          rerankedProducts: []
        })
      },
      undefined
    )
    const baseUrl = await start(service)

    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("rejects malformed source references returned by research retrieval", async () => {
    const service = createResearchAnswerService(
      {
        retrieve: async () => ({
          candidateCount: 1,
          citations: [{ ...citation, sources: [{ provider: "fixture" }] }],
          models: [],
          rerankedProducts: []
        })
      },
      undefined
    )
    const baseUrl = await start(service)

    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ error: { category: "unprocessable" } })
  })

  it("adapts canonical bill search evidence within a bounded requested scope", async () => {
    const retriever = createCanonicalResearchEvidenceRetriever(
      {
        searchAmendments: async () => ({ items: [], truncated: false }),
        searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
        searchBills: async () => ({
          items: [
            {
              classification: ["bill"],
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              id: "bill:wa:2026:hb:1",
              identifier: "HB 1",
              introducedAt: null,
              latestActionAt: null,
              lexicalScore: 0.8,
              matchedFields: ["title"],
              rerankScore: null,
              score: 0.8,
              semanticScore: null,
              sessionId: "session:wa:2026",
              sourceUpdatedAt: new Date("2026-01-10T00:00:00.000Z"),
              sourceUrl: "https://leg.wa.gov/bills/1",
              status: "introduced",
              subjects: ["publication"],
              summary: null,
              title: "Annual publication",
              upstreamIds: {},
              updatedAt: new Date("2026-01-10T00:00:00.000Z"),
              jurisdictionId: "jurisdiction:wa",
              snippet: "Annual publication is required."
            }
          ],
          search: { isReranked: false, models: [] },
          truncated: false
        }),
        searchSupportingMaterialHits: async () => ({
          items: [],
          search: { isReranked: false, models: [] },
          truncated: false,
          warnings: []
        })
      },
      "https://api.example.test"
    )

    await expect(
      retriever.retrieve({
        answerFormat: "concise",
        question: "What is required?",
        retrieval: { maxEvidence: 1, mode: "lexical", recordTypes: ["bill"] },
        scope: { jurisdictionIds: ["jurisdiction:wa"] }
      })
    ).resolves.toMatchObject({
      candidateCount: 1,
      citations: [expect.objectContaining({ id: "evidence:bill:bill:wa:2026:hb:1", recordType: "bill" })],
      models: []
    })
  })

  it("retrieves every requested compatible product before selecting bounded fused evidence", async () => {
    let amendmentCalls = 0
    const retriever = createCanonicalResearchEvidenceRetriever(
      {
        searchAmendments: async () => {
          amendmentCalls += 1
          return { items: [], truncated: false }
        },
        searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
        searchBills: async () => ({
          items: [
            {
              classification: ["bill"],
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              id: "bill:wa:2026:hb:1",
              identifier: "HB 1",
              introducedAt: null,
              jurisdictionId: "jurisdiction:wa",
              latestActionAt: null,
              lexicalScore: 0.8,
              matchedFields: ["title"],
              rerankScore: null,
              score: 0.8,
              semanticScore: null,
              sessionId: "session:wa:2026",
              snippet: "Annual publication is required.",
              sourceUpdatedAt: new Date("2026-01-10T00:00:00.000Z"),
              sourceUrl: "https://leg.wa.gov/bills/1",
              status: "introduced",
              subjects: ["publication"],
              summary: null,
              title: "Annual publication",
              updatedAt: new Date("2026-01-10T00:00:00.000Z"),
              upstreamIds: {}
            }
          ],
          search: { isReranked: false, models: [] },
          truncated: false
        }),
        searchSupportingMaterialHits: async () => ({
          items: [],
          search: { isReranked: false, models: [] },
          truncated: false,
          warnings: []
        })
      },
      "https://api.example.test"
    )

    await expect(
      retriever.retrieve({
        answerFormat: "concise",
        question: "What is required?",
        retrieval: { maxEvidence: 1, mode: "lexical", recordTypes: ["bill", "amendment"] },
        scope: { jurisdictionIds: ["jurisdiction:wa"] }
      })
    ).resolves.toMatchObject({ candidateCount: 1, citations: [expect.any(Object)] })
    expect(amendmentCalls).toBe(1)
  })

  it("uses deterministic cross-product reciprocal-rank fusion with k 60", () => {
    const first = { ...citation, id: "evidence:a" }
    const shared = { ...citation, id: "evidence:b" }
    const last = { ...citation, id: "evidence:c" }

    expect(fuseResearchEvidence([[first, shared, last], [shared]], 3).map((item) => item.id)).toEqual([
      "evidence:b",
      "evidence:a",
      "evidence:c"
    ])
  })

  it("parses configured OpenRouter JSON before the citation boundary validates it", async () => {
    const generator = createOpenRouterResearchAnswerGenerator(
      {
        generateResearchAnswer: async () => ({
          content:
            '{"answer":"Annual publication is required.","claims":[{"text":"Publication is required.","confidence":"supported","citationIds":["evidence:passage:1"]}]}',
          model: "openai/gpt-5-mini"
        })
      },
      "openai/gpt-5-mini"
    )
    if (generator === undefined) {
      throw new Error("Expected a configured research generator")
    }
    const service = createResearchAnswerService(
      { retrieve: async () => ({ candidateCount: 1, citations: [citation], models: [], rerankedProducts: [] }) },
      generator
    )
    const answer = await service.answer({
      answerFormat: "concise",
      question: "What does the bill require?",
      retrieval: { maxEvidence: 1, mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(answer.retrieval.models).toContainEqual(generationModel)
    expect(answer.claims[0]?.citationIds).toEqual([citation.id])
  })

  it("is reachable through the composed legislation handler when dependencies are configured", async () => {
    const baseUrl = await startComposed(answerService())
    const response = await post(baseUrl, {
      question: "What does the bill require?",
      retrieval: { mode: "lexical", recordTypes: ["passage"] },
      scope: { billIds: ["bill:wa:2026:hb:1"] }
    })

    expect(response.status).toBe(200)
  })
})
