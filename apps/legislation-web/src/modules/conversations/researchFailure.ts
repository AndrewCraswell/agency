const failureMessages = {
  not_processed: "The record exists, but its text is not ready. Read its metadata or select another processed source.",
  result_limit: "The result is too large. Request fewer records or a smaller childLimit.",
  invalid_request: "The research request is invalid. Check the filters and identifiers before retrying.",
  invalid_cursor: "The page cursor is invalid. Start without a cursor, then use nextCursor from the returned result.",
  timeout: "The research query timed out. Narrow the question or request fewer records.",
  dependency_unavailable: "The data service is temporarily unavailable.",
  not_found: "The requested record was not found. Search for the record before reading it.",
  forbidden: "This record is not available for this research request.",
  invalid_response: "The data service returned an unreadable result.",
  step_limit: "This response reached its research limit. Narrow the question to continue.",
  interrupted: "Research was stopped before this operation finished.",
  internal: "This research operation failed."
}

export type ResearchFailureCode = keyof typeof failureMessages

export class ResearchFailure extends Error {
  constructor(
    readonly code: ResearchFailureCode,
    readonly reference: string
  ) {
    super(`${failureMessages[code]} Reference: ${reference}`)
    this.name = "ResearchFailure"
  }
}

function isFailureCode(value: unknown): value is ResearchFailureCode {
  return typeof value === "string" && Object.hasOwn(failureMessages, value)
}

export function researchFailureCode(value: unknown): ResearchFailureCode {
  if (isFailureCode(value)) {
    return value
  }
  if (value === "unauthorized") {
    return "forbidden"
  }
  if (value === "payload_too_large") {
    return "result_limit"
  }
  if (value === "conflict" || value === "precondition_failed") {
    return "not_processed"
  }
  if (value === "unprocessable") {
    return "invalid_request"
  }
  return "internal"
}
