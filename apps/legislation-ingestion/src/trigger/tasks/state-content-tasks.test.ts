import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sdk = vi.hoisted(() => ({
  handlers: new Map<
    string,
    (payload: unknown, context: { ctx: { run: { id: string }; deployment?: { version: string } } }) => Promise<unknown>
  >(),
  child: vi.fn(),
  successor: vi.fn()
}))

vi.mock("@trigger.dev/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@trigger.dev/sdk")>()),
  task: (definition: { id: string; run: Parameters<typeof sdk.handlers.set>[1] }) => {
    sdk.handlers.set(definition.id, definition.run)
    return { triggerAndWait: sdk.child }
  },
  schedules: { task: vi.fn() },
  tasks: { trigger: sdk.successor },
  idempotencyKeys: { create: async (key: string) => key }
}))

import "./state-content-tasks.js"

describe("state content deployed continuation", () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENSTATES_CONTENT_ENABLED_STATES", "nc")
    sdk.successor.mockResolvedValue({ id: "run_successor" })
  })

  async function run(nextWork: unknown, scanRoundComplete = false) {
    sdk.child.mockResolvedValue({
      ok: true,
      output: { status: "succeeded", checkpoint: { scanRoundComplete, ingestionComplete: false, nextWork } }
    })
    const controller = sdk.handlers.get("openstates-content-controller")
    if (!controller) throw new Error("Controller was not registered")
    return controller(
      { state: "nc", session: "1991", maxContinuations: 1 },
      { ctx: { run: { id: "run_parent" }, deployment: { version: "20260919.4" } } }
    )
  }

  it("uses triggerAndWait for children and pins the idempotent successor at a batch limit", async () => {
    await expect(run({ kind: "continue" })).resolves.toMatchObject({
      reason: "continuation_budget",
      continuationRunId: "run_successor",
      ingestionComplete: false
    })
    expect(sdk.child).toHaveBeenCalledWith(
      expect.objectContaining({ state: "nc", session: "1991" }),
      expect.objectContaining({ idempotencyKey: "run_parent:nc:0" })
    )
    expect(sdk.successor).toHaveBeenCalledExactlyOnceWith(
      "openstates-content-controller",
      expect.objectContaining({ state: "nc", session: "1991", maxContinuations: 1 }),
      expect.objectContaining({
        version: "20260919.4",
        idempotencyKey: "state-content:continue:run_parent",
        idempotencyKeyTTL: "30d"
      })
    )
  })

  it("delays future work on the same deployment", async () => {
    await run({ kind: "deferred", retryAt: "2026-09-20T00:00:00.000Z" }, true)
    expect(sdk.successor).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ version: "20260919.4", delay: new Date("2026-09-20T00:00:00.000Z") })
    )
  })

  it("does not submit successors for a drained scan", async () => {
    await expect(run({ kind: "drained" }, true)).resolves.toMatchObject({ continuationRunId: null })
    expect(sdk.successor).not.toHaveBeenCalled()
  })

  it("fails rather than silently completing if successor submission fails", async () => {
    sdk.successor.mockRejectedValue(new Error("dispatch unavailable"))
    await expect(run({ kind: "continue" })).rejects.toThrow("dispatch unavailable")
  })
})
