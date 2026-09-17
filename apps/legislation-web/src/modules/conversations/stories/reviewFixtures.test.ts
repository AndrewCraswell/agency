import { safeValidateUIMessages } from "ai"
import { describe, expect, it } from "vitest"
import { entityKindSchema, projectEntityResult } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import { activityPart, activityStates, capturedCards, failureCodes, reviewData, toolCaptures } from "./reviewFixtures"

describe("captured Storybook review", () => {
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
    expect(toolCaptures.map((capture) => capture.toolName)).toEqual(Object.keys(researchToolLabels))
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
    expect(failureCodes).toHaveLength(11)
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
