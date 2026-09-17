const baseUrl = process.env.LEGISLATION_WEB_SMOKE_BASE_URL?.trim()
if (baseUrl === undefined || baseUrl === "") {
  throw new Error("LEGISLATION_WEB_SMOKE_BASE_URL is required")
}

const configuredApiToken = process.env.LEGISLATION_WEB_SMOKE_TOKEN?.trim()
const apiToken = configuredApiToken === undefined || configuredApiToken === "" ? undefined : configuredApiToken
if (
  apiToken !== undefined &&
  (apiToken.length > 8_192 ||
    [...apiToken].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F"))
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_TOKEN must be a bearer token of at most 8192 safe characters")
}

const configuredTimeoutMs = process.env.LEGISLATION_WEB_SMOKE_TIMEOUT_MS?.trim()
const timeoutMs = configuredTimeoutMs === undefined || configuredTimeoutMs === "" ? 10_000 : Number(configuredTimeoutMs)
if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_TIMEOUT_MS must be an integer between 1000 and 30000")
}

const configuredJurisdictionSessions = process.env.LEGISLATION_WEB_SMOKE_JURISDICTION_SESSIONS?.trim()
if (
  configuredJurisdictionSessions !== undefined &&
  configuredJurisdictionSessions !== "" &&
  configuredJurisdictionSessions !== "1"
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_JURISDICTION_SESSIONS must be 1 when it is set")
}
const configuredLegislativeRecords = process.env.LEGISLATION_WEB_SMOKE_LEGISLATIVE_RECORDS?.trim()
if (
  configuredLegislativeRecords !== undefined &&
  configuredLegislativeRecords !== "" &&
  configuredLegislativeRecords !== "1"
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_LEGISLATIVE_RECORDS must be 1 when it is set")
}
const configuredDocumentsResources = process.env.LEGISLATION_WEB_SMOKE_DOCUMENTS_RESOURCES?.trim()
if (
  configuredDocumentsResources !== undefined &&
  configuredDocumentsResources !== "" &&
  configuredDocumentsResources !== "1"
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_DOCUMENTS_RESOURCES must be 1 when it is set")
}
const configuredPeopleOrganizations = process.env.LEGISLATION_WEB_SMOKE_PEOPLE_ORGANIZATIONS?.trim()
if (
  configuredPeopleOrganizations !== undefined &&
  configuredPeopleOrganizations !== "" &&
  configuredPeopleOrganizations !== "1"
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_PEOPLE_ORGANIZATIONS must be 1 when it is set")
}
const configuredMeetingsCalendars = process.env.LEGISLATION_WEB_SMOKE_MEETINGS_CALENDARS?.trim()
if (
  configuredMeetingsCalendars !== undefined &&
  configuredMeetingsCalendars !== "" &&
  configuredMeetingsCalendars !== "1"
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_MEETINGS_CALENDARS must be 1 when it is set")
}
const configuredSearchResearch = process.env.LEGISLATION_WEB_SMOKE_SEARCH_RESEARCH?.trim()
if (configuredSearchResearch !== undefined && configuredSearchResearch !== "" && configuredSearchResearch !== "1") {
  throw new TypeError("LEGISLATION_WEB_SMOKE_SEARCH_RESEARCH must be 1 when it is set")
}
const smokeSearchResearch = configuredSearchResearch === "1"
const smokeMeetingsCalendars = configuredMeetingsCalendars === "1"
const smokePeopleOrganizations = configuredPeopleOrganizations === "1"
const smokeDocumentsResources = configuredDocumentsResources === "1"
const smokeLegislativeRecords = configuredLegislativeRecords === "1"
const smokeMeetingsCalendarsCumulative = smokeMeetingsCalendars || smokeSearchResearch
const smokePeopleOrganizationsCumulative = smokePeopleOrganizations || smokeMeetingsCalendarsCumulative
const smokeDocumentsResourcesCumulative = smokeDocumentsResources || smokePeopleOrganizationsCumulative
const smokeLegislativeRecordsCumulative = smokeLegislativeRecords || smokeDocumentsResourcesCumulative
const smokeJurisdictionSessions = configuredJurisdictionSessions === "1" || smokeLegislativeRecordsCumulative

function fixtureEnvironmentValue(name) {
  const configured = process.env[name]
  if (configured === undefined || configured.trim() === "") {
    return undefined
  }
  const value = configured.trim()
  if (
    value.length > 256 ||
    [...value].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F")
  ) {
    throw new TypeError(`${name} must be a non-empty fixture ID of at most 256 safe characters`)
  }
  return value
}

function safeEnvironmentText(name, maximumLength) {
  const configured = process.env[name]
  if (configured === undefined || configured.trim() === "") {
    return undefined
  }
  const value = configured.trim()
  if (
    value.length > maximumLength ||
    [...value].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F")
  ) {
    throw new TypeError(`${name} must be non-empty safe text of at most ${maximumLength} characters`)
  }
  return value
}

function expectedOutcomeEnvironmentValue(name, outcomes) {
  const value = safeEnvironmentText(name, 64)
  if (value !== undefined && !outcomes.includes(value)) {
    throw new TypeError(`${name} must be one of ${outcomes.join(", ")} when it is set`)
  }
  return value
}

const jurisdictionId = fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_JURISDICTION_ID") ?? "jurisdiction:ak"
const sessionId = fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_SESSION_ID") ?? "session:ak:30"
if (!/^jurisdiction:[a-z0-9-]+$/.test(jurisdictionId)) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_JURISDICTION_ID must be a canonical jurisdiction ID")
}
const jurisdictionCode = jurisdictionId.slice("jurisdiction:".length)
if (
  !sessionId.startsWith(`session:${jurisdictionCode}:`) ||
  sessionId.length === `session:${jurisdictionCode}:`.length
) {
  throw new TypeError("LEGISLATION_WEB_SMOKE_SESSION_ID must belong to LEGISLATION_WEB_SMOKE_JURISDICTION_ID")
}

const legislativeRecordsFixtures = {
  amendmentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_AMENDMENT_ID"),
  billId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_BILL_ID"),
  voteId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_VOTE_ID")
}

const documentsResourcesFixtures = {
  documentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_ID"),
  documentSectionId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID"),
  supportingMaterialId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID"),
  supportingMaterialSectionId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID")
}

const peopleOrganizationsFixtures = {
  membershipId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID"),
  organizationId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_ORGANIZATION_ID"),
  personId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_PERSON_ID"),
  termId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_TERM_ID")
}

const meetingsCalendarsFixtures = {
  agendaItemId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_AGENDA_ITEM_ID"),
  agendaMeetingId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_AGENDA_MEETING_ID"),
  eventDocumentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID"),
  eventDocumentMeetingId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID"),
  meetingDetailId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_MEETING_DETAIL_ID"),
  participantDetailMeetingId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_PARTICIPANT_DETAIL_MEETING_ID"),
  participantId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_PARTICIPANT_ID"),
  participantListMeetingId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_PARTICIPANT_LIST_MEETING_ID")
}

const searchResearchFixtures = {
  allExpectedOutcome: expectedOutcomeEnvironmentValue("LEGISLATION_WEB_SMOKE_SEARCH_ALL_EXPECTED_OUTCOME", ["200"]),
  allQuery: safeEnvironmentText("LEGISLATION_WEB_SMOKE_SEARCH_ALL_QUERY", 500),
  amendmentExpectedOutcome: expectedOutcomeEnvironmentValue(
    "LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_EXPECTED_OUTCOME",
    ["200", "dependency_unavailable"]
  ),
  amendmentQuery: safeEnvironmentText("LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_QUERY", 500),
  billExpectedOutcome: expectedOutcomeEnvironmentValue("LEGISLATION_WEB_SMOKE_SEARCH_BILLS_EXPECTED_OUTCOME", ["200"]),
  billQuery: safeEnvironmentText("LEGISLATION_WEB_SMOKE_SEARCH_BILLS_QUERY", 500),
  diffBillId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_BILL_ID"),
  diffExpectedOutcome: expectedOutcomeEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_EXPECTED_OUTCOME", [
    "200",
    "unprocessable"
  ]),
  diffLeftDocumentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_LEFT_DOCUMENT_ID"),
  diffRightDocumentId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_RIGHT_DOCUMENT_ID"),
  materialExpectedOutcome: expectedOutcomeEnvironmentValue(
    "LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_EXPECTED_OUTCOME",
    ["200"]
  ),
  materialQuery: safeEnvironmentText("LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_QUERY", 500),
  passageExpectedOutcome: expectedOutcomeEnvironmentValue("LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_EXPECTED_OUTCOME", [
    "200",
    "dependency_unavailable",
    "unprocessable"
  ]),
  passageQuery: safeEnvironmentText("LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_QUERY", 500),
  researchBillId: fixtureEnvironmentValue("LEGISLATION_WEB_SMOKE_RESEARCH_BILL_ID"),
  researchExpectedOutcome: expectedOutcomeEnvironmentValue("LEGISLATION_WEB_SMOKE_RESEARCH_EXPECTED_OUTCOME", [
    "200",
    "dependency_unavailable"
  ]),
  researchQuestion: safeEnvironmentText("LEGISLATION_WEB_SMOKE_RESEARCH_QUESTION", 2_000)
}

function smokeBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new TypeError("LEGISLATION_WEB_SMOKE_BASE_URL must be a valid credential-free HTTP(S) origin at its root")
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError("LEGISLATION_WEB_SMOKE_BASE_URL must be a credential-free HTTP(S) origin at its root")
  }
  return url
}

function requestName(url, method) {
  return `${method} ${url.pathname}`
}

async function smokeFetch(url, options = {}) {
  const { diagnosticName, ...fetchOptions } = options
  const method = fetchOptions.method ?? "GET"
  const name = diagnosticName ?? requestName(url, method)
  const headers = new Headers(fetchOptions.headers)
  if (apiToken !== undefined && url.pathname.startsWith("/api/")) {
    headers.set("authorization", `Bearer ${apiToken}`)
  }
  try {
    return await fetch(url, { ...fetchOptions, headers, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const reason = error instanceof Error ? error.name : "request failure"
    throw new Error(`${name} failed within ${timeoutMs}ms (${reason})`)
  }
}

function requireCorrelationId(response, name, expectedCorrelationId) {
  const correlationId = response.headers.get("x-correlation-id")
  if (correlationId === null || correlationId.trim() === "") {
    throw new Error(`${name} did not return an x-correlation-id`)
  }
  if (expectedCorrelationId !== undefined && correlationId !== expectedCorrelationId) {
    throw new Error(`${name} did not preserve its x-correlation-id`)
  }
}

function requireResponse(response, name, expectedStatus, expectedContentType) {
  if (response.status !== expectedStatus) {
    throw new Error(`${name} returned status ${response.status}, expected ${expectedStatus}`)
  }
  if (expectedContentType !== undefined && !response.headers.get("content-type")?.includes(expectedContentType)) {
    throw new Error(`${name} did not return ${expectedContentType}`)
  }
}

function requirePrivateNoStore(response, name) {
  if (response.headers.get("cache-control") !== "private, no-store") {
    throw new Error(`${name} did not return cache-control private, no-store`)
  }
}

function requireEtag(response, name) {
  const etag = response.headers.get("etag")
  if (etag === null || etag === "") {
    throw new Error(`${name} did not return an etag`)
  }
  return etag
}

function isExactJsonObject(value, key, expectedValue) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    value[key] === expectedValue
  )
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(value, expectedKeys) {
  return isRecord(value) && Object.keys(value).sort().join(",") === [...expectedKeys].sort().join(",")
}

function requireNonEmptyString(value, description) {
  if (typeof value !== "string" || value === "") {
    throw new Error(`${description} must be a non-empty string`)
  }
}

function requireStringArray(value, description) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${description} must be an array of strings`)
  }
}

function requireSourceReferences(value, description) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (source) =>
        !hasExactKeys(source, ["isOfficial", "provider", "retrievedAt", "sourceUpdatedAt", "sourceUrl"]) ||
        !isSafeNonEmptyMessage(source.provider) ||
        !isSafeNonEmptyMessage(source.retrievedAt) ||
        !isSafeNonEmptyMessage(source.sourceUrl) ||
        typeof source.isOfficial !== "boolean" ||
        !(source.sourceUpdatedAt === null || isSafeNonEmptyMessage(source.sourceUpdatedAt))
    )
  ) {
    throw new Error(`${description} must be a non-empty array of SourceReference values`)
  }
}

function isSafeNonEmptyMessage(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    ![...value].some((character) => character.codePointAt(0) <= 0x1f || character === "\u007F")
  )
}

function requirePageEnvelope(body, name, expectedCorrelationId) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.some((item) => !isRecord(item))
  ) {
    throw new Error(`${name} did not return an exact Page envelope`)
  }
  if (
    !hasExactKeys(body.meta, ["correlationId", "limit", "nextCursor", "truncated", "warnings"]) ||
    !hasExactKeys(body.links, ["next", "self"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.limit !== 1 ||
    (body.meta.nextCursor !== null && (typeof body.meta.nextCursor !== "string" || body.meta.nextCursor === "")) ||
    typeof body.meta.truncated !== "boolean" ||
    !Array.isArray(body.meta.warnings) ||
    typeof body.links.self !== "string" ||
    (body.links.next !== null && (typeof body.links.next !== "string" || body.links.next === ""))
  ) {
    throw new Error(`${name} did not return a valid Page envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)
}

function requireResourceEnvelope(body, name, expectedCorrelationId, expectedId) {
  if (!hasExactKeys(body, ["data", "links", "meta"]) || !isRecord(body.data)) {
    throw new Error(`${name} did not return an exact Resource envelope`)
  }
  if (
    !hasExactKeys(body.meta, ["correlationId", "warnings"]) ||
    !hasExactKeys(body.links, ["self"]) ||
    body.data.id !== expectedId ||
    body.meta.correlationId !== expectedCorrelationId ||
    !Array.isArray(body.meta.warnings) ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return the expected Resource envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)
}

function requireBatchEnvelope(
  body,
  name,
  expectedCorrelationId,
  expectedId,
  expectedKind,
  canonicalDataIncompleteMessage
) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.length !== 1 ||
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "requested", "returned", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.requested !== 1 ||
    body.meta.returned !== 1 ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return an exact Batch envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)

  const item = body.data[0]
  if (!isRecord(item)) {
    throw new Error(`${name} did not return a valid Batch item`)
  }
  if (item.status === "ok") {
    const id = expectedKind === "bill-amendments" ? item.billId : item.id
    const payload = expectedKind === "bill-amendments" ? item.page : item.data
    if (
      !hasExactKeys(
        item,
        expectedKind === "bill-amendments" ? ["billId", "page", "status"] : ["data", "id", "status"]
      ) ||
      id !== expectedId
    ) {
      throw new Error(`${name} did not return the expected Batch item`)
    }
    if (expectedKind === "bill-amendments") {
      requirePageEnvelope(payload, name, expectedCorrelationId)
    } else if (!isRecord(payload) || payload.id !== expectedId) {
      throw new Error(`${name} did not return the expected Batch resource`)
    }
    return "passed"
  }
  if (item.status !== "error") {
    throw new Error(`${name} did not return a Batch item with status ok or error`)
  }
  const expectedItemKeys =
    expectedKind === "bill-amendments" ? ["billId", "error", "status"] : ["error", "id", "status"]
  const itemId = expectedKind === "bill-amendments" ? item.billId : item.id
  if (
    !hasExactKeys(item, expectedItemKeys) ||
    itemId !== expectedId ||
    !isRecord(item.error) ||
    !hasExactKeys(item.error, ["category", "message", "retryable"])
  ) {
    throw new Error(`${name} did not return a canonical Batch error item`)
  }
  if (
    canonicalDataIncompleteMessage !== undefined &&
    item.error.category === "dependency_unavailable" &&
    item.error.message === canonicalDataIncompleteMessage &&
    item.error.retryable === false
  ) {
    return "canonical_data_incomplete"
  }
  if (
    item.error.category !== "not_found" ||
    typeof item.error.message !== "string" ||
    item.error.message === "" ||
    item.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical missing-fixture Batch item`)
  }
  return "fixture_missing"
}

function requireResourceBatchEnvelope(body, name, expectedCorrelationId, expectedItems) {
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.length !== expectedItems.length ||
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "requested", "returned", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.requested !== expectedItems.length ||
    body.meta.returned !== expectedItems.length ||
    typeof body.links.self !== "string"
  ) {
    throw new Error(`${name} did not return an exact resource Batch envelope`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireNonEmptyString(body.links.self, `${name} links.self`)

  for (const [index, expectedItem] of expectedItems.entries()) {
    const item = body.data[index]
    if (!isRecord(item) || item.id !== expectedItem.id) {
      throw new Error(`${name} did not return the expected resource Batch item`)
    }
    if (item.status === "ok" && (expectedItem.status === "ok" || expectedItem.status === "ok_or_error")) {
      if (
        !hasExactKeys(item, ["data", "id", "status"]) ||
        !isRecord(item.data) ||
        item.data.id !== expectedItem.id ||
        item.data.type !== expectedItem.type
      ) {
        throw new Error(`${name} did not return the expected successful resource Batch item`)
      }
      continue
    }
    if (
      !hasExactKeys(item, ["error", "id", "status"]) ||
      item.status !== "error" ||
      !isRecord(item.error) ||
      !hasExactKeys(item.error, ["category", "message", "retryable"]) ||
      item.error.category !== expectedItem.category ||
      !isSafeNonEmptyMessage(item.error.message) ||
      item.error.retryable !== expectedItem.retryable
    ) {
      throw new Error(`${name} did not return the expected resource Batch error item`)
    }
  }
}

function requireCanonicalNotFound(body, name, expectedCorrelationId) {
  if (!hasExactKeys(body, ["error"]) || !isRecord(body.error)) {
    throw new Error(`${name} did not return a canonical ErrorResponse`)
  }
  const expectedErrorKeys =
    body.error.details === undefined
      ? ["category", "correlationId", "message", "retryable"]
      : ["category", "correlationId", "details", "message", "retryable"]
  if (
    !hasExactKeys(body.error, expectedErrorKeys) ||
    body.error.category !== "not_found" ||
    body.error.correlationId !== expectedCorrelationId ||
    typeof body.error.message !== "string" ||
    body.error.message === "" ||
    body.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical not_found ErrorResponse`)
  }
  if (
    body.error.details !== undefined &&
    (!Array.isArray(body.error.details) ||
      body.error.details.some(
        (detail) =>
          !hasExactKeys(detail, ["field", "reason"]) ||
          typeof detail.field !== "string" ||
          typeof detail.reason !== "string"
      ))
  ) {
    throw new Error(`${name} did not return valid ErrorResponse details`)
  }
}

function requireCanonicalDataIncomplete(body, name, expectedCorrelationId) {
  if (
    !hasExactKeys(body, ["error"]) ||
    !hasExactKeys(body.error, ["category", "correlationId", "message", "retryable"]) ||
    body.error.category !== "unprocessable" ||
    body.error.correlationId !== expectedCorrelationId ||
    !isSafeNonEmptyMessage(body.error.message) ||
    body.error.retryable !== false
  ) {
    throw new Error(`${name} did not return a canonical data-incomplete ErrorResponse`)
  }
}

function requireExactCanonicalDataIncomplete(body, name, expectedCorrelationId, expectedMessage) {
  requireCanonicalDataIncomplete(body, name, expectedCorrelationId)
  if (body.error.message !== expectedMessage) {
    throw new Error(`${name} did not return the expected canonical data-incomplete ErrorResponse`)
  }
}

function requireCanonicalDependencyUnavailable(body, name, expectedCorrelationId) {
  if (
    !hasExactKeys(body, ["error"]) ||
    !hasExactKeys(body.error, ["category", "correlationId", "message", "retryable"]) ||
    body.error.category !== "dependency_unavailable" ||
    body.error.correlationId !== expectedCorrelationId ||
    !isSafeNonEmptyMessage(body.error.message) ||
    body.error.retryable !== true
  ) {
    throw new Error(`${name} did not return a canonical dependency-unavailable ErrorResponse`)
  }
}

function requireModelUsage(value, name) {
  if (
    !hasExactKeys(value, ["dimensions", "model", "provider", "purpose"]) ||
    !["cohere", "openai", "voyageai"].includes(value.provider) ||
    !["embedding", "generation", "reranking"].includes(value.purpose) ||
    !isSafeNonEmptyMessage(value.model) ||
    !(value.dimensions === null || (Number.isSafeInteger(value.dimensions) && value.dimensions >= 1))
  ) {
    throw new Error(`${name} returned invalid model metadata`)
  }
}

function requireSearchModels(models, name, mode, product) {
  if (!Array.isArray(models) || models.some((model) => !isRecord(model))) {
    throw new Error(`${name} did not return a valid models array`)
  }
  if (mode === "lexical") {
    if (models.length !== 0) {
      throw new Error(`${name} reported models for lexical search`)
    }
    return
  }
  const embedding =
    product === "bills" || product === "supporting-materials"
      ? { dimensions: 1024, model: "voyageai/voyage-4", provider: "voyageai" }
      : { dimensions: 1536, model: "openai/text-embedding-3-small", provider: "openai" }
  const expectedReranking = product === "bills" || product === "passages"
  if (models.length !== (expectedReranking ? 2 : 1)) {
    throw new Error(`${name} did not report the expected model metadata`)
  }
  const [embeddingModel, rerankingModel] = models
  requireModelUsage(embeddingModel, name)
  if (
    embeddingModel.provider !== embedding.provider ||
    embeddingModel.model !== embedding.model ||
    embeddingModel.purpose !== "embedding" ||
    embeddingModel.dimensions !== embedding.dimensions
  ) {
    throw new Error(`${name} did not report the expected embedding model`)
  }
  if (expectedReranking) {
    requireModelUsage(rerankingModel, name)
    if (
      rerankingModel.provider !== "cohere" ||
      rerankingModel.model !== "cohere/rerank-v3.5" ||
      rerankingModel.purpose !== "reranking" ||
      rerankingModel.dimensions !== null
    ) {
      throw new Error(`${name} did not report the expected reranking model`)
    }
  }
}

function requireUniversalSearchGroups(groups, name, recordTypes) {
  const expectedRecordTypes = new Set(recordTypes)
  if (
    !Array.isArray(groups) ||
    groups.length !== expectedRecordTypes.size ||
    expectedRecordTypes.size !== recordTypes.length
  ) {
    throw new Error(`${name} did not return one search group per requested record type`)
  }
  const seenRecordTypes = new Set()
  for (const group of groups) {
    if (
      !isRecord(group) ||
      !hasExactKeys(group, ["nextCursor", "recordType", "returned"]) ||
      !expectedRecordTypes.has(group.recordType) ||
      seenRecordTypes.has(group.recordType) ||
      (group.nextCursor !== null && !isSafeNonEmptyMessage(group.nextCursor)) ||
      !Number.isSafeInteger(group.returned) ||
      group.returned < 0
    ) {
      throw new Error(`${name} returned invalid universal search group metadata`)
    }
    seenRecordTypes.add(group.recordType)
  }
}

function requireSearchPageEnvelope(body, name, expectedCorrelationId, mode, product, recordTypes) {
  const expectedMetaKeys = [
    "correlationId",
    ...(product === "all" ? ["groups"] : []),
    "isReranked",
    "limit",
    "mode",
    "models",
    "nextCursor",
    "truncated",
    "warnings"
  ]
  if (
    !hasExactKeys(body, ["data", "links", "meta"]) ||
    !Array.isArray(body.data) ||
    body.data.some((hit) => !isRecord(hit)) ||
    !hasExactKeys(body.links, ["next", "self"]) ||
    !hasExactKeys(body.meta, expectedMetaKeys)
  ) {
    throw new Error(`${name} did not return an exact SearchPage envelope`)
  }
  if (
    body.meta.correlationId !== expectedCorrelationId ||
    body.meta.limit !== 1 ||
    body.meta.mode !== mode ||
    typeof body.meta.isReranked !== "boolean" ||
    typeof body.meta.truncated !== "boolean" ||
    (body.meta.nextCursor !== null && !isSafeNonEmptyMessage(body.meta.nextCursor)) ||
    (body.links.next !== null && !isSafeNonEmptyMessage(body.links.next)) ||
    !isSafeNonEmptyMessage(body.links.self)
  ) {
    throw new Error(`${name} did not return valid SearchPage metadata`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireSearchModels(body.meta.models, name, mode, product)
  if (product === "all") {
    requireUniversalSearchGroups(body.meta.groups, name, recordTypes)
  }
  const expectedReranked = mode !== "lexical" && (product === "bills" || product === "passages")
  if (body.meta.isReranked !== expectedReranked) {
    throw new Error(`${name} reported an invalid reranking state`)
  }
  for (const hit of body.data) {
    if (
      !hasExactKeys(hit, ["match", "rank", "record", "recordId", "recordType", "score", "sources"]) ||
      !isSafeNonEmptyMessage(hit.recordId) ||
      !recordTypes.includes(hit.recordType) ||
      !Number.isFinite(hit.score) ||
      !Number.isSafeInteger(hit.rank) ||
      hit.rank < 1 ||
      !isRecord(hit.match) ||
      !isRecord(hit.record) ||
      !Array.isArray(hit.sources)
    ) {
      throw new Error(`${name} did not return a valid search hit`)
    }
    requireSourceReferences(hit.sources, `${name} hit sources`)
  }
}

function requireDocumentDiffEnvelope(body, name, expectedCorrelationId, expected) {
  if (!hasExactKeys(body, ["data", "links", "meta"]) || !isRecord(body.data)) {
    throw new Error(`${name} did not return an exact Resource envelope`)
  }
  if (
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    !isSafeNonEmptyMessage(body.links.self) ||
    !Array.isArray(body.meta.warnings) ||
    !hasExactKeys(body.data, [
      "billId",
      "counts",
      "granularity",
      "hunks",
      "id",
      "leftDocument",
      "nextCursor",
      "rightDocument",
      "truncated"
    ]) ||
    body.data.billId !== expected.diffBillId ||
    !isSafeNonEmptyMessage(body.data.id) ||
    body.data.granularity !== "word" ||
    !Array.isArray(body.data.hunks) ||
    body.data.hunks.length > 1 ||
    !isRecord(body.data.leftDocument) ||
    !isRecord(body.data.rightDocument) ||
    body.data.leftDocument.id !== expected.diffLeftDocumentId ||
    body.data.rightDocument.id !== expected.diffRightDocumentId ||
    (body.data.nextCursor !== null && !isSafeNonEmptyMessage(body.data.nextCursor)) ||
    typeof body.data.truncated !== "boolean" ||
    !hasExactKeys(body.data.counts, ["added", "changed", "removed", "unchanged"])
  ) {
    throw new Error(`${name} did not return a valid document diff Resource`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  for (const count of Object.values(body.data.counts)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${name} did not return non-negative document diff counts`)
    }
  }
  for (const hunk of body.data.hunks) {
    if (
      !isRecord(hunk) ||
      !hasExactKeys(hunk, [
        "classification",
        "leftSectionId",
        "leftText",
        "operations",
        "ordinal",
        "rightSectionId",
        "rightText",
        "sources"
      ]) ||
      !["added", "changed", "removed", "unchanged"].includes(hunk.classification) ||
      !Number.isSafeInteger(hunk.ordinal) ||
      hunk.ordinal < 0 ||
      !Array.isArray(hunk.operations) ||
      !Array.isArray(hunk.sources)
    ) {
      throw new Error(`${name} did not return valid document diff hunks`)
    }
    requireSourceReferences(hunk.sources, `${name} hunk sources`)
    for (const operation of hunk.operations) {
      if (
        !isRecord(operation) ||
        !hasExactKeys(operation, ["classification", "leftEnd", "leftStart", "rightEnd", "rightStart", "text"]) ||
        !["delete", "equal", "insert"].includes(operation.classification) ||
        typeof operation.text !== "string" ||
        !validDiffRange(operation.leftStart, operation.leftEnd) ||
        !validDiffRange(operation.rightStart, operation.rightEnd)
      ) {
        throw new Error(`${name} did not return valid document diff operation bounds`)
      }
    }
  }
}

function validDiffRange(start, end) {
  return (
    (start === null && end === null) ||
    (Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(end) && end >= start)
  )
}

function requireResearchAnswerEnvelope(body, name, expectedCorrelationId, expectedQuestion) {
  if (!hasExactKeys(body, ["data", "links", "meta"]) || !isRecord(body.data)) {
    throw new Error(`${name} did not return an exact Resource envelope`)
  }
  if (
    !hasExactKeys(body.links, ["self"]) ||
    !hasExactKeys(body.meta, ["correlationId", "warnings"]) ||
    body.meta.correlationId !== expectedCorrelationId ||
    !isSafeNonEmptyMessage(body.links.self) ||
    !Array.isArray(body.meta.warnings) ||
    !hasExactKeys(body.data, [
      "answer",
      "citations",
      "claims",
      "generatedAt",
      "id",
      "question",
      "retrieval",
      "warnings"
    ]) ||
    !isSafeNonEmptyMessage(body.data.id) ||
    body.data.question !== expectedQuestion ||
    !isSafeNonEmptyMessage(body.data.answer) ||
    !isSafeNonEmptyMessage(body.data.generatedAt) ||
    !Array.isArray(body.data.claims) ||
    !Array.isArray(body.data.citations) ||
    !Array.isArray(body.data.warnings) ||
    !isRecord(body.data.retrieval)
  ) {
    throw new Error(`${name} did not return a valid research answer Resource`)
  }
  requireStringArray(body.meta.warnings, `${name} meta.warnings`)
  requireStringArray(body.data.warnings, `${name} data.warnings`)
  const citationIds = new Set()
  for (const citation of body.data.citations) {
    if (
      !isRecord(citation) ||
      !hasExactKeys(citation, [
        "billId",
        "documentId",
        "id",
        "recordId",
        "recordType",
        "sectionId",
        "snippet",
        "sourceUpdatedAt",
        "sourceUrl",
        "sources",
        "title"
      ]) ||
      !isSafeNonEmptyMessage(citation.id) ||
      citationIds.has(citation.id) ||
      !isSafeNonEmptyMessage(citation.recordId) ||
      !isSafeNonEmptyMessage(citation.recordType) ||
      !isSafeNonEmptyMessage(citation.snippet) ||
      !isSafeNonEmptyMessage(citation.sourceUrl) ||
      !isSafeNonEmptyMessage(citation.title) ||
      !Array.isArray(citation.sources)
    ) {
      throw new Error(`${name} did not return valid research citations`)
    }
    requireSourceReferences(citation.sources, `${name} citation sources`)
    citationIds.add(citation.id)
  }
  for (const claim of body.data.claims) {
    if (
      !isRecord(claim) ||
      !hasExactKeys(claim, ["citationIds", "confidence", "text"]) ||
      !isSafeNonEmptyMessage(claim.text) ||
      !["insufficient", "mixed", "supported"].includes(claim.confidence) ||
      !Array.isArray(claim.citationIds) ||
      claim.citationIds.some((citationId) => !isSafeNonEmptyMessage(citationId) || !citationIds.has(citationId)) ||
      (claim.confidence !== "insufficient" && claim.citationIds.length === 0)
    ) {
      throw new Error(`${name} did not return valid cited research claims`)
    }
  }
  const retrieval = body.data.retrieval
  if (
    !hasExactKeys(retrieval, [
      "candidateCount",
      "evidenceCount",
      "maxEvidence",
      "mode",
      "models",
      "recordTypes",
      "rerankedProducts",
      "rrfK"
    ]) ||
    retrieval.mode !== "lexical" ||
    retrieval.rrfK !== 60 ||
    !Number.isSafeInteger(retrieval.maxEvidence) ||
    retrieval.maxEvidence < 1 ||
    retrieval.maxEvidence > 50 ||
    !Number.isSafeInteger(retrieval.candidateCount) ||
    retrieval.candidateCount < 0 ||
    !Number.isSafeInteger(retrieval.evidenceCount) ||
    retrieval.evidenceCount < 0 ||
    retrieval.evidenceCount > retrieval.maxEvidence ||
    !Array.isArray(retrieval.models) ||
    retrieval.models.length !== 0 ||
    !Array.isArray(retrieval.recordTypes) ||
    !Array.isArray(retrieval.rerankedProducts) ||
    retrieval.rerankedProducts.length !== 0
  ) {
    throw new Error(`${name} did not return valid lexical research retrieval metadata`)
  }
}

async function smokeCanonicalApiNotFound(root, path, correlationId) {
  const url = new URL(path, root)
  const name = requestName(url, "GET")
  const response = await smokeFetch(url, {
    headers: { "x-correlation-id": correlationId },
    redirect: "manual"
  })
  requireResponse(response, name, 404, "application/json")
  requireCorrelationId(response, name, correlationId)
  let body
  try {
    body = await response.json()
  } catch {
    throw new Error(`${name} did not return a JSON ErrorResponse body`)
  }
  requireCanonicalNotFound(body, name, correlationId)
}

async function smokeConditionalGet(url, name, etag, correlationId) {
  const response = await smokeFetch(url, {
    diagnosticName: name,
    headers: { "if-none-match": etag, "x-correlation-id": correlationId }
  })
  requireResponse(response, name, 304)
  requirePrivateNoStore(response, name)
  requireCorrelationId(response, name, correlationId)
  if (response.headers.get("etag") !== etag) {
    throw new Error(`${name} did not preserve its etag for a conditional request`)
  }
}

async function smokeJurisdictionSessionsRoutes(root) {
  const jurisdictionSegment = encodeURIComponent(jurisdictionId)
  const sessionSegment = encodeURIComponent(sessionId)
  const routes = [
    { kind: "page", name: "jurisdictions", path: "/api/jurisdictions?limit=1" },
    {
      expectedId: jurisdictionId,
      fixtureBound: true,
      kind: "resource",
      name: "jurisdiction",
      path: `/api/jurisdictions/${jurisdictionSegment}`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction sessions",
      path: `/api/jurisdictions/${jurisdictionSegment}/sessions?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction bills",
      path: `/api/jurisdictions/${jurisdictionSegment}/bills?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction organizations",
      path: `/api/jurisdictions/${jurisdictionSegment}/organizations?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction commissions",
      path: `/api/jurisdictions/${jurisdictionSegment}/commissions?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction committees",
      path: `/api/jurisdictions/${jurisdictionSegment}/committees?limit=1`
    },
    {
      fixtureBound: true,
      kind: "page",
      name: "jurisdiction meetings",
      path: `/api/jurisdictions/${jurisdictionSegment}/meetings?limit=1`
    },
    {
      expectedId: sessionId,
      fixtureBound: true,
      kind: "resource",
      name: "session",
      path: `/api/sessions/${sessionSegment}`
    },
    { fixtureBound: true, kind: "page", name: "session bills", path: `/api/sessions/${sessionSegment}/bills?limit=1` },
    {
      fixtureBound: true,
      kind: "page",
      name: "session meetings",
      path: `/api/sessions/${sessionSegment}/meetings?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const url = new URL(route.path, root)
    const correlationId = `jurisdiction-sessions-smoke-${index + 1}`
    const name = requestName(url, "GET")
    const response = await smokeFetch(url, { headers: { "x-correlation-id": correlationId } })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }

    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }

    if (route.fixtureBound && response.status === 404) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (route.fixtureBound && response.status === 422) {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else {
      requireResourceEnvelope(body, name, correlationId, route.expectedId)
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/__deployment-smoke-missing__", "jurisdiction-sessions-smoke-api-missing"),
    smokeCanonicalApiNotFound(root, "/api/jurisdictions/", "jurisdiction-sessions-smoke-api-trailing-slash")
  ])

  return { notFound: ["unknown_api_path", "trailing_slash_api_path"], passed, skipped }
}

async function smokeLegislativeRecordsRoutes(root) {
  const routes = [
    {
      kind: "page",
      name: "bills",
      path: `/api/bills?jurisdictionId=${encodeURIComponent(jurisdictionId)}&limit=1`
    },
    {
      kind: "page",
      name: "amendments",
      path: `/api/amendments?jurisdictionId=${encodeURIComponent(jurisdictionId)}&sort=identifier-asc&limit=1`
    },
    { kind: "page", name: "votes", path: `/api/votes?jurisdictionId=${encodeURIComponent(jurisdictionId)}&limit=1` },
    {
      body: (id) => ({ ids: [id] }),
      fixture: "billId",
      kind: "batch",
      batchCanonicalDataIncompleteMessage: "The bill is incomplete in canonical persistence",
      name: "bill batch",
      method: "POST",
      path: "/api/bills/batch"
    },
    {
      body: (id) => ({ billIds: [id], limitPerBill: 1 }),
      fixture: "billId",
      kind: "bill-amendments",
      name: "bill amendments batch",
      method: "POST",
      path: "/api/bills/amendments/batch"
    },
    {
      canonicalDataIncompleteMessage: "Bill action canonical provenance is not persisted",
      fixture: "billId",
      kind: "resource",
      name: "bill",
      path: (id) => `/api/bills/${encodeURIComponent(id)}`
    },
    {
      canonicalDataIncompleteMessage: "timeline-complete row has incomplete ordering facts",
      fixture: "billId",
      kind: "page",
      name: "bill timeline",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/timeline?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "related bills",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/related?mode=explicit&limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill sections",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/sections?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill amendments",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/amendments?limit=1`
    },
    {
      canonicalDataIncompleteMessage: "Vote canonical persistence is incomplete",
      fixture: "billId",
      kind: "page",
      name: "bill votes",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/votes?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill documents",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/documents?limit=1`
    },
    {
      fixture: "billId",
      kind: "page",
      name: "bill changes",
      path: (id) => `/api/bills/${encodeURIComponent(id)}/changes?limit=1`
    },
    {
      body: (id) => ({ ids: [id] }),
      batchCanonicalDataIncompleteMessage: "The amendment is incomplete in canonical persistence",
      fixture: "amendmentId",
      kind: "batch",
      name: "amendment batch",
      method: "POST",
      path: "/api/amendments/batch"
    },
    {
      canonicalDataIncompleteMessage: "Structured amendment sponsor person canonical provenance is incomplete",
      fixture: "amendmentId",
      kind: "resource",
      name: "amendment",
      path: (id) => `/api/amendments/${encodeURIComponent(id)}`
    },
    {
      body: (id) => ({ ids: [id] }),
      fixture: "voteId",
      kind: "batch",
      name: "vote batch",
      method: "POST",
      path: "/api/votes/batch"
    },
    { fixture: "voteId", kind: "resource", name: "vote", path: (id) => `/api/votes/${encodeURIComponent(id)}` },
    {
      fixture: "voteId",
      kind: "page",
      name: "vote positions",
      path: (id) => `/api/votes/${encodeURIComponent(id)}/positions?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const fixtureId = route.fixture === undefined ? undefined : legislativeRecordsFixtures[route.fixture]
    if (route.fixture !== undefined && fixtureId === undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${route.fixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(fixtureId) : route.path
    const url = new URL(path, root)
    const method = route.method ?? "GET"
    const correlationId = `legislative-records-smoke-${index + 1}`
    const name = `${method} ${route.name}`
    const response = await smokeFetch(url, {
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body(fixtureId)) }),
      diagnosticName: name,
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (response.status === 404 && route.fixture !== undefined) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status === 422 && route.canonicalDataIncompleteMessage !== undefined) {
      requireExactCanonicalDataIncomplete(body, name, correlationId, route.canonicalDataIncompleteMessage)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (method === "GET") {
      requirePrivateNoStore(response, name)
      const etag = requireEtag(response, name)
      await smokeConditionalGet(
        url,
        `conditional GET ${route.name}`,
        etag,
        `legislative-records-smoke-conditional-${index + 1}`
      )
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
      passed.push(route.name)
    } else if (route.kind === "resource") {
      requireResourceEnvelope(body, name, correlationId, fixtureId)
      passed.push(route.name)
    } else {
      const batchOutcome = requireBatchEnvelope(
        body,
        name,
        correlationId,
        fixtureId,
        route.kind,
        route.batchCanonicalDataIncompleteMessage
      )
      if (batchOutcome === "passed") {
        passed.push(route.name)
      } else if (batchOutcome === "canonical_data_incomplete") {
        skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      } else {
        skipped.push({ name: route.name, reason: "fixture_missing" })
      }
    }
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/bills/", "legislative-records-smoke-bills-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/amendments/", "legislative-records-smoke-amendments-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/votes/", "legislative-records-smoke-votes-trailing-slash")
  ])

  return { notFound: ["bills_trailing_slash", "amendments_trailing_slash", "votes_trailing_slash"], passed, skipped }
}

function missingFixtureName(route) {
  return route.fixtures.find((fixture) => documentsResourcesFixtures[fixture] === undefined)
}

async function smokeDocumentsResourcesRoutes(root) {
  const routes = [
    {
      fixtures: ["documentId"],
      kind: "resource",
      name: "document",
      path: ({ documentId }) => `/api/documents/${encodeURIComponent(documentId)}`
    },
    {
      fixtures: ["documentId"],
      kind: "page",
      name: "document sections",
      path: ({ documentId }) => `/api/documents/${encodeURIComponent(documentId)}/sections?limit=1`
    },
    {
      fixtures: ["documentId", "documentSectionId"],
      kind: "resource",
      name: "document section",
      path: ({ documentId, documentSectionId }) =>
        `/api/documents/${encodeURIComponent(documentId)}/sections/${encodeURIComponent(documentSectionId)}`
    },
    {
      fixtures: [],
      kind: "page",
      name: "supporting materials",
      path: "/api/supporting-materials?jurisdictionId=jurisdiction%3Aus&classification=committee-report&limit=1"
    },
    {
      fixtures: ["supportingMaterialId"],
      kind: "resource",
      name: "supporting material",
      path: ({ supportingMaterialId }) => `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}`
    },
    {
      fixtures: ["supportingMaterialId"],
      kind: "page",
      name: "supporting material sections",
      path: ({ supportingMaterialId }) =>
        `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}/sections?limit=1`
    },
    {
      fixtures: ["supportingMaterialId", "supportingMaterialSectionId"],
      kind: "resource",
      name: "supporting material section",
      path: ({ supportingMaterialId, supportingMaterialSectionId }) =>
        `/api/supporting-materials/${encodeURIComponent(supportingMaterialId)}/sections/${encodeURIComponent(
          supportingMaterialSectionId
        )}`
    },
    { fixtures: [], kind: "page", name: "changes", path: "/api/changes?limit=1" },
    {
      body: ({ documentId, supportingMaterialId }) => ({
        items: [
          { id: documentId, type: "document" },
          { id: supportingMaterialId, type: "supporting-material" },
          { id: "document:__deployment-smoke-missing__", type: "document" }
        ]
      }),
      fixtures: ["documentId", "supportingMaterialId"],
      kind: "resource-batch",
      method: "POST",
      name: "resource batch",
      path: "/api/resources/batch"
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(documentsResourcesFixtures) : route.path
    const url = new URL(path, root)
    const method = route.method ?? "GET"
    const correlationId = `documents-resources-smoke-${index + 1}`
    const name = `${method} ${route.name}`
    const response = await smokeFetch(url, {
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body(documentsResourcesFixtures)) }),
      diagnosticName: name,
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (["changes", "document", "document sections"].includes(route.name) && response.status === 422) {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (response.status === 404 && route.fixtures.length > 0) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    if (method === "GET") {
      requirePrivateNoStore(response, name)
      const etag = requireEtag(response, name)
      await smokeConditionalGet(
        url,
        `conditional GET ${route.name}`,
        etag,
        `documents-resources-smoke-conditional-${index + 1}`
      )
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else if (route.kind === "resource") {
      requireResourceEnvelope(body, name, correlationId, documentsResourcesFixtures[route.fixtures.at(-1)])
    } else {
      requireResourceBatchEnvelope(body, name, correlationId, [
        {
          category: "dependency_unavailable",
          id: documentsResourcesFixtures.documentId,
          retryable: true,
          status: "ok_or_error",
          type: "document"
        },
        { id: documentsResourcesFixtures.supportingMaterialId, status: "ok", type: "supporting-material" },
        {
          category: "not_found",
          id: "document:__deployment-smoke-missing__",
          retryable: false,
          status: "error"
        }
      ])
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/documents/", "documents-resources-smoke-documents-trailing-slash"),
    smokeCanonicalApiNotFound(
      root,
      "/api/supporting-materials/",
      "documents-resources-smoke-supporting-materials-trailing-slash"
    ),
    smokeCanonicalApiNotFound(root, "/api/changes/", "documents-resources-smoke-changes-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/resources/batch/", "documents-resources-smoke-resource-batch-trailing-slash")
  ])

  return {
    notFound: [
      "documents_trailing_slash",
      "supporting_materials_trailing_slash",
      "changes_trailing_slash",
      "resource_batch_trailing_slash"
    ],
    passed,
    skipped
  }
}

function missingPeopleOrganizationsFixtureName(route) {
  return route.fixtures.find((fixture) => peopleOrganizationsFixtures[fixture] === undefined)
}

async function smokePeopleOrganizationsRoutes(root) {
  const canonicalDataIncompleteRoutes = new Set([
    "organization",
    "organization membership",
    "organizations",
    "person",
    "person term"
  ])
  const routes = [
    {
      fixtures: [],
      kind: "page",
      name: "people",
      path: `/api/people?jurisdictionId=${encodeURIComponent(jurisdictionId)}&limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "resource",
      name: "person",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person bills",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/bills?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person amendments",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/amendments?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person votes",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/votes?limit=1`
    },
    {
      fixtures: ["personId"],
      kind: "page",
      name: "person memberships",
      path: ({ personId }) => `/api/people/${encodeURIComponent(personId)}/memberships?limit=1`
    },
    {
      fixtures: ["personId", "termId"],
      kind: "resource",
      name: "person term",
      path: ({ personId, termId }) => `/api/people/${encodeURIComponent(personId)}/terms/${encodeURIComponent(termId)}`
    },
    {
      fixtures: [],
      kind: "page",
      name: "organizations",
      path: `/api/organizations?jurisdictionId=${encodeURIComponent(jurisdictionId)}&limit=1`
    },
    {
      fixtures: ["organizationId"],
      kind: "resource",
      name: "organization",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization members",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/members?limit=1`
    },
    {
      fixtures: ["organizationId", "membershipId"],
      kind: "resource",
      name: "organization membership",
      path: ({ organizationId, membershipId }) =>
        `/api/organizations/${encodeURIComponent(organizationId)}/memberships/${encodeURIComponent(membershipId)}`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization meetings",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/meetings?limit=1`
    },
    {
      fixtures: ["organizationId"],
      kind: "page",
      name: "organization bills",
      path: ({ organizationId }) => `/api/organizations/${encodeURIComponent(organizationId)}/bills?limit=1`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingPeopleOrganizationsFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(peopleOrganizationsFixtures) : route.path
    const url = new URL(path, root)
    const correlationId = `people-organizations-smoke-${index + 1}`
    const name = `GET ${route.name}`
    const response = await smokeFetch(url, {
      diagnosticName: name,
      headers: { "x-correlation-id": correlationId }
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (canonicalDataIncompleteRoutes.has(route.name) && response.status === 422) {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (route.name === "organization membership" && response.status === 404) {
      requireCanonicalNotFound(body, name, correlationId)
      skipped.push({ name: route.name, reason: "fixture_missing" })
      continue
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200 or canonical fixture 404`)
    }
    requirePrivateNoStore(response, name)
    const etag = requireEtag(response, name)
    await smokeConditionalGet(
      url,
      `conditional GET ${route.name}`,
      etag,
      `people-organizations-smoke-conditional-${index + 1}`
    )
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else {
      requireResourceEnvelope(body, name, correlationId, peopleOrganizationsFixtures[route.fixtures.at(-1)])
    }
    passed.push(route.name)
  }

  await Promise.all([
    smokeCanonicalApiNotFound(root, "/api/people/", "people-organizations-smoke-people-trailing-slash"),
    smokeCanonicalApiNotFound(root, "/api/organizations/", "people-organizations-smoke-organizations-trailing-slash")
  ])

  return {
    notFound: ["people_trailing_slash", "organizations_trailing_slash"],
    passed,
    skipped
  }
}

function missingMeetingsCalendarsFixtureName(route) {
  return route.fixtures.find((fixture) => meetingsCalendarsFixtures[fixture] === undefined)
}

async function smokeMeetingsCalendarsRoutes(root) {
  const routes = [
    {
      fixtures: [],
      kind: "page",
      name: "meetings",
      path: `/api/meetings?jurisdictionId=${encodeURIComponent(jurisdictionId)}&limit=1`
    },
    {
      fixtures: ["meetingDetailId"],
      kind: "resource",
      name: "meeting",
      path: ({ meetingDetailId }) => `/api/meetings/${encodeURIComponent(meetingDetailId)}`
    },
    {
      fixtures: ["agendaMeetingId"],
      kind: "page",
      name: "meeting agenda",
      path: ({ agendaMeetingId }) => `/api/meetings/${encodeURIComponent(agendaMeetingId)}/agenda?limit=1`
    },
    {
      fixtures: ["agendaMeetingId", "agendaItemId"],
      kind: "resource",
      name: "meeting agenda item",
      path: ({ agendaMeetingId, agendaItemId }) =>
        `/api/meetings/${encodeURIComponent(agendaMeetingId)}/agenda/${encodeURIComponent(agendaItemId)}`
    },
    {
      fixtures: ["eventDocumentMeetingId"],
      kind: "page",
      name: "meeting documents",
      path: ({ eventDocumentMeetingId }) =>
        `/api/meetings/${encodeURIComponent(eventDocumentMeetingId)}/documents?limit=1`
    },
    {
      fixtures: ["eventDocumentMeetingId", "eventDocumentId"],
      kind: "resource",
      name: "meeting document",
      path: ({ eventDocumentMeetingId, eventDocumentId }) =>
        `/api/meetings/${encodeURIComponent(eventDocumentMeetingId)}/documents/${encodeURIComponent(eventDocumentId)}`
    },
    {
      fixtures: ["participantListMeetingId"],
      kind: "page",
      name: "meeting participants",
      path: ({ participantListMeetingId }) =>
        `/api/meetings/${encodeURIComponent(participantListMeetingId)}/participants?limit=1`
    },
    {
      fixtures: ["participantDetailMeetingId", "participantId"],
      kind: "resource",
      name: "meeting participant",
      path: ({ participantDetailMeetingId, participantId }) =>
        `/api/meetings/${encodeURIComponent(participantDetailMeetingId)}/participants/${encodeURIComponent(participantId)}`
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingMeetingsCalendarsFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const path = typeof route.path === "function" ? route.path(meetingsCalendarsFixtures) : route.path
    const url = new URL(path, root)
    const method = route.method ?? "GET"
    const correlationId = `meetings-calendars-smoke-${index + 1}`
    const name = `${method} ${route.name}`
    const response = await smokeFetch(url, {
      ...(route.body === undefined ? {} : { body: JSON.stringify(route.body()) }),
      diagnosticName: name,
      headers: {
        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
        "x-correlation-id": correlationId
      },
      method
    })
    requireCorrelationId(response, name, correlationId)
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`${name} did not return application/json`)
    }
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (response.status !== 200) {
      throw new Error(`${name} returned status ${response.status}, expected 200`)
    }
    requirePrivateNoStore(response, name)
    if (method === "GET") {
      const etag = requireEtag(response, name)
      await smokeConditionalGet(
        url,
        `conditional GET ${route.name}`,
        etag,
        `meetings-calendars-smoke-conditional-${index + 1}`
      )
    }
    if (route.kind === "page") {
      requirePageEnvelope(body, name, correlationId)
    } else {
      requireResourceEnvelope(body, name, correlationId, meetingsCalendarsFixtures[route.fixtures.at(-1)])
    }
    passed.push(route.name)
  }

  await smokeCanonicalApiNotFound(root, "/api/meetings/", "meetings-calendars-smoke-meetings-trailing-slash")

  return {
    notFound: ["meetings_trailing_slash"],
    passed,
    skipped
  }
}

function missingSearchResearchFixtureName(route) {
  return route.fixtures.find((fixture) => searchResearchFixtures[fixture] === undefined)
}

function searchResearchExpectedStatus(route) {
  const outcome = searchResearchFixtures[route.expectedOutcome]
  if (outcome === "200") {
    return 200
  }
  return outcome === "unprocessable" ? 422 : 503
}

async function smokeSearchResearchRoutes(root) {
  const routes = [
    {
      body: ({ billQuery }) => ({ limit: 1, mode: "lexical", query: billQuery }),
      expectedOutcome: "billExpectedOutcome",
      fixtures: ["billQuery", "billExpectedOutcome"],
      kind: "search",
      mode: "lexical",
      name: "bill search",
      path: "/api/search/bills",
      product: "bills",
      recordTypes: ["bill"]
    },
    {
      body: ({ amendmentQuery }) => ({ limit: 1, mode: "semantic", query: amendmentQuery }),
      expectedOutcome: "amendmentExpectedOutcome",
      fixtures: ["amendmentQuery", "amendmentExpectedOutcome"],
      kind: "search",
      mode: "semantic",
      name: "amendment search",
      path: "/api/search/amendments",
      product: "amendments",
      recordTypes: ["amendment"]
    },
    {
      body: ({ passageQuery }) => ({ limit: 1, mode: "hybrid", query: passageQuery }),
      expectedOutcome: "passageExpectedOutcome",
      fixtures: ["passageQuery", "passageExpectedOutcome"],
      kind: "search",
      mode: "hybrid",
      name: "passage search",
      path: "/api/search/passages",
      product: "passages",
      recordTypes: ["passage"]
    },
    {
      body: ({ materialQuery }) => ({ limit: 1, mode: "lexical", query: materialQuery }),
      expectedOutcome: "materialExpectedOutcome",
      fixtures: ["materialQuery", "materialExpectedOutcome"],
      kind: "search",
      mode: "lexical",
      name: "supporting-material search",
      path: "/api/search/supporting-materials",
      product: "supporting-materials",
      recordTypes: ["supporting-material"]
    },
    {
      body: ({ allQuery }) => ({
        limit: 1,
        mode: "lexical",
        perTypeLimit: 1,
        query: allQuery,
        recordTypes: ["bill", "amendment", "supporting-material"]
      }),
      expectedOutcome: "allExpectedOutcome",
      fixtures: ["allQuery", "allExpectedOutcome"],
      kind: "search",
      mode: "lexical",
      name: "universal search",
      path: "/api/search/all",
      product: "all",
      recordTypes: ["amendment", "bill", "supporting-material"]
    },
    {
      body: ({ diffBillId, diffLeftDocumentId, diffRightDocumentId }) => ({
        billId: diffBillId,
        granularity: "word",
        leftDocumentId: diffLeftDocumentId,
        limit: 1,
        rightDocumentId: diffRightDocumentId
      }),
      expectedOutcome: "diffExpectedOutcome",
      fixtures: ["diffBillId", "diffLeftDocumentId", "diffRightDocumentId", "diffExpectedOutcome"],
      kind: "document-diff",
      name: "document diff",
      path: "/api/document-diffs"
    },
    {
      body: ({ researchBillId, researchQuestion }) => ({
        answerFormat: "concise",
        question: researchQuestion,
        retrieval: { maxEvidence: 1, mode: "lexical", recordTypes: ["bill"] },
        scope: { billIds: [researchBillId] }
      }),
      expectedOutcome: "researchExpectedOutcome",
      fixtures: ["researchBillId", "researchQuestion", "researchExpectedOutcome"],
      kind: "research-answer",
      name: "research answer",
      path: "/api/research/answers"
    }
  ]
  const passed = []
  const skipped = []

  for (const [index, route] of routes.entries()) {
    const missingFixture = missingSearchResearchFixtureName(route)
    if (missingFixture !== undefined) {
      skipped.push({ name: route.name, reason: `fixture_not_configured:${missingFixture}` })
      continue
    }
    const url = new URL(route.path, root)
    const correlationId = `search-research-smoke-${index + 1}`
    const name = `POST ${route.name}`
    const response = await smokeFetch(url, {
      body: JSON.stringify(route.body(searchResearchFixtures)),
      diagnosticName: name,
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      method: "POST"
    })
    requireCorrelationId(response, name, correlationId)
    requireResponse(response, name, searchResearchExpectedStatus(route), "application/json")
    requirePrivateNoStore(response, name)
    let body
    try {
      body = await response.json()
    } catch {
      throw new Error(`${name} did not return a JSON body`)
    }
    if (searchResearchFixtures[route.expectedOutcome] === "dependency_unavailable") {
      if (response.headers.get("retry-after") !== "30") {
        throw new Error(`${name} did not return retry-after 30`)
      }
      requireCanonicalDependencyUnavailable(body, name, correlationId)
      skipped.push({ name: route.name, reason: "dependency_unavailable" })
      continue
    }
    if (searchResearchFixtures[route.expectedOutcome] === "unprocessable") {
      requireCanonicalDataIncomplete(body, name, correlationId)
      skipped.push({ name: route.name, reason: "canonical_data_incomplete" })
      continue
    }
    if (route.kind === "search") {
      requireSearchPageEnvelope(body, name, correlationId, route.mode, route.product, route.recordTypes)
    } else if (route.kind === "document-diff") {
      requireDocumentDiffEnvelope(body, name, correlationId, searchResearchFixtures)
    } else {
      requireResearchAnswerEnvelope(body, name, correlationId, searchResearchFixtures.researchQuestion)
    }
    passed.push(route.name)
  }

  return { passed, skipped }
}

const root = smokeBaseUrl(baseUrl)
const healthUrl = new URL("/health", root)
const readyUrl = new URL("/ready", root)
const unknownUrl = new URL("/__deployment-smoke-missing__", root)
const healthCorrelationId = "foundation-smoke-health"
const readyCorrelationId = "foundation-smoke-ready"

const [health, ready, homepage, unknownRoute, healthPost, readyPost] = await Promise.all([
  smokeFetch(healthUrl, { headers: { "x-correlation-id": healthCorrelationId } }),
  smokeFetch(readyUrl, { headers: { "x-correlation-id": readyCorrelationId } }),
  smokeFetch(root),
  smokeFetch(unknownUrl),
  smokeFetch(healthUrl, { method: "POST" }),
  smokeFetch(readyUrl, { method: "POST" })
])

requireResponse(health, requestName(healthUrl, "GET"), 200, "application/json")
requireResponse(ready, requestName(readyUrl, "GET"), 200, "application/json")
requireResponse(homepage, requestName(root, "GET"), 200, "text/html")
requireResponse(unknownRoute, requestName(unknownUrl, "GET"), 404)
requireResponse(healthPost, requestName(healthUrl, "POST"), 404, "application/json")
requireResponse(readyPost, requestName(readyUrl, "POST"), 404, "application/json")
requireCorrelationId(health, requestName(healthUrl, "GET"), healthCorrelationId)
requireCorrelationId(ready, requestName(readyUrl, "GET"), readyCorrelationId)

const [healthBody, readyBody, homepageMarkup, healthPostBody, readyPostBody] = await Promise.all([
  health.json(),
  ready.json(),
  homepage.text(),
  healthPost.json(),
  readyPost.json()
])
if (!isExactJsonObject(healthBody, "status", "ok") || readyBody?.status !== "ready") {
  throw new Error("Health and readiness routes did not return their expected JSON status payloads")
}
if (
  !isExactJsonObject(healthPostBody, "error", "not_found") ||
  !isExactJsonObject(readyPostBody, "error", "not_found")
) {
  throw new Error("Unsupported methods did not return the expected JSON not-found payload")
}
if (!homepageMarkup.includes("<main")) {
  throw new Error("GET / did not render the foundation placeholder page")
}

const jurisdictionSessions = smokeJurisdictionSessions ? await smokeJurisdictionSessionsRoutes(root) : undefined
const legislativeRecords = smokeLegislativeRecordsCumulative ? await smokeLegislativeRecordsRoutes(root) : undefined
const documentsResources = smokeDocumentsResourcesCumulative ? await smokeDocumentsResourcesRoutes(root) : undefined
const peopleOrganizations = smokePeopleOrganizationsCumulative ? await smokePeopleOrganizationsRoutes(root) : undefined
const meetingsCalendars = smokeMeetingsCalendarsCumulative ? await smokeMeetingsCalendarsRoutes(root) : undefined
const searchResearch = smokeSearchResearch ? await smokeSearchResearchRoutes(root) : undefined
let profile = "foundation"
if (smokeJurisdictionSessions) {
  profile = "foundation+jurisdiction-sessions"
}
if (smokeLegislativeRecordsCumulative) {
  profile = "foundation+jurisdiction-sessions+legislative-records"
}
if (smokeDocumentsResources) {
  profile = "foundation+jurisdiction-sessions+legislative-records+documents-resources"
}
if (smokePeopleOrganizationsCumulative) {
  profile = "foundation+jurisdiction-sessions+legislative-records+documents-resources+people-organizations"
}
if (smokeMeetingsCalendarsCumulative) {
  profile =
    "foundation+jurisdiction-sessions+legislative-records+documents-resources+people-organizations+meetings-calendars"
}
if (smokeSearchResearch) {
  profile =
    "foundation+jurisdiction-sessions+legislative-records+documents-resources+people-organizations+meetings-calendars+search-research"
}

process.stdout.write(
  `${JSON.stringify({
    health: health.status,
    homepage: homepage.status,
    ...(jurisdictionSessions === undefined ? {} : { jurisdictionSessions }),
    ...(legislativeRecords === undefined ? {} : { legislativeRecords }),
    ...(documentsResources === undefined ? {} : { documentsResources }),
    ...(peopleOrganizations === undefined ? {} : { peopleOrganizations }),
    ...(meetingsCalendars === undefined ? {} : { meetingsCalendars }),
    ...(searchResearch === undefined ? {} : { searchResearch }),
    profile,
    ready: ready.status,
    timeoutMs,
    unknownRoute: unknownRoute.status,
    unsupportedMethods: { health: healthPost.status, ready: readyPost.status }
  })}\n`
)
