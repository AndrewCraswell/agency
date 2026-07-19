import type { ControlPlaneSnapshot, LinearTask, WorkflowRun } from "./services/api"

export type TaskWithRun = { task: LinearTask; run: WorkflowRun | null }
export type BoardGroup = "todo" | "inProgress" | "blocked"

export const boardGroupLabels: Record<BoardGroup, string> = {
  todo: "Not started",
  inProgress: "In progress",
  blocked: "Blocked"
}

export function isAssignableTask(task: LinearTask): boolean {
  return (task.state.type === "backlog" || task.state.type === "unstarted") && task.blockedBy.length === 0
}

export function groupTasks(snapshot: ControlPlaneSnapshot): Record<BoardGroup, TaskWithRun[]> {
  const grouped: Record<BoardGroup, TaskWithRun[]> = {
    todo: [],
    inProgress: [],
    blocked: []
  }

  for (const task of snapshot.tasks) {
    const matchingRuns = snapshot.runs
      .filter((run) => run.sourceWorkItemId === task.id)
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const run = matchingRuns[0] ?? null
    if (run?.status === "published") {
      continue
    }
    if (run?.status === "blocked" || run?.status === "failed" || run?.status === "cancelled") {
      grouped.blocked.push({ task, run })
    } else if (run?.status === "queued" || run?.status === "running") {
      grouped.inProgress.push({ task, run })
    } else if (task.state.type === "started") {
      grouped.inProgress.push({ task, run })
    } else if (task.blockedBy.length > 0) {
      grouped.blocked.push({ task, run })
    } else {
      grouped.todo.push({ task, run })
    }
  }
  return grouped
}
