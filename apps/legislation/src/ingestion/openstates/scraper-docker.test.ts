import { describe, expect, it, vi } from "vitest"
import { archiveNcBillPlan } from "./scraper-batches.js"
import { archiveScraperBillDispatch } from "./scraper-dispatch.js"
import { createScraperDockerAdapter } from "./scraper-docker.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

async function fixture() {
  const objects = new Map<string, Uint8Array>()
  const store = {
    exists: async (path: string) => objects.has(path),
    put: async (path: string, bytes: Uint8Array) => {
      if (objects.has(path)) {
        return false
      }
      objects.set(path, bytes)
      return true
    },
    read: async (path: string) => {
      const bytes = objects.get(path)
      if (!bytes) {
        throw new Error("Missing artifact")
      }
      return bytes
    }
  }
  const xml = (id: string) => `<rss><channel><item><bill>${id}</bill></item></channel></rss>`
  const { plan, path } = await archiveNcBillPlan(store, { H: xml("H1"), S: xml("S1") }, "docker-test")
  const issuedAt = new Date()
  const dispatch = await archiveScraperBillDispatch(store, {
    planPath: path,
    batchId: plan.batches[0]!.id,
    runId: "docker-test-attempt",
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 1800 * 1000)
  })
  const command = vi.fn<(args: string[], timeout: number) => Promise<string>>(async (args) =>
    args[0] === "info" ? "same-runtime" : ""
  )
  const options = { store, imageId: `sha256:${"a".repeat(64)}`, network: "none" as const }
  const request = {
    dispatchPath: dispatch.path,
    runId: "docker-test-attempt",
    billIds: ["H1"],
    maxDurationSeconds: 1500,
    runtimeId: "same-runtime"
  }
  return { options, command, request }
}

describe("local Docker extraction boundary", () => {
  it("requires an immutable image ID", async () => {
    const { options, command } = await fixture()
    expect(() => createScraperDockerAdapter({ ...options, imageId: "mutable:latest" }, command)).toThrow(
      "Invalid string"
    )
    expect(command).not.toHaveBeenCalled()
  })
  it("rejects a mismatched dispatch before launching Docker", async () => {
    const { options, command, request } = await fixture()
    await expect(createScraperDockerAdapter(options, command)({ ...request, runId: "other" })).rejects.toThrow(
      "does not match"
    )
    expect(command).not.toHaveBeenCalled()
  })
  it("confirms removal even after Docker failure and does not invent missing artifacts", async () => {
    const { options, command, request } = await fixture()
    command.mockResolvedValueOnce("same-runtime").mockRejectedValueOnce(new Error("private raw diagnostic"))
    await expect(createScraperDockerAdapter(options, command)(request)).rejects.toThrow("one inspectable attempt")
    expect(command.mock.calls.map(([args]) => args[0])).toEqual(["info", "run", "info", "rm", "container", "info"])
    const [runArgs, timeout] = command.mock.calls[1]!
    expect(timeout).toBe(1560_000)
    expect(runArgs).toEqual(
      expect.arrayContaining(["--pull=never", "--read-only", "--cap-drop=ALL", "--network", "none"])
    )
    expect(runArgs).not.toContain("--env")
    expect(runArgs).toContain(`io.agency.openstates.run-id=${request.runId}`)
    expect(command.mock.calls[3]![0].slice(1)).toEqual(["--force", runArgs[2]])
  })
  it("fails closed if the container remains after removal", async () => {
    const { options, command, request } = await fixture()
    command
      .mockResolvedValueOnce("same-runtime")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("same-runtime")
      .mockResolvedValueOnce("")
      .mockResolvedValueOnce("still-running")
    await expect(createScraperDockerAdapter(options, command)(request)).rejects.toBeInstanceOf(
      ScraperWorkerStopUnconfirmedError
    )
  })
  it("does not treat an unreachable Docker daemon as proof of shutdown", async () => {
    const { options, command, request } = await fixture()
    command.mockRejectedValue(new Error("daemon unavailable"))
    command.mockResolvedValueOnce("same-runtime")
    await expect(createScraperDockerAdapter(options, command)(request)).rejects.toBeInstanceOf(
      ScraperWorkerStopUnconfirmedError
    )
  })
  it("rejects another runtime before launch", async () => {
    const { options, command, request } = await fixture()
    command.mockResolvedValueOnce("another-runtime")
    await expect(createScraperDockerAdapter(options, command)(request)).rejects.toThrow("extraction was not started")
    expect(command).toHaveBeenCalledOnce()
  })
  it("does not remove or inspect containers on a substituted runtime after launch", async () => {
    const { options, command, request } = await fixture()
    command.mockResolvedValueOnce("same-runtime").mockResolvedValueOnce("").mockResolvedValueOnce("another-runtime")
    await expect(createScraperDockerAdapter(options, command)(request)).rejects.toBeInstanceOf(
      ScraperWorkerStopUnconfirmedError
    )
    expect(command.mock.calls.map(([args]) => args[0])).toEqual(["info", "run", "info"])
  })
})
