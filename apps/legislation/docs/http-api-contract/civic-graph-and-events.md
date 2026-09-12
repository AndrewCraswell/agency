# People, organizations, meetings, and calendar endpoints

All operations use the [shared protocol and envelopes](schemas.md). `GET` operations have no request body. Canonical
detail URLs remain top-level; nested routes expose a relationship from the named parent.

## Civic graph schemas

### People and service

| Schema | Required fields |
| ------ | --------------- |
| `PersonSummary` | `CanonicalFields`, `type: person`, `name`, `givenName: string or null`, `familyName: string or null`, `party: string or null`, `imageUrl: URL or null`, `isActive: boolean`, `jurisdictionIds: string[]` |
| `PersonDetail` | all `PersonSummary` fields plus `otherNames: string[]`, `email: string or null`, `officialUrl: URL or null`, `externalIdentifiers: ExternalIdentifier[]`, `terms: LegislativeTerm[]`, `memberships: Membership[]` |
| `ExternalIdentifier` | `scheme`, `value`, `sourceUrl: URL or null` |
| `LegislativeTerm` | `CanonicalFields`, `type: legislative-term`, `personId`, `jurisdictionId`, `organizationId: string or null`, `district: string or null`, `officeTitle: string`, `startDate: date or null`, `endDate: date or null`, `isCurrent: boolean` |
| `Membership` | `CanonicalFields`, `type: membership`, `person: PersonSummary`, `organization: OrganizationSummary`, `role: string`, `label: string or null`, `legislativeSessionId: string or null`, `effectiveStartDate: date or null`, `effectiveEndDate: date or null`, `detectedStartDate: date or null`, `detectedEndDate: date or null`, `lastObservedDate: date or null`, `endedReason: roster_removal_detected or congress_ended or historical_at_first_observation or null`, `isCurrent: boolean` |

Email is included only when an official source publishes it for public constituent contact. Personal contact information
is never inferred or exposed.

```ts
type ExternalIdentifier = { scheme: string; value: string; sourceUrl: string | null }
type PersonSummary = CanonicalFields & { type: "person"; name: string; givenName: string | null; familyName: string | null; party: string | null; imageUrl: string | null; isActive: boolean; jurisdictionIds: string[] }
type PersonDetail = PersonSummary & { otherNames: string[]; email: string | null; officialUrl: string | null; externalIdentifiers: ExternalIdentifier[]; terms: LegislativeTerm[]; memberships: Membership[]; membershipsPageInfo: ChildCollectionPageInfo }
type LegislativeTerm = CanonicalFields & { type: "legislative-term"; personId: string; jurisdictionId: string; organizationId: string | null; district: string | null; officeTitle: string; startDate: string | null; endDate: string | null; isCurrent: boolean }
type Membership = CanonicalFields & { type: "membership"; person: PersonSummary; organization: OrganizationSummary; role: string; label: string | null; legislativeSessionId: string | null; effectiveStartDate: string | null; effectiveEndDate: string | null; detectedStartDate: string | null; detectedEndDate: string | null; lastObservedDate: string | null; endedReason: "roster_removal_detected" | "congress_ended" | "historical_at_first_observation" | null; isCurrent: boolean }
```

Each source-backed appointment or reappointment is a separate `Membership` tenure with its own `id` and
`canonicalUrl`, including appointments that repeat the same person, organization, and role. Consecutive complete
snapshots of one uninterrupted appointment retain one tenure. An absence in a complete snapshot followed by a later
reappearance creates a new tenure. `effectiveStartDate` and `effectiveEndDate` are populated only when a source states
the appointment dates. `detectedStartDate` and `detectedEndDate` are source-publication dates from complete roster
comparisons. Retrieval times never substitute for either date class. See [committee membership
history](../committee-membership-history.md).

### Organizations

| Schema | Required fields |
| ------ | --------------- |
| `OrganizationSummary` | `CanonicalFields`, `type: organization`, `jurisdictionId`, `name`, `classification: legislature or chamber or committee or subcommittee or commission or agency or other`, `parentOrganizationId: string or null`, `chamber: lower or upper or unicameral or legislature or null`, `isActive` |
| `OrganizationDetail` | all `OrganizationSummary` fields plus `description: string or null`, `websiteUrl: URL or null`, `contact: PublicContact or null`, `children: OrganizationSummary[]`, `memberships: Membership[]`, `termsOfReference: string or null` |
| `PublicContact` | `address: string or null`, `phone: string or null`, `email: string or null` from an official public source |

Commissions and committees use the same canonical organization schema. Convenience collections filter by
classification and do not create commission-specific IDs.

```ts
type PublicContact = { address: string | null; phone: string | null; email: string | null }
type OrganizationSummary = CanonicalFields & { type: "organization"; jurisdictionId: string; name: string; classification: "legislature" | "chamber" | "committee" | "subcommittee" | "commission" | "agency" | "other"; parentOrganizationId: string | null; chamber: "lower" | "upper" | "unicameral" | "legislature" | null; isActive: boolean }
type OrganizationDetail = OrganizationSummary & { description: string | null; websiteUrl: string | null; contact: PublicContact | null; children: OrganizationSummary[]; memberships: Membership[]; termsOfReference: string | null; childPageInfo: { memberships: ChildCollectionPageInfo } }
```

### Meetings and calendars

| Schema | Required fields |
| ------ | --------------- |
| `MeetingSummary` | `CanonicalFields`, `type: meeting`, `jurisdictionId`, `sessionIds: string[]`, `organizationIds: string[]`, `calendarId: string or null`, `title`, `description: string or null`, `classification: meeting or hearing or session or other`, `status: scheduled or completed or cancelled or postponed or other`, `startsAt: timestamp or null`, `endsAt: timestamp or null`, `date: date`, `location: EventLocation or null`, `isRemote: boolean or null` |
| `MeetingDetail` | all `MeetingSummary` fields plus `organizations: OrganizationSummary[]`, `participants: MeetingParticipant[]`, `agenda: AgendaItem[]`, `documents: EventDocument[]`, `outcomes: MeetingOutcome[]`, and independent `ChildCollectionPageInfo` values for each child collection |
| `EventLocation` | `name: string or null`, `address: string or null`, `room: string or null`, `virtualUrl: URL or null` |
| `MeetingParticipant` | `CanonicalFields`, `type: meeting-participant`, `meetingId`, `person: PersonSummary or null`, `organization: OrganizationSummary or null`, `name`, `role: string or null` |
| `AgendaItem` | `CanonicalFields`, `type: agenda-item`, `meetingId`, `ordinal`, `title`, `description: string or null`, `billIds: string[]`, `amendmentIds: string[]`, `materialIds: string[]`, `status: string or null` |
| `EventDocument` | `CanonicalFields`, `type: event-document`, `meetingId`, `title`, `classification: string`, `documentId: string or null`, `materialId: string or null`, `sourceUrl` |
| `MeetingOutcome` | `CanonicalFields`, `type: meeting-outcome`, `meetingId`, `agendaItemId: string or null`, `classification: action or vote or disposition or note`, `description`, `billActionId: string or null`, `voteId: string or null`, `linkMethod: explicit or deterministic-id` |
| `CalendarSummary` | `CanonicalFields`, `type: calendar`, `jurisdictionId`, `organizationId: string or null`, `name`, `classification: string`, `timezone: string or null`, `sourceUrl`, `isActive` |
| `CalendarDetail` | all `CalendarSummary` fields plus `description: string or null`, `coverageFrom: date or null`, `coverageTo: date or null`, `sources` |

```ts
type EventLocation = { name: string | null; address: string | null; room: string | null; virtualUrl: string | null }
type MeetingParticipant = CanonicalFields & { type: "meeting-participant"; meetingId: string; person: PersonSummary | null; organization: OrganizationSummary | null; name: string; role: string | null }
type AgendaItem = CanonicalFields & { type: "agenda-item"; meetingId: string; ordinal: number; title: string; description: string | null; billIds: string[]; amendmentIds: string[]; materialIds: string[]; status: string | null }
type EventDocument = CanonicalFields & { type: "event-document"; meetingId: string; title: string; classification: string; documentId: string | null; materialId: string | null; sourceUrl: string }
type MeetingOutcome = CanonicalFields & { type: "meeting-outcome"; meetingId: string; agendaItemId: string | null; classification: "action" | "vote" | "disposition" | "note"; description: string; billActionId: string | null; voteId: string | null; linkMethod: "explicit" | "deterministic-id" }
type MeetingSummary = CanonicalFields & { type: "meeting"; jurisdictionId: string; sessionIds: string[]; organizationIds: string[]; calendarId: string | null; title: string; description: string | null; classification: "meeting" | "hearing" | "session" | "other"; status: "scheduled" | "completed" | "cancelled" | "postponed" | "other"; startsAt: string | null; endsAt: string | null; date: string; location: EventLocation | null; isRemote: boolean | null }
type MeetingDetail = MeetingSummary & { organizations: OrganizationSummary[]; participants: MeetingParticipant[]; agenda: AgendaItem[]; documents: EventDocument[]; outcomes: MeetingOutcome[]; childPageInfo: { participants: ChildCollectionPageInfo; agenda: ChildCollectionPageInfo; documents: ChildCollectionPageInfo; outcomes: ChildCollectionPageInfo } }
type CalendarSummary = CanonicalFields & { type: "calendar"; jurisdictionId: string; organizationId: string | null; name: string; classification: string; timezone: string | null; sourceUrl: string; isActive: boolean }
type CalendarDetail = CalendarSummary & { description: string | null; coverageFrom: string | null; coverageTo: string | null }
```

## People

### `GET /api/people`

Query parameters are `cursor`, `limit`, `q`, `jurisdictionId`, `organizationId`, `party`, `isActive`, and `sort`
(`name-asc` default or `updated-desc`). `q` matches bounded official-name and alias text; it is not semantic search. Response is
`Page<PersonSummary>`.

### `GET /api/people/{personId}`

Returns `ResourceResponse<PersonDetail>`. Historical terms and memberships are ordered by start date descending then ID.

### Person relationship collections

| Method and path                              | Query parameters                                                         | Response                       |
| -------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| `GET /api/people/{personId}/bills`           | `cursor`, `limit`, `role`, `sessionId`, `status`, `from`, `to`         | `Page<BillActivity>`           |
| `GET /api/people/{personId}/amendments`      | `cursor`, `limit`, `sessionId`, `status`, `from`, `to`                 | `Page<AmendmentSummary>`       |
| `GET /api/people/{personId}/votes`           | `cursor`, `limit`, `option`, `organizationId`, `from`, `to`            | `Page<VotePositionActivity>`   |
| `GET /api/people/{personId}/memberships`     | `cursor`, `limit`, `organizationId`, `isCurrent`, `from`, `to`         | `Page<Membership>`             |

Bill activity roles are `sponsor`, `cosponsor`, `author`, or `subject`. The API returns only stored structured
relationships; extracted document mentions will use a separately documented mention relationship after that data exists.
`PersonDetail.terms`, aliases, and identifiers are complete with ingestion maxima of 100, 250, and 250 respectively;
memberships use the existing relationship endpoint and `membershipsPageInfo` cursor.
Person bill, amendment, vote, and membership collections default respectively to latest-observed descending,
submitted-date descending, held-date descending, and membership start-date descending.

### `GET /api/people/{personId}/terms/{termId}`

Returns `ResourceResponse<LegislativeTerm>`. The term must belong to the path person; otherwise the response is
`404 not_found`. This is the unique canonical retrieval URL emitted in `LegislativeTerm.canonicalUrl`. No body or query
parameters are accepted.

## Organizations

### `GET /api/organizations`

Query parameters are `cursor`, `limit`, `q`, `jurisdictionId`, `classification`, `parentOrganizationId`, `chamber`,
`isActive`, and `sort` (`name-asc` default or `updated-desc`). Response is `Page<OrganizationSummary>`.

### `GET /api/organizations/{organizationId}`

Returns `ResourceResponse<OrganizationDetail>`. Embedded children and memberships are bounded by the standard child
limit and report continuation through `childPageInfo`.

### Organization relationship collections

| Method and path                                         | Query parameters                                                                  | Response                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `GET /api/organizations/{organizationId}/members`       | `cursor`, `limit`, `role`, `isCurrent`, `from`, `to`                            | `Page<Membership>`          |
| `GET /api/organizations/{organizationId}/meetings`      | `cursor`, `limit`, `from`, `to`, `status`, `classification`, `sort`             | `Page<MeetingSummary>`      |
| `GET /api/organizations/{organizationId}/bills`         | `cursor`, `limit`, `sessionId`, `status`, `relationship`, `from`, `to`           | `Page<BillSummary>`         |
| `GET /api/organizations/{organizationId}/calendars`     | `cursor`, `limit`, `classification`, `isActive`                                  | `Page<CalendarSummary>`     |

`relationship` for organization bills is `introduced-in`, `referred-to`, `reported-by`, `considered-by`, or `other`.
Source coverage may not provide every relationship; empty results include a coverage warning when appropriate.
Organization children are complete with an ingestion maximum of 250. Membership continuation uses the existing
`/members` endpoint. Organization members default role then person name ascending; bills default latest-action
descending; calendars default name ascending; meeting collections default `sort=starts-asc`.

### `GET /api/organizations/{organizationId}/memberships/{membershipId}`

Returns `ResourceResponse<Membership>`. The membership must belong to the path organization; otherwise the response is
`404 not_found`. This is the unique canonical retrieval URL emitted in `Membership.canonicalUrl`. No body or query
parameters are accepted.

## Meetings

### `GET /api/meetings`

This is the global meeting and hearing collection. Query parameters are `cursor`, `limit`, `jurisdictionId`,
`organizationId`, `calendarId`, `billId`, `classification`, `status`, `from`, `to`, `isRemote`, and `sort`
(`starts-asc` default, `starts-desc`, or `updated-desc`). Response is `Page<MeetingSummary>`.

The `from` and `to` interval uses the jurisdiction or calendar timezone for date-only values and UTC for timestamps.
Ambiguous local times without a configured timezone return `invalid_request` rather than fabricating an offset.

### `GET /api/meetings/{meetingId}`

Query parameter `childLimit` is 1 to 25, default 25, and bounds the first page of every embedded child collection.
Independent continuation cursors are returned in `childPageInfo` and used only with the corresponding relationship
endpoint. Response is `ResourceResponse<MeetingDetail>`. Cancelled or
postponed meetings remain addressable and expose their current status and change history.

### Meeting relationship collections

| Method and path                            | Query parameters                                         | Response                   |
| ------------------------------------------ | -------------------------------------------------------- | -------------------------- |
| `GET /api/meetings/{meetingId}/agenda`     | `cursor`, `limit`                                        | `Page<AgendaItem>`         |
| `GET /api/meetings/{meetingId}/documents`  | `cursor`, `limit`, `classification`                      | `Page<EventDocument>`      |
| `GET /api/meetings/{meetingId}/outcomes`   | `cursor`, `limit`, `classification`, `billId`           | `Page<MeetingOutcome>`     |
| `GET /api/meetings/{meetingId}/participants` | `cursor`, `limit`, `role`, `personId`, `organizationId` | `Page<MeetingParticipant>` |

Outcome links are explicit or deterministic-ID relationships. The API never presents semantic similarity or temporal
proximity as proof that a meeting produced an action or vote.
Meeting organizations are complete with an ingestion maximum of 50; the other embedded collections consume their
cursors through the four relationship endpoints above.
Agenda, document, outcome, and participant collections default respectively to ordinal ascending, classification then
title ascending, source sequence ascending, and participant name ascending.

### Singular meeting child retrieval

The following routes return `ResourceResponse<T>` for one canonical meeting child. In every case the child must belong
to the path meeting; otherwise the response is `404 not_found`. No body or query parameters are accepted.

| Method and path | Response |
| --- | --- |
| `GET /api/meetings/{meetingId}/agenda/{agendaItemId}` | `AgendaItem` |
| `GET /api/meetings/{meetingId}/documents/{eventDocumentId}` | `EventDocument` |
| `GET /api/meetings/{meetingId}/outcomes/{outcomeId}` | `MeetingOutcome` |
| `GET /api/meetings/{meetingId}/participants/{participantId}` | `MeetingParticipant` |

Each route is the unique retrieval URL emitted in the corresponding record's `canonicalUrl`.

## Calendars

### `GET /api/calendars`

Query parameters are `cursor`, `limit`, `jurisdictionId`, `organizationId`, `classification`, `isActive`, and `q`.
Response is `Page<CalendarSummary>`, ordered by name then ID.

### `GET /api/calendars/{calendarId}`

Returns `ResourceResponse<CalendarDetail>`.

### `GET /api/calendars/{calendarId}/meetings`

Query parameters are `cursor`, `limit`, `from`, `to`, `status`, and `sort` (`starts-asc` default or `starts-desc`). Response is
`Page<MeetingSummary>`.

## First-party representative lookup

### `POST /api/representative-lookups`

This route supports the web application and is not exposed through MCP or third-party developer credentials. It accepts
one of two mutually exclusive inputs:

```json
{
  "address": {
    "line1": "123 Main Street",
    "line2": null,
    "city": "Sacramento",
    "region": "CA",
    "postalCode": "95814",
    "country": "US"
  }
}
```

or:

```json
{
  "coordinates": { "latitude": 38.5816, "longitude": -121.4944 }
}
```

The exact request union is:

```ts
type RepresentativeLookupRequest =
  | { address: { line1: string; line2: string | null; city: string; region: string; postalCode: string; country: string }; coordinates?: never }
  | { coordinates: { latitude: number; longitude: number }; address?: never }
type ResolvedDistrict = { classification: string; label: string; jurisdictionId: string; organizationId: string | null; boundarySourceUrl: string; sources: SourceReference[] }
type RepresentativeMatch = { person: PersonSummary; term: LegislativeTerm; district: ResolvedDistrict; matchConfidence: number }
type RepresentativeLookupResult = { lookupId: string; resolvedAt: string; expiresAt: string; quality: "exact" | "interpolated" | "postal-centroid" | "unresolved"; districts: ResolvedDistrict[]; representatives: RepresentativeMatch[]; warnings: string[] }
```

All address fields except `line2` are required and strings are 1 to 200 characters; `country` is exactly two uppercase
ASCII letters. Latitude is -90 through 90,
longitude -180 through 180. The application normalizes the
input in memory, sends only the minimum necessary fields to an approved geocoder or civic-boundary provider, and does
not persist or trace the raw input by default.

Response is `200 ResourceResponse<RepresentativeLookupResult>` because this is a calculation, not a persisted-resource
create:

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `lookupId` | string | yes | Short-lived opaque identifier for this result, not the address. |
| `resolvedAt` | timestamp | yes | Resolution time. |
| `expiresAt` | timestamp | yes | Time after which the lookup must be repeated. |
| `quality` | `exact`, `interpolated`, `postal-centroid`, or `unresolved` | yes | Provider resolution quality. |
| `districts` | `ResolvedDistrict[]` | yes | Matched political and legislative districts. |
| `representatives` | `RepresentativeMatch[]` | yes | Canonical people and terms serving the matched districts. |
| `warnings` | string[] | yes | Ambiguity or incomplete-provider warnings. |

`ResolvedDistrict` has `classification`, `label`, `jurisdictionId`, `organizationId: string or null`, and
`boundarySourceUrl`. `RepresentativeMatch` has `person: PersonSummary`, `term: LegislativeTerm`, `district`, and
`matchConfidence` from 0 through 1. `unresolved` returns an empty representative array with `200`, not `404`. Malformed
input returns `400`; unsupported countries return `422 unprocessable`; provider failure returns `503`.
