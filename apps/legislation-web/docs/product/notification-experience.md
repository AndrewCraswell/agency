# Notification experience and Novu integration

## Decision and boundary

September 14, 2026: include Novu in the chat-first app specification, replacing the earlier product exclusion.
Novu is selected for in-app and email delivery design; no package installation, account provisioning, provider setup,
or production cutover is claimed. The legislation application team owns implementation. Hosting/region, plan limits,
providers, cost budget, data retention, and authenticated delivery canaries remain release decisions.
Reconsider the provider if it cannot meet isolation, preferences, recovery, or required delivery observability.

Novu supports channel workflows and an embedded inbox. We use those capabilities behind the product's notification
experience; the user does not need a Novu account or see its operational dashboard.
[Novu workflow and inbox concepts](https://docs.novu.co/platform/how-novu-works).

The [IA](information-architecture.md#primary-work) defines monitoring surfaces, and
[conversation integration](../design/conversations.md#9-writing-back-to-the-product) defines chat confirmation/receipts.
This document owns delivery semantics; neither design silently extends API enums or approves new channels.

## Ownership and event flow

```text
Source publication -> ingestion -> canonical change
  -> application subscription matching and scope checks
  -> durable matched event and per-recipient/channel delivery intent
  -> application batching and deduplication
  -> Novu in-app/email workflow -> provider receipts and inbox state

Application signed webhook delivery remains a separate channel under its existing contract.
```

The app owns canonical events, topic relevance, record/query subscriptions, organization authorization, matching,
frequency, timezone, batching windows, and durable delivery identity. Novu owns configured in-app/email execution and
inbox read/archive state. The app retains a mapped delivery ledger for user-facing history and recovery. Do not replace
domain subscriptions with Novu topics or workflow preferences: recipient grouping does not express legislative matching.
Novu IDs are internal mappings, not public canonical record IDs.

Use a stable server-derived recipient identity for each authorized user/account scope, never an editable email as ID.
The organization-owned subscription recipient policy must be specified before fan-out; subscribing for an organization
must not implicitly email every member. Verify membership again before dispatch and scope inbox access to the authenticated
user. Novu requires a stable subscriber ID; server-signed subscriber identity and context protect inbox access.
Client-selected context filters alone are not authorization.
[Subscribers](https://docs.novu.co/platform/concepts/subscribers),
[secure inbox contexts](https://docs.novu.co/platform/inbox/configuration/inbox-with-context).

Only send bounded event titles, short source-grounded descriptions, dates, canonical IDs/links, and necessary destination
data to Novu. Do not send private conversations, raw addresses, client strategy, legal research notes, or full legislative
documents. Clear authenticated inbox state on account changes. Decide notification retention/deletion separately from
research history and canonical event retention. Secrets and signing remain server-side.

## Product surfaces

| Surface | Content and behavior |
| --- | --- |
| Persistent bell | Unread count, recent notifications, open Updates; no competing badge state |
| Updates | Novu-backed personal inbox with read/unread and archive actions; open canonical evidence and matching reasons |
| Following detail | Compact configuration, Matched events by default, secondary Delivery history and selected delivery with collapsed attempts |
| Settings, Notifications | Global channel permissions, workflow-category preferences, verified email destination, timezone |
| Chat follow preview | Target and event scope plus effective channels; blocked email visibly explained before confirmation |
| Issue tracker | Durable matched changes independent of email opt-out; links to responsible follows and inbox items |

The inbox is a delivery surface, not the only archive of relevant changes. A user who disables in-app delivery can still
inspect matched events under Following and Issues. A Novu outage shows an unavailable-inbox state, never zero updates.
Archived notifications remain distinct from unsubscribing and from deleting canonical history. Read means the user marked
or opened the notification according to a defined interaction rule; it does not prove they reviewed the bill or email.

## Preferences and timing

The app controls what matches. Novu global and workflow channel preferences control whether a configured delivery may
proceed. For ordinary legislative alerts, effective delivery requires an active matching subscription, an enabled
subscription channel, an available verified destination, and permission from Novu's workflow/global/subscriber settings.
Use Novu as the source of truth for its preferences and reflect them in the app rather than maintaining conflicting
copies. A global email opt-out suppresses email even if a follow requests it. Show suppression rather than failure.
Never designate legislative urgency as a critical workflow that prevents opting out. Novu's preference precedence and
critical-workflow exceptions are documented in its [preference model](https://docs.novu.co/platform/concepts/preferences).

Retain the current API timing: immediate uses a 30-second coalescing window, hourly closes at minute 00, daily at 08:00
in the subscription timezone, with the documented daylight-saving behavior. The app closes the batch and submits it
to Novu; do not add a second Novu digest or delay that shifts the promised window. One canonical event can match many
follows. Within a recipient, channel, and due batch, merge duplicate event IDs while preserving all matching reasons.
Different requested delivery windows remain independent and must not be advertised as globally duplicate-free.

Pause/cancellation and opt-outs are checked before dispatch, including queued batches. Already handed-off messages may
still arrive; show this limitation. Query edits have an effective time and preview whether initial existing matches are
included. Do not flood users with historical imports labeled as new legislative actions. Corrections to prior events
must be labeled as corrections with their own identity. Include action time, detected time, and digest window as relevant.

Users may choose immediate delivery for a separate narrow follow such as meeting changes; it never overrides a global
opt-out or promises immediate source detection. Weekly digests, quiet hours, custom delivery times, escalation policies,
SMS, push, and chat channels are design candidates, not part of the current frequency/channel contract.

## Reliability and delivery status

Persist a delivery intent before invoking Novu and reuse its identity for retries. Keep an app uniqueness constraint
and reconciliation record beyond provider retention. Novu documents API-key idempotency, an enablement caveat, and a
24-hour cached-response window; verify support in the selected environment before relying on it. Unknown outcomes after
that window require reconciliation, not blind retriggering.
[Novu idempotency](https://docs.novu.co/api-reference/idempotency).

Define separate internal states for queued, handed to Novu, provider-accepted, delivered where evidenced, suppressed,
failed, and outcome unknown. A successful trigger is not proof of email delivery. Map these to the existing public
Delivery schema deliberately; add fields/states through reviewed contract changes where needed. Inbox persistence and
email delivery have different completion evidence. Choose one retry owner for each boundary; app dispatch retries and
Novu/provider retries must not independently resend the same accepted delivery. Authenticate and deduplicate receipts,
handle out-of-order status reports, and recover queued work after outages without replaying delivered messages.

The existing signed application webhook format, destination verification, SSRF defenses, retry policy, and signature
rotation remain authoritative. Novu push webhooks do not replace this contract.

## Release and designer acceptance

Design a populated/empty bell, inbox unavailable, read/archive synchronization, global-email-disabled follow preview,
digest, rescheduled meeting, correction, duplicate match reasons, paused follow, and failed/unknown delivery.

Implementation gates: verify cross-user/account isolation; preference changes across devices; unsubscribing with a queued
batch; retry after unknown acceptance; out-of-order receipts; duplicate event matching; daylight-saving windows; imports
and corrections; provider outage/recovery; and deep-link sign-in recovery. Record environment/provider evidence before
claiming delivery readiness. Match/source freshness is measured separately from notification processing latency.

Contract additions required: recipient policy, Novu identity mapping, inbox access/state API, effective-preference view,
delivery receipt/status mapping, scope revisions, batch deduplication and canonical-event references. This design does
not silently alter existing subscription endpoints. SDK and hosting choices follow these contracts.
