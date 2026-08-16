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
    "get_bill",
    "get_bill_text",
    "get_bill_timeline",
    "search_bill_text",
    "search_bills"
  ]
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
    { arguments: { id: billId }, name: "find_related_bills" }
  ]
  for (const call of calls) {
    const result = await client.callTool(call)
    if (result.isError === true) {
      throw new Error(`Deployment smoke tool call failed: ${call.name}`)
    }
  }
  process.stdout.write(
    `${JSON.stringify({ health: health.status, ready: ready.status, toolCalls: calls.length, tools: names.length })}\n`
  )
} finally {
  await transport.close()
}
