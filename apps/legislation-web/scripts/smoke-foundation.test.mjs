import { execFile } from "node:child_process"
import { createServer } from "node:http"
import { promisify } from "node:util"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const requests = []
let server
let baseUrl
let malformedPath
let invalidBatchStatusPath
let changeFeedError
let documentDetailError
let documentSectionsError
let documentBatchItemError
let missingFixturePrefix
let representativeUnavailable = false
const nx03aErrorPaths = new Map()
const nx03bErrorPaths = new Map()
const nx03bNotFoundPaths = new Set()
const nx04ErrorPaths = new Map()
let malformedNx04Path

function json(response, correlationId, body, status = 200, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", "x-correlation-id": correlationId, ...headers })
  response.end(JSON.stringify(body))
}

function apiJson(response, correlationId, body, status = 200) {
  json(response, correlationId, body, status, { "cache-control": "private, no-store", etag: 'W/"fixture"' })
}

function page(pathname, correlationId) {
  return {
    data: [],
    links: { next: null, self: pathname },
    meta: { correlationId, limit: 1, nextCursor: null, truncated: false, warnings: [] }
  }
}

function resource(pathname, correlationId, id) {
  return { data: { id }, links: { self: pathname }, meta: { correlationId, warnings: [] } }
}

function notFound(pathname, correlationId) {
  return {
    error: { category: "not_found", correlationId, message: `No route for ${pathname}`, retryable: false }
  }
}

async function body(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function resourceBatchItem(item) {
  if (item.id === "document:__deployment-smoke-missing__") {
    return {
      error: { category: "not_found", message: "Fixture was not found", retryable: false },
      id: item.id,
      status: "error"
    }
  }
  if (item.type === "document" && documentBatchItemError !== undefined) {
    return { error: documentBatchItemError(item.id), id: item.id, status: "error" }
  }
  return { data: { id: item.id, type: item.type }, id: item.id, status: "ok" }
}

function batch(pathname, correlationId, requestBody) {
  if (pathname === "/api/representative-lookups") {
    return {
      data: {
        districts: [],
        expiresAt: "2026-08-26T00:05:00.000Z",
        lookupId: "lookup:fixture",
        quality: "unresolved",
        representatives: [],
        resolvedAt: "2026-08-26T00:00:00.000Z",
        warnings: []
      },
      links: { self: pathname },
      meta: { correlationId, warnings: [] }
    }
  }
  if (pathname === "/api/resources/batch") {
    return {
      data: requestBody.items.map(resourceBatchItem),
      links: { self: pathname },
      meta: { correlationId, requested: requestBody.items.length, returned: requestBody.items.length, warnings: [] }
    }
  }
  const isBillAmendments = pathname === "/api/bills/amendments/batch"
  const id = isBillAmendments ? requestBody.billIds[0] : requestBody.ids[0]
  return {
    data: [
      isBillAmendments
        ? { billId: id, page: page(`/api/bills/${encodeURIComponent(id)}/amendments`, correlationId), status: "ok" }
        : { data: { id }, id, status: "ok" }
    ],
    links: { self: pathname },
    meta: { correlationId, requested: 1, returned: 1, warnings: [] }
  }
}

function searchModels(pathname, mode) {
  if (mode === "lexical") {
    return []
  }
  const model = pathname === "/api/search/bills" ? "voyageai/voyage-4" : "openai/text-embedding-3-small"
  const provider = pathname === "/api/search/bills" ? "voyageai" : "openai"
  const dimensions = pathname === "/api/search/bills" ? 1024 : 1536
  const models = [{ dimensions, model, provider, purpose: "embedding" }]
  if (pathname === "/api/search/bills" || pathname === "/api/search/passages") {
    models.push({ dimensions: null, model: "cohere/rerank-v3.5", provider: "cohere", purpose: "reranking" })
  }
  return models
}

function searchRecordType(product) {
  if (product === "all") {
    return "bill"
  }
  if (product === "supporting-materials") {
    return "supporting-material"
  }
  return product.endsWith("s") ? product.slice(0, -1) : product
}

function sourceReference() {
  return {
    isOfficial: true,
    provider: "fixture",
    retrievedAt: "2026-08-25T00:00:00.000Z",
    sourceUpdatedAt: null,
    sourceUrl: "https://example.test/source"
  }
}

function nx04Response(pathname, correlationId, requestBody) {
  if (pathname.startsWith("/api/search/")) {
    const mode = requestBody.mode
    const product = pathname.split("/").at(-1)
    return {
      data: [
        {
          match: {},
          rank: 1,
          record: {},
          recordId: `${product}:fixture`,
          recordType: searchRecordType(product),
          score: 1,
          sources: [sourceReference()]
        }
      ],
      links: { next: null, self: pathname },
      meta: {
        correlationId,
        isReranked: mode !== "lexical" && (pathname === "/api/search/bills" || pathname === "/api/search/passages"),
        limit: 1,
        mode,
        models: searchModels(pathname, mode),
        nextCursor: null,
        truncated: false,
        warnings: []
      }
    }
  }
  if (pathname === "/api/document-diffs") {
    return {
      data: {
        billId: requestBody.billId,
        counts: { added: 0, changed: 1, removed: 0, unchanged: 0 },
        granularity: "word",
        hunks: [
          {
            classification: "changed",
            leftSectionId: null,
            leftText: "left",
            operations: [
              {
                classification: "delete",
                leftEnd: 4,
                leftStart: 0,
                rightEnd: null,
                rightStart: null,
                text: "left"
              }
            ],
            ordinal: 0,
            rightSectionId: null,
            rightText: "right",
            sources: [sourceReference()]
          }
        ],
        id: "diff:fixture",
        leftDocument: { id: requestBody.leftDocumentId },
        nextCursor: null,
        rightDocument: { id: requestBody.rightDocumentId },
        truncated: false
      },
      links: { self: pathname },
      meta: { correlationId, warnings: [] }
    }
  }
  return {
    data: {
      answer: "Fixture answer.",
      citations: [
        {
          billId: requestBody.scope.billIds[0],
          documentId: null,
          id: "citation:fixture",
          recordId: requestBody.scope.billIds[0],
          recordType: "bill",
          sectionId: null,
          snippet: "Fixture evidence.",
          sourceUpdatedAt: null,
          sourceUrl: "https://example.test/source",
          sources: [sourceReference()],
          title: "Fixture bill"
        }
      ],
      claims: [{ citationIds: ["citation:fixture"], confidence: "supported", text: "Fixture claim." }],
      generatedAt: "2026-08-25T00:00:00.000Z",
      id: "research-answer:fixture",
      question: requestBody.question,
      retrieval: {
        candidateCount: 1,
        evidenceCount: 1,
        maxEvidence: 1,
        mode: "lexical",
        models: [],
        recordTypes: ["bill"],
        rerankedProducts: [],
        rrfK: 60
      },
      warnings: []
    },
    links: { self: pathname },
    meta: { correlationId, warnings: [] }
  }
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1")
    const correlationId = request.headers["x-correlation-id"] ?? "generated-correlation-id"
    requests.push({
      body: await body(request),
      correlationId,
      ifNoneMatch: request.headers["if-none-match"],
      method: request.method,
      pathname: url.pathname,
      search: url.search
    })
    if (request.method === "GET" && url.pathname === "/health") {
      json(response, correlationId, { status: "ok" })
      return
    }
    if (request.method === "GET" && url.pathname === "/ready") {
      json(response, correlationId, { status: "ready" })
      return
    }
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html" })
      response.end("<main>fixture</main>")
      return
    }
    if (url.pathname === "/health" || url.pathname === "/ready") {
      json(response, correlationId, { error: "not_found" }, 404)
      return
    }
    if (!url.pathname.startsWith("/api/")) {
      response.writeHead(404)
      response.end()
      return
    }
    if (url.pathname.endsWith("/") || url.pathname === "/api/__deployment-smoke-missing__") {
      json(response, correlationId, notFound(url.pathname, correlationId), 404)
      return
    }
    if (nx03bNotFoundPaths.has(url.pathname)) {
      json(response, correlationId, notFound(url.pathname, correlationId), 404)
      return
    }
    if (missingFixturePrefix !== undefined && url.pathname.startsWith(missingFixturePrefix)) {
      json(response, correlationId, notFound(url.pathname, correlationId), 404)
      return
    }
    if (request.method === "GET" && url.pathname === "/api/changes" && changeFeedError !== undefined) {
      apiJson(response, correlationId, changeFeedError(correlationId), 422)
      return
    }
    const requestSegments = url.pathname.split("/").filter(Boolean)
    if (
      request.method === "GET" &&
      requestSegments[1] === "documents" &&
      requestSegments.length === 3 &&
      documentDetailError !== undefined
    ) {
      apiJson(response, correlationId, documentDetailError(correlationId), 422)
      return
    }
    if (
      request.method === "GET" &&
      requestSegments[1] === "documents" &&
      requestSegments[3] === "sections" &&
      requestSegments.length === 4 &&
      documentSectionsError !== undefined
    ) {
      apiJson(response, correlationId, documentSectionsError(correlationId), 422)
      return
    }
    const nx03aError = nx03aErrorPaths.get(url.pathname)
    if (request.method === "GET" && nx03aError !== undefined) {
      apiJson(response, correlationId, nx03aError(correlationId), 422)
      return
    }
    const nx03bError = nx03bErrorPaths.get(url.pathname)
    if (request.method === "GET" && nx03bError !== undefined) {
      apiJson(response, correlationId, nx03bError(correlationId), 422)
      return
    }
    if (request.method === "GET" && request.headers["if-none-match"] === 'W/"fixture"') {
      response.writeHead(304, {
        "cache-control": "private, no-store",
        etag: 'W/"fixture"',
        "x-correlation-id": correlationId
      })
      response.end()
      return
    }
    if (url.pathname === malformedPath) {
      apiJson(response, correlationId, { data: [] })
      return
    }
    if (request.method === "POST") {
      if (url.pathname === "/api/representative-lookups" && representativeUnavailable) {
        json(
          response,
          correlationId,
          {
            error: {
              category: "dependency_unavailable",
              correlationId,
              message: "Representative provider is unavailable",
              retryable: true
            }
          },
          503,
          { "cache-control": "private, no-store", "retry-after": "30" }
        )
        return
      }
      const nx04Error = nx04ErrorPaths.get(url.pathname)
      if (nx04Error !== undefined) {
        const error = nx04Error(correlationId)
        const status = error.error.category === "unprocessable" ? 422 : 503
        json(response, correlationId, error, status, {
          "cache-control": "private, no-store",
          ...(status === 503 ? { "retry-after": "30" } : {})
        })
        return
      }
      if (url.pathname === malformedNx04Path) {
        apiJson(response, correlationId, { data: [] })
        return
      }
      if (
        url.pathname === "/api/document-diffs" ||
        url.pathname === "/api/research/answers" ||
        url.pathname.startsWith("/api/search/")
      ) {
        apiJson(response, correlationId, nx04Response(url.pathname, correlationId, requests.at(-1).body))
        return
      }
      const responseBody = batch(url.pathname, correlationId, requests.at(-1).body)
      if (url.pathname === invalidBatchStatusPath) {
        responseBody.data[0] = {
          error: { category: "not_found", message: "Fixture was not found", retryable: false },
          id: "bill:fixture",
          status: "unexpected"
        }
      }
      apiJson(response, correlationId, responseBody)
      return
    }
    const segments = url.pathname.split("/").filter(Boolean)
    const id = decodeURIComponent(segments.at(-1))
    const isNx02aResource =
      (segments[1] === "jurisdictions" && segments.length === 3) ||
      (segments[1] === "sessions" && segments.length === 3)
    const isNx02bResource = ["bills", "amendments", "votes"].includes(segments[1]) && segments.length === 3
    const isNx02cResource =
      (["documents", "supporting-materials"].includes(segments[1]) && segments.length === 3) ||
      (["documents", "supporting-materials"].includes(segments[1]) &&
        segments[3] === "sections" &&
        segments.length === 5)
    const isNx03aResource =
      (["people", "organizations"].includes(segments[1]) && segments.length === 3) ||
      (segments[1] === "people" && segments[3] === "terms" && segments.length === 5) ||
      (segments[1] === "organizations" && segments[3] === "memberships" && segments.length === 5)
    const isNx03bResource =
      (segments[1] === "meetings" && segments.length === 3) ||
      (segments[1] === "meetings" &&
        ["agenda", "documents", "outcomes", "participants"].includes(segments[3]) &&
        segments.length === 5) ||
      (segments[1] === "calendars" && segments.length === 3)
    apiJson(
      response,
      correlationId,
      isNx02aResource || isNx02bResource || isNx02cResource || isNx03aResource || isNx03bResource
        ? resource(url.pathname, correlationId, id)
        : page(url.pathname, correlationId)
    )
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error))))
})

async function runSmoke(environment = {}) {
  const result = await execFileAsync(process.execPath, ["scripts/smoke-foundation.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, LEGISLATION_WEB_SMOKE_BASE_URL: baseUrl, ...environment }
  })
  return JSON.parse(result.stdout)
}

function requestSignature(request) {
  return `${request.method} ${request.pathname}${request.search}`
}

describe("NX-02B deployed smoke profile", () => {
  it("cumulatively checks NX-02A and all 18 NX-02B routes with encoded fixture IDs and exact methods", async () => {
    requests.length = 0
    const result = await runSmoke({
      LEGISLATION_WEB_SMOKE_AMENDMENT_ID: "amendment:fixture",
      LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture/with space",
      LEGISLATION_WEB_SMOKE_NX_02B: "1",
      LEGISLATION_WEB_SMOKE_VOTE_ID: "vote:fixture"
    })

    expect(result.profile).toBe("foundation+nx-02a+nx-02b")
    expect(result.nx02b.passed).toHaveLength(18)
    expect(result.nx02b.skipped).toEqual([])
    expect(result.nx02b.notFound).toEqual(["bills_trailing_slash", "amendments_trailing_slash", "votes_trailing_slash"])
    const nx02a = requests.filter((request) => /^nx-02a-smoke-\d+$/.test(request.correlationId))
    const nx02b = requests.filter((request) => /^nx-02b-smoke-\d+$/.test(request.correlationId))
    const conditional = requests.filter((request) => /^nx-02b-smoke-conditional-\d+$/.test(request.correlationId))
    expect(nx02a.map(requestSignature).sort()).toEqual(
      [
        "GET /api/jurisdictions?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak",
        "GET /api/jurisdictions/jurisdiction%3Aak/sessions?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak/bills?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak/organizations?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak/commissions?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak/committees?limit=1",
        "GET /api/jurisdictions/jurisdiction%3Aak/meetings?limit=1",
        "GET /api/sessions/session%3Aak%3A30",
        "GET /api/sessions/session%3Aak%3A30/bills?limit=1",
        "GET /api/sessions/session%3Aak%3A30/meetings?limit=1"
      ].sort()
    )
    expect(nx02b.map(requestSignature).sort()).toEqual(
      [
        "GET /api/bills?jurisdictionId=jurisdiction:ak&limit=1",
        "GET /api/amendments?recordType=structured&jurisdictionId=jurisdiction:us&sort=identifier-asc&limit=1",
        "GET /api/votes?limit=1",
        "POST /api/bills/batch",
        "POST /api/bills/amendments/batch",
        "GET /api/bills/bill%3Afixture%2Fwith%20space",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/timeline?limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/related?mode=explicit&limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/sections?limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/amendments?limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/votes?limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/documents?limit=1",
        "GET /api/bills/bill%3Afixture%2Fwith%20space/changes?limit=1",
        "POST /api/amendments/batch",
        "GET /api/amendments/amendment%3Afixture",
        "POST /api/votes/batch",
        "GET /api/votes/vote%3Afixture",
        "GET /api/votes/vote%3Afixture/positions?limit=1"
      ].sort()
    )
    expect(conditional).toHaveLength(14)
    expect(conditional.every((request) => request.ifNoneMatch === 'W/"fixture"')).toBe(true)
    expect(nx02b.filter((request) => request.method === "POST").map((request) => request.body)).toEqual([
      { ids: ["bill:fixture/with space"] },
      { billIds: ["bill:fixture/with space"], limitPerBill: 1 },
      { ids: ["amendment:fixture"] },
      { ids: ["vote:fixture"] }
    ])
    expect(
      nx02b
        .filter((request) => request.pathname === "/api/bills" || request.pathname === "/api/amendments")
        .map(requestSignature)
        .sort()
    ).toEqual([
      "GET /api/amendments?recordType=structured&jurisdictionId=jurisdiction:us&sort=identifier-asc&limit=1",
      "GET /api/bills?jurisdictionId=jurisdiction:ak&limit=1"
    ])
    expect(
      nx02b
        .filter((request) => request.pathname === "/api/bills" || request.pathname === "/api/amendments")
        .every((request) => !request.search.includes("fixture"))
    ).toBe(true)
  })

  it("reports every unconfigured detail fixture route as an explicit skip", async () => {
    requests.length = 0
    const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_02B: "1" })

    expect(result.nx02b.passed).toEqual(["bills", "amendments", "votes"])
    expect(result.nx02b.skipped).toHaveLength(15)
    expect(result.nx02b.skipped).toEqual(
      expect.arrayContaining([
        { name: "bill", reason: "fixture_not_configured:billId" },
        { name: "amendment", reason: "fixture_not_configured:amendmentId" },
        { name: "vote", reason: "fixture_not_configured:voteId" }
      ])
    )
    expect(requests.some((request) => `${request.pathname}${request.search}`.includes("fixture"))).toBe(false)
  })

  it("fails rather than skipping a malformed canonical response", async () => {
    malformedPath = "/api/votes"
    try {
      await expect(runSmoke({ LEGISLATION_WEB_SMOKE_NX_02B: "1" })).rejects.toThrow("Command failed")
    } finally {
      malformedPath = undefined
    }
  })

  it("redacts fixture IDs from failing diagnostics", async () => {
    const fixtureId = "bill:do-not-emit"
    malformedPath = `/api/bills/${encodeURIComponent(fixtureId)}`
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_BILL_ID: fixtureId, LEGISLATION_WEB_SMOKE_NX_02B: "1" })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).not.toContain(fixtureId)
      expect(error.stderr).not.toContain(encodeURIComponent(fixtureId))
    } finally {
      malformedPath = undefined
    }
  })

  it("rejects batch statuses other than ok or error", async () => {
    invalidBatchStatusPath = "/api/bills/batch"
    try {
      await expect(
        runSmoke({ LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture", LEGISLATION_WEB_SMOKE_NX_02B: "1" })
      ).rejects.toThrow("Command failed")
    } finally {
      invalidBatchStatusPath = undefined
    }
  })
})

describe("NX-02C deployed smoke profile", () => {
  it("cumulatively checks NX-02A/B and exactly nine NX-02C routes with encoded fixtures and mixed resource batch items", async () => {
    requests.length = 0
    const result = await runSmoke({
      LEGISLATION_WEB_SMOKE_AMENDMENT_ID: "amendment:fixture",
      LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture",
      LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture/with space",
      LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID: "document-section:fixture/with space",
      LEGISLATION_WEB_SMOKE_NX_02C: "1",
      LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture/with space",
      LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID: "supporting-material-section:fixture/with space",
      LEGISLATION_WEB_SMOKE_VOTE_ID: "vote:fixture"
    })

    expect(result.profile).toBe("foundation+nx-02a+nx-02b+nx-02c")
    expect(result.nx02a.passed).toHaveLength(11)
    expect(result.nx02b.passed).toHaveLength(18)
    expect(result.nx02c.passed).toHaveLength(9)
    expect(result.nx02c.skipped).toEqual([])
    expect(result.nx02c.notFound).toEqual([
      "documents_trailing_slash",
      "supporting_materials_trailing_slash",
      "changes_trailing_slash",
      "resource_batch_trailing_slash"
    ])

    const nx02c = requests.filter((request) => /^nx-02c-smoke-\d+$/.test(request.correlationId))
    const conditional = requests.filter((request) => /^nx-02c-smoke-conditional-\d+$/.test(request.correlationId))
    expect(nx02c).toHaveLength(9)
    expect(nx02c.map(requestSignature).sort()).toEqual(
      [
        "GET /api/documents/document%3Afixture%2Fwith%20space",
        "GET /api/documents/document%3Afixture%2Fwith%20space/sections?limit=1",
        "GET /api/documents/document%3Afixture%2Fwith%20space/sections/document-section%3Afixture%2Fwith%20space",
        "GET /api/supporting-materials?jurisdictionId=jurisdiction%3Aus&classification=committee-report&limit=1",
        "GET /api/supporting-materials/supporting-material%3Afixture%2Fwith%20space",
        "GET /api/supporting-materials/supporting-material%3Afixture%2Fwith%20space/sections?limit=1",
        "GET /api/supporting-materials/supporting-material%3Afixture%2Fwith%20space/sections/supporting-material-section%3Afixture%2Fwith%20space",
        "GET /api/changes?limit=1",
        "POST /api/resources/batch"
      ].sort()
    )
    expect(conditional).toHaveLength(8)
    expect(conditional.every((request) => request.ifNoneMatch === 'W/"fixture"')).toBe(true)
    expect(nx02c.find((request) => request.pathname === "/api/resources/batch")?.body).toEqual({
      items: [
        { id: "document:fixture/with space", type: "document" },
        { id: "supporting-material:fixture/with space", type: "supporting-material" },
        { id: "document:__deployment-smoke-missing__", type: "document" }
      ]
    })
  })

  it("reports missing NX-02C fixture configuration as explicit skips without embedding identifiers", async () => {
    requests.length = 0
    const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_02C: "1" })

    expect(result.nx02c.passed).toEqual(["supporting materials", "changes"])
    expect(result.nx02c.skipped).toEqual([
      { name: "document", reason: "fixture_not_configured:documentId" },
      { name: "document sections", reason: "fixture_not_configured:documentId" },
      { name: "document section", reason: "fixture_not_configured:documentId" },
      { name: "supporting material", reason: "fixture_not_configured:supportingMaterialId" },
      { name: "supporting material sections", reason: "fixture_not_configured:supportingMaterialId" },
      { name: "supporting material section", reason: "fixture_not_configured:supportingMaterialId" },
      { name: "resource batch", reason: "fixture_not_configured:documentId" }
    ])
    expect(requests.some((request) => `${request.pathname}${request.search}`.includes("fixture"))).toBe(false)
  })

  it("redacts NX-02C fixture IDs from failing diagnostics", async () => {
    const fixtureId = "document:do-not-emit"
    malformedPath = `/api/documents/${encodeURIComponent(fixtureId)}`
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_DOCUMENT_ID: fixtureId, LEGISLATION_WEB_SMOKE_NX_02C: "1" })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).not.toContain(fixtureId)
      expect(error.stderr).not.toContain(encodeURIComponent(fixtureId))
    } finally {
      malformedPath = undefined
    }
  })

  it("classifies an exact canonical global-change 422 as a data-incomplete skip without leaking its message", async () => {
    const privateMessage = "Change record change:private-record has no canonical source provenance"
    changeFeedError = (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false }
    })
    try {
      const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_02C: "1" })

      expect(result.nx02c.passed).toEqual(["supporting materials"])
      expect(result.nx02c.skipped).toContainEqual({ name: "changes", reason: "canonical_data_incomplete" })
      expect(JSON.stringify(result)).not.toContain("change:private-record")
      expect(JSON.stringify(result)).not.toContain(privateMessage)
    } finally {
      changeFeedError = undefined
    }
  })

  it("rejects a malformed global-change 422 without leaking its message", async () => {
    const privateMessage = "Change record change:private-record has no canonical source provenance"
    changeFeedError = () => ({
      error: {
        category: "unprocessable",
        correlationId: "wrong-correlation",
        message: privateMessage,
        retryable: false
      }
    })
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_NX_02C: "1" })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET changes did not return a canonical data-incomplete ErrorResponse")
      expect(error.stderr).not.toContain("change:private-record")
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      changeFeedError = undefined
    }
  })

  it("classifies canonical document reads as data-incomplete and accepts the exact batch dependency mapping", async () => {
    const detailMessage = "Document document:private-record has incomplete canonical OCR provenance"
    const batchMessage = "Document document:private-record could not be projected"
    documentDetailError = (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: detailMessage, retryable: false }
    })
    documentSectionsError = (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: detailMessage, retryable: false }
    })
    documentBatchItemError = () => ({
      category: "dependency_unavailable",
      message: batchMessage,
      retryable: true
    })
    try {
      const result = await runSmoke({
        LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
        LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID: "document-section:fixture",
        LEGISLATION_WEB_SMOKE_NX_02C: "1",
        LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture",
        LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID: "supporting-material-section:fixture"
      })

      expect(result.nx02c.passed).toEqual([
        "document section",
        "supporting materials",
        "supporting material",
        "supporting material sections",
        "supporting material section",
        "changes",
        "resource batch"
      ])
      expect(result.nx02c.skipped).toEqual([
        { name: "document", reason: "canonical_data_incomplete" },
        { name: "document sections", reason: "canonical_data_incomplete" }
      ])
      expect(JSON.stringify(result)).not.toContain("document:private-record")
      expect(JSON.stringify(result)).not.toContain(detailMessage)
      expect(JSON.stringify(result)).not.toContain(batchMessage)
    } finally {
      documentDetailError = undefined
      documentSectionsError = undefined
      documentBatchItemError = undefined
    }
  })

  it("rejects a malformed document-detail 422 envelope without leaking its message", async () => {
    const privateMessage = "Document document:private-record has incomplete canonical OCR provenance"
    documentDetailError = (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false },
      unexpected: true
    })
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
          LEGISLATION_WEB_SMOKE_NX_02C: "1"
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET document did not return a canonical data-incomplete ErrorResponse")
      expect(error.stderr).not.toContain("document:private-record")
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      documentDetailError = undefined
    }
  })

  it("rejects a malformed document batch error category without leaking its message", async () => {
    const privateMessage = "Document document:private-record could not be projected"
    documentBatchItemError = () => ({ category: "unprocessable", message: privateMessage, retryable: false })
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
          LEGISLATION_WEB_SMOKE_NX_02C: "1",
          LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture"
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("POST resource batch did not return the expected resource Batch error item")
      expect(error.stderr).not.toContain("document:private-record")
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      documentBatchItemError = undefined
    }
  })
})

describe("NX-03A deployed smoke profile", () => {
  it("cumulatively checks NX-02A/B/C and all 14 people and organization routes with static child precedence", async () => {
    requests.length = 0
    const result = await runSmoke({
      LEGISLATION_WEB_SMOKE_AMENDMENT_ID: "amendment:fixture",
      LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture",
      LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
      LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID: "document-section:fixture",
      LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID: "membership:fixture/with space",
      LEGISLATION_WEB_SMOKE_NX_03A: "1",
      LEGISLATION_WEB_SMOKE_ORGANIZATION_ID: "organization:fixture/with space",
      LEGISLATION_WEB_SMOKE_PERSON_ID: "person:fixture/with space",
      LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture",
      LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID: "supporting-material-section:fixture",
      LEGISLATION_WEB_SMOKE_TERM_ID: "term:fixture/with space",
      LEGISLATION_WEB_SMOKE_VOTE_ID: "vote:fixture"
    })

    expect(result.profile).toBe("foundation+nx-02a+nx-02b+nx-02c+nx-03a")
    expect(result.nx02a.passed).toHaveLength(11)
    expect(result.nx02b.passed).toHaveLength(18)
    expect(result.nx02c.passed).toHaveLength(9)
    expect(result.nx03a.passed).toHaveLength(14)
    expect(result.nx03a.skipped).toEqual([])
    expect(result.nx03a.notFound).toEqual(["people_trailing_slash", "organizations_trailing_slash"])

    const nx03a = requests.filter((request) => /^nx-03a-smoke-\d+$/.test(request.correlationId))
    const conditional = requests.filter((request) => /^nx-03a-smoke-conditional-\d+$/.test(request.correlationId))
    expect(nx03a).toHaveLength(14)
    expect(nx03a.map(requestSignature).sort()).toEqual(
      [
        "GET /api/people?limit=1",
        "GET /api/people/person%3Afixture%2Fwith%20space",
        "GET /api/people/person%3Afixture%2Fwith%20space/bills?limit=1",
        "GET /api/people/person%3Afixture%2Fwith%20space/amendments?limit=1",
        "GET /api/people/person%3Afixture%2Fwith%20space/votes?limit=1",
        "GET /api/people/person%3Afixture%2Fwith%20space/memberships?limit=1",
        "GET /api/people/person%3Afixture%2Fwith%20space/terms/term%3Afixture%2Fwith%20space",
        "GET /api/organizations?limit=1",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space/members?limit=1",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space/memberships/membership%3Afixture%2Fwith%20space",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space/meetings?limit=1",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space/bills?limit=1",
        "GET /api/organizations/organization%3Afixture%2Fwith%20space/calendars?limit=1"
      ].sort()
    )
    expect(conditional).toHaveLength(14)
    expect(conditional.every((request) => request.ifNoneMatch === 'W/"fixture"')).toBe(true)
  })

  it("accepts the audited data-incomplete details while requiring nine exact empty Pages and membership 404", async () => {
    requests.length = 0
    const personId = "person:audited-fixture"
    const termId = "term:audited-fixture"
    const organizationId = "organization:audited-fixture"
    const membershipId = "membership:audited-missing"
    const privateMessage = "Canonical fixture record has incomplete private production facts"
    const canonicalDataIncomplete = (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false }
    })
    nx03aErrorPaths.set(`/api/people/${encodeURIComponent(personId)}`, canonicalDataIncomplete)
    nx03aErrorPaths.set(
      `/api/people/${encodeURIComponent(personId)}/terms/${encodeURIComponent(termId)}`,
      canonicalDataIncomplete
    )
    nx03aErrorPaths.set("/api/organizations", canonicalDataIncomplete)
    nx03aErrorPaths.set(`/api/organizations/${encodeURIComponent(organizationId)}`, canonicalDataIncomplete)
    missingFixturePrefix = `/api/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`
    try {
      const result = await runSmoke({
        LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID: membershipId,
        LEGISLATION_WEB_SMOKE_NX_03A: "1",
        LEGISLATION_WEB_SMOKE_ORGANIZATION_ID: organizationId,
        LEGISLATION_WEB_SMOKE_PERSON_ID: personId,
        LEGISLATION_WEB_SMOKE_TERM_ID: termId
      })

      expect(result.nx03a.passed).toEqual([
        "people",
        "person bills",
        "person amendments",
        "person votes",
        "person memberships",
        "organization members",
        "organization meetings",
        "organization bills",
        "organization calendars"
      ])
      expect(result.nx03a.skipped).toEqual([
        { name: "person", reason: "canonical_data_incomplete" },
        { name: "person term", reason: "canonical_data_incomplete" },
        { name: "organizations", reason: "canonical_data_incomplete" },
        { name: "organization", reason: "canonical_data_incomplete" },
        { name: "organization membership", reason: "fixture_missing" }
      ])
      const primary = requests.filter((request) => /^nx-03a-smoke-\d+$/.test(request.correlationId))
      const conditional = requests.filter((request) => /^nx-03a-smoke-conditional-\d+$/.test(request.correlationId))
      expect(primary).toHaveLength(14)
      expect(conditional).toHaveLength(9)
      expect(conditional.every((request) => request.ifNoneMatch === 'W/"fixture"')).toBe(true)
      const output = JSON.stringify(result)
      expect(output).not.toContain(personId)
      expect(output).not.toContain(termId)
      expect(output).not.toContain(organizationId)
      expect(output).not.toContain(membershipId)
      expect(output).not.toContain(privateMessage)
    } finally {
      nx03aErrorPaths.clear()
      missingFixturePrefix = undefined
    }
  })

  it("reports every unconfigured NX-03A fixture route as an explicit skip", async () => {
    requests.length = 0
    const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_03A: "1" })

    expect(result.nx03a.passed).toEqual(["people", "organizations"])
    expect(result.nx03a.skipped).toHaveLength(12)
    expect(result.nx03a.skipped).toEqual(
      expect.arrayContaining([
        { name: "person", reason: "fixture_not_configured:personId" },
        { name: "person term", reason: "fixture_not_configured:personId" },
        { name: "organization", reason: "fixture_not_configured:organizationId" },
        { name: "organization membership", reason: "fixture_not_configured:organizationId" }
      ])
    )
    expect(requests.some((request) => `${request.pathname}${request.search}`.includes("fixture"))).toBe(false)
  })

  it("rejects a canonical 404 for a configured person without exposing its identifier", async () => {
    const fixtureId = "person:private/with space"
    missingFixturePrefix = `/api/people/${encodeURIComponent(fixtureId)}`
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_NX_03A: "1", LEGISLATION_WEB_SMOKE_PERSON_ID: fixtureId })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET person returned status 404")
      expect(error.stderr).not.toContain(fixtureId)
      expect(error.stderr).not.toContain(encodeURIComponent(fixtureId))
    } finally {
      missingFixturePrefix = undefined
    }
  })

  it("fails malformed NX-03A envelopes without exposing the organization identifier", async () => {
    const fixtureId = "organization:do-not-emit"
    malformedPath = `/api/organizations/${encodeURIComponent(fixtureId)}`
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_NX_03A: "1",
          LEGISLATION_WEB_SMOKE_ORGANIZATION_ID: fixtureId
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET organization did not return an exact Resource envelope")
      expect(error.stderr).not.toContain(fixtureId)
      expect(error.stderr).not.toContain(encodeURIComponent(fixtureId))
    } finally {
      malformedPath = undefined
    }
  })

  it("rejects a malformed 422 on an approved NX-03A data-incomplete route", async () => {
    const personId = "person:private-malformed"
    const privateMessage = "Private production record is incomplete"
    nx03aErrorPaths.set(`/api/people/${encodeURIComponent(personId)}`, (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false },
      unexpected: true
    }))
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_NX_03A: "1", LEGISLATION_WEB_SMOKE_PERSON_ID: personId })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET person did not return a canonical data-incomplete ErrorResponse")
      expect(error.stderr).not.toContain(personId)
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      nx03aErrorPaths.clear()
    }
  })

  it("rejects an exact canonical 422 on an NX-03A route that must return a Page", async () => {
    const personId = "person:private-child"
    const privateMessage = "Private child collection is incomplete"
    nx03aErrorPaths.set(`/api/people/${encodeURIComponent(personId)}/bills`, (correlationId) => ({
      error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false }
    }))
    try {
      let error
      try {
        await runSmoke({ LEGISLATION_WEB_SMOKE_NX_03A: "1", LEGISLATION_WEB_SMOKE_PERSON_ID: personId })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET person bills returned status 422")
      expect(error.stderr).not.toContain(personId)
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      nx03aErrorPaths.clear()
    }
  })
})

describe("NX-03B deployed smoke profile", () => {
  it("cumulatively checks earlier profiles and all fourteen meeting, calendar, and representative routes", async () => {
    requests.length = 0
    nx03bNotFoundPaths.add("/api/meetings/meeting%3Afixture%2Fwith%20space")
    nx03bNotFoundPaths.add(
      "/api/meetings/agenda-meeting%3Afixture%2Fwith%20space/agenda/agenda-item%3Afixture%2Fwith%20space"
    )
    nx03bNotFoundPaths.add(
      "/api/meetings/outcome-meeting%3Afixture%2Fwith%20space/outcomes/outcome%3Afixture%2Fwith%20space"
    )
    nx03bNotFoundPaths.add("/api/calendars/calendar%3Afixture%2Fwith%20space")
    nx03bNotFoundPaths.add("/api/calendars/calendar%3Afixture%2Fwith%20space/meetings")
    try {
      const result = await runSmoke({
        LEGISLATION_WEB_SMOKE_AGENDA_ITEM_ID: "agenda-item:fixture/with space",
        LEGISLATION_WEB_SMOKE_AGENDA_MEETING_ID: "agenda-meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_AMENDMENT_ID: "amendment:fixture",
        LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture",
        LEGISLATION_WEB_SMOKE_CALENDAR_ID: "calendar:fixture/with space",
        LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
        LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID: "document-section:fixture",
        LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID: "event-document:fixture/with space",
        LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID: "event-document-meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_MEETING_DETAIL_ID: "meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID: "membership:fixture",
        LEGISLATION_WEB_SMOKE_NX_03B: "1",
        LEGISLATION_WEB_SMOKE_ORGANIZATION_ID: "organization:fixture",
        LEGISLATION_WEB_SMOKE_OUTCOME_ID: "outcome:fixture/with space",
        LEGISLATION_WEB_SMOKE_OUTCOME_MEETING_ID: "outcome-meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_PARTICIPANT_ID: "participant:fixture/with space",
        LEGISLATION_WEB_SMOKE_PARTICIPANT_DETAIL_MEETING_ID: "participant-detail-meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_PARTICIPANT_LIST_MEETING_ID: "participant-list-meeting:fixture/with space",
        LEGISLATION_WEB_SMOKE_PERSON_ID: "person:fixture",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE: "38.5816",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE: "-121.4944",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME: "200",
        LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture",
        LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID: "supporting-material-section:fixture",
        LEGISLATION_WEB_SMOKE_TERM_ID: "term:fixture",
        LEGISLATION_WEB_SMOKE_VOTE_ID: "vote:fixture"
      })

      expect(result.profile).toBe("foundation+nx-02a+nx-02b+nx-02c+nx-03a+nx-03b")
      expect(result.nx02a.passed).toHaveLength(11)
      expect(result.nx02b.passed).toHaveLength(18)
      expect(result.nx02c.passed).toHaveLength(9)
      expect(result.nx03a.passed).toHaveLength(14)
      expect(result.nx03b.passed).toHaveLength(9)
      expect(result.nx03b.skipped).toEqual([
        { name: "meeting", reason: "canonical_fixture_not_found" },
        { name: "meeting agenda item", reason: "canonical_fixture_not_found" },
        { name: "meeting outcome", reason: "canonical_fixture_not_found" },
        { name: "calendar", reason: "canonical_fixture_not_found" },
        { name: "calendar meetings", reason: "canonical_fixture_not_found" }
      ])
      expect(result.nx03b.notFound).toEqual([
        "meetings_trailing_slash",
        "calendars_trailing_slash",
        "representative_lookups_trailing_slash"
      ])

      const nx03b = requests.filter((request) => /^nx-03b-smoke-\d+$/.test(request.correlationId))
      const conditional = requests.filter((request) => /^nx-03b-smoke-conditional-\d+$/.test(request.correlationId))
      expect(nx03b).toHaveLength(14)
      expect(nx03b.map(requestSignature).sort()).toEqual(
        [
          "GET /api/meetings?limit=1",
          "GET /api/meetings/meeting%3Afixture%2Fwith%20space",
          "GET /api/meetings/agenda-meeting%3Afixture%2Fwith%20space/agenda?limit=1",
          "GET /api/meetings/agenda-meeting%3Afixture%2Fwith%20space/agenda/agenda-item%3Afixture%2Fwith%20space",
          "GET /api/meetings/event-document-meeting%3Afixture%2Fwith%20space/documents?limit=1",
          "GET /api/meetings/event-document-meeting%3Afixture%2Fwith%20space/documents/event-document%3Afixture%2Fwith%20space",
          "GET /api/meetings/outcome-meeting%3Afixture%2Fwith%20space/outcomes?limit=1",
          "GET /api/meetings/outcome-meeting%3Afixture%2Fwith%20space/outcomes/outcome%3Afixture%2Fwith%20space",
          "GET /api/meetings/participant-list-meeting%3Afixture%2Fwith%20space/participants?limit=1",
          "GET /api/meetings/participant-detail-meeting%3Afixture%2Fwith%20space/participants/participant%3Afixture%2Fwith%20space",
          "GET /api/calendars?limit=1",
          "GET /api/calendars/calendar%3Afixture%2Fwith%20space",
          "GET /api/calendars/calendar%3Afixture%2Fwith%20space/meetings?limit=1",
          "POST /api/representative-lookups"
        ].sort()
      )
      expect(conditional).toHaveLength(8)
      expect(conditional.every((request) => request.ifNoneMatch === 'W/"fixture"')).toBe(true)
      expect(nx03b.find((request) => request.pathname === "/api/representative-lookups")?.body).toEqual({
        coordinates: { latitude: 38.5816, longitude: -121.4944 }
      })
    } finally {
      nx03bNotFoundPaths.clear()
    }
  })

  it("reports each missing audited NX-03B fixture as a named skip without requesting it", async () => {
    requests.length = 0
    const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_03B: "1" })

    expect(result.nx03b.passed).toEqual(["meetings", "calendars"])
    expect(result.nx03b.skipped).toEqual(
      expect.arrayContaining([
        { name: "meeting", reason: "fixture_not_configured:meetingDetailId" },
        { name: "meeting agenda item", reason: "fixture_not_configured:agendaMeetingId" },
        { name: "calendar", reason: "fixture_not_configured:calendarId" },
        { name: "representative lookup", reason: "fixture_not_configured:representativeCoordinates" }
      ])
    )
    expect(requests.some((request) => `${request.pathname}${request.search}`.includes("fixture"))).toBe(false)
  })

  it("rejects a malformed NX-03B Resource envelope without exposing its fixture identifier", async () => {
    const meetingId = "meeting:do-not-emit"
    const documentId = "event-document:do-not-emit"
    malformedPath = `/api/meetings/${encodeURIComponent(meetingId)}/documents/${encodeURIComponent(documentId)}`
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID: documentId,
          LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID: meetingId,
          LEGISLATION_WEB_SMOKE_NX_03B: "1"
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET meeting document did not return an exact Resource envelope")
      expect(error.stderr).not.toContain(meetingId)
      expect(error.stderr).not.toContain(encodeURIComponent(meetingId))
      expect(error.stderr).not.toContain(documentId)
    } finally {
      malformedPath = undefined
    }
  })

  it("rejects an unapproved NX-03B canonical data-incomplete response without exposing its message", async () => {
    const meetingId = "meeting:private-incomplete"
    const documentId = "event-document:private-incomplete"
    const privateMessage = "Meeting document has incomplete private production facts"
    nx03bErrorPaths.set(
      `/api/meetings/${encodeURIComponent(meetingId)}/documents/${encodeURIComponent(documentId)}`,
      (correlationId) => ({
        error: { category: "unprocessable", correlationId, message: privateMessage, retryable: false }
      })
    )
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID: documentId,
          LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID: meetingId,
          LEGISLATION_WEB_SMOKE_NX_03B: "1"
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("GET meeting document returned status 422")
      expect(error.stderr).not.toContain(meetingId)
      expect(error.stderr).not.toContain(documentId)
      expect(error.stderr).not.toContain(privateMessage)
    } finally {
      nx03bErrorPaths.clear()
    }
  })

  it("rejects a malformed representative lookup Resource envelope without exposing request coordinates", async () => {
    malformedPath = "/api/representative-lookups"
    try {
      let error
      try {
        await runSmoke({
          LEGISLATION_WEB_SMOKE_NX_03B: "1",
          LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE: "38.5816",
          LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE: "-121.4944",
          LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME: "200"
        })
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("POST representative lookup did not return an exact Resource envelope")
      expect(error.stderr).not.toContain("38.5816")
      expect(error.stderr).not.toContain("-121.4944")
    } finally {
      malformedPath = undefined
    }
  })

  it("accepts only the audited dependency-unavailable representative outcome with its retry contract", async () => {
    representativeUnavailable = true
    try {
      const result = await runSmoke({
        LEGISLATION_WEB_SMOKE_NX_03B: "1",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME: "dependency_unavailable",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE: "38.5816",
        LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE: "-121.4944"
      })
      expect(result.nx03b.skipped).toContainEqual({ name: "representative lookup", reason: "dependency_unavailable" })
      expect(JSON.stringify(result)).not.toContain("38.5816")
      expect(JSON.stringify(result)).not.toContain("-121.4944")
    } finally {
      representativeUnavailable = false
    }
  })
})

function nx04Environment(overrides = {}) {
  return {
    LEGISLATION_WEB_SMOKE_AGENDA_ITEM_ID: "agenda-item:fixture",
    LEGISLATION_WEB_SMOKE_AGENDA_MEETING_ID: "agenda-meeting:fixture",
    LEGISLATION_WEB_SMOKE_AMENDMENT_ID: "amendment:fixture",
    LEGISLATION_WEB_SMOKE_BILL_ID: "bill:fixture",
    LEGISLATION_WEB_SMOKE_CALENDAR_ID: "calendar:fixture",
    LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_BILL_ID: "bill:diff fixture",
    LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_LEFT_DOCUMENT_ID: "document:left fixture",
    LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_RIGHT_DOCUMENT_ID: "document:right fixture",
    LEGISLATION_WEB_SMOKE_DOCUMENT_ID: "document:fixture",
    LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID: "document-section:fixture",
    LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID: "event-document:fixture",
    LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID: "event-document-meeting:fixture",
    LEGISLATION_WEB_SMOKE_MEETING_DETAIL_ID: "meeting:fixture",
    LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID: "membership:fixture",
    LEGISLATION_WEB_SMOKE_NX_04: "1",
    LEGISLATION_WEB_SMOKE_ORGANIZATION_ID: "organization:fixture",
    LEGISLATION_WEB_SMOKE_OUTCOME_ID: "outcome:fixture",
    LEGISLATION_WEB_SMOKE_OUTCOME_MEETING_ID: "outcome-meeting:fixture",
    LEGISLATION_WEB_SMOKE_PARTICIPANT_ID: "participant:fixture",
    LEGISLATION_WEB_SMOKE_PARTICIPANT_DETAIL_MEETING_ID: "participant-detail-meeting:fixture",
    LEGISLATION_WEB_SMOKE_PARTICIPANT_LIST_MEETING_ID: "participant-list-meeting:fixture",
    LEGISLATION_WEB_SMOKE_PERSON_ID: "person:fixture",
    LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE: "38.5816",
    LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE: "-121.4944",
    LEGISLATION_WEB_SMOKE_RESEARCH_BILL_ID: "bill:research fixture",
    LEGISLATION_WEB_SMOKE_RESEARCH_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_RESEARCH_QUESTION: "What does the private research fixture require?",
    LEGISLATION_WEB_SMOKE_SEARCH_ALL_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_SEARCH_ALL_QUERY: "private universal fixture query",
    LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_QUERY: "private amendment fixture query",
    LEGISLATION_WEB_SMOKE_SEARCH_BILLS_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_SEARCH_BILLS_QUERY: "private bill fixture query",
    LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_QUERY: "private passage fixture query",
    LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_EXPECTED_OUTCOME: "200",
    LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_QUERY: "private material fixture query",
    LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID: "supporting-material:fixture",
    LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID: "supporting-material-section:fixture",
    LEGISLATION_WEB_SMOKE_TERM_ID: "term:fixture",
    LEGISLATION_WEB_SMOKE_VOTE_ID: "vote:fixture",
    ...overrides
  }
}

function addNx03bNotFoundFixtures() {
  nx03bNotFoundPaths.add("/api/meetings/meeting%3Afixture")
  nx03bNotFoundPaths.add("/api/meetings/agenda-meeting%3Afixture/agenda/agenda-item%3Afixture")
  nx03bNotFoundPaths.add("/api/meetings/outcome-meeting%3Afixture/outcomes/outcome%3Afixture")
  nx03bNotFoundPaths.add("/api/calendars/calendar%3Afixture")
  nx03bNotFoundPaths.add("/api/calendars/calendar%3Afixture/meetings")
}

describe("NX-04 deployed smoke profile", () => {
  it("cumulatively checks earlier profiles and exactly seven configured NX-04 POST operations", async () => {
    requests.length = 0
    addNx03bNotFoundFixtures()
    let result
    try {
      result = await runSmoke(nx04Environment())
    } finally {
      nx03bNotFoundPaths.clear()
    }

    expect(result.profile).toBe("foundation+nx-02a+nx-02b+nx-02c+nx-03a+nx-03b+nx-04")
    expect(result.nx02a.passed).toHaveLength(11)
    expect(result.nx02b.passed).toHaveLength(18)
    expect(result.nx02c.passed).toHaveLength(9)
    expect(result.nx03a.passed).toHaveLength(14)
    expect(result.nx03b.passed).toHaveLength(9)
    expect(result.nx04.passed).toEqual([
      "bill search",
      "amendment search",
      "passage search",
      "supporting-material search",
      "universal search",
      "document diff",
      "research answer"
    ])
    expect(result.nx04.skipped).toEqual([])

    const nx04 = requests.filter((request) => /^nx-04-smoke-\d+$/.test(request.correlationId))
    expect(nx04).toHaveLength(7)
    expect(nx04.map(requestSignature).sort()).toEqual(
      [
        "POST /api/search/bills",
        "POST /api/search/amendments",
        "POST /api/search/passages",
        "POST /api/search/supporting-materials",
        "POST /api/search/all",
        "POST /api/document-diffs",
        "POST /api/research/answers"
      ].sort()
    )
    expect(nx04.every((request) => request.body !== undefined)).toBe(true)
    expect(JSON.stringify(result)).not.toContain("private")
    expect(JSON.stringify(result)).not.toContain("fixture query")
  })

  it("reports every unconfigured NX-04 input as a named skip without requesting it", async () => {
    requests.length = 0
    const result = await runSmoke({ LEGISLATION_WEB_SMOKE_NX_04: "1" })

    expect(result.nx04.passed).toEqual([])
    expect(result.nx04.skipped).toEqual(
      expect.arrayContaining([
        { name: "bill search", reason: "fixture_not_configured:billQuery" },
        { name: "document diff", reason: "fixture_not_configured:diffBillId" },
        { name: "research answer", reason: "fixture_not_configured:researchBillId" }
      ])
    )
    expect(requests.some((request) => /^nx-04-smoke-\d+$/.test(request.correlationId))).toBe(false)
  })

  it("rejects malformed SearchPage responses without leaking its search query", async () => {
    const query = "private search query must not escape"
    malformedNx04Path = "/api/search/bills"
    addNx03bNotFoundFixtures()
    try {
      let error
      try {
        await runSmoke(
          nx04Environment({
            LEGISLATION_WEB_SMOKE_SEARCH_BILLS_QUERY: query
          })
        )
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ stderr: expect.any(String) })
      expect(error.stderr).toContain("POST bill search did not return an exact SearchPage envelope")
      expect(error.stderr).not.toContain(query)
    } finally {
      malformedNx04Path = undefined
      nx03bNotFoundPaths.clear()
    }
  })

  it("accepts only typed NX-04 dependency and data-incomplete outcomes without leaking request inputs", async () => {
    const privateQuestion = "Do not emit this private research prompt"
    const privateDocumentId = "document:private diff input"
    nx04ErrorPaths.set("/api/search/amendments", (correlationId) => ({
      error: {
        category: "dependency_unavailable",
        correlationId,
        message: "Private model prompt or key unavailable",
        retryable: true
      }
    }))
    nx04ErrorPaths.set("/api/document-diffs", (correlationId) => ({
      error: {
        category: "unprocessable",
        correlationId,
        message: "Private document processing is incomplete",
        retryable: false
      }
    }))
    nx04ErrorPaths.set("/api/search/passages", (correlationId) => ({
      error: {
        category: "unprocessable",
        correlationId,
        message: "Private canonical OCR facts are incomplete",
        retryable: false
      }
    }))
    addNx03bNotFoundFixtures()
    try {
      const result = await runSmoke(
        nx04Environment({
          LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_EXPECTED_OUTCOME: "unprocessable",
          LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_LEFT_DOCUMENT_ID: privateDocumentId,
          LEGISLATION_WEB_SMOKE_RESEARCH_QUESTION: privateQuestion,
          LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_EXPECTED_OUTCOME: "dependency_unavailable",
          LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_EXPECTED_OUTCOME: "unprocessable"
        })
      )
      expect(result.nx04.skipped).toEqual(
        expect.arrayContaining([
          { name: "amendment search", reason: "dependency_unavailable" },
          { name: "document diff", reason: "canonical_data_incomplete" },
          { name: "passage search", reason: "canonical_data_incomplete" }
        ])
      )
      expect(JSON.stringify(result)).not.toContain(privateQuestion)
      expect(JSON.stringify(result)).not.toContain(privateDocumentId)
    } finally {
      nx04ErrorPaths.clear()
      nx03bNotFoundPaths.clear()
    }
  })
})
