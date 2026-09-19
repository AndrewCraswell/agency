# Shared Node telemetry owner

LEG-33 replaces separate Sentry/Langfuse startup with one
[Node owner](../../src/services/sentry/nodeTelemetry.ts). The application instrumentation hook and evaluation tools
use the same canonical constructor. The former Langfuse-only NodeSDK initializer and separate Sentry server config
are removed, not retained as alternate paths.

The user approved direct declarations of the already-installed `@sentry/opentelemetry` 10.73.0,
`@opentelemetry/api` 1.9.1 and `@opentelemetry/sdk-trace-base` 2.10.0. The now-unused NodeSDK dependency is removed.
Versions are not upgraded and no additional vendor is introduced.

## Registration and isolation

The owner uses the SDK's supported Sentry context manager, propagator, sampler and span processor with
OpenTelemetry's public `BasicTracerProvider`. This is a deliberate refinement of the earlier NodeSDK sketch:
public global-registration APIs return success/failure, so a conflicting context manager, propagator or provider
can fail explicitly instead of silently leaving a second provider inactive.
The Node-only module uses Next SDK CommonJS-default interop: its `node` package export is CommonJS, and native Node
ESM does not expose every computed re-export as a named export. The context manager comes from the approved
OpenTelemetry package's public `SentryAsyncLocalStorageContextManager` export. Both bundler and native CLI execution
are covered; the merged declaration file alone is not proof of runtime export availability.

Only one process-global owner is permitted. Application registration hashes configuration and mask identity, reuses
the existing handle during identical hot reload and rejects changed configuration until a restart. Incomplete
Langfuse credentials fail with a fixed message; neither credential values nor the configuration digest is logged.
Production-build registration is explicitly skipped.

The Sentry SDK remains the sole ESM-loader-hook owner. Application HTTP instrumentation retains request isolation,
disables body/session/breadcrumb capture and uses explicit first-party propagation targets. No automatic AI content
integration is added. Existing Langfuse AI SDK integration is registered once by the owner.
An ineligible propagation URL disables propagation with a fixed local warning; it does not take down an otherwise
valid application. Built acceptance explicitly clears provider/telemetry credentials so a developer's local `.env`
cannot turn synthetic HTTP tests into vendor traffic or paid model calls.
Explicitly blank optional OpenRouter/Langfuse credentials normalize to absent, consistently with the chat availability
and telemetry initialization guards. This lets the harness override local dotenv values without failing unrelated
HTTP application configuration.

## Sink behavior

The native Sentry sampling decision and original propagation flags are preserved. When Langfuse needs recording and
Sentry declines export, the provider records locally without setting the original sampled bit. Sentry receives only
originally sampled spans; Langfuse receives detached, sink-local sampled snapshots through its own eligibility filter.
Snapshot attributes, events, links and status are detached because Langfuse masks its input in place.

The application sampler remains zero until an approved policy replaces it. Existing configured Langfuse observation
behavior is preserved; this is not permission to expand its collection. Sentry's
[privacy boundary](telemetry-privacy.md) filters its own envelopes independently. Neither sink's raw content is copied
into the other's payload, and the original OpenTelemetry span is not mutated by Langfuse masking.

Without either vendor, registration still supplies coherent request context but exports nothing. With only one vendor,
the other exporter remains inactive. Evaluation callers explicitly provide their existing Langfuse-only configuration,
including their existing masking policy, to the shared owner.

## Lifecycle

Flush and shutdown have a configurable, validated bound (five seconds by default). Shutdown is idempotent and rejects
new flushes. A timeout reports failure; it does not claim ingestion or release ownership while an underlying shutdown
is still pending. Registration is released only once the actual shutdown finishes.

Only registrations successfully acquired by this owner are released on startup failure/shutdown. Vendor flush remains
outside the user-response critical path through the application's existing post-response lifecycle.

## Verification

The isolated worker matrix covers Sentry-only, Langfuse-only, both, recording-only and disabled operation with
in-memory exporters. It checks concurrent scope isolation, parent/child IDs, original sampling flags, error/trace
counts and masking without mutating the source span. Additional cases cover identical/changed registration, foreign
provider rejection, build skipping, incomplete credentials and bounded flush timeout.

Existing conversation and analytics export tests remain the regression contract for Langfuse content semantics.
These tests make no vendor requests or paid model calls. Live ingest, account controls, measured production overhead
and deployment canaries remain separate acceptance work.
