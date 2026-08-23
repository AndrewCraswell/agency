import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runScenario } from "../dist/scenario-runner.js"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = resolve(applicationDirectory, "docs/golden-scenario-manifest.json")
const observatoryPath = resolve(applicationDirectory, "observatory/index.html")
const host = "127.0.0.1"
const portArgument = process.argv.find((argument) => argument.startsWith("--port="))
const port = Number(portArgument?.slice("--port=".length) ?? 4178)

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
  throw new TypeError("--port must be an integer from 1 to 65535")

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const activeEntries = manifest.scenarios.filter((entry) => entry.status === "active")
const activeById = new Map(activeEntries.map((entry) => [entry.scenarioId, entry]))
const plannedCoverage = manifest.coverage.filter((entry) => entry.status === "planned")
const observatoryHtml = await readFile(observatoryPath, "utf8")

async function loadScenario(entry) {
  return JSON.parse(await readFile(resolve(applicationDirectory, "docs", entry.path), "utf8"))
}

async function executeActiveEntry(entry) {
  const scenarioPath = resolve(applicationDirectory, "docs", entry.path)
  const run = runScenario(scenarioPath)
  const result = run.report.scenarios[0]
  if (run.exitCode === 2 || result === undefined) throw new Error(run.report.error?.code ?? "scenario execution failed")
  const scenario = await loadScenario(entry)
  return {
    expected: scenario.expect,
    result,
    scenario,
    status: result.status
  }
}

async function executeReport(selectedScenarioId) {
  const selectedEntries =
    selectedScenarioId === undefined ? activeEntries : [activeById.get(selectedScenarioId)].filter(Boolean)
  if (selectedEntries.length === 0) return null

  const activeCases = await Promise.all(selectedEntries.map(executeActiveEntry))
  const skippedCases =
    selectedScenarioId === undefined
      ? plannedCoverage.map((entry) => ({
          expected: null,
          result: null,
          scenario: {
            description: "No executable golden scenario has been approved for this requirement yet.",
            scenarioId: entry.traceabilityId,
            weapon: entry.traceabilityId.startsWith("FOIL")
              ? "foil"
              : entry.traceabilityId.startsWith("SABRE")
                ? "sabre"
                : "epee"
          },
          status: "skipped"
        }))
      : []
  const cases = [...activeCases, ...skippedCases]
  return {
    cases,
    generatedAt: new Date().toISOString(),
    summary: {
      failed: cases.filter((testCase) => testCase.status === "failed").length,
      passed: cases.filter((testCase) => testCase.status === "passed").length,
      skipped: cases.filter((testCase) => testCase.status === "skipped").length,
      total: cases.length
    }
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(`${JSON.stringify(value)}\n`)
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`)
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8"
      })
      response.end(observatoryHtml)
      return
    }
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/api/run") {
      sendJson(response, 200, await executeReport())
      return
    }
    if (request.method === "POST" && url.pathname.startsWith("/api/run/")) {
      const scenarioId = decodeURIComponent(url.pathname.slice("/api/run/".length))
      const report = await executeReport(scenarioId)
      if (report === null) {
        sendJson(response, 404, { error: "scenario-not-found" })
        return
      }
      sendJson(response, 200, report)
      return
    }
    sendJson(response, 404, { error: "not-found" })
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "execution-error" })
  }
})

server.listen(port, host, () => {
  process.stdout.write(`Bout test observatory: http://${host}:${port}/\n`)
})
