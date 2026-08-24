import {
  LegislationApiAbortError,
  LegislationApiClient,
  LegislationApiError,
  LegislationApiProtocolError,
  LegislationApiTimeoutError,
  type ApiRequestOptions,
  type PageResponse,
  type SearchPageResponse
} from "../api-client/client.js"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import type { LegislationQueryApi } from "./tools.js"

type Input<Name extends keyof LegislationQueryApi> = Parameters<LegislationQueryApi[Name]>[0]

export class HttpLegislationQueryAdapter implements LegislationQueryApi {
  readonly #client: LegislationApiClient

  constructor(client: LegislationApiClient) {
    this.#client = client
  }

  compareBillVersions(input: Input<"compareBillVersions">) {
    return this.#resource(() =>
      this.#client.compareBillVersions(input.billId, input.documentIds[0], input.documentIds[1], requestOptions())
    )
  }

  findRelatedBills(input: Input<"findRelatedBills">) {
    return this.#page(() =>
      this.#client.getRelatedBills(
        input.id,
        { limit: input.limit, mode: input.includeSemantic === true ? "semantic" : "explicit" },
        requestOptions()
      )
    )
  }

  getAmendment(input: Input<"getAmendment">) {
    return this.#resource(() => this.#client.getAmendment(input.id, requestOptions()))
  }

  getBill(input: Input<"getBill">) {
    return this.#resource(() =>
      this.#client.getBill(input.id, { childCursor: input.childCursor, childLimit: input.childLimit }, requestOptions())
    )
  }

  getBillVotes(input: Input<"getBillVotes">) {
    return this.#page(() =>
      this.#client.getBillVotes(input.billId, { cursor: input.cursor, limit: input.limit }, requestOptions())
    )
  }

  getBillText(input: Input<"getBillText">) {
    return this.#page(() =>
      this.#client.getBillText(
        input.id,
        { cursor: input.cursor, documentId: input.documentId, limit: input.childLimit, versionCode: input.versionCode },
        requestOptions()
      )
    )
  }

  getBillTimeline(input: Input<"getBillTimeline">) {
    return this.#page(() =>
      this.#client.getBillTimeline(input.id, { cursor: input.childCursor, limit: input.childLimit }, requestOptions())
    )
  }

  async getCalendar(_input: Input<"getCalendar">): Promise<never> {
    throw new LegislationError(
      "dependency_unavailable",
      "The HTTP MCP transport cannot serve calendars until an API parity route is available"
    )
  }

  getEvent(input: Input<"getEvent">) {
    return this.#resource(() => this.#client.getMeeting(input.id, requestOptions()))
  }

  getOrganization(input: Input<"getOrganization">) {
    return this.#resource(() =>
      this.#client.getOrganization(input.id, { cursor: input.cursor, limit: input.limit }, requestOptions())
    )
  }

  getPerson(input: Input<"getPerson">) {
    return this.#resource(() =>
      this.#client.getPerson(input.id, { cursor: input.cursor, limit: input.limit }, requestOptions())
    )
  }

  getSupportingMaterial(input: Input<"getSupportingMaterial">) {
    return this.#resource(() =>
      this.#client.getSupportingMaterial(input.id, { cursor: input.cursor, limit: input.limit }, requestOptions())
    )
  }

  getVote(input: Input<"getVote">) {
    return this.#resource(() => this.#client.getVote(input.id, requestOptions()))
  }

  searchAmendments(input: Input<"searchAmendments">) {
    return this.#search(() =>
      this.#client.searchAmendments(
        {
          billIds: input.billId === undefined ? undefined : [input.billId],
          cursor: input.cursor,
          jurisdictionIds: input.jurisdictionId === undefined ? undefined : [input.jurisdictionId],
          limit: input.limit,
          mode: input.mode,
          query: input.query,
          sponsorPersonIds: input.sponsorPersonId === undefined ? undefined : [input.sponsorPersonId]
        },
        requestOptions()
      )
    )
  }

  searchBills(input: Input<"searchBills">) {
    return this.#search(() => this.#client.searchBills({ ...input }, requestOptions()))
  }

  searchBillText(input: Input<"searchBillText">) {
    return this.#search(() =>
      this.#client.searchBillText(
        { ...input, billIds: input.billId === undefined ? undefined : [input.billId], billId: undefined },
        requestOptions()
      )
    )
  }

  searchChanges(input: Input<"searchChanges">) {
    return this.#page(() =>
      this.#client.listChanges(
        {
          classification: input.changeType,
          cursor: input.cursor,
          jurisdictionId: input.jurisdictionId,
          limit: input.limit,
          observedFrom: iso(input.observedFrom),
          observedTo: iso(input.observedTo),
          organizationId: input.organizationId,
          personId: input.personId,
          recordId: input.billId ?? input.recordId,
          recordType: input.billId === undefined ? input.recordType : "bill"
        },
        requestOptions()
      )
    )
  }

  async searchEvents(input: Input<"searchEvents">) {
    requireNoUnsupportedFilters(input, ["classification", "sort", "status"])
    return await this.#page(() =>
      this.#client.listMeetings(
        {
          cursor: input.cursor,
          from: iso(input.from),
          jurisdictionId: input.jurisdictionId,
          limit: input.limit,
          organizationId: input.organizationId,
          to: iso(input.to)
        },
        requestOptions()
      )
    )
  }

  searchOrganizations(input: Input<"searchOrganizations">) {
    return this.#page(() =>
      this.#client.listOrganizations(
        {
          classification: input.classification,
          cursor: input.cursor,
          isActive: input.isActive,
          jurisdictionId: input.jurisdictionId,
          limit: input.limit,
          parentOrganizationId: input.parentOrganizationId,
          q: input.query
        },
        requestOptions()
      )
    )
  }

  searchPeople(input: Input<"searchPeople">) {
    return this.#page(() =>
      this.#client.listPeople(
        {
          cursor: input.cursor,
          isActive: input.isActive,
          jurisdictionId: input.jurisdictionId,
          limit: input.limit,
          organizationId: input.organizationId,
          q: input.query
        },
        requestOptions()
      )
    )
  }

  searchSupportingMaterials(input: Input<"searchSupportingMaterials">) {
    return this.#search(() =>
      this.#client.searchSupportingMaterials(
        {
          amendmentIds: input.amendmentId === undefined ? undefined : [input.amendmentId],
          billIds: input.billId === undefined ? undefined : [input.billId],
          classifications: input.classification === undefined ? undefined : [input.classification],
          cursor: input.cursor,
          jurisdictionIds: input.jurisdictionId === undefined ? undefined : [input.jurisdictionId],
          limit: input.limit,
          meetingIds: input.eventId === undefined ? undefined : [input.eventId],
          mode: input.mode,
          query: input.query
        },
        requestOptions()
      )
    )
  }

  async searchVotes(input: Input<"searchVotes">) {
    requireNoUnsupportedFilters(input, ["from"])
    return await this.#page(() =>
      this.#client.listVotes(
        {
          billId: input.billId,
          cursor: input.cursor,
          limit: input.limit,
          organizationId: input.organizationId,
          personId: input.personId
        },
        requestOptions()
      )
    )
  }

  async #resource(operation: () => ReturnType<LegislationApiClient["getBill"]>) {
    return await apiCall(async () => (await operation()).data)
  }

  async #page(operation: () => Promise<PageResponse>) {
    return await apiCall(async () => legacyPage(await operation()))
  }

  async #search(operation: () => Promise<SearchPageResponse>) {
    return await apiCall(async () => legacyPage(await operation()))
  }
}

function requestOptions(): ApiRequestOptions {
  const context = getRequestContext()
  return { bearerToken: context?.bearerToken, correlationId: context?.correlationId }
}

function legacyPage(response: PageResponse | SearchPageResponse) {
  return {
    items: response.data,
    nextCursor: response.meta.nextCursor ?? undefined,
    truncated: response.meta.truncated,
    warnings: response.meta.warnings
  }
}

function iso(value: Date | undefined): string | undefined {
  return value?.toISOString()
}

function requireNoUnsupportedFilters(input: object, names: readonly string[]): void {
  const unsupported = names.find((name) => Reflect.get(input, name) !== undefined)
  if (unsupported !== undefined) {
    throw new LegislationError(
      "dependency_unavailable",
      `The HTTP MCP transport cannot serve the ${unsupported} filter until API parity is available`
    )
  }
}

async function apiCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof LegislationApiError) {
      throw new LegislationError(error.category, error.message, { cause: error })
    }
    if (
      error instanceof LegislationApiAbortError ||
      error instanceof LegislationApiProtocolError ||
      error instanceof LegislationApiTimeoutError
    ) {
      throw new LegislationError("dependency_unavailable", "The legislation API request could not be completed", {
        cause: error
      })
    }
    throw error
  }
}
