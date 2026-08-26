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

/**
 * Route the complete board locally in stable source order. The installed core
 * requires explicit opt-in for this deterministic trace-by-trace router; the
 * fail-closed post-render gate still rejects every missing route or routing
 * error.
 */
export const prototypeBoardRouting = {
  allowLegacyAutorouters: true,
  autorouter: "sequential-trace",
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
  const sourceConnectionIds = new Set(
    sourceConnections.flatMap((element) => stringProperty(element, "source_trace_id") ?? [])
  )
  const routedSourceConnectionIds = new Set(
    pcbTraces.flatMap((element) => {
      const sourceTraceId = stringProperty(element, "source_trace_id")
      return sourceTraceId !== undefined && sourceConnectionIds.has(sourceTraceId) ? [sourceTraceId] : []
    })
  )
  const routedConnectionCount = Math.min(
    sourceConnections.length,
    routedSourceConnectionIds.size > 0 ? routedSourceConnectionIds.size : pcbTraces.length
  )
  const missingConnections = circuitJson.filter((element) => element.type === "pcb_trace_missing_error")
  const routingErrors = circuitJson.filter(isRoutingError)

  return {
    sourceConnectionCount: sourceConnections.length,
    pcbTraceCount: pcbTraces.length,
    routedConnectionCount,
    unroutedConnectionCount: Math.max(sourceConnections.length - routedConnectionCount, missingConnections.length),
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
