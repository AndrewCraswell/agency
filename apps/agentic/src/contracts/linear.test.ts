import { describe, expect, it } from "vitest"
import { LinearCandidateListSchema, LinearWorkItemSchema } from "./linear"

const team = { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
const issue = {
  schemaVersion: "1",
  source: "linear",
  id: "b0c6449e-380d-4e37-bcc4-4c86dff6bb5d",
  identifier: "FEN-101",
  title: "Add focused profile helper tests",
  description: "Add focused unit coverage for the OpenHands profile helpers.",
  url: "https://linear.app/fencing-club/issue/FEN-101/add-focused-profile-helper-tests",
  priority: 4,
  createdAt: "2026-07-18T04:15:00.000Z",
  updatedAt: "2026-07-19T04:15:00.000Z",
  state: { id: "7a766a80-3d80-4bd8-8143-b19f4fc8d4c7", name: "Todo", type: "unstarted" },
  team
}

describe("LinearWorkItemSchema", () => {
  it("accepts a complete unstarted Linear work item", () => {
    expect(LinearWorkItemSchema.parse(issue)).toEqual(issue)
  })

  it.each([
    ["unsupported version", { schemaVersion: "2" }],
    ["completed state", { state: { ...issue.state, type: "completed" } }]
  ])("rejects %s", (_scenario, replacement) => {
    expect(LinearWorkItemSchema.safeParse({ ...issue, ...replacement }).success).toBe(false)
  })

  it("accepts a task without a description", () => {
    expect(LinearWorkItemSchema.parse({ ...issue, description: "" }).description).toBe("")
  })
})

describe("LinearCandidateListSchema", () => {
  const candidateList = {
    schemaVersion: "1",
    fetchedAt: "2026-07-19T04:15:00.000Z",
    team,
    issues: [issue]
  }

  it("accepts a candidate list for one team", () => {
    expect(LinearCandidateListSchema.parse(candidateList)).toEqual(candidateList)
  })

  it("rejects duplicate issue IDs and cross-team candidates", () => {
    expect(LinearCandidateListSchema.safeParse({ ...candidateList, issues: [issue, issue] }).success).toBe(false)
    const otherTeamIssue = {
      ...issue,
      team: { ...team, id: "9539b499-1c48-4770-ab32-da1cbda14d57" }
    }
    expect(LinearCandidateListSchema.safeParse({ ...candidateList, issues: [otherTeamIssue] }).success).toBe(false)
  })
})
