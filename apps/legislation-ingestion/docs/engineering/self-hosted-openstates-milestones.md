# Self-hosted Open States scraper implementation milestones

## Status and purpose

Status: staged implementation with bounded pilot evidence. The [runtime build](../operations/openstates-runtime-build.md) and
[rollout requirements/results](../operations/openstates-rollout-checklist.md) record what exists and what remains unverified.
This document retains the nationwide target and exit gates, not a claim that all work is unstarted or all states are live.
The current [onboarding queue](../operations/openstates-jurisdiction-onboarding.md) supersedes original rollout timing:
no fixed seven-day per-state wait, and no new state before NC/Alaska content/search acceptance. Historical effort
estimates below are planning context, not current delivery commitments or authorization to skip those gates.
It is the delivery plan for
[ADR-011](../../../legislation-web/docs/engineering/architecture-decisions.md#adr-011-operational-consequences). It makes self-hosted Open States extraction the
recurring state-freshness path while keeping retained session JSON archives as the historical rebuild source. It does
not activate schedules, change production data, or make the Open States API a fallback.

This plan supplements the [Trigger.dev synchronization orchestration design](trigger-orchestration-design.md), the
[coverage policy](coverage-policy.md), [data synchronization catalog](data-sync-catalog.md), and
[observability contract](../operations/development.md#observability). The orchestration design remains authoritative for schedule identity,
leases, retries, checkpoints, and non-Open-States capacity.

## Outcome and non-goals

At completion, each of the 52 supported jurisdictions has active recurring scraper schedules for every supported lane:
bills and their children every 30 minutes, events every two hours, and people and committee snapshots daily. Each run
retains inspectable raw source output, validates it before canonical writes, and advances a checkpoint only after a
complete promotion. A failed, incomplete, or discrepant run leaves the prior canonical state and checkpoint intact.

This effort does not:

- host the Open States public API, website, PostgreSQL schema, Redis, or upstream import service;
- replace session JSON archives as the source of historical state rebuilds;
- infer unsupported source data or an empty collection from a scraper failure; or
- call the Open States API when a scraper is unavailable, slow, or failing.

## Target architecture

~~~text
Trigger.dev schedule or bounded manual invocation
  -> TypeScript schedule dispatcher
  -> jurisdiction and domain lease, queue, checkpoint, and idempotency key
  -> Python scraper adapter, pinned Open States upstream revision
  -> immutable raw JSON and run manifest in Azure Blob Storage
  -> structural and semantic validation in TypeScript
  -> staging normalization and reconciliation report
  -> one canonical database promotion transaction
  -> checkpoint advance, change events, and cache publication
~~~

The TypeScript application owns the product boundary: task payload validation, schedules, queues, leases, checkpoints,
artifact naming, canonical normalization, database transactions, reconciliation, and change events. The Python layer
only executes upstream extraction and writes Open Civic Data-shaped JSON to a temporary data directory. It never connects
to the legislation database and never runs Open States' upstream import step.

### Execution contract

Every scraper attempt has an immutable run manifest. Its minimum fields are:

| Field | Requirement |
| --- | --- |
| `run_id`, Trigger run ID, correlation ID | Connects Trigger, application logs, artifacts, and the canonical ingestion run. |
| Jurisdiction and domain | One supported jurisdiction and exactly one `bills`, `events`, or `entities` lane. |
| Requested window and session set | Explicit rather than inferred from the current date; preserves the replay boundary. |
| Upstream source revision | Full immutable `openstates-scrapers` commit SHA and dependency-lock digest. |
| Command and sanitized environment names | Records the adapter invocation without secrets, values, headers, or source bodies in logs. |
| Source and normalized counts | Counts by object type, session, and terminal validation result. |
| Artifact and cache paths | Versioned Blob paths, checksums, byte counts, and cache revision. |
| Checkpoint before and after | The after value is populated only on successful canonical promotion. |
| Result | `promoted`, `no_change`, `failed`, `rejected`, or `overlap_skipped`, with a safe error class. |

The adapter writes output only to a per-run temporary directory. The application archives it before parsing and validates
the manifest, file allowlist, JSON syntax, object envelopes, jurisdiction/session ownership, stable source identifiers,
and required canonical bill fields. Normalization writes a staging set first. Reconciliation must complete before one
transaction promotes the staging set and advances the lane checkpoint. Raw artifacts remain available for diagnosis even
when validation rejects a run.

### Source lanes

| Lane | Primary self-hosted source | Output and update model | Promotion rule |
| --- | --- | --- | --- |
| Bills, actions, votes, versions, documents, sponsors, and relations | Pinned [`openstates/openstates-scrapers`](https://github.com/openstates/openstates-scrapers) bill and vote implementations, invoked with `--scrape` and a run-local data directory. Some upstream bill scrapers emit votes as bill children; separate vote commands are used only where the jurisdiction implementation requires them. | A bounded current-session scrape plus configured overlap/replay set. It must not claim API-style `updated_since` semantics unless a specific scraper proves them. | Validate every emitted object, then upsert the complete staged batch. A partial scrape is a failed run. |
| Events, agendas, event documents, and participants | Pinned upstream event scraper where one exists. An unsupported or broken state event scraper is a classified coverage gap, not an empty event window. | Reconcile the configured rolling window. Preserve records outside the window and never delete solely because a response omitted them. | Promote only after every expected source file and window validation succeeds. |
| State people, terms, committees, and memberships | Pinned [`openstates/people`](https://github.com/openstates/people) commit for curated people and committee YAML, supplemented by pinned `scrapers_next` people or committee implementations only where the repository lacks the required current data. | Full jurisdiction snapshot once daily. OpenStates is the sole approved state committee-data source; the people repository is CC0 and includes current legislators and committee data. | Replace the lane snapshot atomically only after all expected jurisdiction files parse, validate, and reconcile. |

The source lane is recorded per object and per run. A primary-lane gap is visible in coverage reports; it is not silently
filled by the Open States API or a different undocumented provider.

### Trigger.dev Python build boundary

Use Trigger.dev's official
[`pythonExtension`](https://trigger.dev/docs/config/extensions/pythonExtension) to package the adapter scripts,
requirements lock, and only the pinned upstream source needed by the execution image. The extension supports copying
Python scripts, installing a requirements file during production builds, and invoking a script from a TypeScript task.

The build must:

1. fetch or vendor one exact upstream Git commit through a reproducible build input;
2. retain the commit SHA, requirements lock digest, and base-image digest in the deployed artifact manifest;
3. install no unpinned Python dependency and perform no network clone at task runtime;
4. run a thin adapter that accepts only the validated task contract and returns a small JSON result to TypeScript;
5. use a temporary writable work directory for output and cache restoration, then remove it after raw artifacts and
   diagnostics have been uploaded; and
6. fail deployment if the adapter cannot load the requested jurisdiction/domain before any schedule is activated.

The upstream scraper repository is GPL-3.0. Keep its source, build input, notices, and any modifications in a distinct
Python distribution boundary with its corresponding-source obligations. Do not copy GPL scraper modules into the
TypeScript application. Separation is an operational boundary, not a claim that license obligations disappear; legal
review must approve the distribution, modification, and source-offer process before production activation. The curated
people repository is CC0, but its provenance and pinned commit are still retained.

### Azure artifacts and scraper cache

The `state-sources` Blob container is the durable audit store. Blob paths are append-only and include provider, upstream
revision, jurisdiction, domain, run ID, and object name. Each successful or rejected attempt retains:

- compressed raw scraper JSON and any source index required to read it;
- a normalized manifest with checksums, counts, parser version, validation result, and safe failure summary;
- reconciliation and discrepancy reports; and
- a cache provenance record that says whether a cache was restored, regenerated, or omitted.

The reusable scraper cache is separate from raw evidence. It is namespaced by scraper revision, jurisdiction, domain,
and session, encrypted in Blob Storage, and restored only after checksum and compatibility checks. Cache corruption,
expiry, or absence causes a clean scrape; it never causes reuse of prior source data as if it were fresh. Publish a new
cache only after a successful source validation and canonical promotion. Do not place credentials, cookies, auth headers,
or raw document bodies in cache manifests or task logs.

### Queues, non-overlap, and publisher protection

The canonical synchronization identity remains:

~~~text
<environment>:openstates-scraper:<domain>:<jurisdiction>
~~~

The identity supplies the Trigger deduplication key, PostgreSQL renewable lease, checkpoint stream, run tags, and
artifact prefix. One lease covers all work for that jurisdiction and domain, including manual replay; a lease miss exits
as `overlap_skipped` before a source request. Trigger queues cap aggregate work and do not replace the database lease.

Start with a global scraper queue limit of three and a per-jurisdiction/domain queue limit of one. Add publisher-class
or jurisdiction-specific concurrency and request-rate limits when a scraper contacts shared hosts. Scraper-side throttle
settings remain enabled by default. `--fastmode` is prohibited for scheduled production execution unless a source has a
documented, measured allowance and a jurisdiction override approved through the rollout gate.

Retries use the existing provider-aware error classification and exponential backoff. A retry resumes only from the last
committed scraper checkpoint; it cannot promote an incomplete previous output or run beside it. A run that exceeds its
cadence does not overlap the next scheduled run.

### Credentials and special runtimes

Credentialed and special-runtime jurisdictions are deliberately outside the ordinary-state critical path:

| Case | Required treatment | Promotion constraint |
| --- | --- | --- |
| New York | Request and store `NEW_YORK_API_KEY` as a production secret; use a distinct development credential for tests. | No production schedule until a secret-rotation and expired-key drill succeeds. |
| Indiana | Store `INDIANA_API_KEY` and required `USER_AGENT` as runtime secrets/configuration. | Verify provider terms, allowed request rate, and 401/429 classification before activation. |
| Virginia | Store `VIRGINIA_FTP_USER` and `VIRGINIA_FTP_PASSWORD` only in runtime secrets. | Verify encrypted transport, least privilege, and credential rotation before activation. |
| District of Columbia | Store `DC_API_KEY` as a runtime secret. | Verify registration, production key ownership, and retry behavior before activation. |
| California | Isolate a dedicated MySQL-dump download and scrape runtime. Upstream's California process requires a MySQL dump and a running MySQL instance; do not add MySQL to ordinary scraper workers. | Ship, test, observe, and approve the California path independently. It does not block ordinary-state rollout or use the API as a substitute. |

State-specific requirements can change, so the operator verifies them against the upstream
[state-specific scraper documentation](https://docs.openstates.org/contributing/state-specific/) before a credentialed
or special-runtime state enters a rollout cohort.

## Milestones

Estimates are engineering elapsed time for a small delivery team after dependencies are available. They exclude time
waiting for state credentials and include the required observation periods. A failed gate returns to the named rollback
state; it does not advance the next cohort.

### M0: source inventory, licensing, and capability matrix

Estimate: 2 to 3 working days.

Tasks:

- Pin candidate commits for `openstates-scrapers` and `openstates/people`; record license, source URL, commit SHA,
  dependency lock, supported domains, expected command, and special runtime per jurisdiction.
- Run a read-only capability probe for bills, votes, events, people, committees, and memberships. Capture missing
  implementations, runtime failures, historical-session behavior, and source hosts.
- Classify every jurisdiction as ordinary, credentialed, California-special, or blocked with a specific owner and
  next action.
- Obtain legal approval for the GPL distribution boundary and prepare the source and notice publication procedure.

Deliverables: signed source-capability matrix, pinned-source manifest, license notice/source-offer procedure, and a
ranked rollout cohort proposal.

Acceptance gate: every one of 52 jurisdictions and all three lanes has a recorded status; no unknown requirement is
hidden in a generic backlog; legal approval covers the intended deployment artifact.

Rollback: no runtime or schedule changes exist. Reject a source revision by changing the proposed manifest and rerun
the probe.

### M1: reproducible Python execution foundation

Estimate: 3 to 5 working days.

Tasks:

- Add the Trigger Python extension, pinned requirements, adapter scripts, exact upstream build input, and deployment
  provenance capture.
- Implement a strict TypeScript-to-Python execution contract with validated argv only. Pass secrets through the runtime
  environment, never argv, Trigger payloads, manifests, or logs.
- Prove adapter startup, a successful normal-state fixture run, a missing-command failure, safe stderr capture, timeout
  classification, and temporary-directory cleanup.
- Add automated build tests that fail if a mutable revision, unpinned dependency, or forbidden upstream import mode is
  introduced.

Deliverables: reproducible Trigger build, adapter contract fixtures, source provenance manifest, and deployment
validation checklist.

Acceptance gate: two clean builds produce the same resolved upstream and dependency identifiers; the adapter runs only
`--scrape` extraction and has no legislation database connection configuration.

Rollback: deploy the preceding Trigger image and keep all scraper schedules disabled. Existing archive and federal
schedules remain unaffected.

### M2: raw artifacts, cache, validation, and atomic promotion

Estimate: 4 to 6 working days.

Tasks:

- Create the `state-sources` artifact writer, immutable manifest format, checksums, retention policy, and restricted
  operator access path.
- Add cache restore/publish discipline, compatibility checks, cache-size limits, and cache-miss telemetry.
- Implement structural and semantic validators, staging records, source-object ownership checks, required bill checks,
  discrepancy report generation, and one transaction for promotion plus checkpoint advance.
- Exercise malformed JSON, foreign-jurisdiction objects, missing required bill fields, a truncated output directory,
  and a database failure after archive upload.

Deliverables: artifact schema, validation fixtures, staging/promotion contract, and operator instructions for locating
one run's evidence.

Acceptance gate: each failure case preserves the prior canonical records and checkpoint while retaining a rejected raw
artifact and a safe diagnostic manifest. A successful case advances both canonical data and checkpoint exactly once.

Rollback: disable scraper promotion for the affected lane; retain artifacts and replay a validated prior raw run only by
an explicit manual invocation. Never restore the Open States API schedule.

### M3: lane implementations and comparison harness

Estimate: 5 to 8 working days.

Tasks:

- Implement bills/votes, events, and people/committees adapters and normalizers against the source-lane table.
- Implement the state committee lane only after the self-hosted scraper runtime is available. Consume pinned OpenStates
  scraper or people-repository output as a complete jurisdiction snapshot, and reconcile each return after an absence as
  a new membership tenure rather than reactivating an old tenure. OpenStates remains the only approved state committee
  source; adding another source requires explicit product approval.
- Add a deterministic comparison harness that contrasts a scraper run with retained session archives and the frozen
  pre-cutover API snapshot. It reports counts and object-level differences for bills, actions, votes, documents,
  people, committees, memberships, and events.
- Add explicit classifications for expected source lag, known source omission, normalizer defect, upstream scraper
  defect, and unexplained discrepancy. Only the last three block promotion.
- Add per-lane replay inputs and fixtures from one ordinary jurisdiction.

Deliverables: three lane adapters, normalizer fixtures, comparison report, discrepancy taxonomy, and coverage-report
integration.

Acceptance gate: the ordinary-jurisdiction comparison is reproducible from retained artifacts; all unclassified
differences block activation; an unsupported lane is visible as a coverage gap rather than passing as empty.

Rollback: set the lane to validation-only, preserve its raw artifacts, and fix source/normalizer defects before another
comparison. Do not enable a partial lane merely because bills passed.

### M4: operational controls and one-jurisdiction canary

Estimate: re-estimate from implementation and acceptance results; no mandatory observation delay.

Tasks:

- Wire scraper identities into the schedule dispatcher, three global queues, jurisdiction/domain leases, checkpoints,
  manual replay, retry policy, and publisher-aware limits.
- Add dashboards and alerts described below, then conduct a failed-run, lease-miss, cache-miss, artifact-access, and
  checkpoint-replay drill.
- Activate North Carolina as the initial ordinary-state canary: bills at 30 minutes, events at two hours when supported,
  and entities daily. Compare every run during the evidence-based observation.
- Freeze and document the per-state activation checklist, healthy baseline, and rollback action before adding another
  state.

Deliverables: canary schedules, alert dashboard, acceptance evidence package, runbook drill records, and an approved
cohort checklist.

Acceptance gate: 99% or more of due canary runs complete within their cadence plus one scheduled interval; no unclassified
completeness discrepancy exists; no overlapping source requests occur; checkpoint age remains within two cadences; and
the on-call can recover a deliberately failed run without API fallback.

Rollback: deactivate only the canary scraper schedules, leave canonical data and artifacts intact, and diagnose from the
last rejected or failed manifest. Do not reactivate the transitional API schedules.

### M5: 1, 5, and 15 jurisdiction rollout

Estimate: 2 to 3 elapsed weeks, including three cohort acceptance cycles that may overlap only after the preceding gate
passes.

Tasks:

- Complete the one-jurisdiction canary in M4.
- Add four ordinary jurisdictions with diverse legislative sites, source hosts, session calendars, and bill volume. Do
  not include a credentialed or California-special state in this cohort.
- Add ten further ordinary jurisdictions after the five-state cohort passes. Select them from the capability matrix to
  exercise both legacy and `scrapers_next` paths without concentrating requests on one publisher.
- Re-baseline queue use, source latency, discrepancy rates, cache effectiveness, and database promotion duration at each
  cohort boundary.

Deliverables: activation records and acceptance evidence packages for the 1-, 5-, and 15-jurisdiction cohorts; updated
capability matrix; approved per-publisher concurrency limits.

Acceptance gate for each cohort: every active jurisdiction passes the M4 gate; aggregate queue saturation stays below
80% for 30-minute periods; no publisher's 429, timeout, or 5xx rate rises more than 20% over its cohort baseline; and
coverage reports distinguish all expected gaps from failures.

Rollback: remove only the failing jurisdiction/domain from the active cohort, reduce the applicable queue or publisher
limit, retain all evidence, and re-enter it only after a fresh evidence-based observation. Healthy jurisdictions continue.

### M6: credentialed, California, and 52-jurisdiction completion

Estimate: 3 to 5 elapsed weeks after credentials and the California runtime are ready.

Tasks:

- Complete the credential acquisition and rotation drills for New York, Indiana, Virginia, and D.C.; place each in a
  dedicated small cohort so credential failures remain isolated.
- Build and validate California's dedicated dump and MySQL execution path, including dump integrity, storage lifecycle,
  database startup/teardown, timeout behavior, and resource caps.
- Roll the remaining ordinary jurisdictions in bounded cohorts sized from observed queue, database, and publisher
  capacity. Each jurisdiction completes a evidence-based observation.
- Reconcile the schedule inventory, remove all transitional API freshness definitions after their replacements have
  passed soak, and prove no deployed task can call the API for freshness.

Deliverables: active scraper schedule inventory for all 52 jurisdictions, special-state evidence packages, final
coverage report, no-API dependency audit, and a documented upstream maintenance cadence.

Acceptance gate: all 52 supported jurisdictions have every supported lane active or a visible, approved source-gap
classification; no active API freshness schedule or fallback code path remains; 28 consecutive days show no unresolved
critical discrepancy; and the final exit criteria pass.

Rollback: suspend the failed jurisdiction/domain only. Continue archives for history and maintain prior canonical data.
For a source outage, use the stale-data alert and manual replay when the source returns; never reactivate the API path.

## Rollout scorecard

| Stage | Active jurisdictions | Entry requirement | Promotion evidence | Scope of rollback |
| --- | ---: | --- | --- | --- |
| Canary | 1 | M0 through M3 pass; current NC/AK priority applies | Required completeness/freshness/recovery evidence, not a fixed waiting period | That one jurisdiction/domain |
| Cohort A | 5 | Canary and current onboarding priority pass | Measured cohort baseline and no unclassified differences | Failing jurisdiction/domain |
| Cohort B | 15 | Cohort A passes | Publisher, queue, and database limits remain within gate | Failing jurisdiction/domain or publisher limit |
| Completion | 52 | Credential and California paths independently pass | 28-day final evidence and no-API audit | Failing jurisdiction/domain; never nationwide API reactivation |

The active count describes jurisdictions with at least the mandatory bill lane. An event or entity source gap cannot be
concealed by that count: it remains separately reported in coverage and must have an owner, root cause, and review date.

## Observability and alerts

Every run emits the standard observability identifiers plus `upstream_revision`, adapter version, source lane, session
set, queue name, lease outcome, cache outcome, artifact path, manifest checksum, object counts, validator result,
comparison result, checkpoint age, source-host counters, and promotion duration. These values are safe metadata only;
they exclude credentials, headers, cookies, full source payloads, and raw document text.

Operators need these views:

| View or alert | Signal | Action threshold |
| --- | --- | --- |
| Freshness by jurisdiction and lane | Last successful promotion and checkpoint age versus configured cadence | Warn at two cadences; page at four cadences or when a current session is stale. |
| Completeness and discrepancy | Source versus normalized counts and classified object differences | Block rollout for any unclassified material discrepancy; page on a critical-data loss. |
| Queue and lease health | Queue wait, saturation, `overlap_skipped`, duration, and retry count | Investigate sustained saturation above 80% or any unexpected lease overlap. |
| Publisher health | Request count, latency, 401/403/429/5xx, timeout, and cache rate by host | Reduce limits or suspend that source when the cohort gate is breached. |
| Artifact and promotion health | Upload failures, manifest checksum failures, validation rejections, transaction latency, and checkpoint writes | Page when raw evidence cannot be retained or a successful source cannot be promoted. |
| Credential and special runtime health | Secret-missing/expired classification, California dump integrity, MySQL lifecycle, and adapter startup | Page before the next due run; suspend the affected jurisdiction after repeated failures. |

Trigger.dev remains the authority for schedule and run health; Azure Monitor remains the authority for Blob, database,
runtime resource, and alert delivery health. The application joins them through the correlation ID and ingestion run ID.

## Operational runbooks

### Normal activation

1. Confirm the jurisdiction's source capability, credentials, special-runtime requirements, normalizer fixtures, and
   artifact access are current.
2. Run a bounded validation-only scrape and comparison against retained archive and frozen pre-cutover snapshot.
3. Classify every discrepancy, set publisher limits, and capture the expected count and duration baseline.
4. Activate only the jurisdiction's scraper lanes. Confirm the first due runs have a raw manifest, successful
   validation, promotion, checkpoint, and expected schedule identity.
5. Review daily during the evidence-based observation. Promote the cohort only when its evidence package meets the gate.

### Failed, stale, or overlapping run

1. Locate the Trigger run using synchronization identity and correlation ID. Confirm whether it failed, exhausted
   retries, lost its lease, or was correctly `overlap_skipped`.
2. Read the safe error class and manifest. Verify that no checkpoint advanced and no partial canonical promotion occurred.
3. For a transient upstream failure, respect the publisher limit and let the bounded retry run. For a durable defect,
   suspend only the affected jurisdiction/domain and open a source or normalizer repair.
4. When fixed, use a bounded manual replay with the existing identity and confirm the normal promotion evidence.
5. Do not invoke or activate an Open States API fallback.

### Rejected output or discrepancy

1. Verify raw artifact checksum, upstream revision, cache provenance, command, and jurisdiction/session ownership.
2. Reproduce from the retained artifact before rescraping. Classify the result as source lag, source omission,
   normalizer defect, upstream scraper defect, or unexplained discrepancy.
3. Keep the lane validation-only or suspended until the classification and repair are reviewed. A new scrape cannot
   overwrite the rejected artifact.
4. After repair, rerun the comparison and restart the jurisdiction's evidence-based observation.

### Credential or California incident

1. Check secret presence, key age, and safe authentication classification without logging secret values.
2. Rotate or request a replacement through the state owner. Validate in the dedicated development environment first.
3. For California, verify dump integrity and MySQL lifecycle before changing scraper code or raising resource limits.
4. Keep the affected lane suspended until a clean validation-only run and replay succeed; historical archive operations
   and all unrelated jurisdictions continue.

## Final exit criteria

The cutover is complete only when current evidence proves all of the following:

- all 52 supported jurisdictions have active self-hosted bill freshness schedules; every supported event and entity lane
  is active or has an approved, visible source-gap classification;
- every active lane uses a pinned upstream revision, reproducible Python build, raw artifact manifest, schema and
  semantic validation, atomic promotion, renewable lease, checkpoint, and bounded queue;
- raw output and manifests are retained in `state-sources`, cache provenance is available, and a sampled artifact can be
  reproduced into the same canonical outcome;
- retained Open States session archives still rebuild state history independently of freshness scrapers;
- Credentialed states and California have passed their dedicated security, runtime, and operational drills;
- 28 consecutive days of nationwide operation have no unresolved critical freshness or completeness discrepancy, and
  the coverage report identifies every remaining gap explicitly;
- Trigger.dev reconciliation and deployed-task audit show no active Open States API freshness schedule, no API fallback
  path, and no secret or API key required for non-credentialed scraper operation; and
- on-call has completed the activation, failed-run, rejected-output, credential, and source-outage runbooks using
  retained evidence.

## Primary references

- [Open States scraper contributor documentation](https://docs.openstates.org/contributing/scrapers/)
- [Open States state-specific scraper requirements](https://docs.openstates.org/contributing/state-specific/)
- [Open States scraper source and GPL-3.0 license](https://github.com/openstates/openstates-scrapers)
- [Open States people and committee data source, CC0](https://github.com/openstates/people)
- [Trigger.dev Python extension](https://trigger.dev/docs/config/extensions/pythonExtension)
