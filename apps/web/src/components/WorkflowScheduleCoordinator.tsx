import { useEffect } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import { listPublishedWorkflowSchedules, startWorkflowRun } from "@/services/api"

export function WorkflowScheduleCoordinator() {
  const dispatchToast = useAppToast()

  useEffect(() => {
    let active = true
    const timers: number[] = []
    void listPublishedWorkflowSchedules()
      .then((schedules) => {
        if (!active) {
          return
        }
        for (const schedule of schedules) {
          const intervalMs = schedule.intervalSeconds * 1000
          const timer = window.setInterval(() => {
            const bucket = Math.floor(Date.now() / intervalMs)
            void startWorkflowRun(schedule.workflowId, {
              type: "schedule",
              key: `${schedule.version}:${schedule.nodeId}:${bucket}`
            }).catch((error: unknown) => {
              const body = error instanceof Error ? error.message : "The scheduled run could not be created."
              showAppToast(dispatchToast, {
                intent: "error",
                id: `schedule-${schedule.workflowId}-${schedule.nodeId}`,
                title: schedule.label,
                body
              })
            })
          }, intervalMs)
          timers.push(timer)
        }
      })
      .catch(() => {
        // Schedule loading is best-effort; workflow pages surface actionable API failures.
      })
    return () => {
      active = false
      for (const timer of timers) {
        window.clearInterval(timer)
      }
    }
  }, [dispatchToast])

  return null
}
