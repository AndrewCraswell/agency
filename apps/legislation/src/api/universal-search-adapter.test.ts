import { describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../db/database.js"
import type { AmendmentSearchApi } from "./amendment-search.js"
import type { CivicSearchApi } from "./civic-search.js"
import { createProductionUniversalSearchApi } from "./universal-search-adapter.js"

const mocks = vi.hoisted(() => ({
  listMeetings: vi.fn<(...arguments_: unknown[]) => Promise<{ items: { id: string }[]; truncated: boolean }>>(),
  listPeople: vi.fn<(...arguments_: unknown[]) => Promise<{ items: { id: string }[]; truncated: boolean }>>(),
  projectBillSearchHits: vi.fn<(...arguments_: unknown[]) => unknown[]>(),
  projectMeetingRead: vi.fn<(...arguments_: unknown[]) => ReturnType<typeof canonical>>(),
  projectPersonRead: vi.fn<(...arguments_: unknown[]) => ReturnType<typeof canonical>>()
}))

vi.mock("../db/queries/meeting-read.js", () => ({ listMeetings: mocks.listMeetings }))
vi.mock("../db/queries/people-read.js", () => ({ listPeople: mocks.listPeople }))
vi.mock("./canonical-search.js", () => ({ projectBillSearchHits: mocks.projectBillSearchHits }))
vi.mock("./meeting-read-projection.js", () => ({ projectMeetingRead: mocks.projectMeetingRead }))
vi.mock("./people-read-routes.js", () => ({ projectPersonRead: mocks.projectPersonRead }))

const source = {
  isOfficial: true,
  provider: "fixture",
  retrievedAt: "2026-08-25T00:00:00.000Z",
  sourceUpdatedAt: null,
  sourceUrl: "https://source.example.test"
}

function canonical(type: "bill" | "meeting" | "person", id: string) {
  return {
    canonicalUrl: `https://api.example.test/api/${type}s/${id}`,
    id,
    sources: [source],
    type,
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

function service(): CivicSearchApi & AmendmentSearchApi {
  return {
    compareBillVersions: async () => ({}),
    searchAmendmentHits: async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false,
      warnings: []
    }),
    searchAmendments: async () => ({ items: [], truncated: false }),
    searchBillText: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
    searchBills: async () => ({ items: [], search: { isReranked: false, models: [] }, truncated: false }),
    searchSupportingMaterialHits: async () => ({
      items: [],
      search: { isReranked: false, models: [] },
      truncated: false,
      warnings: []
    }),
    searchSupportingMaterials: async () => ({ items: [], truncated: false })
  }
}

function input(recordType: "bill" | "meeting" | "person", query: string) {
  return { filters: undefined, mode: "lexical" as const, perTypeLimit: 7, query, recordType, shared: {} }
}

describe("production universal-search adapter", () => {
  it("passes person lexical search through the canonical people query", async () => {
    mocks.listPeople.mockResolvedValueOnce({ items: [{ id: "person:ada" }], truncated: false })
    mocks.projectPersonRead.mockReturnValueOnce(canonical("person", "person:ada"))
    const database: LegislationDatabase = Object.create(null)
    const page = await createProductionUniversalSearchApi(service(), database, "https://api.example.test").search(
      input("person", "Ada")
    )
    expect(mocks.listPeople).toHaveBeenCalledWith(database, expect.objectContaining({ limit: 7, q: "Ada" }))
    expect(page.items[0]).toMatchObject({ recordId: "person:ada", recordType: "person" })
  })

  it("passes meeting lexical search into SQL-backed query input instead of filtering a prefix", async () => {
    mocks.listMeetings.mockResolvedValueOnce({ items: [{ id: "meeting:budget" }], truncated: false })
    mocks.projectMeetingRead.mockReturnValueOnce(canonical("meeting", "meeting:budget"))
    const database: LegislationDatabase = Object.create(null)
    await createProductionUniversalSearchApi(service(), database, "https://api.example.test").search(
      input("meeting", "Budget")
    )
    expect(mocks.listMeetings).toHaveBeenCalledWith(database, expect.objectContaining({ limit: 7, query: "Budget" }))
  })

  it("adapts embedded bill retrieval through its canonical search projection", async () => {
    const hit = {
      match: { lexicalScore: 1, matchedFields: ["title"], rerankScore: null, semanticScore: null, snippet: null },
      record: canonical("bill", "bill:1"),
      recordId: "bill:1",
      recordType: "bill" as const,
      sources: [source]
    }
    mocks.projectBillSearchHits.mockReturnValueOnce([hit])
    const page = await createProductionUniversalSearchApi(service(), undefined, "https://api.example.test").search(
      input("bill", "budget")
    )
    expect(page.items).toEqual([expect.objectContaining({ recordId: "bill:1", recordType: "bill" })])
  })
})
