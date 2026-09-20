import {
  prepareResultPage,
  readResultPage,
  researchResultByteLimit
} from "@repo/legislation-core/research/result-pages"
import { describe, expect, it, vi } from "vitest"
import { entityCardSchema, projectEntityResult, ResultExpiredError } from "./entityResults"
import { createResultStore, type RetainedResult, type ResultPersistence } from "./resultStore"

vi.mock("./resultPersistence.server", () => {
  throw new Error("In-memory result stores must not import server persistence")
})

describe("result recovery", () => {
  it("loads a fragmented record as one logical page before resuming ordinary upstream results", async () => {
    const store = createResultStore()
    const owner = crypto.randomUUID()
    const input = { query: "housing", limit: 1 }
    const bill = { id: "bill:large", title: "Exact title ".repeat(20000) }
    const raw = { items: [bill], nextCursor: "upstream" }
    expect(Buffer.byteLength(JSON.stringify(raw))).toBeGreaterThan(researchResultByteLimit)
    const load = vi.fn<(cursor: string) => Promise<unknown>>(async (cursor) => {
      if (cursor === "start") {
        return prepareResultPage("search_bills", input, raw, 0)
      }
      const page = readResultPage("search_bills", { ...input, cursor })
      if (page.input.cursor === "upstream") {
        return { items: [{ id: "bill:last", title: "Last" }] }
      }
      return prepareResultPage("search_bills", page.input, raw, page.offset, page.snapshot, undefined, page.fragment)
    })
    const initial = store.create(
      owner,
      "search_bills",
      {
        items: Array.from({ length: 5 }, (_, index) => ({ id: `bill:${index}`, title: `Bill ${index}` })),
        nextCursor: "start"
      },
      input.query,
      load
    )!
    const next = await store.page(owner, initial.id, 1, new AbortController().signal)
    expect(next.items.map((item) => item.id)).toEqual([bill.id, "bill:last"])
    expect(next.items[0]?.title).toHaveLength(1000)
    expect(load.mock.calls.length).toBeGreaterThan(5)
    expect(store.record(owner, initial.id, bill.id).title.endsWith("…")).toBe(true)
    expect(bill.title).toHaveLength("Exact title ".length * 20000)
  })

  it.each([
    { recordedMemberCount: 8, membershipRelationsComplete: true, completeness: "complete", value: "8" },
    { recordedMemberCount: 8, membershipRelationsComplete: false, completeness: "partial", value: "8" },
    { recordedMemberCount: 8, completeness: "partial", value: "8" },
    { recordedMemberCount: 0, membershipRelationsComplete: true, completeness: "complete", value: "0" },
    { recordedMemberCount: 0, membershipRelationsComplete: false, completeness: "unknown", value: undefined },
    { recordedMemberCount: 0, completeness: "unknown", value: undefined },
    { memberCount: 0, completeness: "complete", value: "0" },
    { memberCount: 8, completeness: "complete", value: "8" },
    { completeness: "unknown", value: undefined }
  ])("preserves membership count coverage: %j", ({ completeness, value, ...organization }) => {
    const card = projectEntityResult("get_organization", {
      organization: { id: "org:coverage", name: "Committee", ...organization }
    })?.items[0]
    expect(card?.organizationSummary?.membershipCompleteness).toBe(completeness)
    expect(card?.fields.find((field) => field.id === "members")?.value).toBe(value)
    expect(entityCardSchema.safeParse(card).success).toBe(true)
  })

  it("requires known fact identifiers rather than accepting label-only fields", () => {
    const card = projectEntityResult("get_bill", {
      bill: { id: "bill:typed-facts", title: "Bill", introducedDate: "2025-01-01" }
    })?.items[0]
    expect(entityCardSchema.safeParse(card).success).toBe(true)
    for (const id of [undefined, "Introduced", "unknown-fact"]) {
      expect(
        entityCardSchema.safeParse({ ...card, fields: [{ id, label: "Introduced", value: "2025-01-01" }] }).success
      ).toBe(false)
    }
  })

  it("restores session-owned snapshots and resumes pagination after a process restart", async () => {
    const records = new Map<string, RetainedResult>()
    const persistence: ResultPersistence = {
      save: async (id, value) => {
        records.set(id, structuredClone(value))
      },
      read: async (sessionKey, id) => (records.get(id)?.sessionKey === sessionKey ? records.get(id) : undefined),
      load: vi.fn<ResultPersistence["load"]>(async () => ({ items: [{ id: "bill:next", title: "Next" }] }))
    }
    const owner = "11111111-1111-4111-8111-111111111111"
    const original = createResultStore(() => 1000, persistence)
    const initial = original.create(
      owner,
      "search_bills",
      {
        items: Array.from({ length: 5 }, (_, index) => ({ id: `bill:${index}`, title: `Bill ${index}` })),
        nextCursor: "continuation"
      },
      "housing",
      async () => ({}),
      { query: "housing", limit: 5 }
    )!
    await original.persist(initial.id)
    const restarted = createResultStore(() => 2000, persistence)
    await expect(restarted.recover("22222222-2222-4222-8222-222222222222", initial.id)).rejects.toBeInstanceOf(
      ResultExpiredError
    )
    await restarted.recover(owner, initial.id)
    expect(restarted.record(owner, initial.id, "bill:0").title).toBe("Bill 0")
    const next = await restarted.page(owner, initial.id, 1, new AbortController().signal)
    expect(next.items[0]?.id).toBe("bill:next")
    expect(persistence.load).toHaveBeenCalledWith(
      "search_bills",
      { query: "housing", limit: 5, cursor: "continuation" },
      expect.any(AbortSignal)
    )
    const expired = createResultStore(() => 1000 + 86400000, persistence)
    await expect(expired.recover(owner, initial.id)).rejects.toBeInstanceOf(ResultExpiredError)
  })
  it("omits committee classification from subtitles while preserving the structured value", () => {
    const record = {
      id: "org:1",
      name: "Housing",
      jurisdictionName: "Colorado",
      chamber: "House",
      classification: "committee"
    }
    const card = projectEntityResult("search_organizations", { items: [record] })?.items[0]
    expect(card?.subtitle).toBe("Colorado, House")
    expect(card?.organizationSummary?.classification).toBe("committee")
    const withoutLocation = projectEntityResult("search_organizations", {
      items: [{ id: "org:2", name: "Housing", classification: "committee" }]
    })?.items[0]
    expect(withoutLocation?.subtitle).toBeUndefined()
    expect(withoutLocation?.organizationSummary?.classification).toBe("committee")
  })

  it("preserves independent counts and serialized introduction dates without counting a partial document page", () => {
    const input = {
      bill: { id: "bill:1", title: "Bill", introducedAt: "2024-02-14T00:00:00.000Z", versionCount: 4 },
      documents: [{ classification: "supplemental" }],
      truncated: true
    }
    expect(projectEntityResult("get_bill", input)?.items[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "introduced", label: "Introduced", value: "2024-02-14" }),
        expect.objectContaining({ id: "versions", label: "Versions", value: "4" })
      ])
    )
    expect(
      projectEntityResult("get_bill", { ...input, bill: { id: "bill:1", title: "Bill" } })?.items[0]?.fields
    ).toEqual([])
  })

  it("uses complete owned meeting collections and preserves room and building", () => {
    const input = {
      event: { id: "event:1", name: "Meeting", location: { room: "H-313", building: "Capitol" } },
      agendaItems: [{ eventId: "event:1" }],
      documents: []
    }
    const card = projectEntityResult("get_event", input)?.items[0]
    expect(card?.meetingSummary?.location).toBe("H-313")
    expect(card?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agendaItems", label: "Agenda items", value: "1" }),
        expect.objectContaining({ id: "documents", label: "Documents", value: "0" }),
        expect.objectContaining({ id: "locationDetail", label: "Location detail", value: "Capitol" })
      ])
    )
    const partial = projectEntityResult("get_event", { ...input, truncated: true })?.items[0]
    expect(partial?.fields.some((field) => field.id === "agendaItems")).toBe(false)
    const foreign = projectEntityResult("get_event", { ...input, agendaItems: [{ eventId: "event:other" }] })?.items[0]
    expect(foreign?.fields.some((field) => field.id === "agendaItems")).toBe(false)
  })

  it("qualifies incomplete memberships and never infers office tenure from a current term", () => {
    const person = projectEntityResult("get_person", {
      person: { id: "person:1", name: "Member", recordedCommitteeRoleCount: 2 },
      terms: [{ isActive: true, startDate: "2025-01-03" }]
    })?.items[0]
    expect(person?.fields).toContainEqual({
      id: "committeeRoles",
      label: "Committee roles",
      value: "2",
      detail: "Recorded active roles"
    })
    expect(person?.fields.some((field) => field.id === "inOfficeSince")).toBe(false)
    const organization = projectEntityResult("get_organization", {
      organization: {
        id: "org:1",
        name: "Committee",
        recordedMemberCount: 8,
        membershipRelationsComplete: false,
        chairName: "Published chair"
      }
    })?.items[0]
    expect(organization?.fields).toContainEqual({
      id: "members",
      label: "Members",
      value: "8",
      detail: "Recorded active members"
    })
    expect(organization?.fields).toContainEqual({
      id: "chair",
      label: "Chair",
      value: "Published chair",
      detail: undefined
    })
  })

  it("preserves document identity, material attachments and date-only votes without inventing page counts", () => {
    const document = projectEntityResult("get_bill_text", {
      document: {
        id: "doc:1",
        title: "Text",
        billId: "bill:1",
        billIdentifier: "HB 1",
        sectionCount: 7,
        contentType: "application/xml"
      }
    })?.items[0]
    expect(document?.identifier).toBe("HB 1")
    expect(document?.fields).toContainEqual({ id: "sections", label: "Sections", value: "7", detail: undefined })
    expect(document?.fields).toContainEqual({ id: "pages", label: "Pages", value: "Not paginated", detail: undefined })
    const material = projectEntityResult("get_supporting_material", {
      material: { id: "material:1", title: "Report" },
      links: [{ materialId: "material:1", billIdentifier: "HB 1", amendmentIdentifier: "A 2" }]
    })?.items[0]
    expect(material?.fields).toContainEqual({ id: "attachedTo", label: "Attached to", value: "HB 1", detail: "A 2" })
    const vote = projectEntityResult("get_vote", {
      vote: { id: "vote:1", motion: "Agreed", heldDate: "2026-02-03", heldAt: null }
    })?.items[0]
    expect(vote?.subtitle).toBe("2026-02-03")
  })

  it.each([true, false])("uses dated federal amendment actions regardless of newestFirst=%s", (newestFirst) => {
    const amendment = {
      id: "amendment:us:119:hamdt:1",
      printedIdentifier: "HAMDT 1",
      recordType: "structured",
      submittedDate: "2025-01-10",
      status: "agreed"
    }
    const actions = [
      { amendmentId: amendment.id, ordinal: 0, description: "Agreed to", actionDate: "2025-01-15" },
      { amendmentId: amendment.id, ordinal: 1, description: "Offered", actionDate: "2025-01-10" },
      { amendmentId: amendment.id, ordinal: 2, description: "Undated record", actionDate: null }
    ]
    const input = { amendment, actions: newestFirst ? actions : actions.toReversed(), truncated: false }
    const card = projectEntityResult("get_amendment", input)?.items[0]
    expect(card?.amendmentSummary).toMatchObject({ submittedDate: "2025-01-10", status: "agreed" })
    expect(card?.fields).toContainEqual({
      id: "latestAction",
      label: "Latest action",
      value: "2025-01-15",
      detail: "Agreed to"
    })
    for (const incomplete of [
      { ...input, truncated: true },
      { ...input, actions: actions.map((action) => ({ ...action, actionDate: null })) }
    ]) {
      expect(
        projectEntityResult("get_amendment", incomplete)?.items[0]?.fields.some((field) => field.id === "latestAction")
      ).toBe(false)
    }
    const tied = projectEntityResult("get_amendment", {
      ...input,
      actions: [
        ...actions,
        { amendmentId: amendment.id, ordinal: 3, description: "Considered", actionDate: "2025-01-15" }
      ]
    })?.items[0]
    expect(tied?.fields).toContainEqual({
      id: "latestAction",
      label: "Latest action",
      value: "2025-01-15",
      detail: undefined
    })
  })

  it.each([true, false])("uses the independent latest action with truncated=%s", (truncated) => {
    const bill = { id: "bill:ca:20232024:sb:1047", title: "SB 1047" }
    const data = {
      bill,
      truncated,
      actions: [{ ordinal: 0, description: "Introduced" }],
      latestAction: { billId: bill.id, ordinal: 50, description: "Vetoed by Governor.", actionDate: "2024-09-29" }
    }
    expect(projectEntityResult("get_bill", data)?.items[0]?.billSummary?.latestAction).toEqual({
      description: "Vetoed by Governor.",
      date: "2024-09-29"
    })
    expect(
      projectEntityResult("get_bills", { items: [{ id: bill.id, data }] })?.items[0]?.billSummary?.latestAction
    ).toEqual({ description: "Vetoed by Governor.", date: "2024-09-29" })
  })

  it("does not guess latest action from a child page or accept another bill's summary", () => {
    const data = {
      bill: { id: "bill:1", title: "Bill" },
      truncated: false,
      actions: [{ ordinal: 5, description: "Read" }]
    }
    expect(projectEntityResult("get_bill", data)?.items[0]?.billSummary?.latestAction).toBeUndefined()
    expect(
      projectEntityResult("get_bill", { ...data, latestAction: { billId: "bill:other", description: "Vetoed" } })
        ?.items[0]?.billSummary?.latestAction
    ).toBeUndefined()
    expect(
      projectEntityResult("get_bill", { ...data, latestAction: null })?.items[0]?.billSummary?.latestAction
    ).toBeUndefined()
  })

  it.each(["2024-12-27T18:00:00.000Z", new Date("2024-12-27T18:00:00.000Z")])(
    "preserves timestamp precedence before and after serialization: %s",
    (actionAt) => {
      const result = projectEntityResult("get_bill", {
        bill: { id: "bill:1", title: "Bill", introducedAt: "2024-05-06" },
        latestAction: { billId: "bill:1", description: "Reported", actionAt, actionDate: "2020-01-01" }
      })
      expect(result?.items[0]?.billSummary?.latestAction).toEqual({ description: "Reported", date: "2024-12-27" })
      expect(result?.items[0]?.fields).toContainEqual({ id: "introduced", label: "Introduced", value: "2024-05-06" })
    }
  )

  function setup() {
    let time = 0
    const store = createResultStore(() => time)
    const load = vi.fn<() => Promise<{ items: { id: string; title: string }[] }>>(async () => ({
      items: [{ id: "bill:2", title: "Second bill" }]
    }))
    const first = store.create(
      "owner",
      "search_bills",
      { items: [{ id: "bill:1", title: "First bill" }], nextCursor: "next" },
      undefined,
      load
    )
    if (!first) {
      throw new Error("Expected a result snapshot")
    }
    return {
      store,
      first,
      load,
      expire: () => {
        time = 900000
      }
    }
  }

  it("rejects expired and foreign snapshots without fetching", async () => {
    const { store, first, load, expire } = setup()
    await expect(store.page("other", first.id, 1, new AbortController().signal)).rejects.toBeInstanceOf(
      ResultExpiredError
    )
    expire()
    await expect(store.page("owner", first.id, 0, new AbortController().signal)).rejects.toBeInstanceOf(
      ResultExpiredError
    )
    expect(load).not.toHaveBeenCalled()
  })

  it("retains the loaded page after a temporary failure and permits retry", async () => {
    const { store, first, load } = setup()
    const failure = new Error("Temporary dependency failure")
    load.mockRejectedValueOnce(failure)
    await expect(store.page("owner", first.id, 1, new AbortController().signal)).rejects.toBe(failure)
    await expect(store.page("owner", first.id, 0, new AbortController().signal)).resolves.toEqual(first)
    const next = await store.page("owner", first.id, 1, new AbortController().signal)
    expect(next.items.map((record) => record.id)).toEqual(["bill:2"])
    expect(next.hasNext).toBe(false)
    expect(next.hasPrevious).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("does not return cached results for an aborted request", async () => {
    const { store, first, load } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(store.page("owner", first.id, 0, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(load).not.toHaveBeenCalled()
  })
})
