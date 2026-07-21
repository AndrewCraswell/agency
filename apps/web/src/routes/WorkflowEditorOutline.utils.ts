export type WorkflowOutlineNode = {
  id: string
  label: string
  kind: string
  category: string
  typeLabel: string
  version: number
}

export type WorkflowOutlineConnection = {
  id: string
  sourceStepId: string
  targetStepId: string
  branchKey?: string
  loopBack?: boolean
  outcome?: "success" | "failure"
}

export type WorkflowOutlineRole = "trigger" | "branch" | "join" | "outcome" | "step"

export type WorkflowOutlineItem = WorkflowOutlineNode & {
  depth: number
  role: WorkflowOutlineRole
  root: boolean
  unreachable: boolean
  incoming: WorkflowOutlineConnection[]
  outgoing: WorkflowOutlineConnection[]
}

function outlineRole(node: WorkflowOutlineNode): WorkflowOutlineRole {
  if (node.category === "trigger") {
    return "trigger"
  }
  if (node.kind === "condition" || node.kind === "switch") {
    return "branch"
  }
  if (node.kind === "join" || node.kind === "exclusive_merge") {
    return "join"
  }
  return "step"
}

function connectionOrder(left: WorkflowOutlineConnection, right: WorkflowOutlineConnection) {
  const leftKey = `${left.loopBack === true ? "1" : "0"}:${left.branchKey ?? ""}:${left.targetStepId}`
  const rightKey = `${right.loopBack === true ? "1" : "0"}:${right.branchKey ?? ""}:${right.targetStepId}`
  return leftKey.localeCompare(rightKey)
}

export function projectWorkflowOutline(
  nodes: WorkflowOutlineNode[],
  connections: WorkflowOutlineConnection[]
): WorkflowOutlineItem[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const validConnections = connections.filter(
    ({ sourceStepId, targetStepId }) => nodeById.has(sourceStepId) && nodeById.has(targetStepId)
  )
  const incomingByStep = new Map<string, WorkflowOutlineConnection[]>()
  const outgoingByStep = new Map<string, WorkflowOutlineConnection[]>()
  for (const connection of validConnections) {
    incomingByStep.set(connection.targetStepId, [...(incomingByStep.get(connection.targetStepId) ?? []), connection])
    outgoingByStep.set(connection.sourceStepId, [...(outgoingByStep.get(connection.sourceStepId) ?? []), connection])
  }

  const triggerRoots = nodes.filter(({ category }) => category === "trigger")
  const roots =
    triggerRoots.length > 0
      ? triggerRoots
      : nodes.filter((node) => {
          const incoming = incomingByStep.get(node.id) ?? []
          return incoming.every(({ loopBack }) => loopBack === true)
        })
  roots.sort((left, right) => {
    const categoryOrder = Number(right.category === "trigger") - Number(left.category === "trigger")
    return categoryOrder === 0 ? left.label.localeCompare(right.label) : categoryOrder
  })

  const visited = new Set<string>()
  const result: WorkflowOutlineItem[] = []

  function visit(node: WorkflowOutlineNode, depth: number, root: boolean, unreachable: boolean) {
    if (visited.has(node.id)) {
      return
    }
    visited.add(node.id)
    const incoming = [...(incomingByStep.get(node.id) ?? [])].sort(connectionOrder)
    const outgoing = [...(outgoingByStep.get(node.id) ?? [])].sort(connectionOrder)
    result.push({ ...node, depth, role: outlineRole(node), root, unreachable, incoming, outgoing })
    for (const connection of outgoing) {
      if (connection.loopBack === true) {
        continue
      }
      const target = nodeById.get(connection.targetStepId)
      if (target !== undefined) {
        visit(target, depth + 1, false, unreachable)
      }
    }
  }

  for (const root of roots) {
    visit(root, 0, true, false)
  }
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node, 0, true, true)
    }
  }
  return result
}
