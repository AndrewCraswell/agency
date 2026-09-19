import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  register: vi.fn<
    (definition: {
      id: string
      run: (raw: unknown, context: { ctx: { deployment: { version: string } } }) => Promise<unknown>
    }) => unknown
  >((definition) => definition),
  trigger: vi.fn(async () => ({ id: "child" })),
  inspect: vi.fn(),
  acquire: vi.fn(),
  end: vi.fn(async () => {})
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.register,
  schedules: { task: mocks.register },
  tasks: { trigger: mocks.trigger },
  idempotencyKeys: { create: async () => "key" }
}))
vi.mock("../../config/config.js", () => ({
  loadConfig: () => ({ azure: { storageAccount: "account", stateSourceContainer: "sources" }, database: {} })
}))
vi.mock("@repo/legislation-core/database/database", () => ({
  createDatabase: () => ({ database: {}, pool: { end: mocks.end } })
}))
vi.mock("../../ingestion/documents/artifact-store.js", () => ({ AzureBlobArtifactStore: class {} }))
vi.mock("../../ingestion/openstates/scraper-activation.js", () => ({
  requireScraperActivation: vi.fn(),
  scraperBuildFor: vi.fn()
}))
vi.mock("../../ingestion/openstates/scraper-bill-plan-acquisition.js", () => ({ acquireStateBillPlan: mocks.acquire }))
vi.mock("../../ingestion/openstates/scraper-cycle.js", () => ({ inspectScraperBillCycle: mocks.inspect }))
import "./openstates-bill-scraper-tasks.js"

const definitions = mocks.register.mock.calls.map(([definition]) => definition)
const context = { ctx: { deployment: { version: "candidate-version" } } }
const planPath = "openstates/scraper-plans/wa/2025-2026/wa-bills-cycle/plan.json"

describe("pinned bill pipeline continuation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it("pins frozen-plan dispatch to the initiating version", async () => {
    mocks.acquire.mockResolvedValue({ planPath, inventoryId: "inventory" })
    const task = definitions.find((entry) => entry.id === "openstates-bill-scraper-plan")!
    await task.run({ state: "wa" }, context)
    expect(mocks.trigger).toHaveBeenCalledWith(
      "openstates-bill-scraper-dispatch",
      { state: "wa", planPath },
      expect.objectContaining({ version: "candidate-version" })
    )
  })
  it("dispatches only one Washington batch and pins its worker version", async () => {
    const batches = [{ id: "a".repeat(64) }, { id: "b".repeat(64) }]
    mocks.inspect.mockResolvedValue({
      available: batches,
      pending: batches,
      inventoryId: "inventory",
      promotionComplete: false
    })
    const task = definitions.find((entry) => entry.id === "openstates-bill-scraper-dispatch")!
    await task.run({ state: "wa", planPath }, context)
    expect(mocks.trigger).toHaveBeenCalledOnce()
    expect(mocks.trigger).toHaveBeenCalledWith(
      "openstates-bill-scraper-cloud",
      { state: "wa", planPath, batchId: batches[0]!.id },
      expect.objectContaining({ version: "candidate-version" })
    )
    expect(mocks.end).toHaveBeenCalledOnce()
  })
})
