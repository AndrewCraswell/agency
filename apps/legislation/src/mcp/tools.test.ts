import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createLogger } from "../observability/logger.js"
import { createLegislationMcpHandler, type LegislationQueryApi } from "./tools.js"

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
    getBill: vi.fn<LegislationQueryApi["getBill"]>(async ({ id }) => ({ id, title: "A test bill" })),
    getBillText: vi.fn<LegislationQueryApi["getBillText"]>(async ({ id }) => ({ id, sections: [] })),
    getBillTimeline: vi.fn<LegislationQueryApi["getBillTimeline"]>(async ({ id }) => ({ events: [], id })),
    searchBills: vi.fn<LegislationQueryApi["searchBills"]>(async (input) => ({ items: [], query: input.query })),
    searchBillText: vi.fn<LegislationQueryApi["searchBillText"]>(async (input) => ({
      items: [],
      query: input.query
    }))
  }
}

async function createClient(service = createService()) {
  const handler = createLegislationMcpHandler(service, logger)
  handlers.add(handler)
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init))
  })
  const client = new Client({ name: "legislation-test", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
  await client.connect(transport)
  return { client, service, transport }
}

describe("legislation MCP tools", () => {
  it("advertises the exact bounded tool surface", async () => {
    const { client, transport } = await createClient()

    const result = await client.listTools()

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      "compare_bill_versions",
      "find_related_bills",
      "get_bill",
      "get_bill_text",
      "get_bill_timeline",
      "search_bill_text",
      "search_bills"
    ])
    await transport.close()
  })

  it("returns structured canonical bill data", async () => {
    const { client, service, transport } = await createClient()

    const result = await client.callTool({
      arguments: { childCursor: "eyJvZmZzZXQiOjEwfQ", childLimit: 10, id: "bill:us:119:hr:1234" },
      name: "get_bill"
    })

    expect(result.isError).not.toBe(true)
    expect(result.structuredContent).toEqual({ data: { id: "bill:us:119:hr:1234", title: "A test bill" } })
    expect(service.getBill).toHaveBeenCalledWith({
      childCursor: "eyJvZmZzZXQiOjEwfQ",
      childLimit: 10,
      id: "bill:us:119:hr:1234"
    })
    await transport.close()
  })

  it("supports the complete discover, inspect, timeline, text, compare, and related-bill flow", async () => {
    const { client, service, transport } = await createClient()
    const billId = "bill:us:119:hr:1234"
    const calls = [
      { arguments: { mode: "lexical", query: "legislative data" }, name: "search_bills" },
      { arguments: { id: billId }, name: "get_bill" },
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
    expect(service.getBill).toHaveBeenCalledOnce()
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
})
