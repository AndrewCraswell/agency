import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  BillTimelineListInput,
  BillTimelinePage,
  BillTimelinePersistenceRead,
  BillTimelineType
} from "../../legislation/persistence/queries/bill-timeline-read"
import {
  isIsoDate,
  isRfc3339Timestamp,
  projectBillAction,
  projectMeetingOutcome,
  projectVoteSummary,
  type ProjectionContext
} from "./canonical-projection"
import { projectBillTimelineRead, sourceProjectionContext, toProjectionLegislationError } from "./canonical-read"
import {
  apiPage,
  assertAllowedQueryParameters,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"
import { projectOrganizationRow } from "./organization-summary-read-projection"

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface BillTimelineReadApi {
  assertBillTimelineParentExists: (billId: string) => Promise<void>
  listBillTimeline: (input: BillTimelineListInput) => Promise<BillTimelinePage>
}

export function createBillTimelineReadApiHandler(
  service: BillTimelineReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: "http://127.0.0.1:3100" }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    if (!url.pathname.startsWith("/api/")) {
      return false
    }
    try {
      const billId = routeMatch(request.method, url.pathname)
      if (billId === undefined) {
        return false
      }
      assertAllowedQueryParameters(url, ["cursor", "from", "limit", "to", "type"])
      const from = queryDate(url, "from")
      const to = queryDate(url, "to")
      validateRange(from, to)
      const limit = queryLimit(url)
      await service.assertBillTimelineParentExists(billId)
      const page = await service.listBillTimeline({
        billId,
        cursor: queryText(url, "cursor", 4096),
        from,
        limit,
        to,
        types: queryTypes(url)
      })
      sendApiJson(
        response,
        200,
        apiPage(
          request,
          { ...page, items: page.items.map((item) => projectTimelineItem(item, options.apiBaseUrl)) },
          limit
        )
      )
    } catch (error) {
      sendApiError(request, response, toProjectionLegislationError(error))
    }
    return true
  }
}

function projectTimelineItem(item: BillTimelinePersistenceRead, apiBaseUrl: string) {
  switch (item.kind) {
    case "action": {
      const action = projectBillAction(
        {
          billId: requiredText(item.action.billId, "timeline action billId"),
          classifications: item.action.classification,
          date: requiredText(item.action.actionDate, "timeline action date"),
          description: item.action.description,
          id: item.action.id,
          occurredAt: item.action.actionAt,
          organization: projectActionOrganization(item, apiBaseUrl),
          sequence: item.action.ordinal,
          sourceUrl: requiredText(item.action.sourceUrl, "timeline action sourceUrl")
        },
        sourceProjectionContext(
          {
            createdAt: item.action.createdAt,
            id: item.action.id,
            sourceUrl: requiredText(item.action.sourceUrl, "timeline action sourceUrl"),
            updatedAt: item.action.createdAt
          },
          apiBaseUrl
        )
      )
      return projectBillTimelineRead({
        action,
        date: action.date,
        description: action.description,
        id: action.id,
        occurredAt: action.occurredAt,
        sequence: action.sequence,
        sources: action.sources,
        title: action.description,
        type: "action"
      })
    }
    case "vote": {
      const vote = item.vote
      const { date, heldAt } = voteOccurrence(vote)
      const summary = projectVoteSummary(
        {
          billId: vote.billId,
          classification: vote.classification,
          counts: {
            absent: requiredCount(vote.absentCount, "absent"),
            abstain: requiredCount(vote.abstainCount, "abstain"),
            no: requiredCount(vote.noCount, "no"),
            notVoting: requiredCount(vote.notVotingCount, "notVoting"),
            other: requiredCount(vote.otherCount, "other"),
            paired: requiredCount(vote.pairedCount, "paired"),
            present: requiredCount(vote.presentCount, "present"),
            proxy: requiredCount(vote.proxyCount, "proxy"),
            yes: requiredCount(vote.yesCount, "yes")
          },
          date,
          heldAt,
          id: vote.id,
          motion: vote.motion,
          organizationId: vote.organizationId,
          question: vote.question,
          result: voteResult(vote.result),
          sourceUrl: requiredText(vote.sourceUrl, "timeline vote sourceUrl")
        },
        voteContext(vote, apiBaseUrl)
      )
      return projectBillTimelineRead({
        date: summary.date,
        description: summary.motion,
        id: summary.id,
        occurredAt: summary.heldAt,
        sequence: requiredSequence(vote.sourceSequence, "timeline vote sourceSequence"),
        sources: summary.sources,
        title: summary.motion,
        type: "vote",
        vote: summary
      })
    }
    case "meeting-outcome": {
      const outcome = item.outcome
      const occurredAt = requiredDate(outcome.occurredAt, "timeline outcome occurredAt")
      const meetingOutcome = projectMeetingOutcome(
        {
          agendaItemId: outcome.agendaItemId,
          billActionId: outcome.actionId,
          classification: outcomeClassification(outcome.classification),
          description: outcome.description,
          id: outcome.id,
          linkMethod: outcomeLinkMethod(outcome.linkMethod),
          meetingId: outcome.eventId,
          sourceUrl: outcome.sourceUrl,
          voteId: outcome.voteId
        },
        {
          apiBaseUrl,
          sources: [
            {
              isOfficial: outcome.sourceIsOfficial,
              provider: outcome.sourceProvider,
              retrievedAt: outcome.sourceRetrievedAt,
              sourceUpdatedAt: outcome.sourceUpdatedAt,
              sourceUrl: outcome.sourceUrl
            }
          ],
          updatedAt: outcome.updatedAt
        }
      )
      return projectBillTimelineRead({
        date: requiredText(outcome.occurredDate, "timeline outcome occurredDate"),
        description: meetingOutcome.description,
        id: meetingOutcome.id,
        meetingOutcome,
        occurredAt: occurredAt.toISOString(),
        sequence: outcome.sourceSequence,
        sources: meetingOutcome.sources,
        title: meetingOutcome.description,
        type: "meeting-outcome"
      })
    }
  }
}

function voteContext(
  vote: Extract<BillTimelinePersistenceRead, { kind: "vote" }>["vote"],
  apiBaseUrl: string
): ProjectionContext {
  return {
    apiBaseUrl,
    sources: [
      {
        isOfficial: requiredBoolean(vote.sourceIsOfficial, "timeline vote sourceIsOfficial"),
        provider: requiredText(vote.sourceProvider, "timeline vote sourceProvider"),
        retrievedAt: requiredDate(vote.sourceRetrievedAt, "timeline vote sourceRetrievedAt"),
        sourceUpdatedAt: vote.sourceUpdatedAt,
        sourceUrl: requiredText(vote.sourceUrl, "timeline vote sourceUrl")
      }
    ],
    updatedAt: vote.createdAt
  }
}
function routeMatch(method: string | undefined, pathname: string): string | undefined {
  if (method !== "GET") {
    return undefined
  }
  const segments = pathname.split("/")
  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "api" ||
    segments[2] !== "bills" ||
    segments[4] !== "timeline"
  ) {
    return undefined
  }
  return pathId(segments[3])
}
function pathId(value: string | undefined): string {
  if (value === undefined) {
    throw new LegislationError("invalid_request", "Path is incomplete")
  }
  try {
    const id = decodeURIComponent(value)
    if (id.trim().length === 0 || id.length > 256) {
      throw new LegislationError("invalid_request", "billId must be between 1 and 256 characters")
    }
    return id
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}
function queryLimit(url: URL): number {
  const value = queryText(url, "limit", 16)
  if (value === undefined) {
    return DEFAULT_LIMIT
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", "limit must be a positive integer")
  }
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new LegislationError("invalid_request", `limit must be between 1 and ${MAX_LIMIT}`)
  }
  return limit
}
function queryDate(url: URL, name: "from" | "to"): string | undefined {
  const value = queryText(url, name, 64)
  if (value === undefined) {
    return undefined
  }
  if (!isDate(value)) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date or RFC3339 timestamp`)
  }
  return value
}
function queryTypes(url: URL): BillTimelineType[] | undefined {
  const values = url.searchParams.getAll("type")
  if (values.length === 0) {
    return undefined
  }
  const types = [...new Set(values.map((value) => value.trim()))]
  if (!types.every(isType)) {
    throw new LegislationError("invalid_request", "type must be action, vote, or meeting-outcome")
  }
  return types.filter(isType).sort()
}
function queryText(url: URL, name: string, maximum: number): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
  const value = values[0]?.trim() ?? ""
  if (value.length === 0 || value.length > maximum) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximum} characters`)
  }
  return value
}
function validateRange(from: string | undefined, to: string | undefined): void {
  if (
    from !== undefined &&
    to !== undefined &&
    (isIsoDate(to) ? Date.parse(from) >= Date.parse(to) + 86_400_000 : Date.parse(from) > Date.parse(to))
  ) {
    throw new LegislationError("invalid_request", "from must be less than or equal to to")
  }
}
function outcomeClassification(value: string): "action" | "disposition" | "note" | "vote" {
  if (value === "action" || value === "disposition" || value === "note" || value === "vote") {
    return value
  }
  throw new LegislationError("unprocessable", "timeline outcome classification is not canonical")
}
function outcomeLinkMethod(value: string): "deterministic-id" | "explicit" {
  if (value === "deterministic-id" || value === "explicit") {
    return value
  }
  throw new LegislationError("unprocessable", "timeline outcome linkMethod is not canonical")
}
function voteResult(value: string | null): "failed" | "other" | "passed" {
  if (value === "failed" || value === "other" || value === "passed") {
    return value
  }
  throw new LegislationError("unprocessable", "timeline vote result is not canonical")
}
function requiredCount(value: number | null, name: string): number {
  return requiredSequence(value, `timeline vote count ${name}`)
}
function requiredSequence(value: number | null, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new LegislationError("unprocessable", `${name} must be a nonnegative integer`)
  }
  return value
}
function requiredText(value: string | null, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}
function requiredDate(value: Date | null, name: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new LegislationError("unprocessable", `${name} must be a valid date`)
  }
  return value
}
function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}
function isType(value: string): value is BillTimelineType {
  return value === "action" || value === "meeting-outcome" || value === "vote"
}
function projectActionOrganization(item: Extract<BillTimelinePersistenceRead, { kind: "action" }>, apiBaseUrl: string) {
  if (item.action.organizationId === null) {
    return null
  }
  if (item.organization === null || item.organization.id !== item.action.organizationId) {
    throw new LegislationError("unprocessable", "timeline action organization is missing")
  }
  return projectOrganizationRow(item.organization, apiBaseUrl)
}
function isDate(value: string): boolean {
  return isIsoDate(value) || isRfc3339Timestamp(value)
}
import { voteOccurrence } from "../../legislation/persistence/queries/vote-occurrence"
