# Sentry export privacy boundary

LEG-34 implements the [telemetry specification](telemetry-spec.md)'s Sentry allowlist boundary. This removes
unapproved payload data; it does not approve optional collection, retention, identity linking or production rollout.

## Where filtering runs

[Shared options](../../src/services/sentry/sentryOptions.ts) install
[RostraPrivacy](../../src/services/sentry/sentryPrivacy.ts) for Node, edge and browser clients, alongside the
error/transaction/log/metric/breadcrumb callbacks. The browser explicitly retains this integration when selecting
its runtime error handler.

The integration projects the **final SDK envelope immediately before transport**. This covers SDK-added context,
attachments and separately serialized AI child spans, not only the parent observation's mask. It reconstructs
allowlisted headers, payloads and item counts. Failed projection or an unknown item type is dropped with a bounded
local diagnostic; rejected payload values are never included in that diagnostic.

Logs, metrics, traces and replay remain disabled by default. The prior unmasked browser replay integration is removed;
the consent/masking implementation in LEG-38 must explicitly restore it after acceptance. Replay recordings/events,
attachments, profiles, session/feedback/check-in and unknown envelope items are currently unsupported and dropped.
Enabling one requires its own data contract and envelope tests, not only an SDK integration.

## Retained and removed data

| Signal | Retained | Removed |
| --- | --- | --- |
| Errors | Native/registered error type, bounded cause chain, line/column, debug IDs, approved operational tags and numeric measurements | Arbitrary messages, raw error objects, user/request/extra contexts, source text, locals, function/module text, arbitrary fingerprints |
| Stack locations | Hex-named Next static chunks without origin/query/fragment; recognized compiled app paths normalized to route templates | External/source paths and filenames outside the bounded asset contract, credentials and path identifiers |
| Citation errors | Existing static citation-resolution fingerprint and approved outcome/count metadata | Citation hashes, source text and selected record identity |
| Traces | Trace/span/parent IDs, finite times, fixed operation names, approved numeric/enum metadata | SQL, prompts, outputs, raw span descriptions, URLs, arbitrary links/events and inherited content |
| Logs | Complete registered semantic event, validated metadata and its per-event attributes | Free-form/parameterized messages, unknown fields, SDK user/request metadata |
| Metrics | Registered metric type/unit/value, approved per-metric dimensions and required environment/runtime context | Raw identity, keys/URLs, arbitrary dimensions and unregistered metrics |
| Breadcrumbs | Registered event name and bounded operational metadata | Console/network/UI text and arbitrary breadcrumb content |

The error message is deliberately replaced with a fixed explanation. Stack/debug identity and operational tags remain
the grouping/diagnostic signal; the known citation fingerprint is preserved. Client-configured release is trusted
deployment metadata, not a payload-provided string. Log/metric projections use `unversioned` when no trusted release
is configured, rather than accepting a user-supplied label.

Model/provider strings are retained only when the privacy factory receives an explicit deployment allowlist.
The shared default has no model/provider allowlist. Producers must not use arbitrary provider-returned strings as
dimensions. Registered events/metrics that require an unapproved model/provider are rejected rather than emitting
misleading fallback values.

Canonical research-tool measurements are projected to approved timings, sizes, counts, tool/outcome and failure
fields. Unknown/nullable measurements stay absent. Raw input/output, evidence, tool-call text and access/session keys
are not copied. No Sentry projector mutates the original event/span/measurement or a Langfuse observation.

## Wire and inference controls

The final log/metric records are checked against the foundation's actual UTF-8 wire budgets, **after** typed attribute
serialization. Unknown SDK fields cannot inflate the record or bypass the dimension allowlist. Containers have
bounded item counts; only valid records survive, and headers reflect the surviving count.

Log, metric and streamed-span containers explicitly disable ingest IP/user-agent inference. Error payloads never
request inferred IP or retain SDK request/user fields. This does not prevent the provider from seeing transport-level
network metadata; region, privacy terms, deletion and retention still require the separate account/policy gates.

Envelope trace baggage and replay identity are not retained. A tunnel DSN is preserved only when it exactly matches
the client configuration; untrusted envelope DSNs and arbitrary header values are removed. Standard client-report
drop counts are retained through a strict reason/category/count schema.

## Verification

Co-located tests seed private research, email/address, bearer credentials, URLs, SQL and model content in errors,
causes, stack context, SDK attributes, logs, metrics, transaction children, streamed AI spans and replay/attachments.
An actual SDK client uses in-memory transport to assert the final envelopes, source data immutability and preserved
safe metadata. No tests transmit application data or synthetic fixtures to a vendor.

Existing Langfuse telemetry tests remain the owning regression check for its content/redaction policy. Its processor
is unchanged here. Source-map matching against a deployed release, consented replay, live vendor access and collection
overhead remain their dedicated foundation/acceptance tasks.
