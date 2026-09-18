import * as schema from "@repo/legislation-core/database/schema/schema"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import { analyzeLegislation, compileAnalytics } from "@repo/legislation-core/research/analytics"
import { describeAnalytics } from "@repo/legislation-core/research/analytics-catalog"
import { drizzle } from "drizzle-orm/node-postgres"
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { describe, expect, it, vi } from "vitest"

const render = (input: unknown) => new PgDialect().sqlToQuery(compileAnalytics(input).statement)

describe("relationship analytics", () => {
  it("indexes session-scoped vote rankings without scanning unrelated positions", () => {
    const votes = getTableConfig(schema.votes).indexes.find((index) => index.config.name === "votes_session_idx")
    const positions = getTableConfig(schema.votePositions).indexes.find(
      (index) => index.config.name === "vote_positions_vote_option_person_idx"
    )
    expect(votes?.config.columns.map((column) => ("name" in column ? column.name : undefined))).toEqual([
      "session_id",
      "id"
    ])
    expect(positions?.config.columns.map((column) => ("name" in column ? column.name : undefined))).toEqual([
      "vote_id",
      "option",
      "person_id"
    ])
    expect(positions?.config.unique).toBe(false)
  })

  it("records execution stages and reports compiler failures without querying", async () => {
    const pool = new pg.Pool()
    const database = drizzle(pool, { schema })
    const observe = vi.fn<(name: string, metadata: Readonly<Record<string, unknown>>) => void>()
    const reportFailure = vi.fn<NonNullable<Telemetry["reportFailure"]>>()
    const telemetry: Telemetry = {
      observe: async (name, metadata, operation) => {
        observe(name, metadata)
        return await operation()
      },
      reportFailure,
      shutdown: async () => undefined
    }
    const execute = vi
      .spyOn(database, "execute")
      .mockResolvedValue({ rows: [{ total: 4 }], rowCount: 1, command: "SELECT", oid: 0, fields: [] })
    try {
      const result = await analyzeLegislation(
        database,
        { dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] },
        telemetry
      )
      expect(result.rows).toEqual([{ total: 4 }])
      expect(observe.mock.calls.map((call) => call[0])).toEqual([
        "analytics.compile",
        "analytics.execute",
        "analytics.serialize"
      ])
      expect(observe.mock.calls[2]?.[1]).toMatchObject({ dataset: "bills", rowCount: 1, resultBytes: 13 })
      await expect(analyzeLegislation(database, { dataset: "webhooks", select: ["id"] }, telemetry)).rejects.toThrow(
        "Unknown analytics dataset"
      )
      expect(reportFailure).toHaveBeenCalledWith(
        "analytics",
        expect.objectContaining({ stage: "compile" }),
        expect.any(Error)
      )
      expect(execute).toHaveBeenCalledOnce()
    } finally {
      execute.mockRestore()
      await pool.end()
    }
  })
  it("discovers only public allowlisted tables and foreign-key relationships", () => {
    const catalog = describeAnalytics(["bills", "sponsorships", "positions"])
    expect(catalog.datasets).not.toContain("webhooks")
    expect(catalog.details[0]?.fields).not.toHaveProperty("embedding")
    expect(catalog.details[1]?.relations.person?.dataset).toBe("people")
    expect(catalog.details[2]?.fields._key).toBe("identity")
  })

  it("counts distinct bills despite joining multiple sponsors and amendments", () => {
    const result = render({
      dataset: "bills",
      select: ["sponsorships.person.id"],
      metrics: [{ name: "bills", operation: "countDistinct", field: "id" }],
      filters: [{ field: "amendments.id", op: "notNull" }]
    })
    expect(result.sql).toContain('count(distinct "root"."id")')
    expect(result.sql).toContain('left join "legislation"."amendments"')
    expect(result.sql).toContain("group by")
  })

  it("binds hostile values without making them executable", () => {
    const value = "'; drop table legislation.bills; --"
    const result = render({
      dataset: "bills",
      select: ["id"],
      filters: [{ field: "title", op: "eq", values: [value] }]
    })
    expect(result.sql).not.toContain(value)
    expect(result.params).toContain(value)
  })

  it("requires canonical IDs for named-person equality filters", () => {
    expect(() =>
      render({
        dataset: "sponsorships",
        select: ["billId"],
        filters: [{ field: "person.name", op: "eq", values: ["Alexandria Ocasio-Cortez"] }]
      })
    ).toThrow("resolve_record")
  })

  it.each([
    { dataset: "webhooks", select: ["id"] },
    { dataset: "bills", select: ["embedding"] },
    { dataset: "bills", select: ["id;delete"] },
    { dataset: "bills", select: ["constructor.name"] },
    { dataset: "bills", select: ["id"], orderBy: [{ field: "title", direction: "desc" }] },
    { dataset: "bills", select: ["id"], filters: [{ field: "id", op: "eq" }] },
    { dataset: "bills", select: ["id"], limit: 101 },
    { dataset: "bills", select: ["id", "id"] },
    { dataset: "bills", select: ["id"], rates: [{ name: "rate", numerator: "missing", denominator: "missing" }] }
  ])("rejects invalid identifiers and unsupported plans: %j", (input) => {
    expect(() => render(input)).toThrow()
  })

  it("excludes deleted meetings through direct and joined reads", () => {
    expect(render({ dataset: "meetings", select: ["id"] }).sql).toContain('"root"."is_deleted" = false')
    expect(render({ dataset: "participants", select: ["event.name"] }).sql).toContain('"join1"."is_deleted" = false')
  })

  it("computes conditional distinct counts and null-safe percentages", () => {
    const result = render({
      dataset: "positions",
      select: ["personId"],
      metrics: [
        {
          name: "abstentions",
          operation: "countDistinct",
          field: "voteId",
          filters: [{ field: "option", op: "eq", values: ["abstain"] }]
        },
        { name: "recordedVotes", operation: "countDistinct", field: "voteId" }
      ],
      rates: [{ name: "percent", numerator: "abstentions", denominator: "recordedVotes" }]
    })
    expect(result.sql).toContain('nullif("recordedVotes", 0)')
    expect(result.sql).toContain('filter (where "root"."option" = $1)')
  })

  it("rejects percentages with different identity grains", () => {
    expect(() =>
      render({
        dataset: "positions",
        metrics: [
          { name: "people", operation: "countDistinct", field: "personId" },
          { name: "votes", operation: "countDistinct", field: "voteId" }
        ],
        rates: [{ name: "percent", numerator: "people", denominator: "votes" }]
      })
    ).toThrow("same distinct counting field")
  })

  it("reports database and oversized-result failure stages", async () => {
    const pool = new pg.Pool()
    const database = drizzle(pool, { schema })
    const reportFailure = vi.fn<NonNullable<Telemetry["reportFailure"]>>()
    const telemetry: Telemetry = {
      observe: async (_name, _metadata, operation) => await operation(),
      reportFailure,
      shutdown: async () => undefined
    }
    const execute = vi.spyOn(database, "execute")
    const query = { dataset: "bills", select: ["id"] }
    try {
      execute.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "57014" }))
      await expect(analyzeLegislation(database, query, telemetry)).rejects.toThrow("timeout")
      execute.mockResolvedValueOnce({
        rows: [{ id: "x".repeat(150_001) }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: []
      })
      await expect(analyzeLegislation(database, query, telemetry)).rejects.toThrow("Select fewer fields")
      expect(reportFailure.mock.calls.map((call) => call[1].stage)).toEqual(["execute", "serialize"])
      expect(reportFailure.mock.calls.every((call) => typeof call[1].queryHash === "string")).toBe(true)
    } finally {
      execute.mockRestore()
      await pool.end()
    }
  })
})
