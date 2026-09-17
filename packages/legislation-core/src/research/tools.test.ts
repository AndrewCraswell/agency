import assert from "node:assert/strict"
import { describe, expect, it, vi } from "vitest"
import { LegislationError } from "../domain/errors"
import { createLogger } from "../observability/logger"
import type { Telemetry } from "../observability/telemetry"
import { describeAnalytics } from "./analytics-catalog"
import { prepareResultPage } from "./result-pages"
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
  it("preserves supporting-material organization, session and date scope", async () => {
    const searchSupportingMaterials = vi.fn<LegislationQueryApi["searchSupportingMaterials"]>(async () => ({
      items: []
    }))
    const input = {
      query: "report",
      organizationId: "organization:us:one",
      sessionIds: ["session:us:116"],
      documentFrom: "2019-01-01",
      documentTo: "2020-12-31"
    }
    await definition({ ...service(), searchSupportingMaterials }, "search_supporting_materials").execute(input)
    expect(searchSupportingMaterials).toHaveBeenCalledWith({ ...input, mode: "lexical" })
  })
  it("applies a passage's selected bill and document classification at the service boundary", async () => {
    const searchBillText = vi.fn<LegislationQueryApi["searchBillText"]>(async () => ({ items: [] }))
    await definition({ ...service(), searchBillText }, "search_bill_text").execute({
      query: "working group",
      billId: "bill:ca:20232024:ab:2652",
      classifications: ["version"]
    })
    expect(searchBillText).toHaveBeenCalledWith(
      expect.objectContaining({ billIds: ["bill:ca:20232024:ab:2652"], documentClassifications: ["version"] })
    )
  })
  it("forwards historical membership filters and comparison pagination", async () => {
    const getMemberships = vi.fn<NonNullable<LegislationQueryApi["getMemberships"]>>(async () => ({ items: [] }))
    const compareBillVersions = vi.fn<LegislationQueryApi["compareBillVersions"]>(async () => ({ changes: [] }))
    const api = { ...service(), getMemberships, compareBillVersions }
    await definition(api, "get_memberships").execute({
      personId: "person:us:one",
      from: "2019-01-01",
      to: "2020-12-31",
      isCurrent: false
    })
    expect(getMemberships).toHaveBeenCalledWith({
      personId: "person:us:one",
      from: "2019-01-01",
      to: "2020-12-31",
      isCurrent: false
    })
    await definition(api, "compare_bill_versions").execute({
      billId: "bill:us:116:hr:1",
      documentIds: ["left", "right"],
      limit: 1
    })
    expect(compareBillVersions).toHaveBeenCalledWith({
      billId: "bill:us:116:hr:1",
      documentIds: ["left", "right"],
      limit: 1,
      cursor: undefined
    })
  })
  it("registers analytical discovery and executes validated analytical plans", async () => {
    const analyzeLegislation = vi.fn(async () => ({ rows: [{ total: 3 }] }))
    const api = {
      ...service(),
      analyzeLegislation,
      describeAnalytics: async (datasets?: string[]) => describeAnalytics(datasets)
    }
    const catalog = await definition(api, "describe_analytics").execute({ datasets: ["bills"] })
    expect(catalog).toHaveProperty("structuredContent.data.details.0.name", "bills")
    const result = await definition(api, "analyze_legislation").execute({
      dataset: "bills",
      metrics: [{ name: "total", operation: "countDistinct", field: "id" }]
    })
    expect(result).toHaveProperty("structuredContent.data.rows.0.total", 3)
    expect(analyzeLegislation).toHaveBeenCalledWith(expect.objectContaining({ dataset: "bills", limit: 20 }))
    expect(definition(api, "analyze_legislation").annotations?.readOnlyHint).toBe(true)
  })
  it("reports validation, execution, and handled batch failures", async () => {
    const reportFailure = vi.fn<NonNullable<Telemetry["reportFailure"]>>()
    const telemetry: Telemetry = {
      reportFailure,
      observe: async (_name, _metadata, operation) => await operation(),
      shutdown: async () => undefined
    }
    const api = {
      ...service(),
      getBill: async () => {
        throw new LegislationError("not_found", "Missing record")
      }
    }
    const tools = createLegislationResearchTools(api, logger, telemetry)
    await tools.find((tool) => tool.name === "get_bill")!.execute({ id: "invalid" })
    await tools.find((tool) => tool.name === "get_bill")!.execute({ id: "bill:us:116:hr:1" })
    await tools.find((tool) => tool.name === "get_bills")!.execute({ ids: ["bill:us:116:hr:1"] })
    expect(reportFailure.mock.calls.map((call) => call[1].stage)).toEqual(["validation", "execution", "batch-item"])
  })
  it("exposes discovered scope and collection continuations without dropping inputs", async () => {
    const read = vi.fn<(input: Readonly<Record<string, unknown>>) => Promise<{ items: unknown[] }>>(async () => ({
      items: []
    }))
    const api = { ...service(), listSessions: read, getMemberships: read, getSupportingMaterial: read }
    const cases = [
      { name: "list_sessions", selection: { jurisdictionId: "jurisdiction:us", limit: 2 }, cursor: "page" },
      { name: "get_memberships", selection: { personId: "person:congress:one", limit: 3 }, cursor: "members" },
      { name: "get_supporting_material", selection: { id: "material:congress:one", limit: 4 }, cursor: "sections" }
    ]
    for (const { name, selection, cursor } of cases) {
      const page = prepareResultPage(name, selection, { items: [], nextCursor: cursor }, 0)
      assert.ok(page && typeof page === "object" && !Array.isArray(page))
      await definition(api, name).execute({ ...selection, cursor: page.nextCursor })
    }
    expect(read.mock.calls.map((call) => call[0])).toEqual([
      { jurisdictionId: "jurisdiction:us", cursor: "page", limit: 2 },
      { personId: "person:congress:one", cursor: "members", limit: 3 },
      { id: "material:congress:one", cursor: "sections", limit: 4 }
    ])
  })
  it("reports wrapped SQL timeouts without exposing database internals", async () => {
    const api = service()
    const error = new Error("private SQL", { cause: Object.assign(new Error("private SQL"), { code: "57014" }) })
    const tool = definition(
      {
        ...api,
        searchBills: async () => {
          throw error
        }
      },
      "search_bills"
    )
    const result = await tool.execute({ query: "HR 1" })
    expect(result).toHaveProperty("isError", true)
    const failure = JSON.parse(result.content[0]!.text)
    expect(failure).toMatchObject({ error: "dependency_unavailable", retryable: true })
    expect(failure.message).toContain("timed out")
    expect(failure.message).not.toContain("private SQL")
  })

  it("reports invalid tool inputs as invalid requests", async () => {
    const result = await definition(service(), "get_bill").execute({ id: "H.R. 1" })
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({ error: "invalid_request" })
  })

  it.each(["get_person", "get_organization"])("rejects unsupported child limits for %s", async (name) => {
    const read = vi.fn(async () => ({ items: [] }))
    const api = { ...service(), getPerson: read, getOrganization: read }
    const id = name === "get_person" ? "person:us:one" : "organization:us:one"
    await definition(api, name).execute({ id })
    expect(read).toHaveBeenCalledWith({ id })
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
    const scoped = JSON.parse(Buffer.from(data.nextCursor.slice("research-cursor:".length), "base64url").toString())
    const cursor = JSON.parse(Buffer.from(scoped.upstream.slice("research-page:".length), "base64url").toString())
    delete cursor.snapshot
    scoped.upstream = `research-page:${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`
    const missingSnapshot = `research-cursor:${Buffer.from(JSON.stringify(scoped)).toString("base64url")}`
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
