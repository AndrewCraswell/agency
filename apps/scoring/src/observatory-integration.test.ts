import { spawn, type ChildProcess } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createServer } from "node:net"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let serverProcess: ChildProcess | undefined
let origin = ""

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

async function waitForServer(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // The child is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }
  throw new Error("Observatory server did not become ready")
}

describe("scenario observatory module integration", () => {
  beforeAll(async () => {
    const port = await availablePort()
    origin = `http://127.0.0.1:${port}`
    serverProcess = spawn(
      process.execPath,
      [resolve(applicationDirectory, "scripts/serve-scenario-observatory.mjs"), `--port=${port}`],
      { cwd: applicationDirectory, stdio: "ignore" }
    )
    await waitForServer(origin)
  }, 10_000)

  afterAll(() => {
    serverProcess?.kill()
  })

  it("serves the compiled tested projection as the observatory module", async () => {
    const [pageResponse, moduleResponse, compiledModule] = await Promise.all([
      fetch(origin),
      fetch(`${origin}/assets/scenario-display-projection.js`),
      readFile(resolve(applicationDirectory, "dist/scenario-display-projection.js"), "utf8")
    ])
    const page = await pageResponse.text()

    expect(pageResponse.status).toBe(200)
    expect(page).toContain('from "/assets/scenario-display-projection.js"')
    expect(page).toContain("isActualAcceptedScenarioDisplay")
    expect(page).not.toContain("function isRejectedCase")
    expect(page).not.toContain('testCase.expected?.status === "rejected"')
    expect(moduleResponse.headers.get("content-type")).toBe("text/javascript; charset=utf-8")
    expect(moduleResponse.headers.get("x-content-type-options")).toBe("nosniff")
    expect(await moduleResponse.text()).toBe(compiledModule)
  })

  it("executes reports for every weapon through the same server", async () => {
    const response = await fetch(`${origin}/api/run`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('"weapon":"epee"')
    expect(body).toContain('"weapon":"foil"')
    expect(body).toContain('"weapon":"sabre"')
  })
})
