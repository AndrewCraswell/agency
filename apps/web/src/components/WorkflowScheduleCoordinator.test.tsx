import { act, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AppToastDispatcher } from "@/hooks/useAppToast"
import type { PublishedWorkflowSchedule } from "@/services/api"
import { WorkflowScheduleCoordinator } from "./WorkflowScheduleCoordinator"

const api = vi.hoisted(() => ({
  listPublishedWorkflowSchedules: vi.fn<() => Promise<PublishedWorkflowSchedule[]>>(),
  startWorkflowRun:
    vi.fn<
      (
        workflowId: string,
        trigger: { type: "manual" | "schedule" | "webhook"; key: string }
      ) => Promise<{ runId: string; created: boolean; version: number }>
    >()
}))
const toast = vi.hoisted(() => ({
  dispatch: vi.fn<AppToastDispatcher>(),
  show: vi.fn<(dispatch: AppToastDispatcher, options: unknown) => void>()
}))

vi.mock("@/services/api", () => api)
vi.mock("@/hooks/useAppToast", () => ({
  showAppToast: toast.show,
  useAppToast: () => toast.dispatch
}))

const workflowId = "3195de29-2774-4272-be07-6ed600cefd51"

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("WorkflowScheduleCoordinator", () => {
  it("dispatches deterministic schedule buckets and clears timers on unmount", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"))
    api.listPublishedWorkflowSchedules.mockResolvedValue([
      { workflowId, version: 2, nodeId: "schedule-1", label: "Every ten seconds", intervalSeconds: 10 }
    ])
    api.startWorkflowRun.mockResolvedValue({ runId: "65382f80-2e36-424a-bb41-f7f54fa0f7cf", created: true, version: 2 })
    const clearInterval = vi.spyOn(window, "clearInterval")
    const view = render(<WorkflowScheduleCoordinator />)

    await act(async () => Promise.resolve())
    await act(async () => vi.advanceTimersByTimeAsync(10_000))

    expect(api.startWorkflowRun).toHaveBeenCalledWith(workflowId, {
      type: "schedule",
      key: expect.stringMatching(/^2:schedule-1:\d+$/u)
    })
    view.unmount()
    expect(clearInterval).toHaveBeenCalledOnce()
  })

  it("reports scheduled run failures without stopping the timer", async () => {
    vi.useFakeTimers()
    api.listPublishedWorkflowSchedules.mockResolvedValue([
      { workflowId, version: 1, nodeId: "schedule-2", label: "Delivery timer", intervalSeconds: 10 }
    ])
    api.startWorkflowRun.mockRejectedValue(new Error("API unavailable"))
    render(<WorkflowScheduleCoordinator />)

    await act(async () => Promise.resolve())
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    await act(async () => Promise.resolve())

    expect(toast.show).toHaveBeenCalledWith(toast.dispatch, {
      intent: "error",
      id: `schedule-${workflowId}-schedule-2`,
      title: "Delivery timer",
      body: "API unavailable"
    })
  })

  it("treats schedule loading as best effort", async () => {
    api.listPublishedWorkflowSchedules.mockRejectedValue(new Error("Offline"))

    render(<WorkflowScheduleCoordinator />)

    await waitFor(() => expect(api.listPublishedWorkflowSchedules).toHaveBeenCalledOnce())
    expect(api.startWorkflowRun).not.toHaveBeenCalled()
  })
})
