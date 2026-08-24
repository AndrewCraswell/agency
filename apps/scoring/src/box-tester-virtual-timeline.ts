/**
 * BT-05 virtual tester evidence projection.
 *
 * This is intentionally a timeline/evaluation layer.  It consumes the immutable
 * BT-04 authoring plan and M2-12's already-produced result; it does not call a
 * scorer, derive expectations, or describe a physical observation.
 */

import {
  BOX_TESTER_SEQUENCE_FORMAT,
  type BoxTesterExpectationStep,
  type BoxTesterNoDecisionExpectationStep,
  type BoxTesterSequence,
  type BoxTesterStimulusStep
} from "./box-tester-sequence.js"

export const BOX_TESTER_VIRTUAL_TIMELINE_FORMAT = "scoring-box-tester-virtual-timeline"
export const BOX_TESTER_VIRTUAL_TIMELINE_VERSION = "1.0.0"

export type VirtualTesterOutcome = "failed" | "indeterminate" | "infrastructure-error" | "passed" | "skipped"
export type VirtualTesterTimelineLane = "actual-output" | "command" | "evaluation" | "expected" | "measurement"

export type VirtualTesterActualResult = Readonly<{
  actualStatus: "accepted" | "rejected"
  classifications?: readonly Readonly<{ atUs: number; kind: string }>[]
  decisions: readonly Readonly<{
    decisionAtUs: number
    disposition: string
    side?: "left" | "right"
  }>[]
  diagnostics?: readonly Readonly<{ atUs: number; indication: string; side: "left" | "right" }>[]
  error: Readonly<{ atInputId?: string; code: string }> | null
  mismatches: readonly unknown[]
  scenarioId: string
  status: "failed" | "passed"
  uncertainty: readonly Readonly<{ atUs: number; outcome: string; scope: string }>[]
}>

export type VirtualTesterTimelineEvent = Readonly<{
  atUs: number
  id: string
  lane: VirtualTesterTimelineLane
  label: string
  value: unknown
}>

export type VirtualTesterTimeline = Readonly<{
  format: typeof BOX_TESTER_VIRTUAL_TIMELINE_FORMAT
  outcome: VirtualTesterOutcome
  scenarioId: string
  timeline: readonly VirtualTesterTimelineEvent[]
  timelineVersion: typeof BOX_TESTER_VIRTUAL_TIMELINE_VERSION
}>

type PendingEvent = Omit<VirtualTesterTimelineEvent, "id"> & { readonly ordinal: number; readonly sourceId: string }

function fail(reason: string): never {
  throw new TypeError(`BT-05 virtual tester cannot create evidence: ${reason}`)
}

function assertTimestamp(value: unknown, path: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${path} must be a non-negative safe integer`)
}

function assertIdentifier(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string`)
}

function cloneData(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string")
    return value
  if (Array.isArray(value)) return value.map(cloneData)
  if (typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneData(child)]))
  fail("evidence values must be JSON data")
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

const laneOrder: Readonly<Record<VirtualTesterTimelineLane, number>> = {
  command: 0,
  measurement: 1,
  expected: 2,
  "actual-output": 3,
  evaluation: 4
}

function finalize(
  scenarioId: string,
  outcome: VirtualTesterOutcome,
  events: readonly PendingEvent[]
): VirtualTesterTimeline {
  const timeline = events
    .slice()
    .sort(
      (left, right) =>
        left.atUs - right.atUs || laneOrder[left.lane] - laneOrder[right.lane] || left.ordinal - right.ordinal
    )
    .map(({ ordinal: _ordinal, sourceId, ...event }, index) => ({ ...event, id: `${sourceId}-${index}` }))
  return deepFreeze({
    format: BOX_TESTER_VIRTUAL_TIMELINE_FORMAT,
    outcome,
    scenarioId,
    timeline,
    timelineVersion: BOX_TESTER_VIRTUAL_TIMELINE_VERSION
  })
}

function commandEvent(step: BoxTesterStimulusStep, ordinal: number): PendingEvent {
  assertTimestamp(step.atUs, "sequence.stimulus.atUs")
  return {
    atUs: step.atUs,
    label: `Commanded stimulus: ${step.inputId}`,
    lane: "command",
    ordinal,
    sourceId: `command-${step.inputId}`,
    value: cloneData(step)
  }
}

function measurementEvent(step: BoxTesterStimulusStep, ordinal: number): PendingEvent {
  return {
    atUs: step.atUs,
    label: `Virtual measured transition: ${step.inputId}`,
    lane: "measurement",
    ordinal,
    sourceId: `measurement-${step.inputId}`,
    value: {
      atUncertaintyUs: step.atUncertaintyUs,
      inputId: step.inputId,
      lines: cloneData(step.lines),
      observation: "virtual-command-mirror"
    }
  }
}

function expectedEvent(
  step: BoxTesterExpectationStep | BoxTesterNoDecisionExpectationStep,
  ordinal: number
): PendingEvent {
  const atUs = step.kind === "expect-no-decision" ? step.window.throughUs : step.atUs
  assertTimestamp(atUs, "sequence.expectations.atUs")
  return {
    atUs,
    label:
      step.kind === "expect-no-decision"
        ? `Authored no-decision: ${step.expectationId}`
        : `Authored expectation: ${step.expectationId}`,
    lane: "expected",
    ordinal,
    sourceId: `expected-${step.expectationId}`,
    value: cloneData(step.expectation)
  }
}

function resultIsExecutable(result: VirtualTesterActualResult, sequence: BoxTesterSequence): boolean {
  return result.scenarioId === sequence.scenarioId && result.actualStatus === "accepted"
}

/**
 * Creates virtual commands, virtual measurements, authored evidence, host result
 * output, and one evaluation on a shared integer-microsecond timeline.
 */
export function createVirtualTesterTimeline(
  sequence: BoxTesterSequence,
  result: VirtualTesterActualResult
): VirtualTesterTimeline {
  if (sequence.format !== BOX_TESTER_SEQUENCE_FORMAT) fail("sequence format is unsupported")
  assertIdentifier(sequence.scenarioId, "sequence.scenarioId")
  assertIdentifier(result.scenarioId, "result.scenarioId")
  const events: PendingEvent[] = []
  sequence.stimulus.forEach((step, index) => {
    events.push(commandEvent(step, events.length + index))
    events.push(measurementEvent(step, events.length + index))
  })
  sequence.expectations.forEach((step) => events.push(expectedEvent(step, events.length)))

  if (!resultIsExecutable(result, sequence)) {
    const reason =
      result.scenarioId !== sequence.scenarioId ? "scenario-identity-mismatch" : "authoritative-output-unavailable"
    const atUs = events.reduce((maximum, event) => Math.max(maximum, event.atUs), 0)
    events.push({
      atUs,
      label: `Indeterminate virtual evaluation: ${reason}`,
      lane: "evaluation",
      ordinal: events.length,
      sourceId: "evaluation-indeterminate",
      value: { reason }
    })
    return finalize(sequence.scenarioId, "indeterminate", events)
  }

  result.decisions.forEach((decision, index) => {
    assertTimestamp(decision.decisionAtUs, "result.decisions.decisionAtUs")
    events.push({
      atUs: decision.decisionAtUs,
      label: `Actual host output: ${decision.disposition}`,
      lane: "actual-output",
      ordinal: events.length,
      sourceId: `actual-decision-${index}`,
      value: cloneData(decision)
    })
  })
  result.uncertainty.forEach((uncertainty, index) => {
    assertTimestamp(uncertainty.atUs, "result.uncertainty.atUs")
    events.push({
      atUs: uncertainty.atUs,
      label: `Actual host uncertainty: ${uncertainty.scope}`,
      lane: "actual-output",
      ordinal: events.length,
      sourceId: `actual-uncertainty-${index}`,
      value: cloneData(uncertainty)
    })
  })
  result.classifications?.forEach((classification, index) => {
    assertTimestamp(classification.atUs, "result.classifications.atUs")
    events.push({
      atUs: classification.atUs,
      label: `Actual host classification: ${classification.kind}`,
      lane: "actual-output",
      ordinal: events.length,
      sourceId: `actual-classification-${index}`,
      value: cloneData(classification)
    })
  })
  result.diagnostics?.forEach((diagnostic, index) => {
    assertTimestamp(diagnostic.atUs, "result.diagnostics.atUs")
    events.push({
      atUs: diagnostic.atUs,
      label: `Actual host diagnostic: ${diagnostic.indication}`,
      lane: "actual-output",
      ordinal: events.length,
      sourceId: `actual-diagnostic-${index}`,
      value: cloneData(diagnostic)
    })
  })
  const atUs = events.reduce((maximum, event) => Math.max(maximum, event.atUs), 0)
  events.push({
    atUs,
    label: result.status === "passed" ? "Virtual evaluation passed" : "Virtual evaluation failed",
    lane: "evaluation",
    ordinal: events.length,
    sourceId: `evaluation-${result.status}`,
    value: { mismatches: cloneData(result.mismatches), status: result.status }
  })
  return finalize(sequence.scenarioId, result.status, events)
}

export function createSkippedVirtualTesterTimeline(scenarioId: string, reason: string): VirtualTesterTimeline {
  assertIdentifier(scenarioId, "scenarioId")
  assertIdentifier(reason, "reason")
  return finalize(scenarioId, "skipped", [
    {
      atUs: 0,
      label: `Virtual evaluation skipped: ${reason}`,
      lane: "evaluation",
      ordinal: 0,
      sourceId: "evaluation-skipped",
      value: { reason }
    }
  ])
}

export function createIndeterminateVirtualTesterTimeline(scenarioId: string, reason: string): VirtualTesterTimeline {
  assertIdentifier(scenarioId, "scenarioId")
  assertIdentifier(reason, "reason")
  return finalize(scenarioId, "indeterminate", [
    {
      atUs: 0,
      label: `Indeterminate virtual evaluation: ${reason}`,
      lane: "evaluation",
      ordinal: 0,
      sourceId: "evaluation-indeterminate",
      value: { reason }
    }
  ])
}

export function createInfrastructureErrorVirtualTesterTimeline(
  scenarioId: string,
  errorCode: string
): VirtualTesterTimeline {
  assertIdentifier(scenarioId, "scenarioId")
  assertIdentifier(errorCode, "errorCode")
  return finalize(scenarioId, "infrastructure-error", [
    {
      atUs: 0,
      label: `Virtual tester infrastructure error: ${errorCode}`,
      lane: "evaluation",
      ordinal: 0,
      sourceId: "evaluation-infrastructure-error",
      value: { errorCode }
    }
  ])
}
