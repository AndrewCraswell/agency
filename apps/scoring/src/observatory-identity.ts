export type ObservatoryIdentityInput = Readonly<{
  scenario?: Readonly<{
    ruleRevision?: unknown
    scenarioId?: unknown
    traceabilityId?: unknown
  }>
  status?: unknown
}>

export type ObservatoryIdentity = Readonly<{
  canRun: boolean
  id: string
  idLabel: "Requirement ID" | "Scenario ID"
  kind: "requirement" | "scenario"
  ruleRevision: string
}>

function normalizedNonemptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function projectObservatoryIdentity(testCase: ObservatoryIdentityInput): ObservatoryIdentity {
  const planned = testCase.status === "planned-requirement"
  const executableStatus = testCase.status === "failed" || testCase.status === "passed"
  const kind = planned ? "requirement" : "scenario"
  const id = normalizedNonemptyString(planned ? testCase.scenario?.traceabilityId : testCase.scenario?.scenarioId)
  const ruleRevision = normalizedNonemptyString(testCase.scenario?.ruleRevision)

  return {
    canRun: executableStatus && id !== null && ruleRevision !== null,
    id: id ?? "unavailable",
    idLabel: planned ? "Requirement ID" : "Scenario ID",
    kind,
    ruleRevision: ruleRevision ?? (planned ? "not declared" : "unknown revision")
  }
}
