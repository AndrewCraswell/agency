import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"

const baseUrl = process.env.LEGISLATION_SMOKE_BASE_URL
if (baseUrl === undefined) {
  throw new Error("LEGISLATION_SMOKE_BASE_URL is required")
}
const token = process.env.LEGISLATION_SMOKE_TOKEN
const billId = process.env.LEGISLATION_SMOKE_BILL_ID
const firstDocumentId = process.env.LEGISLATION_SMOKE_DOCUMENT_ID_A
const secondDocumentId = process.env.LEGISLATION_SMOKE_DOCUMENT_ID_B
if (billId === undefined || firstDocumentId === undefined || secondDocumentId === undefined) {
  throw new Error("LEGISLATION_SMOKE_BILL_ID and both LEGISLATION_SMOKE_DOCUMENT_ID values are required")
}
const root = new URL(baseUrl)
const health = await fetch(new URL("/health", root))
const ready = await fetch(new URL("/ready", root))
if (!health.ok || !ready.ok) {
  throw new Error(`Health smoke failed: health=${health.status}, ready=${ready.status}`)
}

const transport = new StreamableHTTPClientTransport(new URL("/mcp", root), {
  authProvider: token === undefined ? undefined : { token: async () => token }
})
const client = new Client(
  { name: "legislation-deployment-smoke", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } }
)
try {
  await client.connect(transport)
  const tools = await client.listTools()
  const names = tools.tools.map((tool) => tool.name).sort()
  const expected = [
    "compare_bill_versions",
    "find_related_bills",
    "get_amendment",
    "get_bill",
    "get_bill_text",
    "get_bill_timeline",
    "get_calendar",
    "get_event",
    "get_organization",
    "get_person",
    "get_supporting_material",
    "get_vote",
    "search_amendments",
    "search_bill_text",
    "search_bills",
    "search_changes",
    "search_events",
    "search_organizations",
    "search_people",
    "search_supporting_materials",
    "search_votes"
  ].sort()
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected MCP tool set: ${JSON.stringify(names)}`)
  }
  const calls = [
    { arguments: { mode: "lexical", query: "legislative" }, name: "search_bills" },
    { arguments: { id: billId }, name: "get_bill" },
    { arguments: { id: billId }, name: "get_bill_timeline" },
    { arguments: { billId, mode: "lexical", query: "section" }, name: "search_bill_text" },
    { arguments: { documentId: firstDocumentId, id: billId }, name: "get_bill_text" },
    {
      arguments: { billId, documentIds: [firstDocumentId, secondDocumentId] },
      name: "compare_bill_versions"
    },
    { arguments: { id: billId }, name: "find_related_bills" },
    { arguments: { jurisdictionId: "jurisdiction:us", limit: 1 }, name: "get_calendar" },
    { arguments: { jurisdictionId: "jurisdiction:us", limit: 1 }, name: "search_changes" }
  ]
  let toolCalls = 0
  const call = async (request) => {
    const result = await client.callTool(request)
    toolCalls += 1
    if (result.isError === true) {
      const details = result.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join(" ")
      throw new Error(
        `Deployment smoke tool call failed: ${request.name} ${JSON.stringify(request.arguments)}${details === "" ? "" : `: ${details}`}`
      )
    }
    return result.structuredContent?.data
  }
  for (const request of calls) {
    await call(request)
  }
  const discoveryCalls = [
    {
      detail: "get_person",
      search: { arguments: { jurisdictionId: "jurisdiction:us", limit: 1 }, name: "search_people" }
    },
    {
      detail: "get_organization",
      search: {
        arguments: { classification: "committee", jurisdictionId: "jurisdiction:us", limit: 1 },
        name: "search_organizations"
      }
    },
    {
      detail: "get_event",
      search: { arguments: { jurisdictionId: "jurisdiction:us", limit: 1 }, name: "search_events" }
    },
    {
      detail: "get_vote",
      search: { arguments: { billId, limit: 1 }, name: "search_votes" }
    },
    {
      detail: "get_amendment",
      search: { arguments: { jurisdictionId: "jurisdiction:us", limit: 1 }, name: "search_amendments" }
    },
    {
      detail: "get_supporting_material",
      search: {
        arguments: { classification: "committee-report", jurisdictionId: "jurisdiction:us", limit: 1 },
        name: "search_supporting_materials"
      }
    }
  ]
  for (const discovery of discoveryCalls) {
    const data = await call(discovery.search)
    const item = data?.items?.[0]
    if (typeof item?.id !== "string") {
      throw new Error(`Deployment smoke fixture missing for ${discovery.detail}`)
    }
    await call({ arguments: { id: item.id, limit: 1 }, name: discovery.detail })
  }
  process.stdout.write(
    `${JSON.stringify({ health: health.status, ready: ready.status, toolCalls, tools: names.length })}\n`
  )
} finally {
  await transport.close()
}
