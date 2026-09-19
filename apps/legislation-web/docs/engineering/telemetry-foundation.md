# Typed telemetry foundation

Local implementation for LEG-30. This provides executable contracts, validation and an injectable emitter; it does
**not** initialize a vendor, attach a UI listener, emit application telemetry automatically or approve collection.
The [collection policy](telemetry-spec.md), consent/publication gates and later runtime/instrumentation tasks remain
in force.

## Contract owners

| Module | Responsibility |
| --- | --- |
| [Fields](../../src/services/sentry/telemetryFields.ts) | Bounded enums/scalars, opaque UUID correlation and normalized runtime context |
| [Events](../../src/services/sentry/telemetryEvents.ts) | Static names, per-event strict attributes, origin, phase and local transition identity |
| [Metrics](../../src/services/sentry/telemetryMetrics.ts) | Static names, type/unit/owner and per-metric dimension schemas |
| [Validation](../../src/services/sentry/telemetryContracts.ts) | Complete event/metric preparation, outcome guards and UTF-8 wire budgets |
| [Emitter](../../src/services/sentry/telemetryEmitter.ts) | Injected sinks, explicit permission checks, bounded local deduplication/cardinality and safe diagnostics |
| [Routes](../../src/services/sentry/telemetryRoutes.ts) | Finite Next route templates, static-before-dynamic matching and bounded unmatched groups |
| [Coverage](../../src/services/sentry/telemetryCoverage.ts) | Route-level owner, privacy class, query descriptor, expected signals and pending implementation acceptance |

`TelemetryEventInput` and `TelemetryMetricInput` are discriminated unions inferred from the registries. Unsupported
attributes/names fail at the TypeScript boundary and are checked again at runtime. Attributes cannot contain nested
content or arbitrary metadata. Unknown measurements are omitted; failed/unknown searches cannot supply an invented
zero-result count. Tool error measurements require a normalized failure code.

Each event has an operation UUID and positive attempt, including navigation/mount/draft operations before a research
turn exists. Producers must retain that identity at the owning lifecycle boundary, not allocate a fresh operation
inside a render. Provider call identifiers need bounded opaque UUID mapping before entering this contract; access keys
are never correlation identifiers. Actor identity is not supported by this initial foundation.

## Emission and failure semantics

The factory requires injected event/metric sinks and a local diagnostic callback. Its default permission predicate
disables every category. Enabling metrics does not also enable usage metrics; usage requires separate permission.
No sink is tied to trace sampling. Later consent integration supplies the permission predicate and creates/clears
session-scoped instances as identities change.

`enqueued` means the local sink was invoked, not vendor ingestion or business success. Synchronous failures return
`dropped` in production; rejected asynchronous sends report a diagnostic without blocking the caller. The transport
owns delivery retries and must reuse the emitted event ID. Strict mode throws bounded contract errors after recording
the diagnostic; no raw rejected value or sink exception is included.

The emitter rejects reentrant emission from its sinks/diagnostics, reports at most ten local notifications per
signal/reason, and retains aggregate drop counts. A failed diagnostic callback uses a bounded local console warning,
not Sentry reporting. The external delivery adapter must provide its independent monitoring path.

## Bounds and deduplication

- Event attributes: at most 20 application attributes; approved strings at most 128 characters; whole event <=4 KiB.
- Metric record: <2 KiB. The adapter must additionally call `guardWireRecord` on the **final serialized SDK record**,
  including typed attributes, trace/timestamp and SDK metadata, before transport. Measuring only application
  attributes does not establish this bound. No Sentry adapter is wired by this foundation.
- Deduplication: at most 1,024 remembered local transitions. Capacity exhaustion rejects a new transition with a
  diagnostic rather than silently evicting known terminals. Session cleanup releases these identifiers.
- Cardinality: at most 1,000 distinct dimension combinations per metric per UTC day within an emitter; repeated
  combinations continue to work. Session cleanup does not reset this budget. This is a local safety bound, not an
  account-wide distributed quota; cross-process/browser cardinality still needs collection-health reporting.

Once-per-operation keys include event name, operation, attempt, origin and registered milestone/tool/revision fields.
Distinct deliberate repeat actions instead use their event ID. A duplicate returns the first event ID and cannot
overwrite a previously observed completion. The event owner must still prevent historical/remounted UI from allocating
new operation IDs for old activity.

## Verification and remaining integration

Co-located executable tests cover schemas/outcomes, exact encoded thresholds including SDK metadata, default-off
behavior, deduplication/retry identity, cardinality rollover, sink failure and reentrancy. Route tests exercise actual
Next route/page paths through the runtime normalizer, not Markdown tables.

Coverage acceptance stays `pending`: query descriptors are inputs for future saved-query implementation, not existing
Sentry dashboards. All new collection remains unwired until the privacy, runtime, consent and feature tasks install
their respective adapters/producers and complete browser/vendor acceptance.
