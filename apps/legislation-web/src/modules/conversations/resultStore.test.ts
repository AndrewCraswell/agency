import { describe, expect, it, vi } from "vitest"
import { projectEntityResult, ResultExpiredError } from "./entityResults"
import { createResultStore } from "./resultStore"

describe("result recovery", () => {
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
        expect.objectContaining({ label: "Introduced", value: "2024-02-14" }),
        expect.objectContaining({ label: "Versions", value: "4" })
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
        expect.objectContaining({ label: "Agenda items", value: "1" }),
        expect.objectContaining({ label: "Documents", value: "0" }),
        expect.objectContaining({ label: "Location detail", value: "Capitol" })
      ])
    )
    const partial = projectEntityResult("get_event", { ...input, truncated: true })?.items[0]
    expect(partial?.fields.some((field) => field.label === "Agenda items")).toBe(false)
    const foreign = projectEntityResult("get_event", { ...input, agendaItems: [{ eventId: "event:other" }] })?.items[0]
    expect(foreign?.fields.some((field) => field.label === "Agenda items")).toBe(false)
  })

  it("qualifies incomplete memberships and never infers office tenure from a current term", () => {
    const person = projectEntityResult("get_person", {
      person: { id: "person:1", name: "Member", recordedCommitteeRoleCount: 2 },
      terms: [{ isActive: true, startDate: "2025-01-03" }]
    })?.items[0]
    expect(person?.fields).toContainEqual({ label: "Committee roles", value: "2", detail: "Recorded active roles" })
    expect(person?.fields.some((field) => field.label === "In office since")).toBe(false)
    const organization = projectEntityResult("get_organization", {
      organization: {
        id: "org:1",
        name: "Committee",
        recordedMemberCount: 8,
        membershipRelationsComplete: false,
        chairName: "Published chair"
      }
    })?.items[0]
    expect(organization?.fields).toContainEqual({ label: "Members", value: "8", detail: "Recorded active members" })
    expect(organization?.fields).toContainEqual({ label: "Chair", value: "Published chair", detail: undefined })
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
    expect(document?.fields).toContainEqual({ label: "Sections", value: "7", detail: undefined })
    expect(document?.fields).toContainEqual({ label: "Pages", value: "Not paginated", detail: undefined })
    const material = projectEntityResult("get_supporting_material", {
      material: { id: "material:1", title: "Report" },
      links: [{ materialId: "material:1", billIdentifier: "HB 1", amendmentIdentifier: "A 2" }]
    })?.items[0]
    expect(material?.fields).toContainEqual({ label: "Attached to", value: "HB 1", detail: "A 2" })
    const vote = projectEntityResult("get_vote", {
      vote: { id: "vote:1", motion: "Agreed", heldDate: "2026-02-03", heldAt: null }
    })?.items[0]
    expect(vote?.subtitle).toBe("2026-02-03")
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
