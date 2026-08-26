import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { dirname, extname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runScenario } from "../dist/scenario-runner.js"
import { loadTimingTableForRuleRevision } from "../dist/timing-boundary.js"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = resolve(applicationDirectory, "docs/golden-scenario-manifest.json")
const simulatorDirectoryArgument = process.argv.find((argument) => argument.startsWith("--simulator-directory="))
const simulatorDirectoryValue = simulatorDirectoryArgument?.slice("--simulator-directory=".length)
const simulatorDirectory = resolve(
  simulatorDirectoryValue === undefined ? applicationDirectory : simulatorDirectoryValue,
  simulatorDirectoryValue === undefined ? "dist/simulator" : "."
)
const simulatorPath = resolve(simulatorDirectory, "index.html")
const host = "127.0.0.1"
const portArgument = process.argv.find((argument) => argument.startsWith("--port="))
const port = Number(portArgument?.slice("--port=".length) ?? 4178)

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
  throw new TypeError("--port must be an integer from 1 to 65535")
if (simulatorDirectoryValue !== undefined && simulatorDirectoryValue.length === 0)
  throw new TypeError("--simulator-directory must not be empty")

const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const activeEntries = manifest.scenarios.filter((entry) => entry.status === "active")
const activeById = new Map(activeEntries.map((entry) => [entry.scenarioId, entry]))
const plannedCoverage = manifest.coverage.filter((entry) => entry.status === "planned")
const servedSimulatorAssets = new Map()

for (const entry of plannedCoverage) {
  if (
    !Array.isArray(entry.scenarioIds) ||
    entry.scenarioIds.length === 0 ||
    new Set(entry.scenarioIds).size !== entry.scenarioIds.length ||
    entry.scenarioIds.some((scenarioId) => !activeById.has(scenarioId))
  ) {
    throw new TypeError(`Planned requirement ${entry.traceabilityId} has an invalid active-scenario mapping`)
  }
}

async function loadScenario(entry) {
  return JSON.parse(await readFile(resolve(applicationDirectory, "docs", entry.path), "utf8"))
}

function timingForScenario(scenario) {
  try {
    const timingTable = loadTimingTableForRuleRevision(scenario.ruleRevision)
    return {
      contactMinimumUs:
        scenario.weapon === "epee"
          ? timingTable.epee.contactMinimumUs
          : scenario.weapon === "foil"
            ? timingTable.foil.contactBreakMinimumUs
            : timingTable.sabre.minimumContactUs,
      lockoutUs:
        scenario.weapon === "epee"
          ? timingTable.epee.doubleHitWindowUs
          : scenario.weapon === "foil"
            ? timingTable.foil.lockoutUs
            : timingTable.sabre.lockoutUs,
      status: "available"
    }
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : "unknown-rule-revision",
      status: "unavailable"
    }
  }
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
    status: result.status,
    timing: timingForScenario(scenario)
  }
}

async function executeReport(selectedScenarioId) {
  const selectedEntries =
    selectedScenarioId === undefined ? activeEntries : [activeById.get(selectedScenarioId)].filter(Boolean)
  if (selectedEntries.length === 0) return null

  const activeCases = await Promise.all(selectedEntries.map(executeActiveEntry))
  const plannedRequirementCases =
    selectedScenarioId === undefined
      ? plannedCoverage.map((entry) => ({
          evidence: { reason: "evidence-incomplete", status: "incomplete" },
          expected: null,
          result: null,
          scenario: {
            description: entry.description ?? "Full requirement evidence is pending.",
            scenarioIds: [...entry.scenarioIds],
            traceabilityId: entry.traceabilityId,
            weapon: entry.traceabilityId.startsWith("FOIL")
              ? "foil"
              : entry.traceabilityId.startsWith("SABRE")
                ? "sabre"
                : "epee"
          },
          status: "planned-requirement"
        }))
      : []
  const cases = [...activeCases, ...plannedRequirementCases]
  const executableCases = cases.filter((testCase) => testCase.status !== "planned-requirement")
  const summary = {
    executable: {
      failed: executableCases.filter((testCase) => testCase.status === "failed").length,
      passed: executableCases.filter((testCase) => testCase.status === "passed").length,
      total: executableCases.length
    },
    plannedRequirements: plannedRequirementCases.length
  }
  const reportId = `sha256:${createHash("sha256").update(JSON.stringify({ cases, summary })).digest("hex")}`
  return {
    cases,
    reportId,
    summary
  }
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(`${JSON.stringify(value)}\n`)
}

function contentType(path) {
  const extension = extname(path)
  if (extension === ".css") return "text/css; charset=utf-8"
  if (extension === ".js") return "text/javascript; charset=utf-8"
  if (extension === ".svg") return "image/svg+xml"
  return "application/octet-stream"
}

function simulatorAssetPaths(html) {
  const assetPaths = new Set()
  for (const match of html.matchAll(/(?:href|src)="(\/assets\/[^"?]+)"/gu)) assetPaths.add(match[1])
  return [...assetPaths]
}

async function loadSimulatorSnapshot() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let html
    try {
      html = await readFile(simulatorPath, "utf8")
    } catch {
      return { error: "simulator-build-unavailable" }
    }
    const assetPaths = simulatorAssetPaths(html)
    if (assetPaths.length === 0) return { error: "simulator-build-invalid" }

    const assets = new Map()
    try {
      for (const assetPath of assetPaths) {
        const path = resolve(simulatorDirectory, assetPath.slice(1))
        const relativePath = relative(simulatorDirectory, path)
        if (relativePath.startsWith("..") || isAbsolute(relativePath)) return { error: "simulator-build-invalid" }
        assets.set(assetPath, await readFile(path))
      }
    } catch {
      return { error: "simulator-build-unavailable" }
    }

    try {
      if (html !== (await readFile(simulatorPath, "utf8"))) continue
    } catch {
      return { error: "simulator-build-unavailable" }
    }

    for (const [assetPath, asset] of assets) servedSimulatorAssets.set(assetPath, asset)
    return { assets, html }
  }
  return { error: "simulator-build-changing" }
}

async function sendSimulatorAsset(response, pathname) {
  const servedAsset = servedSimulatorAssets.get(pathname)
  if (servedAsset !== undefined) {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": contentType(pathname),
      "X-Content-Type-Options": "nosniff"
    })
    response.end(servedAsset)
    return true
  }
  const assetPath = resolve(simulatorDirectory, pathname.slice(1))
  const relativePath = relative(simulatorDirectory, assetPath)
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return false
  try {
    const asset = await readFile(assetPath)
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": contentType(assetPath),
      "X-Content-Type-Options": "nosniff"
    })
    response.end(asset)
    return true
  } catch {
    return false
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`)
    if (request.method === "GET" && url.pathname === "/") {
      const snapshot = await loadSimulatorSnapshot()
      if ("error" in snapshot) {
        sendJson(response, 503, { error: snapshot.error })
        return
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8"
      })
      response.end(snapshot.html)
      return
    }
    if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
      if (!(await sendSimulatorAsset(response, url.pathname))) sendJson(response, 404, { error: "not-found" })
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
  process.stdout.write(`Scoring simulator: http://${host}:${port}/\n`)
})
