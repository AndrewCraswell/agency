type CircuitElement = Readonly<{ readonly type: string; readonly [property: string]: unknown }>

const placementErrorTypes = new Set([
  "pcb_courtyard_overlap_error",
  "pcb_footprint_overlap_error",
  "pcb_pad_pad_clearance_error",
  "pcb_placement_error"
])

export function isRoutingError(element: CircuitElement): boolean {
  return element.type.startsWith("pcb_") && element.type.endsWith("_error") && !placementErrorTypes.has(element.type)
}

function stringProperty(element: CircuitElement, property: string): string | undefined {
  const value = Reflect.get(element, property)
  return typeof value === "string" ? value : undefined
}

function stringArrayProperty(element: CircuitElement, property: string): readonly string[] {
  const value = Reflect.get(element, property)
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : []
}

function countByType(elements: readonly CircuitElement[]): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(Object.groupBy(elements, (element) => element.type)).map(([type, matchingElements]) => [
      type,
      matchingElements?.length ?? 0
    ])
  )
}

/** Routing configuration used for the generated prototype KiCad board. */
export const prototypeBoardRouting = {
  allowLegacyAutorouters: true,
  autorouter: "freerouting",
  routingDrcChecksDisabled: false
} as const

export type BoardRoutingReport = {
  readonly sourceConnectionCount: number
  readonly pcbTraceCount: number
  readonly routedConnectionCount: number
  readonly unroutedConnectionCount: number
  readonly missingConnectionCount: number
  readonly routingErrorCount: number
  readonly routingErrorCounts: Readonly<Record<string, number>>
}

function countDisconnectedPcbNets(elements: readonly CircuitElement[]): number {
  const sourcePortKeys = new Map(
    elements
      .filter((element) => element.type === "source_port")
      .flatMap((element) => {
        const sourcePortId = stringProperty(element, "source_port_id")
        const connectivityKey = stringProperty(element, "subcircuit_connectivity_map_key")
        return sourcePortId !== undefined && connectivityKey !== undefined
          ? [[sourcePortId, connectivityKey] as const]
          : []
      })
  )
  const pcbPortsByNet = Object.groupBy(
    elements
      .filter((element) => element.type === "pcb_port")
      .flatMap((element) => {
        const pcbPortId = stringProperty(element, "pcb_port_id")
        const sourcePortId = stringProperty(element, "source_port_id")
        const connectivityKey = sourcePortId === undefined ? undefined : sourcePortKeys.get(sourcePortId)
        return pcbPortId !== undefined && connectivityKey !== undefined ? [{ connectivityKey, pcbPortId }] : []
      }),
    (port) => port.connectivityKey
  )
  const connectedPorts = new Map<string, Set<string>>()
  const connect = (left: string, right: string) => {
    const merged = new Set([left, right, ...(connectedPorts.get(left) ?? []), ...(connectedPorts.get(right) ?? [])])
    for (const portId of merged) connectedPorts.set(portId, merged)
  }
  for (const trace of elements.filter((element) => element.type === "pcb_trace")) {
    const ports = stringArrayProperty(trace, "connectsTo")
    for (const port of ports.slice(1)) connect(ports[0]!, port)
  }
  return Object.values(pcbPortsByNet).filter((ports) => {
    if (ports === undefined || ports.length < 2) return false
    const firstConnectedSet = connectedPorts.get(ports[0]!.pcbPortId)
    return firstConnectedSet === undefined || ports.some((port) => !firstConnectedSet.has(port.pcbPortId))
  }).length
}

export function isSameFootprintClearanceError(
  element: CircuitElement,
  pcbPadComponentById: ReadonlyMap<string, string>
): boolean {
  if (element.type !== "pcb_pad_pad_clearance_error") return false
  const componentIds = stringArrayProperty(element, "pcb_pad_ids").map((padId) => pcbPadComponentById.get(padId))
  return (
    componentIds.length > 0 &&
    componentIds.every((componentId) => componentId !== undefined && componentId === componentIds[0])
  )
}

export function summarizeBoardRouting(circuitJson: readonly CircuitElement[]): BoardRoutingReport {
  const sourceConnections = circuitJson.filter((element) => element.type === "source_trace")
  const pcbTraces = circuitJson.filter((element) => element.type === "pcb_trace")
  const missingConnections = circuitJson.filter((element) => element.type === "pcb_trace_missing_error")
  const routingErrors = circuitJson.filter(isRoutingError)
  const unroutedConnectionCount =
    pcbTraces.length === 0
      ? sourceConnections.length
      : Math.max(missingConnections.length, countDisconnectedPcbNets(circuitJson))

  return {
    sourceConnectionCount: sourceConnections.length,
    pcbTraceCount: pcbTraces.length,
    routedConnectionCount: Math.max(0, sourceConnections.length - unroutedConnectionCount),
    unroutedConnectionCount,
    missingConnectionCount: missingConnections.length,
    routingErrorCount: routingErrors.length,
    routingErrorCounts: countByType(routingErrors)
  }
}

export function assertBoardRoutingIsComplete(report: BoardRoutingReport): void {
  if (report.sourceConnectionCount === 0) throw new Error("PCB routing validation found no declared source connections")
  if (report.unroutedConnectionCount === 0 && report.routingErrorCount === 0) return

  const errorCounts = Object.entries(report.routingErrorCounts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ")
  throw new Error(
    `PCB routing is incomplete: ${report.routedConnectionCount}/${report.sourceConnectionCount} connections routed; ` +
      `${report.unroutedConnectionCount} unresolved; ${report.routingErrorCount} routing/DRC errors` +
      (errorCounts === "" ? "" : ` (${errorCounts})`)
  )
}
