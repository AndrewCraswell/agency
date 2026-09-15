import { z } from "zod"
import { createCompositeHttpApiHandler } from "../src/api/http.js"
import { createPeopleReadApiHandler } from "../src/api/people-read-routes.js"
import { createPersonDetailReadApiHandler } from "../src/api/person-detail-read-routes.js"
import { createDatabase } from "../src/db/database.js"
import { listPeople } from "../src/db/queries/people-read.js"
import { getPersonDetailRead } from "../src/db/queries/person-detail-read.js"
import { createLegislationServer, close } from "../src/mcp/server.js"
import { createLogger } from "../src/observability/logger.js"

// This command is deliberately local-only and read-only. It does not prove hosted authentication or MCP acceptance.
const state = z.enum(["nc", "ak"]).parse(process.argv[2])
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!url) {
  throw new Error("LEGISLATION_TEST_DATABASE_URL is required")
}
const target = new URL(url)
if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Smoke target must be local legislation_test")
}
const { database, pool } = createDatabase({ url, maxConnections: 2, connectionTimeoutMs: 5000, idleTimeoutMs: 10000 })
const handlers = createCompositeHttpApiHandler([
  createPeopleReadApiHandler({ listPeople: (input) => listPeople(database, input) }),
  createPersonDetailReadApiHandler({ getPersonDetail: (id) => getPersonDetailRead(database, id) })
])
const server = createLegislationServer({
  apiHandler: handlers,
  logger: createLogger({ level: "error", service: "openstates-people-smoke", write: () => undefined })
})
const pageSchema = z.object({
  data: z.array(z.object({ id: z.string(), jurisdictionIds: z.array(z.string()) })),
  links: z.object({ next: z.string().nullable() })
})
const detailSchema = z.object({
  data: z.object({
    id: z.string(),
    jurisdictionIds: z.array(z.string()),
    terms: z.array(z.object({ personId: z.string(), officeTitle: z.string().min(1) }))
  })
})
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address")
  }
  const base = `http://127.0.0.1:${address.port}`
  const request = async (path: string) => {
    if (!path.startsWith("/api/people")) {
      throw new Error("Unexpected pagination path")
    }
    const response = await fetch(base + path, { signal: AbortSignal.timeout(10000) })
    if (response.status !== 200) {
      throw new Error(`People HTTP smoke returned ${response.status}`)
    }
    return response.json()
  }
  const ids = new Set<string>()
  let path: string | null = `/api/people?jurisdictionId=jurisdiction%3A${state}&limit=100`
  let pages = 0
  let terms = 0
  while (path !== null) {
    if (++pages > 100) {
      throw new Error("Pagination exceeded smoke bound")
    }
    const page = pageSchema.parse(await request(path))
    for (const person of page.data) {
      if (ids.has(person.id) || !person.jurisdictionIds.includes(`jurisdiction:${state}`)) {
        throw new Error("Duplicate or wrong-jurisdiction person")
      }
      ids.add(person.id)
      const detail = detailSchema.parse(await request(`/api/people/${encodeURIComponent(person.id)}`)).data
      if (
        detail.id !== person.id ||
        !detail.jurisdictionIds.includes(`jurisdiction:${state}`) ||
        detail.terms.some((term) => term.personId !== person.id)
      ) {
        throw new Error("Canonical detail mapping mismatch")
      }
      terms += detail.terms.length
    }
    path = page.links.next
  }
  if (ids.size === 0) {
    throw new Error("Empty dataset cannot pass acceptance")
  }
  process.stdout.write(
    `${JSON.stringify({ state, pages, people: ids.size, terms, listAndDetailHttp: "passed", productionWrites: false })}\n`
  )
} finally {
  await close(server)
  await pool.end()
}
