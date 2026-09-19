# Browser errors, navigation and Web Vitals

LEG-32 uses the installed Next.js and Sentry packages. It does not enable optional collection or replay.
[Browser options](../../src/services/sentry/browserSentryOptions.ts) retain only audited error handlers, deduplication,
linked-error handling, Next-aware browser tracing and the [privacy boundary](telemetry-privacy.md). Automatic console,
DOM breadcrumbs, session storage trace linking, resource/performance-mark spans and XHR tracing are excluded.

## Navigation and transport

The Next `onRouterTransitionStart` SDK hook remains the navigation owner. Before a page/navigation span starts, its
name becomes a registered route template and its attributes are reduced to static source/navigation categories.
Hard loads, soft transitions and observed history traversal have distinct categories. Trace idle timing is not the
product's meaningful-content readiness measurement; that belongs to feature instrumentation.

Only same-origin relative requests and the anchored current origin are eligible for fetch spans/trace headers.
Edge and browser reuse the same origin validation/escaping helper. Lookalike origins, credential-bearing URLs and
third-party URLs containing an embedded allowed URL do not match. Cross-origin propagation and redirect behavior
remain part of the separate cross-runtime acceptance contract.
For a production-built local preview, the observed browser origin may use loopback HTTP; this exception does not
permit external HTTP origins and does not relax the edge/server configured-target policy.
An ineligible browser origin disables propagation with a fixed warning rather than breaking application hydration.

Diagnostic tracing is enabled at 100% whenever a Sentry DSN is configured, using the shared runtime sampler.
There is no application sampling-rate setting. `NEXT_PUBLIC_SENTRY_ENVIRONMENT` can distinguish a test/staging
build from production traffic. Public settings are build-time inputs. Metrics/logs/replay remain off; see the
[debugging guide](../operations/telemetry-debugging.md) for configuration and collection restrictions.

The existing SDK fetch transport retains a maximum of 32 pending envelopes and reports at most ten local delivery-loss
warnings per client. It does not create a custom queue or retry loop. Only manually authored, privacy-projected
diagnostic breadcrumbs are retained (maximum 20), attached to errors rather than emitted as usage analytics.

## Native Web Vitals

[BrowserWebVitals](../../src/components/telemetry/BrowserWebVitals.tsx) is a nonvisual root client boundary using
Next's public `useReportWebVitals` hook with one module-stable callback. It does not remount on every route change.
The [reporter](../../src/services/sentry/browserWebVitals.ts) accepts native LCP, INP and CLS and ignores unsupported
metric families; absent measurements remain absent.

Next's default native callbacks are used rather than a per-keystroke/per-scroll observer or `reportAllChanges`.
Callbacks in one microtask are coalesced to the latest value, then each metric name is finalized at its first native
report boundary for that document lifecycle. Subsequent updates do not create additional percentile observations.
This is an explicitly defined reporting cutoff, not a promise to rewrite the entire lifetime CLS/INP after a tab is
hidden and shown repeatedly.

Finalization is keyed by native page lifecycle and metric name, not only the library-generated ID: duplicate observer
IDs from Strict Mode/remounts cannot double-count one document. A persisted `pageshow` begins a new BFCache lifecycle
and rejects late reports from the preceding lifecycle. Ordinary pageshow and SPA navigation do not reset native
vitals. The route is captured at document entry/restore, never retroactively replaced by a later SPA location.

Measurements retain only metric value, approved units, canonical route, coarse viewport class and
`hard`/`back_forward` navigation. Native IDs, performance entries, DOM references, attribution text and URLs do not
leave the reporter. Pending/finalized collections contain at most the three supported metric names.

Both receive and flush check the SDK metric switch; disabled or withdrawn collection clears pending values without
replaying them later. A malformed measurement or failed sink emits a bounded local diagnostic without payload text.
SDK metadata is filtered again and checked against the final wire budget before transport.

## Verification boundary

Co-located tests cover integration selection, route/privacy projection, origin matching, first-report finalization,
duplicate/remounted observers, BFCache rollover, disabled/revoked collection, invalid values, failure reporting and
the stable nonvisual hook. Error envelopes retain only approved debug IDs, actual Next/Turbopack hashed chunk filenames and numeric
positions as defined by the privacy tests.

Local browser acceptance checks that desktop/mobile navigation and keyboard interactions remain intact, optional
signals remain off and browser errors can reach an in-memory/local test collector safely. No external collector is
required for this acceptance. Private source maps must not become public application assets; mapping a deployed
release against uploaded maps and enabling a real canary remain explicit release-acceptance work.
