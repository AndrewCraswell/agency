import type { UIMessage } from "ai"
import invariant from "tiny-invariant"
import { entityKindSchema } from "../entityResults"
import { ResearchFailure, researchFailureCode, type ResearchFailureCode } from "../researchFailure"
import { researchToolLabels } from "../researchTools"
import captured from "./captured.json"
import { reviewDatasetSchema, type ReviewCapture } from "./reviewData"

export const reviewData = reviewDatasetSchema.parse(captured)
export const activityStates = [
  "Awaiting input",
  "Receiving input",
  "Running",
  "Interrupted input",
  "Interrupted request",
  "Complete",
  "Failed",
  "Denied"
] as const
export type ActivityState = (typeof activityStates)[number]
const failures: Record<ResearchFailureCode, true> = {
  result_limit: true,
  invalid_request: true,
  invalid_cursor: true,
  timeout: true,
  dependency_unavailable: true,
  not_found: true,
  forbidden: true,
  invalid_response: true,
  step_limit: true,
  interrupted: true,
  internal: true
}
export const failureCodes = Object.keys(failures).map(researchFailureCode)
export const toolCaptures = Object.keys(researchToolLabels).map((toolName) => {
  const capture = reviewData.captures.find((capture) => capture.toolName === toolName)
  invariant(capture, `Refresh the real data capture for ${toolName}.`)
  return capture
})

export function activityPart(
  capture: ReviewCapture,
  state: ActivityState,
  code: ResearchFailureCode = "dependency_unavailable"
) {
  const base = {
    type: "dynamic-tool",
    toolName: capture.toolName,
    toolCallId: `${capture.toolName}-${state}`,
    input: capture.input
  } as const
  let part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>
  if (state === "Awaiting input") {
    part = { ...base, state: "input-streaming", input: undefined }
  } else if (state === "Receiving input" || state === "Interrupted input") {
    part = { ...base, state: "input-streaming" }
  } else if (state === "Running" || state === "Interrupted request") {
    part = { ...base, state: "input-available" }
  } else if (state === "Failed") {
    part = {
      ...base,
      state: "output-error",
      errorText: new ResearchFailure(code, "storybook-simulated-failure").message
    }
  } else if (state === "Denied") {
    part = { ...base, state: "output-denied", approval: { id: "storybook-denial", approved: false } }
  } else {
    part = { ...base, state: "output-available", output: capture.output }
  }
  return { part, isRunning: state === "Awaiting input" || state === "Receiving input" || state === "Running" }
}

export const capturedCards = entityKindSchema.options.flatMap((kind) => {
  const seen = new Set<string>()
  const candidates = [...reviewData.captures].sort(
    (left, right) => Number(right.toolName.startsWith("get_")) - Number(left.toolName.startsWith("get_"))
  )
  return candidates.flatMap(
    (capture) =>
      capture.output.resultSet?.items.flatMap((record) => {
        if (record.kind !== kind || seen.has(record.id)) {
          return []
        }
        seen.add(record.id)
        return [{ record, resultId: capture.output.resultSet!.id, toolName: capture.toolName }]
      }) ?? []
  )
})
