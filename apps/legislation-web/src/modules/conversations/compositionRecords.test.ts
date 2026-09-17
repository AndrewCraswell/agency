import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { createPresentationRecords } from "./compositionRecords"
import { contentOptions, projectPresentationContents } from "./presentationContent"
import { createResultStore } from "./resultStore"

describe("run-owned presentation records", () => {
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

  it("resolves only exact run-owned content and preserves source snapshots", () => {
    const contents = projectPresentationContents("get_bill_text", {}, [
      {
        id: "source-one",
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
