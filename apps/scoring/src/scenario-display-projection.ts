export type DisplayWeapon = "epee" | "foil" | "sabre"
export type DisplaySide = "left" | "right"
export type DisplayLamp = "off" | "off-target" | "valid-hit"
export type DisplayDiagnosticChannel = "off" | "on"
export type DisplayEventKind = "diagnostic" | "expected" | "input" | "output" | "rejection" | "uncertainty"

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

export type ScenarioDisplayDiagnostic = {
  readonly atUs: number
  readonly audible: "none" | "requested"
  readonly indication: "white-on" | "yellow-off" | "yellow-on"
  readonly latched: boolean
  readonly reason:
    | "circuit-bc-abnormal-change"
    | "control-break-qualified"
    | "own-equipment-clear"
    | "own-equipment-fault"
  readonly side: DisplaySide
  readonly sourceInputIds: readonly string[]
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
    readonly diagnostics?: readonly unknown[]
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
  readonly playbackAtUs: number
  readonly value?: unknown
}

export type ScenarioDisplayProjection = {
  readonly accessibleLabel: string
  readonly authoritativeResult: "available" | "unavailable"
  readonly audibleRequested: boolean
  readonly bladeContact: boolean
  readonly cursorAtUs: number
  readonly event: ScenarioDisplayEvent | null
  readonly eventCount: number
  readonly eventNumber: number
  readonly leftContact: boolean
  readonly leftFault: boolean
  readonly leftLamp: DisplayLamp
  readonly leftWhiteDiagnostic: DisplayDiagnosticChannel
  readonly leftYellowDiagnostic: DisplayDiagnosticChannel
  readonly latestDecision: ScenarioDisplayDecision | null
  readonly rightContact: boolean
  readonly rightFault: boolean
  readonly rightLamp: DisplayLamp
  readonly rightWhiteDiagnostic: DisplayDiagnosticChannel
  readonly rightYellowDiagnostic: DisplayDiagnosticChannel
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
  diagnostic: 3,
  uncertainty: 4,
  rejection: 5
}

export class ScenarioDisplayProjectionError extends Error {
  readonly code: "invalid-diagnostic"

  constructor(code: "invalid-diagnostic") {
    super(`Invalid scenario display projection: ${code}`)
    this.code = code
    this.name = "ScenarioDisplayProjectionError"
  }
}

export function isActualAcceptedScenarioDisplay(testCase: ScenarioDisplayCase): boolean {
  return testCase.result.actualStatus === "accepted"
}

type PendingDisplayEvent = Omit<ScenarioDisplayEvent, "playbackAtUs">

function addPlaybackCoordinates(events: readonly PendingDisplayEvent[]): ScenarioDisplayEvent[] {
  let playbackAtUs = 0
  return events.map((event) => {
    playbackAtUs = Math.max(playbackAtUs, event.atUs)
    return { ...event, playbackAtUs }
  })
}

export function createScenarioDisplayTimeline(testCase: ScenarioDisplayCase): readonly ScenarioDisplayEvent[] {
  const events: { event: PendingDisplayEvent; ordinal: number }[] = []
  const append = (event: PendingDisplayEvent) => events.push({ event, ordinal: events.length })

  if (!isActualAcceptedScenarioDisplay(testCase)) {
    const error = testCase.result.error
    const rejectedInputIndex = testCase.scenario.inputs.findIndex((input) => input.id === error?.atInputId)
    const appendRejection = (atUs: number) =>
      append({
        atUs,
        id: `rejection-${error?.atInputId ?? "scenario"}`,
        kind: "rejection",
        label: `Authoritative result unavailable: ${error?.code ?? "actual status is not accepted"}`,
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
    return addPlaybackCoordinates(events.map(({ event }) => event))
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

  const diagnostics = testCase.result.diagnostics ?? []
  const inputIds = new Set(testCase.scenario.inputs.map(({ id }) => id))
  if (diagnostics.length > 0 && testCase.scenario.weapon !== "sabre")
    throw new ScenarioDisplayProjectionError("invalid-diagnostic")

  let previousDiagnostic: ScenarioDisplayDiagnostic | undefined
  for (const [diagnosticIndex, diagnostic] of diagnostics.entries()) {
    if (
      !isScenarioDisplayDiagnostic(diagnostic) ||
      diagnostic.sourceInputIds.some((sourceInputId) => !inputIds.has(sourceInputId)) ||
      (previousDiagnostic !== undefined &&
        (previousDiagnostic.atUs > diagnostic.atUs ||
          (previousDiagnostic.atUs === diagnostic.atUs && previousDiagnostic.side.localeCompare(diagnostic.side) > 0)))
    )
      throw new ScenarioDisplayProjectionError("invalid-diagnostic")
    append({
      atUs: diagnostic.atUs,
      id: `diagnostic-${diagnostic.side}-${diagnostic.atUs}-${diagnosticIndex}`,
      kind: "diagnostic",
      label: diagnostic.indication,
      value: diagnostic
    })
    previousDiagnostic = diagnostic
  }

  for (const uncertainty of testCase.result.uncertainty)
    append({
      atUs: uncertainty.atUs,
      id: `uncertainty-${uncertainty.id ?? uncertainty.atUs}`,
      kind: "uncertainty",
      label: "Host-scorer reported uncertainty",
      value: uncertainty
    })

  return addPlaybackCoordinates(
    events
      .toSorted(
        (left, right) =>
          left.event.atUs - right.event.atUs ||
          EVENT_ORDER[left.event.kind] - EVENT_ORDER[right.event.kind] ||
          left.ordinal - right.ordinal
      )
      .map(({ event }) => event)
  )
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
  return visual === "off-target" || visual === "valid-hit" ? visual : "off"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isScenarioDisplayDecision(value: unknown): value is ScenarioDisplayDecision {
  return (
    isRecord(value) &&
    isNonnegativeSafeInteger(value.decisionAtUs) &&
    typeof value.disposition === "string" &&
    value.disposition.length > 0 &&
    (value.side === undefined || value.side === "left" || value.side === "right") &&
    isRecord(value.signal) &&
    isOneOf(value.signal.audible, ["none", "requested"]) &&
    typeof value.signal.latched === "boolean" &&
    isOneOf(value.signal.visual, ["diagnostic", "none", "off-target", "valid-hit"])
  )
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

export function isScenarioDisplayDiagnostic(value: unknown): value is ScenarioDisplayDiagnostic {
  return (
    isRecord(value) &&
    isNonnegativeSafeInteger(value.atUs) &&
    isOneOf(value.audible, ["none", "requested"]) &&
    isOneOf(value.indication, ["white-on", "yellow-off", "yellow-on"]) &&
    typeof value.latched === "boolean" &&
    isOneOf(value.reason, [
      "circuit-bc-abnormal-change",
      "control-break-qualified",
      "own-equipment-clear",
      "own-equipment-fault"
    ]) &&
    isOneOf(value.side, ["left", "right"]) &&
    Array.isArray(value.sourceInputIds) &&
    value.sourceInputIds.length >= 1 &&
    value.sourceInputIds.length <= 2 &&
    value.sourceInputIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128) &&
    new Set(value.sourceInputIds).size === value.sourceInputIds.length &&
    ((value.indication === "white-on" && value.latched && value.audible === "requested") ||
      (value.indication !== "white-on" && !value.latched && value.audible === "none")) &&
    ((value.indication === "yellow-on" && value.reason === "own-equipment-fault") ||
      (value.indication === "yellow-off" && value.reason === "own-equipment-clear") ||
      (value.indication === "white-on" &&
        (value.reason === "circuit-bc-abnormal-change" || value.reason === "control-break-qualified")))
  )
}

function buildAccessibleLabel(projection: Omit<ScenarioDisplayProjection, "accessibleLabel">): string {
  const buzzer = projection.audibleRequested ? "buzzer requested" : "buzzer idle"
  const declaredTime =
    projection.event !== null && projection.event.atUs !== projection.event.playbackAtUs
      ? `; declared event time ${projection.event.atUs} us`
      : ""
  return `${projection.weapon}; authoritative result ${projection.authoritativeResult}; left primary ${projection.leftLamp}; left yellow ${projection.leftYellowDiagnostic}; left white ${projection.leftWhiteDiagnostic}; right primary ${projection.rightLamp}; right yellow ${projection.rightYellowDiagnostic}; right white ${projection.rightWhiteDiagnostic}; ${buzzer}; event ${projection.eventNumber}/${projection.eventCount}; cursor ${projection.cursorAtUs} us${declaredTime}`
}

type SideDisplayState = {
  latchedPrimary: DisplayLamp
  whiteDiagnostic: DisplayDiagnosticChannel
  yellowDiagnostic: DisplayDiagnosticChannel
}

type ProjectedSignals = Readonly<{
  primary: Readonly<Record<DisplaySide, DisplayLamp>>
  white: Readonly<Record<DisplaySide, DisplayDiagnosticChannel>>
  yellow: Readonly<Record<DisplaySide, DisplayDiagnosticChannel>>
}>

function projectedSignals(events: readonly ScenarioDisplayEvent[]): ProjectedSignals {
  const state: Record<DisplaySide, SideDisplayState> = {
    left: { latchedPrimary: "off", whiteDiagnostic: "off", yellowDiagnostic: "off" },
    right: { latchedPrimary: "off", whiteDiagnostic: "off", yellowDiagnostic: "off" }
  }
  let transient: { lamp: DisplayLamp; side: DisplaySide } | null = null

  for (const event of events) {
    transient = null
    if (event.kind === "output" && isScenarioDisplayDecision(event.value) && event.value.side !== undefined) {
      const lamp = lampForDecision(event.value)
      if (event.value.signal?.latched === true) state[event.value.side].latchedPrimary = lamp
      else transient = { lamp, side: event.value.side }
    }
    if (event.kind === "diagnostic" && isScenarioDisplayDiagnostic(event.value)) {
      const diagnostic = event.value
      if (diagnostic.indication === "yellow-on") state[diagnostic.side].yellowDiagnostic = "on"
      if (diagnostic.indication === "yellow-off") state[diagnostic.side].yellowDiagnostic = "off"
      if (diagnostic.indication === "white-on") state[diagnostic.side].whiteDiagnostic = "on"
    }
  }

  const lampForSide = (side: DisplaySide): DisplayLamp => {
    if (transient?.side === side) return transient.lamp
    return state[side].latchedPrimary
  }
  return {
    primary: { left: lampForSide("left"), right: lampForSide("right") },
    white: { left: state.left.whiteDiagnostic, right: state.right.whiteDiagnostic },
    yellow: { left: state.left.yellowDiagnostic, right: state.right.yellowDiagnostic }
  }
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
  const authoritativeResult: ScenarioDisplayProjection["authoritativeResult"] = isActualAcceptedScenarioDisplay(
    testCase
  )
    ? "available"
    : "unavailable"
  const signals: ProjectedSignals =
    authoritativeResult === "available"
      ? projectedSignals(playedEvents)
      : {
          primary: { left: "off", right: "off" },
          white: { left: "off", right: "off" },
          yellow: { left: "off", right: "off" }
        }
  const currentEvent = timeline[eventIndex]
  const currentSignal =
    currentEvent?.kind === "output" && isScenarioDisplayDecision(currentEvent.value)
      ? currentEvent.value.signal
      : currentEvent?.kind === "diagnostic" && isScenarioDisplayDiagnostic(currentEvent.value)
        ? currentEvent.value
        : undefined
  const projection = {
    authoritativeResult,
    audibleRequested: authoritativeResult === "available" && currentSignal?.audible === "requested",
    ...lineProjection,
    cursorAtUs: timeline[eventIndex]?.playbackAtUs ?? 0,
    event: timeline[eventIndex] ?? null,
    eventCount: timeline.length,
    eventNumber: eventIndex + 1,
    leftLamp: signals.primary.left,
    leftWhiteDiagnostic: signals.white.left,
    leftYellowDiagnostic: signals.yellow.left,
    latestDecision: isScenarioDisplayDecision(latestActualDecisionEvent?.value)
      ? latestActualDecisionEvent.value
      : null,
    rightLamp: signals.primary.right,
    rightWhiteDiagnostic: signals.white.right,
    rightYellowDiagnostic: signals.yellow.right,
    weapon: testCase.scenario.weapon
  }

  return { ...projection, accessibleLabel: buildAccessibleLabel(projection) }
}
