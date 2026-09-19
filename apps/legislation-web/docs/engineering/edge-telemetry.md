# Edge telemetry runtime

LEG-36 initializes the supported Next.js edge SDK independently of the
[Node OpenTelemetry design](telemetry-runtime-design.md).

[Edge options](../../src/services/sentry/edgeSentryOptions.ts) no longer skip the edge SDK's provider setup. The edge
SDK owns its context manager, propagator and processor; the application does not import NodeSDK or Langfuse into this
runtime. [Runtime registration](../../src/instrumentation.ts) still imports the edge configuration only from the
`NEXT_RUNTIME=edge` branch.
Startup requires the framework-provided `AsyncLocalStorage` global. Without it the SDK would fall back to synchronous
context; the application now fails explicitly rather than risk cross-request scope contamination.

## Collection and propagation

- Existing configured error reporting remains available through `onRequestError` and the shared
  [Sentry privacy boundary](telemetry-privacy.md).
- The edge sampler defaults to zero and reads the explicitly approved `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
  budget. Incoming flags cannot bypass that decision. Logs, metrics and replay remain disabled.
- Only the audited WinterCG fetch integration and shared privacy integration are installed. Fetch breadcrumbs and
  automatic console/request-data collection are not enabled.
- `LEGISLATION_PUBLIC_API_BASE_URL` supplies the only permitted downstream origin for fetch spans/propagation.
  Missing configuration means no downstream propagation, not an unrestricted fallback. The anchored matcher rejects
  lookalike hosts, embedded redirect URLs and credential-bearing URLs.
- The configured base URL must use HTTPS without credentials, query or fragment. Explicit loopback HTTP is permitted
  outside production for local acceptance. Invalid configuration fails with a fixed, non-sensitive error message.

The SDK's own platform-compatible context implementation may use APIs supported by the edge runtime. This is distinct
from importing the Node telemetry SDK into application edge code.
The edge SDK retains its own transport, with the shared 32-envelope buffer setting and native drop reports.
Unlike Node/browser, this SDK export does not expose a transport factory for the local warning wrapper; no private
SDK import or substitute transport is used. Its drop report cannot independently diagnose a vendor outage.

## Synthetic acceptance

The co-located worker runs `@sentry/nextjs` under its actual `edge-light` export condition in an isolated process.
The Node test host supplies the `AsyncLocalStorage` global that Next's edge runtime normally provides; the application
does not install a Node polyfill.
It asserts `VercelEdgeClient`, denies NodeSDK/Node Sentry/Langfuse imports, and runs two overlapping request scopes.
Each request continues a separate synthetic trace, performs stubbed trusted/untrusted fetches and calls the real
Next.js request-error hook.

Enabled, disabled and unavailable-transport cases verify scope isolation, parent trace identity, safe exported
request errors, restricted outbound headers and preserved application completion. Traces use an explicit test-only
sampler and in-memory transport; no request reaches Sentry or an external dependency.

This is evidence for the installed edge SDK and application configuration, not a claim that a deployed edge endpoint
or provider network has passed acceptance. The [cross-runtime acceptance task](../operations/telemetry-acceptance.md)
retains deployed routing, canary and propagation evidence.
