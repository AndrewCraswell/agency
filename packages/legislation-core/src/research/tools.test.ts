import assert from "node:assert/strict"
import { describe, expect, it, vi } from "vitest"
import { createLogger } from "../observability/logger"
import { createLegislationResearchTools, type LegislationQueryApi } from "./tools"

const logger = createLogger({ level: "error", service: "research-test", write: () => undefined })
function service(): LegislationQueryApi {
  const empty = async () => ({ items: [] })
  return {
    compareBillVersions: empty,
    findRelatedBills: empty,
    getAmendment: empty,
    getBill: vi.fn(async () => ({})),
    getBillVotes: empty,
    getBillText: empty,
    getBillTimeline: empty,
    getEvent: empty,
    getOrganization: empty,
    getPerson: empty,
    getSupportingMaterial: empty,
    getVote: empty,
    searchAmendments: empty,
    searchBills: vi.fn(empty),
    searchBillText: empty,
    searchChanges: vi.fn(empty),
    searchEvents: vi.fn(empty),
    searchOrganizations: empty,
    searchPeople: empty,
    searchSupportingMaterials: empty,
    searchVotes: vi.fn(empty)
  }
}
function definition(api: LegislationQueryApi, name: string) {
  const tool = createLegislationResearchTools(api, logger).find((item) => item.name === name)
  assert.ok(tool)
  return tool
}

describe("shared research definitions", () => {
  it("keeps dates wire-safe through repeated schema validation and converts only at execution", async () => {
    const api = service()
    const timestamp = "2025-01-01T00:00:00Z"
    for (const [name, input] of [
      ["search_events", { from: timestamp, to: timestamp }],
      ["search_votes", { from: timestamp }],
      ["search_changes", { observedFrom: timestamp, observedTo: timestamp }]
    ] as const) {
      const tool = definition(api, name)
      const parsed = tool.inputSchema.parse(tool.inputSchema.parse(input))
      expect(parsed).toMatchObject(input)
      expect(await tool.execute(parsed)).not.toHaveProperty("isError", true)
    }
    expect(api.searchEvents).toHaveBeenCalledWith({ from: new Date(timestamp), to: new Date(timestamp) })
    expect(api.searchVotes).toHaveBeenCalledWith({ from: new Date(timestamp) })
    expect(api.searchChanges).toHaveBeenCalledWith({
      observedFrom: new Date(timestamp),
      observedTo: new Date(timestamp)
    })
  })
  it("removes nested internal fields before result shaping and budgeting", async () => {
    const api = service()
    vi.mocked(api.getBill).mockResolvedValue({
      bill: {
        id: "bill:us:119:hr:1",
        title: "Education",
        summary: "Omitted summary",
        embedding: [1],
        searchVector: "x".repeat(1_000_000),
        embeddingModel: "internal",
        embeddingInputHash: "internal"
      },
      documents: [{ id: "document:1", text: "Source text", searchVector: "internal" }]
    })
    const result = await definition(api, "get_bill").execute({ id: "bill:us:119:hr:1" })
    expect(result).toHaveProperty("structuredContent", {
      data: {
        bill: { id: "bill:us:119:hr:1", title: "Education" },
        documents: [{ id: "document:1", text: "Source text" }]
      }
    })
    expect(JSON.stringify(result)).not.toContain("internal")
  })
  it("rejects invalid identifiers before executing the query", async () => {
    const api = service()
    expect(await definition(api, "get_bill").execute({ id: "invalid" })).toHaveProperty("isError", true)
    expect(api.getBill).not.toHaveBeenCalled()
  })
  it("binds bounded continuations to the original selection", async () => {
    const api = service()
    vi.mocked(api.searchBills).mockResolvedValue({
      items: Array.from({ length: 20 }, (_, index) => ({ id: `bill:${index}`, text: "x".repeat(25_000) }))
    })
    const tool = definition(api, "search_bills")
    const first = await tool.execute({ query: "education", limit: 20 })
    assert.ok("structuredContent" in first)
    const data = first.structuredContent.data
    assert.ok(data && typeof data === "object" && !Array.isArray(data))
    assert.equal(typeof data.nextCursor, "string")
    expect(Buffer.byteLength(JSON.stringify({ data }))).toBeLessThanOrEqual(180_000)
    expect(await tool.execute({ query: "changed", limit: 20, cursor: data.nextCursor })).toHaveProperty("isError", true)
    expect(api.searchBills).toHaveBeenCalledOnce()
  })
})
