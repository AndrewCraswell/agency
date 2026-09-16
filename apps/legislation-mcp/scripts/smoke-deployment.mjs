import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"

const base = URL.parse(process.env.LEGISLATION_MCP_SMOKE_BASE_URL ?? "")
if (
  !base ||
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
) {
  throw new Error("LEGISLATION_MCP_SMOKE_BASE_URL must be a credential-free HTTPS origin")
}
const token = process.env.LEGISLATION_MCP_SMOKE_TOKEN?.trim()
const billId = process.env.LEGISLATION_SMOKE_BILL_ID?.trim()
if (!token || !billId) throw new Error("LEGISLATION_MCP_SMOKE_TOKEN and LEGISLATION_SMOKE_BILL_ID are required")
const resource = new URL("/mcp", base)
const boundedFetch = (input, init = {}) => {
  const target = new URL(input instanceof Request ? input.url : String(input))
  if (target.origin !== base.origin) throw new Error("Smoke request attempted an unconfigured origin")
  return fetch(input, {
    ...init,
    redirect: "error",
    signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(init.signal ? [init.signal] : [])])
  })
}
for (const path of ["/health", "/ready"]) {
  const response = await boundedFetch(new URL(path, base))
  if (!response.ok) throw new Error(`MCP ${path} failed with status ${response.status}`)
  await response.text()
}
const metadata = await boundedFetch(new URL("/.well-known/oauth-protected-resource/mcp", base))
const discovery = await metadata.json()
if (!metadata.ok || discovery.resource !== resource.href || discovery.bearer_methods_supported?.[0] !== "header") {
  throw new Error("MCP protected-resource metadata does not match the configured resource")
}
const anonymous = await boundedFetch(resource, { method: "POST", body: "{}" })
if (anonymous.status !== 401 || !anonymous.headers.get("www-authenticate")?.includes("resource_metadata=")) {
  throw new Error("MCP anonymous request did not receive the protected-resource challenge")
}
await anonymous.text()
const transport = new StreamableHTTPClientTransport(resource, {
  requestInit: { headers: { authorization: `Bearer ${token}` } },
  fetch: boundedFetch
})
const client = new Client({ name: "legislation-mcp-smoke", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
try {
  await client.connect(transport)
  const tools = await client.listTools()
  const names = new Set(tools.tools.map((tool) => tool.name))
  const calls = [
    { name: "search_bills", arguments: { query: "legislative", mode: "lexical", limit: 1 } },
    { name: "get_bill", arguments: { id: billId } },
    { name: "get_bill_timeline", arguments: { id: billId, limit: 1 } },
    { name: "search_events", arguments: { jurisdictionId: "jurisdiction:us", limit: 1 } }
  ]
  for (const call of calls) {
    if (!names.has(call.name)) throw new Error(`Required MCP tool is missing: ${call.name}`)
    const result = await client.callTool(call)
    if (result.isError || !result.structuredContent || Buffer.byteLength(JSON.stringify(result)) > 900_000) {
      throw new Error(`MCP tool smoke failed: ${call.name}`)
    }
  }
  process.stdout.write(`${JSON.stringify({ status: "ok", tools: names.size, calls: calls.length })}\n`)
} finally {
  await transport.close()
}
