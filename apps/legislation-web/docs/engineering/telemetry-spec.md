# Web application debugging telemetry

The user narrowed this project on September 19, 2026: explain prototype failures and slowness, not build a product
analytics program. The seven current Linear issues and this specification supersede the earlier full-coverage
proposal. Canceled/duplicate issues are not implementation requirements or release blockers.

## Goals and boundaries

- Connect a browser action to its HTTP request, research run, tool/dependency work and available Langfuse observation.
- Retain useful failure categories, known outcomes and actual durations without copying private research into Sentry.
- Keep instrumentation nonblocking and the original product, retry, cancellation and response semantics unchanged.
- Reuse vendor SDKs, existing canonical measurements and existing verification evidence.

There is no engagement, draft-dwell, history-use, activation, retention or cohort reporting. Product-usage tracking,
Session Replay, structured logs and application metrics remain disabled. Do not build a consent/analytics identity
subsystem, independent collector, custom dashboard application, critical-path engine or benchmark campaign.

## Delivery ownership

Andrew Craswell is the confirmed accountable platform, web, research, product, privacy and budget owner.

| Issue | Deliverable |
| --- | --- |
| LEG-37 | Finish verification of existing safe request/run and cross-vendor correlation |
| LEG-35 | Essential diagnostic privacy and bounded nonblocking SDK delivery |
| LEG-40 | Shared HTTP outcomes and useful dependency diagnostics |
| LEG-44 | Ordinary tool spans, canonical measurements and existing Langfuse model usage |
| LEG-46 | Conversation/composer submission, timing, terminal and recovery diagnostics |
| LEG-60 | One practical investigation workflow using existing vendor views |
| LEG-65 | Focused end-to-end, browser, privacy and approved synthetic-delivery acceptance |

## Runtime wiring

The [shared Node owner](node-telemetry.md) preserves one provider with independent Sentry/Langfuse sampling and
export filtering. Browser and [edge](edge-telemetry.md) retain their own supported SDK initialization.
The [correlation boundary](telemetry-correlation.md) preserves the public application correlation contract while
using separate opaque telemetry IDs and isolated request/run scopes.

Use ordinary HTTP, fetch/PostgreSQL, research and tool spans. Reuse an existing AI SDK tool span rather than adding
a duplicate. The canonical research measurement remains the owner of tool duration/count/size data. Langfuse remains
the owner of its existing model observations and evaluations; no parallel token/cost accounting pipeline is required.

Only manually authored, allowlisted diagnostic breadcrumbs are retained, up to 20 per scope. They accompany errors,
not a separate usage event stream. Native Sentry transport buffers are limited to 32 envelopes. Flush belongs at
bounded post-response/process lifecycle boundaries, never in the request/tool critical path.

Tracing defaults to zero. Explicit sampling and environment settings, vendor disable behavior and lookup instructions
are documented in the [debugging guide](../operations/telemetry-debugging.md).

## Privacy, identity and retention

The [export privacy boundary](telemetry-privacy.md) is mandatory. Sentry must not receive prompts, drafts, answers,
tool arguments/results, retrieved text, addresses, credentials, access/session keys, raw identities, SQL or raw URLs.
Error messages/source text and unapproved SDK fields are removed. Keep approved generated code locations and
normalized diagnostic context instead.

Request/run/cross-vendor IDs are diagnostic references, not persistent user identities or metric dimensions.
Do not infer user intent from a dropped connection or success from HTTP 200. Missing observations remain absent.
Existing separately approved Langfuse content/redaction policy is unchanged; this project does not expand it.

### Approved policy limits

The September 19 approvals remain ceilings, not evidence that vendor controls are configured or collection is enabled:

| Data class | Approved maximum |
| --- | --- |
| Errors | 90 days |
| Detailed spans, logs and Application Metrics | 30 days; logs/metrics remain off here |
| Pseudonymous usage and masked replay | Previously approved ceiling of 90 days; both are now outside prototype scope and remain off |
| Aggregate `traceMetric` | 396 days only after verified removal of all user/workspace/session/trace identifiers and research content; not required by this project |

US Sentry remains free/trial only. The existing Langfuse Core **$29/month base** is the sole paid exception.
No additional paid telemetry, overages, purchases, upgrades or automatic paid conversion are authorized.
Collection must fit verified plan allowances; alerts or dated usage snapshots are not hard spending caps.
LEG-27 and the Linear delivery brief retain the account evidence and control limitations.

The approved nonproduction smoke test permits at most 100 synthetic events/observations, without real customer data
or paid model calls. Replay stays off. Production enablement still requires authorization; completing code or tests
does not grant it.

## Completion

Follow the focused [acceptance contract](../operations/telemetry-acceptance.md). Keep repository verification and
browser checks for changed workflows. A successful SDK flush does not establish vendor ingestion: inspect the
received synthetic event/observation and record limitations truthfully.
