# Open States rollout requirements

This page defines the reusable acceptance gate for activating or expanding a self-hosted Open States jurisdiction.
It does not record state-by-state execution history. Inspect the current source, database, deployment, and scheduler
before making a coverage claim; track active work and evidence in Linear.

## Scope

A rollout is accepted for an explicit jurisdiction, session set, record-family set, and observation window. Acceptance
of one cohort does not establish nationwide, historical, or recurring coverage. Bills, people, organizations,
memberships, votes, events, documents, and supporting materials are separate capabilities and may have different
accepted ranges.

The [coverage policy](../engineering/coverage-policy.md) defines completeness and unknown-state semantics. The
[jurisdiction onboarding runbook](openstates-jurisdiction-onboarding.md) defines source onboarding. The
[runtime build](openstates-runtime-build.md) defines pinned extraction inputs. The [data synchronization
catalog](../engineering/data-sync-catalog.md) owns scheduled synchronization behavior.

## Data requirements

For each accepted cohort:

- Freeze the jurisdiction, sessions, record families, source revision, parser revision, and observation cutoff.
- Preserve source identifiers, source URLs, retrieval timestamps, and raw artifacts needed to reproduce normalization.
- Reconcile discovered, extracted, normalized, accepted, quarantined, persisted, and removed counts.
- Treat partial pages, unsupported source shapes, missing required relationships, and exhausted continuation as
  incomplete rather than successful empty results.
- Preserve unknown dates, relationships, and coverage as unknown. Do not coerce them to false, zero, or an invented date.
- Keep canonical IDs stable across replay and corrections. Names alone never merge people or organizations.
- Verify document and supporting-material availability separately from parent-record acceptance.
- Record exclusions and quarantine reasons explicitly so the advertised scope cannot silently shrink.

## Operational requirements

- Build extraction inputs from pinned, checksummed sources and verify the prepared tree before packaging.
- Exercise the deployed parser and runtime, not only local imports.
- Use bounded batches, durable checkpoints, idempotent writes, and explicit continuation.
- Verify retry, duplicate dispatch, cancellation, lost-run recovery, and stale-lease handling.
- Respect provider budgets and cooldowns. A throttled or unavailable source is not an empty source.
- Keep recurring schedules disabled until the initial accepted scope is reconciled and downstream consumers are ready.
- Verify that replay updates changed records without duplicating unchanged canonical records.
- Confirm failure telemetry contains correlation and run identifiers without protected source payloads or credentials.

## Acceptance workflow

1. Run source discovery and freeze the intended cohort.
2. Build and verify the extraction runtime from pinned inputs.
3. Execute a bounded extraction and retain its source manifest.
4. Normalize and persist through the production code path.
5. Reconcile every stage count and inspect quarantine samples.
6. Replay the same cohort to prove idempotency and correction behavior.
7. Verify the corresponding W read surfaces and, where applicable, M tools against canonical IDs.
8. Exercise interruption and recovery.
9. Record the accepted scope and exclusions in the target environment.
10. Enable recurring collection only after the same gate passes for the scheduled scope.

Focused tests and a successful run are necessary but not sufficient. Skipped database suites, local fixtures, source
availability, or an HTTP 200 response do not establish rollout acceptance.

## Coverage changes

When a source or parser change affects an accepted cohort:

- Freeze the new source/parser identity.
- Re-run reconciliation and replay checks for the affected partition.
- Compare canonical changes and quarantine movement.
- Revalidate downstream read behavior.
- Update the advertised coverage only after the replacement cohort passes.

Do not preserve dated command transcripts or per-run counters in this page. Operational logs belong with the run;
durable source decisions belong in the relevant source or parser contract.
