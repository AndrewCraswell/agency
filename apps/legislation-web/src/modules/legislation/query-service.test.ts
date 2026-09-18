import * as schema from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { getTableColumns } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { afterAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import type { RankedPassageSearch } from "../search/ranked-passage-search"
import { buildLexicalPassageSearchQuery, lexicalBillSearch, semanticBillSearch } from "../search/search"
import {
  billSearchExecution,
  amendmentSearchPageState,
  buildDocumentAmendmentLexicalQuery,
  buildSupportingMaterialCollectionQuery,
  buildSemanticAmendmentCandidateQueries,
  buildStructuredAmendmentLexicalQuery,
  buildLexicalSupportingMaterialCandidateQuery,
  buildBillBrowseQuery,
  decodeBillBrowseCursor,
  decodeSupportingMaterialCollectionCursor,
  decodeSupportingMaterialSearchCursor,
  documentBackedAmendmentId,
  encodeBillBrowseCursor,
  encodeSupportingMaterialCollectionCursor,
  encodeSupportingMaterialSearchCursor,
  lexicalSupportingMaterialCandidateLimit,
  lexicalSupportingMaterialCandidateWindowCapped,
  lexicalSupportingMaterialPageState,
  LegislationQueryService,
  projectDocumentBackedAmendment,
  type SupportingMaterialSearchInput
} from "./query-service"

const pool = new pg.Pool({ connectionString: "postgresql://query-service-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

describe("mention discovery", () => {
  it("applies timeline pagination to a single ordered action and vote query", async () => {
    const stopped = new Error("Timeline query captured")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      await expect(
        new LegislationQueryService(database).getBillTimeline({
          id: "bill:us:116:hr:1",
          limit: 1,
          cursor: Buffer.from(JSON.stringify({ offset: 1 })).toString("base64url")
        })
      ).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain("union all")
      expect(statement).toContain("date asc nulls last")
      expect(statement).toContain("offset")
      expect(query.mock.calls[0]?.[1]).toEqual(["bill:us:116:hr:1", "bill:us:116:hr:1", 2, 1])
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("scopes committee-name bill fallback to the selected jurisdiction", async () => {
    const stopped = new Error("Fallback query captured")
    const query = vi
      .spyOn(pool, "query")
      .mockImplementationOnce(async () => ({ rows: [], fields: [], command: "SELECT", rowCount: 0, oid: 0 }))
      .mockImplementationOnce(async () => ({
        rows: [["Education", "jurisdiction:us:co"]],
        fields: [],
        command: "SELECT",
        rowCount: 1,
        oid: 0
      }))
      .mockImplementationOnce(() => {
        throw stopped
      })
    try {
      await expect(
        new LegislationQueryService(database).getCommitteeBillActivity({ id: "organization:education" })
      ).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[2]?.[0]).text
      expect(statement).toContain('"bills"."jurisdiction_id" = $')
      expect(statement).toContain('"bills"."committees" @> $')
      expect(query.mock.calls[2]?.[1]).toContain("jurisdiction:us:co")
    } finally {
      query.mockRestore()
    }
  })

  it("matches all published name words independently of order and punctuation", async () => {
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      await expect(
        new LegislationQueryService(database).searchPeople({ query: "Alexandria Ocasio-Cortez" })
      ).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('"people"."name" ilike $')
      expect(query.mock.calls[0]?.[1]).toEqual(expect.arrayContaining(["%Alexandria%", "%Ocasio%", "%Cortez%"]))
    } finally {
      query.mockRestore()
    }
  })
  it.each(["person", "organization"] as const)("keeps %s profile subqueries qualified", async (kind) => {
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      const service = new LegislationQueryService(database)
      const operation =
        kind === "person" ? service.getPerson({ id: "person:1" }) : service.getOrganization({ id: "organization:1" })
      await expect(operation).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('left join "legislation"."jurisdictions"')
      expect(statement).toContain('"organization_memberships"."is_active"')
      expect(statement).not.toContain('where "person_id" = "id"')
      expect(statement).not.toContain('on "id" = "organization_id"')
    } finally {
      query.mockRestore()
    }
  })

  it("uses parameterized bounded name similarity and restricts organizations to committees", async () => {
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementation(() => {
      throw stopped
    })
    try {
      await expect(new LegislationQueryService(database).searchMentionRecords("Oca%sio")).rejects.toMatchObject({
        cause: stopped
      })
      expect(query).toHaveBeenCalledTimes(2)
      const statements = query.mock.calls.map((call) => z.object({ text: z.string() }).parse(call[0]).text)
      expect(
        statements.every((statement) => statement.includes("word_similarity(") && statement.includes("limit $"))
      ).toBe(true)
      expect(statements.every((statement) => !statement.includes("Oca%sio"))).toBe(true)
      expect(statements[1]).toContain('"organizations"."classification" = $')
      expect(statements[0]).toContain('"jurisdictions"."name"')
      expect(query.mock.calls[0]?.[1]).toContain("%Oca\\%sio%")
      expect(query.mock.calls[1]?.[1]).toContain("committee")
    } finally {
      query.mockRestore()
    }
  })
})

describe("bill session metadata", () => {
  it.each(["search", "read"])("uses the approved federal committee source for %s", async (operation) => {
    const stopped = new Error("Captured query")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      const service = new LegislationQueryService(database)
      const request =
        operation === "search"
          ? service.searchOrganizations({ query: "Agriculture" })
          : service.getOrganization({ id: "organization:congress:hsag00" })
      await expect(request).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain("'jurisdiction:us'")
      expect(statement).toContain("in ('committee', 'subcommittee')")
      expect(statement).toContain("= 'govinfo'")
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("qualifies document section count correlation to the selected document", async () => {
    const stopped = new Error("Captured query")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      await expect(
        new LegislationQueryService(database).getBillText({ id: "bill:1", documentId: "document:1" })
      ).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain(
        '"legislation"."document_sections"."document_id" = "legislation"."bill_documents"."id"'
      )
      expect(statement).toContain('"legislation"."bills"."id" = "legislation"."bill_documents"."bill_id"')
      expect(statement).not.toContain('"document_id" = "id"')
    } finally {
      query.mockRestore()
    }
  })

  it("joins the published session name by exact session ID in direct bill reads", async () => {
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      const service = new LegislationQueryService(database)
      await expect(service.getBill({ id: "bill:ca:20232024:ab:2652" })).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('"legislative_sessions"."name"')
      expect(statement).toContain('left join "legislation"."legislative_sessions"')
      expect(statement).toContain('"bills"."session_id" = "legislation"."legislative_sessions"."id"')
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
    }
  })

  it("joins the session name in semantic bill result hydration", async () => {
    const configure = vi
      .spyOn(database, "execute")
      .mockResolvedValueOnce({ rows: [], fields: [], command: "SELECT", rowCount: 0, oid: 0 })
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      await expect(
        semanticBillSearch(database, {
          embedding: Array.from({ length: embeddingRouteFor("bill").dimensions }, () => 0.1)
        })
      ).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('"legislative_sessions"."name"')
      expect(statement).toContain('left join "legislation"."legislative_sessions"')
      expect(statement).toContain('"bills"."session_id" = "legislation"."legislative_sessions"."id"')
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
      configure.mockRestore()
    }
  })

  it("joins the session name after lexical bill ranking selects candidates", async () => {
    const ranked = vi.spyOn(database, "execute").mockResolvedValueOnce({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: [],
      rows: [
        {
          id: "bill:ca:20232024:ab:2652",
          rank: 1,
          coverageOnly: false,
          versionCoverageCapped: false,
          billTextMatches: true,
          identifierMatches: true,
          sponsorRank: null,
          versionRank: null
        }
      ]
    })
    const stopped = new Error("Query captured without contacting a database")
    const query = vi.spyOn(pool, "query").mockImplementationOnce(() => {
      throw stopped
    })
    try {
      await expect(lexicalBillSearch(database, { query: "education policy" })).rejects.toMatchObject({ cause: stopped })
      const statement = z.object({ text: z.string() }).parse(query.mock.calls[0]?.[0]).text
      expect(statement).toContain('"legislative_sessions"."name"')
      expect(statement).toContain('left join "legislation"."legislative_sessions"')
      expect(statement).toContain('"bills"."session_id" = "legislation"."legislative_sessions"."id"')
      expect(ranked).toHaveBeenCalledOnce()
      expect(query).toHaveBeenCalledOnce()
    } finally {
      query.mockRestore()
      ranked.mockRestore()
    }
  })
})

describe("bill summary independence from child pages", () => {
  it.each([
    {
      childLimit: 1,
      childCursor: undefined,
      status: null,
      provider: "openstates",
      hasActions: true,
      expectedStatus: "Vetoed"
    },
    {
      childLimit: 5,
      childCursor: Buffer.from(JSON.stringify({ offset: 5 })).toString("base64url"),
      status: null,
      provider: "openstates",
      hasActions: true,
      expectedStatus: "Vetoed"
    },
    {
      childLimit: 1,
      childCursor: undefined,
      status: "Published status",
      provider: "openstates",
      hasActions: true,
      expectedStatus: "Published status"
    },
    {
      childLimit: 1,
      childCursor: undefined,
      status: null,
      provider: "govinfo",
      hasActions: true,
      expectedStatus: null
    },
    {
      childLimit: 1,
      childCursor: undefined,
      status: null,
      provider: "openstates",
      hasActions: false,
      expectedStatus: null
    }
  ])(
    "returns authoritative summary for %j",
    async ({ childLimit, childCursor, status, provider, hasActions, expectedStatus }) => {
      const billId = "bill:ca:20232024:sb:1047"
      const billValues: Record<string, unknown> = {
        id: billId,
        title: "SB 1047",
        jurisdictionId: "jurisdiction:ca",
        sessionId: "session:ca:20232024",
        status,
        upstreamIds: { [provider]: "publisher-id" }
      }
      const latestAction = {
        id: "action:last",
        billId,
        ordinal: 51,
        description: "Returned without signature.",
        actionDate: "2024-09-29",
        actionAt: null,
        sourceUrl: "https://publisher.example/bill"
      }
      const statements: { text: string; values: unknown }[] = []
      const query = vi.spyOn(pool, "query").mockImplementation((config, values) => {
        const { text } = z.object({ text: z.string() }).parse(config)
        statements.push({ text, values })
        let rows: unknown[][] = []
        if (text.includes('from "legislation"."bills"')) {
          rows = [
            [
              ...Object.keys(getTableColumns(schema.bills)).map((key) => billValues[key] ?? null),
              "2023-2024 Regular Session"
            ]
          ]
        } else if (text.includes('"classification" &&')) {
          rows = hasActions ? [[50, ["executive-veto"], "upper"]] : []
        } else if (text.includes('order by "legislation"."bill_actions"."ordinal" desc')) {
          rows = hasActions ? [Object.values(latestAction)] : []
        } else if (text.includes('from "legislation"."bill_documents"')) {
          rows = Array.from({ length: childLimit + 1 }, (_, index) =>
            Object.keys(getTableColumns(schema.billDocuments)).map((key) => {
              if (key === "id") {
                return `document:${index}`
              }
              if (key === "title") {
                return "Document"
              }
              if (key === "billId") {
                return billId
              }
              return null
            })
          )
        }
        return Promise.resolve({ command: "SELECT", rowCount: rows.length, oid: 0, fields: [], rows })
      })
      try {
        const result = await new LegislationQueryService(database).getBill({ id: billId, childLimit, childCursor })
        expect(result.truncated).toBe(true)
        expect(result.actions).toEqual([])
        expect(result.latestAction).toEqual(hasActions ? latestAction : null)
        expect(result.bill.status).toBe(expectedStatus)
        const latestQuery = statements.find(
          (statement) =>
            statement.text.includes('order by "legislation"."bill_actions"."ordinal" desc') &&
            !statement.text.includes('"classification" &&')
        )
        expect(latestQuery?.text).not.toContain("offset")
        expect(latestQuery?.values).toEqual([billId, 1])
        const statusQueries = statements.filter((statement) => statement.text.includes('"classification" &&'))
        expect(statusQueries).toHaveLength(status === null && provider === "openstates" ? 1 : 0)
        for (const statement of statusQueries) {
          expect(statement.text).not.toContain("offset")
          expect(statement.text).toContain('"bill_id" = $1')
        }
      } finally {
        query.mockRestore()
      }
    }
  )
})

describe("ranked passage search routing", () => {
  it("uses the feature-gated ranked search only for lexical mode", async () => {
    const search = vi.fn<RankedPassageSearch["search"]>(async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false
    }))
    const service = new LegislationQueryService(database, undefined, { generation: "generation-a", search })

    await expect(service.searchBillText({ mode: "lexical", query: "health" })).resolves.toMatchObject({ items: [] })
    expect(search).toHaveBeenCalledWith({
      mode: "lexical",
      query: "health",
      rankingGeneration: "generation-a"
    })
    await expect(service.searchBillText({ mode: "semantic", query: "health" })).rejects.toThrow(LegislationError)
    await expect(service.searchBillText({ mode: "hybrid", query: "health" })).rejects.toThrow(LegislationError)
    expect(search).toHaveBeenCalledTimes(1)
  })

  it("uses the ranked passage store for the lexical half of hybrid search", async () => {
    const search = vi.fn<RankedPassageSearch["search"]>(async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false
    }))
    const transaction = vi.spyOn(database, "transaction").mockResolvedValueOnce([])
    const service = new LegislationQueryService(
      database,
      {
        embed: async () => ({
          embeddings: [Array.from({ length: 1536 }, () => 0)],
          model: "openai/text-embedding-3-small"
        }),
        rerank: async () => []
      },
      { generation: "generation-a", search }
    )
    try {
      await expect(service.searchBillText({ mode: "hybrid", query: "health" })).resolves.toMatchObject({ items: [] })
      expect(search).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 25,
        mode: "hybrid",
        query: "health",
        rankingGeneration: "generation-a"
      })
    } finally {
      transaction.mockRestore()
    }
  })
})

describe("bill browse query", () => {
  it("binds bill browse cursors to the complete filter and sort scope", () => {
    const input = {
      classification: ["resolution", "bill"],
      identifier: "HR",
      introducedFrom: "2026-01-01",
      introducedTo: "2026-01-31",
      jurisdictionId: "jurisdiction:us",
      limit: 25,
      organizationId: "organization:us:house:rules",
      sessionId: "session:us:119",
      sort: "updated-desc" as const,
      sponsorPersonId: "person:us:1",
      status: ["referred", "introduced"],
      subject: ["taxes", "budget"],
      updatedFrom: new Date("2026-08-20T12:00:00.000Z")
    }
    const cursor = encodeBillBrowseCursor(25, input)

    expect(decodeBillBrowseCursor(cursor, { ...input, classification: ["bill", "resolution"] })).toBe(25)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, sort: "identifier-asc" })).toThrow(LegislationError)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, status: ["introduced"] })).toThrow(LegislationError)
    expect(() => decodeBillBrowseCursor(cursor, { ...input, jurisdictionId: "jurisdiction:ak" })).toThrow(
      LegislationError
    )
    expect(() => decodeBillBrowseCursor(Buffer.from('{"offset":25}').toString("base64url"), input)).toThrow(
      LegislationError
    )
  })

  it("keeps the default latest-action query unchanged", () => {
    const input = { jurisdictionId: "jurisdiction:ak" }
    const generated = buildBillBrowseQuery(database, input, 100, 0).toSQL().sql
    const explicit = buildBillBrowseQuery(database, { ...input, sort: "latest-action-desc" }, 100, 0).toSQL().sql

    expect(generated.match(/max\(coalesce/g)).toHaveLength(1)
    expect(generated).toContain("left join lateral")
    expect(generated).not.toContain('"bill_page"')
    expect(generated).toBe(explicit)
    expect(generated).toContain('"latest_action_at"')
    expect(generated).toContain('"legislation"."bill_actions"."bill_id" = "browse_bill"."id"')
    expect(generated).toMatch(
      /order by coalesce\("latest_action_at", "browse_bill"\."source_updated_at", "browse_bill"\."updated_at"\) desc, "browse_bill"\."id" asc/
    )
  })

  it.each(["identifier-asc", "introduced-desc", "updated-desc"] as const)(
    "selects the %s page before hydrating latest actions",
    (sort) => {
      const updatedFrom = new Date("2026-08-20T12:00:00.000Z")
      const generated = buildBillBrowseQuery(
        database,
        {
          classification: ["bill", "resolution"],
          identifier: "HR",
          introducedFrom: "2026-01-01",
          introducedTo: "2026-01-31",
          jurisdictionId: "jurisdiction:us",
          organizationId: "organization:us:house:rules",
          sessionId: "session:us:119",
          sponsorPersonId: "person:us:1",
          sort,
          status: ["introduced", "referred"],
          subject: ["budget", "taxes"],
          updatedFrom
        },
        25,
        50
      ).toSQL()
      const latestActionIndex = generated.sql.indexOf('"legislation"."bill_actions"')
      const pageStartIndex = generated.sql.indexOf('from (select "id" from "legislation"."bills" "browse_bill"')
      const pageLimitIndex = generated.sql.indexOf("limit", pageStartIndex)

      expect(pageStartIndex).toBeGreaterThan(-1)
      expect(generated.sql).toContain('"browse_bill"."identifier" ilike')
      expect(generated.sql).toContain('"browse_bill"."jurisdiction_id" =')
      expect(generated.sql).toContain('"browse_bill"."session_id" =')
      expect(generated.sql).toContain('"browse_bill"."classification" &&')
      expect(generated.sql).toContain('"browse_bill"."subjects" @>')
      expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_sponsors"')
      expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_organizations"')
      expect(generated.sql).toContain('"browse_bill"."updated_at" >=')
      expect(generated.sql).toContain(
        'inner join "legislation"."bills" on "bill_page"."id" = "legislation"."bills"."id"'
      )
      expect(generated.sql).toContain('"legislation"."bill_actions"."bill_id" = "legislation"."bills"."id"')
      expect(generated.sql).not.toContain('"legislation"."bill_actions"."bill_id" = "browse_bill"."id"')
      expect(generated.sql).toContain("left join lateral")
      expect(generated.sql.match(/max\(coalesce/g)).toHaveLength(1)
      expect(pageLimitIndex).toBeGreaterThan(-1)
      expect(latestActionIndex).toBeGreaterThan(pageLimitIndex)
      expect(generated.params).toContain(updatedFrom.toISOString())
      expect(generated.params).toEqual(expect.arrayContaining([26, 50]))
    }
  )

  it("applies the global collection's sponsor, organization, and update filters without changing its stable sort", () => {
    const updatedFrom = new Date("2026-08-20T12:00:00.000Z")
    const query = buildBillBrowseQuery(
      database,
      {
        classification: ["bill", "resolution"],
        identifier: "HR",
        introducedFrom: "2026-01-01",
        introducedTo: "2026-01-31",
        organizationId: "organization:us:house:rules",
        sponsorPersonId: "person:us:1",
        sort: "latest-action-desc",
        status: ["introduced", "referred"],
        subject: ["budget", "taxes"],
        updatedFrom
      },
      25,
      0
    )
    const generated = query.toSQL()

    expect(generated.sql).toContain('"browse_bill"."identifier" ilike')
    expect(generated.sql).toContain('"browse_bill"."classification" &&')
    expect(generated.sql).toContain('"browse_bill"."subjects" @>')
    expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_sponsors"')
    expect(generated.sql).toContain('exists (select 1 from "legislation"."bill_organizations"')
    expect(generated.sql).toContain('"browse_bill"."updated_at" >=')
    expect(generated.params).toContain(updatedFrom.toISOString())
    expect(generated.sql).toMatch(
      /order by coalesce\("latest_action_at", "browse_bill"\."source_updated_at", "browse_bill"\."updated_at"\) desc, "browse_bill"\."id" asc/
    )
  })
})

describe("amendment lexical search query", () => {
  it("keeps indexed section matches separate from title-only matches before ranking each document", () => {
    const query = buildDocumentAmendmentLexicalQuery(
      database,
      { limit: 20, mode: "lexical", query: "Medicare Part D premium" },
      21
    ).toSQL()

    expect(query.sql).toContain('"amendment_document_lexical_candidates" as')
    expect(query.sql).toContain(" union all ")
    expect(query.sql).toContain('"legislation"."amendment_section_search"')
    expect(query.sql).not.toContain("to_tsvector")
    expect(query.sql).not.toContain('"bill_documents"."text"')
    expect(query.sql).not.toContain('"bills"."embedding"')
    expect(query.sql.match(/inner join "legislation"\."bills"/g)).toHaveLength(2)
    expect(query.sql).not.toMatch(/search_vector[^)]*@@[^)]* or to_tsvector/)
    expect(query.sql).toContain("row_number() over (partition by")
    expect(query.sql).toContain('"row_number" = $')
    expect(query.sql.match(/ts_headline/g)).toHaveLength(1)
    expect(query.sql.indexOf("ts_headline")).toBeGreaterThan(query.sql.indexOf("amendment_document_lexical_ranked"))
    expect(query.sql.indexOf("limit")).toBeLessThan(query.sql.indexOf("ts_headline"))
    expect(query.sql).toContain('"amendment_document_lexical_page" as')
    // Use an unambiguous alias: document_sections also exposes document_id.
    expect(query.sql).toContain('"page_document_id"')
  })

  it("applies document filters and hybrid candidate IDs to both disjoint match branches", () => {
    const query = buildDocumentAmendmentLexicalQuery(
      database,
      {
        jurisdictionIds: ["jurisdiction:us"],
        limit: 20,
        mode: "hybrid",
        query: "premium",
        sessionIds: ["session:119"]
      },
      25,
      ["document:first", "document:second"]
    ).toSQL()

    expect(query.sql.match(/"legislation"\."bill_documents"\."classification" =/g)).toHaveLength(1)
    expect(query.sql.match(/"legislation"\."bill_documents"\."processing_status" =/g)).toHaveLength(1)
    expect(query.sql.match(/"legislation"\."amendment_section_search"\."document_id" in/g)).toHaveLength(2)
    expect(query.sql.match(/"legislation"\."bills"\."jurisdiction_id" in/g)).toHaveLength(1)
    expect(query.sql.match(/"legislation"\."bills"\."session_id" in/g)).toHaveLength(1)
    expect(query.params.filter((value) => value === "document:first")).toHaveLength(2)
    expect(query.params.filter((value) => value === "document:second")).toHaveLength(2)
  })

  it("uses full-text ranking and preserves every multi-value filter as bound parameters", () => {
    const query = buildStructuredAmendmentLexicalQuery(
      database,
      {
        billIds: ["bill:first", "bill:second"],
        jurisdictionIds: ["jurisdiction:first", "jurisdiction:second"],
        limit: 20,
        mode: "lexical",
        query: "housing & appropriations",
        sessionIds: ["session:first", "session:second"],
        sponsorPersonIds: ["person:first", "person:second"],
        statuses: ["introduced", "adopted"],
        submittedFrom: "2026-01-01",
        submittedTo: "2026-01-31"
      },
      21
    ).toSQL()

    expect(query.sql).toContain("websearch_to_tsquery('english', $1)")
    expect(query.sql).toContain("ts_rank_cd")
    expect(query.sql).toContain("ts_headline")
    expect(query.sql).not.toContain(" ilike ")
    expect(query.params).toEqual(
      expect.arrayContaining([
        "housing & appropriations",
        "bill:first",
        "bill:second",
        "jurisdiction:first",
        "jurisdiction:second",
        "session:first",
        "session:second",
        "person:first",
        "person:second",
        "introduced",
        "adopted"
      ])
    )
  })

  it("restricts hybrid lexical ranking to the semantic amendment candidates", () => {
    const query = buildStructuredAmendmentLexicalQuery(database, { limit: 20, mode: "hybrid", query: "housing" }, 25, [
      "amendment:first",
      "amendment:second"
    ]).toSQL()

    expect(query.sql).toContain('"legislation"."amendments"."id" in ($')
    expect(query.params).toEqual(expect.arrayContaining(["amendment:first", "amendment:second"]))
  })
})

describe("hybrid passage lexical scoring", () => {
  it("filters and ranks a narrow page before loading text, metadata and latest actions", () => {
    const query = buildLexicalPassageSearchQuery(database, {
      limit: 7,
      query: "housing",
      documentIds: ["document:one"],
      sessionIds: ["session:119"],
      pageFrom: 2
    }).toSQL()
    const pageEnd = query.sql.indexOf("limit")
    const ranking = query.sql.slice(0, pageEnd)
    expect(ranking).toContain('"lexical_passage_page" as')
    expect(ranking).toContain('"session_id"')
    expect(ranking).toContain('"page_end"')
    expect(ranking).toContain("ts_rank_cd")
    expect(ranking).not.toContain("ts_headline")
    expect(ranking).not.toContain('"bill_actions"')
    expect(ranking).not.toContain('"document_sections"."text"')
    expect(query.sql.indexOf("ts_headline")).toBeGreaterThan(pageEnd)
    expect(query.sql.match(/limit/g)).toHaveLength(1)
    expect(query.params).toEqual(expect.arrayContaining(["document:one", "session:119", 2, 8]))
  })

  it("restricts lexical ranking to the semantic HNSW candidate IDs", () => {
    const query = buildLexicalPassageSearchQuery(database, { limit: 20, mode: "hybrid", query: "housing" }, [
      "section:first",
      "section:second"
    ]).toSQL()

    expect(query.sql).toContain('"legislation"."document_sections"."id" in ($')
    expect(query.params).toEqual(expect.arrayContaining(["section:first", "section:second"]))
  })
})

describe("amendment semantic search query", () => {
  it("binds each structured and document vector comparison as one typed pgvector parameter", () => {
    const embedding = Array.from({ length: 1536 }, (_, index) => index / 1536)
    const { documentQuery, structuredQuery } = buildSemanticAmendmentCandidateQueries(
      database,
      { limit: 20, mode: "semantic", query: "housing" },
      embedding,
      25
    )
    const structured = structuredQuery.toSQL()
    const document = documentQuery.toSQL()
    expect(document.sql).not.toContain('"bill_documents"."text"')
    expect(document.sql).not.toContain('"bills"."embedding"')

    expect(structured.sql).toMatch(/1 - \("legislation"\."amendment_embeddings"\."embedding" <=> \$\d+::vector\)/)
    expect(structured.sql).toMatch(/order by "legislation"\."amendment_embeddings"\."embedding" <=> \$\d+::vector/)
    expect(document.sql).toMatch(
      /select "legislation"\."document_section_embeddings"\."embedding" <=> \$\d+::vector as "distance"/
    )
    expect(document.sql).toContain("\"document_classification\" = 'amendment'")
    expect(document.sql).toContain("\"model\" = 'openai/text-embedding-3-small'")
    expect(document.sql).toContain("\"input_contract\" = 'document-section-heading-text'")
    expect(document.sql).toMatch(/order by "legislation"\."document_section_embeddings"\."embedding" <=> \$\d+::vector/)
    expect(document.sql).toMatch(/limit \$\d+\)?, "amendment_document_semantic_candidates" as/)
    expect(document.sql).toMatch(/row_number\(\) over \(partition by .* order by "distance"/)
    expect(typedVectorBindingCounts(structured, JSON.stringify(embedding))).toEqual({
      embeddingParameters: 2,
      typedVectorParameters: 2
    })
    expect(typedVectorBindingCounts(document, JSON.stringify(embedding))).toEqual({
      embeddingParameters: 2,
      typedVectorParameters: 2
    })
  })

  it("caps the HNSW section candidate window before document joins and ranking", () => {
    const embedding = Array.from({ length: 1536 }, () => 0)
    const { documentQuery } = buildSemanticAmendmentCandidateQueries(
      database,
      { limit: 20, mode: "semantic", query: "housing" },
      embedding,
      25
    )
    const rendered = documentQuery.toSQL()

    expect(rendered.params).toContain(250)
    expect(rendered.sql.indexOf("limit")).toBeLessThan(rendered.sql.indexOf("row_number()"))
  })
})

describe("amendment capped page state", () => {
  it("drains known candidates in a capped semantic window before retaining the cap signal", () => {
    expect(amendmentSearchPageState(25, 0, 20, true)).toEqual({ nextOffset: 20, truncated: true })
    expect(amendmentSearchPageState(25, 20, 20, true)).toEqual({ truncated: true })
  })
})

function typedVectorBindingCounts(
  rendered: Readonly<{ params: readonly unknown[]; sql: string }>,
  embedding: string
): Readonly<{ embeddingParameters: number; typedVectorParameters: number }> {
  return {
    embeddingParameters: rendered.params.filter((parameter) => parameter === embedding).length,
    typedVectorParameters: rendered.sql.match(/\$\d+::vector/g)?.length ?? 0
  }
}

describe("bill search execution metadata", () => {
  it("does not claim a reranker when semantic search has no candidates", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 0)).toEqual({
      isReranked: false,
      models: [{ model: "voyageai/voyage-4", purpose: "embedding" }]
    })
  })

  it("does not claim a reranker when hybrid search has no fused candidates", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 0).models).toHaveLength(1)
  })

  it("reports only the embedding and reranker that were used", () => {
    expect(billSearchExecution("voyageai/voyage-4", "cohere/rerank-v3.5", 1)).toEqual({
      isReranked: true,
      models: [
        { model: "voyageai/voyage-4", purpose: "embedding" },
        { model: "cohere/rerank-v3.5", purpose: "reranking" }
      ]
    })
  })

  it("maps an embedding-provider failure to a safe typed dependency error", async () => {
    const service = new LegislationQueryService(database, {
      embed: async () => {
        throw new Error("provider response must not reach callers")
      },
      rerank: async () => []
    })

    await expect(service.searchBills({ mode: "semantic", query: "housing" })).rejects.toMatchObject({
      category: "dependency_unavailable",
      message: "Semantic search is temporarily unavailable"
    })
  })
})

describe("lexical supporting material candidate search", () => {
  const dialect = new PgDialect()

  function renderCandidateSearch(
    input: Parameters<typeof buildLexicalSupportingMaterialCandidateQuery>[0],
    limit = 20,
    offset = 0
  ) {
    return dialect.sqlToQuery(buildLexicalSupportingMaterialCandidateQuery(input, "Build the Wall", limit, offset))
  }

  it("bounds title and indexed section retrieval before material-level ranking", () => {
    const rendered = renderCandidateSearch({ query: "Build the Wall" })

    expect(rendered.sql).toContain("with title_candidate_probe as")
    expect(rendered.sql).toContain("title_candidates as")
    expect(rendered.sql).toContain("section_match_probe as materialized")
    expect(rendered.sql).toContain("section_match_sample as materialized")
    expect(rendered.sql).toContain("section_candidate_materials as materialized")
    expect(rendered.sql).toContain("candidate_materials as materialized")
    expect(rendered.sql).toContain("candidate_title_scores as")
    expect(rendered.sql).toContain("section_ranked_matches as")
    expect(rendered.sql).toContain("section_best_matches as")
    expect(rendered.sql).toContain("ranked_candidate_scores as")
    expect(rendered.sql).toContain("ranked_candidate_prefix as")
    expect(rendered.sql).toContain("section_candidates as")
    expect(rendered.sql.match(/limit \$\d+/g)).toHaveLength(6)
    expect(rendered.sql).toContain('as "matchedSectionId"')
    expect(rendered.sql).toContain("as section_snippet")
    expect(rendered.sql).toContain("select distinct on (material_id)")
    expect(rendered.sql).toContain("order by material_id asc, section_score desc, section_id asc")
    expect(rendered.sql).not.toContain("row_number() over")
    expect(rendered.sql.match(/"search_vector" @@/g)).toHaveLength(1)
    expect(rendered.sql).toMatch(
      /inner join "legislation"\."supporting_material_sections"\s+on "legislation"\."supporting_material_sections"\."id" = section_match_sample\.section_id/
    )
    expect(rendered.sql).toContain(
      "left join section_best_matches on section_best_matches.material_id = candidate_materials.material_id"
    )
    expect(rendered.sql).toContain(
      "left join candidate_title_scores on candidate_title_scores.material_id = candidate_materials.material_id"
    )
    expect(rendered.sql).toContain(
      'on "legislation"."supporting_material_sections"."id" = ranked_candidate_prefix.matched_section_id'
    )
    expect(rendered.sql).toContain('to_tsvector(\'english\', "legislation"."supporting_materials"."title")')
    expect(rendered.sql.indexOf("section_candidates as")).toBeLessThan(rendered.sql.indexOf("ts_headline("))
    expect(rendered.sql).not.toContain('inner join "legislation"."supporting_materials" on')
    expect(rendered.sql).not.toContain('left join "legislation"."supporting_material_links"')
  })

  it("calculates exact best-section ranks only within the declared stable section sample", () => {
    const rendered = renderCandidateSearch({ query: "Build the Wall" })
    const sectionProbeStart = rendered.sql.indexOf("section_match_probe as materialized")
    const sectionSampleStart = rendered.sql.indexOf("section_match_sample as materialized")
    const sectionRankingStart = rendered.sql.indexOf("section_ranked_matches as")

    expect(sectionProbeStart).toBeGreaterThan(-1)
    expect(sectionProbeStart).toBeLessThan(sectionRankingStart)
    expect(rendered.sql.slice(sectionProbeStart, sectionSampleStart)).not.toContain("ts_rank_cd")
    expect(rendered.sql).toMatch(/order by "legislation"\."supporting_material_sections"\."id" asc\s+limit \$\d+/)
    expect(rendered.sql).toContain("exists (select 1 from section_match_probe offset")
    expect(rendered.sql).not.toContain("section_candidate_probe")
  })

  it("keeps source samples fixed across cursor pages before ranking", () => {
    const firstPage = renderCandidateSearch({ query: "Build the Wall" }, 20, 0)
    const secondPage = renderCandidateSearch({ query: "Build the Wall" }, 20, 20)
    const numericParams = (params: readonly unknown[]) => params.filter((value) => typeof value === "number")

    expect(numericParams(firstPage.params)).toEqual([251, 250, 251, 250, 25, 250, 250, 25, 21, 0])
    expect(numericParams(secondPage.params)).toEqual([251, 250, 251, 250, 41, 250, 250, 41, 21, 20])
  })

  it("keeps link, session, date, update, status, and classification filters in both candidate sources", () => {
    const rendered = renderCandidateSearch({
      amendmentIds: ["amendment:fixture"],
      billIds: ["bill:fixture"],
      classifications: ["committee-report"],
      documentFrom: "2026-01-01",
      documentTo: "2026-12-31",
      eventIds: ["event:fixture"],
      jurisdictionIds: ["jurisdiction:fixture"],
      organizationIds: ["organization:fixture"],
      processingStatus: "processed",
      sessionIds: ["session:fixture"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedToExclusive: new Date("2026-09-01T00:00:00.000Z")
    })

    expect(rendered.sql.match(/exists \(/g)).toHaveLength(5)
    expect(rendered.sql.match(/"bill_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"amendment_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"event_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"organization_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"session_id" in/g)).toHaveLength(2)
    expect(rendered.sql.match(/"processing_status" =/g)).toHaveLength(2)
    expect(rendered.sql.match(/"updated_at" >=/g)).toHaveLength(2)
    expect(rendered.sql.match(/"updated_at" </g)).toHaveLength(2)
    expect(rendered.sql).toContain('inner join "legislation"."supporting_materials" on')
  })

  it("uses a stable bounded window for deep cursors", () => {
    expect(lexicalSupportingMaterialCandidateLimit(1, 0)).toBe(25)
    expect(lexicalSupportingMaterialCandidateLimit(100, 0)).toBe(101)
    expect(lexicalSupportingMaterialCandidateLimit(100, 200)).toBe(250)
  })

  it("globally caps disjoint title and section candidates before deep-page pagination", () => {
    const rendered = renderCandidateSearch({ query: "Build the Wall" }, 100, 200)
    const prefixStart = rendered.sql.indexOf("ranked_candidate_prefix as")
    const pageOffset = rendered.sql.lastIndexOf("offset")

    expect(prefixStart).toBeGreaterThan(-1)
    expect(rendered.sql.indexOf("limit", prefixStart)).toBeLessThan(pageOffset)
    expect(rendered.sql).toContain("exists (select 1 from ranked_candidate_scores offset")
    expect(lexicalSupportingMaterialPageState(200, 100, 50, true)).toEqual({
      nextCursor: undefined,
      truncated: true
    })
  })

  it("does not mark an exactly full candidate window as capped", () => {
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 25, 25)).toBe(false)
  })

  it("marks a candidate window capped only when a source returns one more row", () => {
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 26, 25)).toBe(true)
    expect(lexicalSupportingMaterialCandidateWindowCapped(25, 25, 26)).toBe(true)
  })

  it("does not create a cursor for an exactly full uncapped candidate page", () => {
    expect(lexicalSupportingMaterialPageState(0, 25, 25, false)).toEqual({
      nextCursor: undefined,
      truncated: false
    })
  })

  it("reports an exactly full coverage-capped page without inventing a continuation", () => {
    expect(lexicalSupportingMaterialPageState(0, 25, 25, true)).toEqual({
      nextCursor: undefined,
      truncated: true
    })
  })

  it("reports a sparse coverage-capped page without inventing an empty next page", () => {
    expect(lexicalSupportingMaterialPageState(0, 20, 10, true)).toEqual({
      nextCursor: undefined,
      truncated: true
    })
  })

  it("keeps a cursor when an extra retained row proves another page exists", () => {
    expect(lexicalSupportingMaterialPageState(0, 25, 26, false)).toEqual({
      nextCursor: "eyJvZmZzZXQiOjI1fQ",
      truncated: true
    })
  })

  it("binds cursors to the material filter scope and stops at the candidate cap", () => {
    const input = {
      billIds: ["bill:fixture"],
      classifications: ["committee-report", "testimony"],
      documentFrom: "2026-01-01",
      documentTo: "2026-01-31",
      jurisdictionIds: ["jurisdiction:fixture"],
      mode: "lexical" as const,
      query: "public data",
      sessionIds: ["session:fixture"]
    }
    const cursor = encodeSupportingMaterialSearchCursor(25, input)

    expect(
      decodeSupportingMaterialSearchCursor(cursor, { ...input, classifications: ["testimony", "committee-report"] })
    ).toBe(25)
    expect(() => decodeSupportingMaterialSearchCursor(cursor, { ...input, query: "private data" })).toThrow(
      LegislationError
    )
    expect(() =>
      decodeSupportingMaterialSearchCursor(Buffer.from('{"offset":25}').toString("base64url"), input)
    ).toThrow(LegislationError)
    expect(lexicalSupportingMaterialPageState(200, 50, 50, true)).toEqual({
      nextCursor: undefined,
      truncated: true
    })
  })
})

describe("supporting material collection cursors", () => {
  it("omits link joins and DISTINCT when no link-based filter is supplied", () => {
    const rendered = buildSupportingMaterialCollectionQuery(database, { sort: "document-desc" }, 20, 40).toSQL()

    expect(rendered.sql).toContain('from "legislation"."supporting_materials"')
    expect(rendered.sql).not.toContain('join "legislation"."supporting_material_links"')
    expect(rendered.sql).not.toContain("select distinct")
    expect(rendered.sql).toMatch(
      /order by "legislation"."supporting_materials"\."document_date" desc, "legislation"\."supporting_materials"\."id" asc limit \$1 offset \$2/
    )
    expect(rendered.params).toEqual([21, 40])
  })

  it("retains the link join and DISTINCT for every link-based filter", () => {
    const filters = [
      { column: "bill_id", input: { billId: "bill:fixture" }, value: "bill:fixture" },
      { column: "amendment_id", input: { amendmentId: "amendment:fixture" }, value: "amendment:fixture" },
      { column: "event_id", input: { eventId: "event:fixture" }, value: "event:fixture" },
      { column: "organization_id", input: { organizationId: "organization:fixture" }, value: "organization:fixture" }
    ] satisfies readonly Readonly<{ column: string; input: SupportingMaterialSearchInput; value: string }>[]

    for (const filter of filters) {
      const rendered = buildSupportingMaterialCollectionQuery(database, filter.input, 20, 40).toSQL()

      expect(rendered.sql).toContain("select distinct")
      expect(rendered.sql).toContain('left join "legislation"."supporting_material_links"')
      expect(rendered.sql).toContain(`"legislation"."supporting_material_links"."${filter.column}" = $1`)
      expect(rendered.params).toEqual([filter.value, 21, 40])
    }
  })

  it("binds ordered traversal to filters and sort", () => {
    const input = {
      billId: "bill:fixture",
      documentFrom: "2026-01-01",
      mode: "lexical" as const,
      processingStatus: "processed" as const,
      sort: "document-desc" as const
    }
    const cursor = encodeSupportingMaterialCollectionCursor(20, input)

    expect(decodeSupportingMaterialCollectionCursor(cursor, input)).toBe(20)
    expect(() => decodeSupportingMaterialCollectionCursor(cursor, { ...input, sort: "title-asc" })).toThrow(
      LegislationError
    )
    expect(() => decodeSupportingMaterialCollectionCursor(cursor, { ...input, billId: "bill:other" })).toThrow(
      LegislationError
    )
    expect(() =>
      decodeSupportingMaterialCollectionCursor(Buffer.from('{"offset":20}').toString("base64url"), input)
    ).toThrow(LegislationError)
  })
})

describe("document-backed amendments", () => {
  it("uses a stable amendment ID and preserves published metadata", () => {
    const documentId = "bill:wa:2025-2026:sb:6027:document:floor-amendment"
    expect(documentBackedAmendmentId(documentId)).toBe(`amendment:document:${documentId}`)
    expect(
      projectDocumentBackedAmendment(
        {
          billId: "bill:wa:2025-2026:sb:6027",
          blobPath: null,
          classification: "amendment",
          contentHash: null,
          contentType: null,
          createdAt: new Date("2026-08-19T00:00:00.000Z"),
          documentDate: "2026-02-01",
          pageCount: null,
          id: documentId,
          lastAttemptAt: null,
          nextAttemptAt: null,
          ocrCompletedAt: null,
          ocrPageCount: null,
          ocrProvider: null,
          ocrStatus: null,
          processingAttempts: 0,
          processingError: null,
          processingErrorCategory: null,
          processingStatus: "pending",
          sourceUrl: "https://leg.wa.gov/amendments/sb6027.pdf",
          text: null,
          title: "Floor amendment 001",
          updatedAt: new Date("2026-08-19T00:00:00.000Z"),
          versionCode: null
        },
        "jurisdiction:wa"
      )
    ).toEqual({
      billId: "bill:wa:2025-2026:sb:6027",
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
      documentId,
      id: `amendment:document:${documentId}`,
      jurisdictionId: "jurisdiction:wa",
      printedIdentifier: "Floor amendment 001",
      recordType: "document",
      sourceUpdatedAt: null,
      sourceUrl: "https://leg.wa.gov/amendments/sb6027.pdf",
      submittedDate: "2026-02-01",
      title: "Floor amendment 001",
      updatedAt: new Date("2026-08-19T00:00:00.000Z")
    })
  })
})
