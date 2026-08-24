# Subscription, delivery, and webhook endpoints

Subscription and webhook routes are authenticated and organization-scoped when the token contains an organization ID.
A caller can access only resources owned by the same user or organization according to the approved sharing policy.
Mutable resources use `revision` with `If-Match`; every mutation requires the shared `Idempotency-Key`.

## Schemas

### Subscription

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `id` | string | yes | Canonical subscription ID. |
| `owner` | `SubscriptionOwner` | yes | `userId` and `organizationId: string or null`. |
| `name` | string | yes | User-visible name, length 1 through 120. |
| `target` | `SubscriptionTarget` | yes | Exactly one canonical resource target or saved query. |
| `eventTypes` | `SubscriptionEventType[]` | yes | Changes that may produce notification events. |
| `delivery` | `DeliveryPreference[]` | yes | One or more configured channels. |
| `frequency` | `immediate`, `hourly`, or `daily` | yes | Delivery batching preference. |
| `timezone` | IANA timezone | yes | Used for daily delivery windows. |
| `status` | `active`, `paused`, or `cancelled` | yes | Current lifecycle state. |
| `revision` | string | yes | Opaque optimistic-concurrency token. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | yes | Latest mutation time. |
| `cancelledAt` | timestamp or null | yes | Cancellation time. |

`SubscriptionTarget` is a discriminated union:

```json
{ "type": "record", "recordType": "bill", "recordId": "bill:us:119:hr:1" }
```

or:

```json
{
  "type": "query",
  "searchType": "bills",
  "request": {
    "query": "grid modernization",
    "mode": "hybrid",
    "jurisdictionIds": ["jurisdiction:us"]
  }
}
```

Record types are `bill`, `amendment`, `person`, `organization`, `meeting`, `calendar`, or `supporting-material`. Query
types are `bills`, `amendments`, `passages`, `supporting-materials`, or `all`; their request is validated against the
corresponding search contract and stored with a normalized fingerprint.

The exact stored request removes presentation controls (`cursor`, `limit`, and `explain`) from the corresponding search
request:

```ts
type SubscriptionOwner = { userId: string; organizationId: string | null }
type SubscriptionTarget =
  | { type: "record"; recordType: "bill" | "amendment" | "person" | "organization" | "meeting" | "calendar" | "supporting-material"; recordId: string }
  | { type: "query"; searchType: "bills"; request: Omit<BillSearchRequest, "cursor" | "limit" | "explain"> }
  | { type: "query"; searchType: "amendments"; request: Omit<AmendmentSearchRequest, "cursor" | "limit" | "explain"> }
  | { type: "query"; searchType: "passages"; request: Omit<PassageSearchRequest, "cursor" | "limit" | "explain"> }
  | { type: "query"; searchType: "supporting-materials"; request: Omit<MaterialSearchRequest, "cursor" | "limit" | "explain"> }
  | { type: "query"; searchType: "all"; request: Omit<UniversalSearchRequest, "cursor" | "limit" | "explain" | "perTypeLimit"> }
type DeliveryPreference =
  | { channel: "email"; destinationId: string | null; isEnabled: boolean }
  | { channel: "webhook"; destinationId: string; isEnabled: boolean }
  | { channel: "in-app"; destinationId: null; isEnabled: boolean }
type SubscriptionEventType = "record-created" | "record-updated" | "status-changed" | "action-added" | "amendment-added" | "vote-added" | "document-added" | "meeting-scheduled" | "meeting-rescheduled" | "meeting-cancelled" | "relationship-changed" | "query-match"
type Subscription = { id: string; canonicalUrl: string; owner: SubscriptionOwner; name: string; target: SubscriptionTarget; eventTypes: SubscriptionEventType[]; delivery: DeliveryPreference[]; frequency: "immediate" | "hourly" | "daily"; timezone: string; status: "active" | "paused" | "cancelled"; revision: string; createdAt: string; updatedAt: string; cancelledAt: string | null }
type CreateSubscriptionRequest = { name: string; target: SubscriptionTarget; eventTypes: SubscriptionEventType[]; delivery: DeliveryPreference[]; frequency: "immediate" | "hourly" | "daily"; timezone: string }
type UpdateSubscriptionRequest = Partial<Pick<CreateSubscriptionRequest, "name" | "eventTypes" | "delivery" | "frequency" | "timezone">> & { status?: "active" | "paused" }
```

`SubscriptionEventType` is `record-created`, `record-updated`, `status-changed`, `action-added`, `amendment-added`,
`vote-added`, `document-added`, `meeting-scheduled`, `meeting-rescheduled`, `meeting-cancelled`,
`relationship-changed`, or `query-match`. Unsupported target/event combinations return `400 invalid_request`.

`DeliveryPreference` has `channel: email or webhook or in-app`, `destinationId: string or null`, and `isEnabled`. Email
uses the authenticated profile or a verified destination. Webhook requires an active webhook owned by the same scope.

The valid target/event matrix is normative:

| Target | Allowed events |
| --- | --- |
| bill | record-updated, status-changed, action-added, amendment-added, vote-added, document-added, relationship-changed |
| amendment | record-updated, status-changed, action-added, document-added, relationship-changed |
| person | record-updated, relationship-changed, amendment-added, vote-added |
| organization | record-updated, relationship-changed, meeting-scheduled, meeting-rescheduled, meeting-cancelled |
| meeting or calendar | record-updated, meeting-scheduled, meeting-rescheduled, meeting-cancelled, document-added, relationship-changed |
| supporting-material | record-updated, document-added, relationship-changed |
| any query | record-created, record-updated, query-match |

Immediate delivery uses a 30-second coalescing window. Hourly batches close at minute 00 in the subscription timezone;
daily batches close at 08:00 local time. Daylight-saving gaps advance to the first valid instant and repeated instants
send once using the later offset. Batching is per subscription, not per owner.

### Subscription event and delivery

| Schema | Required fields |
| ------ | --------------- |
| `SubscriptionEvent` | `id`, `subscriptionId`, `eventType`, `changeEventId: string or null`, `recordType`, `recordId`, `title`, `summary`, `occurredAt`, `matchedAt`, `sourceUrls: URL[]` |
| `Delivery` | `id`, `subscriptionId`, `subscriptionEventIds: string[]`, `channel`, `destinationId: string or null`, `status: pending or processing or delivered or failed or suppressed`, `attemptCount`, `nextAttemptAt: timestamp or null`, `deliveredAt: timestamp or null`, `failureCategory: string or null`, `createdAt` |

Delivery bodies are generated from canonical events. They do not contain raw provider payloads, full document text, or
unbounded search results.

```ts
type SubscriptionEvent = { id: string; canonicalUrl: string; subscriptionId: string; eventType: SubscriptionEventType; changeEventId: string | null; recordType: string; recordId: string; title: string; summary: string; occurredAt: string; matchedAt: string; sourceUrls: string[] }
type Delivery = { id: string; canonicalUrl: string; subscriptionId: string; subscriptionEventIds: string[]; channel: "email" | "webhook" | "in-app"; destinationId: string | null; status: "pending" | "processing" | "delivered" | "failed" | "suppressed"; attemptCount: number; nextAttemptAt: string | null; deliveredAt: string | null; failureCategory: string | null; createdAt: string }
```

### Webhook

| Field | Type | Required | Meaning |
| ----- | ---- | -------- | ------- |
| `id` | string | yes | Canonical webhook ID. |
| `owner` | `SubscriptionOwner` | yes | Owning user and optional organization. |
| `name` | string | yes | User-visible label. |
| `url` | HTTPS URL | yes | Verified delivery destination. |
| `eventTypes` | `SubscriptionEventType[]` | yes | Allowed event subset or empty for all subscription events. |
| `status` | `pending-verification`, `active`, `paused`, or `cancelled` | yes | Lifecycle state. |
| `revision` | string | yes | Optimistic-concurrency token. |
| `secretLastFour` | string | yes | Non-secret display suffix. |
| `lastSucceededAt` | timestamp or null | yes | Latest successful delivery. |
| `lastFailedAt` | timestamp or null | yes | Latest failed delivery. |
| `createdAt`, `updatedAt`, `cancelledAt` | timestamps | yes | Lifecycle timestamps; cancellation is nullable. |

```ts
type Webhook = { id: string; canonicalUrl: string; owner: SubscriptionOwner; name: string; url: string; eventTypes: SubscriptionEventType[]; status: "pending-verification" | "active" | "paused" | "cancelled"; revision: string; secretLastFour: string; activeKeyIds: string[]; overlapEndsAt: string | null; lastSucceededAt: string | null; lastFailedAt: string | null; createdAt: string; updatedAt: string; cancelledAt: string | null }
type WebhookWithSecret = { webhook: Webhook; keyId: string; secret: string }
type CreateWebhookRequest = { name: string; url: string; eventTypes: SubscriptionEventType[] }
type UpdateWebhookRequest = { name?: string; url?: string; eventTypes?: SubscriptionEventType[]; status?: "active" | "paused" }
type RotateWebhookSecretRequest = { overlapSeconds?: number }
```

Webhook names are 1 to 120 Unicode characters after trimming. URLs are absolute HTTPS URLs of at most 2,048
characters. Signing secrets are 32 random bytes encoded as unpadded base64url (43 characters), providing 256 bits of
entropy.

`WebhookWithSecret` contains `{ webhook: Webhook, keyId: string, secret: string }`. The secret is returned only by create
and rotate responses, including exact idempotent replay during the 24-hour retention window, and cannot be recovered
after that window.

`CancellationReceipt` uses the exact shared schema; `id` is the cancelled resource ID.

## Subscriptions

### `GET /api/subscriptions`

Query parameters are `cursor`, `limit`, `status`, `targetType`, `recordType`, `eventType`, `channel`, and `updatedFrom`.
Response is `Page<Subscription>`, ordered by updated time descending then ID. Cancelled subscriptions remain visible
unless `status` excludes them.

### `POST /api/subscriptions`

Requires `Idempotency-Key`. Request body:

```json
{
  "name": "Federal grid modernization",
  "target": {
    "type": "query",
    "searchType": "bills",
    "request": {
      "query": "grid modernization",
      "mode": "hybrid",
      "jurisdictionIds": ["jurisdiction:us"]
    }
  },
  "eventTypes": ["record-created", "record-updated", "query-match"],
  "delivery": [
    { "channel": "email", "destinationId": null, "isEnabled": true },
    { "channel": "in-app", "destinationId": null, "isEnabled": true }
  ],
  "frequency": "daily",
  "timezone": "America/Los_Angeles"
}
```

All fields are required except a delivery destination when the channel derives it from the caller. At least one event
type and enabled delivery channel are required. Response is `201 ResourceResponse<Subscription>` with `Location` and
`ETag` headers. Two subscriptions may share a target when event types, enabled deliveries, frequency, or timezone differ.
An exact normalized duplicate across owner, target, event types, enabled deliveries, frequency, and timezone returns
`409 conflict` with safe details containing `existingSubscriptionId` and its canonical URL. Replaying the original
idempotency key returns the original `201` response.

### `GET /api/subscriptions/{subscriptionId}`

Returns `ResourceResponse<Subscription>` and `ETag: <revision>`.

### `PATCH /api/subscriptions/{subscriptionId}`

Requires `If-Match`, `Idempotency-Key`, and `Content-Type: application/merge-patch+json`. Request is a merge patch
containing one or more mutable fields:

```json
{
  "name": "Priority grid bills",
  "eventTypes": ["status-changed", "vote-added"],
  "delivery": [{ "channel": "in-app", "destinationId": null, "isEnabled": true }],
  "frequency": "immediate",
  "timezone": "America/New_York",
  "status": "active"
}
```

Mutable fields are `name`, `eventTypes`, `delivery`, `frequency`, `timezone`, and `status` (`active` or `paused`). Target
changes create a new subscription and are rejected here. Response is `ResourceResponse<Subscription>` with the new
revision. An empty patch returns `400`; stale revision returns `412 precondition_failed`; cancelled subscriptions return
`409 conflict`.

### `DELETE /api/subscriptions/{subscriptionId}`

Requires `If-Match` and `Idempotency-Key` and has no request body. Exact key replay returns the original receipt
regardless of later revisions; a new key with a stale revision returns `412 precondition_failed`. Response is
`200 ResourceResponse<CancellationReceipt>`. The service stops new matching and delivery work; already delivered audit
records remain. A client creates a new subscription rather than restoring a cancelled one.

### `GET /api/subscriptions/{subscriptionId}/events`

Query parameters are `cursor`, `limit`, `eventType`, `recordType`, `recordId`, `from`, and `to`. Response is
`Page<SubscriptionEvent>`, newest first.

### `GET /api/subscriptions/{subscriptionId}/deliveries`

Query parameters are `cursor`, `limit`, `channel`, `status`, `from`, and `to`. Response is `Page<Delivery>`, newest first.

## Webhooks

### `GET /api/webhooks`

Query parameters are `cursor`, `limit`, `status`, and `eventType`. Response is `Page<Webhook>`.
The fixed order is updated time descending then ID.

### `POST /api/webhooks`

Requires `Idempotency-Key`. Request body:

```json
{
  "name": "Policy data pipeline",
  "url": "https://example.org/hooks/legislation",
  "eventTypes": ["status-changed", "vote-added", "meeting-rescheduled"]
}
```

`name` and an HTTPS `url` are required. `eventTypes` may be empty to accept every event selected by linked
subscriptions. The service rejects loopback, private, link-local, credential-bearing, non-HTTPS, or otherwise unsafe
URLs. It resolves DNS before each attempt, rejects every private or link-local answer, connects only to a validated
address while preserving the hostname for TLS, and never follows redirects. Response is
`201 ResourceResponse<WebhookWithSecret>`. The webhook begins `pending-verification`; activation requires a successful
signed challenge.

### `GET /api/webhooks/{webhookId}`

Returns `ResourceResponse<Webhook>` without the secret and includes `ETag`.

### `PATCH /api/webhooks/{webhookId}`

Requires `If-Match`, `Idempotency-Key`, and `Content-Type: application/merge-patch+json`. Request may contain `name`,
`url`, `eventTypes`, or `status: paused`. PATCH can resume a previously verified paused webhook with `status: active`,
but it cannot activate `pending-verification`. Changing `url` always returns the webhook to `pending-verification` even
if the same patch asks for active. Response is `ResourceResponse<Webhook>` with the new revision.

### `DELETE /api/webhooks/{webhookId}`

Requires `If-Match` and `Idempotency-Key`; no request body. Exact replay and new-key stale-revision behavior match
subscription deletion. Response is `200 ResourceResponse<CancellationReceipt>`. Linked subscription
delivery preferences become disabled and produce an in-application warning rather than silently falling back to email.

### `POST /api/webhooks/{webhookId}/rotate-secret`

Requires `Idempotency-Key` and `If-Match`. Request body is:

```json
{
  "overlapSeconds": 3600
}
```

`overlapSeconds` is optional, defaults to 3,600, and may be 0 through 86,400. During overlap, the service emits both old
and new signatures so receivers can deploy the new secret safely. Response is
`200 ResourceResponse<WebhookWithSecret>`. It exposes the new secret under the shared one-time and idempotent-replay
rules. The old key ID remains valid only through the overlap end. The returned `webhook.activeKeyIds` contains both key
IDs when overlap is nonzero and `overlapEndsAt` is exactly the server-calculated end timestamp; with zero overlap it
contains only the new key and `overlapEndsAt` is null.

### `POST /api/webhooks/{webhookId}/verify` (`verifyWebhook`)

Requires `If-Match` and `Idempotency-Key`; body is `{}`. This is one synchronous attempt, never an internal retry loop.
The service sends
`{ "type": "webhook-verification", "challenge": string, "webhookId": string, "expiresAt": timestamp }`, signed using
the delivery algorithm. The receiver must return a `2xx` within 10 seconds with
`{ "challenge": "<exact supplied value>" }`. Success returns `200 ResourceResponse<Webhook>` with `status: active`.
A timeout, non-2xx response, or challenge mismatch returns `409 conflict` and leaves it pending. A caller may retry with
a new idempotency key; request duration is bounded at 10 seconds. URL changes require re-verification.

## Webhook delivery contract

Webhook requests use `POST` with JSON:

```json
{
  "id": "delivery:...",
  "type": "vote-added",
  "occurredAt": "2026-08-24T08:00:00Z",
  "subscriptionId": "subscription:...",
  "data": {
    "recordType": "bill",
    "recordId": "bill:us:119:hr:1",
    "changeEventId": "change:...",
    "title": "A roll call was added",
    "summary": "...",
    "sourceUrls": ["https://www.congress.gov/..."]
  }
}
```

Headers are `Legislation-Delivery-Id`, `Legislation-Event-Type`, `Legislation-Timestamp`, and
`Legislation-Signature: v1;kid=<key-id>;sig=<hex-hmac-sha256>`. During rotation the header contains comma-separated old
and new signatures. The signed content is `<timestamp>.<raw-body>`. Receivers select by `kid`, reject
timestamps older than five minutes and compare signatures in constant time. The service retries network errors, `408`,
`425`, `429`, and `5xx` responses with bounded jittered backoff; other `4xx` responses are terminal. Delivery attempts
never wait more than 8 minutes between retries and stop after five attempts. A receiver deduplicates by delivery ID.
Redirects are terminal. DNS is revalidated before every retry; delivery connects to the validated address while TLS and
HTTP Host use the configured hostname.
