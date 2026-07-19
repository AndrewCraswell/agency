import { RouterProvider } from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { router } from "@/router"
import { ApiMock } from "@/tests/server"

const runId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"

describe("RunDetailPage", () => {
  it("shows stage, durable events, and a LangSmith trace link", async () => {
    ApiMock.get(`/api/control-plane/runs/${runId}`, {
      data: {
        schemaVersion: "1",
        run: {
          runId,
          status: "running",
          stage: "coding",
          activeRole: "coder",
          repository: "AndrewCraswell/agency",
          sourceWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
          sourceWorkItemIdentifier: "FEN-42",
          assignedAgentId: "engineer",
          pullRequestNumber: null,
          createdAt: "2026-07-19T05:20:00.000Z",
          updatedAt: "2026-07-19T05:21:00.000Z"
        },
        workflow: {
          graphVersion: "delivery-v1",
          name: "Autonomous delivery",
          nodes: [
            {
              id: "planning",
              label: "Plan",
              description: "Select and shape one bounded work item.",
              agentId: "scrum-master",
              agentName: "Scrum master",
              stages: ["intake", "planning"]
            },
            {
              id: "implementation",
              label: "Implement",
              description: "Build and independently validate the assigned change.",
              agentId: "engineer",
              agentName: "Engineer",
              stages: ["coding", "publishing"]
            },
            {
              id: "review",
              label: "Review",
              description: "Review the exact candidate commit in a fresh workspace.",
              agentId: "reviewer",
              agentName: "Reviewer",
              stages: ["reviewing"]
            },
            {
              id: "repair",
              label: "Repair",
              description: "Address accepted findings in the retained engineer workspace.",
              agentId: "engineer",
              agentName: "Engineer",
              stages: ["repairing"]
            },
            {
              id: "decision",
              label: "Finish",
              description: "Merge an approved candidate or block an unresolved delivery.",
              agentId: null,
              agentName: null,
              stages: ["completed"]
            }
          ],
          edges: [
            { source: "planning", target: "implementation", label: "Assignment ready", kind: "forward" },
            { source: "implementation", target: "review", label: "Draft pull request", kind: "forward" },
            { source: "review", target: "decision", label: "Approved or final", kind: "forward" },
            { source: "review", target: "repair", label: "Changes requested", kind: "loop" },
            { source: "repair", target: "review", label: "Re-review", kind: "loop" }
          ]
        },
        events: [
          {
            eventId: 1,
            node: "workflow.runCoder",
            outcome: "started",
            summary: "Started workflow.runCoder trace",
            details: {
              trace: {
                traceId: "858355f6-a892-4fa9-af05-66c5085cc901",
                runId: "9539b499-1c48-4770-ab32-da1cbda14d57",
                projectName: "Agency",
                name: "workflow.runCoder"
              }
            },
            createdAt: "2026-07-19T05:21:00.000Z"
          }
        ]
      }
    })
    window.history.pushState({}, "", `/runs/${runId}`)

    render(
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    )

    expect(await screen.findByRole("heading", { name: "coder" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Agent workflow" })).toBeInTheDocument()
    expect(screen.getByText("Scrum master")).toBeInTheDocument()
    expect(screen.getByText("Reviewer")).toBeInTheDocument()
    expect(screen.getAllByText("Engineer")).toHaveLength(2)
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.getByText("Changes requested")).toBeInTheDocument()
    expect(screen.getByText("Re-review")).toBeInTheDocument()
    expect(screen.getByText("Started workflow.runCoder trace")).toBeInTheDocument()
    const traceLink = screen.getByRole("link", { name: "Open trace" })
    expect(traceLink).toHaveAttribute("href", expect.stringContaining("bdc8ae06-8403-46e5-be23-16ef49736b2f"))
  })
})
