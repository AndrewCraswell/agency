import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { LegislationError } from "../legislation/errors.js"
import { createLogger } from "../observability/logger.js"
import { createLegislationMcpHandler, createLegislationResearchTools, type LegislationQueryApi } from "./tools.js"

const handlers = new Set<ReturnType<typeof createLegislationMcpHandler>>()
const logger = createLogger({ level: "error", service: "legislation-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...handlers].map(async (handler) => handler.close()))
  handlers.clear()
})

function createService(): LegislationQueryApi {
  return {
    compareBillVersions: vi.fn<LegislationQueryApi["compareBillVersions"]>(async () => ({
      billId: "bill:us:119:hr:1234",
      sections: []
    })),
    findRelatedBills: vi.fn<LegislationQueryApi["findRelatedBills"]>(async () => ({
      bills: [],
      id: "bill:us:119:hr:1234"
    })),
    getAmendment: vi.fn<LegislationQueryApi["getAmendment"]>(async ({ id }) => ({ amendment: { id } })),
    getBill: vi.fn<LegislationQueryApi["getBill"]>(async ({ id }) => ({ id, title: "A test bill" })),
    getBillVotes: vi.fn<LegislationQueryApi["getBillVotes"]>(async ({ billId }) => ({ billId, items: [] })),
    getBillText: vi.fn<LegislationQueryApi["getBillText"]>(async ({ id }) => ({ id, sections: [] })),
    getBillTimeline: vi.fn<LegislationQueryApi["getBillTimeline"]>(async ({ id }) => ({ events: [], id })),
    getEvent: vi.fn<LegislationQueryApi["getEvent"]>(async ({ id }) => ({ event: { id } })),
    getOrganization: vi.fn<LegislationQueryApi["getOrganization"]>(async ({ id }) => ({ organization: { id } })),
    getPerson: vi.fn<LegislationQueryApi["getPerson"]>(async ({ id }) => ({ person: { id } })),
    getSupportingMaterial: vi.fn<LegislationQueryApi["getSupportingMaterial"]>(async ({ id }) => ({
      material: { id }
    })),
    getVote: vi.fn<LegislationQueryApi["getVote"]>(async ({ id }) => ({ vote: { id } })),
    searchAmendments: vi.fn<LegislationQueryApi["searchAmendments"]>(async () => ({ items: [] })),
    searchBills: vi.fn<LegislationQueryApi["searchBills"]>(async (input) => ({ items: [], query: input.query })),
    searchBillText: vi.fn<LegislationQueryApi["searchBillText"]>(async (input) => ({
      items: [],
      query: input.query
    })),
    searchChanges: vi.fn<LegislationQueryApi["searchChanges"]>(async () => ({ items: [] })),
    searchEvents: vi.fn<LegislationQueryApi["searchEvents"]>(async () => ({ items: [] })),
    searchOrganizations: vi.fn<LegislationQueryApi["searchOrganizations"]>(async () => ({ items: [] })),
    searchPeople: vi.fn<LegislationQueryApi["searchPeople"]>(async () => ({ items: [] })),
    searchSupportingMaterials: vi.fn<LegislationQueryApi["searchSupportingMaterials"]>(async () => ({ items: [] })),
    searchVotes: vi.fn<LegislationQueryApi["searchVotes"]>(async () => ({ items: [] }))
  }
}

async function createClient(service = createService(), name = "legislation-test") {
  const handler = createLegislationMcpHandler(service, logger)
  handlers.add(handler)
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init))
  })
  const client = new Client({ name, version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
  await client.connect(transport)
  return { client, service, transport }
}

describe("legislation MCP tools", () => {
  it("pages oversized results identically through chat registry and stateless MCP requests", async () => {
    const service = createService()
    const items = Array.from({ length: 25 }, (_, index) => ({ id: `bill:${index}`, text: "x".repeat(25000) }))
    vi.mocked(service.searchBills).mockResolvedValue({ items })
    const definitions = createLegislationResearchTools(service, logger)
    const search = definitions.find((definition) => definition.name === "search_bills")
    expect(search).toBeDefined()
    const result = await search?.execute({ query: "education", limit: 25 })
    const pageSchema = z.object({
      items: z.array(z.object({ id: z.string(), text: z.string() })),
      nextCursor: z.string().optional()
    })
    const structured = z.object({ structuredContent: z.object({ data: z.json() }) }).parse(result)
    const first = pageSchema.parse(structured.structuredContent.data)
    expect(first.items.length).toBeGreaterThan(5)
    expect(first.items.length).toBeLessThan(25)
    const collected = [...first.items]
    let cursor = first.nextCursor
    const { client, transport } = await createClient(service)
    try {
      const publicResult = await client.callTool({ name: "search_bills", arguments: { query: "education", limit: 25 } })
      expect(publicResult.structuredContent).toEqual(structured.structuredContent)
      while (cursor) {
        const next = await client.callTool({
          name: "search_bills",
          arguments: { query: "education", limit: 25, cursor }
        })
        expect(next.isError).not.toBe(true)
        const page = pageSchema.parse(next.structuredContent?.data)
        collected.push(...page.items)
        cursor = page.nextCursor
        expect(collected.length).toBeLessThanOrEqual(25)
      }
      expect(collected).toEqual(items)
    } finally {
      await transport.close()
    }
  })

  it("excludes internal search fields before budgeting nested research results", async () => {
    const service = createService()
    vi.mocked(service.getBill).mockResolvedValue({
      bill: {
        id: "bill:us:119:hr:1234",
        title: "Education",
        summary: "Public bill summary",
        embedding: Array.from({ length: 1536 }, () => 0.123456),
        searchVector: "index".repeat(100_000),
        embeddingInputHash: "internal hash",
        embeddingModel: "internal model"
      },
      documents: [{ id: "document:1", text: "Public source text", searchVector: "internal index" }],
      nextChildCursor: "opaque-cursor",
      truncated: true
    })
    const { client, transport } = await createClient(service)
    try {
      const result = await client.callTool({ name: "get_bill", arguments: { id: "bill:us:119:hr:1234" } })
      expect(result.isError).not.toBe(true)
      expect(result.structuredContent).toEqual({
        data: {
          bill: { id: "bill:us:119:hr:1234", title: "Education" },
          documents: [{ id: "document:1", text: "Public source text" }],
          nextChildCursor: "opaque-cursor",
          truncated: true
        }
      })
      expect(JSON.stringify(result)).not.toContain("internal")
    } finally {
      await transport.close()
    }
  })

  it("keeps date inputs wire-safe through repeated protocol validation", async () => {
    const { client, service, transport } = await createClient()
    const timestamp = "2025-01-01T00:00:00Z"
    try {
      for (const request of [
        { name: "search_events", arguments: { from: timestamp, to: timestamp } },
        { name: "search_votes", arguments: { from: timestamp } },
        { name: "search_changes", arguments: { observedFrom: timestamp, observedTo: timestamp } }
      ]) {
        expect((await client.callTool(request)).isError).not.toBe(true)
      }
      expect(service.searchEvents).toHaveBeenCalledWith(
        expect.objectContaining({ from: new Date(timestamp), to: new Date(timestamp) })
      )
      expect(service.searchVotes).toHaveBeenCalledWith(expect.objectContaining({ from: new Date(timestamp) }))
      expect(service.searchChanges).toHaveBeenCalledWith(
        expect.objectContaining({ observedFrom: new Date(timestamp), observedTo: new Date(timestamp) })
      )
    } finally {
      await transport.close()
    }
  })
  it("counts both text and structured output against the total response byte budget", async () => {
    const service = createService()
    vi.mocked(service.getBill).mockResolvedValue({ text: "x".repeat(500_000) })
    const { client, transport } = await createClient(service)
    try {
      const result = await client.callTool({ name: "get_bill", arguments: { id: "bill:us:119:hr:1234" } })
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result)).toContain("result_limit")
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(900_000)
    } finally {
      await transport.close()
    }
  })
  it("advertises the exact bounded tool surface", async () => {
    const { client, transport } = await createClient()

    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "compare_bill_versions",
      "find_related_bills",
      "get_amendment",
      "get_amendments",
      "get_bill",
      "get_bill_text",
      "get_bill_timeline",
      "get_bill_votes",
      "get_bills",
      "get_event",
      "get_organization",
      "get_person",
      "get_supporting_material",
      "get_vote",
      "get_votes",
      "search_amendments",
      "search_amendments_for_bills",
      "search_bill_text",
      "search_bills",
      "search_changes",
      "search_events",
      "search_organizations",
      "search_people",
      "search_supporting_materials",
      "search_votes"
    ])
    await transport.close()
  })

  it("publishes item schemas for every array-valued tool parameter", async () => {
    const { client, transport } = await createClient()
    const result = await client.listTools()

    for (const advertisedTool of result.tools) {
      expect(arraySchemasMissingItems(advertisedTool.inputSchema)).toEqual([])
    }
    await transport.close()
  })

  it("does not advertise inputs removed by the public HTTP contract", async () => {
    const { client, transport } = await createClient()
    const result = await client.listTools()
    const tools = new Map(result.tools.map((tool) => [tool.name, inputPropertyNames(tool.inputSchema)]))

    expect(tools.get("get_bill")).not.toContain("childCursor")
    expect(tools.get("get_bill_timeline")).toEqual(expect.arrayContaining(["cursor", "limit"]))
    expect(tools.get("get_bill_timeline")).not.toEqual(expect.arrayContaining(["childCursor", "childLimit"]))
    expect(tools.get("find_related_bills")).not.toContain("includeSemantic")
    for (const name of [
      "get_amendment",
      "get_event",
      "get_organization",
      "get_person",
      "get_supporting_material",
      "get_vote"
    ]) {
      expect(tools.get(name)).not.toEqual(expect.arrayContaining(["cursor", "limit"]))
    }
    await transport.close()
  })

  it("returns structured canonical bill data", async () => {
    const { client, service, transport } = await createClient()

    const result = await client.callTool({
      arguments: { childLimit: 10, id: "bill:us:119:hr:1234" },
      name: "get_bill"
    })

    expect(result.isError).not.toBe(true)
    expect(result.structuredContent).toEqual({ data: { id: "bill:us:119:hr:1234", title: "A test bill" } })
    expect(service.getBill).toHaveBeenCalledWith({
      childLimit: 10,
      id: "bill:us:119:hr:1234"
    })
    await transport.close()
  })

  it("preserves a mapped API error category and retryability", async () => {
    const service: LegislationQueryApi = {
      ...createService(),
      getBill: async () => {
        throw new LegislationError("dependency_unavailable", "The API is temporarily unavailable", {
          details: { retryable: true }
        })
      }
    }
    const { client, transport } = await createClient(service)

    const result = await client.callTool({ arguments: { id: "bill:us:119:hr:1234" }, name: "get_bill" })

    expect(result.isError).toBe(true)
    const firstContent = result.content[0]
    expect(firstContent?.type).toBe("text")
    if (firstContent?.type !== "text") {
      throw new Error("Expected an MCP text error response")
    }
    expect(JSON.parse(firstContent.text)).toEqual({
      error: "dependency_unavailable",
      message: "The API is temporarily unavailable",
      retryable: true
    })
    await transport.close()
  })

  it("gets multiple bills and amendments in bounded single calls", async () => {
    const { client, service, transport } = await createClient()
    const billIds = ["bill:us:119:hr:1234", "bill:us:119:s:42"]
    const amendmentIds = ["amendment:us:119:hamdt:1", "amendment:us:119:samdt:2"]

    const billsResult = await client.callTool({
      arguments: { childLimit: 5, ids: billIds },
      name: "get_bills"
    })
    const amendmentsResult = await client.callTool({ arguments: { ids: amendmentIds }, name: "get_amendments" })
    const billAmendmentsResult = await client.callTool({
      arguments: { billIds, limit: 5 },
      name: "search_amendments_for_bills"
    })

    expect(billsResult.isError).not.toBe(true)
    expect(amendmentsResult.isError).not.toBe(true)
    expect(billAmendmentsResult.isError).not.toBe(true)
    expect(billsResult.structuredContent).toMatchObject({
      data: { items: billIds.map((id) => ({ data: { id, title: "A test bill" }, id })) }
    })
    expect(amendmentsResult.structuredContent).toMatchObject({
      data: { items: amendmentIds.map((id) => ({ data: { amendment: { id } }, id })) }
    })
    expect(service.getBill).toHaveBeenCalledTimes(2)
    expect(service.getBill).toHaveBeenNthCalledWith(1, { childLimit: 5, id: billIds[0] })
    expect(service.getBill).toHaveBeenNthCalledWith(2, { childLimit: 5, id: billIds[1] })
    expect(service.getAmendment).toHaveBeenCalledTimes(2)
    expect(service.searchAmendments).toHaveBeenCalledTimes(2)
    expect(service.searchAmendments).toHaveBeenNthCalledWith(1, { billId: billIds[0], limit: 5 })
    expect(service.searchAmendments).toHaveBeenNthCalledWith(2, { billId: billIds[1], limit: 5 })
    await transport.close()
  })

  it("keeps a missing batch item from discarding successful items", async () => {
    const missingId = "bill:us:119:hr:404"
    const foundId = "bill:us:119:hr:1234"
    const service: LegislationQueryApi = {
      ...createService(),
      getBill: vi.fn<LegislationQueryApi["getBill"]>(async ({ id }) => {
        if (id === missingId) {
          throw new LegislationError("not_found", `Bill ${id} was not found`)
        }
        return { id, title: "A test bill" }
      })
    }
    const { client, transport } = await createClient(service)

    const result = await client.callTool({ arguments: { ids: [foundId, missingId] }, name: "get_bills" })

    expect(result.isError).not.toBe(true)
    expect(result.structuredContent).toEqual({
      data: {
        items: [
          { data: { id: foundId, title: "A test bill" }, id: foundId },
          {
            error: { category: "not_found", message: `Bill ${missingId} was not found` },
            id: missingId
          }
        ]
      }
    })
    await transport.close()
  })

  it("accepts 25 bill identifiers in one bounded lookup", async () => {
    const { client, service, transport } = await createClient()
    const ids = Array.from({ length: 25 }, (_, index) => `bill:us:119:hr:${index + 1}`)

    const result = await client.callTool({ arguments: { childLimit: 1, ids }, name: "get_bills" })

    expect(result.isError).not.toBe(true)
    expect(service.getBill).toHaveBeenCalledTimes(25)
    await transport.close()
  })

  it("supports the complete discover, inspect, timeline, text, compare, and related-bill flow", async () => {
    const { client, service, transport } = await createClient()
    const billId = "bill:us:119:hr:1234"
    const calls = [
      { arguments: { mode: "lexical", query: "legislative data" }, name: "search_bills" },
      { arguments: { id: billId }, name: "get_bill" },
      { arguments: { ids: [billId] }, name: "get_bills" },
      { arguments: { id: billId }, name: "get_bill_timeline" },
      { arguments: { billId, mode: "lexical", query: "machine readable" }, name: "search_bill_text" },
      { arguments: { id: billId, versionCode: "ih" }, name: "get_bill_text" },
      {
        arguments: { billId, documentIds: ["document:introduced", "document:enrolled"] },
        name: "compare_bill_versions"
      },
      { arguments: { id: billId }, name: "find_related_bills" }
    ] as const

    for (const call of calls) {
      const result = await client.callTool(call)
      expect(result.isError).not.toBe(true)
    }
    expect(service.searchBills).toHaveBeenCalledOnce()
    expect(service.getBill).toHaveBeenCalledTimes(2)
    expect(service.getBillTimeline).toHaveBeenCalledOnce()
    expect(service.searchBillText).toHaveBeenCalledOnce()
    expect(service.getBillText).toHaveBeenCalledOnce()
    expect(service.compareBillVersions).toHaveBeenCalledOnce()
    expect(service.findRelatedBills).toHaveBeenCalledOnce()
    await transport.close()
  })

  it("rejects invalid canonical bill identifiers before calling the service", async () => {
    const { client, service, transport } = await createClient()

    const result = await client.callTool({ arguments: { id: "not-a-bill" }, name: "get_bill" })

    expect(result.isError).toBe(true)
    expect(service.getBill).not.toHaveBeenCalled()
    await transport.close()
  })

  it("rejects serialized responses above the hard payload limit", async () => {
    const service: LegislationQueryApi = {
      ...createService(),
      getBill: vi.fn<LegislationQueryApi["getBill"]>(async () => ({ text: "x".repeat(950_000) }))
    }
    const { client, transport } = await createClient(service)

    const result = await client.callTool({
      arguments: { id: "bill:us:119:hr:1234" },
      name: "get_bill"
    })

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("result_limit")
    await transport.close()
  })

  it("serves every expansion tool to two independent clients within the response budget", async () => {
    const calls = [
      { arguments: { jurisdictionId: "jurisdiction:us", query: "Smith" }, name: "search_people" },
      { arguments: { id: "person:congress:a000001" }, name: "get_person" },
      { arguments: { classification: "committee", jurisdictionId: "jurisdiction:us" }, name: "search_organizations" },
      { arguments: { id: "organization:congress:house" }, name: "get_organization" },
      { arguments: { jurisdictionId: "jurisdiction:us" }, name: "search_events" },
      { arguments: { id: "event:congress:meeting-1" }, name: "get_event" },
      { arguments: { billId: "bill:us:119:hr:1234" }, name: "search_votes" },
      { arguments: { billId: "bill:us:119:hr:1234" }, name: "get_bill_votes" },
      { arguments: { id: "vote:congress:house-1" }, name: "get_vote" },
      { arguments: { ids: ["vote:congress:house-1"] }, name: "get_votes" },
      { arguments: { billId: "bill:us:119:hr:1234" }, name: "search_amendments" },
      { arguments: { id: "amendment:congress:119-hamdt-1" }, name: "get_amendment" },
      { arguments: { billId: "bill:us:119:hr:1234" }, name: "search_supporting_materials" },
      { arguments: { id: "material:govinfo:crpt-1" }, name: "get_supporting_material" },
      { arguments: { jurisdictionId: "jurisdiction:us" }, name: "search_changes" }
    ] as const
    const clients = await Promise.all([
      createClient(createService(), "legislation-compatibility-a"),
      createClient(createService(), "legislation-compatibility-b")
    ])
    try {
      for (const { client } of clients) {
        for (const call of calls) {
          const result = await client.callTool(call)
          expect(result.isError).not.toBe(true)
          expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThan(900_000)
        }
      }
    } finally {
      await Promise.all(clients.map(async ({ transport }) => transport.close()))
    }
  })
})

function arraySchemasMissingItems(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => arraySchemasMissingItems(item, `${path}[${index}]`))
  }
  if (typeof value !== "object" || value === null) {
    return []
  }
  const schema = value as Record<string, unknown>
  const missing = schema.type === "array" && !("items" in schema) ? [path] : []
  return [
    ...missing,
    ...Object.entries(schema).flatMap(([key, item]) => arraySchemasMissingItems(item, `${path}.${key}`))
  ]
}

function inputPropertyNames(schema: unknown): string[] {
  if (typeof schema !== "object" || schema === null) {
    return []
  }
  const properties = Reflect.get(schema, "properties")
  return typeof properties === "object" && properties !== null ? Object.keys(properties) : []
}
