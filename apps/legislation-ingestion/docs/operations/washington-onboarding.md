# Washington onboarding

Washington is the next user-selected jurisdiction. Reuse the shared retained-source, batch ownership, promotion,
document/OCR, embedding and search pipelines. Do not activate schedules until the complete acceptance gate passes.
Initial extraction concurrency is one; retain the existing global content-worker ceiling and publisher limits while
North Carolina drains. No new provider, database or embedding model is approved by this onboarding.

### Latest verified release and replay checkpoint

Full `pnpm verify` for `6e604d2` completed successfully (10729), including 240 API acceptance cases and
built MCP checks. Its optional database and positive-corpus skips are not production acceptance evidence.
Docker `legislation-wa-acceptance` was confirmed running on loopback port 55461. An explicit isolated
`LEGISLATION_INGESTION_TEST_DATABASE_URL` run passed all 30 ingestion persistence integration tests, including
retained event relationship replay and changed-evidence rejection. No production database was used.

The separate API database suite against disposable `legislation_test` passed 31 tests, failed one and skipped 14.
The failure is outside Washington ingestion: `subscription-repository.test.ts` expects a duplicate active
subscription to map to `category: conflict`, but a Drizzle-wrapped PostgreSQL `23505` on
`subscriptions_exact_active_uidx` escapes unchanged. This additional suite is not green; record this separate
API defect without changing unrelated subscription code as part of state onboarding.

Read-only inspection of the five older Open States UUID meetings confirms all five lack publisher-local date,
source URL, retrieval/update timestamps, and any upstream identifier beyond their Open States UUID. Their event
times fall on September 15-16, 2026. No matching UUID was found in the scoped retained Washington foundation,
meeting-canary or event-window JSON artifacts; this is not proof that no other retained copy exists.
The next identity-check route is an upstream event response with explicit publisher references, not a name/time join.
Using the production-configured `OPENSTATES_API_KEY` through the existing client returned HTTP 401 from
`https://v3.openstates.org/events`. The retrieved credential was nonempty, not masked, not a recognized placeholder,
and had no surrounding whitespace. A credential refresh was requested without exposing its value.
No meeting was merged/deleted and no credential was changed. This API authorization gate is separate from the
publisher-maintenance timeout affecting the direct Washington scraper.

Brad Hawkins has a partial, exact-file-hash-bound review correcting the House start from January 1 to
January 14, 2013. The official first-day House journal contains his district 12 election certification and the
members' oath. Visually inspected member-history PDF page 51 (printed 45) confirms House service in 2013/2015
and Mike Steele in 2017; visually inspected 2017 Senate journal PDF page 14 (printed 9) confirms Hawkins's
January 9 Senate oath. The conflicting supplied House end remains held pending exact handoff evidence;
neither supplied end date is certified by this partial review. No canonical or production write was made.
Sources: https://lawfilesext.leg.wa.gov/law/Journals/2013/HJ_13_001.htm and
https://leg.wa.gov/media/s4zhym3d/2017senatejournal.pdf.

Eight focused review tests pass. Full retained-pair preparation still produces 337 people, 383 terms,
14 accepted reviews, six structural holds and zero coverage issues: Hawkins remains quarantined for overlapping
roles. Full verification for this partial review passed as 10729. The January 2025 Senate end also needs
independent verification; county office commencement alone must not be substituted for a Senate resignation date.

Washington's official website publishes a September 19 scheduled-maintenance notice (7 AM-7 PM), consistent
with both hosted extraction and local publisher connection failures. Do not spin up repeated replacements during
the outage. Source: https://leg.wa.gov/about-the-legislature/legislative-agencies/leap/.

Leonard Christian now has an exact-file-hash-bound role review: correct the 2014 role to House and remove the
contradictory 2013-2014 duplicate and erroneous 2023-2025 Senate assertion. The official member-history book,
PDF pages 29-30 (printed 23-24), visually confirms the January 8, 2014 House appointment and successor
McCaslin's November 25, 2014 oath. The 2025 Senate journal confirms Christian's new January 13 Senate oath.
His existing 2023 House role is preserved, including its **not independently verified January 6, 2025 end date**;
that date remains an open evidence item and this is not a claim of fully verified history.

Full retained-pair preparation produces 337 people, 383 terms, 14 applied reviews, six structural history holds,
and zero coverage issues. Christian has exactly three prepared roles. Twelve focused review/refresh tests pass;
full `pnpm verify` (89272) completed successfully, including built MCP acceptance. The optional positive disposable-
corpus acceptance remains explicitly skipped, not proven by this run. No production foundation import or deployment
has applied this new review.

Host-reference fix `41af79f` passed full `pnpm verify` (86708), including 240 API acceptance cases and built MCP
acceptance; optional database and positive-corpus skips remain explicit. It has not been deployed.

Read-only inspection of all 90 retained archives identified exactly six missing publisher host identities for the
32 official-agenda records. None currently has an accepted numeric identity mapping:

| Publisher reference suffix (prefix `waCommitteeId:2025-26:`) | Code | Held agendas | Source host |
| --- | --- | ---: | --- |
| `other:21488` | I900 | 18 | SAO audit-hearing body, also named JLARC I-900 Subcommittee |
| `other:18059` | TAX | 7 | Citizen Commission for Performance Measurement of Tax Preferences |
| `other:-141` | SLC | 3 | Statute Law Committee |
| `joint:18048` | ADJLEC | 1 | Aging and Disability Issues joint committee |
| `other:-12` | LEAP | 2 | Legislative Evaluation and Accountability Program |
| `joint:35341` | empty | 1 | Joint Select Committee on Civic Health |

The two SAO names share exact publisher identity `other:21488`; do not create two organizations from their names.
Organization summary projection requires verified classification, active state and provenance; a meeting observation
alone does not supply all those facts. Supplemental imports must reuse entity persistence, preserve existing rosters,
and keep detail/child/membership completeness false unless independently established.

Bill worker `run_06gbkk4g2pgkbdret7blq51601` is terminal `FAILED` with `source_timeout` (extractor exit 1).
Committed receipts remain 84/342 and there is no current ownership lease. Local publisher API and document requests
also timed out. No replacement has been dispatched: verify source recovery and settled worker state before resuming
the exact pending batch `8202e6af1d3e59f4ebb2a1616eedb58c3f00c87449bc3d8216d264d1806c1f5d`.

The Washington event adapter now preserves signed, biennium/agency-scoped publisher host IDs for `Other` and
`Agency` records instead of dropping them. It reuses the existing shared unique-identity resolver; no organizations
are created and no code-only alias is admitted for these categories. Eighteen focused tests pass, including
missing/ambiguous matches, wrong jurisdiction, wrong biennium and abbreviation-only candidates. A real retained
SAO meeting (32331) now emits `waCommitteeId:2025-26:other:21488` and remains unready with no accepted mapping.
Full verification (86708) passed; the change is not yet deployed. Publisher host-catalog ingestion remains open.

Primary-source research confirms the missing hosts cannot simply be mapped onto JLARC: the official SAO agenda
names its own audit-hearing body, and the Legislature has a separate archived profile for the aging/disability
joint committee. Preserve distinct identities and historical active states when adding source-backed organizations.
Sources: https://app.leg.wa.gov/committeeschedules/Home/Agenda/32331 and
https://leg.wa.gov/about-the-legislature/committees/joint/adjlec/.
Alias dry-run retry 4698 also stopped on a publisher connect timeout; no apply was dispatched.

All 90 retained calendar replay runs are now complete. Every retrieved output reports `reconciled`, with 90
distinct window IDs and the expected plan `c2e3cc9c1b0f9fdcbd5dd40c8f4aa20fe8128c2740e85ceebb267daffac97a42`.
Output totals are 1,453 event snapshots, 6,336 bill links and 1,424 organization links. Link totals are not counts
of ready events: meetings can have multiple hosts. PostgreSQL has 1,458 Washington events, of which 1,421 have
complete organization relationships and summary readiness. The 37 held records comprise 32 official-agenda
records and five older Open States UUID records with null publisher dates and source URLs. Do not delete or
merge those five from title similarity; source-identity evidence is still required.

The 32 official-agenda host gaps are: SAO performance audits (17), tax-preference citizen commission (7),
Statute Law Committee (3), LEAP (2), JLARC I-900 subcommittee (1), aging/disability joint committee (1), and
Civic Health joint committee (1). They remain an explicit coverage gate, not failed replay runs. Resolve hosts
through retained publisher identities and accepted organization records, never event-title matching.

Bill refresh has 84/342 committed receipts and one current ownership lease. The next alias dry run covers
HB 1355-1379 (139 candidates, no held groups), but both attempts stopped on publisher connection failures
(`ECONNRESET`, then connect timeout) before any apply. The verified cleanup cursor remains HB 1354.

The shared lock-contention retry passed full `pnpm verify` (1014). The guarded HB 1330-1354 alias apply
(58341) completed, and its repeat dry run returned zero candidates and zero held groups. The verified cleanup
cursor is now HB 1354; all 149 removed untouched aliases remain recoverable from reconciliation checkpoints.
This reuses the shared transactional reconciliation path rather than introducing Washington-specific mutation logic.

Implementation boundary: jurisdiction adapters translate publisher formats and identifiers. Ownership, retained-source
validation, idempotent persistence, relationship replay, document extraction/OCR, embeddings, search synchronization
and acceptance checks remain shared. Person-specific historical corrections belong in hash-bound review data with
primary-source evidence, not branches in the ingestion engine. Unverified transitions remain held.

The HB 1305-1329 alias cleanup completed on its same-page retry (11394). Repeat dry run returned zero candidates,
zero held groups and a complete page; verified cleanup cursor is now HB 1329. Removed rows remain recoverable
from audit checkpoints. The lock retry fix is committed as `3bddc6a`; type/lint and 23 focused tests pass, with
full verification 1014 still running. The next dry run (61040) covers HB 1330-1354: 149 candidates, no held groups,
still verifying publisher bytes; no apply has started.

Authenticated production MCP reads succeeded for meetings `wa-agenda-32344` and `wa-agenda-32345`, with the
canonical Local Government committee. Meeting 32345 exposes the four expected bill links SB 5055, SB 5053,
SB 5089 and SB 5018 and official publisher provenance. The unresolved SAO meeting 32331 remains hidden by the
readiness gate (`not_found`), so its endpoint coverage is explicitly not closed. Full calendar reconciliation
reached 52/90 completed, one executing, 37 queued, and no failed runs at the latest inspection.

The read-only input-hash audit at `2026-09-19T15:23:18.468Z` passed for all 3,413 bill vectors and 92,940
existing document-section vectors: zero missing and zero stale routed embeddings. This does not include text for
pending documents, lexical synchronization or full search acceptance. A separate status snapshot found 19,493
processed documents, 385 pending and seven unsupported; the pending count can include untouched aliases still
being reconciled and is not an OCR-required count. Calendar replay reached 28 completed, one executing and 61
queued, with no failed runs.

Alias apply 2901 stopped safely on PostgreSQL `55P03` while locking a bill. Same-page retry 11394 resumed with
97 remaining candidates; keep the verified cursor at HB 1304 until completion and repeat dry run. The repair CLI
now uses a reusable bounded lock-contention retry: at most three complete, rolled-back attempts with one/two-second
backoff. Every attempt revalidates source hashes and dependencies under locks. Validation failures, connection
errors and statement timeouts are not retried. Twenty-three focused tests pass; full verification is running (1014).

All 90 initial calendar windows have committed, verified receipts. The second retained replay canary
`run_06gbkfn6qdifo75cihsbolq401` completed with 86 events, 86 organization links and 344 bill links; independent
PostgreSQL read-back confirmed those counts against its retained source IDs. After confirming no active calendar
or replay runs and validating all plan receipts, all 90 replay identities were dispatched on version 36 using
global per-window idempotency keys (the two canaries reused their existing runs). Dispatch 49027 completed.
Latest task inventory: four completed, one executing, 85 queued, no failures; actual concurrency is one.
The final queued run is `run_06gbkgdd64533pmrj8394vn201`. Full replay acceptance remains open until all results
and unresolved source relationships are inspected. Bills are at 77/342 committed batches with one live owner.
Full `pnpm verify` including the new persistence test passed (88420); its default database skips do not replace
the explicit positive isolated PostgreSQL run described below. Alias dry run 34440 completed through HB 1329;
guarded apply is active as 2901. Keep the verified cleanup cursor at HB 1304 until apply and repeat dry run finish.

Trigger `20260919.36` deployed without promotion (`hx6dcxkp`, 71 tasks,
image `24e1187ae6892ffc53bc058ae5b1860203bc859029d51973eeb309ec91a492a6`). Retained replay canary
`run_06gbkf7vr8hosh58qsj92qdt01` completed: 39 events, 38 organization links, zero bill links.
Independent retained-source/database read-back confirmed all 39 canonical IDs and 38 linked events. The single
unresolved event is `event:openstates:wa-agenda-32331`, publisher name "Other Committee to Hear SAO Performance
Audits", with no resolvable host references; its organization readiness correctly remains false. This is not a
missing-event failure or permission to guess a committee identity. A second, 86-event retained-window canary is
running as `run_06gbkfn6qdifo75cihsbolq401`. Verify that result before expanding replay across the full calendar.
The shared database safety test is committed as `9efc0d0`. Calendar worker `run_06gbkeuabtthgrijn9rtd8cl01`
was confirmed live; no replacement calendar worker or schedule was dispatched.
The next alias dry run after HB 1304 is active as 34440 (154 candidates, no held groups); no apply yet.

Retained meeting replay `c24c6af` passed full `pnpm verify` (10453), including 240 API acceptance cases and
built MCP tests. Default optional database/positive-corpus skips remain explicit. An additional isolated PostgreSQL
test passed against `legislation_ingestion_test` on port 55461: two identical relationship replays preserve exactly
one bill link and one session link, while changed event facts or agenda identities reject without losing links.
The test is now part of the shared persistence integration suite. Verification including this added test is running
as 88420. Trigger version `20260919.36` is building without promotion (46801); hosted replay is not yet dispatched.
The latest direct receipt count is 88/90 calendar windows; bills were last observed at 72/342 committed batches.

The version 35 refresh gate is verified: `run_06gbkb0fmtklbl9u8t16bm8101` completed its required import,
and the persisted review digest matched the local state/revision-scoped digest. A second unchanged refresh,
`run_06gbkbvfijtn3mf2i6a2c9eb01`, completed with `no_change`. This closes review-aware refresh invalidation.
The HB 1280-1304 guarded alias apply (93473) completed; the repeat dry run returned zero candidates and zero
held groups. The verified cleanup cursor is HB 1304; the 307 removed untouched aliases remain recoverable
from reconciliation audit checkpoints.

Retained meeting-link replay is implemented as `openstates-event-window-reconcile`. It validates the promoted
window receipt and retained manifest, then uses the shared event relationship writer, which rejects changed
canonical event or agenda evidence. It shares the serial calendar queue and never dispatches a scraper.
Thirteen focused tests pass. Repository verification is running (10453); deployment and hosted replay remain open.

Trigger `20260919.35` deployed successfully without promotion: deployment `szinz4le`, image
`f897057a1300336ce8fb7bd2c04f5496793234646b3499ea87705e1281b23f32`. Refresh canary
`run_06gbkb0fmtklbl9u8t16bm8101` is executing against the retained upstream revision. Its expected first result is
an import because the previous checkpoint has no review digest; verify the persisted digest and a subsequent
`no_change` response before closing the refresh gate. No foundation task was active before dispatch.
Alias dry run 65742 completed through HB 1304; 307 candidates passed checks with no held groups. Guarded apply
is now running as 93473. The last verified completed cleanup cursor remains HB 1279.

Full verification for shared review-refresh fix `bb7fb42` passed (20720), including API/built MCP acceptance.
Default optional database and positive-corpus skips remain as described below. The live API/importer compatibility
check passed. Unpromoted Trigger deployment is now building in session 8743; do not dispatch its refresh canary
until deployment success and exact version are confirmed. No schedule or global promotion changed.
Latest receipt inspections show 67 promoted bill batches and 81/90 calendar windows, with active runs
`run_06gbk9rtlh21tcfaq6msf3e901` and `run_06gbka43pqtr92gj502g5ssl01` respectively.

Historical research: the official January 13, 2014 House journal at
`https://lawfilesext.leg.wa.gov/law/Journals/2014/HJ_14_001.htm` reproduces Spokane County's January 8 appointment
of Leonard Christian to House District 4 Position One, until his successor qualifies. This contradicts the archived
2014 Senate assertion and 2013 House start. The successor qualification boundary still needs primary-source
verification; no Christian role correction has been applied. The old House Republican successor announcement
returned HTTP 403, so its search/secondary references are not sufficient acceptance evidence.

Duplicate-free production replay `run_06gbk9eih3vtv6t2gqcvd8bl01` completed with unchanged 337 people/381 terms
and seven holds. Dufault read-back again contained exactly the same two canonical term IDs and date ranges,
without an undated fallback. This closes his production correction/replay gate, not the seven other history holds.
Shared review-refresh fix is committed as `bb7fb42`; full verification 20720 is still running before deployment.
The next alias page after HB 1279 is undergoing dry-run byte checks (65742): 307 candidates, no held groups.
No apply has been started for that page.

The version 34 foundation replay completed with 337 people, 381 terms, 13 applied reviews and seven historical
holds. Direct production read-back confirmed Dufault's undated fallback was replaced by exactly two canonical
terms: January 14, 2019-January 8, 2023, and January 13, 2025 onward. A second identical retained replay was
dispatched as `run_06gbk9eih3vtv6t2gqcvd8bl01` after confirming no foundation task was active, to verify no duplicates.

The generic refresh invalidation fix is implemented locally: the people checkpoint stores a deterministic digest
of reviews scoped to state and upstream revision; refresh cannot skip when that digest is missing or changed.
Unrelated states/revisions do not change the digest. This preserves the existing source revision and supplementary
committee inventory checks. Nineteen focused tests pass; full verification is running as 20720. Deploy this change
without global promotion, then verify one required refresh followed by `no_change` for unchanged inputs.

The HB 1255-1279 guarded alias apply completed (61318), removing 200 untouched duplicate rows. A repeat dry run
from the same HB 1254 boundary returned zero candidates, zero held groups, and a complete page. The verified
cleanup cursor is now `bill:wa:2025-2026:hb:1279`; audit checkpoints retain removed rows for recovery.
Foundation replay `run_06gbk8ib6q2hlr5pdrveq6su01` was confirmed executing on version `20260919.34`.

Full `pnpm verify` for `21fbe82` completed successfully (96350); default database suites still skip without explicit
test database configuration, and the default positive-corpus acceptance remains skipped. The deployed API/importer
contract check also passed. Trigger version `20260919.34`, deployment `747c0aam`, image
`30415ede234499d56b8c7e7757455e502296cc611b3f20fcd07f9f92b27d0eda`, deployed without global promotion.
After checking both foundation task types had no active or queued runs, retained Washington replay was dispatched
as `run_06gbk8ib6q2hlr5pdrveq6su01` with a global idempotency key bound to the review commit/version. Before replay,
Dufault had one Open States lower-chamber roster term with null start/end dates. Verify replacement with the two
reviewed terms and duplicate-free repeat replay before closing this correction's production gate.

An automation gap remains in `foundationSourcesUnchanged`: the skip decision compares upstream revision and
committee inventory, but not the local review-data revision. Explicit immutable replay handles this release;
the shared refresh gate should also detect review changes so future reviewed corrections do not require manual
replay when upstream bytes remain unchanged. Keep that fix generic and source-bound.

The next historical review removes Dufault's duplicate 2019-2023 role through the existing exact-fingerprint
review data, without changing engine logic. The official 2023 House Journal, PDF pages 11 and 15 (printed 7 and
11), identifies Sandlin's District 15 Position 2 election and the January 9 members' oath. Both pages were visually
checked. Retained research PDF SHA256: `c38f5ac23e6dd739e036ffad5af04e91c4d5598f4986634b514242841b0ef29d`.
Local replay of the full retained pair now yields 337 people, 381 terms, 13 applied reviews, seven historical holds,
and zero coverage issues; the single-person replay yields exactly two terms without quarantine. All 24 focused
people review/import/quarantine tests pass. Production still has the previous review set until verified deployment
and retained foundation replay; do not report seven holds as the production count yet.

Live receipt inspection reached 61/342 promoted bill batches, with `run_06gbk661pi2694gsunn4vdp801` executing.
Calendar receipts reached 74/90 windows, with `run_06gbk67gh6co9da85tosgak801` executing. NC 2003's existing
controller `run_06gbk4rvcfmsbdnc1amgj61o01` was also executing. No replacement or overlapping jobs were launched.
The next alias page after HB 1254 has 200 candidates and no held groups. Its dry-run byte checks completed
(90212), and guarded apply is running as 61318 through HB 1279. This does not advance the completed cleanup
cursor until apply completion and a zero-candidate repeat dry run. Full verification for review commit `21fbe82`
is running as 96350; production deployment and foundation replay remain pending.

Railway deployment `d2080fd2-f894-4727-8901-f236cc4a47c2` of committed fix `7a7e523` is successful.
The final full `pnpm verify` run (25266) passed before deployment. An authenticated production MCP
`get_bill_text` recheck for HB 1002's exact HTML document returned both nonempty sections with
`isOfficial: true`, no warnings, and no next page. This closes the official-document projection finding below;
it does not close statewide content or OCR acceptance.

The HB 1230-1254 alias page completed its guarded apply (72173), removing 163 untouched duplicate document
rows. A same-cursor repeat dry run returned zero candidates, zero held groups, and `pageComplete: true`.
The last verified completed cleanup cursor is now `bill:wa:2025-2026:hb:1254`. Removed rows remain recoverable
from reconciliation audit checkpoints. Processed aliases are still held rather than losing dependent content.

Keep Washington DRY: source adapters and jurisdiction configuration describe source differences; shared ownership,
replay, person reconciliation, document/OCR, embedding, search, and acceptance components own the workflow.
Source-backed historical corrections belong in the existing fingerprint-bound review data, not identity-specific
branches in the ingestion engine. Regular Washington syncing remains gated on complete acceptance.

### Authenticated bill, vote and document acceptance

The post-activation-fix full `pnpm verify` run completed successfully (session 69406). Its default positive
database-backed MCP test remains skipped without a supplied corpus; the separate disposable-corpus acceptance below
is the positive database evidence. No unrelated search worktree changes were staged.

Authenticated production MCP returned HB 1002 and HB 1480. HB 1002's February 10, 2026 final-passage vote contains
98 positions mapped to 98 distinct canonical people, with no unmapped positions. An independent fresh fetch of
`https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetRollCalls?billNumber=1002&biennium=2025-26` matched all
98 source names and vote choices with no missing or extra positions: 70 yes, 24 no, four excused (canonical `other`).
This validates source-name/choice fidelity and complete person linkage, not an independent biographical review of
each linked person. Exact HTML version `bill:wa:2025-2026:hb:1002:document:c8e3ff0f54f1cd51440519c4` returned two
nonempty sections with canonical document/section URLs and no additional page. This is existing extracted content,
not evidence that the refreshed statewide content backlog or OCR acceptance is finished.

Open acceptance findings:

- HB 1002 still has one unlinked sponsor (`Scott`), while the later HB 1480 refresh links Shaun Scott. Reconcile
  relationships through the shared import/replay path; do not add a name-specific SQL fix. A read-only production
  candidate check resolves `Scott` uniquely to Shaun Scott on first reading, January 13, 2025, but returns not-found
  on prefiling, December 2, 2024. His persisted term starts January 13; Elizabeth Scott's term ended in 2018.
  The existing shared `sponsorObservationDate` prefers first reading to prefiling and has this date regression test.
  Replay with current normalization is still required; do not assume the missing link is just stale foundation data.
  The shared `buildScraperPersonBackfillPlan` subsequently ran in a read-only production transaction: 337 candidate
  people, three of three null sponsor links planned, zero sponsor conflicts, 134,122 of 134,130 null vote links
  planned, eight not-found and zero ambiguous. HB 1002 explicitly plans Shaun Scott. Snapshot digest:
  `958cfae22c49bc0736dbd4302748b3a314341c7e0fab9baab370ab52c3a90130`. No writes were made and this changing snapshot
  is not an apply authorization. Existing `openstates-scraper-person-reconcile` requires a fully promoted bill plan
  before recomputing and atomically applying null-only links, then starts content processing. Preserve that gate.
- SB 5000 remains unavailable through bill detail because canonical action provenance is not persisted. The full
  bill refresh has not reached this Senate record; verify again after its batch, preserving the fail-closed contract.
- Washington official document URLs currently project `isOfficial: false`. The document projection's official-source
  classifier recognized federal sources only. The shared document projection now recognizes the publisher-owned
  `leg.wa.gov` root and its subdomains alongside Congress/GovInfo, with HTTP(S)-only, credential-free URLs and exact
  domain boundaries. The [official legislature site](https://leg.wa.gov/) confirms the publisher domain. Aggregators,
  lookalike domains and arbitrary government hosts are not elevated. All 24 focused canonical-read tests pass.
  This corrects document/section projection without rewriting stored provenance for aggregated actions or votes;
  deployment and authenticated production recheck are still required.

At this inspection the calendar chain had completed 62/90 windows and dispatched
`run_06gbjva0oeetsjinkbmp2kbo01`. Bill dispatch `run_06gbjv2702micvrg12t8lonj01` completed and launched
`run_06gbjv3hcgbd3j4jbi2r0jh001`. Both NC recovery controllers listed below were executing on version 33.
The HB 1205-1229 alias apply completed successfully (session 41002), removing 307 untouched duplicate rows after
fresh byte/dependency checks. A repeat dry run returned zero candidates and zero held groups with a complete page.
The completed deletion cursor is now HB 1229. Removed rows remain in reconciliation audit checkpoints for recovery.
The next 25-bill page is dry-run only until its byte checks complete.

NC recovery controllers both completed their time budgets without failure and handed off: NC 2003 continued as
`run_06gbk2hf9a6decp4oar5d7sk01`, and NC 2011 as `run_06gbk2kfehj8trbat5lgmnvt01`. Their outputs explicitly keep
`ingestionComplete: false`. The calendar chain reached 64/90 windows and continued as
`run_06gbk0fr45vp4vlbf5qaclh301`; bill batch work continued as `run_06gbjvqml531gc5qlmogap6o01`.

Provenance fix `7a7e523` has a clean committed-source deployment snapshot prepared, excluding all untracked files
and unrelated staged search changes. Full verification is running (session 25266; web coverage passed). Railway
CLI read-back confirms web service `786fbca7-8798-4357-9b45-f0ba092a9750`, project
`2378281c-c1c7-4530-8525-5f313741d19b`, production environment `9657912c-7bf8-4ec7-a9c5-387bf3df790d`, repository-root
Docker context, `apps/legislation-web/Dockerfile`, and `/ready`. The preceding successful deployment is
`9a75c51a-6745-4996-89a3-8aac97c0f2ad`. No deployment of the fix has been submitted yet; wait for the verification
verdict and recheck for intervening releases before uploading. Railway MCP authentication is unavailable, while
CLI access succeeds; no credentials or service configuration were changed.

Verification session 25266 subsequently completed with exit zero, including 240 web acceptance tests and built
MCP/runtime checks. Database tests without configured test URLs remained skipped; previously recorded isolated
database tests are separate evidence. Clean commit `7a7e523` was uploaded to the explicit production web service as
deployment `d2080fd2-f894-4727-8901-f236cc4a47c2`. Upload is not deployment success: inspect that exact deployment
and recheck authenticated document provenance before closing the release gate. The HB 1230-1254 dry run completed
with 163 candidates and no held groups; apply session 72173 is running, so the completed cleanup cursor remains
HB 1229 until terminal apply and zero-candidate replay. No Washington schedules were enabled.

### Cross-state content activation recovery

Hosted inspection found older North Carolina content controllers on `20260919.6` failed when their global enabled-state
list included Washington, which that deployment did not recognize. Examples include `run_06gbi9e2t4qo7rlnh8m7nnk601`
(2003) and `run_06gbi9bahmdgdai04atf5ic301` (2011). The shared activation guard now validates each configured entry's
two-letter shape while requiring local implementation support and explicit enablement for the requested state only.
An unrelated future-state entry cannot disable NC/AK, and unsupported requested states still fail payload validation.
Seventeen focused policy/task tests passed. This fix requires deployment and deliberate resumption of terminal failed
NC scopes after checking current ownership; immutable old workers are not repaired by a local code change. No NC run
was restarted or cancelled during this inspection.
The follow-up server-filtered Trigger inspection returned no executing, waiting, queued, delayed, reattempting or
pending-version content controllers/workers (no further pages). Database inspection found no content locks for
`nc:all`, `nc:2003` or `nc:2011`. Candidate `20260919.33` is building without promotion after the deployed importer
contract check passed; successful deployment and resumed-run results are still required.
Deployment `20260919.33` subsequently succeeded without promotion (`ae55rwrc`, image manifest
`0c5563b41c977572069a0acc969a5bf90afbd5dcbf11b44edb68d2ad8dd5ed2f`). Single-bill recovery canary
`run_06gbjvs06ul5bngfpad5kt6v01` completed: NC 2003 SB 765 processed one document, inserted one embedding and skipped
five existing vectors, with no document, OCR or embedding failures. This validates the activation repair in the hosted
runtime; it does not mean the NC backlog is complete. WA extraction chains remain on their existing pinned versions.
After repeating the empty-runtime and database-lock checks, two idempotent version-33 controllers were queued with
their previous 10-bill, concurrency-two limits: `run_06gbk05lvqcn7gev8paj89qv01` (NC 2003) and
`run_06gbk05mvr0tbd3a0d7tcaa601` (NC 2011). The shared content queue remains limited to two workers. No schedules were
created or changed. Other failed NC scopes still require inventory and controlled recovery; do not assume these two
controllers repair them.

## Requirements and evidence

### Shared committee reference resolution

Event organization references are grouped by host. Each group can carry multiple publisher identifiers, but all
matching identifiers must resolve to exactly one canonical organization in the event's jurisdiction. Conflicting,
missing or empty host groups keep relationship readiness false. Multiple identifiers for one organization do not
produce duplicate relationships, and distinct hosts remain separate requirements. NC, AK and WA use this one resolver.
Washington now also supplies biennium-scoped numeric committee IDs. The official 2025-26 inventory was retained at
`openstates/committee-inventories/wa/2025-26/c1561487f80e3c20b7b8ecbf54c9f5236c2c4ecb48cc87ca6d436072aa9dfdd6.xml`.
All 34 entries matched unique existing organizations; production import and replay preserved identical identifiers
and the existing 51 organizations / 609 membership snapshot. Manual Washington foundation replay requires this
retained crosswalk so it cannot silently remove the numeric identifiers. Foundation refresh now acquires and retains
the official inventory with a 30-second timeout, 2 MiB bound and redirects disabled. It compares the inventory hash
as well as the people revision before declaring no change. Refresh dispatch keys include the scheduled observation
timestamp, permitting source changes within an unchanged people revision while deduplicating the same invocation.
Washington scheduling remains unenabled; hosted refresh acceptance is still required.

Meeting 32344 was reconciled from its retained window without rewriting source facts. Its old `LGLT` abbreviation
and current `LGV` committee resolve through official Senate ID 34080. Authenticated MCP `get_event` returned the
canonical Local Government committee and one agenda item. This is one verified recovery, not complete statewide
meeting acceptance. No name-specific correction was introduced. The prior full verification exited unsuccessfully
in web coverage; focused ingestion checks pass, but full repository acceptance remains open.

The focused inventory/import/event/task suite passed 24 tests, with ingestion types and lint passing. Commit
`e0012df` contains the crosswalk implementation; it has not yet been deployed to hosted calendar continuations.
The preceding full verification had eight `voteAttribution.test.ts` failures: the test expects `e1`-style IDs but
receives UUID evidence IDs. The unrelated web search worktree was left untouched.

At the subsequent live inspection, 44/342 bill batches were promoted. HB 1440-1449 run
`run_06gbjjj8rkqrco8m88mfd2rb01` failed with retained `source_http_server_error`, exit 1 and no bill output.
Two ownership checks showed no active owner. One idempotent retry, `run_06gbjmko5h2dcs42o3jp7vb001`, was accepted
on `20260919.29`; do not start another retry without inspecting that handle. Calendar run
`run_06gbjlv5g0db1bqqr6pvu10101` was executing on its existing pinned `20260919.27` chain. No schedules or concurrency
limits were changed.

The subsequent refresh-focused suite passed 24 tests, plus ingestion types and lint. The bill retry was verified
`EXECUTING`; calendar continuation reached 54/90 windows and dispatched `run_06gbjme7dkinun7iau3l6lju01`.

Unpromoted deployment `20260919.31` (`ju803at3`, manifest
`9d7d791050408587b9badb598f5413623d0b33ad39cc6528142266dcaf71eb9f`) contains the identity and refresh wiring.
Version-pinned hosted refresh `run_06gbjo205l80mhubltgmeoeq01` completed with `no_change`, proving the official
inventory can be acquired, retained and compared from the hosted runtime. Existing extraction chains were not
cancelled or moved. An additional local fix preserves the original retrieval time when replaying the same retained
people revision after a supplementary source change, while still rejecting changed file bytes. Its six focused
tests, types and lint pass; this later fix still requires deployment. Full verification remains unaccepted because
of the separate web vote-attribution evidence-ID assertions.

Replay fix `5f80b76` is now deployed unpromoted as `20260919.32` (`u2kkr7bk`, manifest
`29f008edaddf241c94f2e4a24b9bcf1ebaf82068d5df9613bba2087ae6dc92a0`). The first hosted foundation replay
`run_06gbjp1ti7ric7b2bqgf3sgh01` failed before canonical writes because the history manifest was only local.
Both validated local lanes were then copied byte-for-byte to Azure, with 200 current-lane and 263 history-lane
objects verified before publishing their manifests; remote read-back verified 198 current files and 261 history
files. Corrected replay `run_06gbjplnec119io8tu3snhjg01` completed with `foundation_imported`: 337 people,
380 terms and committee observations imported. The eight held histories remain excluded; this is not full acceptance.

Repository verification subsequently passed (`pnpm verify`, exit 0). Its default database lane still skipped 233
tests, so this does not establish database acceptance. A separate disposable PostgreSQL instance then ran the ingestion,
entity, bill-receipt and organization-dependency integration suites: all 80 tests passed. Two stale test contracts were
corrected: Open States replay now seeds its required chamber directory, and Congress retry assertions verify the durable
retry checkpoint and its removal after successful replay. No production retry behavior was changed for these tests.

The eight web assertion failures were traced to the test expecting run-local `e1` identifiers where the production
model projection intentionally uses stable UUID evidence identities. Commit `a03e0af` corrects that assertion,
preserving exact data and citation-anchor checks. All 105 focused evidence/vote tests passed (the worker reported a
shutdown timeout, with exit 0). Repository coverage and Python then passed in the active verification run; database
checks reported 233 skipped tests and four passes because most test connections were not configured. Acceptance
was still running at this observation, so this is not full environment acceptance.

The bill source-error retry progressed successfully; the latest receipt inspection reports 48/342 promoted batches
with one next-batch owner. Calendar receipts report 60/90 completed windows. No recurring schedule is enabled.
The document-alias page after HB 1154 completed 308 audited removals through HB 1179. Read-only replay of that exact
page found zero remaining candidates and no held groups. Canonical documents and dependent content were preserved.
The following 25-bill page completed 193 audited removals through HB 1204; read-only replay found zero candidates and
no held groups. The page after HB 1204 is undergoing read-only verification of 307 candidates, with no deletions yet.
The full ingestion database project also ran against the isolated database: 80 passed and 83 regulatory-specific
tests skipped because their separate connections were not configured. Those skips are not accepted as passing tests.
Additional isolated API/database checks passed 18/19 tests. The supporting-material lexical pagination fixture failed
at `schema.integration.test.ts:784`: its first equal-score page returned material 1100 instead of expected 1099 at
the boundary. Investigation confirmed the documented query intentionally samples by section ID before ranking material
IDs. Unpadded section suffix 99 falls outside the fixed 250-section sample; material 1250 belongs inside it. The stale
fixture expected a material-ID sample instead. The corrected test checks exact sampled membership across all three
pages, 250 unique results, cursor binding and the capped `truncated` flag. All 19 isolated API/database checks now pass.
No production query or unrelated dirty search implementation was changed. This establishes the bounded sample contract,
not exhaustive corpus recall or live statewide search acceptance.

The subsequent full `pnpm verify` completed successfully, including 240 web acceptance tests and built MCP acceptance.
Default database skips remain separate from the 80 ingestion and 19 API/database tests exercised explicitly above.
A separate `scripts/legislation-acceptance.test.mjs` invocation supplied the isolated loopback database and an explicitly
synthetic Washington bill fixture. The real built MCP and API completed the positive `get_bill` read and audience/token
exchange checks (four passes, database-failure path skipped in this mode). The preceding default invocation passed that
failure path. This closes both local built-runtime paths, not production TLS, live Washington data or complete tool coverage.

Further primary-source review of the eight held histories found an additional date issue for Sharon Shewmake:
her [official biography](https://senatedemocrats.wa.gov/shewmake/biography/) and the
[official historical reference, printed pages 121-122](https://leg.wa.gov/media/3uuctf3k/members-of-the-legislature-1889-2023.pdf)
record December 9, 2022 Senate swearing-in to serve the unexpired term, rather than the retained January 9, 2023 start.
The historical reference confirms House service and resignation but does not give the exact House resignation date.
The [House announcement](https://housedemocrats.wa.gov/blog/2022/12/22/timmons-sworn-into-office-in-olympia/)
confirms successor Joe Timmons was sworn in December 21. Do not infer her resignation date from either ceremony or
merely change the erroneous prior Senate role to House service: the supplied House end date is also suspect.
Her history remains held pending sufficient boundary evidence; no production dates were guessed or changed.

| Complete | Requirement | Evidence or remaining work |
| --- | --- | --- |
| [x] | Inspect production archive baseline | September 19 2026 read-only query: 16,753 bills across five sessions below; historical-import runs exist for each |
| [x] | Reconcile the complete published archive inventory | All five catalog sessions have retained archives with verified stored checksums; refreshed current-session release compared across all 3,413 bills. This proves inventory coverage, not historical database field parity |
| [x] | Review pinned scraper and live source access | Pinned revision `d43f853796ceeeb49205f7d144790647764ce105` has bill and event scrapers; both 2025 and 2026 official bill inventory requests returned HTTP 200 without credentials |
| [x] | Freeze bounded current-session bill inventory | Both annual XML sources retained and replayed; 3,411 unique bills in 342 disjoint batches, with validated exclusions and source hashes |
| [x] | Add Washington to shared extraction and promotion | Shared reviewed profiles, source policy and fingerprint checks are implemented; version-pinned hosted bill batches and event windows have promoted successfully. Full inventory acceptance remains separate |
| [x] | Run isolated bounded bill extraction in both chambers | HB 1000 and SB 5000 retained successfully; this is source extraction only, not canonical promotion or hosted activation |
| [ ] | Validate bill actions, documents and individual votes | Compare retained cases from both chambers to official pages, including substitutions, engrossments, resolutions and amendments |
| [ ] | Import and validate people and service history | Production import and replay verified for 337 people and 380 accepted terms; eight historical conflicts remain quarantined as of the Short review. Current 147-member roster is complete; history acceptance remains open |
| [x] | Validate current people/committee snapshot with reusable district capacities | Shared validator accepts 98 House members, 49 senators, 51 committees and 609 membership assertions; zero unresolved member references; source snapshot, not production import |
| [x] | Import committees and memberships | Production import/replay verified for 51 committees and 609 current membership assertions. This does not establish complete committee detail profiles or historical memberships |
| [ ] | Import meetings and agenda items | Bound event windows, preserve Pacific time, stable source IDs and cancellation evidence; validate related bills/committees |
| [ ] | Complete document content pipeline | Extract text, OCR only when needed, preserve versions and source evidence, process eligible remaining content |
| [ ] | Complete embeddings and search synchronization | Reuse the existing approved model and shared pipeline; verify missing/stale vectors, lexical parity and canonical mapping |
| [ ] | Prove replay and recovery | Same inputs produce no duplicate entities; interrupted work resumes exactly; continuation chains retain their deployment version |
| [ ] | Verify authenticated API/MCP | Real Washington cases: bill, person, organization bills/meetings, meeting/agenda detail and lexical/semantic/hybrid retrieval |
| [ ] | Enable and observe regular syncing | Only after acceptance; verify a subsequent scheduled delta run, source failures and freshness reporting |

## Production baseline (2026-09-19 05:01 UTC)

### Public-read acceptance findings (2026-09-19 11:35 UTC)

The frozen current-session refresh has promoted 30 batches / 300 bills (of 342 batches / 3,411 bills), according to
the exact inventory's production checkpoint rows. Calendar inspection reports 25 of 90 windows complete. Trigger
bill run `run_06gbir9hlo4daa7fuooqqa2a01` was executing on `20260919.22`; no overlapping replacement was started.

- [x] Diagnose the SB 5000 public-detail failure: all 22 action rows lack source URLs and still have August 18 write
  timestamps. Refreshed HB 1000 has three September 19 action rows with source URLs and reads successfully. The shared
  normalizer supplies action provenance and both aggregate writers persist it. SB 5000 needs the pending source
  refresh and a repeated public-read check; this is not evidence that the refreshed writer drops URLs.
- [ ] Fix archive-to-scraper document alias duplication through shared identity handling. Authenticated HB 1000 detail
  returns four records for two files: HTTP and HTTPS variants have identical PDF hashes and identical HTML hashes.
  `documentRecords` hashes the literal URL; both aggregate writers reuse only exact source URLs, so protocol changes
  evade reuse. Preserve document references, sections and embeddings; prove source equivalence before consolidating,
  keep genuinely distinct versions separate, and verify mixed archive/scraper replay rather than only identical-input replay.
- [ ] Resolve the pending-document OCR contract before public-read acceptance. HB 1002 detail fails with
  `Document OCR status is unavailable`. Production has seven pending HTTPS records with null OCR status alongside
  seven processed HTTP records. Do not label unprocessed content as OCR-not-required or remove the fail-closed check
  merely to make the endpoint green. Verify the shared document initialization/processing path and then rerun MCP.

These findings keep replay, content and public-read requirements open. Successful bill promotion is not full bill
readiness, and the existing archive content baseline does not prove the new records are processed.

Pending OCR lifecycle implementation: both shared aggregate writers now initialize unevaluated documents with an
explicit pending OCR state. Ordinary metadata replay repairs only null OCR status on pending records; it never infers
OCR-not-required for an unprocessed file. The single-record writer now preserves the complete existing OCR evidence
and retry state rather than allowing incoming metadata to reset those fields. Twenty-five focused tests passed,
including real isolated PostgreSQL insert/replay tests for both writers; ingestion type-check and focused lint passed.
Deployment and production replay are still required before closing the public-read gap. Protocol-alias duplication
remains separate and unresolved. The preceding full verification terminated with 24 web-test failures, not a clean pass.

Transport identity prevention is now implemented in both aggregate writers using the downloader's shared HTTP-to-HTTPS
rule. An unambiguous existing document keeps its ID and processing artifacts when a source switches protocol. Bill,
collection, path, query and format distinctions remain intact; ambiguous aliases or duplicate batch targets fail closed.
Existing duplicate pairs are not silently deleted or merged. Seventy-eight focused tests passed, including both real
PostgreSQL writer paths replaying an HTTP archive document through an HTTPS scraper record while preserving content
and OCR state. Ingestion type-check passed. This is local implementation evidence, not deployment acceptance.

A read-only current-session census found 2,796 transport-alias groups containing 5,592 document rows. None has two
different non-null content hashes, but 2,794 groups contain an unhashed copy: absence of a conflicting hash is not proof
of byte equivalence. Consolidation must preserve canonical references, sections and vectors and explicitly handle
unprocessed copies. The running pinned deployment has not yet received this identity fix; rollout remains open.

Corrected candidate `20260919.25` deployed successfully with 70 tasks, without global promotion:
`https://cloud.trigger.dev/projects/v3/proj_bsjukvltatwjsyczuatb/deployments/d8pd3sl7`. The API/importer membership
contract preflight passed. A Washington-only boundary handoff is armed as `run_06gbj0dmst6ss2745i1cegnk01`, initially
confirmed DELAYED on that exact version. At arming, 37 bill batches were promoted and exactly one bounded batch owned
the next slot. The handoff uses the existing global refill idempotency key for promotion count 38 with a two-minute
delay: the old run's ordinary continuation resolves to the same dispatcher, not a parallel continuation. If it executes
before the current owner finishes, its normal ownership check may return awaiting-in-flight; verify the old run and
receipts before any explicit resume. No active extraction was cancelled; no NC/AK configuration or schedule changed.
The handoff subsequently completed and dispatched `run_06gbj0tii21vi6vtkve2thjc01`, verified EXECUTING on
`20260919.25`. Production had 38 promoted batches and exactly one active owner for that child's batch
`3c9bd59e7175d8dbefa61cf5eb4e00321153a5f631e7fd22ea1e07700493a1bb`. The version switch is verified; inspect its
completed receipt and persisted documents before claiming corrected production writes. Global promotion remains off.

That child has now completed on `20260919.25`: ten bills promoted, zero unresolved sponsors/positions, and refill
`run_06gbj1ft54lhjdbagfq2d1mm01` dispatched. Its retained manifest checksum is
`5b69dd96a3bb9503b1c2e97591937b289402e6e7c894a0046209b6601412ca7d`. This proves continuation/promotion, not yet a
full document-level audit of the corrected batch.

The shared `tools/openstates/reconcile-document-alias.ts` now supports an explicit bill/keep/remove pair, defaulting
to validation only. It freshly downloads the keeper's source, verifies the byte hash, locks the parent and document
rows, rejects processed/attempted aliases and dependent sections/search rows, and checks the actual FK inventory.
Applying retains the complete removed row in `sync_checkpoints` under `document-alias-reconciliation` before deleting
only the untouched alias. It never deletes the keeper's text, sections or vectors. Thirty-seven focused tests passed,
including real PostgreSQL vector preservation, failed-hash rollback, dry-run preservation and repeated-apply no-op;
type-check and focused lint passed. The FK audit uses explicit schema names independent of connection search paths.

Production canary: HB 1002 PDF alias `bill:wa:2025-2026:hb:1002:document:cc7ec2ff472bd8de2a9a273f` was removed after
fresh hash `082cb9c3aace0c2988a4c7a7f9f6f263d6c5cf6197ae53ac591b96cf98d32070` matched the processed keeper
`bill:wa:2025-2026:hb:1002:document:97dd5a60fe4ef21157c8027e`. Its row is recoverable from the transactional audit.
The broader duplicate census, processed-duplicate pairs and public bill-detail acceptance remain open.

The first corrected ten-bill batch (HB 1380 through HB 1389) has now been audited against its retained manifest and
current database rows: all 69 source documents resolve to exactly one canonical document, all 69 preserve an existing
ID rather than the newly derived scraper ID, zero are missing or ambiguous, and zero pending matches have null OCR
status. This proves document identity reuse for this deployed batch, not full-session acceptance. The initial audit
probe incorrectly inspected the document wrapper rather than its nested `document` value; those counts were discarded
and the corrected probe produced the results above. Inventory checkpoints subsequently showed 39/342 batches promoted.

HB 1002's remaining six untouched HTML aliases were individually dry-run checked and reconciled with fresh source-byte
hashes through the same shared transaction. Together with the PDF canary, seven redundant metadata rows were removed;
each remains recoverable from its `document-alias-reconciliation` checkpoint snapshot. No processed keeper, section or
vector was removed. Authenticated MCP `get_bill` now succeeds for HB 1002, returning seven documents with processed /
not-required statuses and two document-backed amendments. This closes that sample's prior OCR-status read failure,
not the statewide duplicate census or the separate processed-copy reconciliation requirement. The response still has
an unresolved Scott sponsor, which remains within the full-cycle person-reconciliation acceptance gate.

The latest full `pnpm verify` completed unsuccessfully in web coverage: 2,636 tests passed and 18 failed across eight
files. The complete repository verification gate remains open; no test bypass or timeout relaxation was introduced.

The same alias-repair CLI now accepts `--session-id`, `--limit` (default 10, maximum 25 bills) and an exclusive
`--after-bill-id` cursor instead of an explicit pair. It selects provisional pairs through a shared, state-independent
planner and reports held groups rather than choosing among ambiguous or processed copies. Each selected pair still
requires a fresh sequential download and locked transactional verification; selection alone never permits deletion.
Dry-run remains the default. Only a successfully finished page prints `pageComplete` and `nextBillId`; resume with
that cursor, or rerun the same page after interruption. Previously committed removals are no longer candidates and
their audit snapshots remain intact. Held groups require separate review even when a page completes.

Example from the ingestion package: `node --env-file=../legislation-web/.env --import tsx
tools/openstates/reconcile-document-alias.ts --session-id session:wa:2025-2026 --limit 5 --database-env DATABASE_URL`.
Add `--apply` only to apply the freshly verified repairs. This operator does not introduce a Washington-only cleanup
engine, extra embeddings, parallel publisher requests or a new recurring schedule.

First bounded production page, HB 1000 through HB 1004: dry-run verified 19 candidates, apply removed all 19 untouched
aliases, and repeated apply found zero candidates. The two already-processed HB 1000 pairs remained held. Authenticated
MCP subsequently returned HB 1001 / HB 1003 / HB 1004 successfully with 3 / 10 / 6 documents respectively. Removed
metadata remains recoverable in the per-alias audit snapshots. The completed cursor is `bill:wa:2025-2026:hb:1004`;
the next page has not yet been applied. Twenty focused unit tests, ingestion type-check and lint passed. A new full
verification run passed types/lint/unused checks and is still in coverage; this is not a full green acceptance claim.

The next bounded page, HB 1005 through HB 1029, completed 166 fresh-byte-verified untouched-alias removals with no
held groups. Audit snapshots preserve the removed metadata; the completed cursor is now `bill:wa:2025-2026:hb:1029`.
The two processed HB 1000 pairs remain unchanged: their text and section rows match after excluding row IDs and
timestamps, but all four documents also have model-specific embeddings (4/6/4/6). Null inline section vectors must
not be mistaken for absence of embeddings. Their consolidation still requires explicit reference/search handling.

Bill batch HB 1390–1399 failed in `run_06gbj1gs08h12agnvn5l03q401` on version `20260919.25`. The retained immutable
attempt reports `source_timeout`, exit 1, and no emitted bills; the generic promotion error did not expose that reason.
Confirmed terminal failure plus a released ownership receipt allowed one idempotent retry,
`run_06gbj7son8rp19kqck5dlu9101`, verified EXECUTING on the same version. No incomplete source output was promoted and
no active worker was overlapped. Calendar receipts remain 25/90; its continuation still needs independent inspection.

The newer full verification failed in ingestion coverage (2,044 passed, five failed): one reviewed-document-source
test and four retained-regulatory-audit tests timed out, with a cleanup error after timeout. Both files passed all
15 tests unchanged in isolation. The full verification gate is still not green.

The source-timeout bill retry completed on `20260919.25`, promoted ten bills with zero unresolved sponsors/positions,
and dispatched refill `run_06gbj8fs24mib17ffidd8lm501`. Calendar investigation identified a different failure in
`run_06gbioel1j482m4asi0nnoiv01`: the complete retained June 25–July 1 window includes agenda 33418 whose publisher
host has ID 35341 but an empty abbreviation. The normalizer incorrectly required a nonempty code even for hosts it
does not map to a chamber committee. The source adapter now permits an empty abbreviation and never constructs an
organization reference from it, including for House/Senate hosts. It preserves the source host evidence and marks
organization coverage incomplete instead of inventing a mapping. Malformed nonempty codes remain rejected.
Eighteen focused event/window tests, types and lint passed. Reprocessing the exact retained window read-only now
validates both agendas (33418 and 33394, with two and five items); both honestly retain incomplete organization
relations. Deployment and the resumed hosted calendar receipt remain required before closing this failure.

The HB 1030–1054 cleanup page completed another 123 byte-verified removals and a read-only replay found zero remaining
candidates or held groups in that page. Resume subsequent cleanup after `bill:wa:2025-2026:hb:1054`; all removed rows
remain recoverable from audit snapshots. Authenticated HB 1054 detail succeeds with nine documents. Bill receipts have
reached 40 committed batches with a new active owner. Calendar fix commit `909c726` is building as an unpromoted
`20260919.27` candidate after the deployed API/importer contract preflight passed; it is not yet calendar acceptance.

Candidate `20260919.27` subsequently deployed successfully with 70 tasks at
`https://cloud.trigger.dev/projects/v3/proj_bsjukvltatwjsyczuatb/deployments/ftizb4ax`, without global promotion.
The failed calendar run was reconfirmed terminal, its exact ownership receipt marked released, and recent calendar
runs contained no nonterminal work. A single idempotent recovery `run_06gbjaod81nqn5ipmdrijfic01` was dispatched and
verified EXECUTING on the corrected version. No recurring schedule was created. Confirm its receipt and subsequent
continuation before closing the calendar failure. Cleanup after HB 1054 is processing a bounded 25-bill page with
154 provisional pairs; its completed cursor must be observed before advancing to another page.

The calendar recovery and its continuation completed on `20260919.27`, reaching 27/90 committed windows and
dispatching `run_06gbjb7bluqsaqe313fakh3c01`. Authenticated reads exposed incomplete joint-committee mappings:
agenda 33394 and 33418 resolve by source URL, but their meeting detail was unavailable. The source adapter now
recognizes explicit `/committees/joint/<code>` roster URLs and emits matching joint publisher-code references from
meetings. This extends the existing resolver, not a committee-name exception. Retained-roster preparation yields
14 joint identifiers; production committee import and exact retained-window relationship reconciliation succeeded,
and repeated reconciliation preserved two meetings with one organization link. Authenticated MCP now returns
agenda 33394 with Veterans and Military Affairs and all five agenda items. Agenda 33418 (Civic Health) remains
unresolved: its code is empty and the retained roster has no matching organization. No readiness check was weakened.
The new adapter still needs a hosted deployment and complete-window relationship replay before statewide acceptance.
The successful read also exposes source-normalization follow-ups: duplicated `Joint` in the title, empty location
components, and unlinked host participants; these are not certified as complete meeting-detail fidelity.

The HB 1055–1079 cleanup page completed 154 verified untouched-alias removals; read-only replay found zero candidates
or held groups. The next bounded page completed all 138 removals and reported completed cursor
`bill:wa:2025-2026:hb:1104`. Removed metadata is recoverable from per-alias audit snapshots. Processed HB 1000
duplicates remain deliberately untouched pending section/vector/search-reference-safe consolidation.

Joint identifier/event/resolver tests passed (19), ingestion types and focused lint passed. The preceding full
`pnpm verify` ended with eight failures in web `voteAttribution.test.ts` (2,646 web tests passed): the synthesis
evidence ID assertion at line 446 failed. This is not a green repository result and no unrelated web code was changed.

Joint-code fix `9a9b151` deployed without global promotion as `20260919.28` (70 tasks), after the API/importer
contract preflight passed: `https://cloud.trigger.dev/projects/v3/proj_bsjukvltatwjsyczuatb/deployments/zimim367`.
Calendar continuation reached 28/90 on `20260919.27`; its next run is `run_06gbjbf02a5g6jnrtt9maf4a01`. Do not overlap
that chain merely to switch versions; older admitted windows still require relationship replay on the corrected adapter.

Bill attempt `run_06gbj8h9e5ogegih3kkeudf701` failed for HB 1400–1409. Its immutable retained attempt
`wa-bill-4655e18bc4eaec0f5907e2d2868dc155` reports `source_timeout`, exit 1, and no bill records. The exact ownership
receipt is released and production inspection found 40 committed batches and no active bill owner. One idempotent retry,
`run_06gbjf5lu4jj76i4005g3dkl01`, was submitted and confirmed QUEUED on `20260919.28`; submission does not prove
promotion. Cleanup after HB 1104 is still processing 217 provisional untouched aliases in its next bounded page.

Civic Health requires a supplemental source-identity decision, not a guessed roster code. The
[2024 enacted resolution](https://lawfilesext.leg.wa.gov/biennium/2023-24/Htm/Bills/Senate%20Passed%20Legislature/8414.PL.htm)
established a 13-member joint select committee with expiration before the 2026 session. The
[2026 enacted resolution](https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/Senate%20Passed%20Legislature/8406.PL.htm)
reestablishes it. Do not infer that a current roster describes the 2025 meeting's membership or conflate terms using
name matching. Its historical publisher ID 35341 remains retained evidence; no new canonical organization or
membership was fabricated. Washington's official member site also announces intermittent September 19 maintenance;
this is possible source-timeout context, not proof of the specific failure's cause.

HB 1105–1129 cleanup completed all 217 verified untouched-alias removals; independent read-only replay returned zero
candidates and zero held groups. The completed cursor is `bill:wa:2025-2026:hb:1129`; audit snapshots retain removed
metadata. Calendar receipts reached 29/90 and dispatched `run_06gbjbmjt61lojble52d911101`. The HB 1400–1409 retry
remains verified EXECUTING on `20260919.28`; no replacement or overlapping extraction was submitted.

The shared retained-attempt admission path now reports validated status, failure reason and exit code before bill
or meeting normalization. For example, `source_timeout` no longer becomes only a generic incomplete-extraction error.
Washington, Alaska and North Carolina adapters share this guard; source scope/build checks remain mandatory, and
failed or partial output is never promoted. No new retry allowance or schedule is introduced. All 51 focused
archive/normalizer/event tests, ingestion types and focused lint passed; hosted rollout remains pending.

The latest full verification ended with two regulatory suite-hook failures and 23 failed tests, including repeated
parser subprocess timeouts. Local inspection found a separate Next.js process using approximately 12 GB and another
regulatory qualification process. They were not stopped or modified; their presence is resource-pressure evidence,
not proof that they caused every failure. Repository-wide acceptance remains open.

Read-only inventory now reports 41 promoted bill batches and one active owner, confirming progress after the
HB 1400–1409 retry. The calendar receipt inventory contains 46 completed windows. Relationship replay is processing
only those committed immutable windows sequentially through the existing source-bound preparation and transactional
reconciler; it is not re-scraping or replacing source facts. Completion of all selected windows remains unverified.

Additional explicit publisher URL forms (`/about-the-legislature/legislative-agencies/<code>` and
`/<code>/Pages/default.aspx`) now map legislative-chamber committee rosters to joint references. No organization-name
exception was added. Retained-roster preparation now identifies all 17 joint committees among the same 51 organizations;
production committee import and replay succeeded. Fifteen focused identity/import/resolver tests, types and lint passed.
The hosted adapter rollout and complete public-read replay remain pending; empty-code and absent-roster hosts remain held.

Cleanup after HB 1129 stopped partway through its 219 candidates with PostgreSQL `55P03`, a three-second parent-bill
lock timeout. The process exited unsuccessfully without a completed cursor. Prior per-pair commits are retained and
the interrupted pair rolled back; retry the same HB 1129 cursor, not a later page. A same-page retry has been started.

After agency-code import, authenticated MCP `get_event(event:openstates:wa-agenda-33382)` succeeds with the canonical
Joint Transportation Committee organization and seven agenda items. The multi-window relationship replay remains
active. A separate preexisting UUID-based event (`event:openstates:ocd-event-7a560f01-8d56-4819-b9e8-6c43e70fd4e9`,
September 16, 2026) has no source URL and incomplete organization relations. Audit it against the later calendar
window before asserting duplicate-free event coverage; do not merge by title/date or delete it without identity evidence.

The selected 46-window relationship replay completed successfully. During the subsequent snapshot, 861 of 883
canonical `wa-agenda` meetings had complete organization links; newer windows were still being promoted on the old
adapter, and this is not a final coverage denominator. Remaining hosts include absent-roster agencies/commissions,
the empty-code Civic Health committee, older code evidence, and windows reconciled before agency identifiers were added.
Cleanup HB 1130–1154 completed across the original attempt and same-page retry (219 candidates total); independent
read-only replay found zero candidates or held groups. The completed cursor is `bill:wa:2025-2026:hb:1154`.

Combined source-failure diagnostics and joint agency-URL mapping deployed successfully, without global promotion,
as `20260919.29` with 70 tasks: `https://cloud.trigger.dev/projects/v3/proj_bsjukvltatwjsyczuatb/deployments/u66rd0xu`.
The API/importer contract preflight passed. Running version-pinned continuations were not cancelled or overlapped.

Agenda 32344 reveals why publisher numeric IDs are needed in addition to abbreviations: its retained January 8–14
window (`wa-event-6969e0f8-5e3a-408c-a72a-4b7c47536a52`) supplies Senate host ID 34080 with acronym `LGLT`, while
live `GetCommitteeMeetings` for January 13 and `GetCommittees?biennium=2025-26` both supply ID 34080 with `LGV`.
The canonical roster has exactly one `waCommittee:senate:LGV` organization. Implement a retained, source-validated
numeric-ID crosswalk and shared unambiguous reference resolution rather than adding a name or acronym exception.
The live inventory returned 34 standing committees; it is not evidence of complete joint/agency coverage.

Short review: the [2009 first-day House journal](https://leg.wa.gov/media/5i5d4cum/hj_09_001.pdf) establishes her
January 12 House oath. The [official historical reference](https://leg.wa.gov/media/s4gf4suc/members-of-the-legislature-1889-2025.pdf)
distinguishes Senate appointment on January 30, 2017 from swearing-in on February 1. The review corrects the mislabeled
prior Senate assertion to House service and removes the duplicate House assertion extending into 2018. The supplied
February 1 House end remains retained, not independently certified as the exact resignation date. Production import
and replay preserved all 24 terms across twelve reviewed people; authenticated MCP returned the corrected House term
and current Senate term. All 24 focused tests passed. This adds source-fingerprinted review data, not person-specific
engine logic. Full verification remains unclean, with web test failures; statewide acceptance is still open.

Boehnke review: the [official January 9, 2023 announcement](https://mattboehnke.src.wastateleg.org/sen-matt-boehnke-takes-oath-office-olympia/)
explicitly identifies his first Senate term; his biography confirms two preceding House terms. The prior role's
incorrect Senate chamber is corrected to House, retaining its supplied 2019-01-14 through 2023-01-08 boundaries;
the duplicate House assertion ending after the Senate transition is removed. Twenty-four focused tests passed.
Production import and replay preserved all 22 canonical terms for eleven reviewed people. Full verification is
still running and has reported web scenario-policy, API-smoke and Node-telemetry failures; acceptance is not clean.

Verification follow-up: the full run passed types, lint and unused-code checks but stopped at the state extraction
repair CLI test's aggregate 30-second timeout. Its five sequential subprocess checks have been separated into four
independent scenarios, retaining the 20-second subprocess limit and every dispatch-safety assertion. The focused
four-test pass took 31.46 seconds in aggregate, confirming that the former whole-test deadline was too short for
the combined work. No production timeout, dispatch guard or retry policy changed. A fresh full verification is running.
Hosted inspection now shows 23 of 90 meeting windows complete, with `run_06gbin30ov8g477gekk9vnru01` and bill run
`run_06gbin27acprifok97bfbbv001` executing on candidate `20260919.22`; no replacement work was launched.

Orwall review: the [2009 first-day House journal](https://leg.wa.gov/media/5i5d4cum/hj_09_001.pdf) records her district
and January 12 oath; her [official biography](https://senatedemocrats.wa.gov/orwall/biography/) confirms fifteen House
years before Senate appointment, and [King County's report](https://content.govdelivery.com/accounts/WAKING/bulletins/3c7ea39)
corroborates the December 10, 2024 transition. The fingerprinted review removes the erroneous 2009-2024 Senate role
and restores the truncated House start to 2009-01-12. Production import/replay preserved 20 terms across ten reviewed
people; authenticated `get_person` returned the corrected House term and current Senate term. Twenty-four focused
review/import/quarantine tests passed. The full verification run remains in progress, not an acceptance pass.

Shewmake remains held: the [Senate announcement dated December 21, 2022](https://senatedemocrats.wa.gov/shewmake/2022/12/21/shewmake-sworn-in-as-new-senator/)
says she was sworn in that day, whereas the [House announcement for Timmons](https://housedemocrats.wa.gov/blog/2022/12/22/timmons-sworn-into-office-in-olympia/)
says December 9. The supplied 2023 Senate start and 2022 January House end cannot be accepted by merely removing the
overlap. The [2025 official historical reference](https://leg.wa.gov/media/s4gf4suc/members-of-the-legislature-1889-2025.pdf),
printed page 127 (PDF page 133), explicitly confirms December 9, 2022 swearing-in to serve the unexpired Senate term.
It records her House resignation without a date. Verify that resignation boundary before applying the full correction;
do not use the press release's publication date as the effective start.

Latest historical review: Corry's [official biography](https://chriscorry.houserepublicans.wa.gov/about/) identifies
prior district 14 service followed by district 15 after redistricting. The source-fingerprinted review removes the
contradictory overlapping prior district 15 role, retaining the supplied district 14 and current district 15 roles.
This does not independently certify their exact boundary dates. The shared import and second production replay
preserved all 18 canonical terms for nine reviewed people without duplicates or changed identities/dates/provenance.
Authenticated `get_person` returned Corry's two expected districts. Thirteen focused review/import tests passed;
the full retained pair has zero current-roster coverage issues. Repository verification has been started again;
it must not be represented as complete until its terminal result is inspected.

Hosted progress at this check: 19 of 90 meeting windows completed; continuation `run_06gbikp0hd3jdjeap3t8sodt01`
and bill run `run_06gbikltulcosot05nbh20v901` were executing on candidate `20260919.22`. The preceding bill batch
promoted ten bills with no unresolved sponsors or vote positions. No duplicate dispatch or schedule was started.

| Session | Stored bills |
| --- | ---: |
| 2017-2018 | 3,953 |
| 2019-2020 | 3,972 |
| 2021-2022 | 2,322 |
| 2023-2024 | 3,093 |
| 2025-2026 | 3,413 |

The current-session official inventory returns 3,359 records for 2025 and 3,941 for 2026. Applying the pinned scraper's
scope (exclude gubernatorial appointments and initiatives, normalize bill versions) yields 3,411 unique bill identities.
Every one already exists in the database. `HB 3992` and `SB 7991` exist only in the database comparison and require
source/provenance review; do not delete them based on absence from this inventory. This comparison establishes identity
presence, not current actions, votes, documents or text freshness. The next import is a refresh, not an empty-state backfill.

## Source review and implementation hazards

- [Official legislative web services](https://wslwebservices.leg.wa.gov/) publish legislation, sponsors, committees,
  committee meetings, amendments and document links. Public access was verified, but endpoint availability is not
  evidence that the Open States scraper extracts every exposed field.
- The pinned bill scraper accepts `chamber` and `session`, not the shared runner's `bill_ids` parameter. Add bounded
  selection in the reviewed source policy before executing; never silently fall back to a full-session extraction.
- Current scraper session is `2025-2026`; the publisher's biennium is `2025-26`. Keep these distinct and validated.
- The bill scraper accumulates identities across chambers and later calls `scrape_bill` using the final loop chamber.
  Bounded extraction must determine each bill's chamber from its validated identity, not that stale loop variable.
- Bills use `US/Eastern` in the pinned scraper while events use `US/Pacific`. Inspect each timestamp's source semantics
  before changing normalization; do not invent precise times for date-only actions.
- Events default to today through the next 30 days and skip cancelled meetings. This is not a historical meeting import
  or sufficient cancellation reconciliation. Define explicit windows and retained observations before activation.
- Shared people coverage now uses configured district capacities: Washington has two House members and one senator
  per district; NC/AK retain capacity one. Identity uniqueness and missing/excess occupant checks remain enforced.
  Capacity does not infer House position numbers or resolve historical role conflicts.
- Many execution, archive, people, content and schedule boundaries explicitly allow only NC/AK. Extend each reviewed
  boundary with tests; a new profile is not implicit authorization to execute or schedule it.

No Washington production writes, new schedules or scraper runtime activation were performed during this baseline audit.

## Shared foundation validation (2026-09-19)

Washington acquisition, immutable archive/replay, current roster validation and history preparation now use the same
people profile/schema and functions as NC/AK. Hosted activation remains separate and unchanged. Thirty-one focused
tests passed, including complete multi-member coverage, missing/excess occupants, duplicate identities/paths and
checksum-preserving Washington replay. Existing NC and Alaska coverage behavior remains tested.

Live repository revision `677c6d0a566ad9bd62b6324e502af76acc3d22f3` was retained under
`artifacts/openstates-washington-foundation`. Both archive manifests use
`openstates/people/<revision>/wa/{entities,history}/source-677c6d0a566ad9bd/complete.json` and replayed successfully:
198 current files and 261 historical files. Current snapshot validation found 147 legislators, 51 committees and
609 membership assertions, with no coverage or unresolved-reference issues.

History preparation accepted 336 people and 367 terms while quarantining 20 people for overlapping roles, ambiguous
term identities or reversed dates. This is a partial preparation, not canonical import. Review source precision and
generic period handling before considering source corrections; do not add person-name exceptions to the engine.
The retained `reports/foundation-validation.json` includes each quarantined path and content hash. No production
people/committee changes or schedules were made.

## Frozen bill discovery (2026-09-19)

The shared discovery entry point now supports Washington's two annual XML inventories. Its source adapter validates
the biennium, chamber, bill number and legislation type before combining carryovers/substitutions into canonical bill
identifiers. Appointments and initiatives remain explicitly outside this bill-scraper lane. Unknown or conflicting
identities stop discovery instead of silently reducing coverage.

All three states now share immutable source/plan publication, ten-item single-chamber partitioning, exact-batch scope
checks and checksum replay. Reviewed bill sessions/identifier patterns live in one capability profile; this does not
enable hosted activation. Runtime extraction, normalization and downstream acceptance still require Washington work.

Live acquisition retained 3,411 unique bills (1,904 House, 1,507 Senate), in 342 batches of at most ten, under
`artifacts/openstates-washington-bills/openstates/scraper-plans/wa/2025-2026/wa-bills-971060d118727f4b4dc6195f4b5b7fc7/plan.json`.
Inventory ID: `093b6b38e2ef0dbb94458f1a3048605297487bc46085f42cf402bcd28c168517`.
Replay reconstructed the exact plan from retained publisher XML. No scraper execution or canonical writes occurred.

## Isolated runtime canaries (2026-09-19)

The shared Python runner now admits Washington bill-only batches for session 2025-2026. Events remain disabled.
The digest-verified source policy accepts 1-10 unique, single-chamber bill IDs, bypasses upstream full-session
discovery, resets document/version collections per attempt and sets a 60-second source timeout. No new dependencies
were installed. The acceptance image reuses the inspected existing dependency image and passes offline startup checks.

An initial House attempt failed on a missing digest directory instead of silently truncating document discovery.
The publisher's parent directory lists only Senate digests. The revised adapter checks the published parent listing,
records each advertised/absent child directory in retained `document_directories.json`, and propagates transport
failures or unrecognized listing pages. There is no hardcoded House/digest skip.

Retained successful attempts under `artifacts/openstates-washington-canary`:

- `openstates-wa-r03x544f`: HB 1000, 3 actions, 8 sponsors, 1 version with HTML/PDF links.
- `openstates-wa-w0wnezva`: SB 5000, 22 actions, 1 version, 1 supporting document, 2 roll calls.

Both use build-input hash `35cb745c411e7c08bcfe35d0b18762380480da69e406615263ee52afeccbd653` and the local
`legislation-openstates-adapter:washington-directory-aware` image. Both ran sequentially, with one CPU, 1 GiB memory
and a 300-second attempt deadline; neither had database/cloud credentials. The 28 runner/source-policy tests passed
inside the network-disabled image without skips. Existing failed artifacts remain untouched.

Fresh official roll-call XML matched both SB 5000 vote dates, motions, source chambers, totals and all 49 named
positions per vote. The comparison and XML are retained in `source-comparisons/sb5000-rollcalls.{json,xml}`.
This does not approve the upstream majority-inferred outcomes, broad vote coverage, identity resolution, canonical
normalization, duplicate-free database replay, hosted deployment or content/search completion; those gates remain open.

Repository `pnpm verify` passed for this slice, including 1,929 ingestion tests and 122 Python tests (7 platform/runtime
skips on Windows, with the 28 relevant runner/policy cases passing unskipped in Docker). Unconfigured database suites
and the optional positive disposable-corpus acceptance were skipped, not evidence of Washington database readiness.

## Shared canonical preparation (2026-09-19)

Washington bill archives now use the same checksum-verified archive reader, exact batch scope, canonical bill mapper
and dispatch preparation as North Carolina and Alaska. Only source-specific roll-call evidence parsing is separate.
Vote identity uses biennium, bill, source chamber, date and source sequence rather than temporary scraper UUIDs,
motion wording or tallies. Named positions must reconcile with the published yes/no/other counts.

The upstream majority-derived result is discarded. A final-passage outcome requires one matching official action on
the same date and chamber with exact counts; other outcomes remain unknown. Unknown outcomes remain incomplete in
the canonical mapper, even when vote counts reconcile. Date-only source records never receive invented instants.

Both retained successful canaries normalized and replayed identically through the shared pipeline without database
writes. HB 1000 yielded no votes; SB 5000 yielded two upper-chamber passed votes with source sequences 19 and 17.
Focused tests cover identity, source mismatches, incomplete positions, ambiguous outcomes, archive replay and build
approval. This is preparation evidence, not duplicate-free database replay or permission to activate hosted syncing.

The retained canaries were also imported twice using the shared production writer into the new isolated local
`washington_scraper_replay_20260919` database. Both passes retained exactly the same IDs and counts: 2 bills,
25 actions, 10 document records, 23 sponsor observations, 2 votes and 98 vote positions. Evidence is retained in
`artifacts/openstates-washington-canonical-replay/reports/database-replay.json`. Production was not changed.
This proves replay for these two cases, not nationwide/archive-to-scraper reconciliation, interrupted-run recovery,
resolved person identities, full-session coverage or document content readiness.

The same isolated database then replayed the retained foundation through `importArchivedStateFoundation`:
336 people, 367 terms, 51 organizations and 609 committee memberships retained identical IDs/counts on repeated
imports. Current active service covers 98 House members and 49 senators. The existing shared current-roster path
preserves validated current identities/terms while holding conflicting older histories; no person-specific exceptions
were added. All 51 current committee rosters passed dependency checks. The 20 historical quarantines remain open.
Reports: `artifacts/openstates-washington-foundation/reports/isolated-foundation-replay.json` and
`isolated-membership-replay.json`. These local checks do not establish production import or complete service history.

The cloud bill-request boundary also uses the shared session/identifier profiles. Washington bill requests pass the
same unique-ID, single-chamber and ten-item limits; Washington events remain rejected. Focused cloud tests and
ingestion type-checking passed. This does not change hosted activation, approved deployment fingerprints or schedules.

Washington content processing is now admitted to the existing extraction/OCR/embedding worker behind its existing
explicit activation guard. Default sessions and continuation/predecessor identities share one resolver using the
reviewed bill profiles; Washington defaults to 2025-2026, never Alaska's 34. Historical explicit sessions remain
supported. Sixteen focused content/policy tests and ingestion type-checking passed; no hosted settings changed.

The first full ten-bill House canary (HB 1000-1009) stopped after HB 1002 with `source_http_server_error`, before its
25-minute deadline. The failed attempt is retained under
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/wa/bills/wa-frozen-house-canary-20260919/retained.json`
in the local Washington bill store. Canonical preparation rejected it as incomplete; no partial batch was promoted.
Fresh checks of the HB 1003 summary, roll calls and status-change endpoints returned HTTP 200, but the bounded error
category does not establish which request originally failed. A fresh bounded retry is still required.

An isolated SB 5000 content canary used the shared worker, existing provider configuration and one bill at a time.
Two bounded passes processed all eight linked document records without extraction failures or OCR demand. Database
inspection confirmed one `voyageai/voyage-4` bill embedding (1024 dimensions) and eight
`openai/text-embedding-3-small` section embeddings (1536 dimensions). The second pass skipped the three existing
vectors instead of storing them again. Retained job reports are under
`artifacts/openstates-washington-content-canary/reports/sb5000-content-{canary,remainder}.json`.
This proves text extraction and embedding for this bill only. Local OCR credentials were unavailable, no OCR call
was exercised, and lexical synchronization, index usage and authenticated API/MCP retrieval remain unverified.

The shared-executor retry exposed a stale NC/AK-only filesystem artifact validator. The directory reader now uses
the manifest's single shared path contract; 20 focused archive/path tests and ingestion type-checking passed.
The retained attempt was recovered without repeating extraction. It too contains an upstream server error (two
completed bill records), not a complete batch, and remains unpromoted. Evidence is retained as
`wa-frozen-house-retry-20260919` in the same local archive store. Investigate source diagnostics/retry policy before
increasing concurrency; neither failure authorizes partial promotion or claims a complete Washington refresh.

## Full-batch retry and meeting-source audit (2026-09-19)

The pinned runtime already configures three source retries with exponential waits of 10, 20 and 40 seconds.
An isolated ten-bill diagnostic retry completed HB 1000-1009 successfully with 25 retained files, using the same
runtime and no additional retry layer. Its archive is `wa-frozen-house-diagnostic-20260919` in the Washington bill
store. Checksum-verified canonical preparation returned all ten requested bills and replayed deterministically.
This is evidence of intermittent upstream failure, not identification of the original failing endpoint or sustained
source reliability. No concurrency increase or hosted activation was made.

The shared production writer then replayed the complete batch in the isolated local database. Two consecutive
passes retained identical IDs/counts: 11 total bills (including the earlier Senate canary), 162 actions, 70 document
records, 12 votes and 882 named positions. HB 1000 overlapped the earlier canary without becoming a duplicate.
Reports are `artifacts/openstates-washington-bills/reports/house-batch-{diagnostic,database-replay}.json`.
This does not replace archive-to-scraper parity, production acceptance, or full-session ingestion checks.

A live read of the official `CommitteeMeetingService.asmx/GetCommitteeMeetings` endpoint for January 13-19, 2025
returned 77 meetings with 77 distinct agenda IDs across House and Senate, including one cancelled meeting.
The pinned upstream event scraper currently discards cancellations and agenda entries without bill IDs, fetches the
same inventory once per chamber, and defaults to a future-only window. Before activating Washington events, preserve
cancellations and non-bill agenda entries, use explicit bounded windows and stable agenda identities, and validate
Pacific timestamps. Reuse the canonical event writer and existing cancellation status mapping; no separate event
database or Washington-specific persistence pipeline is needed. Events remain disabled.

The preceding full `pnpm verify` run completed successfully. Its optional positive disposable-corpus API acceptance
was skipped; this is not proof of authenticated Washington retrieval.

## Meeting extraction acceptance (2026-09-19)

The source adapter now requires explicit windows of at most seven inclusive days, reuses one inventory per scrape,
preserves cancellations and agenda items without bill links, and exports the publisher agenda ID. Invalid cancellation
values, invalid agenda IDs, out-of-window records and ambiguous/nonexistent Pacific local times fail closed.
These changes are applied to the digest-verified pinned source, not a separate persistence implementation.

Twenty-six focused Python tests passed inside the existing dependency runtime, including tests exercising the real
patched scraper and Open States event objects. An offline image rebuild passed source verification and startup smoke.
The new local runtime is `legislation-openstates-adapter:washington-meeting-fidelity`; it is not a hosted deployment.

A bounded live canary for January 13-19, 2025 extracted 77 distinct agenda IDs, one cancelled meeting and 287 agenda
items, including 122 items without bill links. Comparison against all retained official XML responses found zero
meeting identity differences and exact agenda totals. The scraper made 78 requests: one inventory and one per agenda.
Source bodies, response hashes, extracted events and counts are retained under
`artifacts/openstates-washington-meeting-canary/`. No canonical database writes were performed.

This closes source-extraction fidelity for that window, not Washington event onboarding. The shared execution boundary,
immutable window planning, canonical identity/relationship mapping, duplicate-free database replay, hosted deployment
and recurring event sync remain open. The full repository verification is running after this implementation.

## Canonical meeting replay (2026-09-19)

The adapter now retains every publisher host committee's numeric ID, chamber, code and name. Canonical preparation
uses the stable agenda ID (not the extraction UUID), verifies exact official source URLs and Pacific clocks, and
passes explicit bill selectors through a helper shared with Alaska. Foundation import derives committee codes from
retained official committee URLs; the existing relationship resolver rejects missing or ambiguous matches without
name-based fallback. Current and retained publisher URL layouts are both supported.

The complete 78-response canary was replayed offline through the rebuilt pinned source. Its 77 events and 287 agenda
items then passed through the existing canonical event writer in `washington_scraper_replay_20260919`. Repeated imports
retained identical identities/counts. All 77 event-to-committee links resolved, including the cancelled meeting, with
zero unresolved hosts. Twelve agenda bill links resolved against the deliberately small 11-bill local corpus;
remaining bill relationships are not claimed complete. Evidence: `database-replay.json` and
`host-relationship-replay.json` under `artifacts/openstates-washington-meeting-canary/`.

The prior full repository verification passed (optional unconfigured database/corpus cases skipped). Focused mapper,
committee and Alaska regression checks cover the new shared preparation. Washington's execution-window contract,
durable dispatch/continuation and production acceptance still need implementation before enabling event sync.

## Shared meeting execution boundary (2026-09-19)

Washington event windows now use the shared Python runner, Docker shutdown/resource safeguards, cloud-request
validation and immutable attempt archive. One strict window contract is reused by TypeScript admission, archive
reading and canonical preparation. The approved source emits an inventory receipt only after complete traversal;
preparation requires exact agreement between its agenda IDs and retained events. Valid empty windows are permitted,
but never interpreted as a complete statewide snapshot or permission to delete meetings.

A real runner canary exposed Open States' UTC serialization: a 4pm Pacific meeting serialized at midnight the next
UTC day. The adapter now preserves the original offset timestamp in source extras. Preparation verifies equal instants
and the Pacific offset, retaining the publisher's calendar date. A focused regression covers this boundary.

The corrected local image `legislation-openstates-adapter:washington-publisher-clocks` passed offline startup checks.
Build-input digest: `3556d11cfa4010e0e8909e14b551f054e2b84a3d7deb0a242d62101e5bc8156e`.
The shared runner's 600-second canary extracted and archived all 11 meetings for January 13, 2025. Canonical preparation
accepted the exact inventory; replay through the existing writer left the prior 77 meetings and 287 agenda IDs/dates
unchanged, including across a second replay. Reports are under
`artifacts/openstates-washington-event-windows/reports/`; the successful attempt is `wa-meeting-clock-canary-20260919`.

Forty focused TypeScript tests, fifty Python tests inside the pinned dependency runtime, ingestion type-check and lint
passed. Full verification encountered the unrelated `browserTelemetry.ts` route-template type error. Durable window
planning, leases, continuation and hosted acceptance are still open; neither cloud-request support nor this local
canary activates production jobs or schedules.

## Immutable calendar planning

The jurisdiction-independent event-window planner partitions inclusive dates into bounded windows, hashes the cycle,
scope and each work item, and validates the exact partition on reload. Retention checks existing content rather than
assuming an existing path is correct. Every fresh sync cycle has a distinct identity, allowing previously empty dates
to be revisited. Calendar arithmetic is independent of daylight-saving offsets.

Washington preparation can now bind retained evidence to a specific planned window before publication. Wrong-window
archives and unknown work items fail, including for empty inventories. Eleven focused tests passed, as did ingestion
type-check and lint. This is planning and preparation only: durable ownership, transactional completion receipts
(including verified-empty windows), resumable dispatch, and hosted activation remain open.

## Owned window execution and empty receipts

The Washington window coordinator now uses existing batch ownership, cloud dispatch and canonical event persistence.
Each work item checks its immutable receipt before admission and again after acquiring ownership, binds retained
extraction to the plan, and commits either canonical rows plus a receipt or an owned empty-work receipt. New cycles
cannot overlap unresolved ownership from an earlier cycle. Verified-empty windows never delete canonical events.

Shared cloud dispatch now treats connection loss during submission or result observation as uncertain shutdown,
preserving ownership for all callers. This closes a gap where a queued scraper could outlive an observation error.
Invalid requests and credential failures before submission still fail without dispatching work.

Fourteen focused coordinator/dispatch/NC regression tests and fourteen real isolated PostgreSQL receipt tests passed.
Ingestion type-check passed. The PostgreSQL checks include concurrent identical empty receipts, missing ownership,
and conflicting replay. Hosted execution has not been activated; continuation task wiring, production acceptance,
and the other Washington coverage/content/readiness gates remain open.

## Bounded continuation wiring

`openstates-event-windows` processes one pending Washington window per invocation using the shared receipt inspector.
It rereads committed state after execution and refuses continuation without the selected completion receipt. A replay
of an already completed plan does no extraction. The continuation key binds the exact plan and next window; database
ownership remains the cross-process authority. The dedicated task queue has concurrency one, a one-hour timeout,
and no automatic retry while worker shutdown might be uncertain. Database pools close before continuation dispatch.

The task has no cron and requires explicit Washington activation. Its build is pinned to the locally validated
candidate; existing NC/AK build approval is unchanged. This code is not evidence of a deployed or scheduled job.
Nine coordinator/activation tests and three registered-task execution tests passed, including disabled activation,
receipt-less success rejection, completion replay, failure cleanup and exact continuation dispatch. Hosted deployment,
runtime approval and end-to-end acceptance remain required before enabling regular Washington sync.

## Live archive and runtime audit (September 19)

Azure authentication succeeded. The existing event job remains pinned to image digest
`cd41549d55377efdd0ce8637bda9800f74b546d2791cb0dc083d132776938369`; it has not been replaced with the Washington
candidate. The five most recent returned executions succeeded. No job, queue, schedule or activation settings changed.

The signed-in [publisher catalog](https://open.pluralpolicy.com/data/session-json/) lists exactly the five Washington
sessions already retained in `state-sources`, from 2017-2018 through 2025-2026. All five retained source objects were
read and their SHA-256 and byte counts matched their stored metadata. The four older catalog URLs match retained
provenance. The current-session catalog URL changed to the August 24 release, while our retained archive was acquired
August 17. The new archive was acquired only into `artifacts/openstates-washington-archive-audit`, hash
`e137e5c6b580da502be19f3ca5f09c6aac5f89d32d3fa834a0a091bf940b3945`, with 3,413 records and 97,348,364 bytes.

Comparison found no added or removed bill identities. Differences were confined to document/vote arrays; recursively
ignoring array order produced no differences for any bill. This is diagnostic evidence of reordering, not proof that
ordered relations have equivalent semantics or that database content is current. Reports are
`reports/current-session-record-parity.json` and `reports/current-session-order-insensitive-parity.json` in that store.
No canonical writes were performed. Archive-to-database field parity remains open.

Washington continuations now pin `ctx.deployment.version` through the SDK's existing `version` option, matching the
shared content worker pattern. Three task tests and ingestion type-check passed. Full verification now encounters
unrelated syntax errors in the web app's `src/modules/conversations/telemetry.test.ts`; those edits were left untouched.

## Archive vote identity correction

Canonical comparison of both current-session releases exposed a shared importer defect: archive votes without IDs
were keyed by date and array position. Reordering changed the roll call attached to 300 identities across 46 bills.
The bulk archive's `organization__classification` field was also being discarded.

The shared normalizer now preserves that chamber and derives unidentified vote identities from date, organization,
roll-call identifier, motion and sorted source URLs, not array position or mutable outcomes/counts. Explicit publisher
IDs remain authoritative. The complete 3,413-bill comparison produced 2,306 votes with no identity collisions and no
canonical differences after excluding source sequence. Evidence is
`artifacts/openstates-washington-archive-audit/reports/stable-vote-canonical-parity.json`. Fifty-eight focused archive,
normalizer and Washington scraper tests passed. This is archive-to-archive proof, not database acceptance.

Existing database rows created with ordinal identities must be inventoried and reconciled before replaying with the
corrected normalizer; otherwise the new IDs could create additional rows. No production deployment or archive replay
has been performed for this correction. Ambiguous unidentified repeated observations and cross-source identity
reconciliation remain part of the database acceptance gate.

### Database replay preflight

Read-only production inspection found exactly 2,306 current-session Washington votes, all matching the identities
from the retained August archive, with no extra or missing IDs. Motions and yes/no counts match. All 2,306 still carry
raw `pass`/`fail` outcomes rather than the canonical vocabulary, and lack the archive-supplied chamber and date.
The corrected normalizer supplies those facts. No Washington votes have meeting outcome/evidence references in the
queried database. Reports are `production-vote-identity-inventory.json` and `production-vote-field-inventory.json` in
the archive audit store. Production was not mutated.

Inspection confirmed that the existing shared aggregate writer replaces each supplied bill vote snapshot within its
transaction, cascading removal of old positions. Therefore a separate identity migration is not required for this
snapshot writer. A real isolated PostgreSQL regression verifies replacement, a duplicate-free second replay, and
rollback of both votes and positions when a replacement fails; all 15 receipt integration tests passed. Production
refresh still needs an explicitly bounded snapshot replay and post-write comparison, including resolved-link handling.

### Full isolated current-session replay

The complete August 24 archive was normalized and persisted twice in the Washington acceptance database, using the
existing aggregate writer with batches of ten and `preserveResolvedLinks`. Both passes finished with 3,413 bills and
2,306 votes; vote IDs and facts were identical across passes. All 171,876 named vote positions exactly matched the
normalized source (vote ID, source identity/name, option and person linkage). The archive supplies 19,498 document
identities; the database retains 70 additional document identities from earlier live scraper acceptance runs, for
19,568 total. That count is not a document deduplication acceptance claim.

Evidence is `full-current-session-database-replay.json` and `full-current-session-position-parity.json` in the archive
audit reports directory. Production still has 171,876 positions attached to name-only placeholder person records;
those are not verified links to canonical people. A production refresh must preserve the named votes while avoiding
retention of fabricated person associations. No production rows were changed by this isolated replay.

The full verification command completed with ingestion/core/MCP coverage, type checks and lint passing, but failed on
two tests in the separately modified web `src/modules/evaluations/evaluation.test.ts` (public `conflict` and
`precondition_failed` message validation). Downstream Python/database/acceptance stages were not reached by that
command. The focused 15-test PostgreSQL integration run passed separately.

### Bounded production vote refresh underway

A complete read-only preflight verified all 954 bills with archived votes against the retained source. The saved
before-state includes all vote rows and all 171,876 positions, with plan SHA-256
`c1d376bbaeb9d362ef4211a97df1fe066c2bb119db3109374f574165e4c5b67e`. The maintenance execution uses the shared aggregate
writer with current database parent records and only the vote collection supplied, leaving other bill collections,
documents and vectors untouched. It runs one connection, ten bills per transaction, checks the locked before-state
and absence of meeting references, and checks exact resulting vote/position facts before committing. Shared immutable
promotion receipts bind the plan and batch, permitting an interrupted execution to skip already committed work.

The first 40 bills committed and passed their in-transaction checks. This is not a completion claim: all 954 bills and
the final global comparison still require confirmation. Runtime evidence and the scoped maintenance script are in
`artifacts/openstates-washington-archive-audit`; the before-state is `reports/production-vote-refresh-plan.json`.
Old vote rows/positions are atomically replaced; their complete before-state is retained there. Placeholder person
records themselves are not deleted, but the replacement positions do not assert unsupported person matches.

## Historical-role source review

The quarantines are not all parser failures. The pinned Chris Gildon YAML contains an upper-chamber role for
2019-01-14 through 2021-01-10 overlapping his lower-chamber role. His
[official biography](https://chrisgildon.src.wastateleg.org/about/) explicitly places his first two legislative years
in the House and his Senate service starting in 2021, contradicting that extra upper-chamber interval.

Jeff Holy's YAML contains a second upper-chamber interval beginning 2019-01-14 and ending 2019-01-13. His
[official January 2019 announcement](https://jeffholy.src.wastateleg.org/senator-jeff-holy-takes-oath-office-olympia/)
confirms his first Senate term began January 14, 2019, after three House terms. His
[official January 2013 newsletter](https://jeffholy.src.wastateleg.org/holy_jan2213_enewsletter/)
explicitly dates his House swearing-in to January 14, 2013. These establish source errors and missing House history;
they are not permission to reverse dates mechanically or infer all term boundaries. Reviewed correction evidence must
remain separate from the shared importer, bind the exact source identity/hash, and pass the same period validation.
No historical-role corrections have been applied from this review yet.

## Conflicting vote observation admission

The shared normalizer now refuses conflicting observations with the same vote identity, including source-ID collisions
and indistinguishable unidentified roll calls. It still collapses identical duplicate observations, independently of
vote/position array order. This prevents silent first-record-wins loss; it does not invent identities from vote tallies.
Sixty focused normalizer/scraper tests passed, and all 3,413 current archive bills still normalize to 2,306 votes under
the stricter rule. A new full verification run was started after this change.

## Shared content audit scope

The content-status and embedding-freshness command-line audits now obtain admitted states and default sessions from
`state-content-scope`, matching the processing pipeline. Washington no longer fails an NC/AK-only enum or defaults
to Alaska's session 34. The all-state status report uses the same capability list; admission remains separate from
hosted activation. Washington's production content-status audit is read-only and was started without triggering
document processing, OCR or embeddings.

The production audit at 2026-09-19T07:52:25Z found all 3,413 current-session bills with routed embeddings, 19,491
processed documents, seven unsupported documents, and 92,930 sections with no missing routed embeddings. There were
zero processed documents without sections, zero OCR-processed documents and zero documents currently flagged as
unresolved OCR. Both bill and document-section HNSW indexes were valid and ready. These are existence/status checks,
not proof of embedding input freshness or extraction completeness. A separate freshness audit and review of the seven
unsupported sources remain open. The shared scope regression tests (three) and ingestion type-check passed.

All seven unsupported sources belong to archive training/test bills HB 3992 and SB 7991: five House bill/amendment
links and two Senate bill links. Fresh HTTPS GET requests at 2026-09-19T07:54:41Z returned HTTP 404 for every link,
matching their persisted `not-found` categories. Evidence is `reports/training-document-source-status.json` in the
archive audit store. This accounts for the two bill identities absent from the live scraper inventory without deleting
their archive records or creating name-specific download exceptions. These seven failures are missing publisher
resources, not evidence of OCR or embedding failure; recurring source availability remains subject to normal policy.

## Production verification closure

At 2026-09-19T08:02:37Z, an independent read-only snapshot verified all 2,306 votes and 171,876 positions against
every normalized canonical field from the retained source archive. All 96 transaction receipts cover the 954 bills
with votes. The refresh completed; no second import was required when the initial broad verification query timed out.
Bounded reads of 25 vote identities completed the check. Evidence is `reports/production-vote-refresh-verification.json`
in the archive audit store, alongside the retained pre-change plan and completion receipt.

The embedding-freshness snapshot at 2026-09-19T07:52:55Z also passed: all 3,413 bill vectors and 92,930 document-section
vectors match their current input hashes, with zero missing or stale vectors. No re-embedding was necessary for this
archive snapshot. This does not close live scraper acceptance, lexical/API search acceptance, historical field parity,
or scheduled synchronization. People/committee promotion and the 20 quarantined historical records remain separate gates.

Washington continues to use shared canonical persistence, replay receipts, source observation admission, content processing,
and embedding audits. Washington-specific adapters interpret publisher formats; they do not duplicate those lifecycle rules.

## Production people and committee promotion

The shared `importArchivedStateFoundation` boundary imported the pinned current/history pair into production on
2026-09-19, then replayed the same pair successfully. The second persisted verification at 08:05:28Z confirmed
336 expected people, including all 147 active legislators, 51 committees and 609 active membership identities.
Selected identity, relationship, chamber, district, role, activity and date fields matched the prepared snapshots;
all 367 expected legislative-term identities were present with matching checked fields. The replay did not create
extra people or active membership identities within the inspected source scope. This is not a claim that unrelated
legacy identities or all historical legislative terms have been reconciled.

Twenty source-history records remain quarantined; their disputed history was not promoted. The validated current
directory supplies current identities independently, so those history issues do not suppress verified current committee
relationships. Reports are `production-foundation-promotion.json` and `production-foundation-verification.json` in
the foundation artifact store. No Washington scraper schedule was activated.

The final repository verification passed check/coverage and Python tests (123 run, eight skipped), then failed web
acceptance startup: `/health` returned 500 because the instrumentation hook rejected a telemetry first-party URL.
Database suites without configured databases were skipped; this run does not replace the earlier isolated PostgreSQL
replay checks. The telemetry changes belong to separate work and were not modified for Washington onboarding.

## Production meeting canary

At 2026-09-19T08:07:38Z, the retained approved runner extraction for January 13, 2025 was promoted through
`prepareWashingtonEventWindow` and the shared `upsertEventSnapshots` writer. Production contained all 11 expected
meetings and 35 agenda items, with 11 resolved committee links and zero incomplete host relationships. Checked names,
statuses, start instants, publisher-local dates and timezones matched preparation. A repeated call with the same
immutable receipt was a no-op. Evidence is `reports/production-canary.json` in the event-window artifact store.

This is a bounded production canary, not full calendar coverage, cancellation coverage for this particular day,
or proof that every agenda bill relationship resolves. The prior isolated multi-day fixture covers cancellation behavior.
Hosted execution, complete planned windows, authenticated retrieval and recurring synchronization remain open.

## Authenticated MCP smoke findings

The connected production MCP returned Washington active people, lexical bill search, lexical passage search, all eleven
canary meetings and House Housing meeting detail on September 19. Meeting date filters require UTC ISO timestamps
(`Z`); date-only and offset timestamps were rejected by the deployed tool schema. Passage results retained canonical
Washington bill/document/section identities and source URLs. This is positive authenticated retrieval evidence, not a
complete API/MCP acceptance pass.

Two acceptance failures remain actionable:

- Semantic and hybrid passage searches for `affordable housing development`, scoped to Washington's 2025-2026 session,
  returned retryable `dependency_unavailable` errors after approximately 15.7 and 31.2 seconds, respectively.
- House Housing meeting `event:openstates:wa-agenda-32398` returns three agenda items with `billIds: null`.
  The API intentionally hides relationships unless `billRelationsComplete` is true. The shared agenda bill resolver
  currently resolves identifiers without updating that completeness assertion, and the Washington adapter supplies
  explicit bill references without establishing source completeness. Fix must distinguish fully resolved explicit
  references from malformed/missing source references, rather than unconditionally setting the flag or guessing from prose.

Do not activate recurring Washington synchronization until these and the remaining ingestion gates pass.

The agenda fix now separates source-reference completeness from successful canonical resolution. The shared selector
parser reports malformed, missing and inconsistent references without discarding valid siblings. Washington propagates
that assertion to the shared resolver, which marks the collection complete only when every explicit reference resolves
uniquely in its jurisdiction/session. Existing adapters retain their prior completeness claims unless they explicitly
opt into the verified-list contract. Nineteen focused tests, ingestion type-check and scoped lint passed; full repository
verification is running. Production replay/API verification of this fix remains pending.

Production replay of that fix passed at 2026-09-19T08:14:06Z: 11 meetings, 35 agenda items, 11 committee links and
13 bill links; all 35 agenda bill-reference collections were complete, including source-declared empty collections.
Authenticated `get_event` then returned the House Housing agenda's exact canonical bill IDs: HB 1003, HB 1096 and
HB 1217. The correction replay has its own immutable receipt and a second invocation was a no-op. Evidence is
`reports/production-agenda-resolution.json` in the event-window artifact store. This closes the observed canary agenda
exposure defect, not full-calendar ingestion or all relationship acceptance cases.

A sequential semantic passage request scoped to HB 2266 alone also failed after approximately 16 seconds. The failure
is therefore not limited to concurrent Washington-wide searches. Inspection of `buildSemanticPassageSearchQuery` shows
bill/document filters are applied after a global bounded nearest-neighbor candidate scan; a bill-scoped request does not
first restrict the vector population to that bill. Query-plan and latency evidence are still needed before selecting a
replacement strategy. Do not mask the failure by raising timeouts or claim the cause proven from code inspection alone.

A bounded production read-only EXPLAIN ANALYZE comparison reproduced the global candidate timeout (15,281 ms,
PostgreSQL 57014) and completed a bill-restricted exact-vector query in 532 ms. Both used the same synthetic nonzero
1536-dimensional vector and existing model/contract; this measures query execution, not semantic relevance or full HTTP
latency. Plans are retained in `reports/semantic-selectivity-plan.json` in the archive audit store.

The shared query builder now has an explicit bill/document-scoped exact-ranking path with all filters before ranking
and pagination. Computed distance ordering prevents use of the global nearest-neighbor index for this exact path.
Numeric `.offset(0)` was found to be omitted by the ORM and its typed API does not accept SQL offsets, so that approach
was removed. Five generated-query tests cover the path. Actual generated-query execution,
broader correctness/pagination checks, full verification and deployment remain pending; statewide search is unchanged.

The actual generated query was executed in a production read-only transaction. Bill scope, second-page scope,
conflicting jurisdiction and document scope all passed: three lookahead rows for matching scopes, zero rows for the
conflicting jurisdiction, no overlap between the two returned page prefixes, and all records mapped to HB 2266.
Combined EXPLAIN ANALYZE plus query times were 1,045 / 669 / 545 / 531 ms respectively. The synthetic vector tests
execution and filter behavior, not semantic relevance. Evidence: `reports/semantic-generated-query.json`.

The whole-session exact-ranking alternative did not pass: its bounded read timed out at 15,584 ms (57014).
Evidence: `reports/semantic-session-plan.json`. Do not extend the explicit-parent exact path to whole sessions based
on the successful small-parent benchmark. Statewide semantic acceptance requires a different measured strategy.
The verification run started before the query edit captured intermediate failing query assertions; those five focused
tests subsequently passed after correction. A fresh full verification is required against the final code.

The session-filtered existing HNSW diagnostic returned three rows in 4,708 ms, using
`document_section_embeddings_hnsw_idx` rather than exact-scoring the whole session. The shared builder now derives a
safe canonical session prefix and requests only the page/lookahead population when no additional relational filters
remain. Conflicting jurisdiction/session pairs, wildcard-bearing sessions and multi-scope requests do not receive this
optimization. All relational filters remain present after candidate selection; no index or embedding was rebuilt.

Actual generated-query replay returned three Washington 2025-2026 sections in 442 ms after the diagnostic had warmed
the index. Treat that as a warm observation, not a latency guarantee. Explicit bill/document scopes and page isolation
also passed again. Evidence: `semantic-session-graph-plan.json` and `semantic-generated-session-query.json` under the
archive audit reports. Seven query tests and web type-check passed. Semantic relevance, deeper session pagination,
full verification, deployment and authenticated post-deployment search remain required.

Three-page validation with a retained HB 2266 housing passage vector exposed a planner regression: page one retrieved
the source passage at distance zero, but page two chose a parallel sequential embedding-table scan and timed out.
The captured plan is in `semantic-pagination.json`. An index-preferred transaction completed all three pages without
duplicate IDs. The shared ANN path now sets `enable_seqscan=off` locally within its transaction; explicit-parent exact
ranking retains ordinary planner settings. This does not change a database-wide setting.

The actual implementation, without a diagnostic planner override, then completed pages in 1,958 / 1,941 / 1,911 ms.
All 15 results belonged to Washington's current session; the known passage ranked first and no page IDs overlapped.
Evidence is `semantic-pagination-implementation.json`. This is a self-retrieval/pagination check, not a held-out relevance
evaluation or proof of deep-pagination stability under concurrent corpus changes. Seven focused tests and web type-check
passed. Deployment and post-deployment authenticated semantic/hybrid checks remain open.

## Additional authenticated relationship acceptance (2026-09-19)

The full `pnpm verify` process completed successfully (session 80295), including 239 web acceptance tests,
built MCP acceptance and the separate-audience API/MCP boundary checks. Database suites without a supplied
disposable database and the positive disposable-corpus boundary case were explicitly skipped; this is not proof
of those integration cases. Focused production read-only evidence above remains separate.

Live authenticated `get_person` returned Adam Bernbaum with his canonical Washington district 24 term and three
committee memberships, all with source provenance. Organization-filtered `search_events` returned the expected
House Housing meeting `event:openstates:wa-agenda-32398` within the January 13 Pacific-day window.
`read_record_collection(meeting-agenda)` returned its three agenda items with complete bill relationships;
amendment and material relationships remain explicitly incomplete. Collection order is ID-based, not agenda order;
consumers must use the supplied ordinal when presenting the agenda.

`get_organization` for House Housing returned `unprocessable`: no source-complete detail profile. This is a real
remaining acceptance gap, not a failed committee import. The shared repository committee importer deliberately sets
`detailFactsComplete` and `childRelationsComplete` false, while marking memberships complete only after dependency
resolution. Existing tests explicitly assert that policy for Alaska and North Carolina. Do not flip those flags simply
to make the endpoint succeed: obtain and retain the missing profile/hierarchy facts through a shared source adapter,
or explicitly revise the public partial-detail contract with its coverage semantics. Washington regular-sync acceptance
remains open. No production settings or schedules were changed by these checks.

## Isolated search release and live acceptance (2026-09-19)

Railway deployment `3cb2b61c-7302-4797-98bf-25352cca12a6` reached `SUCCESS`. Its source is the previous production
baseline `71562dd` plus exactly `search.ts` and `semantic-passage-query.test.ts` from `d4faba9`, exported into
`.codex-deploy/washington-search-d4faba9`. The runtime search blob is
`c18b92b1cbd563aab4400372810973c4c9ba648e`. Unrelated staged/unstaged telemetry and evaluation work was not uploaded.
The remote build compiled and type-checked successfully; production `/health` and `/ready` returned HTTP 200.

Authenticated MCP `search_bill_text`, query `housing affordability and residential zoning`, limit three:

| Scope and mode | Observed wall time | Result |
| --- | ---: | --- |
| HB 2266, semantic | 2,097 ms | Three canonical HB 2266 passages, embedding and reranking providers completed |
| Washington 2025-2026, semantic | 10,730 ms | Three correctly scoped passages, no warnings |
| Washington 2025-2026, hybrid | 6,789 ms | Three correctly scoped passages, no warnings |
| Washington 2025-2026, lexical | 511 ms | Three correctly scoped passages, no warnings |
| Same statewide semantic query, returned page-two cursor | 1,998 ms | Three passages, no overlap with page one |
| Same statewide hybrid query, returned page-two cursor | 1,544 ms | Three passages, no overlap with page one |

Results include canonical bill/document/section IDs and URLs. These requests close the reproduced post-deployment
semantic/hybrid timeout cases; they are bounded smoke evidence, not a throughput SLA or held-out relevance benchmark.
No embeddings or indexes were rebuilt. Hosted scraper activation, full-calendar ingestion and scheduled-delta acceptance
remain separate open gates. The official CommitteeService `GetCommittees?biennium=2025-26` was also inspected: it supplies
standing committee identifiers, chamber, names, acronym and phone, but does not establish a complete child hierarchy.
Do not use that response alone to assert full committee-detail completeness.

## Hosted extraction canary (2026-09-19)

The existing Azure job supports per-execution image and environment overrides. This was used instead of replacing
the shared production template. A cloud layer built on the verified Washington adapter passed runtime startup checks
and was pushed as immutable image
`acrr2jsh7uot4legdev.azurecr.io/openstates-scraper@sha256:0696a3f2801ded36d29364040d9c308b181b5484fa266384bd5d2c2d15ec2f75`.
Its source-input approval remains `3556d11cfa4010e0e8909e14b551f054e2b84a3d7deb0a242d62101e5bc8156e`.

A separate `openstates-scraper-canary` queue was created in the existing storage account. The shared dispatcher submitted
only HB 1000 with a 600-second deadline. Execution `leg-dev-openstates-scraper-vy3vrgq` ran from 08:48:00 to 08:48:42 UTC
and reached `Succeeded`. The shared worker retained six checksum-verified files in the existing `state-sources` container
and emitted a queue-deletion settlement for `wa-hosted-house-canary-20260919`. The shared archive reader and normalizer
accepted exactly `bill:wa:2025-2026:hb:1000`: three actions, two documents and no votes. Repeated normalization was identical.
Manifest SHA-256: `c7f560a60da24eacd36669f33a8fe9da9940a0eec34a5134877acfab99624af1`.
Local verification report: `artifacts/openstates-washington-hosted/house-canary.json`.

Read-back confirmed the persistent production job still uses image `sha256:cd41549d55377efdd0ce8637bda9800f74b546d2791cb0dc083d132776938369`
and queue `openstates-scraper-dispatch`. The canary has no database credentials and performed no canonical writes.
This proves hosted House extraction, identity-based queue/blob access, retention, settlement and deterministic normalization;
it does not prove Senate/vote extraction, hosted event windows, canonical promotion, full-session refresh or regular syncing.
At that point the canary queue had no automatic scaler; the isolated deployment below supersedes that limitation.

Two further one-off executions passed using that same immutable image and isolated queue:

| Lane | Execution | UTC start/end | Verified retained result |
| --- | --- | --- | --- |
| Senate SB 5000 | `leg-dev-openstates-scraper-havvz40` | 08:51:45 / 08:52:33 | Eight files; 22 actions, eight document links, two roll calls and 98 positions |
| January 13 meeting window | `leg-dev-openstates-scraper-sf0abnk` | 08:53:42 / 08:54:24 | Sixteen files; exactly 11 meetings matching the complete window inventory |

Both Azure executions reached `Succeeded`, their shared queue settlements were observed, and repeated shared
normalization/preparation was identical. Source-input fingerprints and every retained file hash were checked by the
existing archive reader. Neither canary wrote canonical records. Reports are
`artifacts/openstates-washington-hosted/{senate-canary,meetings-canary}.json`.
Manifest hashes are `7c6c74b110519a2174769c57402458d122605cb3a1af82b10af93ad558e1435f` (Senate) and
`c622c44195bd175f5ac3034f1330b9749b9599fc7b81efae9e4f0b4ccb4cefab` (meetings).

The promotion path's shared person resolver was then run in a production **read-only** transaction. It resolved
97 of 98 Senate positions. One `Ramos` yes position remains unresolved, with its original source identity preserved;
see `senate-people.json` in that report directory. The retained Bill Ramos history contains an upper-chamber 2019-2025
role overlapping his lower-chamber role, so whole-person quarantine excludes him from the accepted resolver population.
This is not authorization to loosen tenure checks or insert a guessed voter ID. Official
[Senate Resolution 8659](https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Senate%20Resolutions/8659-.pdf)
states House service from 2019 to 2025, Senate service beginning January 2025, and death on April 19, 2025.
The retained source also ends his current Senate role on April 23. A source-backed, replayable history adjudication
remains required; no person-specific engine rule or production correction was applied in these checks.

## Isolated calendar worker and empty-window correction (2026-09-19)

Deployment `wa-scraper-candidate-20260919` succeeded using the shared Bicep template, creating only
`leg-dev-openstates-candidate` on `openstates-scraper-canary`, capped at one execution. Read-back confirmed the existing
NC/AK job retained its original image, queue and maximum of three. This is bounded extraction capacity, not activation
of Washington's regular schedule.

The shared plan builder retained 90 seven-day-or-shorter windows spanning 2025-01-01 through 2026-09-19, at
`openstates/event-window-plans/wa/2025-2026/c2e3cc9c1b0f9fdcbd5dd40c8f4aa20fe8128c2740e85ceebb267daffac97a42/plan.json`.
The first automatic execution, `leg-dev-openstates-candidate-t8qp6`, failed safely: the publisher returned a valid empty
January 1-7 inventory, but the adapter had removed the upstream `EmptyScrape` signal. Open States rejects a silent
zero-object return. No canonical promotion occurred; the failed attempt and complete empty inventory remain retained
under run `wa-event-f4286234-c9a2-4762-a4fc-33c45d401211`.

The source policy now preserves that native empty-result protocol after saving complete-window evidence. The regression
test exercises `do_scrape`, not only the generator, and still rejects malformed inventory. Six Washington event tests,
13 source-policy tests, and 16 TypeScript calendar/task tests passed. Live local execution of the same empty window
exited zero. Corrected source-input fingerprint:
`7b5f40cb0eca33867b3509486a7f8f869733ec033d79f2a19f47c7189dd17b01`.
Corrected cloud image: `sha256:ef58f4a63286c8d6d6a3c105830530c945bf9dc14d15e3eed0385bb74c38df51`.
Full `pnpm verify` was attempted but stopped in unrelated concurrent web edits at `conversations/capture.ts:161-162`;
this is not a clean repository-wide verification result.

The corrected isolated image was deployed successfully. Automatic execution `leg-dev-openstates-candidate-r9kwz`
ran from 09:11:54 to 09:12:24 UTC and succeeded. The shared coordinator then confirmed the committed empty-window
receipt: one completed window, 89 pending, next window ID
`4ea6955f88beb592bf507954d1e23362f81c147434fca7a99dfafc834eba8266`. Queue peek was empty after settlement.
This closes the empty-week runtime defect end to end; it does not establish full-calendar completion.

January 8-14 extraction `leg-dev-openstates-candidate-fdvds` succeeded, but promotion correctly stopped on a committee
ID validation mismatch. The official `GetCommitteeMeetings?beginDate=2025-01-08&endDate=2025-01-14` response identifies
agenda 32315's joint JLARC host as ID `-5`. Committee IDs now accept signed nonzero integers; agenda IDs remain positive,
and joint-host canonical relationships remain incomplete rather than guessed. The retained archive from
`wa-event-ce1f05c2-1ce4-426e-9adb-7b791f7f5bc9` then passed full preparation with 31 meetings and exact inventory coverage.
Eight event preparation tests passed, including malformed signed IDs and the incomplete joint-link boundary.

Hosted bill and meeting tasks now use the same explicit jurisdiction queue resolver. Twenty focused routing/task tests
passed, including candidate isolation and failure before dispatch when an explicit routing table omits a state.
The routing change is local until the Trigger deployment is updated; production NC/AK routing was not changed.

The corrected January 8-14 retry (`leg-dev-openstates-candidate-5q46n`) succeeded and committed the second window.
A sequential operator invocation of the shared cycle then committed the third window and continues toward the remaining
87 windows, stopping on any failure. Each iteration re-reads the immutable plan and committed receipts; it does not
advance on extraction success alone. This finite backfill is not the regular Washington sync schedule.

Washington bill orchestration now reuses the existing bill plan, dispatch, extraction, person reconciliation and content
controller chain. Reviewed states/session paths are derived from the shared bill profiles rather than separate task
regexes. Washington selects its candidate fingerprint and one bill-batch dispatch slot; NC/AK retain their existing
fingerprint and width. Washington is deliberately absent from managed bill schedule identities until acceptance.
Person reconciliation now reads the canonical source-derived vote chamber: Washington's shared `GetRollCalls` URL
does not establish which chamber voted, so missing chamber evidence stays unresolved. No guessed chamber or voter
identity was introduced. These task changes still require a pinned Trigger deployment and hosted execution proof.

Trigger deployment `20260919.18` (`h58tuci9`) built successfully with 70 tasks using `--skip-promotion`; it was not made
current and was not used to launch Washington work. Preflight confirmed the deployed API accepts the importer membership
contract. Read-only environment checks showed activation `ak,nc`, default queue `openstates-scraper-dispatch`, and no
per-state route table. Those values were not changed during this deployment.

Rollout review found bill continuations were not consistently pinned to the initiating deployment. Plan-to-dispatch,
dispatch-to-worker, refill, person reconciliation and the content handoff now preserve that version. Executable task tests
verify candidate-version propagation and the single Washington dispatch slot; 11 focused tests and ingestion type-checking
passed. A corrected unpromoted deployment is required before hosted bill acceptance. The latest full repository verify
finished with 11 failures in unrelated web tests; it is not a clean completion result.

## Pinned hosted refresh acceptance (2026-09-19)

Corrected Trigger deployment `20260919.20` (`5p62ev6y`) succeeded with 70 tasks and `--skip-promotion`.
Manual task admission now includes `ak,nc,wa`. The explicit queue routes preserve `ak` and `nc` on
`openstates-scraper-dispatch` and place `wa` on `openstates-scraper-canary`; both settings were read back.
No Washington recurring schedule was created and the candidate was not promoted to the current deployment.

Idempotent plan run `run_06gbi1tbrfes91pl7p1kt3ho01` completed with 3,411 publisher bills in 342 batches.
Its immutable inventory ID is `093b6b38e2ef0dbb94458f1a3048605297487bc46085f42cf402bcd28c168517`.
The first cloud run, `run_06gbi1vi29hstv3sipflnaif01`, completed with a committed promotion receipt for ten bills.
The retained manifest hash is `626887fe44b97513d02c7bc74adeb4f50449d4ad34ac0d29b38437a459517956`.
That receipt reports one unresolved sponsor and four unresolved vote positions; those are open identity-resolution
gaps, not successful mappings. The session is explicitly incomplete.

The shared continuation automatically dispatched `run_06gbi2q67uvl17p7sat5umg801`, then cloud run
`run_06gbi2r0tkftcbf908bdmblo01`. Both retained version `20260919.20`; the latter was observed executing.
This establishes the hosted promotion-to-refill path, not full-session completion or downstream content readiness.
The separate receipt-driven calendar operator has committed eight of 90 windows and remains active.
Final person reconciliation, document extraction/OCR, embeddings, search synchronization, replay validation and
authenticated retrieval still require session-wide acceptance before recurring syncing is enabled.

Read-only replay of the first retained batch resolved 780 of 784 vote positions. All four remaining positions identify
Ramos (HB 1003, 1006, 1007 and 1009), consistent with the held history above. The unresolved sponsor is Scott on HB 1002.
The publisher's [original HB 1002 text](https://lawfilesext.leg.wa.gov/biennium/2025-26/Htm/Bills/House%20Bills/1002.htm)
lists Scott and distinguishes prefiling on 2024-12-02 from first reading on 2025-01-13. The retained normalized actions
preserve those classifications as `filing` and `reading-1`, respectively. The shared aggregate resolver falls back to the
earliest action when `introducedAt` is absent; reconciliation independently uses the minimum action date. Both therefore
use the prefiling date for sponsorship tenure. A shared, evidence-based sponsorship observation-date correction is needed
in both paths, with tests for prefiling, ordinary introductions and unresolved/ambiguous identities. Do not change vote
dates, invent tenure boundaries, or add a Scott-specific exception. This diagnosis has not yet changed canonical mappings.
Read-only evidence: `artifacts/openstates-washington-hosted/first-batch-people.json`.

The shared sponsorship-date selector now prefers explicit introduction, then classified first reading/introduction,
before an undifferentiated earliest action. Both aggregate ingestion and persisted reconciliation use it. Seventeen
focused tests and ingestion type-checking passed. Read-only replay of the retained ten-bill batch now leaves zero
unresolved sponsors while preserving the same four unresolved Ramos positions; evidence is
`artifacts/openstates-washington-hosted/first-batch-people-corrected.json`. No canonical corrections were written.
The reconciliation sponsor query initially exceeded the diagnostic 30-second statement budget; restricting its
indexed action lookup to bills with unresolved sponsors let that query finish. The subsequent existing vote-position
query then exceeded the same budget and still needs performance diagnosis. Full verification was started again and
is not yet a clean completion result. The active hosted chain remains pinned to `20260919.20`, without this new fix.

Reconciliation's vote query plan incorrectly estimated one global null-person row and selected `vote_positions_person_idx`
before applying the Washington session scope. The query now materializes session votes and performs vote-indexed position
lookups before filtering unresolved identities, counting siblings once per unresolved vote. A production read-only plan
then completed under the same 30-second per-statement budget: 170,529 proposed vote-position links, 567 still not found,
three proposed sponsors, zero ambiguous decisions and zero sponsor uniqueness conflicts. Scott on HB 1002 maps to the
canonical Shaun Scott source identity. This is a correction plan, not executed corrections or proof of complete history.

The second hosted batch `run_06gbi2r0tkftcbf908bdmblo01` reached `FAILED` before promotion with
`Ambiguous duplicate sponsor observation`. Do not launch an overlapping refresh or accept the failed batch as committed;
inspect its retained sponsorships and correct normalization only if the evidence establishes an exact duplicate.
Calendar ingestion is independent and has committed 11 of 90 windows.

The failed second batch retained manifest `9ba451fba59a7982864be4c5d174aae44245fab05c6b50903e71ccf3506cb7e8`
under run `wa-bill-1eb3fa750acdfdd87a1473cbe1f8892d`. Inspection found five exactly repeated cosponsor observations
(Walen, Timmons, Fey, Ormsby and Hill), including identical identity and role fields. Shared normalization now coalesces
only deeply equal observations with the same stable observation key. Conflicting fields still reject the batch, and
the immutable source archive preserves every occurrence. Nine normalization tests and ingestion type-checking passed.
Read-only normalization of the actual failed archive now accepts all ten requested bills, HB 1010 through HB 1019.
Deployment and resumed hosted promotion are still required; no production records were written by this replay.

Candidate `20260919.22` (`movd9unx`) deployed successfully without promotion, including sponsorship-date selection,
bounded reconciliation queries and exact-duplicate sponsorship handling. After confirming the previous second-batch run
was terminal `FAILED`, one idempotent corrected retry was submitted as `run_06gbi7ej2292ne2qhls69ank01`, pinned to that
version and the same frozen batch. It was observed `EXECUTING`; this is not yet a committed promotion receipt.

Calendar receipts now confirm 13 completed windows and 77 pending. The local operator process (PID 71844) is absent,
but window `37548bc9ec87d291f52b2fa135a85ee0e65aa6557507934ff22da00ea3a79528` retains unreleased ownership for
`wa-event-fc8e8e7b-eb2f-45a0-a045-0b0ee667b0f8`, with no retained manifest or settlement marker. No ownership was
cleared and no duplicate calendar execution was launched. Safe recovery must establish dispatch/worker settlement,
not assume lease age or a missing local process means a cloud request cannot still execute.

The corrected second bill batch subsequently committed ten bills with zero unresolved sponsors and four unresolved
positions, then automatically dispatched the third batch on `20260919.22`. Receipt manifest SHA-256:
`d68971f43eaf880d39d7a61c6de22e8a28e2d8e8761f2704852c2200e43cbded`. Hosted duplicate handling is therefore verified
for the failed batch, not merely a local replay. The latest full verification passed ingestion coverage but failed eight
tests in the concurrently edited web vote-attribution suite; repository verification remains open.

The operator reconciliation CLI now uses the same `scraperBillState` schema as hosted ingestion rather than an NC/AK-only
enum. Its production read-only Washington dry run completed, and `--apply` without a reviewed digest failed before database
access. The observed plan digest was `e7f2ffce3fdb1b3667fa3997c3d71bd6ca8abd8bc46a49357e8b8dbce6f7ba16`, with 169,213
proposed positions, 567 unresolved positions and three proposed sponsors. Counts can shrink as live ingestion resolves
relationships. No manual apply was performed; the hosted reconciliation still requires the frozen bill cycle to finish.

## Hosted content handoff canary

Production scraper activation included Washington, but content activation still contained only `nc,ak`. The narrowly
scoped `OPENSTATES_CONTENT_ENABLED_STATES` value was extended to `nc,ak,wa` and read back successfully. Shared worker and
controller concurrency remain two; no recurring Washington schedule was created and no candidate was promoted.

Pinned `20260919.22` run `run_06gbi9p922afiiuvjhlkemng01` completed successfully with a one-bill, concurrency-one payload.
For `bill:wa:2025-2026:hb:1000`, it processed two existing documents, inserted ten embeddings and skipped eleven existing
embedding work items, with no document or embedding failures. Neither document required OCR; this run does not establish
Washington OCR acceptance. The checkpoint explicitly reports `ingestionComplete: false`, `searchVerified: false` and
`nextWork.kind: continue`. Treat this as proof that the shared hosted content path works, not session-wide completion or
duplicate-free replay proof. The existing shared controller continues from canonical backlog until drained, including
rescheduling itself after its per-run continuation budget; no Washington-specific processing loop is needed.

Five bill batches have committed (50 of 3,411 inventoried bills). The sixth was observed executing as
`run_06gbia5c4u4093f5prk7u4g301`, pinned to the same candidate. Calendar recovery remains separate: the held window still
has no retained manifest or settlement marker. An approximate queue count of zero is not sufficient evidence to clear
ownership; do not infer cloud shutdown from that count or the missing local process alone.

## Replayable historical-role reviews

The shared people importer now consumes repository-reviewed role data from
`src/ingestion/openstates/review-data/people-roles.json`, rather than person-specific branches in the resolver. Each
review binds jurisdiction, pinned revision, source path, exact SHA-256, source person ID and exact before-role values.
Source drift, duplicate targets, invalid dates and conflicting jurisdiction changes fail closed. Existing history
validation still applies after correction; reviewed data cannot bypass overlaps, duplicate identities or coverage gates.
Original archive bytes remain untouched. Applied reviews, including reasons and evidence URLs, are recorded in the
people-history checkpoint. Corrected terms cite the corroborating evidence instead of the contradictory source file;
unchanged terms keep their original provenance. `sourceIsOfficial` remains false for these derived adjudications.

The first review removes Ramos's contradictory 2019-2025 Senate assertion and corrects the 2025 Senate end date to
April 19, supported by [Senate Resolution 8659](https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Senate%20Resolutions/8659-.pdf).
It does not invent or change the supplied House boundaries. The upstream master file still contains both defects at
review time. A read-only replay of the exact retained Ramos file produces one person and two terms without quarantine.
This is not yet a production import, vote-link reconciliation, or closure of the other historical reviews.
The full checksummed current/history pair also replays successfully: 337 people, 369 terms, 19 quarantined files and
zero current-roster coverage issues. Twenty-four focused review/import/quarantine tests and ingestion type-checking pass.

The reviewed full archive pair was then imported into production through `importPeopleRepository` and replayed once.
Ramos previously had no canonical Open States terms; the import created the two expected terms. The second import
preserved their exact IDs, dates and source URLs without adding a term. Authenticated MCP `get_person` returned his
inactive identity, both terms and the Senate resolution provenance. A read-only replay of the first ten-bill retained
batch now resolves all 784 vote positions (previously 780) and every sponsor. Evidence:
`artifacts/openstates-washington-hosted/first-batch-people-role-reviewed.json`. This proves resolution for that batch;
the full-session null-link reconciliation still waits for the hosted bill cycle and is not claimed complete.

Three additional reviews remove erroneous pre-Senate upper-chamber assertions for Chris Gildon, Marcus Riccelli and
Noel Frame. Their official biographies independently distinguish the earlier House service from subsequent Senate
service: [Gildon](https://chrisgildon.src.wastateleg.org/about/),
[Riccelli](https://senatedemocrats.wa.gov/riccelli/biography/) and
[Frame](https://senatedemocrats.wa.gov/frame/biography/). The supplied legitimate roles and their dates are unchanged;
no general rule converts a conflicting role into another chamber or guesses a boundary. Full retained-archive replay
now yields 337 people, 372 terms, 16 quarantines and no current-roster coverage issues. All 24 focused tests pass.
Production import and replay subsequently succeeded. For the four reviewed people, eight canonical terms now exist;
the second import preserved the exact term IDs, dates and source URLs. The three current-only fallback terms were
replaced by accepted House/Senate histories, rather than retained as extra copies. This verifies the reviewed cohort,
not the remaining 16 held histories or the entire session's vote links.

## Calendar ownership recovery and hosted continuation

The interrupted local calendar ownership was released only after additional runtime evidence: the original PID was
absent; the visible candidate queue was empty during inspection; all earlier candidate executions after the held claim
were successful; and the sole execution active during inspection (`leg-dev-openstates-candidate-r45jq`) subsequently
settled bill attempt `wa-bill-002dd3ebe2e7d219f3f5001f3cdbec6b`, not the orphaned event attempt. The NC/AK worker still
uses `openstates-scraper-dispatch`, separate from the candidate queue. The old event attempt still had neither a retained
manifest nor a settlement marker. This recovery did not use expiry alone. Token-matched release succeeded without
deleting any queue messages or cancelling any workers. Evidence: `artifacts/openstates-washington-hosted/calendar-orphan-recovery-evidence.json`.

One idempotent hosted `openstates-event-windows` continuation was submitted as `run_06gbifvoqsr2cthvmfanofr501`, pinned to
`20260919.22` and the unchanged frozen 90-window plan. It resumes from committed receipts (13 at recovery), rather than a
caller-supplied next offset. Further continuations are hosted and version-pinned, not dependent on a long-lived local
operator. No recurring schedule or concurrency increase was introduced. Submission alone does not prove the next window
was promoted; its receipt remains a verification gate.

The recovered hosted run subsequently completed with 14 committed windows and 76 pending, and automatically started
`run_06gbigjp6jb1lhar4c518sof01` on the same `20260919.22` version. This closes the recovery/continuation check, not
the full calendar gate. Concurrent bill run `run_06gbifkgn816jnsueb4crmbq01` completed ten bills with zero unresolved
sponsors or positions and dispatched the next batch automatically.

Two further source-bound reviews remove contradictory pre-2025 Senate assertions for Jessica Bateman and Keith
Goehner. The [January 13 Senate journal, page 9](https://leg.wa.gov/media/uvyisxpn/sj_25_001.pdf) distinguishes them
from re-elected senators and records their new-member oaths. Bateman's
[official biography](https://senatedemocrats.wa.gov/bateman/biography/) also confirms earlier House service. These
reviews preserve independently supplied House roles; their precise House boundary dates are not newly certified.
The full retained pair now prepares 337 people and 374 terms with 14 held histories and no current-roster coverage
issues. Production import and replay succeeded: all six reviewed people have exactly two canonical terms each, and
the second import preserves all twelve IDs, dates and source URLs. No new name-specific engine logic was introduced.

Jeff Holy's reversed duplicate Senate assertion is now reviewed as House service beginning January 14, 2013, retaining
the supplied January 13, 2019 end. The [2013 House first-day journal](https://lawfilesext.leg.wa.gov/law/Journals/2013/HJ_13_001.htm)
records the House oath, and his [official Senate announcement](https://jeffholy.src.wastateleg.org/senator-jeff-holy-takes-oath-office-olympia/)
records a first Senate term on January 14, 2019 after three House terms. Full retained-pair preparation now yields
337 people, 375 terms, seven applied reviews and 13 quarantines, with no current-roster coverage issues. Production
import and replay preserved all fourteen terms for the seven reviewed people. Authenticated MCP `get_person` returned
Holy's historical House term with journal provenance, current Senate term and four current committee memberships.
The focused review/import/quarantine suite passed all 24 tests. Full repository verification is still running; this
cohort check does not establish full-session or statewide acceptance.

Marko Liias's duplicate one-day Senate assertion is now replaced with documented House service from January 7, 2008
to January 21, 2014. The [2008 House journal](https://lawfilesext.leg.wa.gov/law/Journals/2008/HJ_2008_001.htm)
records the appointment, the [proofed 2014 House journal page 71](https://leg.wa.gov/media/2r3mko3g/2014housejournal.pdf)
records immediate resignation, and the [2023 legislative historical reference](https://leg.wa.gov/media/3uuctf3k/members-of-the-legislature-1889-2023.pdf)
distinguishes January 21 Senate appointment from January 22 swearing-in. The supplied Senate start is preserved.
Full preparation/import now yields 337 people, 376 terms, eight applied reviews and 12 held histories. Production
replay preserves all sixteen terms for the eight reviewed people. Authenticated MCP returns Liias's House/Senate
terms and the corrected House source evidence. All 24 focused tests passed.

The full `pnpm verify` run ended unsuccessfully in ingestion coverage: 2,007 tests passed and one regulatory
`table-passages.test.ts:418` test timed out at 30 seconds. Its isolated rerun passed in 15.08 seconds without changes.
This does not make the full suite green; later web/Python/database/acceptance gates remain unproven. No unrelated
regulatory tests, timeout limits or web search changes were modified. Calendar receipts subsequently reached 16/90,
with another hosted window executing and bill continuations still active on `20260919.22`.
