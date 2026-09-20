# Trigger.dev synchronization orchestration

## Scope

Regulatory work is specified in [backfills and workflows](../regulations/acquisition-workflows.md), with its own bounded
admission and source budgets. Preparation/copy/rights workers exist locally; that does not add active source schedules
to this inventory. Activation follows the capability gates in the
[regulatory implementation contract](../regulations/implementation.md).

Trigger.dev is the only orchestration system for recurring synchronization and bounded historical backfills. TypeScript
workers own provider calls, normalization, transactions, checkpoints, idempotency, leases, and failure classification.
Trigger.dev owns schedules, queue concurrency, retries, run visibility, and manual task invocation.

The canonical source, resource, field, ingestion-status, cadence, and worker mapping lives in the
[legislative data synchronization catalog](data-sync-catalog.md). This document covers execution mechanics only.

## Configuration

`trigger.config.ts` loads tasks from `src/trigger/tasks`. Development uses the checked-in Trigger.dev project ID. The
runtime requires its Railway database URL, provider credentials, Azure Blob credentials, OpenRouter settings, and
Langfuse settings in the Trigger.dev environment. Secrets are never included in task payloads or schedule definitions.

The schedule reconciler is read-only unless `--apply` is present. `--activate` requires `--apply` and activates the
Congress.gov and GovInfo schedules. The 156 Open States API schedules are transitional inventory and remain inactive.
The production state-freshness lane will use self-hosted jurisdiction scrapers because the 250-request daily API quota
cannot support the configured cadence. A missing, blank, or `false` Open States gate continues to fail closed while the
transitional definitions are removed or replaced.

```powershell
pnpm --filter legislation-ingestion tool trigger/reconcile-trigger-schedules --environment development
pnpm --filter legislation-ingestion tool trigger/reconcile-trigger-schedules --environment development --apply
pnpm --filter legislation-ingestion tool trigger/reconcile-trigger-schedules --environment development --apply --activate
```

## Synchronization identity

Every scheduled scope has a canonical identity:

```text
<environment>:<provider>:<domain>:<scope>
```

The identity determines the external schedule ID, deduplication key, database lease scope, checkpoint stream, and log
attributes. Payloads are strict and bounded; workers reject unknown providers, domains, jurisdictions, Congresses, and
backfill ranges.

## Task topology

All recurring schedules target `schedule-dispatcher`. Open States and GovInfo dispatch one domain worker with the
canonical deduplication key. The hourly Congress bills entry is the only active Congress ingress and dispatches one
`congress-wave-coordinator` run. The other five managed Congress entries are retained inactive so reconciliation can
deactivate them without deleting remote schedules. The dispatcher never dispatches an independent Congress domain worker.

| Provider | Worker tasks | Queue limit |
| --- | --- | ---: |
| Open States | `openstates-bills-sync`, `openstates-entities-sync`, `openstates-events-sync` | 3 |
| Congress.gov | `congress-wave-coordinator`, `congress-wave-child` | 1 coordinator, 15 children |
| GovInfo | `govinfo-bill-status-sync` | 1 |
| Backfill | `legislation-backfill` | 1 |
| Derived documents | `backfill-derived-shard-controller`, `backfill-derived-corpus` | 64 controllers, 64 workers |
| OCR | `ocr-document-worker` | 12 |

The singleton Congress coordinator owns an explicitly declared wave. It grants at most 19,500 HTTP attempts from a
window that begins when that coordinator starts, assigns disjoint provider slots across at most 15 children, and
collects actual usage before allocating returned capacity. A 429 stops further allocation and uses `wait.until` for the
provider Retry-After value, or one hour when the provider omits it. The local allowance does not refill at a UTC-hour
boundary because Congress.gov reset headers are not reliable; it refills only one hour after the coordinator's own
window began. Waitpoints release active worker capacity, so a multi-hour history wave remains safe under the six-hour
task duration policy.

Each Congress child has a two-connection PostgreSQL pool: one operation connection and one for lease renewal while a
long transaction is in progress. The 15-child queue limit therefore caps a full wave batch at 30 database connections.
The aggregate provider pacing ceiling is 15 request starts per second, so the 19,500-attempt allowance drains in about
21 minutes 40 seconds when the workload is sustained.

Every recurring and historical Congress caller routes through this coordinator. The retired direct `congress-*-sync`
tasks are not registered. Production has one active hourly coordinator schedule; the five inactive Congress schedule
entries remain only so reconciliation can disable remote definitions created by older deployments.

The derived backfill queue has a concurrency limit of 64. Bill-document drains
use 64 deterministic jurisdiction lanes: supported jurisdictions have stable
dedicated lanes and unknown identifiers are confined to fallback lanes. Large
jurisdictions can replace one lane with two to eight disjoint document-ID
partitions, but only after the original lane is terminal and its lease has been
released. Publisher download leases remain global across lanes, partitions,
and deployment versions, so more Trigger workers do not bypass a website's host
limit. Embedding recreation now has a separate sequential 128-shard coordinator and pooled capacity gate; do not reuse
the original 16-shard/four-product layout as the current full-pass plan. See the
[embedding contract and rebuild hold](embedding-rollout-plan.md). No new rebuild is authorized here.
Supporting-material history uses 24 deterministic ID
shards; each 25-row child has two database connections and a renewable
60-minute lease, while publisher traffic remains globally limited. OCR uses a
separate 12-worker queue. Its one-time historical controller has been removed;
new document and material workers invoke the permanent OCR task directly.

Diagnostic tasks are manually invoked and do not create recurring schedules.

## Schedule inventory

The desired development manifest contains 163 schedules:

- 52 Open States bill schedules, every 30 minutes and phase-shifted by jurisdiction;
- 52 Open States entity schedules, daily and staggered in two-minute steps;
- 52 Open States event schedules, every two hours and phase-shifted by jurisdiction;
- one active hourly Congress.gov coordinator ingress plus five inactive managed legacy entries; and
- one daily GovInfo BILLSTATUS schedule.

All cron expressions use UTC. Exact cadences and field coverage are maintained in the
[data synchronization catalog](data-sync-catalog.md#triggerdev-synchronization-registry).

## Concurrency and non-overlap

Non-overlap is enforced at three layers:

1. The schedule deduplication key prevents duplicate dispatch for one identity.
2. Provider queues bound aggregate upstream and database pressure.
3. Renewable PostgreSQL leases prevent duplicate work across scheduled, retried, and manually triggered runs.

A worker that cannot acquire its lease exits without making provider requests. Lease ownership is checked before
renewal and release. A retry resumes from the last committed checkpoint; it does not create a second cursor.

## Checkpoints and update windows

Checkpoints remain in PostgreSQL and are independent of Trigger.dev run history. Each provider route advances its
checkpoint only after the full bounded unit succeeds.

- Open States bills use `updated_since` with overlap and ascending provider timestamps.
- Open States entities replace a jurisdiction snapshot only after every people and committee page succeeds.
- Open States events reconcile a rolling window and do not infer deletion from absence.
- Congress bills use the update-date feed with overlap.
- Other Congress domains use independent offset checkpoints scoped to the configured Congress and, for House votes,
  session.
- GovInfo uses a bounded `lastModified` observation window with replay and opaque pagination.

## Retry behavior

Trigger.dev retries unexpected task failures with bounded exponential backoff. Provider-aware HTTP retry remains in the
application so `Retry-After`, throttling, timeouts, and permanent errors are classified consistently in local, scheduled,
and backfill execution. A partial domain result fails the task and does not advance its terminal checkpoint.

## Historical backfill

`legislation-backfill` accepts an explicit rebuild ID and bounded provider ranges. It reuses the production importers,
canonical IDs, child idempotency keys, checkpoints, and document queues. Historical work is manually initiated; it is
never hidden inside a recurring freshness schedule.

OpenStates history expands the retained manifest into one worker per archive stream and uses a dedicated queue of eight
workers. That avoids a large jurisdiction becoming the rebuild's long tail while keeping each worker to one compressed
archive, decoded payload, and normalized-record set at a time. These workers run on `medium-2x` machines with a
four-hour execution ceiling; a rare OOM is retried once on `large-1x`. Every archive retains its existing stream
checkpoint and PostgreSQL lease, so fan-out cannot overlap a stream or multiply concurrent writes inside a worker.

```powershell
pnpm --filter legislation-ingestion tool trigger/run-trigger-backfill --start-congress 113 --end-congress 119 `
  --manifest-blob <openstates-manifest-blob> --rebuild-id <unique-rebuild-id> --apply
```

Large rebuilds must be split into deterministic ranges and can be resumed from their stored checkpoint. Deleting or
resetting canonical data is a separate operator decision and is never performed by a Trigger.dev task.

### Milestone: expand federal history beyond Congresses 113-119

After the 113-119 cutover corpus passes validation, expand federal history without changing the live freshness lane:

1. Run read-only coverage discovery for every Congress.gov domain and Congress below 113. Persist the provider count,
   collection timestamp, endpoint/domain, and any unsupported or structurally incompatible response in a retained
   coverage manifest.
2. Backfill Congresses 93-112 for bills and their available actions, summaries, subjects, sponsors, relations, and text
   metadata. Use bounded Congress ranges, existing canonical IDs, per-range checkpoints, and the shared Congress queue.
3. Enable older amendments, committee reports, entities, meetings, hearings, and House votes only for Congress/domain
   pairs proven present by the coverage manifest and fixture-validated against the normalizer. Do not infer an empty
   collection from an unsupported endpoint or provider error.
4. Add an explicit Congress rollover task before the 120th Congress begins. It must seed the new Congress scopes,
   preserve prior-Congress checkpoints, and update recurring current-Congress identities without deleting history.
5. Re-run coverage, document/material processing, embeddings, and corpus validation for the expanded range. Expansion
   is complete only when every scheduled unit is terminal, coverage gaps are classified, and no critical validation
   issue remains.

Historical expansion uses manual Trigger tasks and separate rebuild IDs under the shared Congress coordinator. Reserve
capacity for current-Congress freshness; operators activate each range only after the preceding range has
completed and provider-rate telemetry remains within its observed allowance.

### Milestone: replace Open States API freshness with self-hosted scrapers

Preserve Open States session JSON archives as the state rebuild source, but replace every recurring API scope with a
self-hosted scraper scope:

1. Define the scraper execution contract: jurisdiction, resource domain, requested window, scraper revision, retained
   raw-artifact path, counts, and a canonical checkpoint. A run must produce no canonical writes until its output passes
   schema validation.
2. Package the existing Open States scraper implementations and their per-state dependencies for Trigger.dev-compatible
   execution. Store credentials only in runtime secrets and retain raw output in the `state-sources` container.
3. Onboard one jurisdiction at a time. Compare bills, actions, votes, documents, people, committees, and events against
   the retained archive plus the last known API snapshot; classify discrepancies before enabling recurrence.
4. Schedule bills every 30 minutes, events every two hours, and entity snapshots daily using jurisdiction-scoped queues,
   leases, checkpoints, retry policies, and publisher-aware limits. A failed scraper preserves the prior canonical state
   and retries; it does not fall back to the quota-limited API.
5. After a jurisdiction passes the current evidence-based freshness and completeness gate, retire its transitional Open States API
   schedule definitions. Complete the milestone only when all 52 jurisdictions have active scraper schedules, no API
   freshness dependency remains, and coverage validation passes.

## Observability

Every run carries Trigger.dev run/task IDs, the canonical synchronization identity, correlation ID, ingestion-run ID,
checkpoint stream, provider, domain, scope, counts, duration, and safe error classification. Trigger.dev owns schedule
and task health; application logs and Langfuse retain database, MCP, and model observations.

## Security

- Schedule and task payloads contain identifiers and bounded ranges only.
- Provider keys, database credentials, Azure credentials, and model credentials remain environment secrets.
- Logs never include headers, connection strings, source document bodies, or complete provider payloads.
- Production activation is a distinct explicit command and environment.

## Current operational state

The production schedule inventory keeps the hourly Congress coordinator and
daily GovInfo schedule active. The 156 transitional Open States API schedules
remain inactive because the provider's 250-request daily quota cannot support
freshness; they will be replaced jurisdiction by jurisdiction by the
self-hosted scraper milestone. Historical documents and OCR run as manual,
bounded Trigger workflows rather than recurring schedules. Embeddings use
their own explicitly approved product waves after ingestion, OCR, supporting
materials, and cost gates pass. A dry-run reconciliation reports remote drift without changing
Trigger.dev, and production state should still be verified after every applied
schedule reconciliation.

Trigger deployment versions apply to the whole project, not an individual task
type. A controller remains pinned to the deployment on which it started and
creates children from that snapshot. After a behavior change, operators must
retire and relaunch affected long-lived controllers at a verified lease
boundary; deploying new code alone does not upgrade them.
