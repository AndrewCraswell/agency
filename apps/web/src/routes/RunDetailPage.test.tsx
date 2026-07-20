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
  it("shows a journal error without probing a legacy run source", async () => {
    const journalDetail = ApiMock.get(`/api/workflow-runs/${runId}`, {
      status: 404,
      data: { error: "Workflow run not found" }
    })
    const legacyDetail = ApiMock.get(`/api/control-plane/runs/${runId}`, {
      data: { error: "Legacy run detail must not be requested" }
    })
    window.history.pushState({}, "", `/runs/${runId}`)

    render(
      <AppShell>
        <RouterProvider router={router} />
      </AppShell>
    )

    expect(await screen.findByText("Workflow run not found", undefined, { timeout: 10_000 })).toBeInTheDocument()
    expect(journalDetail.hits).toBeGreaterThan(0)
    expect(legacyDetail.hits).toBe(0)
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
        schemaVersion: "2",
        summary: {
          outcome: "waiting",
          currentStep: { stepId: "wait", label: "Wait for review" },
          failure: {
            stepId: "agent",
            stepLabel: "Draft response",
            cause: "model_failed",
            downstreamEffect: "1 downstream step is blocked.",
            occurredAt: timestamp,
            recommendedAction: "Confirm whether the external change occurred before retrying."
          },
          actions: [
            {
              key: "retry_step",
              label: "Retry unavailable step",
              targetId: "denied-activation",
              allowed: false,
              disabledReason: "Confirm whether the external change occurred before retrying.",
              targetLabel: "Provider update",
              approvalRequirement: "none",
              requiredCapability: null,
              consequence: "Creates another attempt for the failed step and preserves prior attempts."
            },
            {
              key: "cancel",
              label: "Cancel run",
              targetId: null,
              allowed: true,
              disabledReason: null,
              targetLabel: `Run ${runId}`,
              approvalRequirement: "confirmation",
              requiredCapability: null,
              consequence: "Stops new work. External changes already sent to a provider are not undone."
            },
            {
              key: "run_again",
              label: "Run again",
              targetId: null,
              allowed: true,
              disabledReason: null,
              targetLabel: `Run ${runId}`,
              approvalRequirement: "confirmation",
              requiredCapability: null,
              consequence: "Creates a new run from the same published workflow version and preserves this run."
            },
            {
              key: "retry_step",
              label: "Retry step",
              targetId: failedActivationId,
              allowed: true,
              disabledReason: null,
              targetLabel: "Draft response",
              approvalRequirement: "none",
              requiredCapability: null,
              consequence: "Creates another attempt for the failed step and preserves prior attempts."
            },
            {
              key: "retry_from_here",
              label: "Retry from here",
              targetId: failedActivationId,
              allowed: true,
              disabledReason: null,
              targetLabel: "Draft response",
              approvalRequirement: "confirmation",
              requiredCapability: null,
              consequence: "Retries the failed step and descendants that have not committed output."
            },
            {
              key: "resume",
              label: "Resume",
              targetId: "9539b499-1c48-4770-ab32-da1cbda14d57",
              allowed: true,
              disabledReason: null,
              targetLabel: "review:42",
              approvalRequirement: "none",
              requiredCapability: null,
              consequence: "Supplies the event required by review:42."
            },
            {
              key: "resolve_effect",
              label: "Confirm external change",
              targetId: "858355f6-a892-4fa9-af05-66c5085cc901",
              allowed: true,
              disabledReason: null,
              targetLabel: "provider-change",
              approvalRequirement: "required",
              requiredCapability: null,
              consequence: "Records whether the provider change occurred before the workflow can continue or retry."
            }
          ]
        },
        run: journalRun,
        executionPackage: {
          packageDigest: "b".repeat(64),
          workflowId: "3195de29-2774-4272-be07-6ed600cefd51",
          sourceKind: "published",
          workflowVersion: 3,
          draftRevision: null,
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

    expect(await screen.findByRole("heading", { name: "Run failed at Draft response" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Run summary" })).toBeInTheDocument()
    expect(screen.getByText("Draft response failed")).toBeInTheDocument()
    expect(screen.getByText("model_failed")).toBeInTheDocument()
    expect(screen.getByText("1 downstream step is blocked.")).toBeInTheDocument()
    expect(screen.getAllByText("Confirm whether the external change occurred before retrying.")).toHaveLength(2)
    const deniedAction = screen.getByRole("button", { name: "Retry unavailable step" })
    expect(deniedAction).toHaveAttribute("aria-disabled", "true")
    deniedAction.focus()
    expect(deniedAction).toHaveFocus()
    expect(deniedAction).toHaveAccessibleDescription("Confirm whether the external change occurred before retrying.")
    await userEvent.click(screen.getByText("Diagnostics"))
    expect(screen.getByText("Wait for review")).toBeInTheDocument()
    expect(screen.getByText("review:42")).toBeInTheDocument()
    expect(screen.getByText("github comment")).toBeInTheDocument()
    expect(screen.getByText("report")).toBeInTheDocument()
    expect(screen.getByText("attempt.waiting")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Child runs" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm external change" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Confirm external change" }))
    const effectDialogTitle = await screen.findByRole(
      "heading",
      { name: "Confirm external change", hidden: true },
      { timeout: 5_000 }
    )
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
    const runAgainDialogTitle = await screen.findByRole(
      "heading",
      { name: "Run workflow again", hidden: true },
      { timeout: 10_000 }
    )
    const runAgainDialog = runAgainDialogTitle.closest<HTMLElement>('[role="dialog"]')
    expect(runAgainDialog).not.toBeNull()
    if (runAgainDialog === null) {
      throw new Error("Run-again dialog did not render")
    }
    expect(within(runAgainDialog).getByRole("textbox", { name: "Run input JSON", hidden: true })).toHaveValue(
      JSON.stringify(journalRun.sealedManifest.input, null, 2)
    )
    await userEvent.click(within(runAgainDialog).getByRole("button", { name: "Cancel", hidden: true }))
    await waitFor(
      () => expect(screen.queryByRole("heading", { name: "Run workflow again", hidden: true })).not.toBeInTheDocument(),
      { timeout: 10_000 }
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: "Resume" }))
    const resumeDialog = await screen.findByRole(
      "dialog",
      { name: "Resume workflow", hidden: true },
      { timeout: 10_000 }
    )
    await userEvent.click(within(resumeDialog).getByRole("button", { name: "Resume", hidden: true }))
    expect(resume.hits).toBe(1)
    expect(await screen.findByText("The event was validated and committed to the journal.")).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: "Cancel run" }))
    expect(cancel.hits).toBe(1)
    expect(
      await screen.findByText("New work is fenced; dispatched external effects were not undone.")
    ).toBeInTheDocument()
  })
})
