import { spawn, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  canonicalSmokeApiBaseUrl,
  runApiSmoke,
  type SmokeProfile
} from "../src/modules/request-handling/api/smoke-harness.js"
import { formatSmokeProcessOutput } from "../src/modules/request-handling/api/smoke-process-diagnostics.js"
import { fetchWithTimeout } from "../src/modules/request-handling/api/smoke-readiness.js"
import { parseSmokeFixtures, parseSmokeToken } from "../src/modules/request-handling/api/smoke-runner-config.js"

const appRoot = fileURLToPath(new URL("..", import.meta.url))
const MAX_CAPTURED_OUTPUT = 8_000

function smokeProfile(value: string | undefined): SmokeProfile {
  const normalized = value?.trim()
  if (normalized === undefined || normalized === "" || normalized === "full") {
    return "full"
  }
  if (
    normalized === "scoped-bills" ||
    normalized === "vote-change" ||
    normalized === "subscription-lifecycle" ||
    normalized === "webhook-lifecycle"
  ) {
    return normalized
  }
  throw new Error(
    "LEGISLATION_SMOKE_PROFILE must be full, scoped-bills, vote-change, subscription-lifecycle, or webhook-lifecycle"
  )
}

function smokePort(value: string | undefined): number {
  const port = Number(value ?? "3199")
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError("LEGISLATION_SMOKE_PORT must be an integer between 1 and 65535")
  }
  return port
}

function smokeRequestTimeout(value: string | undefined): number {
  const requestTimeoutMs = Number(value ?? "30000")
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw new RangeError("LEGISLATION_SMOKE_REQUEST_TIMEOUT_MS must be an integer between 1 and 60000")
  }
  return requestTimeoutMs
}

function smokeRequireAuth(environment: NodeJS.ProcessEnv): boolean {
  const configured = environment.LEGISLATION_SMOKE_REQUIRE_AUTH?.trim().toLowerCase()
  if (configured === "true") {
    return true
  }
  if (configured === "false") {
    return false
  }
  if (configured !== undefined && configured !== "") {
    throw new Error("LEGISLATION_SMOKE_REQUIRE_AUTH must be true or false")
  }
  return environment.AUTH_MODE?.trim().toLowerCase() === "workos"
}

function smokeCanonicalApiBaseUrl(profile: SmokeProfile): URL | undefined {
  const value =
    process.env.LEGISLATION_SMOKE_CANONICAL_API_BASE_URL?.trim() || process.env.LEGISLATION_PUBLIC_API_BASE_URL?.trim()
  if (value === undefined || value === "") {
    if (
      profile === "scoped-bills" ||
      profile === "vote-change" ||
      profile === "subscription-lifecycle" ||
      profile === "webhook-lifecycle"
    ) {
      throw new Error(
        `LEGISLATION_SMOKE_CANONICAL_API_BASE_URL or LEGISLATION_PUBLIC_API_BASE_URL is required for ${profile}`
      )
    }
    return undefined
  }
  return canonicalSmokeApiBaseUrl(value)
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
      const remainingMs = Math.max(1, deadline - Date.now())
      const [health, ready] = await Promise.all([
        fetchWithTimeout(fetch, new URL("/health", baseUrl), remainingMs),
        fetchWithTimeout(fetch, new URL("/ready", baseUrl), remainingMs)
      ])
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

function startLocalServer(secrets: readonly string[], port: number): LocalServerProcess {
  const environment = { ...process.env }
  delete environment.LEGISLATION_SMOKE_TOKEN
  Object.assign(environment, {
    NODE_ENV: "development",
    PORT: String(port)
  })
  const nextCliPath = createRequire(new URL("../package.json", import.meta.url)).resolve("next/dist/bin/next")
  const child = spawn(process.execPath, [nextCliPath, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
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

async function main(): Promise<void> {
  const port = smokePort(process.env.LEGISLATION_SMOKE_PORT)
  const configuredBaseUrl = process.env.LEGISLATION_SMOKE_BASE_URL?.trim() || undefined
  const token = parseSmokeToken(process.env)
  const requestTimeoutMs = smokeRequestTimeout(process.env.LEGISLATION_SMOKE_REQUEST_TIMEOUT_MS)
  const profile = smokeProfile(process.env.LEGISLATION_SMOKE_PROFILE)
  const canonicalApiBaseUrl = smokeCanonicalApiBaseUrl(profile)
  const baseUrl = canonicalSmokeApiBaseUrl(configuredBaseUrl ?? `http://127.0.0.1:${port}`)
  const requireAuth = smokeRequireAuth(process.env)
  const local = configuredBaseUrl === undefined ? startLocalServer(token === undefined ? [] : [token], port) : undefined
  try {
    if (local !== undefined) {
      await waitForReady(baseUrl, local)
    }
    const report = await runApiSmoke({
      baseUrl,
      canonicalApiBaseUrl,
      fixtures: parseSmokeFixtures(process.env),
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
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
