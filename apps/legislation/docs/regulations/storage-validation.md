# Regulatory edition storage and import validation

## Persistent passage generations and lexical canary

`passage-preparation.ts` now coordinates canonical preparation for a complete published edition or one FR observation.
It freezes source version/context inventory into durable items, pages that inventory by ordinal, limits each invocation
to at most 25 versions, and checkpoints each immutable generation separately. The source plan is capped at 64 MiB and
one million records; oversized context fails instead of being silently shortened. Labels use the source publisher and
jurisdiction, leaving room for future licensed state sources without hard-coding their publisher as Federal Register.

A renewable 120-second lease and incrementing fence prevent stale workers from checkpointing or completing work. A
generation committed before a checkpoint failure is safely reused on retry. Infrastructure and unknown failures remain
pending with a retry delay and a bounded error code. Recognized table/reader/context-budget failures instead persist
`failure_code` and `failed_at` on the affected item, allowing later records to continue. A checkpoint cannot have both
a generation and a failure. Completion checks source/retained inventory hashes, exact version/context/tokenizer
associations, and passage counts for every successful item. `prepared` means every item passed these checks; it does
not establish isolated-index parity, complete content-hash auditing, authenticated search readiness or embedding quality.
Publication outbox items remain pending until the separate index acknowledgement gate passes.

Preparation results include `total`, `complete` and `blocked`. The state stays `pending` while any items remain
unattempted; after the full inventory is accounted for it becomes `prepared` only with zero blockers, otherwise
`blocked`. The latter is terminal for Trigger continuation and is rejected by index copying. A source blocker is not
an accepted exclusion from advertised coverage. Rights checks and lease renewal fence failure checkpoints exactly as
they fence successful checkpoints; a lease expiring during either write rolls back that transaction.

After a source-backed handling repair, explicitly dispatch `regulatory-passage-preparation` with the same `scope`,
`model`, bounded `limit` and `retryBlocked: true`. The worker clears only failed checkpoints after checking rights and
acquiring the lease; it retains successful generations. Subsequent Trigger tasks send `retryBlocked: false` so the
same unresolved record cannot starve the remaining inventory. Ordinary replay leaves recorded blockers intact.
This is canonical passage preparation only and never dispatches embedding requests. New schema fields are in the
unreleased migration baseline; retained older pilot databases are not automatically migrated.

`pnpm tool regulations/inspect-regulatory-readiness --preparation <preparation-id> --limit 25` reads an operator snapshot from the
canonical `DATABASE_URL`. The current command covers preparation checkpoints only. It reports expected/present/
prepared/blocked/unattempted counts, missing or extra checkpoints, active lease and retry delay, and at most 100
failed version identities with symbolic reasons. Use `--after <nextAfterOrdinal>` for the next failure page; each
invocation is a fresh snapshot, so a concurrent explicit retry can change the failure list between invocations.
It takes the existing rights locks before reading counts/failures, never returns source bodies or lease tokens, and
does not dispatch work, acknowledge outboxes or authorize serving. Exit zero means stored preparation checkpoints
are complete and idle; it does not verify passage hashes, target parity or embedding readiness. Incomplete/blocked/
delayed/leased work and inspection failures exit nonzero. Missing tables on older pilots require the correct schema;
the inspector never repairs or migrates them implicitly.

The unreleased storage baseline now includes `legal_passage_generations` and `legal_passages`, with explicit provision
or publication version ownership, exact preparation metadata, source/context spans, input hashes and an English FTS
GIN index. `passage-storage.ts` prepares outside the write transaction, then locks and rechecks the published source
membership and active display/local-search rights before writing. A transaction advisory lock serializes an immutable
generation. Inserts use at most 100 rows and 8 MiB per request. A failure rolls back the generation and every passage;
replays compare the retained manifest/count and all stored passage data rather than silently accepting an incomplete copy.

The internal lexical lookup requires a specific generation and published edition or publication observation, checks
version membership and current rights again, and bounds the query and returned count. It does not expose an HTTP/MCP
route, select a global/current search generation, acknowledge an outbox job, or establish source/target index readiness.
Authenticated caller/territory/API entitlements and the isolated search projection remain separate implementation gates.
HTML Federal Register reader blocks are validated for exact body parity before canonical anchors are regenerated;
XML imports retain their parser block evidence for structural passage preparation.

Real PostgreSQL regression cases cover unpublished sources, concurrent replay, a failed passage insert, missing rows on
replay, rights revocation, wrong edition/version or observation/version selection, and keeping outbox work pending.
The isolated real-source pilot at loopback port 55442 imported/published the retained 2025 annual CFR title 2 source,
then prepared sections 200.302, 200.303 and 200.318 with both tokenizers. Six generations and nine passages were stored;
every replay and lexical probe passed. Evidence: `artifacts/regulatory-backfills/passage-storage-source-smoke.json`.
This is local text/index storage only: no provider calls, vector generation or changes to existing embedding contracts.

## Annual CFR title publication

Annual units with verified printed revision dates can now be staged and materialized as unpublished volume editions.
`publish:annual-cfr` assembles an entire title/year from the frozen GovInfo directory inventory, verifies exact listed
volume coverage, source/summary provenance, matching printed dates, rights, membership counts and duplicate provisions.
It publishes every volume and its lexical outbox together in one fenced transaction. A failed/missing volume prevents
all publication. Annual volumes never replace the current eCFR title head. The unreleased baseline includes
`legal_annual_editions` and `legal_annual_edition_volumes` to retain the title-level coverage and volume ordering.

The annual parser preserves quoted replacement text (`REVTXT`/`EFFDNOTP`) inside its enclosing provision rather than
misidentifying nested replacement sections as duplicate current provisions. Quotes containing title/chapter structure
or at least 100 structural nodes are retained but require source-scope review before publication. This is an explicit
review threshold, not a claim that the quoted text is invalid. Printed-year mismatches remain blocked.

PostgreSQL tests exercise incomplete sets, direct-volume publication rejection, atomic replay, cross-volume duplicate
citations and conflicting revision dates. Real 2025 title-5 source testing uncovered extensive quoted structure in
volume 2; it is not cleared for title-wide publication. See the current implementation ledger for pilot results.

The shared `withImportLease` transaction now enforces token/fence/expiry checks and rights independently of source
format. The XML-specific `withLease` wrapper still strictly parses XML acquisition units and parser summaries before
invoking edition or issue writers. This prepares HTML publication generations without allowing non-XML payloads into
existing XML writers. The schema, registration functions and publisher behavior are unchanged by this refactor.

Two additional real PostgreSQL checks cover format separation, revoked rights and rollback if a callback expires its
lease before commit. All 22 storage integration tests passed on the disposable test database at loopback port 55436;
retained pilot databases were not changed. Subsequent HTML registration/staging is described below; canonical publication remains pending.

HTML generation registration/staging is now implemented by `fr-import-registration.ts` and
`stage:fr-html-publications`. It reuses the existing import tables and shared lease, with an explicit
`html_publication_set` unit and `fr-html-import-2026-09-14` contract. The registered artifact is the retained normalized
input set, not an invented publisher XML issue. Raw HTML/PDF provenance remains in each staged payload and in the
retained source directories; canonical artifact attachment remains part of publication.

The CLI reloads/revalidates the source files through the same service used by offline normalization, retains the exact
input artifact, registers immutable generation identity and stages the complete batch in one fenced transaction.
The local writer caps each set at 1,000 records and 8 MiB, matches the registered input hash and record count, rejects
payload conflicts, and moves a complete set to `validated`. It does not create canonical publications or outbox rows.
Rights checks remain active during registration and staging. Larger sets require partitioned staging work.

Execution requires `--apply` and a loopback `regulations_test` database. The September 14 smoke uses the separate
`rostra-fr-html-storage-pilot` container on port 55438. The existing retained XML/eCFR pilot databases are unchanged.
The integration suite now passes 23 real PostgreSQL tests, including HTML identity replay, altered-set rejection,
revoked-rights rejection and strict XML dispatch isolation. Canonical HTML publication is now implemented below.

## Canonical HTML publication

`publish:fr-html-publications` consumes an already validated HTML generation. Before opening its transaction, the CLI
replays metadata, reparses HTML, verifies retained HTML/PDF hashes and validates the PDF proof against the current
validator. It requires `--apply`, a generation ID and a loopback `regulations_test` target. It does not migrate or reset
the target database. A mismatched source set cannot publish the staged generation.

The publisher checks exact staged JSON payloads and hashes, generation identity/count/state, active retain/display/search
rights and lease fencing. One transaction attaches both raw artifact types and writes the publication batch, canonical
document/version/observation rows and lexical outbox rows. Failure at any step rolls back all visibility and attachments.
Successful replay checks the existing snapshot and retains IDs without duplicate observations or outbox work.

XML and HTML adapters share `writeFrPublication` for canonical row persistence. HTML versions use input contract
`fr-html-publication-2026-09-14`, preformatted text and lossless reader blocks. Their semantic heading is empty because
no heading structure was extracted; titles remain in observation metadata. Metadata-only changes therefore do not
change text identity. HTML observations retain the source HTML URL with its `css:pre` locator, and staged provenance
links the exact HTML hash. The supporting PDF remains independently attached and is not the canonical body.

The bounded publisher supports at most 1,000 records/8 MiB, with no source fetches or model calls inside the transaction.
No agency/action merges, legal-effectiveness inference, search execution, embedding generation or source schedules
are enabled. Three new real PostgreSQL tests verify canonical replay, source/staged tampering and missing evidence,
revoked rights, raw attachment and complete rollback/retry when outbox insertion fails; all 26 storage tests pass.

Implemented September 14, 2026. This is a local backfill storage slice. Production migration, hosted workers,
search projections, embedding evaluation, and public API/MCP delivery remain pending.

## Implemented boundary

Migration `0048_regulatory-edition-storage.sql` adds 18 tables in the existing `legislation` schema. Drizzle definitions
live in `src/db/schema/schema.ts`. Existing deployed migrations were preserved. The migration uses the normal journal
and migration runner; it does not change the PostgreSQL image or introduce an extension.

| Area | Implemented behavior | Remaining work |
| --- | --- | --- |
| Source evidence | Frozen manifest, original artifact hash/location, unit and parser summary | Azure retention, all observation/alias mappings |
| Durable import | Immutable staged records, bounded transactions, expiring lease and fencing counter | Trigger dispatch, durable retries and operator repair |
| Code identity | Existing jurisdiction FK, UUID code/provision/version/edition IDs, unique natural keys | Licensed alias resolution and citation reuse/renumbering evidence |
| Edition membership | Edition-specific parent/order/locator, immutable content versions reused across editions | Annual multi-volume completeness and source precedence policy |
| Publication | Complete eCFR title and bounded reconciled FR issue; stable publication/version IDs and source observations | Same-date precedence, metadata refresh observations, partitioned large-issue writer |
| Derived work | Lexical outbox row committed atomically with edition publication | Dispatcher, acknowledgements, indexes, event and embedding jobs |
| Rights | Versioned explicit policy, active-profile checks on every write, display/search checks on publication | Restricted query filtering, API/MCP/export policy enforcement, vendor feed |

Annual CFR remains staged: the date anomaly is retained as `source_date_review_required`, and other annual volumes
require title-wide completeness. FR remains blocked after generic staging until the dedicated issue writer validates
the complete metadata union and each required parsed PDF. No bill, legislative session or committee is invented.

The initial canonical path handles English eCFR text. Source-local hierarchy nodes remain namespaced; section identities
use their CFR citation within the code. Matching text alone never merges a licensed source with a federal provision.
The source-alias resolver and full state capability/date envelopes remain unfinished. Rights-policy fixtures alone do not
establish Vaquill adapter readiness or licensing permission.

## Federal Register issue writer

`fr-storage.ts` adds a bounded atomic publication path for one reconciled issue, limited to 1,000 publications and
8 MiB of staged payload. Larger issues fail with `fr_issue_requires_partitioned_writer`; they are not silently truncated.
Metadata is replay-validated before the database transaction. The pilot CLI also verifies raw XML/shard hashes and
retained PDF bytes against current validator evidence before claiming the publication lease.

The five additional tables store stable `regulatory_documents`, immutable `regulatory_document_versions`, complete
`regulatory_publication_batches`, contextual `regulatory_document_observations` and a lexical-only
`regulatory_publication_outbox`. A document number is scoped to the federal-register namespace and existing jurisdiction.
Content versions include canonical XML text/blocks and the PDF rendition hash; publisher metadata lives on observations.
Agency names/IDs, RINs, dockets and dates remain in original metadata. Canonical agency resolution, action grouping and
promotion of correction candidates into the relationship graph are still pending.

Batch publication, all observations and search jobs commit together under the existing database lease and rights checks.
Exact replay preserves every ID. A changed metadata snapshot for the same XML generation is rejected as
`fr_snapshot_conflict`; a dedicated metadata-refresh observation path must be implemented before enabling ongoing feeds.
This initial writer exposes no latest-version selector or current head and does not emit customer alerts or vectors.

The unreleased baseline migration was extended directly. The retained eCFR pilot on port 55434 was not reset or migrated
in place. Fresh FR test/pilot databases on ports 55436/55437 received the complete revised migration through the normal
runner. Never point destructive integration tests at the retained pilot.

```powershell
pnpm tool regulations/validate-fr-pdfs --metadata artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14/manifest.json --date 2024-01-02 --directory artifacts/regulatory-backfills/fr-pdfs --output artifacts/regulatory-backfills/fr-pdf-validation-2026-09-14.json
pnpm tool regulations/import-fr-publications --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --metadata artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14/manifest.json --validation artifacts/regulatory-backfills/fr-pdf-validation-2026-09-14.json --date 2024-01-02 --raw artifacts/regulatory-backfills/raw --normalized artifacts/regulatory-backfills/normalized --pdfs artifacts/regulatory-backfills/fr-pdfs --output artifacts/regulatory-backfills/fr-publication-storage-2026-09-14.json --apply
```

The importer requires `REGULATORY_TEST_DATABASE_URL` pointing to a local disposable `regulations_test` database. Without
`--apply`, it only reports the selected issue and target class. Reports use exclusive filenames; choose a fresh filename
for replay. Structural validation runs in a child process with a 512 MiB JavaScript heap ceiling, 90-second timeout,
32 MiB PDF/text ceilings and 750-page ceiling. Native memory is not bounded by the JavaScript heap limit. The child
receives only basic OS path/temp environment variables, not provider/database credentials. It parses all page text and
drawing operators, checks the expected document number and page count, and never substitutes PDF extraction for XML.
These checks are not PDF conformance certification, full visual review or malware sanitization.

## Transaction and recovery contract

1. Revalidate the retained raw file's type, bytes and hash, then every normalized shard using the parser bridge.
2. Register immutable manifest/artifact/generation evidence. Require existing `jurisdiction:us`; do not create a
   jurisdiction implicitly. The generation identity includes unit/revision, raw hash, parser hash, shard hashes,
   date warnings and the versioned rights profile. Its manifest FK records the first registration's acquisition lineage.
3. Claim a 120-second database lease with a random token and increasing fence. Concurrent claimants cannot both win.
4. Stage at most 100 records and normally 8 MiB per transaction. A single larger record may use the parser's 64 MiB
   record ceiling; the service does not split legal text to fit an arbitrary row limit. Hash the shards again while
   staging, so a changed file cannot be promoted after an earlier validation pass.
5. Validate total/kind counts, ordinal uniqueness, one code root and every parent/path/order relationship. Source
   warnings block publication. Raw acquisition or a parsed summary alone never makes an edition publishable.
   Store kind, locator, provisional identity and payload byte count in scalar staging columns. Completeness checks and
   parent resolution do not repeatedly decompress large JSON text payloads just to read hierarchy metadata.
6. Materialize provisions, content versions and edition membership in source preorder using bounded transactions.
   Preserve prior editions; changed text creates a version, moved parents change membership, missing current members
   remain in history. Absence is not labelled repeal. A failed batch can leave unpublished materialization for replay.
7. Lock the code row, compare the expected head, recheck membership count, then publish and enqueue lexical work in one
   transaction. Older editions can become selectable history without replacing the newer head. Same-date revisions
   fail closed until publisher precedence can be established; completion time and collection time do not decide.

Every staging/materialization/publication transaction checks token, fence, active rights and the database clock before
work. It checks expiry again at the end and renews the lease for 120 seconds only when still valid. An expired worker's
transaction rolls back even if it had already changed the edition pointer. Release from an old token cannot clear a
replacement worker's lease. No network, model call or provider wait runs inside a database transaction.

`published` is canonical database state only. There is no searchable claim until the outbox work produces a validated
index generation. Historical backfills create neither customer change alerts nor embedding jobs in this slice. The
required held-out model comparison still precedes bulk vectors.

The schema uses composite foreign keys to keep code, jurisdiction, version owner and edition parent consistent, following
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html). Short row locks serialize the
lease and head updates; see [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).

## Execution and checks

### Scope publication, current reads and revocation

The opt-in API canary adds an external-use gate to the shared reader. `createLegalSearchCanary` checks trusted request
identity and captures a server-configured organization allowlist before any database call. Its strict application input
requires a preparation receipt; caller identity fields and access flags are rejected. The reader first obtains locked
scope metadata, checks display/local-search rights, then checks API/MCP permission, official federal source identity and
worldwide territory rights before opening the target. Territory-limited policies remain unavailable without trusted
territory context. Internal lexical reads can remain permitted when API permission is denied.

`readLegalPassageScope` reads only ownership and policy metadata; materialization loads body/blocks separately after
permission checks. Search no longer transfers a full canonical provision merely to check access. This service is not a
public wire response, and the current-provision internal helper is not an API authorization boundary. Route integration
must use the canary service, the normal verified WorkOS request context, strict serializers and account configuration.

The isolated schema now records every edition/publication membership separately from its immutable passage generation.
`acknowledgeLegalPassageCopy` performs the whole-scope inspection, writes a selected-preparation receipt in
`legal_search_scopes`, commits the target, then commits the matching canonical lexical outbox acknowledgement.
Generation/membership checks and source rights locks span that handoff. A target write failure rolls back the source
acknowledgement. A source commit failure after target commit leaves a receipt but an unacknowledged source job; the
registered reader refuses it and replay completes safely. The receipt selects a lexical preparation, not an embedding
model for bulk promotion. It does not change canonical heads or announce public API readiness.

`searchCurrentLegalProvision` resolves `(codeId, sourceId, nativeId)` from `legal_code_heads`, selects that edition's
acknowledged preparation, and rechecks the head, source job, target receipt, membership and live rights inside the read.
A new canonical head with no completed search copy fails explicitly instead of returning the prior edition. Historical
scoped reads remain separate. Annual-CFR history does not acquire a current head through acknowledgement. Federal
Register observations have scoped acknowledgements; this does not select a latest regulatory action graph.

`reconcileLegalSearchRightsBatch` automatically discovers copied scopes and checks authoritative policy state. Each scope
cleanup removes at most 25 memberships, clears its selected-preparation receipt, and resets its lexical outbox job to
pending. Generations and passages are deleted only when no other copied scope references them. Scope/generation locks
serialize cleanup with recopy; a still-revoked source cannot resurrect removed text. Invalid policies or database errors
fail instead of being interpreted as revocation. Canonical artifacts and all embedding tables remain untouched.
Restored rights require recopy and re-acknowledgement. Returned cursors revisit a partially drained scope rather than
skipping its remaining generations. The sweep has a 60-second work budget, with a 30-second per-scope budget.
Durable revocation markers remain discoverable after the last membership is deleted. If target cleanup commits but
the canonical job reset fails, the next sweep finds the marker and completes the reset. Markers also retain revocation
history after rights restoration; they do not override a newly validated source policy or selected receipt.

The `regulatory-search-rights` Trigger task runs one bounded sweep using the existing source/search database settings,
requires a separate search host, returns continuation state and closes both pools on failure. It has no recurring
schedule and has not been deployed or activated by these local checks. A production maintenance schedule must activate
new sweeps periodically. The task itself continues incomplete sweeps by dispatching the
returned cursor to a successor, using an idempotency key derived from the parent Trigger run. Retries reuse that key
after uncertain dispatch; failed database batches dispatch nothing. Empty incomplete results fail instead of creating
an endless chain. Pools close before dispatch. A complete sweep has no successor; periodic activation remains separate.
Source ingestion remains disabled.

`searchCopiedLegalPassages` in `passage-search.ts` is an internal, explicitly version-scoped lexical reader for the
isolated database. It validates published source membership and live display/search rights before connecting to the
target, and holds those source locks until reading finishes. A revoked profile therefore blocks reads even when its
copied text is retained or the target database is unavailable. The reader checks generation ownership and metadata,
requires the expected target passage count, and revalidates each returned hit against canonical content and input hashes.
Queries are limited to 500 characters and 50 results; target reads use a consistent snapshot. Unreturned rows are not
fully audited by each search; whole-scope copy inspection remains the integrity gate.

This is an internal canary, not an authenticated API or MCP endpoint. It does not claim public readiness, caller/territory
entitlements, cross-version selection, BM25 ranking, automatic physical removal after revocation, or outbox completion.
It never trusts retained target text as permission to disclose a result.
Both canonical and isolated FTS indexes use complete `input_text`, preserving citation/heading and table context in
matching and ranking. Real-source parity checks compare IDs, order, scores and returned content between the two readers.

`inspectLegalPassageCopy` in `passage-copy-readiness.ts` checks an entire prepared edition or publication observation
without writing data. It uses separate repeatable-read source/target transactions with row locks, checks current source
rights and frozen inventory hashes, validates every generation's ownership/context/tokenizer, and compares every
canonical passage against the target, including canonical manifests and exact input hashes. It fails on missing,
changed or extra passages within the selected generations. Queries use 25-generation and 100-passage pages, a 64 MiB
per-generation cap and a 60-second aggregate deadline. A larger scope that exceeds this budget fails rather than
claiming partial completeness; resumable validation across larger titles remains future work.

The report's `copyComplete` describes this bounded snapshot inspection only. `publicSearchReady` and `acknowledged`
remain false. It cannot substitute for rights-revocation tombstones, current-version selection, API authorization or
an atomic whole-scope outbox acknowledgement. It does not require unrelated generations to be absent from the target.

`passage-replication.ts` copies one immutable provision or publication passage generation into the separate
`legislation_passage_search` database. Apply `infra/passage-search/legal.sql` to provision its independent tables; the
bill projection is unchanged. Target advisory locking precedes source reads. Published membership and active rights
remain locked until target commit. Copying validates exact canonical manifests, input hashes and ownership, uses
100-row pages with an 8 MiB write-batch cap, and refuses generations above 10,000 passages or 64 MiB. A 60-second
aggregate deadline bounds work between statements. Every replay verifies metadata and all retained target rows;
partial or corrupt copies fail closed. Failed inserts roll back the whole target generation.

This is a private immutable snapshot, with PostgreSQL FTS for a lexical canary. It does not implement BM25, public
query authorization, rights-revocation tombstones, current-version selection, complete-edition acknowledgement or
global readiness. Rights may change after copying; callers must not treat retained target text as authorization.
The separate-database integration test additionally requires `REGULATORY_SEARCH_TEST_DATABASE_URL`, pointing at a
disposable local `legislation_passage_search` database. Its target tables are truncated by test setup.

The generic `import:regulatory-backfill` importer is restricted to an explicitly configured loopback `regulations_test` database and checks
the connected database name. Preview needs no database. Apply accepts the same saved manifest/raw/normalized paths as
the preceding stages and an exclusive new report path. It does not migrate or seed the target automatically.

```powershell
# Run from apps/legislation after migrating a disposable database and seeding its canonical US jurisdiction.
# REGULATORY_TEST_DATABASE_URL must point to that local regulations_test database.
pnpm tool regulations/import-regulatory-backfill --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --raw artifacts/regulatory-backfills/raw --normalized artifacts/regulatory-backfills/normalized --limit 5 --report artifacts/regulatory-backfills/federal-pilot-storage-2026-09-14.json --apply
pnpm exec vitest run src/ingestion/regulations/storage.integration.test.ts src/ingestion/regulations/storage-contract.test.ts
```

`--limit` selects the first N manifest units. A replay revalidates retained files and reuses immutable generations.
Failed and blocked units produce nonzero exit status. A bounded run reports units beyond the limit as pending.
Database tests use a separate disposable instance from the retained pilot because their setup truncates regulatory
test tables. Integration tests are skipped when the dedicated environment variable is absent; those skips are not passes.

The PostgreSQL checks exercise replay, partial staging, immutable-record conflict rollback, competing/replaced leases,
missing canonical children, out-of-order editions, unchanged versions, moved parents, retained historical text, stale
head comparisons, same-date correction rejection, revoked rights, real-source date/corpus blockers and foreign keys.
Fault injection at outbox insertion tests rollback after a head write, both for an outbox failure and mid-transaction
lease expiry. A damaged raw file is rejected before registration. A 206-record hierarchy crosses transaction boundaries.

Actual pilot counts, timings, reports and final verification are recorded in [implementation progress](implementation-progress.md).
The earlier eCFR focused run passed all 18 checks, and root `pnpm verify` passed. That retained pilot contains 40,441
canonical eCFR members with zero comparison mismatches; its 431 annual CFR/FR staging rows remain unchanged. The later
separate FR pilot described above has 63 canonical publications, and the expanded focused run passed 23 checks.
