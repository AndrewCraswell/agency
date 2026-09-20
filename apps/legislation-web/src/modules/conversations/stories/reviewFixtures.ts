import type { UIMessage } from "ai"
import invariant from "tiny-invariant"
import { entityKindSchema, projectEntityResult } from "../entityResults"
import { ResearchFailure, researchFailureCode, type ResearchFailureCode } from "../researchFailure"
import { researchToolLabels } from "../researchTools"
import captured from "./captured.json"
import { reviewDatasetSchema, reviewMaterialIds, reviewMeetingIds, type ReviewCapture } from "./reviewData"

export const reviewData = reviewDatasetSchema.parse(captured)
for (const capture of reviewData.captures) {
  const page = capture.output.resultSet
  if (!page) {
    continue
  }
  const projected = projectEntityResult(capture.toolName, capture.output.data)
  invariant(projected, `Cannot project captured ${capture.toolName} data.`)
  page.items = page.items.map((record) => {
    const current = projected.items.find((item) => item.id === record.id)
    invariant(current, `Captured record ${record.id} is missing from the source data.`)
    return current
  })
}
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
  precondition_failed: true,
  result_limit: true,
  invalid_request: true,
  invalid_cursor: true,
  timeout: true,
  dependency_unavailable: true,
  not_found: true,
  forbidden: true,
  invalid_response: true,
  interrupted: true,
  internal: true
}
export const failureCodes = Object.keys(failures).map(researchFailureCode)
export const uncapturedOptionalResearchTools = ["search_web", "read_web_page"] as const
const optionalResearchTools = new Set<string>(uncapturedOptionalResearchTools)
export const toolCaptures = Object.keys(researchToolLabels).flatMap((toolName) => {
  const capture = reviewData.captures.find((capture) => capture.toolName === toolName)
  if (!capture) {
    invariant(optionalResearchTools.has(toolName), `Refresh the real data capture for ${toolName}.`)
    return []
  }
  return [capture]
})

export function activityPart(
  capture: ReviewCapture,
  state: ActivityState,
  code: ResearchFailureCode = "dependency_unavailable"
): { part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>; isRunning: boolean } {
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
  const detailTools = {
    bill: "get_bill",
    person: "get_person",
    organization: "get_organization",
    meeting: "get_event",
    document: "get_bill_text",
    amendment: "get_amendment",
    vote: "get_vote",
    material: "get_supporting_material"
  }
  const candidates = [...reviewData.captures].sort(
    (left, right) => Number(right.toolName === detailTools[kind]) - Number(left.toolName === detailTools[kind])
  )
  return candidates.flatMap(
    (capture) =>
      capture.output.resultSet?.items.flatMap((record) => {
        if (record.kind !== kind || seen.has(record.id)) {
          return []
        }
        if (kind === "material" && !reviewMaterialIds.includes(record.id)) {
          return []
        }
        if (kind === "meeting" && !reviewMeetingIds.includes(record.id)) {
          return []
        }
        seen.add(record.id)
        return [{ record, resultId: capture.output.resultSet!.id, toolName: capture.toolName }]
      }) ?? []
  )
})
