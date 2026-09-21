import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { createPresentationRecords } from "./compositionRecords"
import { contentOptions, projectPresentationContents } from "./presentationContent"
import { createResultStore } from "./resultStore"

describe("run-owned presentation records", () => {
  it("resolves short model handles only within their originating turn", () => {
    const store = createResultStore()
    const page = store.create(
      "owner",
      "search_bills",
      { items: [{ id: "bill:one", title: "One" }] },
      undefined,
      async () => ({})
    )!
    const run = createPresentationRecords("owner", store)
    const handle = run.register(page)
    expect(handle).toBe("r1")
    const canonical = run.canonicalReference({ resultId: handle, recordId: "bill:one" })
    expect(canonical.resultId).toBe(page.id)
    expect(run.resolve(canonical).id).toBe("bill:one")
    expect(() =>
      createPresentationRecords("owner", store).canonicalReference({ resultId: handle, recordId: "bill:one" })
    ).toThrow("The result was not retrieved in this response.")
  })
  it("builds progress from classified actions without inferring unreached stages or using another bill", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:119:hr:1", title: "Published bill", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "intro",
          billId: "bill:us:119:hr:1",
          ordinal: 1,
          classification: ["introduction"],
          actionDate: "2025-01-01"
        },
        {
          id: "committee",
          billId: "bill:us:119:hr:1",
          ordinal: 2,
          classification: ["referral-committee"],
          actionDate: "2025-01-02"
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const content = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(content?.kind === "bill-progress")
    expect(content.stages.map((stage) => stage.state)).toEqual(["recorded", "current", "unknown", "unknown", "unknown"])
    expect(content.stages.at(-1)?.label).toBe("President")
    expect(contentOptions(content).components).toEqual(["BillProgressCard"])
    const partial = projectPresentationContents("get_bill", { ...data, progressTruncated: true }, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(partial?.kind === "bill-progress")
    expect(partial.hasMore).toBe(true)
    expect(partial.stages.some((stage) => stage.state === "current")).toBe(false)
    expect(
      projectPresentationContents("get_bill", { ...data, bill: { ...data.bill, id: "foreign" } }, [], page).some(
        (content) => content.kind === "bill-progress"
      )
    ).toBe(false)
  })

  it("derives introduction and referral stages from recorded description text when classification is unset", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:119:hr:7989", title: "Federal bill", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "intro",
          billId: "bill:us:119:hr:7989",
          ordinal: 1,
          classification: [],
          actionDate: "2025-03-18",
          sourceUrl: "https://congress.gov/bill/119/hr/7989/actions",
          description: "Introduced in House"
        },
        {
          id: "committee",
          billId: "bill:us:119:hr:7989",
          ordinal: 2,
          classification: [],
          actionDate: "2025-03-18",
          sourceUrl: "https://congress.gov/bill/119/hr/7989/actions",
          description: "Referred to the House Committee on Energy and Commerce"
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const content = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(content?.kind === "bill-progress")
    expect(content.stages.map((stage) => stage.state)).toEqual(["recorded", "current", "unknown", "unknown", "unknown"])
    const introduced = content.stages.find((stage) => stage.id === "introduced")
    const committee = content.stages.find((stage) => stage.id === "committee")
    // Real recorded date and source URL are preserved, not fabricated.
    expect(introduced?.date).toBe("2025-03-18")
    expect(committee?.date).toBe("2025-03-18")
    expect(committee?.sourceUrl).toBe("https://congress.gov/bill/119/hr/7989/actions")
    // Referral is only "current" (in progress), never promoted to a completed/approved state.
    expect(committee?.state).toBe("current")
    const undatedPartial = projectPresentationContents(
      "get_bill",
      {
        ...data,
        progressActions: data.progressActions.map((action) => ({ ...action, actionDate: null })),
        progressTruncated: true
      },
      [],
      page
    ).find((content) => content.kind === "bill-progress")
    invariant(undatedPartial?.kind === "bill-progress")
    expect(undatedPartial.hasMore).toBe(true)
    expect(undatedPartial.stages.map((stage) => stage.state)).toEqual([
      "recorded",
      "recorded",
      "unknown",
      "unknown",
      "unknown"
    ])
    expect(undatedPartial.stages.every((stage) => stage.date === undefined)).toBe(true)
  })

  it("preserves the query's chronological progress order instead of re-sorting federal source ordinals", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:118:hr:8245", title: "HR 8245", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "intro",
          billId: "bill:us:118:hr:8245",
          ordinal: 5,
          classification: ["introduction"],
          actionDate: "2024-05-06"
        },
        {
          id: "referral",
          billId: "bill:us:118:hr:8245",
          ordinal: 4,
          classification: ["referral-committee"],
          actionDate: null,
          actionAt: "2024-05-06T18:00:00.000Z",
          sourceUrl: "https://www.congress.gov/bill/118th-congress/house-bill/8245/all-actions"
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)!
    const progress = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    expect(progress?.kind === "bill-progress" && progress.stages.slice(0, 2)).toMatchObject([
      { id: "introduced", state: "recorded", date: "2024-05-06" },
      { id: "committee", state: "current", date: "2024-05-06", sourceUrl: data.progressActions[1]?.sourceUrl }
    ])
    const undated = projectPresentationContents(
      "get_bill",
      {
        ...data,
        progressActions: data.progressActions.map((action) => ({ ...action, actionDate: null, actionAt: null }))
      },
      [],
      page
    ).find((content) => content.kind === "bill-progress")
    expect(undated?.kind === "bill-progress" && undated.stages.some((stage) => stage.state === "current")).toBe(false)
  })

  it("leaves stages unknown when unset classification and description do not match a recognized boilerplate phrase", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:119:hr:7989", title: "Federal bill", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "remarks",
          billId: "bill:us:119:hr:7989",
          ordinal: 1,
          classification: [],
          actionDate: "2025-03-18",
          description: "Sponsor introductory remarks on measure"
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const content = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(content?.kind === "bill-progress")
    expect(content.stages.every((stage) => stage.state === "unknown")).toBe(true)
  })

  it("prefers real classification over description-derived classification when both are present", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:119:hr:7989", title: "Federal bill", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "committee",
          billId: "bill:us:119:hr:7989",
          ordinal: 1,
          // Text alone would match "introduction", but real classification says committee referral;
          // the real, already-recorded classification must win.
          classification: ["referral-committee"],
          actionDate: "2025-03-18",
          description: "Introduced in House"
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const content = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(content?.kind === "bill-progress")
    const introduced = content.stages.find((stage) => stage.id === "introduced")
    const committee = content.stages.find((stage) => stage.id === "committee")
    expect(introduced?.state).toBe("unknown")
    expect(committee?.state).toBe("current")
  })

  it("records enacted executive milestones without presenting them as current", () => {
    const store = createResultStore()
    const data = {
      bill: { id: "bill:us:119:hr:1", title: "Enacted bill", chamber: "lower", jurisdictionId: "jurisdiction:us" },
      progressActions: [
        {
          id: "signed",
          billId: "bill:us:119:hr:1",
          ordinal: 1,
          classification: ["executive-signature"],
          actionDate: "2025-07-04",
          description: "Signed by President."
        },
        {
          id: "law",
          billId: "bill:us:119:hr:1",
          ordinal: 2,
          classification: ["became-law"],
          actionDate: "2025-07-04",
          description: "Became Public Law No: 119-21."
        }
      ],
      progressTruncated: false
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const content = projectPresentationContents("get_bill", data, [], page).find(
      (candidate) => candidate.kind === "bill-progress"
    )
    invariant(content?.kind === "bill-progress")
    expect(content.stages.at(-1)).toMatchObject({ id: "executive", state: "recorded", date: "2025-07-04" })
  })

  it("projects the complete HR 636 lifecycle from recorded federal action descriptions", () => {
    const store = createResultStore()
    const bill = {
      id: "bill:us:114:hr:636",
      title: "FAA Extension, Safety, and Security Act of 2016",
      chamber: "lower",
      jurisdictionId: "jurisdiction:us",
      status: "Became Public Law No: 114-190."
    }
    const data = {
      bill,
      progressTruncated: false,
      progressActions: [
        ["2015-02-02", "Introduced in House"],
        ["2015-02-02", "Referred to the Committee on Ways and Means"],
        ["2015-02-12", "Rule H. Res. 101 passed House."],
        ["2015-02-13", "Passed/agreed to in House: On passage Passed by recorded vote: 272 - 142."],
        ["2016-04-19", "Passed Senate with an amendment and an amendment to the Title by Yea-Nay Vote."],
        ["2016-07-15", "Signed by President."],
        ["2016-07-15", "Became Public Law No: 114-190."]
      ].map(([actionDate, description], ordinal) => ({
        id: `action-${ordinal}`,
        billId: bill.id,
        ordinal,
        classification: [],
        chamber: null,
        actionDate,
        description
      }))
    }
    const page = store.create("owner", "get_bill", data, undefined, async () => data)
    invariant(page)
    const progress = projectPresentationContents("get_bill", data, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(progress?.kind === "bill-progress")
    expect(progress.stages.map(({ state, date }) => ({ state, date }))).toEqual([
      { state: "recorded", date: "2015-02-02" },
      { state: "recorded", date: "2015-02-02" },
      { state: "recorded", date: "2015-02-13" },
      { state: "recorded", date: "2016-04-19" },
      { state: "recorded", date: "2016-07-15" }
    ])
    const incomplete = { ...data, progressActions: data.progressActions.slice(0, 2) }
    const partial = projectPresentationContents("get_bill", incomplete, [], page).find(
      (content) => content.kind === "bill-progress"
    )
    invariant(partial?.kind === "bill-progress")
    expect(partial.stages.some((stage) => stage.state === "current")).toBe(false)
    expect(partial.stages.slice(2).every((stage) => stage.state === "unknown" && stage.date === undefined)).toBe(true)
  })

  it("resolves only exact run-owned content and preserves source snapshots", () => {
    const contents = projectPresentationContents("get_bill_text", {}, [
      {
        id: "source-one",
        citationRef: "e7",
        recordId: "document-one",
        title: "Introduced text",
        origin: "canonical",
        sourceUrl: "https://example.org/introduced",
        versionLabel: "Introduced",
        locator: "Section 2",
        content: { state: "available", quote: "Exact retrieved passage." }
      }
    ])
    const content = contents[0]
    invariant(content)
    const run = createPresentationRecords("owner")
    run.registerContents(contents)
    expect(contentOptions(content).components).toEqual(["CitationCard", "CompactPassageCard", "PassageQuote"])
    expect(contentOptions(content)).toMatchObject({
      evidenceId: "source-one",
      recordId: "document-one",
      locator: "Section 2",
      contentState: "available"
    })
    expect(run.resolveContent({ contentId: content.id })).toEqual(content)
    const resolved = run.resolveContent({ contentId: content.id })
    if (resolved.kind === "evidence") {
      resolved.evidence.title = "Changed"
    }
    expect(run.resolveContent({ contentId: content.id })).toEqual(content)
    expect(() => createPresentationRecords("owner").resolveContent({ contentId: content.id })).toThrow(/not retrieved/)
    expect(() => run.resolveContent({ contentId: crypto.randomUUID() })).toThrow(/not retrieved/)
    expect(() => run.registerContents(contents)).toThrow(/duplicate/)
  })

  it("projects only returned timeline events and preserves partial coverage", () => {
    const events = [
      { id: "action-1", type: "action", description: "Referred to committee", date: "2026-01-01", sourceUrl: null }
    ]
    const contents = projectPresentationContents(
      "get_bill_timeline",
      { billId: "bill-one", events, nextCursor: "next" },
      []
    )
    expect(contents).toEqual([{ id: expect.any(String), kind: "timeline", billId: "bill-one", events, hasMore: true }])
    expect(projectPresentationContents("search_bills", { billId: "bill-one", events }, [])).toEqual([])
  })

  it("projects not-found only from an explicit per-record lookup failure", () => {
    const results = projectPresentationContents(
      "get_bills",
      {
        items: [
          { id: "missing", error: { category: "not_found", message: "Not found" } },
          { id: "denied", error: { category: "forbidden" } },
          { id: "valid", data: { bill: { id: "valid" } } }
        ]
      },
      []
    )
    expect(results).toEqual([
      {
        id: expect.any(String),
        kind: "record-status",
        recordId: "missing",
        title: "missing",
        state: "not-found",
        sourceUrl: null
      }
    ])
    expect(projectPresentationContents("search_bills", { items: [] }, [])).toEqual([])
  })

  it("does not show not-collected when the same document has a retrieved passage", () => {
    const metadata = {
      id: "metadata",
      recordId: "document",
      title: "Document",
      origin: "canonical" as const,
      sourceUrl: null,
      content: { state: "not-collected" as const }
    }
    const passage = { ...metadata, id: "passage", content: { state: "available" as const, quote: "Exact passage" } }
    expect(
      projectPresentationContents("get_bill_text", {}, [metadata, passage]).map((content) => content.kind)
    ).toEqual(["evidence", "evidence"])
    expect(projectPresentationContents("get_bill_text", {}, [metadata]).at(-1)).toMatchObject({
      kind: "record-status",
      state: "not-collected"
    })
  })

  it("resolves only current-run results owned by the same session including later-page records", () => {
    const store = createResultStore()
    const page = store.create(
      "owner",
      "search_bills",
      {
        items: Array.from({ length: 10 }, (_, index) => ({ id: `bill:${index}`, title: `Bill ${index}` }))
      },
      "education",
      async () => ({ items: [] })
    )
    invariant(page)
    const run = createPresentationRecords("owner", store)
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(/not retrieved/)
    run.register(page)
    const record = run.resolve({ resultId: page.id, recordId: "bill:9" })
    expect(record.title).toBe("Bill 9")
    record.title = "Changed client copy"
    expect(run.resolve({ resultId: page.id, recordId: "bill:9" }).title).toBe("Bill 9")
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:unknown" })).toThrow(/not in this result/)
    expect(() => createPresentationRecords("owner", store).resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(
      /not retrieved/
    )
    const foreign = createPresentationRecords("foreign", store)
    foreign.register(page)
    expect(() => foreign.resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(/expired/)
  })

  it("reauthorizes expiry when a model selects a record", () => {
    let now = 0
    const store = createResultStore(() => now)
    const page = store.create(
      "owner",
      "search_bills",
      { items: [{ id: "bill:1", title: "Bill" }] },
      undefined,
      async () => ({ items: [] })
    )
    invariant(page)
    const run = createPresentationRecords("owner", store)
    run.register(page)
    now = 15 * 60 * 1000
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:1" })).toThrow(/expired/)
  })
})
