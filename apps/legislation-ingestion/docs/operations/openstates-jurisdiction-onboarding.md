# Open States jurisdiction onboarding

This runbook defines how to add a state or territory to the self-hosted Open States pipeline. It does not establish an
onboarding queue or record jurisdiction status. Linear owns prioritization; inspect retained artifacts, canonical data,
deployments, and schedules before making a coverage claim.

The approved product scope is the 50 states, District of Columbia, and Puerto Rico. Additional scraper modules are
capability candidates, not approved coverage. Every jurisdiction must pass the
[rollout requirements](openstates-rollout-checklist.md) independently.

## Ownership boundary

Reuse shared acquisition, archive, batch ownership, recovery, promotion, content, embedding, and search infrastructure.
A jurisdiction adapter owns only:

- authoritative source discovery;
- source-specific identifiers and parser mappings;
- bounded extraction configuration;
- explicit capability and credential requirements; and
- source-specific tests and quarantine reasons.

Do not create a parallel scheduler, receipt format, persistence path, or identity model for one jurisdiction. Do not
infer people, organizations, meetings, or departures from names or partial snapshots.

## Source review

Before implementation:

1. Pin the scraper revision and inspect the jurisdiction module and its dependencies.
2. Identify official current and historical sources for bills, votes, events, people, committees, documents, and
   supporting materials.
3. Record session identifiers, chamber identifiers, bill patterns, publisher time zones, credentials, redirects,
   transport constraints, and rate limits.
4. Classify each record family as supported, unsupported, or requiring a separately reviewed adapter.
5. Confirm that the source can be queried in bounded deterministic units.
6. Define stable upstream identities and the evidence retained when a publisher does not provide one.

Source availability is not extraction acceptance. A working bill lane does not imply voter, event, people, committee,
document, or historical coverage.

## Capability profile

Add the jurisdiction to the shared profile only after its constraints are explicit and tested. The profile must bind:

- jurisdiction and accepted sessions;
- chamber and printed-identifier rules;
- permitted record families;
- maximum batch size and concurrency;
- source and worker deadlines;
- required credentials and approved hosts;
- build-input fingerprints; and
- schedule activation policy.

Reject unknown sessions, mixed jurisdictions, mixed chambers where the source requires separation, duplicate selections,
and unsupported record families. A profile authorizes validation; it does not activate hosted work.

## Discovery and planning

Discovery retains the official source inventory and produces a create-only immutable plan. The plan records its scope,
source hash, parser/build identity, ordered work items, and batch hashes. Re-reading the plan must reconstruct the same
partition.

Use stable publisher identities rather than offsets in a mutable feed. Bills are partitioned into bounded,
single-chamber batches. Event extraction uses explicit date windows or publisher event keys. People and committee
snapshots retain separate current and historical lanes where the source provides them.

Empty inventories require evidence. A timeout, partial page, malformed response, or missing source is not a verified
empty result.

## Extraction and archival

Run the pinned, verified image described by the [runtime contract](openstates-runtime-build.md). Each attempt receives
one immutable work item and no database or unrelated cloud credentials. Retain successful, failed, and timed-out
attempts through the shared archive writer before cleanup.

The archive must preserve exact source identifiers, URLs, retrieval times, raw files, checksums, and bounded diagnostic
categories. Replay verifies every declared file and the attempt identity. Archive retention alone does not establish
semantic validity or canonical promotion.

## Normalization and promotion

Map source records through shared canonical normalizers and writers. Preserve unknown values as unknown. Reject
ambiguous or contradictory identities rather than guessing.

Promotion requires:

- a verified retained archive and approved build fingerprint;
- exact plan membership and jurisdiction/session scope;
- semantic validation and quarantine accounting;
- active ownership with confirmed-release semantics;
- stable canonical identifiers; and
- an immutable receipt committed with the canonical transaction.

Replay must be idempotent. Partial snapshots do not authorize deletions. Relationship completeness remains false until
all required parents and references are independently resolved.

## Downstream acceptance

For every supported record family:

1. Reconcile discovered, archived, normalized, quarantined, persisted, and removed counts.
2. Replay the same cohort and verify stable identities and receipts.
3. Exercise duplicate dispatch, interruption, retry, stale ownership, and recovery.
4. Verify W collection/detail/search behavior and applicable M tools against canonical IDs.
5. Verify document acquisition, OCR, passage generation, embeddings, and search separately from parent records.
6. Record unsupported lanes and accepted scope in the target environment.

Enable recurring schedules only after the complete scheduled scope passes. Monitor the first recurring cycles and keep
rollback evidence, but do not copy run transcripts or current status into this runbook.
