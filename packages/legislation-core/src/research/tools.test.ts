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
  it.each(["get_person", "get_organization"])("preserves bounded child limits for %s", async (name) => {
    const read = vi.fn(async () => ({ items: [] }))
    const api = { ...service(), getPerson: read, getOrganization: read }
    const id = name === "get_person" ? "person:us:one" : "organization:us:one"
    await definition(api, name).execute({ id, limit: 1 })
    expect(read).toHaveBeenCalledWith({ id, limit: 1 })
    expect(await definition(api, name).execute({ id, limit: 101 })).toHaveProperty("isError", true)
    expect(read).toHaveBeenCalledOnce()
  })

  it.each(["get_vote", "get_votes", "get_bill_votes"])("pages every position losslessly for %s", async (name) => {
    const positions = Array.from({ length: 430 }, (_, index) => ({
      person: { id: `person:us:${index}`, name: `Member ${index}`, biography: "x".repeat(900) },
      position: { sourceIdentity: String(index), option: index === 0 ? "no" : "yes" }
    }))
    const detail = { vote: { id: "vote:us:roll-1", yesCount: 429, noCount: 1 }, positions }
    const api = {
      ...service(),
      getVote: vi.fn(async () => detail),
      getBillVotes: vi.fn(async () => ({ items: [detail], truncated: false }))
    }
    const tool = definition(api, name)
    let selection: Record<string, unknown> = { billId: "bill:us:115:hr:699", limit: 25 }
    if (name === "get_vote") selection = { id: "vote:us:roll-1" }
    if (name === "get_votes") selection = { ids: ["vote:us:roll-1"] }
    let cursor: unknown
    const collected: unknown[] = []
    let pages = 0
    do {
      const result = await tool.execute({ ...selection, cursor })
      assert.ok("structuredContent" in result)
      const data = result.structuredContent.data
      assert.ok(data && typeof data === "object" && !Array.isArray(data))
      expect(Buffer.byteLength(JSON.stringify(result.structuredContent))).toBeLessThanOrEqual(180000)
      let page = data
      if (name !== "get_vote") {
        assert.ok(Array.isArray(data.items))
        const entry = data.items[0]
        assert.ok(entry && typeof entry === "object" && !Array.isArray(entry))
        const nested = name === "get_votes" ? entry.data : entry
        assert.ok(nested && typeof nested === "object" && !Array.isArray(nested))
        page = nested
      }
      assert.ok(Array.isArray(page.positions))
      expect(page.positionOffset).toBe(collected.length)
      expect(page.vote).toEqual(detail.vote)
      collected.push(...page.positions)
      cursor = data.nextCursor
      pages++
      assert.ok(pages < 10)
    } while (cursor)
    expect(pages).toBeGreaterThan(1)
    expect(collected).toEqual(positions)
  })

  it("rejects vote continuation after source data or selection changes", async () => {
    const detail = {
      vote: { id: "vote:us:roll-1" },
      positions: Array.from({ length: 300 }, (_, index) => ({ sourceIdentity: String(index), text: "x".repeat(1000) }))
    }
    const api = { ...service(), getVote: vi.fn(async () => detail) }
    const tool = definition(api, "get_vote")
    const first = await tool.execute({ id: "vote:us:roll-1" })
    assert.ok("structuredContent" in first)
    const data = first.structuredContent.data
    assert.ok(data && typeof data === "object" && !Array.isArray(data))
    assert.ok(typeof data.nextCursor === "string")
    const cursor = JSON.parse(Buffer.from(data.nextCursor.slice("research-page:".length), "base64url").toString())
    delete cursor.snapshot
    const missingSnapshot = `research-page:${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`
    expect(await tool.execute({ id: "vote:us:roll-1", cursor: missingSnapshot })).toHaveProperty("isError", true)
    expect(await tool.execute({ id: "vote:us:other", cursor: data.nextCursor })).toHaveProperty("isError", true)
    detail.positions.reverse()
    expect(await tool.execute({ id: "vote:us:roll-1", cursor: data.nextCursor })).toHaveProperty("isError", true)
  })
  it("preserves all roll calls through local position pages and upstream continuation", async () => {
    const positions = Array.from({ length: 300 }, (_, index) => ({
      sourceIdentity: String(index),
      text: "x".repeat(1000)
    }))
    const firstVote = { vote: { id: "vote:us:first" }, positions }
    const emptyVote = { vote: { id: "vote:us:empty" }, positions: [] }
    const lastVote = { vote: { id: "vote:us:last" }, positions: [{ sourceIdentity: "last" }] }
    const api = {
      ...service(),
      getBillVotes: vi.fn(async (input: { billId: string; cursor?: string; limit?: number }) => {
        if (input.cursor === "upstream-page") return { items: [lastVote], truncated: false }
        return { items: [firstVote, emptyVote], nextCursor: "upstream-page", truncated: true }
      })
    }
    const tool = definition(api, "get_bill_votes")
    const allPositions: unknown[] = []
    const voteIds = new Set<unknown>()
    let cursor: unknown
    let pageCount = 0
    do {
      const result = await tool.execute({ billId: "bill:us:115:hr:699", limit: 2, cursor })
      assert.ok("structuredContent" in result)
      const data = result.structuredContent.data
      assert.ok(data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.items))
      expect(Buffer.byteLength(JSON.stringify(result.structuredContent))).toBeLessThanOrEqual(180000)
      for (const item of data.items) {
        assert.ok(item && typeof item === "object" && !Array.isArray(item) && Array.isArray(item.positions))
        assert.ok(item.vote && typeof item.vote === "object" && !Array.isArray(item.vote))
        voteIds.add(item.vote.id)
        allPositions.push(...item.positions)
      }
      cursor = data.nextCursor
      pageCount++
      assert.ok(pageCount < 10)
    } while (cursor)
    expect([...voteIds]).toEqual(["vote:us:first", "vote:us:empty", "vote:us:last"])
    expect(allPositions).toEqual([...positions, ...lastVote.positions])
    expect(api.getBillVotes).toHaveBeenLastCalledWith({
      billId: "bill:us:115:hr:699",
      limit: 2,
      cursor: "upstream-page"
    })
  })
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
