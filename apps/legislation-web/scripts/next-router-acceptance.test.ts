import { spawn, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), "..")
const packageRequire = createRequire(join(packageDirectory, "package.json"))
const buildTimeoutMs = 120_000
const maximumBatchBytes = 5 * 1024 * 1024
const requestTimeoutMs = 10_000
const shutdownTimeoutMs = 10_000
const startupTimeoutMs = 30_000

const batchRoutes = [
  { name: "bills", pathname: "/api/bills/batch" },
  { name: "amendments", pathname: "/api/amendments/batch" },
  { name: "votes", pathname: "/api/votes/batch" }
] as const

type Nx02cRoute = Readonly<{
  body?: string
  method: "GET" | "POST"
  name: string
  pathname: string
  probe?: string
}>

const nx02cRoutes: readonly Nx02cRoute[] = [
  {
    method: "GET",
    name: "document detail",
    pathname: "/api/documents/document%3Arouter",
    probe: "?unexpected=1"
  },
  {
    method: "GET",
    name: "document sections",
    pathname: "/api/documents/document%3Arouter/sections",
    probe: "?limit=0"
  },
  {
    method: "GET",
    name: "document section detail",
    pathname: "/api/documents/document%3Arouter/sections/section%3Arouter",
    probe: "?unexpected=1"
  },
  {
    method: "GET",
    name: "supporting-material collection",
    pathname: "/api/supporting-materials",
    probe: "?limit=0"
  },
  {
    method: "GET",
    name: "supporting-material detail",
    pathname: "/api/supporting-materials/supporting-material%3Arouter",
    probe: "?unexpected=1"
  },
  {
    method: "GET",
    name: "supporting-material sections",
    pathname: "/api/supporting-materials/supporting-material%3Arouter/sections",
    probe: "?limit=0"
  },
  {
    method: "GET",
    name: "supporting-material section detail",
    pathname: "/api/supporting-materials/supporting-material%3Arouter/sections/section%3Arouter",
    probe: "?unexpected=1"
  },
  { method: "GET", name: "global changes", pathname: "/api/changes", probe: "?limit=0" },
  {
    body: JSON.stringify({ items: [] }),
    method: "POST",
    name: "resource batch",
    pathname: "/api/resources/batch"
  }
]

const unsupportedReadMethods = ["DELETE", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const
const unsupportedResourceBatchMethods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "PUT"] as const
const unsupportedPostMethods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "PUT"] as const

type Nx03aRoute = Readonly<{
  name: string
  pathname: string
  probe: string
}>

const personId = "person%3Arouter"
const organizationId = "organization%3Arouter"

const nx03aRoutes: readonly Nx03aRoute[] = [
  { name: "people collection", pathname: "/api/people", probe: "?limit=0" },
  { name: "person detail", pathname: `/api/people/${personId}`, probe: "?unexpected=1" },
  { name: "person bills", pathname: `/api/people/${personId}/bills`, probe: "?limit=0" },
  { name: "person amendments", pathname: `/api/people/${personId}/amendments`, probe: "?limit=0" },
  { name: "person votes", pathname: `/api/people/${personId}/votes`, probe: "?limit=0" },
  { name: "person memberships", pathname: `/api/people/${personId}/memberships`, probe: "?limit=0" },
  { name: "person term", pathname: `/api/people/${personId}/terms/term%3Arouter`, probe: "?unexpected=1" },
  { name: "organizations collection", pathname: "/api/organizations", probe: "?limit=0" },
  { name: "organization detail", pathname: `/api/organizations/${organizationId}`, probe: "?unexpected=1" },
  { name: "organization members", pathname: `/api/organizations/${organizationId}/members`, probe: "?limit=0" },
  {
    name: "organization membership",
    pathname: `/api/organizations/${organizationId}/memberships/membership%3Arouter`,
    probe: "?unexpected=1"
  },
  { name: "organization meetings", pathname: `/api/organizations/${organizationId}/meetings`, probe: "?limit=0" },
  { name: "organization bills", pathname: `/api/organizations/${organizationId}/bills`, probe: "?limit=0" },
  { name: "organization calendars", pathname: `/api/organizations/${organizationId}/calendars`, probe: "?limit=0" }
]

type Nx03bRoute = Readonly<{
  body?: string
  method: "GET" | "POST"
  name: string
  pathname: string
  probe?: string
}>

const meetingId = "meeting%3Arouter"
const nx03bRoutes: readonly Nx03bRoute[] = [
  { method: "GET", name: "meeting collection", pathname: "/api/meetings", probe: "?limit=0" },
  { method: "GET", name: "meeting detail", pathname: `/api/meetings/${meetingId}`, probe: "?unexpected=1" },
  { method: "GET", name: "meeting agenda", pathname: `/api/meetings/${meetingId}/agenda`, probe: "?limit=0" },
  {
    method: "GET",
    name: "meeting agenda item",
    pathname: `/api/meetings/${meetingId}/agenda/agenda%3Arouter`,
    probe: "?unexpected=1"
  },
  { method: "GET", name: "meeting documents", pathname: `/api/meetings/${meetingId}/documents`, probe: "?limit=0" },
  {
    method: "GET",
    name: "meeting event document",
    pathname: `/api/meetings/${meetingId}/documents/document%3Arouter`,
    probe: "?unexpected=1"
  },
  { method: "GET", name: "meeting outcomes", pathname: `/api/meetings/${meetingId}/outcomes`, probe: "?limit=0" },
  {
    method: "GET",
    name: "meeting outcome",
    pathname: `/api/meetings/${meetingId}/outcomes/outcome%3Arouter`,
    probe: "?unexpected=1"
  },
  {
    method: "GET",
    name: "meeting participants",
    pathname: `/api/meetings/${meetingId}/participants`,
    probe: "?limit=0"
  },
  {
    method: "GET",
    name: "meeting participant",
    pathname: `/api/meetings/${meetingId}/participants/person%3Arouter`,
    probe: "?unexpected=1"
  },
  { method: "GET", name: "calendar collection", pathname: "/api/calendars", probe: "?limit=0" },
  { method: "GET", name: "calendar detail", pathname: "/api/calendars/calendar%3Arouter", probe: "?unexpected=1" },
  {
    method: "GET",
    name: "calendar meetings",
    pathname: "/api/calendars/calendar%3Arouter/meetings",
    probe: "?limit=0"
  },
  {
    body: JSON.stringify({}),
    method: "POST",
    name: "representative lookup",
    pathname: "/api/representative-lookups"
  }
]

type Nx04Route = Readonly<{
  encodedPath: string
  name: string
  pathname: string
}>

const nx04Routes: readonly Nx04Route[] = [
  { encodedPath: "/api/%64ocument-diffs", name: "document diffs", pathname: "/api/document-diffs" },
  { encodedPath: "/api/research/%61nswers", name: "research answers", pathname: "/api/research/answers" },
  { encodedPath: "/api/search/%62ills", name: "bill search", pathname: "/api/search/bills" },
  { encodedPath: "/api/search/%61mendments", name: "amendment search", pathname: "/api/search/amendments" },
  { encodedPath: "/api/search/%70assages", name: "passage search", pathname: "/api/search/passages" },
  {
    encodedPath: "/api/search/%73upporting-materials",
    name: "supporting-material search",
    pathname: "/api/search/supporting-materials"
  },
  { encodedPath: "/api/search/%61ll", name: "universal search", pathname: "/api/search/all" }
]

let baseUrl = ""
let nextServer: ChildProcess | undefined
let nextServerDiagnostics: () => string = () => "Next server did not start."

beforeAll(async () => {
  const port = await reservePort()
  baseUrl = `http://127.0.0.1:${port}`
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    LEGISLATION_IDEMPOTENCY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    LEGISLATION_PUBLIC_API_BASE_URL: baseUrl,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production"
  }

  await runNext(["build"], environment, buildTimeoutMs)
  const server = spawn(
    process.execPath,
    ["scripts/next.mjs", "start", "--hostname", "127.0.0.1", "--port", `${port}`],
    {
      cwd: packageDirectory,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"]
    }
  )
  nextServer = server
  nextServerDiagnostics = captureDiagnostics(server)
  await waitForReady()
}, buildTimeoutMs + startupTimeoutMs)

afterAll(async () => {
  if (nextServer === undefined || nextServer.exitCode !== null) {
    return
  }
  nextServer.kill("SIGTERM")
  await Promise.race([
    new Promise<void>((resolve) => nextServer?.once("exit", () => resolve())),
    delay(shutdownTimeoutMs)
  ])
  if (nextServer.exitCode === null) {
    nextServer.kill("SIGKILL")
  }
})

describe.sequential("NX-02B, NX-02C, NX-03A, and NX-03B Next router acceptance", () => {
  it("resolves Next 16.3.1 from the legislation-web package and boots that resolved CLI", () => {
    const nextPackage = packageRequire("next/package.json") as Readonly<{ version: string }>
    const nextCliPath = packageRequire.resolve("next/dist/bin/next")

    expect(nextPackage.version).toBe("16.3.1")
    expect(nextCliPath).toContain("node_modules")
    expect(nextCliPath).toContain("next")
  })

  it.each(batchRoutes)(
    "routes the documented POST /batch handler before the dynamic %s route",
    async ({ pathname }) => {
      expect.hasAssertions()
      const response = await request(pathname, {
        body: JSON.stringify({ ids: [] }),
        headers: { "content-type": "application/json", "x-correlation-id": "router-static-batch" },
        method: "POST"
      })

      await expectInvalidRequest(response, "router-static-batch")
    }
  )

  it.each(batchRoutes)("keeps the unsupported GET /batch method at the static route for %s", async ({ pathname }) => {
    expect.hasAssertions()
    const response = await request(pathname, {
      headers: { "x-correlation-id": "router-static-unsupported" },
      method: "GET"
    })

    await expectCanonicalNotFound(response, "router-static-unsupported")
  })

  it.each(batchRoutes)(
    "rejects an encoded static batch segment without treating it as a dynamic ID for %s",
    async ({ pathname }) => {
      expect.hasAssertions()
      const response = await request(pathname.replace("batch", "%62atch"), {
        headers: { "x-correlation-id": "router-encoded-static" },
        method: "GET"
      })

      await expectCanonicalNotFound(response, "router-encoded-static")
    }
  )

  it.each(batchRoutes)(
    "returns a canonical JSON 404 without redirecting a trailing slash for %s",
    async ({ pathname }) => {
      expect.hasAssertions()
      const response = await request(`${pathname}/`, {
        body: JSON.stringify({ ids: [] }),
        headers: { "content-type": "application/json", "x-correlation-id": "router-trailing-slash" },
        method: "POST"
      })

      expect(response.headers.get("location")).toBeNull()
      await expectCanonicalNotFound(response, "router-trailing-slash")
    }
  )

  it.each([maximumBatchBytes - 1, maximumBatchBytes])(
    "passes the %i-byte documented batch body into request validation",
    async (byteLength) => {
      expect.hasAssertions()
      const body = batchBody(byteLength)
      expect(Buffer.byteLength(body)).toBe(byteLength)
      const response = await request("/api/bills/batch", {
        body,
        headers: { "content-type": "application/json", "x-correlation-id": "router-batch-boundary" },
        method: "POST"
      })

      await expectInvalidRequest(response, "router-batch-boundary")
    },
    requestTimeoutMs + 5_000
  )

  it(
    "rejects a 5 MiB plus one batch body with 413 and leaves the server able to read the next request",
    async () => {
      expect.hasAssertions()
      const body = batchBody(maximumBatchBytes + 1)
      expect(Buffer.byteLength(body)).toBe(maximumBatchBytes + 1)
      const response = await request("/api/bills/batch", {
        body,
        headers: { "content-type": "application/json", "x-correlation-id": "router-batch-too-large" },
        method: "POST"
      })

      await expectPayloadTooLarge(response, "router-batch-too-large")

      const followUp = await request("/api/bills/batch", {
        body: JSON.stringify({ ids: [] }),
        headers: { "content-type": "application/json", "x-correlation-id": "router-batch-follow-up" },
        method: "POST"
      })
      await expectInvalidRequest(followUp, "router-batch-follow-up")
    },
    requestTimeoutMs + 5_000
  )

  it.each(nx02cRoutes)("routes the documented NX-02C %s path through its built handler", async (route) => {
    expect.hasAssertions()
    const correlationId = `router-nx02c-${route.name}`
    const response = await request(`${route.pathname}${route.probe ?? ""}`, {
      ...(route.body === undefined ? {} : { body: route.body, headers: { "content-type": "application/json" } }),
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method: route.method
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each(nx02cRoutes)("keeps all unsupported methods on the built NX-02C %s route", async (route) => {
    expect.hasAssertions()
    const unsupportedMethods = route.method === "GET" ? unsupportedReadMethods : unsupportedResourceBatchMethods
    for (const method of unsupportedMethods) {
      const correlationId = `router-nx02c-${route.name}-${method.toLowerCase()}`
      const response = await request(route.pathname, {
        headers: { "x-correlation-id": correlationId },
        method
      })

      await expectCanonicalNotFound(response, correlationId, method === "HEAD")
    }
  })

  it.each(nx02cRoutes)(
    "returns a canonical JSON 404 without redirecting a true trailing slash for NX-02C %s",
    async (route) => {
      expect.hasAssertions()
      const correlationId = `router-nx02c-trailing-${route.name}`
      const response = await request(`${route.pathname}/`, {
        ...(route.body === undefined ? {} : { body: route.body, headers: { "content-type": "application/json" } }),
        headers: {
          ...(route.body === undefined ? {} : { "content-type": "application/json" }),
          "x-correlation-id": correlationId
        },
        method: route.method
      })

      expect(response.headers.get("location")).toBeNull()
      await expectCanonicalNotFound(response, correlationId)
    }
  )

  it.each([
    "/api/documents/document%3Arouter/sections?limit=0",
    "/api/supporting-materials/supporting-material%3Arouter/sections?limit=0"
  ])("routes the nested static sections path before a dynamic parent for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx02c-static-sections"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each([
    "/api/documents/document%3Arouter?unexpected=1",
    "/api/documents/document%3Arouter/sections/section%3Arouter?unexpected=1",
    "/api/supporting-materials/supporting-material%3Arouter?unexpected=1",
    "/api/supporting-materials/supporting-material%3Arouter/sections/section%3Arouter?unexpected=1",
    "/api/documents/%ZZ?unexpected=1",
    "/api/supporting-materials/%ZZ?unexpected=1",
    "/api/documents/%C0%AF?unexpected=1"
  ])("preserves encoded IDs and reports malformed IDs through the NX-02C boundary for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx02c-path-encoding"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it("routes the static resources batch endpoint before the API catch-all", async () => {
    expect.hasAssertions()
    const correlationId = "router-nx02c-resources-static"
    const response = await request("/api/resources/batch", {
      body: JSON.stringify({ items: [] }),
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      method: "POST"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it("does not treat an encoded static resources batch segment as the documented endpoint", async () => {
    expect.hasAssertions()
    const correlationId = "router-nx02c-resources-encoded-static"
    const response = await request("/api/resources/%62atch", {
      headers: { "x-correlation-id": correlationId },
      method: "POST"
    })

    await expectCanonicalNotFound(response, correlationId)
  })

  it.each([maximumBatchBytes - 1, maximumBatchBytes])(
    "passes the %i-byte resource batch body into NX-02C request validation",
    async (byteLength) => {
      expect.hasAssertions()
      const body = batchBody(byteLength)
      expect(Buffer.byteLength(body)).toBe(byteLength)
      const response = await request("/api/resources/batch", {
        body,
        headers: { "content-type": "application/json", "x-correlation-id": "router-resources-batch-boundary" },
        method: "POST"
      })

      await expectInvalidRequest(response, "router-resources-batch-boundary")
    },
    requestTimeoutMs + 5_000
  )

  it(
    "rejects a 5 MiB plus one resource batch body with 413 and leaves the server able to read the next request",
    async () => {
      expect.hasAssertions()
      const body = batchBody(maximumBatchBytes + 1)
      expect(Buffer.byteLength(body)).toBe(maximumBatchBytes + 1)
      const response = await request("/api/resources/batch", {
        body,
        headers: { "content-type": "application/json", "x-correlation-id": "router-resources-batch-too-large" },
        method: "POST"
      })

      await expectPayloadTooLarge(response, "router-resources-batch-too-large")

      const followUp = await request("/api/resources/batch", {
        body: JSON.stringify({ items: [] }),
        headers: { "content-type": "application/json", "x-correlation-id": "router-resources-batch-follow-up" },
        method: "POST"
      })
      await expectInvalidRequest(followUp, "router-resources-batch-follow-up")
    },
    requestTimeoutMs + 5_000
  )

  it.each(nx03aRoutes)("routes the encoded NX-03A %s path and forwards its query string", async (route) => {
    expect.hasAssertions()
    const correlationId = `router-nx03a-${route.name}`
    const response = await request(`${route.pathname}${route.probe}`, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each(nx03aRoutes)("keeps all unsupported methods on the built NX-03A %s route", async (route) => {
    expect.hasAssertions()
    for (const method of unsupportedReadMethods) {
      const correlationId = `router-nx03a-${route.name}-${method.toLowerCase()}`
      const response = await request(route.pathname, {
        headers: { "x-correlation-id": correlationId },
        method
      })

      await expectCanonicalNotFound(response, correlationId, method === "HEAD")
    }
  })

  it.each(nx03aRoutes)(
    "returns a canonical JSON 404 without redirecting a literal trailing slash for NX-03A %s",
    async (route) => {
      expect.hasAssertions()
      const correlationId = `router-nx03a-trailing-${route.name}`
      const response = await request(`${route.pathname}/`, {
        headers: { "x-correlation-id": correlationId },
        method: "GET"
      })

      expect(response.headers.get("location")).toBeNull()
      await expectCanonicalNotFound(response, correlationId)
    }
  )

  it.each([
    `/api/people/${personId}/%62ills`,
    `/api/people/${personId}/%61mendments`,
    `/api/people/${personId}/%76otes`,
    `/api/people/${personId}/%6Demberships`,
    `/api/people/${personId}/%74erms/term%3Arouter`,
    `/api/organizations/${organizationId}/%6Dembers`,
    `/api/organizations/${organizationId}/%6Demberships/membership%3Arouter`,
    `/api/organizations/${organizationId}/%6Deetings`,
    `/api/organizations/${organizationId}/%62ills`,
    `/api/organizations/${organizationId}/%63alendars`
  ])("does not decode an encoded NX-03A static child segment before router precedence for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx03a-encoded-static-child"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectCanonicalNotFound(response, correlationId)
  })

  it.each([
    `/api/people/${personId}/terms/term%3Arouter?unexpected=1`,
    `/api/organizations/${organizationId}/memberships/membership%3Arouter?unexpected=1`
  ])("routes NX-03A nested term and membership paths before the API catch-all for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx03a-nested-static"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it("rejects malformed NX-03A path encodings at the proxy and keeps the built server usable", async () => {
    expect.hasAssertions()
    const malformed = await request(`/api/people/${personId}/terms/%ZZ`, {
      headers: { "x-correlation-id": "router-nx03a-malformed" },
      method: "GET"
    })
    await expectInvalidRequest(malformed, "router-nx03a-malformed")

    const invalidUtf8 = await request(`/api/organizations/${organizationId}/memberships/%C0%AF`, {
      headers: { "x-correlation-id": "router-nx03a-malformed-utf8" },
      method: "GET"
    })
    await expectInvalidRequest(invalidUtf8, "router-nx03a-malformed-utf8")

    const followUp = await request("/api/people?limit=0", {
      headers: { "x-correlation-id": "router-nx03a-malformed-follow-up" },
      method: "GET"
    })
    await expectInvalidRequest(followUp, "router-nx03a-malformed-follow-up")
  })

  it.each(nx03bRoutes)("routes the encoded NX-03B %s path through its built handler", async (route) => {
    expect.hasAssertions()
    const correlationId = `router-nx03b-${route.name}`
    const headers: Record<string, string> = { "x-correlation-id": correlationId }
    if (route.body !== undefined) {
      headers["content-type"] = "application/json"
    }
    const response = await request(`${route.pathname}${route.probe ?? ""}`, {
      ...(route.body === undefined ? {} : { body: route.body }),
      headers,
      method: route.method
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each(nx03bRoutes)("keeps all unsupported methods on the built NX-03B %s route", async (route) => {
    expect.hasAssertions()
    const unsupportedMethods = route.method === "GET" ? unsupportedReadMethods : unsupportedResourceBatchMethods
    for (const method of unsupportedMethods) {
      const correlationId = `router-nx03b-${route.name}-${method.toLowerCase()}`
      const response = await request(route.pathname, {
        headers: { "x-correlation-id": correlationId },
        method
      })

      await expectCanonicalNotFound(response, correlationId, method === "HEAD")
    }
  })

  it.each(nx03bRoutes)(
    "returns a canonical JSON 404 without redirecting a literal trailing slash for NX-03B %s",
    async (route) => {
      expect.hasAssertions()
      const correlationId = `router-nx03b-trailing-${route.name}`
      const headers: Record<string, string> = { "x-correlation-id": correlationId }
      if (route.body !== undefined) {
        headers["content-type"] = "application/json"
      }
      const response = await request(`${route.pathname}/`, {
        ...(route.body === undefined ? {} : { body: route.body }),
        headers,
        method: route.method
      })

      expect(response.headers.get("location")).toBeNull()
      await expectCanonicalNotFound(response, correlationId)
    }
  )

  it.each([
    `/api/meetings/${meetingId}/%61genda?limit=0`,
    `/api/meetings/${meetingId}/%64ocuments?limit=0`,
    `/api/meetings/${meetingId}/%6futcomes?limit=0`,
    `/api/meetings/${meetingId}/%70articipants?limit=0`,
    "/api/calendars/calendar%3Arouter/%6deetings"
  ])("does not decode an encoded NX-03B static child segment before router precedence for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx03b-encoded-static-child"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectCanonicalNotFound(response, correlationId)
  })

  it.each(["/api/%6deetings", "/api/%63alendars", "/api/%72epresentative-lookups"])(
    "does not decode an encoded NX-03B collection segment into a static route for %s",
    async (pathname) => {
      expect.hasAssertions()
      const correlationId = "router-nx03b-encoded-static-collection"
      const response = await request(pathname, {
        headers: { "x-correlation-id": correlationId },
        method: "GET"
      })

      await expectCanonicalNotFound(response, correlationId)
    }
  )

  it.each([
    `/api/meetings/${meetingId}/agenda?limit=0`,
    `/api/meetings/${meetingId}/documents?limit=0`,
    `/api/meetings/${meetingId}/outcomes?limit=0`,
    `/api/meetings/${meetingId}/participants?limit=0`,
    "/api/calendars/calendar%3Arouter/meetings?limit=0"
  ])("routes NX-03B nested static paths before the dynamic parent for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx03b-nested-static"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each([
    "/api/meetings/%ZZ?unexpected=1",
    `/api/meetings/${meetingId}/agenda/%ZZ?unexpected=1`,
    `/api/meetings/${meetingId}/documents/%ZZ?unexpected=1`,
    `/api/meetings/${meetingId}/outcomes/%ZZ?unexpected=1`,
    `/api/meetings/${meetingId}/participants/%ZZ?unexpected=1`,
    "/api/calendars/%C0%AF?unexpected=1"
  ])("preserves malformed NX-03B path encodings at the proxy boundary for %s", async (pathname) => {
    expect.hasAssertions()
    const correlationId = "router-nx03b-malformed-path"
    const response = await request(pathname, {
      headers: { "x-correlation-id": correlationId },
      method: "GET"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each(nx04Routes)("routes the exact static NX-04 %s POST endpoint before the API catch-all", async (route) => {
    expect.hasAssertions()
    const correlationId = `router-nx04-static-${route.name}`
    const response = await request(route.pathname, {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      method: "POST"
    })

    await expectInvalidRequest(response, correlationId)
  })

  it.each(nx04Routes)(
    "dispatches the supported NX-04 %s POST with deterministic invalid-input feedback",
    async (route) => {
      expect.hasAssertions()
      const correlationId = `router-nx04-invalid-${route.name}`
      const response = await request(`${route.pathname}?unexpected=1`, {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        method: "POST"
      })

      await expectInvalidRequest(response, correlationId)
    }
  )

  it.each(nx04Routes)("keeps all unsupported methods on the built NX-04 %s route", async (route) => {
    expect.hasAssertions()
    for (const method of unsupportedPostMethods) {
      const correlationId = `router-nx04-${route.name}-${method.toLowerCase()}`
      const response = await request(route.pathname, {
        headers: { "x-correlation-id": correlationId },
        method
      })

      await expectCanonicalNotFound(response, correlationId, method === "HEAD")
    }
  })

  it.each(nx04Routes)(
    "returns a canonical JSON 404 without redirecting a literal trailing slash for NX-04 %s",
    async (route) => {
      expect.hasAssertions()
      const correlationId = `router-nx04-trailing-${route.name}`
      const response = await request(`${route.pathname}/`, {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        method: "POST"
      })

      expect(response.headers.get("location")).toBeNull()
      await expectCanonicalNotFound(response, correlationId)
    }
  )

  it.each(nx04Routes)("does not decode the encoded NX-04 static segment for %s", async (route) => {
    expect.hasAssertions()
    const correlationId = `router-nx04-encoded-static-${route.name}`
    const response = await request(route.encodedPath, {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      method: "POST"
    })

    await expectCanonicalNotFound(response, correlationId)
  })

  it.each(["/api/document-diffs/%ZZ", "/api/research/%C0%AF", "/api/search/%ZZ", "/api/search/bills/%C0%AF"])(
    "rejects malformed NX-04 path encodings at the proxy boundary for %s",
    async (pathname) => {
      expect.hasAssertions()
      const correlationId = "router-nx04-malformed-path"
      const response = await request(pathname, {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json", "x-correlation-id": correlationId },
        method: "POST"
      })

      await expectInvalidRequest(response, correlationId)
    }
  )
})

async function expectInvalidRequest(response: Response, correlationId: string): Promise<void> {
  if (response.status !== 400) {
    const body = await response.text()
    throw new Error(
      `Expected HTTP 400, received ${response.status} with body ${JSON.stringify(body)}. Next output:\n${nextServerDiagnostics()}`
    )
  }
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/)
  expect(response.headers.get("x-correlation-id")).toBe(correlationId)
  await expect(response.json()).resolves.toMatchObject({
    error: { category: "invalid_request", correlationId, retryable: false }
  })
}

async function expectCanonicalNotFound(response: Response, correlationId: string, headRequest = false): Promise<void> {
  assertStatus(response, 404)
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/)
  expect(response.headers.get("x-correlation-id")).toBe(correlationId)
  if (headRequest) {
    const body = await response.text()
    if (body !== "") {
      throw new Error(`Expected empty HTTP HEAD response body, received ${JSON.stringify(body)}`)
    }
    return
  }
  await expect(response.json()).resolves.toEqual({
    error: {
      category: "not_found",
      correlationId,
      message: "API route was not found",
      retryable: false
    }
  })
}

async function expectPayloadTooLarge(response: Response, correlationId: string): Promise<void> {
  assertStatus(response, 413)
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/)
  expect(response.headers.get("x-correlation-id")).toBe(correlationId)
  await expect(response.json()).resolves.toMatchObject({
    error: { category: "payload_too_large", correlationId, retryable: false }
  })
}

function assertStatus(response: Response, expectedStatus: number): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, received ${response.status}. Next output:\n${nextServerDiagnostics()}`
    )
  }
}

async function request(pathname: string, init: RequestInit): Promise<Response> {
  return await fetch(`${baseUrl}${pathname}`, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs)
  })
}

function batchBody(byteLength: number): string {
  const prefix = '{"ids":["'
  const suffix = '"]}'
  const valueLength = byteLength - Buffer.byteLength(prefix) - Buffer.byteLength(suffix)
  if (valueLength < 1) {
    throw new RangeError("Batch body must include at least one ID character")
  }
  return `${prefix}${"a".repeat(valueLength)}${suffix}`
}

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error)))
  )
  if (address === null || typeof address === "string") {
    throw new Error("Could not reserve a TCP port for Next router acceptance")
  }
  return address.port
}

async function runNext(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<void> {
  const child = spawn(process.execPath, ["scripts/next.mjs", ...arguments_], {
    cwd: packageDirectory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  })
  const diagnostics = captureDiagnostics(child)
  const result = await Promise.race([
    new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", (code) => resolve(code))
    }),
    delay(timeoutMs).then(() => "timeout" as const)
  ])
  if (result === "timeout") {
    child.kill("SIGKILL")
    throw new Error(`Next ${arguments_.join(" ")} timed out after ${timeoutMs}ms.\n${diagnostics()}`)
  }
  if (result !== 0) {
    throw new Error(`Next ${arguments_.join(" ")} exited with code ${result}.\n${diagnostics()}`)
  }
}

function captureDiagnostics(child: ChildProcess): () => string {
  let output = ""
  const append = (chunk: Buffer) => {
    output = `${output}${chunk.toString("utf8")}`.slice(-8_000)
  }
  child.stdout?.on("data", append)
  child.stderr?.on("data", append)
  return () => output || "No process output was captured."
}

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    if (nextServer?.exitCode !== null) {
      throw new Error(`Next start exited before /health became ready.\n${nextServerDiagnostics()}`)
    }
    try {
      const response = await request("/health", { method: "GET" })
      if (response.status === 200) {
        return
      }
      lastError = new Error(`/health returned ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(
    `Next start did not make /health ready within ${startupTimeoutMs}ms: ${String(lastError)}\n${nextServerDiagnostics()}`
  )
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}
