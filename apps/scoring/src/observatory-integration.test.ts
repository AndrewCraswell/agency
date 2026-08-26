import { spawn, type ChildProcess } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let serverProcess: ChildProcess | undefined
let origin = ""

const expectedPlannedMappings = {
  "EPEE-05": ["epee.audio-visual-correlation"],
  "FOIL-01": ["foil.break-boundaries", "foil.target-context"],
  "FOIL-02": ["foil.break-boundaries", "foil.host-resistance-classifications", "foil.nominal-break"],
  "FOIL-03": [
    "foil.grounded-contact",
    "foil.host-logical-contexts",
    "foil.host-resistance-classifications",
    "foil.integrity-and-uncertainty"
  ],
  "FOIL-04": ["foil.host-logical-contexts", "foil.insulation-handoff"],
  "FOIL-05": ["foil.lockout-cutoff", "foil.same-side-and-lockout"],
  "SABRE-01": ["sabre.contact-floor-boundaries", "sabre.own-equipment-hit-continuity"],
  "SABRE-02": ["sabre.white-abnormal-change-latch", "sabre.yellow-onset-clear"],
  "SABRE-03": [
    "sabre.contact-floor-boundaries",
    "sabre.external-100-ohm-host-boundary",
    "sabre.external-path-containment",
    "sabre.whipover-boundaries-and-recovery"
  ],
  "SABRE-04": ["sabre.own-equipment-hit-continuity"],
  "SABRE-05": ["sabre.lockout-boundary", "sabre.lockout-cutoff"],
  "SABRE-06": ["sabre.whipover-boundaries-and-recovery"],
  "SABRE-07": ["sabre.control-break-diagnostic-boundaries"]
} as const

async function availablePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveReady, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolveReady)
  })
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("Unable to allocate observatory test port")
  await new Promise<void>((resolveClosed, reject) => server.close((error) => (error ? reject(error) : resolveClosed())))
  return address.port
}

async function waitForServer(url: string, acceptUnavailable = false): Promise<Response> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok || (acceptUnavailable && response.status === 503)) return response
    } catch {
      // The child is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }
  throw new Error("Observatory server did not become ready")
}

function simulatorHtml(assetName: string): string {
  return `<!doctype html><html><head><script type="module" src="/assets/${assetName}"></script></head><body><div id="root"></div></body></html>`
}

async function writeSimulatorBuild(directory: string, assetName: string, asset: string): Promise<void> {
  await mkdir(join(directory, "assets"), { recursive: true })
  await Promise.all([
    writeFile(join(directory, "index.html"), simulatorHtml(assetName)),
    writeFile(join(directory, "assets", assetName), asset)
  ])
}

async function startObservatory(simulatorDirectory?: string): Promise<{ origin: string; process: ChildProcess }> {
  const port = await availablePort()
  const serverProcess = spawn(
    process.execPath,
    [
      resolve(applicationDirectory, "scripts/serve-scenario-observatory.mjs"),
      `--port=${port}`,
      ...(simulatorDirectory === undefined ? [] : [`--simulator-directory=${simulatorDirectory}`])
    ],
    { cwd: applicationDirectory, stdio: "ignore" }
  )
  const origin = `http://127.0.0.1:${port}`
  try {
    await waitForServer(origin, simulatorDirectory !== undefined)
  } catch (error) {
    serverProcess.kill()
    throw error
  }
  return { origin, process: serverProcess }
}

describe("scenario observatory module integration", () => {
  beforeAll(async () => {
    const server = await startObservatory()
    origin = server.origin
    serverProcess = server.process
  }, 10_000)

  afterAll(() => {
    serverProcess?.kill()
  })

  it("serves the built React simulator and its bundled script", async () => {
    const pageResponse = await fetch(origin)
    const page = await pageResponse.text()
    const scriptPath = page.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
    if (scriptPath === undefined) throw new Error("Simulator page did not include a JavaScript asset")
    const scriptResponse = await fetch(`${origin}${scriptPath}`)

    expect(pageResponse.status).toBe(200)
    expect(page).toContain("<title>Scoring simulator</title>")
    expect(page).toContain('<div id="root"></div>')
    expect(page).toContain("scoutTheme")
    expect(scriptResponse.status).toBe(200)
    expect(scriptResponse.headers.get("content-type")).toBe("text/javascript; charset=utf-8")
    expect(scriptResponse.headers.get("x-content-type-options")).toBe("nosniff")
    expect((await scriptResponse.text()).length).toBeGreaterThan(1000)
  })

  it("keeps a served simulator build coherent across a live rebuild and fails closed for missing or corrupt output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scoring-simulator-"))
    const server = await startObservatory(directory)
    try {
      const missing = await fetch(server.origin)
      expect(missing.status).toBe(503)
      await expect(missing.json()).resolves.toEqual({ error: "simulator-build-unavailable" })

      await writeSimulatorBuild(directory, "first.js", "export const build = 'first'\n")
      const firstPage = await (await fetch(server.origin)).text()
      expect(firstPage).toContain("/assets/first.js")
      expect(await (await fetch(`${server.origin}/assets/first.js`)).text()).toContain("first")

      await rm(join(directory, "assets"), { force: true, recursive: true })
      await writeSimulatorBuild(directory, "second.js", "export const build = 'second'\n")
      const secondPageResponse = await fetch(server.origin)
      const secondPage = await secondPageResponse.text()
      expect(secondPageResponse.headers.get("cache-control")).toBe("no-store")
      expect(secondPage).toContain("/assets/second.js")
      const secondAsset = await fetch(`${server.origin}/assets/second.js`)
      expect(secondAsset.status).toBe(200)
      expect(secondAsset.headers.get("x-content-type-options")).toBe("nosniff")
      expect(await secondAsset.text()).toContain("second")
      expect(await (await fetch(`${server.origin}/assets/first.js`)).text()).toContain("first")

      await writeFile(join(directory, "index.html"), "<html>corrupt</html>")
      const corrupt = await fetch(server.origin)
      expect(corrupt.status).toBe(503)
      await expect(corrupt.json()).resolves.toEqual({ error: "simulator-build-invalid" })
    } finally {
      server.process.kill()
      await rm(directory, { force: true, recursive: true })
    }
  })

  it("executes reports for every weapon through the same server", async () => {
    const response = await fetch(`${origin}/api/run`)
    const body = await response.text()
    const repeatedBody = await (await fetch(`${origin}/api/run`)).text()
    const report = JSON.parse(body) as {
      cases: {
        evidence?: { reason?: unknown; status?: unknown }
        scenario: { ruleRevision?: unknown; scenarioId?: unknown; scenarioIds?: unknown; traceabilityId?: unknown }
        status: string
      }[]
      summary: {
        executable: { failed: number; passed: number; total: number }
        plannedRequirements: number
      }
      reportId: string
    }

    expect(response.status).toBe(200)
    expect(repeatedBody).toBe(body)
    expect(body).toContain('"weapon":"epee"')
    expect(body).toContain('"weapon":"foil"')
    expect(body).toContain('"weapon":"sabre"')
    expect(report.summary).toEqual({
      executable: { failed: 0, passed: 29, total: 29 },
      plannedRequirements: 13
    })
    expect(report.reportId).toBe(
      `sha256:${createHash("sha256")
        .update(JSON.stringify({ cases: report.cases, summary: report.summary }))
        .digest("hex")}`
    )
    const parsedFailed = report.cases.filter(({ status }) => status === "failed").length
    const parsedPassed = report.cases.filter(({ status }) => status === "passed").length
    const parsedPlannedRequirements = report.cases.filter(({ status }) => status === "planned-requirement").length
    expect(report.summary).toEqual({
      executable: { failed: parsedFailed, passed: parsedPassed, total: parsedFailed + parsedPassed },
      plannedRequirements: parsedPlannedRequirements
    })
    expect(
      report.cases
        .filter(({ status }) => status !== "planned-requirement")
        .every(
          ({ scenario }) =>
            typeof scenario.scenarioId === "string" &&
            scenario.scenarioId.trim().length > 0 &&
            scenario.traceabilityId === undefined &&
            typeof scenario.ruleRevision === "string" &&
            scenario.ruleRevision.trim().length > 0
        )
    ).toBe(true)
    expect(
      report.cases.some(
        ({ status, scenario }) =>
          status === "planned-requirement" &&
          typeof scenario.traceabilityId === "string" &&
          scenario.traceabilityId.trim().length > 0 &&
          Array.isArray(scenario.scenarioIds) &&
          scenario.scenarioIds.length > 0 &&
          scenario.scenarioId === undefined &&
          scenario.ruleRevision === undefined
      )
    ).toBe(true)
    expect(
      report.cases
        .filter(({ status }) => status === "planned-requirement")
        .every(
          ({ evidence, scenario }) =>
            evidence?.reason === "evidence-incomplete" &&
            evidence.status === "incomplete" &&
            Array.isArray(scenario.scenarioIds) &&
            scenario.scenarioIds.every((scenarioId) => typeof scenarioId === "string")
        )
    ).toBe(true)
    const plannedMappings = Object.fromEntries(
      report.cases
        .filter(({ status }) => status === "planned-requirement")
        .map(({ scenario }) => {
          if (typeof scenario.traceabilityId !== "string" || !Array.isArray(scenario.scenarioIds)) {
            throw new TypeError("Planned requirement mapping is malformed")
          }
          expect(new Set(scenario.scenarioIds).size).toBe(scenario.scenarioIds.length)
          return [scenario.traceabilityId, scenario.scenarioIds]
        })
    )
    expect(plannedMappings).toEqual(expectedPlannedMappings)
  })
})
