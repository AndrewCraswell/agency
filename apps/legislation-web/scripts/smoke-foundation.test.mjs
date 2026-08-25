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

function batch(pathname, correlationId, requestBody) {
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
    apiJson(
      response,
      correlationId,
      isNx02aResource || isNx02bResource ? resource(url.pathname, correlationId, id) : page(url.pathname, correlationId)
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
