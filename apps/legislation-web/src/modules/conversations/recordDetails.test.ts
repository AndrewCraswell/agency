import { describe, expect, it } from "vitest"
import { projectEntityResult } from "./entityResults"
import { projectMeetingDetails, projectProfileDetails } from "./recordDetails"

const event = {
  id: "meeting:check",
  name: "Published hearing",
  startAt: "2026-02-11T20:30:00Z",
  timezone: "America/Denver",
  publisherLocalDate: "2026-02-11",
  status: "scheduled"
}

describe("record view projections", () => {
  it.each(["text/html", "application/xml", "application/xhtml+xml"])(
    "does not invent physical pages for %s sources",
    (contentType) => {
      expect(
        projectEntityResult("get_bill_text", { document: { id: "document:one", title: "Published text", contentType } })
          ?.items[0]?.fields
      ).toContainEqual({ label: "Pages", value: "Not paginated", detail: undefined })
    }
  )

  it("preserves source years without inventing exact service dates", () => {
    const record = projectEntityResult("get_person", {
      person: { id: "person:one", name: "Published member", isActive: true, inOfficeSinceYear: 1997 },
      terms: [{ startYear: 2025, endYear: 2027, isActive: true }]
    })?.items[0]
    expect(record?.fields).toContainEqual({ label: "In office since", value: "1997", detail: undefined })
    expect(record?.personSummary?.term).toMatchObject({ startYear: 2025, endYear: 2027 })
    expect(record?.personSummary?.term?.startDate).toBeUndefined()
  })

  it("uses the selected document's measured page count without counting a partial section page", () => {
    const document = { id: "document:one", title: "Published PDF", ocrPageCount: 12 }
    expect(projectEntityResult("get_bill_text", { document })?.items[0]?.fields).toContainEqual({
      label: "Pages",
      value: "12",
      detail: undefined
    })
    expect(
      projectEntityResult("get_bill_text", { document: { ...document, pageCount: 14 } })?.items[0]?.fields
    ).toContainEqual({ label: "Pages", value: "14", detail: undefined })
    const missing = projectEntityResult("get_bill_text", {
      document: { ...document, ocrPageCount: null },
      sections: [{ pageEnd: 2 }],
      truncated: true
    })?.items[0]
    expect(missing?.fields.some((field) => field.label === "Pages")).toBe(false)
  })

  it("preserves published time zones without inventing times for all-day or unknown-zone meetings", () => {
    const timed = projectEntityResult("get_event", { event })?.items[0]
    expect(timed?.subtitle).toContain("1:30")
    const unknown = projectEntityResult("get_event", { event: { ...event, timezone: "invalid-zone" } })?.items[0]
    expect(unknown?.meetingSummary?.timezone).toBeUndefined()
    expect(unknown?.subtitle).not.toContain(":")
    const allDay = projectEntityResult("get_event", { event: { ...event, allDay: true } })?.items[0]
    expect(allDay?.subtitle).not.toContain(":")
  })

  it("keeps agenda ordering and source-listed participants without inventing relationships", () => {
    const result = projectMeetingDetails({
      event,
      agendaItems: [
        { id: "b", ordinal: 2, title: "Second" },
        { id: "a", ordinal: 1, title: "First" }
      ],
      participants: [
        { participant: { id: "p", name: "Published name", role: "Chair" }, person: null, organization: null }
      ],
      documents: [{ id: "doc", title: "Notice", sourceUrl: "https://example.com/notice?token=secret" }]
    })
    expect(result.agenda.map((item) => item.title)).toEqual(["First", "Second"])
    expect(result.participants).toEqual([{ id: "p", name: "Published name", role: "Chair" }])
    expect(result.documents[0]?.sourceUrl).toBeNull()
  })

  it("does not turn a historical term into current service", () => {
    const data = {
      person: { id: "person:check", name: "Published member", isActive: false },
      terms: [
        { id: "term", officeTitle: "Representative", startDate: "2010-01-01", endDate: "2014-01-01", isActive: false }
      ]
    }
    const result = projectProfileDetails("person", data)
    expect(result.terms[0]?.isActive).toBe(false)
    expect(result.record.personSummary?.term).toBeUndefined()
    expect(result.terms[0]?.endDate).toBe("2014-01-01")
  })

  it.each(["pending", "processing", "failed", "unsupported", "unavailable"])(
    "keeps %s material text distinct from a readable document",
    (processingStatus) => {
      const result = projectProfileDetails("material", {
        material: { id: "material:check", title: "Published report", processingStatus },
        sections: [{ id: "section", text: "Stale text" }]
      })
      expect(result.processingStatus).toBe(processingStatus)
      expect(result.sections).toEqual([])
    }
  )

  it("retains ordered processed text and its continuation cursor", () => {
    const result = projectProfileDetails("material", {
      material: { id: "material:check", title: "Published report", processingStatus: "processed" },
      sections: [{ id: "section", heading: "Purpose", text: "Published text" }],
      nextCursor: "next-page"
    })
    expect(result.sections).toEqual([{ id: "section", heading: "Purpose", text: "Published text" }])
    expect(result.nextCursor).toBe("next-page")
  })
})
