const failureMessages = {
  precondition_failed:
    "The conditions required for this operation were not met. Check the selected records and their metadata.",
  result_limit:
    "The result is too large to read safely. This call did not establish complete coverage or an absence of evidence.",
  invalid_request: "The research request is invalid. Check the filters and identifiers before retrying.",
  invalid_cursor: "The page cursor does not match a returned continuation for this request.",
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

export type ResearchRecovery = Readonly<{
  action: "select_returned" | "restart" | "resolve_document" | "narrow" | "answer"
  instruction: string
  documents?: ReadonlyArray<Readonly<{ id: string; billId: string; versionCode?: string }>>
  continuation?: Readonly<{ field: "cursor" | "childCursor"; value: string }>
}>

export function researchLimitRecovery(name: string): ResearchRecovery {
  let instruction =
    "Make a new first-page request without cursor or childCursor. Request fewer records with limit: 1, childLimit: 1, or a single ID where supported; keep the intended source and narrow the filters. If one record is still too large, read a selected section or collection. Do not infer missing evidence from this failure; disclose unread coverage."
  if (name === "search_bill_text") {
    instruction =
      "Make a new first-page request without cursor, with limit: 1 and a narrower query. Scope to a known billId or returned documentIds when available. If one passage still exceeds the budget, discover document metadata and read selected sections instead. No omitted passage or continuation from this failed call was read; disclose that coverage remains incomplete."
  } else if (name === "describe_analytics") {
    instruction = "Request one dataset in datasets instead of the full catalog. The failed catalog was not read."
  } else if (name === "get_person") {
    instruction =
      "The person identity or its provenance exceeds the budget even without relationship previews. Do not retry get_person with limit, childLimit or cursor; those inputs are unsupported. Read get_memberships with personId, get_sponsored_bills with id, or read_record_collection with collection: person-terms and recordId, starting at limit: 1. The failed identity preview was not read; disclose incomplete coverage."
  } else if (name === "get_organization") {
    instruction =
      "The organization identity or its context exceeds the budget even without relationship previews. Do not retry get_organization with limit, childLimit or cursor; those inputs are unsupported. Read get_memberships with organizationId, get_committee_bills with id, or read_record_collection with collection: organization-children and recordId, starting at limit: 1. Disclose that the failed detail was not read."
  } else if (name === "get_event") {
    instruction =
      "The event identity or its context exceeds the budget even without relationship previews. Do not retry get_event with limit, childLimit or cursor; those inputs are unsupported. Read read_record_collection with the event ID as recordId and collection: meeting-agenda, meeting-documents, meeting-participants, meeting-bills or meeting-outcomes, starting at limit: 1. Disclose that the failed detail was not read."
  } else if (name === "get_supporting_material") {
    instruction =
      "Restart get_supporting_material without cursor and with limit: 1. If one section or the material identity still exceeds the budget, use read_record_collection with recordId and collection: material-sections, selecting sectionId and textOffset for long text. Read relationships with collection: material-links. Disclose unread coverage; do not infer an absence of evidence."
  }
  return { action: "narrow", instruction }
}

export class ResearchFailure extends Error {
  constructor(
    readonly code: ResearchFailureCode,
    readonly reference: string,
    readonly recovery?: ResearchRecovery
  ) {
    super(
      `${failureMessages[code]} Reference: ${reference}${recovery ? `\nSelection recovery: ${JSON.stringify(recovery)}` : ""}`
    )
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
  if (value === "conflict") {
    return "precondition_failed"
  }
  if (value === "unprocessable") {
    return "invalid_request"
  }
  return "internal"
}
