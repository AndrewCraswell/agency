# Historical committee reconciliation

## Scope and decision

The approved reconstruction remains GovInfo-only for federal committee assignments. Existing Congress.gov identities
and terms identify people; they do not supply new committee assignments. Source-detected dates remain distinct from
legal appointment dates. Open States ingestion, webhooks and new data providers are outside this work.

The user requested independent LLM judgment and implementation on 2026-09-08. LLM review is an offline engineering
review step, not an ingestion dependency and not evidence by itself. Production behavior must be deterministic.

## Acceptance rules

| Evidence class | Behavior | Tradeoff |
| --- | --- | --- |
| Exact scoped identity or explicit initial/name form | Match only a unique person with an applicable Congress/chamber term | Prefer an unresolved entry over a competing identity |
| Reviewed printed name or state error | Correct only the exact reviewed edition/context/cell, with unique corroborating parent and canonical identity | Parent evidence identifies the printed assignee; a second subcommittee assignment table is not required |
| Nickname, changed surname or unsupported initial | Use only an individually reviewed, source-bound resolution with stable canonical identity and explicit evidence | No global nickname dictionary, fuzzy surname matching or LLM confidence threshold |
| Explicit assigned member on sabbatical | Retain the member role and preserve the leave note in the public membership label | Participation leave is not a recorded departure; no effective dates are invented |
| Person ineligible for the printed Congress | Do not invent a term, substitute another person or silently discard the row | Fail closed except for the exact reviewed quarantine with persisted scoped coverage described below |

Reviewed corrections preserve assignment count, organization, chamber, role and tenure semantics. They may not add
an absent assignment. Exact typo repairs require the expected context and unique corroboration; broader reviewed
identity resolutions must bind the reviewed source roster and expected canonical candidate. Changed source evidence,
missing prerequisites or competing candidates fail closed. Decisions remain reviewable in mapping data and this inventory.

## Reviewed mapping data

The committed JSON datasets in [review-data](../../src/ingestion/govinfo/review-data/README.md) contain reviewed names,
canonical identities, exact committee contexts, edition fingerprints and research notes. The reviewed-identity matcher
contains no person-specific mappings. Its shared loader validates the data shape and rejects duplicate editions or
conflicting source contexts before the existing roster/canonical-person checks run.

The September 8 extraction preserved all mapping values across 11 identity editions and five historical-assignment
editions, verified by an exact structured-data comparison. Brown/Spence retain their separate historical-observation
semantics. No database rows, assignments, dates or publication gates change. New database ingestion uses the same
bundled datasets once canonical people and terms exist. Data changes still require review and deployment; remote
GovInfo content cannot supply or alter these trusted overrides.

An adjacent GovInfo edition may establish an explicit name-to-Bioguide identity equivalence when the target edition
lacks an individual biography. This does not transfer any committee assignment across editions: the target roster
must itself contain the row, and the canonical person must have an applicable term in that target Congress. Preserve
the corroborating granule ID in the reviewed decision. Missing biography links alone are not evidence of a missing person.

## Source review

The [reviewed source decisions](../../src/ingestion/govinfo/review-data/source-decisions.md) retain individual identity
corroboration and the Brown/Spence and Udall exceptions. Review notes and exact edition fingerprints remain in the bundled
datasets. Independent review can challenge candidate identities, but neither model confidence nor a name-only match
authorizes publication. An inferred identity must be labeled as an inference rather than an explicit source alias.

## Implementation and release gates

1. Preserve exact evidence and add regression tests for each correction, including missing/conflicting prerequisites.
2. Audit every affected edition completely: hierarchy, source count, identity count, duplicate identifiers and roles.
3. Require zero unexplained entries and reconcile duplicate printed assignments explicitly before publication.
4. Run focused tests and repository verification; report unrelated failures rather than bypassing hooks.
5. Commit/push reviewed changes to main and deploy Trigger before dispatching a new historical import.
6. Import one validated Congress at a time, never overlapping other import or index-maintenance work.
7. Verify database counts, Congress-end closure, detected dates, current-Congress fingerprints and unchanged reruns.
   Authenticated API verification is a separate gate and must not be claimed without working credentials.

## Tradeoffs retained deliberately

The manifests freeze the entire parsed roster, expected cell contexts and canonical candidate fields. This is stricter
than freezing only the misspelled name: an upstream edit or a parser change can require re-review even when the identity
looks unchanged. That operational cost is acceptable for this finite historical backfill and prevents silent expansion
of exceptions. Future editions do not inherit the exceptions.

The existing catalog projection does not carry term state. The validator checks Congress, chamber, edition year and
district, freezes the canonical identity, and checks printed state and parent evidence separately. It must not claim
that a state field was validated on the term itself.

The Brown/Spence historical assignments use `historical_at_first_observation`: inactive and session-scoped,
with null detected start, detected end and last-observed dates. A later positive active observation creates a new tenure;
an already observed active tenure cannot be retroactively relabeled. No effective date is manufactured.

The exact reviewed 117th Udall cell uses `source_term_contradiction` quarantine. All other unmatched cells still fail
validation. Coverage and quarantine details commit atomically with the roster checkpoint, remain on unchanged reruns,
and appear in scoped API coverage warnings. This replaced the earlier blanket hold on the 117th edition; the roster
is imported but explicitly incomplete. A global organization flag cannot represent historical completeness.

## Ingestion performance and recovery

The committee snapshot writer batches change tracking in groups of 250 records. Each changed batch performs
one fingerprint read and two bulk writes, using the source fields already supplied to the snapshot writer.
Event identity, before/after planning, unchanged detection and checkpoint atomicity remain unchanged.
For 3,856 new memberships, tracking now requires 48 statements rather than approximately 15,424.
This is a statement-count reduction, not a measured production speedup.

Two pending editions may download/normalize concurrently. All pending editions must pass validation before
publication begins, and results are applied in issue order regardless of preparation completion order.
Current sync and historical backfill share the `govinfo-committee-publication` queue at concurrency one.
Cross-Congress publication fan-out remains disabled until live timings and shared-record safety are validated.

Both committee Trigger tasks have a 24-hour outer limit instead of one hour. Each snapshot transaction sets
PostgreSQL-local limits: 60 seconds per statement, 10 seconds waiting on a lock, and 120 seconds idle in transaction.
These settings do not leak into pooled connections. Database errors propagate and roll back the snapshot and
its checkpoint together. A retry resumes from committed edition checkpoints; no destructive restart is used.
No finite timeout guarantees arbitrary outages will succeed: the goal is bounded failure with safe recovery,
not leaving a stalled database operation running for 24 hours.

A Trigger timeout alone does not establish whether a database transaction remains active or which edition
checkpoint committed. Check PostgreSQL before dispatching a replacement. The new limits apply only to new
executions; they do not change an already-timed-out execution.

Validate batching, unchanged reruns, rollback and current-Congress preservation when changing this pipeline.
