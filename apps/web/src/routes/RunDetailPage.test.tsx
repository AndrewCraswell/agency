import { RouterProvider } from "@tanstack/react-router"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { router } from "@/router"
import { ApiMock } from "@/tests/server"

const runId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"

beforeEach(() => {
  ApiMock.get("/api/workflows/schedules", { data: [] })
})

describe("RunDetailPage", { timeout: 30_000 }, () => {
  it("shows stage, durable events, and a LangSmith trace link", async () => {
    ApiMock.get(`/api/workflow-runs/${runId}`, { status: 404, data: { error: "Workflow run not found" } })
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

  it("projects journal activations and persisted evidence after restart", async () => {
    const activationId = "a".repeat(64)
    const failedActivationId = "f".repeat(64)
    const timestamp = "2026-07-19T05:21:00.000Z"
    const journalRun = {
      runId,
      packageDigest: "b".repeat(64),
      requestDigest: "c".repeat(64),
      triggerIdentity: "manual:request-1",
      sealedManifest: { input: { issue: "FEN-42" } },
      status: "waiting" as const,
      cancellationGeneration: 0,
      latestSequence: 2,
      schedulerCursor: null,
      pendingCheckpointCursor: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      terminalAt: null
    }
    ApiMock.get(`/api/workflow-runs/${runId}`, {
      data: {
        schemaVersion: "1",
        run: journalRun,
        executionPackage: {
          packageDigest: "b".repeat(64),
          workflowId: "3195de29-2774-4272-be07-6ed600cefd51",
          workflowVersion: 3,
          contractVersion: "1",
          compilerVersion: "1",
          compiledPlanDigest: "d".repeat(64),
          content: {},
          createdAt: timestamp
        },
        graph: {
          schemaVersion: "2",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          steps: [
            {
              id: "wait",
              label: "Wait for review",
              position: { x: 0, y: 0 },
              definition: { kind: "wait", version: 1 },
              config: { correlation: "review:42", expiresAfterSeconds: 600, eventSchema: { type: "object" } },
              failurePolicy: { mode: "stop", maximumAttempts: 1 }
            },
            {
              id: "agent",
              label: "Draft response",
              position: { x: 320, y: 0 },
              definition: { kind: "agent", version: 1 },
              config: {},
              failurePolicy: { mode: "stop", maximumAttempts: 2 }
            }
          ],
          connections: [],
          fixtures: [],
          topologicalOrder: ["wait", "agent"]
        },
        activations: [
          {
            activationId,
            runId,
            stepId: "wait",
            scope: [],
            status: "waiting",
            inputBindings: {},
            selectedAttemptOrdinal: null,
            nextAttemptOrdinal: 2,
            dependencyCount: 0,
            availableAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          },
          {
            activationId: failedActivationId,
            runId,
            stepId: "agent",
            scope: [],
            status: "failed",
            inputBindings: {},
            selectedAttemptOrdinal: null,
            nextAttemptOrdinal: 2,
            dependencyCount: 0,
            availableAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        attempts: [
          {
            runId,
            activationId,
            ordinal: 1,
            status: "waiting",
            fencingToken: 1,
            leaseOwner: null,
            leaseExpiresAt: null,
            input: { context: { issue: "FEN-42" } },
            output: null,
            error: null,
            usage: { promptTokens: 120 },
            evidence: { traceId: "trace-1" },
            createdAt: timestamp,
            startedAt: timestamp,
            finishedAt: null
          },
          {
            runId,
            activationId: failedActivationId,
            ordinal: 1,
            status: "failed",
            fencingToken: 1,
            leaseOwner: null,
            leaseExpiresAt: null,
            input: {},
            output: null,
            error: { code: "model_failed" },
            usage: null,
            evidence: {},
            createdAt: timestamp,
            startedAt: timestamp,
            finishedAt: timestamp
          }
        ],
        effects: [
          {
            effectId: "858355f6-a892-4fa9-af05-66c5085cc901",
            runId,
            activationId,
            effectSlot: "comment",
            attemptOrdinal: 1,
            provider: "github",
            requestDigest: "e".repeat(64),
            idempotencyKey: "comment-1",
            status: "unknown",
            request: { body: "Ready" },
            result: null,
            reconciliation: { code: "provider_outcome_unknown" },
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        waits: [
          {
            waitId: "9539b499-1c48-4770-ab32-da1cbda14d57",
            runId,
            activationId,
            attemptOrdinal: 1,
            correlationKey: "review:42",
            acceptedInputSchema: { type: "object" },
            authorization: null,
            status: "pending",
            consuming: 1,
            expiresAt: "2099-07-19T05:31:00.000Z",
            winningEventSequence: null,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        data: [
          {
            datumId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
            runId,
            activationId,
            attemptOrdinal: 1,
            name: "report",
            kind: "artifact",
            payload: { path: "artifact.md" },
            digest: "f".repeat(64),
            createdAt: timestamp
          }
        ],
        events: [
          {
            runId,
            sequence: 1,
            transactionId: "4f6ad86f-814b-4d91-ac62-75f3c9bf65d2",
            eventType: "run.prepared",
            eventVersion: 1,
            reducerVersion: "1",
            causationSequence: null,
            correlationId: null,
            activationId: null,
            attemptOrdinal: null,
            payload: { activationCount: 1 },
            recordedAt: timestamp
          },
          {
            runId,
            sequence: 2,
            transactionId: "3f6ad86f-814b-4d91-ac62-75f3c9bf65d2",
            eventType: "attempt.waiting",
            eventVersion: 1,
            reducerVersion: "1",
            causationSequence: 1,
            correlationId: "review:42",
            activationId,
            attemptOrdinal: 1,
            payload: { waitId: "9539b499-1c48-4770-ab32-da1cbda14d57" },
            recordedAt: timestamp
          }
        ],
        childLinks: [
          {
            parentRunId: runId,
            parentActivationId: activationId,
            childRunId: "65382f80-2e36-424a-bb41-f7f54fa0f7cf",
            childPackageDigest: "1".repeat(64),
            interfaceDigest: "2".repeat(64),
            terminalStatus: null,
            result: null,
            error: null,
            completedAt: null,
            createdAt: timestamp
          }
        ]
      }
    })
    const retry = ApiMock.post(`/api/workflow-runs/${runId}/activations/${failedActivationId}/retry`, {
      data: {
        schemaVersion: "1",
        activation: {
          activationId: failedActivationId,
          runId,
          stepId: "agent",
          scope: [],
          status: "ready",
          inputBindings: {},
          selectedAttemptOrdinal: null,
          nextAttemptOrdinal: 2,
          dependencyCount: 0,
          availableAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      }
    })
    const retryFromHere = ApiMock.post(
      `/api/workflow-runs/${runId}/activations/${failedActivationId}/retry-from-here`,
      {
        data: {
          schemaVersion: "1",
          activation: {
            activationId: failedActivationId,
            runId,
            stepId: "agent",
            scope: [],
            status: "ready",
            inputBindings: {},
            selectedAttemptOrdinal: null,
            nextAttemptOrdinal: 2,
            dependencyCount: 0,
            availableAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp
          },
          affectedDescendantIds: []
        }
      }
    )
    const resolveEffect = ApiMock.post(
      `/api/workflow-runs/${runId}/effects/858355f6-a892-4fa9-af05-66c5085cc901/resolve`,
      {
        data: {
          schemaVersion: "1",
          effect: {
            effectId: "858355f6-a892-4fa9-af05-66c5085cc901",
            runId,
            activationId,
            effectSlot: "comment",
            attemptOrdinal: 1,
            provider: "github",
            requestDigest: "e".repeat(64),
            idempotencyKey: "comment-1",
            status: "resolved",
            request: { body: "Ready" },
            result: null,
            reconciliation: {
              latest: { source: "operator", outcome: "absent", reason: "No comment exists", recordedAt: timestamp }
            },
            createdAt: timestamp,
            updatedAt: timestamp
          }
        }
      }
    )
    const resume = ApiMock.post(`/api/workflow-runs/${runId}/resume`, {
      data: {
        schemaVersion: "1",
        resumed: {
          waitId: "9539b499-1c48-4770-ab32-da1cbda14d57",
          runId,
          activationId,
          attemptOrdinal: 1,
          correlationKey: "review:42",
          acceptedInputSchema: { type: "object" },
          authorization: null,
          status: "resumed",
          consuming: 1,
          expiresAt: "2099-07-19T05:31:00.000Z",
          winningEventSequence: 3,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      }
    })
    const cancel = ApiMock.post(`/api/workflow-runs/${runId}/cancel`, {
      data: {
        schemaVersion: "1",
        run: { ...journalRun, status: "cancelled", cancellationGeneration: 1, latestSequence: 3, terminalAt: timestamp }
      }
    })
    window.history.pushState({}, "", `/runs/${runId}`)

    render(
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    )

    expect(await screen.findByRole("heading", { name: "Workflow run" })).toBeInTheDocument()
    expect(screen.getByText("Wait for review")).toBeInTheDocument()
    expect(screen.getByText("review:42")).toBeInTheDocument()
    expect(screen.getByText("github comment")).toBeInTheDocument()
    expect(screen.getByText("report")).toBeInTheDocument()
    expect(screen.getByText("attempt.waiting")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Child runs" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Needs confirmation" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Needs confirmation" }))
    const effectDialogTitle = await screen.findByText("Confirm external change", {}, { timeout: 5_000 })
    const effectDialog = effectDialogTitle.closest<HTMLElement>('[role="dialog"]')
    expect(effectDialog).not.toBeNull()
    if (effectDialog === null) {
      throw new Error("Effect dialog did not render")
    }
    await userEvent.click(within(effectDialog).getByLabelText("Change did not occur"))
    await userEvent.type(within(effectDialog).getByLabelText(/Reason/u), "No comment exists")
    await userEvent.click(within(effectDialog).getByText("Record decision", { selector: "button" }))
    expect(resolveEffect.hits).toBe(1)
    expect(
      await screen.findByText("The reason and provider evidence are preserved in the run journal.")
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: "Retry step" }))
    expect(retry.hits).toBe(1)
    expect(await screen.findByText("Prior attempts remain available in the run evidence.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Retry from here" }))
    expect(retryFromHere.hits).toBe(1)
    expect(
      await screen.findByText("0 blocked descendant activation(s) remain attached to this retry.")
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Run again" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Run again" }))
    const runAgainDialog = screen.getByRole("dialog", { name: "Run workflow again" })
    expect(within(runAgainDialog).getByRole("textbox", { name: "Run input JSON" })).toHaveValue(
      JSON.stringify(journalRun.sealedManifest.input, null, 2)
    )
    await userEvent.click(within(runAgainDialog).getByRole("button", { name: "Cancel" }))
    await userEvent.click(screen.getByRole("button", { name: "Resume" }))
    const resumeDialog = await screen.findByRole("dialog", { name: "Resume workflow" }, { timeout: 5_000 })
    await userEvent.click(within(resumeDialog).getByRole("button", { name: "Resume" }))
    expect(resume.hits).toBe(1)
    expect(await screen.findByText("The event was validated and committed to the journal.")).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: "Cancel run" }))
    expect(cancel.hits).toBe(1)
    expect(
      await screen.findByText("New work is fenced; dispatched external effects were not undone.")
    ).toBeInTheDocument()
  })
})
