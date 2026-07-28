export const BACKLOG_DROPPABLE_ID = "backlog"
export const DAY_DROPPABLE_PREFIX = "day:"

export type PlanDrop =
  | { kind: "schedule"; date: string; backlogOrder: string[] }
  | { kind: "reorder"; backlogOrder: string[] }
  | { kind: "none" }

// Moving the idea into the backlog mid-drag is what opens a gap where it will land.
export function planBacklogInsertion(activeId: string, overId: string, backlogIds: string[]) {
  const isOverBacklog = overId === BACKLOG_DROPPABLE_ID || backlogIds.includes(overId)
  if (!isOverBacklog || backlogIds.includes(activeId)) {
    return null
  }

  const insertIndex = overId === BACKLOG_DROPPABLE_ID ? backlogIds.length : backlogIds.indexOf(overId)
  return [...backlogIds.slice(0, insertIndex), activeId, ...backlogIds.slice(insertIndex)]
}

export function planDrop(activeId: string, overId: string, backlogIds: string[]): PlanDrop {
  if (overId.startsWith(DAY_DROPPABLE_PREFIX)) {
    return {
      kind: "schedule",
      date: overId.slice(DAY_DROPPABLE_PREFIX.length),
      backlogOrder: backlogIds.filter((ideaId) => ideaId !== activeId)
    }
  }

  const fromIndex = backlogIds.indexOf(activeId)
  const toIndex = overId === BACKLOG_DROPPABLE_ID ? backlogIds.length - 1 : backlogIds.indexOf(overId)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return { kind: "none" }
  }

  const reordered = backlogIds.filter((ideaId) => ideaId !== activeId)
  reordered.splice(toIndex, 0, activeId)
  return { kind: "reorder", backlogOrder: reordered }
}
