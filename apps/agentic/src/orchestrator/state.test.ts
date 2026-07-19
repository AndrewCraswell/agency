import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { AssignmentSchema } from "../contracts/assignment"
import { createInitialGraphState, roundTripGraphState } from "./state"

const fixtureUrl = new URL("../../tests/fixtures/phase-1-repair-assignment.json", import.meta.url)

describe("Phase 2 graph state", () => {
  it("round-trips initialized state through JSON", async () => {
    const assignment = AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
    const state = createInitialGraphState(assignment)

    expect(roundTripGraphState(state)).toEqual(state)
    expect(state.runId).toBe(assignment.runId)
    expect(state.assignmentDigest).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("rejects accidental assignment reuse under another run ID", async () => {
    const assignment = AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
    const state = createInitialGraphState(assignment)
    const invalidState = { ...state, runId: "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1" }

    expect(() => roundTripGraphState(invalidState)).toThrow("Graph run ID must match the assignment run ID")
  })
})
