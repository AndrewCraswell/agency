import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypePlanDecision,
  benchPrototypePlanTaskIds,
  rootFinalReviewerRole,
  validateBenchPrototypePlanDecision
} from "./bench-prototype-plan-decision.js"

const canonicalPlan = readFileSync(new URL("../docs/bench-prototype-plan.md", import.meta.url), "utf8")
const taskIdsFromCanonicalPlan = [...canonicalPlan.matchAll(/^\|\s*`(BP-\d+)`\s*\|/gmu)].map((match) => match[1])

describe("BP-000 bench prototype plan decision", () => {
  it("binds the decision to every canonical plan task and reserves final review for root", () => {
    expect(taskIdsFromCanonicalPlan).toEqual([...benchPrototypePlanTaskIds])
    expect(validateBenchPrototypePlanDecision(benchPrototypePlanDecision)).toBe(true)
    expect(benchPrototypePlanDecision.approval).toEqual({
      preparedBy: "implementation-agent",
      finalReviewer: rootFinalReviewerRole,
      reviewedAtUtc: "2026-08-24T00:00:00.000Z",
      state: "approved"
    })
    expect(benchPrototypePlanDecision.lanes).toHaveLength(6)
    expect(benchPrototypePlanDecision.assignments).toHaveLength(taskIdsFromCanonicalPlan.length)
    expect(new Set(benchPrototypePlanDecision.assignments.map((assignment) => assignment.taskId)).size).toBe(
      taskIdsFromCanonicalPlan.length
    )
    expect(
      benchPrototypePlanDecision.assignments.every((assignment) => assignment.reviewer === rootFinalReviewerRole)
    ).toBe(true)
    expect(benchPrototypePlanDecision.assignments.every((assignment) => assignment.owner !== assignment.reviewer)).toBe(
      true
    )
  })

  it("fails closed for missing, blank, duplicate, extra, and self-review assignments", () => {
    const missingOwner = structuredClone(benchPrototypePlanDecision)
    Reflect.deleteProperty(missingOwner.assignments[0]!, "owner")
    expect(() => validateBenchPrototypePlanDecision(missingOwner)).toThrow(RangeError)

    const blankReviewer = structuredClone(benchPrototypePlanDecision)
    Reflect.set(blankReviewer.assignments[1]!, "reviewer", "  ")
    expect(() => validateBenchPrototypePlanDecision(blankReviewer)).toThrow(RangeError)

    const selfReview = structuredClone(benchPrototypePlanDecision)
    Reflect.set(selfReview.assignments[2]!, "owner", rootFinalReviewerRole)
    expect(() => validateBenchPrototypePlanDecision(selfReview)).toThrow(RangeError)

    const omitted = structuredClone(benchPrototypePlanDecision)
    omitted.assignments.pop()
    expect(() => validateBenchPrototypePlanDecision(omitted)).toThrow(RangeError)

    const duplicated = structuredClone(benchPrototypePlanDecision)
    Reflect.set(duplicated.assignments[3]!, "taskId", duplicated.assignments[0]!.taskId)
    expect(() => validateBenchPrototypePlanDecision(duplicated)).toThrow(RangeError)

    const extra = structuredClone(benchPrototypePlanDecision)
    Reflect.set(extra.assignments[4]!, "taskId", "BP-999")
    expect(() => validateBenchPrototypePlanDecision(extra)).toThrow(RangeError)
  })

  it("fails closed for lane-owner drift, unknown lanes, and reviewer reassignment", () => {
    const ownerDrift = structuredClone(benchPrototypePlanDecision)
    Reflect.set(ownerDrift.lanes[0]!, "owner", "invented-human")
    expect(() => validateBenchPrototypePlanDecision(ownerDrift)).toThrow(RangeError)

    const unknownLane = structuredClone(benchPrototypePlanDecision)
    Reflect.set(unknownLane.assignments[0]!, "lane", "Z")
    expect(() => validateBenchPrototypePlanDecision(unknownLane)).toThrow(RangeError)

    const reviewerDrift = structuredClone(benchPrototypePlanDecision)
    Reflect.set(reviewerDrift.assignments[0]!, "reviewer", "independent-reviewer")
    expect(() => validateBenchPrototypePlanDecision(reviewerDrift)).toThrow(RangeError)
  })

  it("keeps the canonical decision and nested assignments immutable", () => {
    expect(Object.isFrozen(benchPrototypePlanDecision)).toBe(true)
    expect(Object.isFrozen(benchPrototypePlanDecision.lanes)).toBe(true)
    expect(Object.isFrozen(benchPrototypePlanDecision.assignments)).toBe(true)
    expect(Object.isFrozen(benchPrototypePlanDecision.assignments[0])).toBe(true)
  })
})
