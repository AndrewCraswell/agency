# Prototype telemetry acceptance

LEG-65 verifies the [narrowed debugging scope](../engineering/telemetry-spec.md).
Reuse existing evidence and run focused checks for changed executable behavior before the required final repository
verification. There is no separate analytics coverage audit, retention/funnel dataset, formal SLO program, extensive
benchmark campaign or percentage-cohort production pilot.

## Practical checklist

1. A representative request failure has a safe operation/route, useful error location and opaque correlation.
2. A slow request/research/tool can be investigated through ordinary spans and the existing Langfuse observation.
3. Conversation completion, partial/unknown response, explicit Stop and retry are not conflated.
4. Private content and credentials do not survive Sentry projection. Request scopes remain isolated, source URLs do
   not receive trace headers, and only permitted static names/attributes are exported.
5. Disabled collection, blocked transport and SDK rate-limit handling do not break or stall the product. Queue/flush
   bounds use SDK controls, and warnings never print rejected payloads.
6. Changed browser workflows work at desktop/mobile sizes with keyboard/focus behavior intact.
7. The coherent implementation passes `pnpm verify`, and actual limitations are recorded rather than hidden.

The existing runtime, privacy and correlation tests already cover much of this. Add regressions at changed owners
and fill real gaps, not a second parallel test framework. Tests of application behavior and generated wire data are
appropriate; do not write validators for this checklist or other prose.

## Approved delivery smoke

Use the previously approved nonproduction allowance: at most 100 synthetic events/observations, no real customer data
and no paid model calls. Isolate the test with a release and `test` environment label. Session Replay stays off.
Do not enable production collection, buy/upgrade a plan or permit overages.

Inspect the actual received error/trace and available Langfuse observation. A flush success means local delivery work
finished, not that the vendor indexed or retained a record. Record event/trace IDs and the observed environment,
privacy fields and lookup result. Source-map availability must be verified separately from a generated file location.

If vendor access, plan controls or credentials prevent the smoke test, leave that acceptance item open with the exact
blocker. Do not mark ingestion or source mapping accepted from an in-memory fixture.

## Operator workflow and rollback

Use [Debugging with Sentry and Langfuse](telemetry-debugging.md) for configuration, queries and interpretation.
The existing SDK views and concise saved-filter instructions are sufficient for LEG-60; no custom UI is required.
Set trace sampling to zero to stop diagnostic traces, or clear the Sentry DSN to disable that sink. Browser public
settings require a rebuild; Node configuration changes require a restart. Langfuse remains independently configured.

The [approved region, retention, access and spending limits](../engineering/telemetry-spec.md#approved-policy-limits)
still apply. No new collection permission is implied by successful tests or by closing a planning issue.
