import { describe, expect, it } from "vitest"
import { runApiSmoke } from "./smoke-harness.js"
import { formatSmokeProcessOutput } from "./smoke-process-diagnostics.js"
import { parseSmokeFixtures, parseSmokeToken } from "./smoke-runner-config.js"

function canonical(
  id: string,
  path = `/api/resources/${encodeURIComponent(id)}`
): Record<string, unknown> & { sources: readonly unknown[] } {
  return {
    canonicalUrl: `https://legislation.example.test${path}`,
    id,
    sources: [
      {
        isOfficial: true,
        provider: "fixture",
        retrievedAt: "2026-08-24T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: `https://source.example.test/${encodeURIComponent(id)}`
      }
    ],
    updatedAt: "2026-08-24T00:00:00.000Z"
  }
}

describe("smoke runner configuration", () => {
  it("maps configured parent and section IDs into the smoke fixture", () => {
    const fixtures = parseSmokeFixtures({
      LEGISLATION_SMOKE_DOCUMENT_ID: " document:configured ",
      LEGISLATION_SMOKE_DOCUMENT_SECTION_ID: " document-section:configured ",
      LEGISLATION_SMOKE_BILL_SEARCH_QUERY: " housing ",
      LEGISLATION_SMOKE_CHANGE_ID: " change:configured ",
      LEGISLATION_SMOKE_MATERIAL_ID: " material:configured ",
      LEGISLATION_SMOKE_MATERIAL_SECTION_ID: " material-section:configured ",
      LEGISLATION_SMOKE_MATERIAL_SEARCH_QUERY: " budget ",
      LEGISLATION_SMOKE_SUBSCRIPTION_ID: " subscription:configured ",
      LEGISLATION_SMOKE_VOTE_ID: " vote:configured ",
      LEGISLATION_SMOKE_WEBHOOK_ID: " webhook:configured "
    })

    expect(fixtures).toMatchObject({
      documentId: "document:configured",
      documentSectionId: "document-section:configured",
      billSearchQuery: "housing",
      changeId: "change:configured",
      materialId: "material:configured",
      materialSectionId: "material-section:configured",
      materialSearchQuery: "budget",
      subscriptionId: "subscription:configured",
      voteId: "vote:configured",
      webhookId: "webhook:configured"
    })
  })

  it("forwards configured section fixtures to both singular harness routes without exposing the token", async () => {
    const token = "runner-token-must-not-leak"
    const fixtures = parseSmokeFixtures({
      LEGISLATION_SMOKE_DOCUMENT_ID: "document:configured",
      LEGISLATION_SMOKE_DOCUMENT_SECTION_ID: "document-section:configured",
      LEGISLATION_SMOKE_MATERIAL_ID: "material:configured",
      LEGISLATION_SMOKE_MATERIAL_SECTION_ID: "material-section:configured",
      LEGISLATION_SMOKE_TOKEN: token
    })
    const calls: string[] = []
    const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`)
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      return new Response(
        JSON.stringify({
          error: { category: "not_found", correlationId, message: "fixture response", retryable: false }
        }),
        { headers: { "content-type": "application/json", "x-correlation-id": correlationId }, status: 404 }
      )
    }

    await runApiSmoke({ baseUrl: "http://localhost:3199", fetchImpl, fixtures })

    expect(calls).toContain("GET /api/documents/document%3Aconfigured/sections/document-section%3Aconfigured")
    expect(calls).toContain(
      "GET /api/supporting-materials/material%3Aconfigured/sections/material-section%3Aconfigured"
    )
    expect(JSON.stringify(fixtures)).not.toContain(token)
    expect(
      formatSmokeProcessOutput({
        secrets: [parseSmokeToken({ LEGISLATION_SMOKE_TOKEN: token }) ?? ""],
        stderrTail: `authorization: Bearer ${token}`,
        stdoutTail: `token=${token}`
      })
    ).not.toContain(token)
  })

  it("runs fixture-backed search checks only for configured queries and requires canonical hits", async () => {
    const fixtures = parseSmokeFixtures({
      LEGISLATION_SMOKE_BILL_SEARCH_QUERY: "housing",
      LEGISLATION_SMOKE_MATERIAL_SEARCH_QUERY: "budget"
    })
    const searchQueries: string[] = []
    const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(input)
      const correlationId = new Headers(init?.headers).get("x-correlation-id") ?? "missing-correlation"
      const headers = { "content-type": "application/json", "x-correlation-id": correlationId }
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), { headers, status: 200 })
      }
      if (url.pathname === "/ready") {
        return new Response(JSON.stringify({ status: "ready" }), { headers, status: 200 })
      }
      if (url.pathname === "/api/search/bills") {
        if (typeof init?.body === "string" && init.body.length > 1_048_576) {
          return new Response(
            JSON.stringify({
              error: {
                category: "payload_too_large",
                correlationId,
                message: "Request body exceeds the allowed size",
                retryable: false
              }
            }),
            { headers, status: 413 }
          )
        }
        if (typeof init?.body === "string") {
          searchQueries.push(String((JSON.parse(init.body) as Record<string, unknown>).query))
        }
        const record = {
          ...canonical("bill:fixture", "/api/bills/bill%3Afixture"),
          classification: ["bill"],
          identifier: "HB 1",
          introducedDate: "2026-01-01",
          jurisdictionId: "jurisdiction:fixture",
          latestActionAt: null,
          sessionId: "session:fixture",
          status: null,
          subjects: ["housing"],
          title: "Housing bill",
          type: "bill"
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                match: {
                  explanation: null,
                  lexicalScore: 1,
                  matchedFields: ["title"],
                  mode: "lexical",
                  rerankScore: null,
                  semanticScore: null,
                  snippet: "Housing bill"
                },
                recordId: "bill:fixture",
                recordType: "bill",
                rank: 1,
                record,
                score: 1,
                sources: record.sources
              }
            ],
            links: { next: null, self: url.pathname },
            meta: {
              correlationId,
              isReranked: false,
              limit: 1,
              mode: "lexical",
              models: [],
              nextCursor: null,
              truncated: false,
              warnings: []
            }
          }),
          { headers, status: 200 }
        )
      }
      if (url.pathname === "/api/search/supporting-materials") {
        if (typeof init?.body === "string") {
          searchQueries.push(String((JSON.parse(init.body) as Record<string, unknown>).query))
        }
        const material = {
          ...canonical("material:fixture", "/api/supporting-materials/material%3Afixture"),
          amendmentIds: [],
          billIds: ["bill:fixture"],
          classification: "supporting-document",
          documentDate: "2026-01-01",
          jurisdictionId: "jurisdiction:fixture",
          meetingIds: [],
          mimeType: "text/html",
          organizationIds: [],
          processingStatus: "processed",
          sourceUrl: "https://source.example.test/material",
          title: "Budget report",
          type: "supporting-material"
        }
        const section = {
          ...canonical(
            "material-section:fixture",
            "/api/supporting-materials/material%3Afixture/sections/material-section%3Afixture"
          ),
          contentHash: "a".repeat(64),
          heading: null,
          materialId: "material:fixture",
          ordinal: 0,
          pageEnd: null,
          pageStart: null,
          sourceUrl: "https://source.example.test/material",
          text: "Budget report text",
          type: "supporting-material-section"
        }
        return new Response(
          JSON.stringify({
            data: [
              {
                match: {
                  explanation: null,
                  lexicalScore: 1,
                  matchedFields: ["sectionText"],
                  mode: "lexical",
                  rerankScore: null,
                  semanticScore: null,
                  snippet: "Budget report text"
                },
                recordId: "material:fixture",
                recordType: "supporting-material",
                rank: 1,
                record: {
                  material,
                  relatedRecordIds: ["bill:fixture"],
                  section
                },
                score: 1,
                sources: material.sources
              }
            ],
            links: { next: null, self: url.pathname },
            meta: {
              correlationId,
              isReranked: false,
              limit: 1,
              mode: "lexical",
              models: [],
              nextCursor: null,
              truncated: false,
              warnings: []
            }
          }),
          { headers, status: 200 }
        )
      }
      return new Response(
        JSON.stringify({
          error: { category: "not_found", correlationId, message: "fixture response", retryable: false }
        }),
        { headers, status: 404 }
      )
    }

    const report = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl,
      fixtures
    })

    expect(report.passed.map((check) => check.id)).toEqual(
      expect.arrayContaining(["search-bills", "search-supporting-materials"])
    )
    expect(searchQueries).toEqual(["housing", "budget"])

    const malformedFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const response = await fetchImpl(input, init)
      if (new URL(input).pathname !== "/api/search/bills") {
        return response
      }
      const body = (await response.json()) as { data: Array<Record<string, unknown>> }
      const [{ match: _match, sources: _sources, ...hit }] = body.data
      return new Response(JSON.stringify({ ...body, data: [hit] }), {
        headers: response.headers,
        status: response.status
      })
    }
    const malformed = await runApiSmoke({
      baseUrl: "http://localhost:3199",
      canonicalApiBaseUrl: "https://legislation.example.test",
      fetchImpl: malformedFetch,
      fixtures: { billSearchQuery: "housing" }
    })
    expect(malformed.failed.map((check) => check.id)).toContain("search-bills")
  })
})
