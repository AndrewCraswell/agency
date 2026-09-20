import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { validateVoteDateRange } from "@repo/legislation-core/domain/vote-date-range"
import type {
  Page,
  PersonVoteListInput,
  PersonVotePositionRead,
  VoteListInput,
  VoteOption,
  VotePositionListInput,
  VotePositionRead,
  VoteRead,
  VoteResult,
  VoteSort
} from "../../legislation/persistence/queries/vote-reads"
import {
  apiPage,
  apiResource,
  assertAllowedQueryParameters,
  correlationId,
  queryInteger,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler,
  type JsonRecord
} from "./http"
import {
  parseVoteOption,
  projectPersonVoteActivity,
  projectVote,
  projectVoteDetailRead,
  projectVotePosition
} from "./vote-read-projection"

const MAX_BATCH_BYTES = 5 * 1024 * 1024
const MAX_BATCH_ITEMS = 25
const MAX_BATCH_CONCURRENCY = 4
const DEFAULT_BASE_URL = "http://127.0.0.1:3100"

export interface VoteReadApi {
  getVote: (voteId: string) => Promise<VoteRead>
  listPersonVotePositions: (input: PersonVoteListInput) => Promise<Page<PersonVotePositionRead>>
  listVotePositions: (input: VotePositionListInput) => Promise<Page<VotePositionRead>>
  listVotes: (input: VoteListInput) => Promise<Page<VoteRead>>
}

export function createVoteReadApiHandler(
  service: VoteReadApi,
  options: Readonly<{ apiBaseUrl: string }> = { apiBaseUrl: DEFAULT_BASE_URL }
): HttpApiHandler {
  return async (request, response) => {
    const url = requestUrl(request)
    try {
      const route = routeMatch(request.method, url.pathname)
      if (route === undefined) {
        return false
      }
      if (route.name === "batch") {
        assertAllowedQueryParameters(url, [])
        const ids = parseBatch(await readJsonBody(request, MAX_BATCH_BYTES))
        const data = await mapConcurrent(
          ids,
          MAX_BATCH_CONCURRENCY,
          async (id) => await batchItem(service, id, options.apiBaseUrl)
        )
        sendApiJson(response, 200, {
          data,
          links: { self: `${url.pathname}${url.search}` },
          meta: { correlationId: correlationId(request), requested: ids.length, returned: data.length, warnings: [] }
        })
        return true
      }
      if (route.name === "list") {
        const input = voteListInput(url)
        const page = await service.listVotes(input)
        sendApiJson(
          response,
          200,
          apiPage(
            request,
            { ...page, items: page.items.map((vote) => projectVote(vote, options.apiBaseUrl)) },
            input.limit ?? 25
          )
        )
        return true
      }
      if (route.name === "get") {
        assertAllowedQueryParameters(url, [])
        const vote = await service.getVote(route.voteId)
        const positions = await service.listVotePositions({ limit: 25, voteId: route.voteId })
        sendApiJson(response, 200, apiResource(request, projectVoteDetailRead(vote, positions, options.apiBaseUrl)))
        return true
      }
      if (route.name === "positions") {
        const input = votePositionsInput(url, route.voteId)
        const page = await service.listVotePositions(input)
        sendApiJson(
          response,
          200,
          apiPage(
            request,
            { ...page, items: page.items.map((item) => projectVotePosition(item, options.apiBaseUrl)) },
            input.limit ?? 25
          )
        )
        return true
      }
      const input = personVotesInput(url, route.personId)
      const page = await service.listPersonVotePositions(input)
      sendApiJson(
        response,
        200,
        apiPage(
          request,
          { ...page, items: page.items.map((item) => projectPersonVoteActivity(item, options.apiBaseUrl)) },
          input.limit ?? 20
        )
      )
      return true
    } catch (error) {
      sendApiError(request, response, error)
      return true
    }
  }
}

type Route =
  | { name: "batch" }
  | { name: "get"; voteId: string }
  | { name: "list" }
  | { name: "positions"; voteId: string }
  | { name: "personVotes"; personId: string }

function routeMatch(method: string | undefined, pathname: string): Route | undefined {
  const raw = pathname.split("/")
  if (raw[0] !== "" || raw[1] !== "api" || raw.some((segment, index) => index > 0 && segment.length === 0)) {
    return undefined
  }
  if (method === "POST" && raw.length === 4 && raw[2] === "votes" && raw[3] === "batch") {
    return { name: "batch" }
  }
  if (method !== "GET") {
    return undefined
  }
  if (raw.length === 3 && raw[2] === "votes") {
    return { name: "list" }
  }
  if (raw.length === 4 && raw[2] === "votes" && raw[3] === "batch") {
    return undefined
  }
  if (raw.length === 4 && raw[2] === "votes") {
    return { name: "get", voteId: pathId(raw[3], "voteId") }
  }
  if (raw.length === 5 && raw[2] === "votes" && raw[4] === "positions") {
    return { name: "positions", voteId: pathId(raw[3], "voteId") }
  }
  if (raw.length === 5 && raw[2] === "people" && raw[4] === "votes") {
    return { name: "personVotes", personId: pathId(raw[3], "personId") }
  }
  return undefined
}

function voteListInput(url: URL): VoteListInput {
  const names = [
    "billId",
    "classification",
    "cursor",
    "from",
    "jurisdictionId",
    "limit",
    "organizationId",
    "personId",
    "result",
    "sort",
    "to"
  ]
  assertAllowedQueryParameters(url, names)
  assertSingle(url, names)
  const from = bounded(url, "from", 64)
  const to = bounded(url, "to", 64)
  validateVoteDateRange(from, to)
  return {
    billId: bounded(url, "billId", 256),
    classification: bounded(url, "classification", 256),
    cursor: bounded(url, "cursor", 4096),
    from,
    jurisdictionId: bounded(url, "jurisdictionId", 256),
    limit: queryInteger(url, "limit", 25, 100),
    organizationId: bounded(url, "organizationId", 256),
    personId: bounded(url, "personId", 256),
    result: result(bounded(url, "result", 16)),
    sort: sort(bounded(url, "sort", 16)),
    to
  }
}
function votePositionsInput(url: URL, voteId: string): VotePositionListInput {
  assertAllowedQueryParameters(url, ["cursor", "limit", "option", "personId"])
  assertSingle(url, ["cursor", "limit", "personId"])
  const options: VoteOption[] = []
  for (const value of url.searchParams.getAll("option")) {
    const parsed = parseVoteOption(value.trim())
    if (parsed === undefined) {
      throw new LegislationError("invalid_request", "option must be a canonical vote option")
    }
    options.push(parsed)
  }
  if (new Set(options).size !== options.length) {
    throw new LegislationError("invalid_request", "option must not repeat")
  }
  return {
    cursor: bounded(url, "cursor", 4096),
    limit: queryInteger(url, "limit", 25, 100),
    options,
    personId: bounded(url, "personId", 256),
    voteId
  }
}
function personVotesInput(url: URL, personId: string): PersonVoteListInput {
  const names = ["cursor", "from", "limit", "option", "organizationId", "to"]
  assertAllowedQueryParameters(url, names)
  assertSingle(url, names)
  const from = bounded(url, "from", 64)
  const to = bounded(url, "to", 64)
  validateVoteDateRange(from, to)
  return {
    cursor: bounded(url, "cursor", 4096),
    from,
    limit: queryInteger(url, "limit", 20, 100),
    option: parseVoteOption(bounded(url, "option", 16)),
    organizationId: bounded(url, "organizationId", 256),
    personId,
    to
  }
}

async function batchItem(service: VoteReadApi, id: string, apiBaseUrl: string) {
  try {
    const vote = await service.getVote(id)
    const positions = await service.listVotePositions({ limit: 25, voteId: id })
    return { data: projectVoteDetailRead(vote, positions, apiBaseUrl), id, status: "ok" as const }
  } catch (error) {
    return { error: batchError(error), id, status: "error" as const }
  }
}
function batchError(error: unknown) {
  if (error instanceof LegislationError && (error.category === "forbidden" || error.category === "not_found")) {
    return { category: error.category, message: error.message, retryable: false }
  }
  return {
    category: "dependency_unavailable" as const,
    message: "The vote is incomplete in canonical persistence",
    retryable: false
  }
}
function parseBatch(body: JsonRecord) {
  if (
    Object.keys(body).length !== 1 ||
    !Array.isArray(body.ids) ||
    body.ids.length < 1 ||
    body.ids.length > MAX_BATCH_ITEMS
  ) {
    throw new LegislationError("invalid_request", "Request body must contain an ids array with between 1 and 25 values")
  }
  const ids = body.ids.map((value, index) =>
    typeof value === "string" ? value.trim() : fail(`ids[${index}] must be a string`)
  )
  if (ids.some((value) => !value || value.length > 256)) {
    throw new LegislationError("invalid_request", "Each id must be between 1 and 256 characters")
  }
  return [...new Set(ids)]
}
function pathId(raw: string | undefined, name: string) {
  try {
    const value = decodeURIComponent(raw ?? "")
    if (!value || value.length > 256) {
      throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
    }
    return value
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Path contains invalid percent encoding")
  }
}
function assertSingle(url: URL, names: readonly string[]) {
  for (const name of names) {
    if (url.searchParams.getAll(name).length > 1) {
      throw new LegislationError("invalid_request", `${name} must appear once`)
    }
  }
}
function bounded(url: URL, name: string, max: number) {
  const value = url.searchParams.get(name)
  if (value === null) {
    return undefined
  }
  const normalized = value.trim()
  if (!normalized || normalized.length > max) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${max} characters`)
  }
  return normalized
}
function result(value: string | null | undefined): VoteResult | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === "passed" || value === "failed" || value === "other") {
    return value
  }
  throw new LegislationError("invalid_request", "result must be passed, failed, or other")
}
function sort(value: string | undefined): VoteSort | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === "held-desc" || value === "held-asc") {
    return value
  }
  throw new LegislationError("invalid_request", "sort must be held-desc or held-asc")
}
function fail(message: string): never {
  throw new LegislationError("unprocessable", message)
}
