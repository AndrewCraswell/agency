import { safeValidateUIMessages } from "ai"
import { describe, expect, it } from "vitest"
import { entityKindSchema, projectEntityResult } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import { reviewMaterialIds, reviewMeetingIds } from "./reviewData"
import {
  activityPart,
  activityStates,
  capturedCards,
  failureCodes,
  reviewData,
  toolCaptures,
  uncapturedOptionalResearchTools
} from "./reviewFixtures"

describe("captured Storybook review", () => {
  it("keeps the reviewed material cohort stable and retains repaired publication metadata", () => {
    const materials = capturedCards.filter(({ record }) => record.kind === "material")
    expect(materials.map(({ record }) => record.id).sort()).toEqual([...reviewMaterialIds].sort())
    for (const { record } of materials.filter(({ record }) => !record.documentSummary?.hearingDates?.length)) {
      expect(record.documentSummary?.versionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    for (const { record } of materials) {
      expect(record.fields.find((field) => field.label === "Pages")?.value).toMatch(/^(?:[1-9]\d*|Not paginated)$/)
    }
  })

  it("retains every exact date of the reviewed hearing publication without inventing a meeting", () => {
    const hearing = capturedCards.find(
      ({ record }) => record.id === "material:congress:a82498723ffa1f0caacd9370"
    )?.record
    expect(hearing?.kind).toBe("material")
    expect(hearing?.documentSummary?.hearingDates).toEqual([
      "2012-10-09",
      "2012-10-25",
      "2013-04-11",
      "2013-05-30",
      "2013-07-08",
      "2013-07-09",
      "2013-07-10",
      "2013-07-11",
      "2013-07-30",
      "2013-08-05"
    ])
    expect(hearing?.documentSummary?.versionDate).toBeUndefined()
    expect(hearing?.meetingSummary).toBeUndefined()
    expect(hearing?.sourceUrl).toBe("https://congress.gov/114/chrg/CHRG-114hhrg22153/generated/CHRG-114hhrg22153.htm")
  })

  it("retains repaired bill dates and year-precise person tenure", () => {
    const bill = capturedCards.find(({ record }) => record.id === "bill:ca:20232024:ab:2652")?.record
    expect(bill?.fields.find((field) => field.label === "Introduced")?.value).toBe("2024-02-14")
    const person = capturedCards.find(({ record }) => record.id === "person:congress:a000055")?.record
    expect(person?.fields.find((field) => field.label === "In office since")?.value).toBe("1997")
    expect(person?.personSummary?.term?.startYear).toBe(2025)
    expect(person?.personSummary?.term?.startDate).toBeUndefined()
  })

  it("reviews actual meetings with missing and source-recorded agendas", () => {
    const meetings = capturedCards.filter(({ record }) => record.kind === "meeting")
    expect(meetings.map(({ record }) => record.id).sort()).toEqual([...reviewMeetingIds].sort())
    expect(meetings.every(({ record }) => !record.id.includes("published-hearing"))).toBe(true)
    const congress = meetings.find(({ record }) => record.id === reviewMeetingIds[0])?.record
    const alaska = meetings.find(({ record }) => record.id === reviewMeetingIds[1])?.record
    expect(congress?.fields.find((field) => field.label === "Agenda items")).toBeUndefined()
    expect(alaska?.fields.find((field) => field.label === "Agenda items")?.value).toBe("21")
  })

  it("projects current card fields from retained source data", () => {
    for (const capture of reviewData.captures) {
      if (!capture.output.resultSet) {
        continue
      }
      const projected = projectEntityResult(capture.toolName, capture.output.data)
      for (const record of capture.output.resultSet.items) {
        expect(record).toEqual(projected?.items.find((item) => item.id === record.id))
      }
    }
    expect(capturedCards.find(({ record }) => record.id === "bill:ca:20232024:ab:2652")?.record.identifier).toBe(
      "AB 2652"
    )
  })

  it("covers every tool and card kind using successful real captures", () => {
    expect(reviewData.failures).toEqual([])
    expect([...toolCaptures.map((capture) => capture.toolName), ...uncapturedOptionalResearchTools].sort()).toEqual(
      Object.keys(researchToolLabels).sort()
    )
    expect(new Set(capturedCards.map(({ record }) => record.kind))).toEqual(new Set(entityKindSchema.options))
    expect(
      capturedCards.every(({ resultId, record }) =>
        reviewData.captures.some(
          (capture) =>
            capture.output.resultSet?.id === resultId &&
            capture.output.resultSet.items.some((item) => item.id === record.id)
        )
      )
    ).toBe(true)
  })

  it("uses all supported lifecycle permutations without changing record facts", async () => {
    expect(activityStates).toHaveLength(8)
    const capture = toolCaptures[0]!
    const original = JSON.stringify(capture)
    for (const state of activityStates) {
      const { part } = activityPart(capture, state)
      const result = await safeValidateUIMessages({ messages: [{ id: state, role: "assistant", parts: [part] }] })
      expect(result.success).toBe(true)
    }
    expect(activityPart(capture, "Complete").part).toMatchObject({ output: capture.output, input: capture.input })
    expect(JSON.stringify(capture)).toBe(original)
    expect(failureCodes).toHaveLength(12)
  })

  it("retains inspector data for all primary interactive card kinds", () => {
    for (const kind of ["vote", "meeting", "person", "organization", "material"] as const) {
      const selected = capturedCards.find(({ record }) => record.kind === kind)!
      expect(reviewData.details[`${selected.resultId}/${selected.record.id}`]?.record.id).toBe(selected.record.id)
    }
  })

  it.each([
    { code: "internal", message: "This research operation failed." },
    { code: "dependency_unavailable", message: "The data service is temporarily unavailable." }
  ] as const)("shows $code without suggesting an unavailable retry action", ({ code, message }) => {
    const { part } = activityPart(toolCaptures[0]!, "Failed", code)
    expect(part).toMatchObject({
      state: "output-error",
      errorText: `${message} Reference: storybook-simulated-failure`
    })
  })

  it("retains real inspector data for every captured interactive variant", () => {
    for (const { record } of capturedCards.filter(({ record }) =>
      ["vote", "meeting", "person", "organization", "material"].includes(record.kind)
    )) {
      expect(Object.values(reviewData.details).some((details) => details.record.id === record.id)).toBe(true)
    }
  })
})
