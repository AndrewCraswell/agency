import { execFile } from "node:child_process"
import { rm, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const fixtureName = `runner-fixture-${process.pid}`
const fixturePath = new URL(`../tools/${fixtureName}.mjs`, import.meta.url)

beforeAll(async () => {
  await writeFile(fixturePath, "process.stdout.write(JSON.stringify(process.argv.slice(2)))\n")
})

afterAll(async () => {
  await rm(fixturePath, { force: true })
})

describe("tool runner", () => {
  it("lists discovered tools", async () => {
    const { stdout } = await execFileAsync(process.execPath, ["scripts/tool.mjs", "--list"])

    expect(stdout).toContain("agent/evaluate-agent")
    expect(stdout).toContain(fixtureName)
    expect(stdout).not.toContain("tool.test")
    expect(stdout).not.toContain("extract-fr-pdf-text-worker")
  })

  it("forwards arguments to the selected tool", async () => {
    const { stdout } = await execFileAsync(process.execPath, ["scripts/tool.mjs", fixtureName, "alpha", "--beta"])

    expect(JSON.parse(stdout)).toEqual(["alpha", "--beta"])
  })

  it("rejects unknown tools", async () => {
    await expect(execFileAsync(process.execPath, ["scripts/tool.mjs", "missing-tool"])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("Unknown tool: missing-tool")
    })
  })
})
