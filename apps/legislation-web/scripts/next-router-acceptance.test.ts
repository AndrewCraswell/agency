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

describe.sequential("NX-02B Next router acceptance", () => {
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
})

async function expectInvalidRequest(response: Response, correlationId: string): Promise<void> {
  assertStatus(response, 400)
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/)
  expect(response.headers.get("x-correlation-id")).toBe(correlationId)
  await expect(response.json()).resolves.toMatchObject({
    error: { category: "invalid_request", correlationId, retryable: false }
  })
}

async function expectCanonicalNotFound(response: Response, correlationId: string): Promise<void> {
  assertStatus(response, 404)
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/)
  expect(response.headers.get("x-correlation-id")).toBe(correlationId)
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
