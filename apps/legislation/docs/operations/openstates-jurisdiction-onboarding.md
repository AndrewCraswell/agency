# Open States jurisdiction onboarding queue

Current priority is the [NC/Alaska end-to-end gate](openstates-rollout-checklist.md#blocking-delivery-priority-nc-and-alaska-end-to-end-ingestion).
NC's 2,338-record/235-batch and Alaska's 856-record/87-batch local frozen imports have recorded completion. That is not
content/search, complete identity/event coverage or production activation. Check live processes/holds before resuming;
dated check-ins below are evidence, not instructions to relaunch an old next batch.

## Alaska shared execution acceptance (2026-09-15)

- [x] Froze the official Legislature 34 range: 856 bills/resolutions in 87 single-chamber batches.
- [x] Shared dispatch, batch ownership, recovery, receipt assessment, Docker execution and bounded wave runner now support Alaska.
- [x] Initial ten-bill local promotion completed; source/dispatch/build fingerprints and exact batch membership were checked before commit.
- [x] Corrected journal identity: multiple motions on one page stay distinct; tally changes do not rename the motion.
- [x] Withhold inferred Alaska passage labels/outcomes and missing voter collections; totals-only observations do not erase existing positions.
- [x] Two- and four-worker local stages passed. A separate HCR/HJR resolution batch also promoted; 80 records committed.
- [x] Final repository `pnpm verify` passed: 2,950 legislation tests passed, 121 conditional skips, four receiver tests passed.
- [x] Eight-worker trial drained safely: six batches promoted, two HTTP-failed batches remained pending. Both passed on a two-worker retry.
- [x] Safe HTTP diagnostic categories now distinguish access denial, rate limiting, not found and server failures without leaking URLs or bodies. Linux runtime tests: 31 passed.
- [x] Sustained four-worker local import completed: September 15 09:20 UTC check-in confirmed 856/856 records (87/87 batches), zero pending, and importer exit code zero. No scraper containers remained. Eight workers are not recommended for this source.
- [ ] Extract/validate individual journal voters, validate events, resolve source completeness gaps and approve production activation separately.

Plan: `openstates/scraper-plans/ak/34/local-9539b415-245b-41db-bb2b-567ca47a5e1a/plan.json` under
`artifacts/openstates-runtime/alaska-batch-acceptance`. Inventory: `315c12bad497ebd2cc4c884891c41351ff5484909f68ffe6d7941ecc555c1ba0`.
The failed initial attempt was retained; it produced no promotion receipt. A new owned attempt promoted HB1–HB10 after the journal identity fix.
No production writes occurred.

Current diagnostic image: `sha256:81703183375f53d0cf9a721d491462a759fc833e70806be104c388a3632bdb34`.
Approved source-input fingerprint is unchanged: `9563199bc8d86e0a83524fd33d7c5c78711c130f1ae850ba7746b008bd4cabeb`.
The two-hour admission budget reserves each full 30-minute ownership window; each worker still has a 25-minute extraction limit.
Any failed wave drains before surfacing the error and does not admit replacement work automatically.

Check-in history: 08:43 UTC reported 514 committed records; 09:03 UTC confirmed 794 via read-only cycle receipts
(280 additional records). Four scraper containers were active, no database lock waits were observed, and Trigger
reported no executing or queued runs. The existing local importer was left running without a duplicate launch.
There are 2,578 unresolved sponsor observations; these remain source references, not guessed person links.
Zero unresolved voter positions does not establish coverage: individual Alaska voters are not extracted yet.

Completion check-in (09:20 UTC): all 87 receipts passed the read-only cycle assessment; 2,741 sponsor observations
remain unresolved. A deeper archive audit using promotion preparation stopped at the expired dispatch-window guard;
archive-wide revalidation is not yet complete and must not bypass live promotion safeguards.
Local downstream inventory: 856 bills, zero bill embeddings, 15,064 pending document records with no extracted text,
and zero document sections. All four local embedding HNSW indexes are valid and ready, but that does not establish
embedding coverage. Document acquisition/extraction, OCR where needed, embeddings, lexical projection and API/MCP
search acceptance remain separate deliverables. These results do not describe production database coverage.

## Alaska live extraction alongside NC (2026-09-15)

- [x] NC's eight-worker frozen cycle completed locally: 2,338/2,338 bills, 235/235 batches, zero pending.
- [x] Reviewed the pinned Alaska scraper and added bounded bill-ID selection through the shared runner/profile path.
- [x] Built the new image offline from verified dependencies; 31 Python tests passed inside Linux (no skips).
- [x] Live Alaska Legislature 34 HB1/HB2 extraction succeeded. Eight files were checksum-retained and replayed locally.
- [x] Twenty-two TypeScript archive/normalization tests passed, including cross-state rejection and no invented vote instant.
- [x] Final repository `pnpm verify` passed: legislation 2,941 tests passed, 119 conditional skips; four receiver tests passed.
- [x] HB1/HB2 retained replay now normalizes successfully. Source-qualified sponsor observation keys distinguish
  chamber claims without resolving people; exact duplicate observations still reject. The official HB1 page was
  checked and really repeats names under both chamber headings. Twenty-seven focused TypeScript tests passed.
- [x] Frozen Alaska discovery and shared canonical promotion/fan-out are implemented; live acceptance is tracked above.
- [ ] Event validation and production activation remain open.
- [ ] Alaska individual roll-call positions: HB1's two extracted votes have totals but zero positions. The pinned
  `parse_vote` does not fetch journal voter lists; zero unresolved positions must not be interpreted as complete coverage.

Image: `sha256:b1c6989979b258affbd7c59560722feb493469ce9123df86cb7a9570bdf32794`.
Approved prepared inputs: `9563199bc8d86e0a83524fd33d7c5c78711c130f1ae850ba7746b008bd4cabeb`.
Raw evidence: `artifacts/openstates-runtime/alaska-canary-07dfb4ad-bf09-4912-9453-aa9b5b0f820c/openstates-ak-1ln7z6fb`.
Retained marker under `artifacts/openstates-runtime/alaska-batch-acceptance`:
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/ak/bills/alaska-batch-canary/retained.json`.
No Alaska canonical writes or guessed identities occurred. Existing people/history quarantine remains unchanged.

## Concurrent extraction acceptance (2026-09-15)

- [x] Batch-scoped ownership replaces extraction-wide session serialization. Short admission locking permits only
  one frozen inventory's disjoint batches while conflicting or uncertain prior holds remain blocked.
- [x] Recovery resolves exactly one ownership record by run token; original host/runtime and shutdown evidence remain required.
- [x] Forty-six focused tests and eleven real PostgreSQL tests passed, including concurrent promotion and held-worker rejection.
- [x] Live fan-out stages all promoted their exact batches and returned successfully:

| Workers | Bills committed | Wall seconds | Bills/minute |
| --- | --- | --- | --- |
| 2 | 20 | 40.45 | 29.7 |
| 4 | 40 | 49.44 | 48.5 |
| 8 | 80 | 58.04 | 82.7 |

These are different consecutive source batches, not a controlled identical-input benchmark. Samples confirmed 2/4/8
simultaneous worker containers and ownership records. Eight-worker memory was about 101–102 MiB each in the sample;
no PostgreSQL waiters were observed in those samples. No throughput plateau was established beyond eight workers.
Selected concurrency: eight, preserving the configured cap and all-worker draining after failures.

Frozen-cycle progress after stages: 210/2,338 bills, 21/235 batches promoted, 214 pending. H211-H220 are next.
Source-only references: 4,411 sponsors and 13,123 vote positions. No name-only links or production writes.
Full-session completion, hosted orchestration and other-state runtime acceptance remain open.

- [x] Final `pnpm verify` passed: 2,933 legislation tests, 119 conditional skips and four receiver tests.
- [ ] Sustained local run launched after verification with `max-batches=214`, `admission-budget-seconds=7200`,
  `concurrency=8`, against the existing frozen cycle. Do not launch another run while this process or its holds exist.
  This is actively processing, not a completion claim. Inspect receipts and runtime before the next check-in action.

## Non-overlapping check-in (2026-09-15 07:13 UTC)

- [x] Detected an existing repository verification process (PID 61040), Vitest workers and Next.js build.
  Left them running; no duplicate verification, scraper or test-database writes were started.
- [x] Trigger reported no queued/executing runs. No run-labeled scraper container was present; the recorded scraper
  ownership was released and no other active test-database session was observed at inspection.
- [x] Read-only cycle inspection confirmed 70/2,338 bills and 7/235 batches promoted, with 228 batches pending.
- [ ] H71-H80 remain next after concurrent verification finishes. Hosted orchestration and final data/API acceptance
  are still open; this check-in does not establish a new verification result or production readiness.

No user decision is needed. The previously verified bounded runner remains available; unrelated work was preserved.

## Bounded cycle processing checkpoint (2026-09-15 06:55 UTC)

- [x] Check-in found no active Open States process/container, test-database session or queued/executing Trigger run.
- [x] Added sequential multi-batch processing through the existing one-batch resume path, with fresh attempt IDs,
  monotonic admission budgeting, shared ownership-window duration and explicit batch/time/completion stop reasons.
- [x] Failures stop the invocation; no outer timer abandons a worker, automatic retry or overlapping fan-out was added.
- [x] Twenty-eight focused runner/resume/execution tests passed, including failure and unknown-shutdown refusal.
- [x] Final `pnpm verify` passed: 2,920 legislation tests passed, 118 conditional tests skipped and four receiver
  tests passed. New test lint findings were corrected before the successful full rerun.
- [x] A real two-batch local invocation committed H51-H60 followed by H61-H70 and stopped with `batch_limit` after
  exactly two steps. Progress: 70/2,338 bills, 7/235 batches promoted, 228 pending. H71-H80 are next.
- [ ] Hosted scheduling/recovery, full inventory completion, supported identity linkage and final API acceptance remain open.

The same frozen cycle and approved image were used. Source-only references total 1,688 sponsors and 4,868 vote
positions; none were linked by name. No production writes or activation occurred.
Runs: `resume-b72d0c2d-f521-4c34-a31c-5cbfe858927f` and `resume-a36b5749-b98e-4094-ac4e-b78c3623e139`.
Final container absence and matching ownership release were verified.

## Continued local resume checkpoint (2026-09-15)

- [x] Confirmed the verification rerun completed its legislation suite: 2,905 tests passed, 118 conditional tests
  skipped, and four receiver tests passed. The earlier Next.js build-lock conflict did not recur.
- [x] Resumed the existing frozen cycle without replacing its inventory. H41-H50 promoted successfully, bringing
  local progress to 50/2,338 bills across 5/235 batches; 230 batches remain and H51-H60 are next.
- [x] Verified no run-labeled Docker container remained and the matching session ownership record was released.
- [ ] Full-cycle execution, hosted recovery, supported identity linkage and remaining API acceptance remain open.

Run: `resume-08223874-1805-4dae-9d56-bb155eb690c1`. Source-only references total 1,215 sponsors and 3,520 vote
positions; these remain unresolved rather than matched by name. Production writes were disabled and readiness remains false.

## Runtime identity binding checkpoint (2026-09-15 06:25 UTC)

- [x] No overlapping Open States runtime, test-database session or active Trigger job at check-in.
- [x] Docker adapter now compares the recorded daemon identity before launch and around shutdown verification.
  Wrong pre-launch runtime rejects extraction; unavailable/substituted runtime after launch preserves the hold.
- [x] Fixed an intermittent offline dispatch-window defect: capture one issued-at value and derive expiry from it,
  rather than separate clock reads that could exceed the strict thirty-minute maximum.
- [x] Twenty-three focused Docker/execution/recovery tests passed, including substituted-runtime refusal.
- [x] Actual local H31-H40 resume passed. Frozen cycle: 40/2,338 bills, 4/235 batches promoted, 231 batches pending;
  H41-H50 are next. The runtime was removed and ownership released normally.
- [ ] Automatic scheduling, full-cycle processing, hosted recovery and remaining source/API acceptance remain open.

Source-only references across four batches: 1,037 sponsors and 2,530 vote positions. No guessed identity links.
Successful run: `resume-1912e65b-2a4f-4353-a8ef-0b67988775d1`.
The frozen cycle remains `local-fc18e787-60dc-494d-832b-c58af90488a0`; production readiness remains false.

## Local recovery checkpoint (2026-09-15 06:04 UTC)

- [x] No active Open States worker, test-database session or queued/executing Trigger job at check-in.
- [x] Scraper claims now retain executor host/PID and the local Docker daemon identity supplied by local commands.
- [x] Added local-only `recover:openstates-attempt`. It requires the original host, absent executor PID, matching Docker
  daemon, no container carrying the run-ID label and matching-token release. Unknown/missing evidence fails closed.
- [x] Recovery never kills a process/container, clears an unknown old hold, relies on lease age or targets production.
  A reused live PID conservatively blocks recovery rather than risking a release.
- [x] Sixteen recovery/execution unit tests passed. Ten PostgreSQL ownership tests also passed.
- [x] Final `pnpm verify` passed: 2,903 legislation tests passed, 118 conditional tests skipped, four receiver tests passed.
- [x] Actual smoke used a child process to claim isolated ownership and exit without release. Recovery verified its
  absence, verified Docker and container absence, then released the hold. No scraper or canonical-data writes occurred.
- [ ] Hosted executor/runtime recovery, automatic scheduling, full-session processing and remaining data acceptance
  still require implementation/verification. Local recovery is not a production activation claim.

Final smoke token: `recovery-smoke-caea2c80-fe02-4fc8-b649-3f636f113cc6`.
Canonical cycle progress is unchanged: 30/2,338 bills, 3/235 batches promoted; H31-H40 remain next.
No additional user decision is needed for the next dependency-ready local work.

## Persistent shutdown hold checkpoint (2026-09-15 05:40 UTC)

- [x] No competing Open States execution, test-database sessions or active Trigger jobs at check-in.
- [x] Scraper acquisition now stores a confirmed-release requirement before launching work, protecting against a later
  crash, uncertain shutdown or database outage. Expiry invalidates promotion but cannot authorize another worker.
- [x] A new claimant cannot bypass the existing hold by requesting expiry-only behavior. Release checks the exact token,
  marks the record released and preserves release time; stale workers cannot release newer ownership.
- [x] Twenty-three focused execution/resume/PostgreSQL tests passed, including forced expiry, refused takeover,
  refused policy downgrade, wrong-token release, matching release and successful subsequent ownership.
- [x] A real local H21-H30 resume passed with the new policy. Container absence and `requiresConfirmedRelease=true`,
  `released=true` were verified. The frozen cycle now has 30/2,338 bills in 3/235 batches; 232 batches remain.
- [x] Added `io.agency.openstates.run-id` container labeling for subsequent recovery inspection.
- [x] Five Docker boundary tests passed; final `pnpm verify` passed with 2,895 legislation tests, 118 conditional
  tests skipped and four receiver tests passed. The new PostgreSQL hold test was run separately and passed.
- [ ] Operator recovery must verify runtime shutdown before clearing a hold. Automatic schedules, full-session
  processing, supported identity linkage and production activation remain open.

Run: `resume-8bee3fcf-c803-481a-9277-32c7bec20424`, cycle `local-fc18e787-60dc-494d-832b-c58af90488a0`.
Next batch: H31-H40. Aggregate unresolved references: 591 sponsors and 1,780 vote positions; no name-only matching.
No production writes, reactivation of ended tenures or new user decision.

## One-batch resume checkpoint (2026-09-15 05:20 UTC)

- [x] No overlapping Open States process, database session or active Trigger job at check-in.
- [x] Added local-only one-batch resume from a retained cycle. No replacement discovery, recursive loop, new schedule
  or production database target is accepted by the command.
- [x] Executor rereads canonical receipts after session ownership acquisition. A stale selection is rejected before
  extraction; the resumer accepts an already-promoted race only after independently reading the committed state.
- [x] Twenty-eight focused execution/resume/cycle tests passed, including no-op completion, stale selection, missing
  durable receipt and source failure without advancing to another batch.
- [x] Full `pnpm verify` passed: 2,895 legislation tests passed, 117 conditional tests skipped, four receiver tests passed.
- [x] Actual local resume promoted H11-H20 without repeating H1-H10: two of 235 batches, 20 of 2,338 bills promoted.
  There are 233 pending batches, with H21-H30 next. No production writes or session-completion claim.
- [x] Verified the resumed container is absent and its session lease was released.
- [ ] Persist a shutdown-uncertain hold before automatic dispatch so lease expiry cannot alone permit another worker
  when the previous runtime could not be inspected. This is the next non-overlap hardening requirement.
- [ ] Automatic durable scheduling, complete-session execution, supported identity linkage and activation remain open.

Run: `resume-ade2d70c-199a-4fe5-88bd-fe6ac59ff1e4`, same frozen cycle
`local-fc18e787-60dc-494d-832b-c58af90488a0`, archive root
`artifacts/openstates-runtime/local-batch-acceptance`.
Aggregate source-only references: 434 unresolved sponsors and 1,130 unresolved vote positions across the two batches.
No name-only matches were introduced. The next local implementation needs no additional user decision.

## Durable cycle inventory checkpoint (2026-09-15 04:58 UTC)

- [x] No active Open States runtime, test-database sessions or queued/executing Trigger jobs at check-in; unrelated
  regulations work remained untouched.
- [x] Added a read-only cycle inspector over the verified frozen plan and canonical promotion receipts. It validates
  receipt identity, stream, cycle, exact batch count, archive/dispatch path shape and nonnegative unresolved counts.
- [x] Only committed `promoted` receipts suppress work. Failed/extracted-only status, duplicate receipts, malformed
  metadata, foreign cycles and incorrect bill counts fail closed. Every new discovery cycle has its own namespace.
- [x] Twenty focused cycle/planner tests passed. The inspector does not substitute ledger shape checks for archive
  checksum verification, which remains mandatory on promotion.
- [x] Full `pnpm verify` passed: 2,889 legislation tests passed, 117 conditional tests skipped, four receiver tests passed.
- [x] Local read-only inspection of the live canary cycle found 2,338 bills in 235 batches: one batch/ten bills promoted,
  234 batches pending. The next exact batch is H11-H20. Unresolved counts remain 137 sponsors and 650 vote positions.
- [x] The rejected prior cycle independently reports zero promoted and all 235 batches pending. Later-cycle success
  does not suppress earlier-cycle work; extraction alone did not create a canonical receipt.
- [ ] Wire the inspected resume state into durable bounded dispatch; full-session processing and activation remain open.

The temporary cycle inspector used the retained local acceptance artifacts and isolated test database, launched no
scraper, and wrote no canonical records. It was removed after this checkpoint; durable resume now reports progress from
the same promotion receipts.

## Fresh local bill promotion checkpoint (2026-09-15 04:39 UTC)

- [x] No competing Open States process, test-database session or active Trigger job at check-in.
- [x] Added `smoke:openstates-batch`, restricted to localhost/127.0.0.1 `legislation_test`. It fetches both live NC 2025
  discovery feeds, retains a frozen inventory, executes only the first exact batch, checks canonical rows and receipt,
  then verifies an identical retained promotion replay.
- [x] Initial extraction succeeded but promotion rejected the old image's missing runner fingerprint. No promotion
  receipt was written. The unchanged rejected archive remains retained; no provenance was manufactured afterward.
- [x] Refreshed the local adapter image on the verified dependency base with networking disabled and no package downloads.
  Installed-runtime acceptance passed. The new live attempt used the resulting immutable image ID and approved inputs.
- [x] Fresh H1-H10 batch passed extraction, archived checksum/build validation, atomic local promotion and stable replay:
  ten canonical bills, matching committed receipt, no session-completion claim and no production writes.
- [x] Container absence and released ownership were verified after completion.
- [x] Final `pnpm verify` passed: 2,874 legislation tests passed, 117 conditional tests skipped, four receiver tests passed.
- [ ] Resolve supported source identities before claiming fully linked sponsors/voters: this batch retained 137 unresolved
  sponsor references and 650 unresolved vote positions. Names were not guessed into canonical people.
- [ ] Durable cycle scheduling, full-session execution, remaining API/MCP acceptance and production activation remain open.

Successful run: `local-fc18e787-60dc-494d-832b-c58af90488a0`.
Archive root: `artifacts/openstates-runtime/local-batch-acceptance`, manifest:
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/local-fc18e787-60dc-494d-832b-c58af90488a0/retained.json`.
Image: `sha256:12ae447b787b175feb7dc15ab02e52f79c4ed606df714b206bc1b6a221158fab`.
Approved build inputs: `11089591d74e926aea1bc98ecb0991bb0fb2c7512d1774e7311a630c44067274`.
Rejected prior run: `local-3fa6ca76-6158-494b-b119-da197bd974c4` (missing runner stamp).

## Local Docker adapter checkpoint (2026-09-15 04:17 UTC)

- [x] Check-in found no active Open States process, test-database sessions, or executing/queued Trigger runs.
  Unrelated regulatory containers and worktree changes were preserved.
- [x] Connected a local Docker adapter to the batch coordinator contract. It validates retained dispatch and exact
  batch IDs, accepts only an immutable image ID, disables image pulls and passes no database or cloud credentials.
- [x] Container uses a read-only root, bounded temporary space, CPU/memory/process limits and a private staging mount.
  After successful or failed execution it removes its uniquely named container and independently verifies absence.
- [x] Unknown shutdown raises a typed error and does not release the session lease. This requires runtime inspection
  before another attempt; lease expiry alone is not proof that an unreachable worker stopped.
- [x] Reused one checked attempt-directory reader for CLI archiving and the adapter, preserving checksum-verified raw
  archives and failed-attempt evidence. No duplicated normalization or person-specific correction logic.
- [x] Eighteen focused tests passed: Docker safety boundaries, coordinator shutdown handling and archive normalization.
- [x] Full `pnpm verify` passed: 2,874 legislation tests passed, 117 conditional tests skipped, four receiver tests passed.
- [x] Real network-disabled Docker smoke retained a failed attempt (`subprocess_failure`) and verified container
  removal. This is failure-path evidence, not a successful scrape or proof of the specific upstream failure cause.
- [ ] Fresh-source successful extraction, atomic local promotion, durable scheduling and production activation remain open.

Offline evidence: `artifacts/openstates-runtime/docker-adapter-acceptance/openstates/scrapers/`
`d43f853796ceeeb49205f7d144790647764ce105/nc/bills/`
`offline-2359a8aa-ba44-43b3-9ba2-dde46a9d9424/retained.json`.
Image: `sha256:e0b4253f1b25e515eefdf75d8a809b7d333399adc837390bfa49cac35f73bafc`.
Retained discovery feeds were used only as an offline fixture. No source freshness or canonical writes were claimed.

## Leased batch coordinator checkpoint (2026-09-15 03:51 UTC)

- [x] Added the bounded NC coordinator: validate the frozen plan and batch, claim session ownership, retain dispatch,
  invoke an approved extraction/archive adapter, verify and promote the archive, then release ownership.
- [x] Token-checked lease release expires rather than deletes the lease. It permits immediate next-attempt acquisition,
  rejects immediate renewal of the released token, and cannot release a newer worker's ownership.
- [x] The adapter receives the exact frozen bill IDs and a 1,500-second worker budget within the 1,800-second lease.
  It must stop the entire worker before settling. There is deliberately no timeout race that releases a running worker.
- [x] Duplicate delivery of an already-owned attempt cannot start extraction or release the original worker's lease.
- [x] Twenty-one focused tests passed, including nine isolated PostgreSQL receipt/ownership tests and coordinator tests
  for ordering, claim rejection, duplicate delivery, settled extraction failure, promotion rejection and foreign batches.
- [x] Final `pnpm verify` passed: 2,868 legislation tests passed, 117 conditional tests skipped, four receiver tests passed.
- [ ] Connect and exercise the actual bounded runtime adapter, then finish durable cycle scheduling and activation.

This is tested coordination code, not evidence of a live scrape, production promotion or completed state onboarding.
The runner adapter remains explicit and required; no default cloud runtime is silently activated.

## Bounded bill promotion wiring checkpoint (2026-09-15 03:44 UTC)

- [x] No competing local import/test jobs, PostgreSQL sessions or active Trigger runs at check-in.
- [x] Added `promoteArchivedScraperBillBatch`: reuse archived dispatch/plan/attempt validation and approved-build
  normalization, then call the existing atomic bill writer with ownership and an immutable promotion receipt.
- [x] The required lease is session-scoped (`ownership:nc-bills:2025`), with the dispatch run ID as token. It prevents
  different discovery cycles from independently promoting overlapping session batches. The executor must claim it
  before extraction; the promotion helper never acquires or extends a lease on behalf of late output.
- [x] Receipt retains archive/build/dispatch evidence and unresolved sponsor/vote counts. Canonical resolved links
  are preserved. A successful batch explicitly does not establish session completion.
- [x] Fourteen focused tests passed: six archive/normalization/wiring tests and eight real PostgreSQL receipt/ownership
  tests covering atomicity and retries. Expired dispatches never reach the writer; persistence failures propagate.
- [ ] End-to-end leased extraction, durable cycle scheduling, live batch promotion and runtime activation remain open.

No scraper or hosted job was launched, and no live archive was relabeled as fresh. The old retained dispatches remain
expired. Production and full-session completion are not implied by isolated wiring and database tests.

## Observation ordering checkpoint (2026-09-15 03:25 UTC)

- [x] No competing local import/test jobs, PostgreSQL sessions or active Trigger runs at check-in.
- [x] Live `git ls-remote` confirms Open States people HEAD remains the pinned
  `677c6d0a566ad9bd62b6324e502af76acc3d22f3`; there is no newer revision to resolve the source gaps in this check-in.
- [x] Shared writer now takes a transaction-scoped lock for each source/checkpoint stream, validates observation
  metadata and rejects older retrieval times or a different revision at the same timestamp before entity writes.
  Both people and committee repository imports enable this guard. Unknown/malformed ordering metadata fails closed.
- [x] Thirty-two focused tests passed, including 24 real PostgreSQL tests. Ordering cases cover concurrent same-snapshot
  replay, older rejection, same-time revision conflict, malformed timestamps and advancing to a newer observation.
- [x] Full `pnpm verify` passed: 2,862 legislation tests passed, 113 conditional tests skipped, four receiver tests passed.
- [x] Restored NC and AK from retained archives after the isolated test suite reset its database; both committee replays
  preserve canonical identities and tenure numbers. No production writes.
- [ ] Source completeness, hosted authentication, runtime promotion and recurring activation remain open.

This guard orders retrieval observations, not real-world membership dates or Git commit ancestry. It complements the
ended-tenure and partial-roster safeguards; it does not make a newly fetched old revision authoritative or close source
coverage gaps. Checkpoint locking is transactional and uses the existing statement/lock timeouts.

## Committee homepage retention checkpoint (2026-09-15 03:06 UTC)

- [x] No overlapping local import/test jobs, PostgreSQL sessions or active Trigger runs at check-in.
- [x] Fixed source-field loss: explicit `links` entries labeled `homepage` now populate canonical `websiteUrl` through
  the shared normalizer. Only a single unambiguous HTTPS homepage without credentials is accepted.
- [x] Malformed links, invalid links, credential-bearing homepages and competing homepages produce inventory issues;
  optional link defects do not discard valid committee membership observations. Raw archived evidence is unchanged.
- [x] Twelve focused history/import/dependency tests passed, including unknown/unsafe/ambiguous homepage handling.
- [x] Final `pnpm verify` passed: 2,862 legislation tests passed, 111 conditional tests skipped and four receiver tests passed.
- [x] Replayed both states locally: stable memberships/tenures; 73 of 94 NC committees and 18 of 20 eligible Alaska
  committees retain homepages. Zero imported committees were marked detail- or roster-complete.
- [ ] Completeness reconciliation, successful committee details, hosted authentication and activation remain open.

Repository source provenance remains the pinned raw YAML URL; a homepage is a separate source-supplied field, not a
claim that its current contents were scraped or independently verified. No production writes or additional providers.

## North Carolina shared replay checkpoint (2026-09-15 02:47 UTC)

- [x] No overlapping local import/test jobs, PostgreSQL sessions or queued/executing Trigger runs at check-in.
- [x] Reused retained current/history sources with checksum-verified local archive manifests; no new upstream scrape.
- [x] Shared importer applied 506 people, 581 terms, 94 committees and 1,678 membership observations locally.
  All committees passed person dependency checks; the second committee replay preserved canonical IDs and tenures.
- [x] People HTTP smoke passed six collection pages, 506 details and 581 terms.
- [x] Committee HTTP pagination passed all 1,678 memberships; local MCP passed 168 distinct person lookups and
  94 typed incomplete-detail errors. No state-specific ingestion branch or person correction was added.
- [x] Final `pnpm verify` passed: 2,861 legislation tests passed, 109 conditional tests skipped, four receiver tests passed.
- [ ] Current source still lacks upper district 1. All committee details remain incomplete; historical completeness,
  hosted authentication, successful complete committee details and production activation remain open.

Current manifest: `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/entities/1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42/complete.json`.
History manifest: `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5/complete.json`.
Both now also reside under local `artifacts/openstates-archives`. The broader history lane includes executive and
municipal files containing prior legislative service; this explains the increase over the older retired-only counts.
Alaska rows were preserved. No production data, cloud configuration, credentials or source files were changed.

## Local MCP checkpoint (2026-09-15 02:26 UTC)

- [x] No overlapping local import/test processes, PostgreSQL sessions or queued/executing Trigger runs at check-in.
- [x] Extended the existing committee smoke command instead of adding a separate ingestion or API implementation.
- [x] Real MCP SDK discovery and 54 distinct `get_person` calls passed through the canonical HTTP adapter against
  the local Alaska database, preserving canonical person IDs.
- [x] All 20 `get_organization` calls preserved typed `unprocessable` errors for incomplete committee details.
- [x] Membership HTTP pagination and warnings still passed for all 136 membership observations.
- [x] Full `pnpm verify` passed: 2,860 legislation tests passed, 109 conditional tests skipped and four receiver tests
  passed. The preceding regulations lint blocker is cleared.
- [ ] Successful complete committee detail responses, hosted authentication and production activation remain open.

The MCP protocol transport was in-process; HTTP requests and PostgreSQL reads were real and local. The temporary
acceptance harness was removed after verifying SDK, tool, and HTTP-adapter integration. This did not verify the hosted
WorkOS sign-in flow.

## Committee HTTP checkpoint (2026-09-15 02:07 UTC)

- [x] No competing local import/test jobs, PostgreSQL sessions or queued/executing Trigger runs at check-in.
- [x] Local HTTP acceptance checked all 20 Alaska committees and 136 membership observations, with two-row pages,
  exact canonical person/organization/membership mapping, no duplicates or omissions, and unchanged effective dates.
- [x] Incomplete roster warning now accompanies both historical and current-only membership pages, for any source.
  Current-only queries continue to omit irrelevant GovInfo historical warnings, but no longer hide roster warnings.
- [x] All 20 incomplete detail profiles correctly return 422. This validates the guard, not successful detail coverage.
- [x] Nine focused repository/route tests and real local HTTP smoke passed.
- [ ] Full verification: `pnpm verify` stopped on an unrelated nested-ternary lint error in concurrent
  `src/ingestion/regulations/fr-pdf-boundaries.ts` work. No regulatory files were changed to bypass this check.
- [ ] Source completeness reconciliation, successful committee details, MCP acceptance and production activation remain open.

The removed local-only harness required a nonempty dataset, checked membership pagination and current-only warnings,
and rejected misleading successful detail responses for incomplete rows. Fluent Agent MCP was unavailable; the new API
warning was not Fluent-validated.

## Committee archive replay checkpoint (2026-09-15 01:45 UTC)

- [x] No competing local import/test processes, PostgreSQL sessions or queued/executing Trigger runs at check-in.
- [x] Shared NC/AK committee importer reuses canonical normalization and whole-roster dependency holds. It writes
  no embedded people or terms, infers no membership dates, and marks detail/child/membership completeness false.
- [x] Retained Alaska archives replayed in local `legislation_test`: 164 people, 271 terms, 20 committees and 136
  membership observations. Second committee replay preserved every membership ID, person/organization link and tenure.
- [x] Thirteen held committees and 97 membership assertions omitted; atomic checkpoint explicitly remains incomplete.
- [x] Post-import people HTTP smoke passed two collection pages, all 164 person details and 271 terms.
- [x] Final `pnpm verify` passed: 2,844 legislation tests passed, 109 conditional tests skipped, four receiver tests passed.
- [ ] Committee HTTP/MCP acceptance, completeness reconciliation, production promotion and activation remain open.

The organization detail reader requires source-complete profiles, child relationships and memberships. Observation-only
rows intentionally do not satisfy those gates; importing them is not equivalent to enabling complete committee detail.

The temporary local persistence harness verified both archive manifests, imported people before committees, and
asserted stable committee replay against `legislation_test`. It was removed after the 23-test transaction suite covered
the rollback safeguards. This was not a production deployment.

## Committee observation writer checkpoint (2026-09-15)

- [x] Shared `organizationObservationOnly` database mode preserves omitted organizations and memberships, including
  provider-scoped partial imports. It rejects complete-roster claims and departure assertions.
- [x] Observations cannot reopen ended membership history or manufacture a return tenure. Existing authoritative
  roster import behavior is unchanged.
- [x] Five tenure unit tests and 23 isolated PostgreSQL tests passed, including atomic rollback of organization changes
  and checkpoint writes when an ended-history conflict is encountered.
- [x] Final `pnpm verify` passed: 2,833 legislation tests passed, 109 conditional tests skipped, and four webhook
  receiver tests passed. The PostgreSQL suite was run separately with the local test database enabled.
- [ ] Connect the eligible committee plan to normalization and this writer; then replay Alaska and test API/MCP reads.
- [ ] Production promotion and recurring activation remain uncompleted. No production writes were made for this step.

The database mode is a safeguard, not a claim that committee promotion has been completed. Observational input must
use incomplete membership relations and omit held rosters entirely. It is not sufficient evidence for departures.

Approved scope: 50 states, District of Columbia and Puerto Rico (52). Inventory source: scraper revision
`d43f853796ceeeb49205f7d144790647764ce105`. Authentication and MySQL jurisdictions are last.
The pinned archive also contains Guam, Northern Mariana Islands and U.S. Virgin Islands modules. These are additional
capability-assessment candidates, not silently counted as approved or working deployments.

NC and Alaska remain incomplete end-to-end onboarding work. Finish their required content/search acceptance before
starting Alabama or another state. An external blocker is recorded, not permission to bypass this priority; continue
dependency-ready work within the approved scope. Local record-promotion completion is not full onboarding.
There is no fixed seven-day wait. Monitoring continues after activation.

Each row closes only after source/credential review, current and historical coverage inventory, checksum-verified replay,
stable canonical mapping, atomic import/checkpoint, retry/timeout/non-overlap tests, API/MCP acceptance and approved
recurring activation. Document unsupported lanes and unavailable historical data explicitly. Reuse common download,
archive, ownership, promotion and recovery code. State adapters own only source-specific parsing, discovery, identifiers
and configuration. No name-only identity guesses or partial-snapshot departures.

| Done | Order | Jurisdiction | Status | Runtime review |
| --- | --- | --- | --- | --- |
| [ ] | 1 | North Carolina (NC) | Partial pilot | Standard candidate; review before execution |
| [ ] | 2 | Alaska (AK) | Frozen local bill import complete; content/search, full voter/event/identity coverage and hosted acceptance remain open | Bills need no credentials; events still under review |
| [ ] | 3 | Alabama (AL) | Queued | Standard candidate; review before execution |
| [ ] | 4 | Arizona (AZ) | Queued | Standard candidate; review before execution |
| [ ] | 5 | Arkansas (AR) | Queued | Standard candidate; review before execution |
| [ ] | 6 | Colorado (CO) | Queued | Standard candidate; review before execution |
| [ ] | 7 | Connecticut (CT) | Queued | Standard candidate; review before execution |
| [ ] | 8 | Delaware (DE) | Queued | Standard candidate; review before execution |
| [ ] | 9 | Florida (FL) | Queued | Standard candidate; review before execution |
| [ ] | 10 | Georgia (GA) | Queued | Standard candidate; review before execution |
| [ ] | 11 | Hawaii (HI) | Queued | Standard candidate; review before execution |
| [ ] | 12 | Idaho (ID) | Queued | Standard candidate; review before execution |
| [ ] | 13 | Illinois (IL) | Queued | Standard candidate; review before execution |
| [ ] | 14 | Iowa (IA) | Queued | Standard candidate; review before execution |
| [ ] | 15 | Kansas (KS) | Queued | Standard candidate; review before execution |
| [ ] | 16 | Kentucky (KY) | Queued | Standard candidate; review before execution |
| [ ] | 17 | Louisiana (LA) | Queued | Standard candidate; review before execution |
| [ ] | 18 | Maine (ME) | Queued | Standard candidate; review before execution |
| [ ] | 19 | Maryland (MD) | Queued | Standard candidate; review before execution |
| [ ] | 20 | Massachusetts (MA) | Queued | Standard candidate; review before execution |
| [ ] | 21 | Michigan (MI) | Queued | Standard candidate; review before execution |
| [ ] | 22 | Minnesota (MN) | Queued | Standard candidate; review before execution |
| [ ] | 23 | Mississippi (MS) | Queued | Standard candidate; review before execution |
| [ ] | 24 | Missouri (MO) | Queued | Standard candidate; review before execution |
| [ ] | 25 | Montana (MT) | Queued | Standard candidate; review before execution |
| [ ] | 26 | Nebraska (NE) | Queued | Standard candidate; review before execution |
| [ ] | 27 | Nevada (NV) | Queued | Standard candidate; review before execution |
| [ ] | 28 | New Hampshire (NH) | Queued | Standard candidate; review before execution |
| [ ] | 29 | New Jersey (NJ) | Queued | Standard candidate; review before execution |
| [ ] | 30 | New Mexico (NM) | Queued | Standard candidate; review before execution |
| [ ] | 31 | North Dakota (ND) | Queued | Standard candidate; review before execution |
| [ ] | 32 | Ohio (OH) | Queued | Standard candidate; review before execution |
| [ ] | 33 | Oklahoma (OK) | Queued | Standard candidate; review before execution |
| [ ] | 34 | Oregon (OR) | Queued | Standard candidate; review before execution |
| [ ] | 35 | Pennsylvania (PA) | Queued | Standard candidate; review before execution |
| [ ] | 36 | Puerto Rico (PR) | Queued | Standard candidate; review before execution |
| [ ] | 37 | Rhode Island (RI) | Queued | Standard candidate; review before execution |
| [ ] | 38 | South Carolina (SC) | Queued | Standard candidate; review before execution |
| [ ] | 39 | South Dakota (SD) | Queued | Standard candidate; review before execution |
| [ ] | 40 | Tennessee (TN) | Queued | Standard candidate; review before execution |
| [ ] | 41 | Texas (TX) | Queued | Standard candidate; review before execution |
| [ ] | 42 | Utah (UT) | Queued | Standard candidate; review before execution |
| [ ] | 43 | Vermont (VT) | Queued | Standard candidate; review before execution |
| [ ] | 44 | Washington (WA) | Queued | Standard candidate; review before execution |
| [ ] | 45 | West Virginia (WV) | Queued | Standard candidate; review before execution |
| [ ] | 46 | Wisconsin (WI) | Queued | Standard candidate; review before execution |
| [ ] | 47 | Wyoming (WY) | Queued | Standard candidate; review before execution |
| [ ] | 48 | District of Columbia (DC) | Queued | API credential |
| [ ] | 49 | Indiana (IN) | Queued | API credential and User-Agent |
| [ ] | 50 | New York (NY) | Queued | API credential |
| [ ] | 51 | Virginia (VA) | Queued | FTP credentials and transport review |
| [ ] | 52 | California (CA) | Queued | Dedicated MySQL dump/runtime |

## Result history

- 2026-09-15: Full `pnpm verify` passed after committee dependency planning: 2,827 legislation tests passed,
  108 conditional tests skipped, four webhook receiver tests passed. No production or committee database writes.

- 2026-09-15 00:59 UTC check-in: no matching local work, competing local database session, or queued/executing Trigger
  run found. Added shared committee dependency planning, separate from people import. Entire rosters are held when any
  member is unaccepted; missing parents, parent cycles and parent holds are checked without depending on input order.
  Eight focused tests passed. Alaska plan: 20 eligible committees/136 assertions; 13 held committees/97 assertions.
  The held rosters contain 17 unaccepted-person references. No canonical writes or inferred departures.
  The temporary planning harness was removed after retaining the reviewed plans.

- 2026-09-15: Full `pnpm verify` passed with isolated coverage output: 2,820 legislation tests passed, 108 conditional
  tests skipped, plus four webhook receiver tests passed. This clears the earlier repository verification blocker.

- 2026-09-15 00:38 UTC check-in: no matching local scraper/test process or competing local database session;
  configured Trigger project returned no queued/executing runs. Shared committee inventory now accepts NC/Alaska
  configuration and rejects cross-state paths/jurisdictions. Nine focused tests passed. Alaska retained archive:
  33 committees, 233 membership assertions, zero missing person IDs. This is not historical completeness, canonical
  membership promotion or evidence that quarantined people's memberships can be published. No production writes.
- Membership dependency check: 216 assertions reference accepted people; 17 assertions across 13 committees reference
  people not accepted by the history importer. Preserve these source assertions for review; do not silently drop them
  and publish the remaining committee roster as complete. Safe committee promotion remains open.

- 2026-09-14: Fixed the people-detail import gap: accepted profiles/jurisdictions are persisted and state-configured
  office titles are retained. Local HTTP smoke passed for both Alaska list pages, all 164 people and 271 terms.
  Twenty focused tests and 22 PostgreSQL integration tests passed. Four histories remain quarantined, no production
  writes. Committee, MCP and hosted acceptance remain open.

- 2026-09-14: Applied and replayed the retained Alaska archives in local `legislation_test`: 164 people, 271 stored
  terms, four quarantined histories, identical term IDs after replay and `partially_imported` on both runs. No production
  writes. All 22 PostgreSQL entity integration tests passed, covering NC and Alaska through the same parameterized test.

- 2026-09-14: NC and Alaska now share the persistence function and archive application command, with state-scoped
  checkpoints and strict archive-pair validation. Eighteen focused importer/quarantine/pairing tests passed.
  Production promotion, scraper activation and API/MCP acceptance are still pending.

- 2026-09-14: Removed draft person-specific overrides. Generic quarantine now prepares 164 people and 271 terms from
  the combined retained Alaska archives, holding four conflicting histories for review. Raw records are unchanged;
  no canonical production writes. This supersedes the whole-import source defect blocker below, not activation gates.
  See [partial people imports](openstates-people-quarantine.md).

- 2026-09-14: Full `pnpm verify` passed after shared historical inventory/term planning: 2,777 legislation tests passed,
  103 conditional tests skipped. No canonical data was imported.

- 2026-09-14: Reused state-configurable historical inventory and term planning, preserving NC behavior. Twenty-two
  focused tests passed. Alaska's 114 historical files contain 159 legislative roles across 108 people; 60 starts are
  unknown. This does not establish complete history. Retained run: `artifacts/openstates-history/1789429051544-a9db6c4e-0b82-4827-bc54-20457c18d545`.
- Alaska historical promotion is blocked by a reversed Shelley Hughes source period (start 2023-01-17, end 2017-01-21).
  Her retained record also needs broader review: the official [legislative service record](https://www.akleg.gov/basis/Member/Detail/28?code=HUS)
  reports resignation November 14, 2025, conflicting with the retained January 24, 2026 end date.
  The [2017–2018 directory](https://akleg.gov/docs/pdf/Directory/Pocket-Directory-5-15-18.pdf) reports House appointment
  in April 2012 and Senate election in 2016; do not simply swap the reversed dates or accept the retained 2011 House start.
  Raw evidence stays unchanged; no corrective dates or production writes were applied.
- Alaska's current 95-object archive was uploaded to the existing Azure `state-sources` container and replayed with
  valid checksums, zero coverage issues and no canonical writes.
- Alaska's historical archive was also uploaded and remotely replayed: 116 objects (114 source files plus report/tree)
  under `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/ak/history/1789429051544-a9db6c4e-0b82-4827-bc54-20457c18d545/complete.json`.
  Replay reproduced the source defect and retained `needs_review`; archive success does not authorize promotion.

- 2026-09-14: Full `pnpm verify` passed after the shared archive changes: 2,776 legislation tests passed, 103 conditional tests skipped.

- 2026-09-14: Alaska advanced through shared immutable archive publication and checksum-verified replay: 95 archived
  objects (93 source files plus report/tree), validated replay, no canonical writes. Eight archive tests passed,
  including Alaska replay, idempotency and cross-state rejection. Historical normalization, remote archive storage,
  canonical promotion, scraper runtime and API/MCP acceptance remain open.

- 2026-09-14: Created all 52 tasks. None is fully onboarded. Alaska's pinned snapshot validated 60 legislators,
  33 committees and 233 memberships using the shared NC/AK downloader and validator.
- Credential classifications come from the reviewed deployment plan and must be refreshed against each pinned
  implementation before execution. Standard candidate does not guarantee every lane is credential-free.

Detailed acceptance evidence: [rollout checklist](openstates-rollout-checklist.md).
