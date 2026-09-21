import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import {
  deploymentSmokeConfig,
  requestMachineAccessToken,
  sentryCanaryArguments,
  sentryCanaryRedactionValue
} from "./deployment-smoke-config.mjs"

const configuration = deploymentSmokeConfig(process.env)
const { base, billId, expectedCommitSha, fullStateAcceptance, jurisdictionId, sentryCanary } = configuration
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
  const body = await response.json()
  if (body.commitSha !== expectedCommitSha) {
    throw new Error(`MCP ${path} commit does not match the expected Git commit`)
  }
}
const metadata = await boundedFetch(new URL("/.well-known/oauth-protected-resource/mcp", base))
const discovery = await metadata.json()
if (
  !metadata.ok ||
  discovery.resource !== resource.href ||
  discovery.bearer_methods_supported?.[0] !== "header" ||
  !Array.isArray(discovery.authorization_servers) ||
  discovery.authorization_servers.length !== 1
) {
  throw new Error("MCP protected-resource metadata does not match the configured resource")
}
const anonymous = await boundedFetch(resource, { method: "POST", body: "{}" })
if (anonymous.status !== 401 || !anonymous.headers.get("www-authenticate")?.includes("resource_metadata=")) {
  throw new Error("MCP anonymous request did not receive the protected-resource challenge")
}
await anonymous.text()
const token = await requestMachineAccessToken(configuration, discovery.authorization_servers[0])
const transport = new StreamableHTTPClientTransport(resource, {
  requestInit: { headers: { authorization: `Bearer ${token}` } },
  fetch: boundedFetch
})
const client = new Client({ name: "legislation-mcp-smoke", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
try {
  await client.connect(transport)
  const tools = await client.listTools()
  const names = new Set(tools.tools.map((tool) => tool.name))
  const called = new Set()
  const call = async (name, arguments_) => {
    if (!names.has(name)) throw new Error(`Required MCP tool is missing: ${name}`)
    const result = await client.callTool({ name, arguments: arguments_ })
    if (result.isError || !result.structuredContent || Buffer.byteLength(JSON.stringify(result)) > 900_000) {
      throw new Error(`MCP tool smoke failed: ${name}`)
    }
    called.add(name)
    return result.structuredContent.data
  }
  const strings = (value, predicate, found = []) => {
    if (typeof value === "string") {
      if (predicate(value)) found.push(value)
      return found
    }
    if (Array.isArray(value)) {
      for (const item of value) strings(item, predicate, found)
      return found
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) strings(item, predicate, found)
    }
    return found
  }
  const canonical = (value, prefix) => [...new Set(strings(value, (item) => item.startsWith(`${prefix}:`)))]
  await call("search_bills", {
    query: "legislative",
    jurisdictionIds: jurisdictionId ? [jurisdictionId] : undefined,
    mode: "lexical",
    limit: 1
  })
  const bill = await call("get_bill", { id: billId })
  await call("get_bill_timeline", { id: billId, limit: 1 })
  await call("search_events", { jurisdictionId: jurisdictionId ?? "jurisdiction:us", limit: 1 })

  if (sentryCanary) {
    const result = await client.callTool({ name: "get_bill", arguments: sentryCanaryArguments(configuration) })
    const serialized = JSON.stringify(result)
    if (!result.isError) throw new Error("The controlled staging Sentry canary did not produce an expected failure")
    if (serialized.includes(sentryCanaryRedactionValue)) {
      throw new Error("The controlled staging Sentry canary echoed its redaction sentinel")
    }
  }

  if (fullStateAcceptance) {
    await call("describe_analytics", { datasets: ["bills"] })
    await call("analyze_legislation", {
      dataset: "bills",
      metrics: [{ name: "total", operation: "countDistinct", field: "id" }]
    })
    await call("resolve_record", { kind: "bill", id: billId })
    await call("list_jurisdictions", { query: jurisdictionId.replace("jurisdiction:", ""), limit: 10 })
    await call("list_sessions", { jurisdictionId, limit: 10 })
    await call("get_bills", { ids: [billId], childLimit: 1 })
    await call("search_bill_text", { billId, query: "the", mode: "lexical", limit: 1 })
    const billText = await call("get_bill_text", { id: billId, limit: 2 })
    const billDocuments = await call("read_record_collection", {
      collection: "bill-documents",
      recordId: billId,
      limit: 10
    })
    const documentIds = [
      ...new Set([
        ...canonical(bill, "document"),
        ...canonical(billText, "document"),
        ...canonical(billDocuments, "document")
      ])
    ]
    if (documentIds.length === 0) throw new Error(`No document fixture discovered for ${billId}`)
    await call("get_document_sections", { documentId: documentIds[0], limit: 1 })
    if (documentIds.length < 2) throw new Error(`Two document fixtures are required to compare ${billId}`)
    await call("compare_bill_versions", { billId, documentIds: documentIds.slice(0, 2), limit: 1 })
    await call("find_related_bills", { id: billId, limit: 1 })

    const people = await call("search_people", { jurisdictionId, isActive: true, limit: 5 })
    const personId = canonical(people, "person")[0]
    if (!personId) throw new Error(`No person fixture discovered for ${jurisdictionId}`)
    await call("get_person", { id: personId })
    await call("get_memberships", { personId, limit: 2 })
    await call("get_sponsored_bills", { id: personId, limit: 1 })

    const organizations = await call("search_organizations", {
      jurisdictionId,
      classification: "committee",
      limit: 5
    })
    const organizationId = canonical(organizations, "organization")[0]
    if (!organizationId) throw new Error(`No committee fixture discovered for ${jurisdictionId}`)
    await call("get_organization", { id: organizationId })
    await call("get_memberships", { organizationId, limit: 2 })
    await call("get_committee_bills", { id: organizationId, limit: 1 })

    const events = await call("search_events", { jurisdictionId, sort: "starts-desc", limit: 5 })
    const eventId = canonical(events, "event")[0]
    if (!eventId) throw new Error(`No event fixture discovered for ${jurisdictionId}`)
    await call("get_event", { id: eventId })

    const votes = await call("search_votes", { billId, limit: 5 })
    const billVotes = await call("get_bill_votes", { billId, limit: 5 })
    const voteId = [...canonical(votes, "vote"), ...canonical(billVotes, "vote")][0]
    if (!voteId) throw new Error(`No vote fixture discovered for ${billId}`)
    await call("get_vote", { id: voteId })
    await call("get_votes", { ids: [voteId] })

    const amendments = await call("search_amendments", { jurisdictionId, limit: 5 })
    const amendmentId = canonical(amendments, "amendment")[0]
    if (!amendmentId) throw new Error(`No amendment fixture discovered for ${jurisdictionId}`)
    await call("get_amendment", { id: amendmentId })
    await call("get_amendments", { ids: [amendmentId] })
    await call("search_amendments_for_bills", { billIds: [billId], jurisdictionId, limit: 1 })

    const materials = await call("search_supporting_materials", { jurisdictionId, limit: 5 })
    const materialId = canonical(materials, "material")[0]
    if (!materialId) throw new Error(`No supporting-material fixture discovered for ${jurisdictionId}`)
    await call("get_supporting_material", { id: materialId, limit: 1 })
    await call("search_changes", { jurisdictionId, limit: 1 })

    const uncalled = [...names].filter((name) => !called.has(name))
    if (uncalled.length > 0) throw new Error(`MCP tools were not exercised: ${uncalled.join(", ")}`)
  }
  process.stdout.write(
    `${JSON.stringify({ calls: called.size, commitSha: expectedCommitSha, sentryCanary, status: "ok", tools: names.size })}\n`
  )
} finally {
  await transport.close()
}
