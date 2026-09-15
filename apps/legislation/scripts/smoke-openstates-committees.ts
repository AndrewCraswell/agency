import assert from "node:assert/strict"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createCompositeHttpApiHandler } from "../src/api/http.js"
import { createOrganizationDetailReadRepository } from "../src/api/organization-detail-read-repository.js"
import { createOrganizationDetailReadApiHandler } from "../src/api/organization-detail-read-routes.js"
import { createOrganizationMembersRepository } from "../src/api/organization-members-read-repository.js"
import { createOrganizationMembersReadApiHandler } from "../src/api/organization-members-read-routes.js"
import { createPersonDetailReadApiHandler } from "../src/api/person-detail-read-routes.js"
import { createDatabase } from "../src/db/database.js"
import { getPersonDetailRead } from "../src/db/queries/person-detail-read.js"
import { organizationMemberships, organizations } from "../src/db/schema/schema.js"
import { createMcpHttpQueryAdapter } from "../src/mcp/http-query-adapter.js"
import { close, createLegislationServer } from "../src/mcp/server.js"
import { createLegislationMcpHandler } from "../src/mcp/tools.js"
import { createLogger } from "../src/observability/logger.js"

const state = z.enum(["nc", "ak"]).parse(process.argv[2])
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!url) {
  throw new Error("LEGISLATION_TEST_DATABASE_URL is required")
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Smoke target must be local legislation_test")
}
const { database, pool } = createDatabase({ url, maxConnections: 2, connectionTimeoutMs: 5000, idleTimeoutMs: 10000 })
const server = createLegislationServer({
  apiHandler: createCompositeHttpApiHandler([
    createOrganizationMembersReadApiHandler(createOrganizationMembersRepository(database)),
    createOrganizationDetailReadApiHandler(createOrganizationDetailReadRepository(database, "http://127.0.0.1")),
    createPersonDetailReadApiHandler({ getPersonDetail: (id) => getPersonDetailRead(database, id) })
  ]),
  logger: createLogger({ level: "error", service: "openstates-committee-smoke", write: () => undefined })
})
const pageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      person: z.object({ id: z.string() }),
      organization: z.object({ id: z.string() }),
      effectiveStartDate: z.string().nullable(),
      effectiveEndDate: z.string().nullable()
    })
  ),
  links: z.object({ next: z.string().nullable() }),
  meta: z.object({ warnings: z.array(z.string()).optional() })
})
let mcp: ReturnType<typeof createLegislationMcpHandler> | undefined
let client: Client | undefined
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  const base = `http://127.0.0.1:${address.port}`
  const handler = createLegislationMcpHandler(
    createMcpHttpQueryAdapter({ apiBaseUrl: base, getApiAccessToken: () => undefined, timeoutMs: 10000 }),
    createLogger({ level: "error", service: "openstates-mcp-smoke", write: () => undefined })
  )
  mcp = handler
  // SDK protocol and real HTTP adapter; in-process MCP transport does not verify hosted authentication.
  const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init))
  })
  client = new Client({ name: "openstates-local-smoke", version: "1.0.0" }, { versionNegotiation: { mode: "auto" } })
  await client.connect(transport)
  const tools = await client.listTools()
  assert.ok(tools.tools.some((tool) => tool.name === "get_organization"))
  assert.ok(tools.tools.some((tool) => tool.name === "get_person"))
  const checkedPeople = new Set<string>()
  const rows = await database
    .select()
    .from(organizations)
    .where(
      and(eq(organizations.jurisdictionId, `jurisdiction:${state}`), eq(organizations.sourceProvider, "openstates"))
    )
  assert.ok(rows.length > 0, "Empty committee dataset cannot pass")
  let memberships = 0
  let incompleteDetails = 0
  for (const organization of rows) {
    const endpoint = `/api/organizations/${encodeURIComponent(organization.id)}`
    const expected = await database
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, organization.id))
    const byId = new Map(expected.map((membership) => [membership.id, membership]))
    const seen = new Set<string>()
    let path: string | null = `${endpoint}/members?limit=2`
    let pages = 0
    while (path !== null) {
      assert.ok(path.startsWith(`${endpoint}/members?`), "Unexpected pagination target")
      assert.ok(++pages <= 500, "Pagination exceeded smoke bound")
      const response = await fetch(base + path, { signal: AbortSignal.timeout(10000) })
      assert.equal(response.status, 200, "Membership HTTP request failed")
      const page = pageSchema.parse(await response.json())
      if (!organization.membershipRelationsComplete) {
        assert.ok(
          page.meta.warnings?.some((warning) => warning.includes("membership coverage is incomplete")),
          "Missing roster completeness warning"
        )
      }
      for (const membership of page.data) {
        assert.ok(!seen.has(membership.id), "Duplicate membership")
        seen.add(membership.id)
        const persisted = byId.get(membership.id)
        assert.ok(persisted, "Unexpected membership")
        assert.equal(membership.person.id, persisted.personId)
        assert.equal(membership.organization.id, organization.id)
        assert.equal(membership.effectiveStartDate, persisted.effectiveStartDate)
        assert.equal(membership.effectiveEndDate, persisted.effectiveEndDate)
      }
      path = page.links.next
    }
    assert.equal(seen.size, expected.length, "Membership pagination omitted records")
    memberships += seen.size
    if (!organization.membershipRelationsComplete) {
      const current = await fetch(`${base}${endpoint}/members?isCurrent=true&limit=2`, {
        signal: AbortSignal.timeout(10000)
      })
      assert.equal(current.status, 200)
      assert.ok(
        pageSchema
          .parse(await current.json())
          .meta.warnings?.some((warning) => warning.includes("membership coverage is incomplete")),
        "Current-only page hid roster warning"
      )
    }
    const detail = await fetch(base + endpoint, { signal: AbortSignal.timeout(10000) })
    if (
      !organization.detailFactsComplete ||
      !organization.childRelationsComplete ||
      !organization.membershipRelationsComplete
    ) {
      assert.equal(detail.status, 422, "Incomplete committee detail must fail closed")
      incompleteDetails++
      const result = await client.callTool({ name: "get_organization", arguments: { id: organization.id } })
      assert.equal(result.isError, true, "MCP returned incomplete detail as success")
      const content = z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(result.content)
      assert.ok(
        content.some(
          (block) => z.object({ error: z.string() }).parse(JSON.parse(block.text)).error === "unprocessable"
        ),
        "MCP lost typed incomplete-data error"
      )
    } else {
      assert.equal(detail.status, 200)
    }
    for (const membership of expected) {
      if (checkedPeople.has(membership.personId)) {
        continue
      }
      const result = await client.callTool({ name: "get_person", arguments: { id: membership.personId } })
      assert.notEqual(result.isError, true, "MCP person read failed")
      assert.equal(
        z.object({ data: z.object({ id: z.string() }) }).parse(result.structuredContent).data.id,
        membership.personId
      )
      checkedPeople.add(membership.personId)
    }
  }
  process.stdout.write(
    `${JSON.stringify({ state, committees: rows.length, memberships, incompleteDetails, membershipHttp: "passed", incompleteDetailGuard: "passed", localMcpPersonReads: checkedPeople.size, localMcpIncompleteDetailGuards: incompleteDetails, hostedAuthenticationVerified: false, productionWrites: false })}\n`
  )
} finally {
  await client?.close()
  await mcp?.close()
  await close(server)
  await pool.end()
}
