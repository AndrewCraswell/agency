# Regulatory source discovery checkpoints

Regulatory discovery has a durable canonical ingress before any recurring schedule is enabled. It is independent of
Trigger run retention: a source/query scope retains its committed cursor, covered window, overlap start, source cutoff,
last attempt, last success, revision and last committed page. Exact page receipts and deduplicated acquisition units
remain in PostgreSQL.

`startLegalDiscoveryAttempt` creates or resumes an immutable source/query scope and records an attempt without changing
the committed cursor. `commitLegalDiscoveryPage` accepts at most 100 units. It locks the checkpoint, verifies the
expected revision and cursor, validates every source unit and inserts the units, page receipt and new cursor in one
serializable transaction. A failure at any point rolls back the page. Replaying the exact last page returns its prior
receipt; competing or stale pages fail instead of skipping a window. Reusing a unit key with different bytes or fields
fails closed.

The first source adapter reads the official eCFR title inventory. It requires 50 unique title records, rejects
`import_in_progress`, preserves reserved titles as explicit outcomes and validates issue/currency dates against the
publisher inventory date. It compares each requested title with the stored `legal_code_heads` eCFR edition. A changed
title becomes one current acquisition unit; an unchanged title creates no new unit. Repeated discovery before a pending
unit is consumed may create another zero-new-unit page receipt but cannot duplicate the work item.

Trigger task `regulatory-ecfr-discovery` is a bounded manual entry point with a single-worker queue. Its optional title
selection is unique and limited to titles 1–50. It points only at the canonical database. No Trigger schedule is
registered here; hourly activation remains blocked until G4 and SYNC-11.

The Federal Register adapter reads the official GovInfo `FR` collection by package modification time rather than by
publication date. This allows a corrected old issue to re-enter discovery. Each request is limited to 100 packages and
one durable checkpoint commit. The cursor retains the exact fixed window, opaque `offsetMark`, pending split windows and
latest completed boundary. A completed cycle begins the next window with a 24-hour overlap. When GovInfo reports more
than its 10,000-result traversal ceiling, the adapter commits no packages and bisects the time window before continuing;
one-second saturated windows fail explicitly. Package modification time becomes the immutable acquisition revision, while
the `FR-YYYY-MM-DD` identity continues to supply the issue/publication date. API credentials are sent only in the request
header and are absent from retained evidence and cursor state.

Trigger task `regulatory-fr-discovery` is also manual and single-worker. It self-continues one page or split decision at
a time with global idempotency keys. A page that commits new units starts one bounded shared discovery-controller window.
The controller uses the existing XML acquisition and parsing stages, then selects the source-specific Federal Register
publication adapter. No recurring schedule is registered.

`regulatory-discovery-registration` moves at most 100 pending units into one immutable current-acquisition manifest.
Selection, manifest insertion and the pending-to-registered transition share one serializable transaction. Controllers
use row locks with `SKIP LOCKED`, so competing bounded runs cannot claim the same unit. An empty pending set produces no
manifest. Registration does not download source bytes, submit a child task or imply that acquisition succeeded.

`regulatory-discovery-acquisition` accepts one manifest ID and unit key. The worker reloads the immutable manifest,
streams the official XML through the existing bounded checksum path, validates its regulatory root, retains bytes under
their SHA-256 and commits the artifact reference plus receipt to the matching discovery row. A crash after the file is
complete but before the database commit reuses and revalidates the retained file. The artifact root comes from
`REGULATORY_ARTIFACT_DIRECTORY`; deployment still requires a verified shared durable mount or object-store adapter.

`regulatory-discovery-parsing` reloads an acquired unit and its receipt, revalidates the retained artifact, invokes the
same bounded Python parser used by historical backfills and commits the parser hash, normalized generation, locator and
summary only after every shard passes TypeScript validation. Retry revalidates and reuses the deterministic generation.
The normalized root comes from `REGULATORY_NORMALIZED_DIRECTORY`.

`regulatory-discovery-publication` selects its publisher from the immutable manifest. An eCFR unit revalidates the
manifest, receipt, retained source artifact and normalized shards before using the same leased canonical staging,
materialization and compare-and-swap publication transaction as historical imports. A Federal Register unit stages the
same normalized XML records, freezes an exact-day FederalRegister.gov metadata manifest under
`REGULATORY_FR_METADATA_DIRECTORY`, reconciles every parsed publication and registers one durable rendition intent per
matched non-presidential document. It fails closed when metadata or an official GovInfo PDF is absent.

`regulatory-fr-rendition` acquires one PDF under `REGULATORY_FR_PDF_DIRECTORY`, verifies retained bytes and validates all
pages plus document identity in the bounded child process. Database leases make acquisition and validation independently
resumable. The final validated rendition atomically opens the issue gate and submits one replay-stable finalizer. The
finalizer replays the frozen metadata, reloads exactly the validated rendition set, invokes the existing leased
`publishFrIssue` transaction and records the canonical import generation on the discovery row. Federal Register rows do
not invent a code-edition ID. Publication emits the existing publication lexical outbox items but does not submit passage
copying or embeddings. The workers are manual and bounded; no recurring schedule is registered.

`regulatory-discovery-controller` is the manual bounded fan-out entry point. It first registers at most 100 pending
units, then selects a keyset page of at most 100 units whose committed state is `registered`, `acquired` or `parsed`.
Those states map respectively to acquisition, parsing and publication. The controller persists every stage intent before
the first Trigger submission, submits serially to bound SDK calls, and uses a stable global idempotency key with a
seven-day retention window. Each intent retains its immutable manifest/unit payload, stage, attempt time, lease and run
ID. An uncertain submission keeps the original identity for retry or later disposition reconciliation; the controller
never assumes that a missing response means Trigger rejected the child. Re-running after workers commit state creates
only the next-stage intent. Pagination exposes the last unit key and exhaustion rather than loading a national scope.

`regulatory-discovery-recovery` manually reconciles a keyset page of at most 25 submitted or uncertain stage intents.
It records each observed Trigger status and preserves active runs. Terminal failures are moved to a new persisted attempt
before a replacement is submitted, so each attempt has a distinct global idempotency key. A submission with no saved run
ID is retained for six days; a saved run missing from Trigger history is retained for seven days. After those retention
windows, recovery appends the prior attempt, run ID and disposition to `run_history`, clears the current handle and
submits the same immutable payload under the incremented attempt. Late original workers remain safe because stage
workers can advance only their expected canonical state and all transitions are replay-safe.

The shared manifest-completion audit branches by source. eCFR units require a canonical edition and its lexical outbox;
Federal Register units require a canonical publication generation, at least one observation, an exact one-to-one lexical
outbox count and the aggregate outbox state across every observation. Federal Register rows must have no code-edition ID.
Rights are resolved from the published import generation. A missing observation or one missing publication outbox fails
the canonical and lexical readiness gates.

A remote `COMPLETED` status is not accepted as stage completion by itself. Recovery marks the dispatch complete only
when the discovery unit has reached or passed that stage, or records `completed_without_stage_advance` for operator
inspection. Quarantined units are terminal and visible. Trigger 404 responses become a missing-history disposition;
other Trigger API failures propagate so the recovery task retries rather than inventing a run outcome. The recovery task
uses the controller's single-worker queue and has no schedule.

The discovery-unit and current-manifest contracts require `historical: false`; the existing acquisition/backfill
contract remains strictly `historical: true`. Keeping these schemas separate prevents recurring observations from
silently becoming completed backfill coverage. Deployed recovery/fault injection, shared artifact/normalized storage,
downstream completion accounting and scheduled cadence are separate gates.
