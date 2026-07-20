import { describe, expect, it } from "vitest"
import {
  projectWorkflowOutline,
  type WorkflowOutlineConnection,
  type WorkflowOutlineNode
} from "./WorkflowEditorOutline.utils"

const nodes: WorkflowOutlineNode[] = [
  { id: "trigger", label: "Manual run", kind: "manual_trigger", category: "trigger" },
  { id: "branch", label: "Choose path", kind: "switch", category: "control" },
  { id: "approve", label: "Approve", kind: "provider_action", category: "action" },
  { id: "reject", label: "Reject", kind: "failure", category: "terminal" },
  { id: "join", label: "Join paths", kind: "join", category: "control" },
  { id: "done", label: "Done", kind: "success", category: "terminal" },
  { id: "orphan", label: "Unreachable step", kind: "set_fields", category: "data" }
]

const connections: WorkflowOutlineConnection[] = [
  { id: "start", sourceStepId: "trigger", targetStepId: "branch", outcome: "success" },
  { id: "approved", sourceStepId: "branch", targetStepId: "approve", branchKey: "approved" },
  { id: "rejected", sourceStepId: "branch", targetStepId: "reject", branchKey: "rejected" },
  { id: "approve-join", sourceStepId: "approve", targetStepId: "join" },
  { id: "join-done", sourceStepId: "join", targetStepId: "done" },
  { id: "retry", sourceStepId: "done", targetStepId: "branch", loopBack: true, outcome: "failure" }
]

describe("projectWorkflowOutline", () => {
  it("projects branches, joins, outcomes, loops, and unreachable steps without repeating cycles", () => {
    const outline = projectWorkflowOutline(nodes, connections)

    expect(outline.map(({ id }) => id)).toEqual(["trigger", "branch", "approve", "join", "done", "reject", "orphan"])
    expect(outline.find(({ id }) => id === "trigger")).toMatchObject({ role: "trigger", root: true, depth: 0 })
    expect(outline.find(({ id }) => id === "branch")).toMatchObject({ role: "branch", depth: 1 })
    expect(outline.find(({ id }) => id === "join")).toMatchObject({ role: "join" })
    expect(outline.find(({ id }) => id === "done")).toMatchObject({ role: "outcome" })
    expect(outline.find(({ id }) => id === "orphan")).toMatchObject({ root: true, unreachable: true })
    expect(outline.find(({ id }) => id === "branch")?.outgoing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ branchKey: "approved", targetStepId: "approve" }),
        expect.objectContaining({ branchKey: "rejected", targetStepId: "reject" })
      ])
    )
    expect(outline.find(({ id }) => id === "done")?.outgoing).toEqual([
      expect.objectContaining({ id: "retry", loopBack: true, outcome: "failure" })
    ])
    expect(new Set(outline.map(({ id }) => id)).size).toBe(nodes.length)
  })
})
