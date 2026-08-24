import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import {
  canonicalSmokeApiBaseUrl,
  runApiSmoke,
  type SmokeFixture,
  type SmokeProfile
} from "../src/api/smoke-harness.js"
import { formatSmokeProcessOutput } from "../src/api/smoke-process-diagnostics.js"

const appRoot = fileURLToPath(new URL("..", import.meta.url))
const port = Number(process.env.LEGISLATION_SMOKE_PORT ?? "3199")
const configuredBaseUrl = process.env.LEGISLATION_SMOKE_BASE_URL?.trim()
const token = process.env.LEGISLATION_SMOKE_TOKEN?.trim() || undefined
const requestTimeoutMs = Number(process.env.LEGISLATION_SMOKE_REQUEST_TIMEOUT_MS ?? "30000")
const profile = smokeProfile(process.env.LEGISLATION_SMOKE_PROFILE)
const canonicalApiBaseUrl = smokeCanonicalApiBaseUrl(profile)
const MAX_CAPTURED_OUTPUT = 8_000
const requireAuth =
  process.env.LEGISLATION_SMOKE_REQUIRE_AUTH === "true" ||
  (process.env.LEGISLATION_SMOKE_REQUIRE_AUTH === undefined && process.env.AUTH_MODE === "workos")

function smokeProfile(value: string | undefined): SmokeProfile {
  if (value === undefined || value.trim() === "" || value === "full") {
    return "full"
  }
  if (value === "scoped-bills") {
    return value
  }
  throw new Error("LEGISLATION_SMOKE_PROFILE must be full or scoped-bills")
}

function smokeCanonicalApiBaseUrl(profile: SmokeProfile): URL | undefined {
  const value =
    process.env.LEGISLATION_SMOKE_CANONICAL_API_BASE_URL?.trim() || process.env.LEGISLATION_PUBLIC_API_BASE_URL?.trim()
  if (value === undefined || value === "") {
    if (profile === "scoped-bills") {
      throw new Error(
        "LEGISLATION_SMOKE_CANONICAL_API_BASE_URL or LEGISLATION_PUBLIC_API_BASE_URL is required for scoped-bills"
      )
    }
    return undefined
  }
  return canonicalSmokeApiBaseUrl(value)
}

function fixture(name: keyof SmokeFixture): string | undefined {
  const envName = `LEGISLATION_SMOKE_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
  return process.env[envName]?.trim() || undefined
}

function smokeFixtures(): SmokeFixture {
  return {
    amendmentId: fixture("amendmentId"),
    billId: fixture("billId"),
    documentId: fixture("documentId"),
    documentIdB: fixture("documentIdB"),
    jurisdictionId: fixture("jurisdictionId"),
    materialId: fixture("materialId"),
    meetingId: fixture("meetingId"),
    organizationId: fixture("organizationId"),
    personId: fixture("personId"),
    sessionId: fixture("sessionId"),
    voteId: fixture("voteId")
  }
}

type LocalServerProcess = Readonly<{
  child: ChildProcess
  secrets: readonly string[]
  stderrTail: string
  stdoutTail: string
  spawnError?: string
}>

function appendTail(current: string, chunk: unknown): string {
  const next = `${current}${typeof chunk === "string" ? chunk : String(chunk)}`
  return next.length <= MAX_CAPTURED_OUTPUT ? next : next.slice(-MAX_CAPTURED_OUTPUT)
}

function startupFailure(local: LocalServerProcess): Error {
  const reason = local.spawnError ?? `process exited with code ${local.child.exitCode ?? "unknown"}`
  const output = formatSmokeProcessOutput(local)
  return new Error(`Local legislation server failed to start: ${reason}${output === "" ? "" : `; ${output}`}`)
}

async function waitForReady(baseUrl: URL, local: LocalServerProcess): Promise<void> {
  const deadline = Date.now() + 30_000
  let lastError = "server did not respond"
  while (Date.now() < deadline) {
    if (local.spawnError !== undefined || local.child.exitCode !== null) {
      throw startupFailure(local)
    }
    try {
      const [health, ready] = await Promise.all([fetch(new URL("/health", baseUrl)), fetch(new URL("/ready", baseUrl))])
      if (health.ok && ready.ok) {
        return
      }
      lastError = `health=${health.status}, ready=${ready.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const output = formatSmokeProcessOutput(local)
  throw new Error(`Local legislation server did not become ready: ${lastError}${output === "" ? "" : `; ${output}`}`)
}

function startLocalServer(secrets: readonly string[]): LocalServerProcess {
  const environment = { ...process.env }
  delete environment.LEGISLATION_SMOKE_TOKEN
  Object.assign(environment, {
    LEGISLATION_HOST: "127.0.0.1",
    LEGISLATION_PORT: String(port),
    NODE_ENV: process.env.NODE_ENV ?? "test"
  })
  const child = spawn(process.execPath, [fileURLToPath(import.meta.resolve("tsx/cli")), "src/cli/main.ts", "serve"], {
    cwd: appRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  })
  const local: {
    child: ChildProcess
    secrets: readonly string[]
    stderrTail: string
    stdoutTail: string
    spawnError?: string
  } = {
    child,
    secrets,
    stderrTail: "",
    stdoutTail: ""
  }
  child.stdout?.on("data", (chunk: unknown) => {
    local.stdoutTail = appendTail(local.stdoutTail, chunk)
  })
  child.stderr?.on("data", (chunk: unknown) => {
    local.stderrTail = appendTail(local.stderrTail, chunk)
  })
  child.on("error", (error) => {
    local.spawnError = formatSmokeProcessOutput({
      secrets,
      stderrTail: error instanceof Error ? error.message : String(error),
      stdoutTail: ""
    }).replace(/^stderr: /, "")
  })
  return local
}

function stopLocalServer(local: LocalServerProcess): Promise<void> {
  const { child } = local
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }
  child.kill("SIGTERM")
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL")
      resolve()
    }, 5_000)
    child.once("exit", () => {
      clearTimeout(timeout)
      resolve()
    })
  })
}

const local = configuredBaseUrl === undefined ? startLocalServer(token === undefined ? [] : [token]) : undefined
let baseUrl: URL
try {
  baseUrl = new URL(configuredBaseUrl ?? `http://127.0.0.1:${port}`)
  if (local !== undefined) {
    await waitForReady(baseUrl, local)
  }
  const report = await runApiSmoke({
    baseUrl,
    canonicalApiBaseUrl,
    fixtures: smokeFixtures(),
    profile,
    requireAuth,
    requestTimeoutMs,
    token
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (report.status === "failed") {
    process.exitCode = 1
  } else if (report.status === "blocked") {
    process.exitCode = 2
  } else {
    process.exitCode = 0
  }
} finally {
  if (local !== undefined) {
    await stopLocalServer(local)
  }
}
