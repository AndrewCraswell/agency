# Debugging with Sentry and Langfuse

The prototype telemetry goal is to explain errors, slow requests and incomplete conversations, not measure engagement.
This is the current debugging workflow for LEG-35, LEG-37, LEG-40, LEG-44, LEG-46, LEG-60 and LEG-65.
The narrowed Linear project scope supersedes the earlier full-coverage analytics and rollout proposals.

## Configuration

| Setting | Behavior |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Existing Sentry error destination. Blank disables this SDK sink. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Local trace budget from `0` to `1`; default `0`. Invalid input warns and disables tracing. Incoming sampling flags cannot increase it. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional `development`, `test`, `staging` or `production` label; otherwise the runtime environment is used. |
| `SENTRY_RELEASE` | Deployment release identity used to correlate code and errors. |
| Existing Langfuse settings | Preserve the existing independently configured Langfuse observation policy. |

Public settings require a browser rebuild, and Node configuration changes require a process restart. Do not change
production collection or spend as part of debugging without approval. The existing approved nonproduction smoke test
is limited to 100 synthetic events/observations, with no real customer data or paid model calls.

Logs, application metrics, product-usage tracking and Session Replay remain off. There is no consent/analytics identity
subsystem, persistent offline queue or new telemetry service. Clearing the Sentry DSN disables that sink without
disabling Langfuse; setting trace sampling to `0` leaves configured errors available.

## Find the failure

Start in the existing [Sentry issue view](https://sentry.io/organizations/legislation/issues/). Useful filters are:

- `operation:chat_transport` for browser transport errors.
- `operation:chat_stream` or `operation:chat_prompt` for server conversation failures.
- `operation:tool_call` for normalized tool failures.
- `operation:http_api` for unexpected API failures.
- `request_id:<uuid>`, `browser_request_id:<uuid>` or `run_id:<uuid>` for a known diagnostic reference.
- `environment:test release:<release>` to isolate an approved synthetic check.

Request/run references are validated searchable error tags as well as correlation context. The public HTTP
`x-correlation-id` is a separate application contract, not a trusted telemetry identity.
The response `x-rostra-request-id` is the server's opaque request ID. Assistant metadata and the local conversation
export carry the structured correlation object; never upload the export, its messages or access keys to Sentry.

Inspect the error's route/operation, source location, normalized category/stage and recent safe breadcrumbs.
Generated browser/server chunk locations retain line/column and debug IDs without machine paths or source text.
Source-level mapping depends on source maps already available for that release; a generated location alone is not
proof that source-map upload or mapping succeeded.

## Follow a slow or incomplete run

When diagnostic traces are explicitly enabled, open the event's trace or use the existing trace explorer. Inspect:

- The shared HTTP span: canonical route, method, status, duration and outcome. A returned streaming response ends
  the request span; HTTP 200 is acceptance, not completed research.
- The separately timed `legislative-research-conversation` span: request/run references and the existing composed
  response outcome. A parent request trace reference links the detached work.
- Tool invocation spans: safe tool name, outcome, failure stage and available canonical duration/count/size data.
  Existing AI SDK tool spans are reused; a tool span is created only when that integration does not supply one.
- Native fetch/PostgreSQL and existing analytics spans for observable dependency work. SQL, request bodies, URLs and
  arguments are not retained by Sentry. Live database coverage depends on the installed instrumentation and workload.

Copy `langfuse_trace_id` from the correlation context and open that trace in the existing Langfuse project.
Use its existing model/provider, timing, token and reported-cost observations. Do not infer missing usage or allocate
an entire model call's cost to every tool. The two vendors' trace IDs are read separately, not assumed interchangeable.

The browser attempt span records request acknowledgement and its observed terminal outcome. `firstContentMs` is
recorded only when React observes substantive content while streaming; fast, unobserved or interrupted cases stay
absent. It is not time-to-first-network-token. Server `firstModelTextMs` measures the raw model-text observation, not
the composed answer becoming visible. No per-token logs or animation-performance accounting are added.

Stop is a browser observation, not proof of server cancellation. Completed results remain completed after a late
disconnect; missing terminal evidence remains unknown. Explicit retries receive new attempt IDs linked to the prior
attempt, without inventing dependency retry counts.

## When telemetry itself is unavailable

Sentry uses its native bounded transport (32 pending envelopes), rate-limit handling and drop reports. Node/browser
emit at most ten local delivery-loss warnings per client; rejected payloads are not printed. Edge retains its native
transport and drop reports. There is no claim that an unavailable vendor can report its own outage.

Post-response/process flush is bounded (Node defaults to five seconds), outside the user-response critical path.
Do not repeatedly flush in request/tool handlers. A flush result is not proof of vendor ingestion: confirm the
synthetic event or observation in the vendor before recording delivery acceptance.

## Verified synthetic lookup

The September 19, 2026 nonproduction smoke used release `telemetry-debug-smoke-20260919`, synthetic content and no
model calls. The [Sentry research trace](https://legislation.sentry.io/explore/traces/trace/44a7dde4af98b8f87ccd1f2fa3423ce0)
and matching [Langfuse observation](https://us.cloud.langfuse.com/project/cmsw50z9p00dfad0i5wkf01jy/traces/44a7dde4af98b8f87ccd1f2fa3423ce0)
were retrieved from the vendors. Their matching IDs in this sample do not imply that IDs are always interchangeable.

Sentry's project-level IP-storage prevention is enabled, and the SDK projection retains an explicit null-IP opt-out.
Sentry still attached coarse provider-derived geography during the check; this is a documented vendor-enrichment
limitation, not application-emitted address data or a claim of anonymous telemetry. Existing records are not
retroactively changed by these controls.

## Focused acceptance

Reuse the existing correlation/privacy/runtime tests. Verify representative success, failure, slow-tool, cancellation
and incomplete outcomes, an approved safe vendor delivery, disabled/offline behavior, and the changed desktop/mobile
keyboard workflows. Run the repository's required verification for the coherent change. No retention funnels,
critical-path benchmark campaign, custom dashboard application or percentage-cohort rollout is required.
