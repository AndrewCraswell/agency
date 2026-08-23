export type DisplayWeapon = "epee" | "foil" | "sabre"
export type DisplaySide = "left" | "right"
export type DisplayLamp = "diagnostic" | "off" | "off-target" | "valid-hit"
export type DisplayEventKind = "expected" | "input" | "output" | "rejection" | "uncertainty"

export type ScenarioDisplayLine = {
  readonly line: string
  readonly state: string
}

export type ScenarioDisplayDecision = {
  readonly decisionAtUs: number
  readonly disposition: string
  readonly side?: DisplaySide
  readonly signal?: {
    readonly audible?: string
    readonly latched?: boolean
    readonly visual?: string
  }
}

type ExpectedDecision = ScenarioDisplayDecision & { readonly id: string }

type ExpectedNonEvent = {
  readonly assertion: string
  readonly assertionReasonCode: string
  readonly id: string
  readonly window: { readonly throughUs: number }
}

type DisplayUncertainty = {
  readonly atUs: number
  readonly id?: string
}

export type ScenarioDisplayCase = {
  readonly expected: {
    readonly decisions: readonly ExpectedDecision[]
    readonly error?: { readonly atInputId?: string; readonly code?: string } | null
    readonly nonEvents: readonly ExpectedNonEvent[]
    readonly status?: string
    readonly uncertainty: readonly DisplayUncertainty[]
  }
  readonly result: {
    readonly actualStatus?: string
    readonly decisions: readonly unknown[]
    readonly error?: { readonly atInputId?: string; readonly code?: string } | null
    readonly uncertainty: readonly DisplayUncertainty[]
  }
  readonly scenario: {
    readonly inputs: readonly {
      readonly atUs: number
      readonly id: string
      readonly lines: readonly ScenarioDisplayLine[]
    }[]
    readonly weapon: DisplayWeapon
  }
}

export type ScenarioDisplayEvent = {
  readonly atUs: number
  readonly id: string
  readonly kind: DisplayEventKind
  readonly label: string
  readonly lines?: readonly ScenarioDisplayLine[]
  readonly value?: unknown
}

export type ScenarioDisplayProjection = {
  readonly accessibleLabel: string
  readonly audibleRequested: boolean
  readonly bladeContact: boolean
  readonly cursorAtUs: number
  readonly event: ScenarioDisplayEvent | null
  readonly eventCount: number
  readonly eventNumber: number
  readonly leftContact: boolean
  readonly leftFault: boolean
  readonly leftLamp: DisplayLamp
  readonly latestDecision: ScenarioDisplayDecision | null
  readonly rightContact: boolean
  readonly rightFault: boolean
  readonly rightLamp: DisplayLamp
  readonly weapon: DisplayWeapon
}

export type ScenarioLineProjection = Pick<
  ScenarioDisplayProjection,
  "bladeContact" | "leftContact" | "leftFault" | "rightContact" | "rightFault"
>

const EVENT_ORDER: Readonly<Record<DisplayEventKind, number>> = {
  input: 0,
  expected: 1,
  output: 2,
  uncertainty: 3,
  rejection: 4
}

export function isActualAcceptedScenarioDisplay(testCase: ScenarioDisplayCase): boolean {
  return testCase.result.actualStatus === "accepted"
}

export function createScenarioDisplayTimeline(testCase: ScenarioDisplayCase): readonly ScenarioDisplayEvent[] {
  const events: { event: ScenarioDisplayEvent; ordinal: number }[] = []
  const append = (event: ScenarioDisplayEvent) => events.push({ event, ordinal: events.length })

  if (!isActualAcceptedScenarioDisplay(testCase)) {
    const error = testCase.result.error
    const rejectedInputIndex = testCase.scenario.inputs.findIndex((input) => input.id === error?.atInputId)
    const appendRejection = (atUs: number) =>
      append({
        atUs,
        id: `rejection-${error?.atInputId ?? "scenario"}`,
        kind: "rejection",
        label: `Host-scorer unavailable: ${error?.code ?? "actual status is not accepted"}`,
        value: error
      })

    if (rejectedInputIndex < 0) appendRejection(0)
    for (const [inputIndex, input] of testCase.scenario.inputs.entries()) {
      const previousInput = testCase.scenario.inputs[inputIndex - 1]
      const movesBackward = previousInput !== undefined && input.atUs < previousInput.atUs
      const unprocessed = rejectedInputIndex < 0 || inputIndex > rejectedInputIndex
      const label = movesBackward
        ? `Input-order violation at declared input ${inputIndex + 1}: ${input.id} moves backward from ${previousInput.atUs} us to ${input.atUs} us`
        : unprocessed
          ? `Declared, not processed input ${inputIndex + 1}: ${input.id}`
          : `Declared input ${inputIndex + 1}: ${input.id}`
      append({ atUs: input.atUs, id: input.id, kind: "input", label, lines: input.lines })
      if (inputIndex === rejectedInputIndex) appendRejection(input.atUs)
    }
    return events.map(({ event }) => event)
  }

  for (const [inputIndex, input] of testCase.scenario.inputs.entries())
    append({
      atUs: input.atUs,
      id: input.id,
      kind: "input",
      label: `Declared input ${inputIndex + 1}: ${input.id}`,
      lines: input.lines
    })

  for (const decision of testCase.expected.decisions)
    append({
      atUs: decision.decisionAtUs,
      id: decision.id,
      kind: "expected",
      label: decision.disposition,
      value: decision
    })

  for (const nonEvent of testCase.expected.nonEvents)
    append({
      atUs: nonEvent.window.throughUs,
      id: nonEvent.id,
      kind: "expected",
      label: `${nonEvent.assertion} (${nonEvent.assertionReasonCode})`,
      value: nonEvent
    })

  for (const uncertainty of testCase.expected.uncertainty)
    append({
      atUs: uncertainty.atUs,
      id: `expected-${uncertainty.id ?? uncertainty.atUs}`,
      kind: "expected",
      label: "uncertainty",
      value: uncertainty
    })

  for (const [decisionIndex, decision] of testCase.result.decisions.entries()) {
    if (!isScenarioDisplayDecision(decision)) continue
    append({
      atUs: decision.decisionAtUs,
      id: `actual-${decision.side ?? "none"}-${decision.decisionAtUs}-${decisionIndex}`,
      kind: "output",
      label: decision.disposition,
      value: decision
    })
  }

  for (const uncertainty of testCase.result.uncertainty)
    append({
      atUs: uncertainty.atUs,
      id: `uncertainty-${uncertainty.id ?? uncertainty.atUs}`,
      kind: "uncertainty",
      label: "Host-scorer reported uncertainty",
      value: uncertainty
    })

  return events
    .toSorted(
      (left, right) =>
        left.event.atUs - right.event.atUs ||
        EVENT_ORDER[left.event.kind] - EVENT_ORDER[right.event.kind] ||
        left.ordinal - right.ordinal
    )
    .map(({ event }) => event)
}

function lineLeaf(line: ScenarioDisplayLine): string {
  return line.line.slice(line.line.lastIndexOf(".") + 1)
}

function isContactLine(line: ScenarioDisplayLine, side: DisplaySide): boolean {
  return (
    line.line.startsWith(`${side}.`) &&
    ["blade", "target", "tip-loop", "weapon-circuit"].includes(lineLeaf(line)) &&
    line.state === "closed"
  )
}

function isBladeContactLine(line: ScenarioDisplayLine): boolean {
  return ["blade", "parry"].includes(lineLeaf(line)) && line.state === "closed"
}

function isFaultLine(line: ScenarioDisplayLine, side: DisplaySide): boolean {
  return (
    line.line.startsWith(`${side}.`) && ["disconnected", "grounded", "indeterminate", "shorted"].includes(line.state)
  )
}

export function projectScenarioLines(lines: readonly ScenarioDisplayLine[]): ScenarioLineProjection {
  return {
    bladeContact: lines.some(isBladeContactLine),
    leftContact: lines.some((line) => isContactLine(line, "left")),
    leftFault: lines.some((line) => isFaultLine(line, "left")),
    rightContact: lines.some((line) => isContactLine(line, "right")),
    rightFault: lines.some((line) => isFaultLine(line, "right"))
  }
}

function lampForDecision(decision: ScenarioDisplayDecision | undefined): DisplayLamp {
  const visual = decision?.signal?.visual
  return visual === "diagnostic" || visual === "off-target" || visual === "valid-hit" ? visual : "off"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isScenarioDisplayDecision(value: unknown): value is ScenarioDisplayDecision {
  if (!isRecord(value)) return false
  if (typeof value.decisionAtUs !== "number" || typeof value.disposition !== "string") return false
  if (value.side !== undefined && value.side !== "left" && value.side !== "right") return false
  return value.signal === undefined || isRecord(value.signal)
}

function latestDecision(
  events: readonly ScenarioDisplayEvent[],
  side: DisplaySide
): ScenarioDisplayDecision | undefined {
  const event = events.findLast(
    (candidate) =>
      candidate.kind === "output" && isScenarioDisplayDecision(candidate.value) && candidate.value.side === side
  )
  return isScenarioDisplayDecision(event?.value) ? event.value : undefined
}

function buildAccessibleLabel(projection: Omit<ScenarioDisplayProjection, "accessibleLabel">): string {
  const buzzer = projection.audibleRequested ? "buzzer requested" : "buzzer idle"
  return `${projection.weapon}; left ${projection.leftLamp}; right ${projection.rightLamp}; ${buzzer}; event ${projection.eventNumber}/${projection.eventCount}; cursor ${projection.cursorAtUs} us`
}

export function projectScenarioDisplay(
  testCase: ScenarioDisplayCase,
  requestedEventIndex: number
): ScenarioDisplayProjection {
  const timeline = createScenarioDisplayTimeline(testCase)
  const normalizedEventIndex = Number.isSafeInteger(requestedEventIndex) ? requestedEventIndex : -1
  const eventIndex = Math.max(-1, Math.min(normalizedEventIndex, timeline.length - 1))
  const playedEvents = timeline.slice(0, eventIndex + 1)
  const latestInput = playedEvents.findLast((event) => event.kind === "input")
  const lines = latestInput?.lines ?? []
  const actualDecisions = playedEvents.filter((event) => event.kind === "output")
  const lineProjection = projectScenarioLines(lines)
  const latestActualDecisionEvent = actualDecisions.findLast((event) => isScenarioDisplayDecision(event.value))
  const projection = {
    audibleRequested: actualDecisions.some(
      (event) => isScenarioDisplayDecision(event.value) && event.value.signal?.audible === "requested"
    ),
    ...lineProjection,
    cursorAtUs: timeline[eventIndex]?.atUs ?? 0,
    event: timeline[eventIndex] ?? null,
    eventCount: timeline.length,
    eventNumber: eventIndex + 1,
    leftLamp: lampForDecision(latestDecision(actualDecisions, "left")),
    latestDecision: isScenarioDisplayDecision(latestActualDecisionEvent?.value)
      ? latestActualDecisionEvent.value
      : null,
    rightLamp: lampForDecision(latestDecision(actualDecisions, "right")),
    weapon: testCase.scenario.weapon
  }

  return { ...projection, accessibleLabel: buildAccessibleLabel(projection) }
}
