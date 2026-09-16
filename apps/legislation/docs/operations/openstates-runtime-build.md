# Open States extraction build

Build preparation is separate from runtime execution. The scheduled task must never download a mutable source ref,
resolve fresh dependency versions, or run the upstream database importer.

This guide retains incremental build/recovery evidence. Later sections can describe prerequisites that were open at
that slice, not today's task queue. Use the [onboarding queue](openstates-jurisdiction-onboarding.md) for recorded local
promotion and the [rollout gate](openstates-rollout-checklist.md) for current content/search and activation requirements.

## Alaska bounded extraction acceptance

Journal voter extraction is now included in newly prepared builds. `python/alaska_journal.py` is copied into the
digest-verified source bundle by the shared preparation policy and covered by its file manifest. It requires a
unique bill/tally match, exact counts for each named option and no duplicate voters. Missing, ambiguous or partial
journal data rejects extraction rather than publishing a misleading complete roll call. Names remain source-only
until independently resolved; motion outcomes and dates retain the existing conservative normalization rules.
The local `legislation-openstates-journal:local` image passed startup verification and an actual patched-method
replay of the live HB1 House journal (May 7, 2026, page 2441): 40 yes positions matched the source tally.
This is one-roll-call acceptance, not full-session voter backfill or production activation. Existing frozen cycles
and running document workers were not switched to the new image. Rebuild source inputs rather than rewriting their manifests.

The shared Python runner now uses explicit NC/AK profiles. Alaska accepts Legislature `34`, one chamber and 1–10
explicit bill identifiers. Alaska events accept a separate bounded local lane: session `34`, null `bill_ids`, and
1–10 explicit `event_keys` in publisher `chamber:sponsor:timestamp` form. TLS verification, exact occurrence URLs,
publisher timestamps and unmodified location text are enforced. Conflicting source variants are retained in
`meeting_partition.json` and excluded, not resolved by choosing a winner. This is not hosted activation.
The source policy validates all selected bill IDs before yielding, rejects missing/duplicate
selected rows, and reduces Alaska's source timeout from 600 to 60 seconds. No new package or credential is required.

For an archived Alaska event batch, run
`pnpm tool openstates/import-alaska-event-batch <archive-directory> <manifest-path> <approved-build-sha256>`.
The default validates without writing. `--apply-local` writes only to the isolated localhost test database on port
55432 through the shared transactional event writer. It verifies archived hashes, the approved build, exact selected
occurrences, the quarantine report and matching official URLs before admission. Every batch remains a partial
snapshot; it cannot establish deletions, reschedule continuity, full-session coverage or organization relationships.

Local event admission now commits a manifest-hashed receipt with the rows. Identical committed receipts skip writes;
conflicting receipts fail. Bill and event admission share the receipt lock/check implementation. The event writer also
accepts the existing ownership fence for coordinated workers. Integration tests verify replay, conflict rejection and
transactional rollback against the isolated database.
It retains a small acceptance receipt; it does not reset the database or write production. The full batch dispatcher
and ownership lifecycle require hosted activation evidence before this is hosted orchestration.

For local planned execution, `tools/openstates/run-alaska-event-plan.ts` takes retained XML, frozen plan, archive directory,
immutable image digest, approved build digest and a batch limit (default one). It reconstructs the plan for verification,
claims existing database ownership with confirmed-release semantics, retains dispatch and extraction evidence, checks
exact selected occurrences, and atomically promotes rows plus receipt. It shares the bounded Docker boundary with
bill extraction. Resume skips compatible committed receipts. Unknown worker shutdown keeps the ownership hold;
never clear it without runtime evidence. The first ten-event batch passed locally; the remaining inventory is not
complete merely because the controller is running. This sequential local controller does not activate Trigger or Azure.

When fixing forward within a retained inventory, the build argument may be a comma-separated explicit approval list:
the first digest is required for new extractions; subsequent digests allow already committed receipts to be skipped.
It does not approve arbitrary old builds or promote failed partial output. A reproduced Energy batch failure showed
that an empty publisher location violates upstream `location.name` validation. Newly prepared sources omit that optional
name for empty locations instead of inventing a venue. The occurrence remains admitted with an unknown location.

Alaska agenda normalization retains only explicit scraper bill references whose encoded identifier agrees with the
source label. The shared event writer resolves these using jurisdiction, session and whitespace-normalized bill
identifier, accepting a unique match only. It does not parse agenda prose, guess from titles or declare all relationships
complete. Existing running controllers keep their loaded code; already imported batches require verified archive
reconciliation after extraction, rather than silently treating earlier receipts as proof of relationship enrichment.

Committee repository normalization now preserves session/code identifiers from exact official Alaska committee URLs
in addition to the explicit homepage. It rejects wrong hosts, credentials, malformed codes and chamber mismatches.
The event writer can resolve one organization bearing the exact jurisdiction/session/code identifier; zero or multiple
matches remain unresolved. This requires replaying verified committee evidence before event reconciliation. Seventeen
focused committee tests passed locally; deployed data and meeting-detail completeness are not established by those tests.

Verified committee observations were replayed without migration or people writes. Local acceptance retained all 20
eligible Legislature 34 committee identifiers and linked House Finance by its official code. Held observations remain
held; this does not establish full event or committee profile coverage.

`python python/plan_alaska_events.py <retained-meetings.xml> <new-plan.json>` freezes a source-hashed inventory into
at most ten occurrences per batch. The output is created exclusively, never overwritten on resume. The shared
partitioner excludes conflicts and collapses identical duplicates; an empty or error response fails closed.
The September 16 discovery yielded 2,846 admitted occurrences in 285 batches and two quarantined keys. This is a
plan, not evidence those batches have run. Publisher sponsor codes include `L&C`: validators preserve the ampersand,
and newly prepared scraper URLs percent-encode it so it does not split the `Meeting` query parameter.

`prepare_openstates.py --archive <retained-upstream.tar.gz> <new-input-directory>` reconstructs inputs offline after
checking the original digest. The adapter Dockerfile now copies explicitly prepared source inputs as well as runner
code, defaulting to `artifacts/openstates-runtime/state-batch-build-inputs`. Existing running images are not replaced.

The shared archive writer accepts NC/AK paths but rejects mixed-state inventories and mismatched manifest paths.
Read-only normalization is covered by the archive and normalization test suites. Alaska journal dates retain day precision in raw evidence; they do not become
invented canonical timestamps. Canonical promotion still requires dispatch, frozen inventory and ownership wiring.

Live HB1/HB2 extraction succeeded and eight files were locally retained/replayed. Normalization preserves distinct
chamber-qualified sponsor observations using stable, sorted selector fields. Name-only observations retain their
name/classification key; resolved person IDs enrich rather than rename them. Exact duplicate observations still
reject. The official HB1 page itself lists some names under both chambers: these are source claims, not verified
people. Both bills now pass read-only normalization. Shared local fan-out promotion now supports Alaska, with staged acceptance in progress.

The reviewed Legislature 34 plan retains the official range HTML and frozen bill inventory.
The common resume command reads the plan's jurisdiction/session, not a worker-supplied scope. New plans explicitly record
jurisdiction and bind inventory identities to scope. Start a fresh cycle for this contract; do not rewrite older immutable plans or receipts.
Alaska votes use journal URL, date and motion identity because one page may contain multiple votes. Tally corrections do not rename
the motion. The pinned scraper emits totals only: absent positions are withheld (not a removal snapshot), inferred passage labels
are withheld, and only explicit PASSED/FAILED/ADOPTED/NOT ADOPTED wording establishes an outcome. Other outcomes remain unknown.

For Alaska use four local workers for sustained acceptance. Two/four-worker stages passed; an eight-worker trial had
two source HTTP failures, both successfully retried at two workers. This supports reducing concurrency, not claiming
a proven rate-limit status. Runner diagnostics retain only safe HTTP failure categories (access denied, rate limited,
not found, server error or unclassified HTTP error), never response bodies or request URLs.

The current policy also retains NC calendar notice numbers as event `upstream_id` values and corrects the bill vote
clock parser to use a 12-hour clock with AM/PM. Missing or ambiguous meeting notices reject extraction. A title,
location, or time correction does not change notice identity. Old artifacts remain immutable; the new parser does
not retroactively validate their timestamps.

`src/ingestion/openstates/scraper-normalize.ts` is a staging mapper, not an import entry point. Bill identity uses
jurisdiction/session/printed identifier; roll calls require their official transcript URL; meeting identity uses the
official notice number. Raw UUIDs join files only within one attempt. Name-only voter references remain source-only
positions, not manufactured people. Bill action IDs survive insertion of a newer action. The ordinary raw mapper
withholds vote clocks. `normalizeArchivedScraperBills` accepts clocks only from a checksum-verified successful bounded
attempt whose `build_inputs_sha256` equals a separately supplied deployment-approved fingerprint. Never derive the
approved fingerprint from the incoming attempt. The runner reconstructs build inputs against the pinned archive and
exact source policy before extraction, then stamps their manifest fingerprint. Missing provenance is not clock
acceptance. Resolved relationships must still be reconciled before this staging output replaces canonical data.

`src/ingestion/openstates/scraper-batches.ts` freezes both chamber feeds, partitions explicit bill IDs into batches
of at most 10, and retains raw feeds plus a read-back-verified immutable plan. Each cycle has an explicit identity,
so a prior cycle's receipts cannot suppress a later refresh. Only canonical-promotion receipts count as complete;
extracted or failed batches remain pending. The planner is not yet a deployed Trigger coordinator or database receipt
writer. Raw storage, planning, canonical transactions and scheduled execution remain distinct gates.

`upsertBillAggregates` now accepts an optional immutable per-batch receipt. It serializes matching receipt keys with a
transaction advisory lock, rejects a conflicting committed cursor, and makes identical retries no-ops. Canonical writes
and receipt insertion share one transaction, with 60-second statement and 10-second lock limits. Use a distinct stream
per frozen batch, not a mutable session cursor. Isolated PostgreSQL tests cover concurrency, conflict rejection,
late child-write rollback, successful retry and empty-batch rejection. `scraper-promotion.ts` now connects verified
archives to this writer with resolved-link preservation and session ownership. No production writes were made.

`scraper-execution.ts` coordinates one batch through lease acquisition, immutable dispatch, an explicit extraction/archive
adapter, verified promotion and token-checked lease release. Duplicate delivery of an already-owned attempt cannot
launch a second worker. Release expires the matching lease without deleting it or affecting a newer owner. The adapter
must enforce the supplied 1,500-second worker limit and stop its entire worker before settling, including on failure;
the coordinator never races an unresolved worker against a timer and releases ownership early. PostgreSQL independently
rejects promotion after the 1,800-second lease expires. The local `scraper-docker.ts` adapter now implements this contract
with a pinned image ID, resource limits, a private staging mount, no credential injection, retained archives and explicit
container-removal confirmation. Unknown shutdown keeps the lease unreleased and requires inspection before retry;
expiry does not prove shutdown. Cloud execution and recurring deployment remain open.

Scraper ownership now persists `requiresConfirmedRelease: true` before execution. Expiry invalidates promotion but
does not authorize takeover while that record is unreleased, even if a future claimant requests ordinary expiry-only
ownership. Only a matching-token release after runtime shutdown verification marks it released and records the release
time. A crashed or unreachable worker therefore remains blocked after the deadline. Do not clear the hold solely
because it is old; an operator recovery path must inspect the runtime first. Other non-scraper lease callers can retain
expiry-only behavior, but cannot override an existing confirmation hold.

New local runtime containers are labeled `io.agency.openstates.run-id=<ownership-token>` for inspection. A recovery
command still needs to verify the associated runtime is stopped before invoking release; labeling is not proof of shutdown.
Recovery must also establish that the original executor cannot resume and launch work after inspection; container absence
alone is insufficient if an executor is paused before launch. Do not implement a blind expired-lease release command.

`pnpm tool openstates/recover-openstates-attempt <held-run-id>` now implements local recovery, restricted to `legislation_test` on
localhost/127.0.0.1. New local claims record host, executor PID and Docker daemon identity. Recovery refuses a live or
uninspectable PID, another host/daemon, missing provenance, any remaining run-labeled container, or a changed ownership
token. It does not stop processes/containers. Keep Docker configuration stable during execution and recovery.
The removed recovery harness used a short-lived child process to leave a deliberate local hold and verified recovery
after that process exited. Focused ownership tests retain this coverage.
Hosted Trigger recovery requires its own authoritative executor evidence; local PID checks are not sufficient there.

The Docker adapter compares the recorded daemon ID before launching extraction, before removing the worker and after
confirming absence. A pre-launch mismatch rejects without starting work; a mismatch or unavailable identity after
launch raises shutdown uncertainty and preserves the confirmation hold. Keep runtime configuration stable throughout
the operation. Offline dispatch smoke derives both window timestamps from one clock reading to preserve the exact
thirty-minute upper bound.

The completed Docker and first-batch harnesses verified offline container cleanup, local database guards, canonical
receipt identity, and stable replay. They were removed after acceptance; focused runtime and promotion tests retain the
same rejection boundaries.

For local acceptance only, `python/Dockerfile.adapter` can refresh runner code on an already verified dependency image
without downloading packages. Supply `VERIFIED_DEPENDENCY_IMAGE` explicitly, verify the resolved base digest in build
output, build with networking disabled, and record the resulting image ID. Its restricted build context contains only
the Python adapter files. The build runs installed-runtime acceptance. Production continues to use the full Dockerfile.
Matching source-input fingerprints alone does not prove that an old image contains the current runner: promotion also
requires the attempt's fingerprint, and missing stamps remain rejected rather than filled in after extraction.

`pnpm tool openstates/resume-openstates-cycle <sha256:image-id> <approved-build-sha256> <local-archive-directory> <plan-path> [max-batches] [admission-budget-seconds] [concurrency]`
uses the same local-only database guard. It defaults to one unfinished batch and a 3,600-second admission budget.
Explicit limits allow 1–235 batches with a budget of 1,800–86,400 seconds and 1–8 concurrent workers (default one). Each step uses the same resume
path and a fresh attempt identity; it never fetches a replacement inventory or activates a recurring schedule.
Before admitting another wave, the monotonic elapsed-time check reserves a full 1,800-second ownership window.
This is an admission budget, not a hard command timeout: an admitted step is awaited through worker shutdown and
promotion, never abandoned by an outer timer. A failed wave drains all already-started workers before returning its
error, and never admits a replacement wave. There is no automatic retry. Durable receipts
allow a later invocation to resume without repeating committed work. Progress emits after every committed step; final
output distinguishes cycle completion, batch-limit stop and time-budget stop. The executor rereads cycle receipts after
claiming batch ownership to reject stale selections before extraction. The resumer reloads durable state afterward;
a returned execution result without a committed receipt is not success. Source failures stop the invocation without
advancing to another batch. Full-cycle completion still does not establish identity or production readiness.

Ownership keys contain both frozen inventory and batch identifiers. A short transaction-level admission lock permits
distinct batches from the same verified inventory to extract concurrently. An unreleased session hold or another
inventory's hold blocks admission, including after expiry. A session-wide claimant also refuses unreleased child holds.
Same-batch ownership, immutable receipts and end-of-transaction expiry checks remain enforced. Shared jurisdiction/session
rows retain PostgreSQL transaction locking during promotion; extraction no longer holds a session-wide lease.
Recovery locates exactly one ownership record by run token before applying original-host/runtime and shutdown checks.
This supports batch holds without guessing their key, while retaining recovery of existing session holds.

Bulk writes now distinguish omitted child collections from explicit empty collections, consistently with single-bill
writes. Omitted actions, votes (including their positions), organization links and related-bill links are retained;
explicit arrays replace only that bill's supplied collection. The NC raw adapter omits organization and related-bill
collections because it does not resolve those references. A mixed-batch PostgreSQL test verifies preservation and
explicit removal independently. Nine focused mapping/transaction tests passed.

The bulk writer's `preserveResolvedLinks` option now retains existing organization links on matching action/vote IDs
when the incoming link is omitted, and retains a resolved voter only on the same vote/source-observation key with
unchanged source identity. It never looks up a new observation by name. Changed resolved voter evidence rejects the
transaction; explicit nulls remain explicit removals. Omitted position collections survive a vote refresh. Five local
PostgreSQL integration tests passed, including same-name non-matching observations and receipt rollback. This is an
opt-in primitive, not activation: sponsor reconciliation, the archive-to-promotion coordinator, runtime packaging and
production acceptance remain open. No production records or schedules changed.

Sponsor protection is now included in `preserveResolvedLinks`. Exact observation IDs must retain their bill, name,
classification and source URL; omitted person IDs inherit only that observation's existing resolution. A name-only
collection cannot replace differently identified resolved rows. New same-name observations stay unresolved, while an
explicit empty collection can remove the observations. The NC adapter keys sponsors independently of whether a person
ID has arrived and rejects duplicate name/classification observations before generic normalization can collapse them.
Six local PostgreSQL tests passed, including observation-bound retention and rejected replacement. This closes the
preservation primitive, not person coverage or end-to-end scraper promotion. Archive-to-import coordination and the
verified Trigger runtime still need integration and acceptance.

The retained SB 1092 canary replayed with one unresolved sponsor and 168 unresolved vote positions; none were guessed.
Full repository verification for this change passed lint/types but failed three five-second timeouts in the unrelated
`src/ingestion/regulations/parser-bridge.test.ts` suite (sharding, entity-expansion rejection and wrong-title rejection).
This run is not a clean full verification. Those tests and their timeouts were not modified by this work.

From `apps/legislation`, prepare a **new** output directory:

```powershell
python python/prepare_openstates.py artifacts/openstates-runtime/clock-corrected-build-inputs
```

The preparer checks the downloaded source archive against a fixed SHA-256 digest before extracting regular files.
It rejects links and path traversal, retains the complete upstream source archive and license, exports required main
packages from `poetry.lock` with version pins and distribution hashes, and writes `build-inputs.json` last.
It never overwrites an existing output directory. A failed preparation is not a deployable build.

Preparation applies reviewed exact-match source changes from `python/openstates_source_policy.py`: the NC events
scraper and shared HTML helpers require certificate verification, use 10-second connection and 60-second read
timeouts, and reject HTTP error responses. The insecure retry after a certificate failure is removed. Unexpected or
duplicate patch targets stop preparation. Original upstream bytes remain in the retained archive; generated source
hashes include the changes, and offline verification reapplies them. This is not proof that live upstream endpoints
will accept verified TLS or that a whole scrape will complete before the outer execution deadline.

Verify the prepared inputs offline before packaging:

```powershell
python python/prepare_openstates.py --verify artifacts/openstates-runtime/clock-corrected-build-inputs
```

Verification reconstructs the expected files from the retained archive after checking its pinned digest. It rejects
missing, additional, linked, or modified files, even if someone updated the candidate manifest to match the changes.
Generated files use UTF-8 and LF consistently so preparation on Windows and verification on Linux agree. This verifies
build inputs only; it does not verify installed Python packages or replace the later deployed-image startup checks.

The existing Windows machine-wide pip configuration selects the approved Microsoft Python feed. Docker does not
inherit it: explicitly pass the approved `PIP_INDEX_URL` to isolated package builds. Do not copy user credentials,
disable certificate verification, or silently fall back to a public registry. Source-only packages require a separately
pinned build toolchain; a successful metadata dry run is not a reproducible installed runtime.

Install the exported requirements using `pip install --require-hashes`; dependency resolution must succeed without
removing hashes, relaxing pins, bypassing TLS verification, or skipping dependency checks. Optional California
database dependencies are not enabled. Python runtime and system-library provenance, dependency installation,
jurisdiction startup checks, and request hardening remain separate deployment gates. The manifest deliberately records
`runtime_verified: false`: prepared source is not proof of a working image.

### Dependency metadata correction

The pinned `textract==1.6.5` wheel declares the invalid constraint `extract-msg (<=0.29.*)`; modern pip rejects it.
`python/prepare_openstates_dependencies.py` accepts only the original wheel's pinned SHA-256 and replaces that one
metadata declaration with `<=0.29`, exactly matching the retained upstream Poetry lock. It does not change executable
Python files, package versions, or license contents. It rebuilds the wheel RECORD, uses deterministic ZIP bytes and a
distinct wheel build tag, retains the original wheel, and records both hashes. Drift fails closed.

After downloading the original wheel through the approved feed, from `apps/legislation`:

```powershell
python python/prepare_openstates_dependencies.py artifacts/openstates-runtime/clock-corrected-build-inputs artifacts/openstates-runtime/textract-1.6.5-py3-none-any.whl artifacts/openstates-runtime/clock-corrected-dependency-inputs
python python/prepare_openstates_dependencies.py --verify artifacts/openstates-runtime/clock-corrected-build-inputs artifacts/openstates-runtime/clock-corrected-dependency-inputs
```

Install from the generated dependency directory: first `pip install --require-hashes -r bootstrap.txt`, then
`pip install --require-hashes --no-build-isolation -r requirements.txt`. The bootstrap pins setuptools from the same
upstream lock, avoiding unpinned build-isolation downloads for source-only packages. Finish with `pip check` and the
installed-runtime smoke test. A metadata repair is not a general dependency upgrade or a security audit.

The local acceptance Dockerfile is `python/Dockerfile`, with build context `apps/legislation`. It requires an explicitly
approved package index build argument and verifies both input bundles before installing. It is not a second production
orchestrator. Run its startup command with `--network none`; a live source canary is a separate acceptance gate.

Python 3.11 is the tested acceptance runtime. The pinned upstream `six==1.12.0` fails to import `six.moves` on Python
3.12 despite a successful dependency installation. The Dockerfile pins the Python 3.11 image by digest; do not replace
that gate with an unversioned Python installation. The deployed Trigger image must pass the same installed-runtime test.

The runner renames only upstream's known NC jurisdiction metadata filename to `jurisdiction_nc.json` before inventory,
because its colons are not portable to Windows. Payload bytes and source identifiers are unchanged. Existing-target
collisions, links, and other unsupported filenames are rejected. This prevents a successful Linux scrape from failing
the later TypeScript artifact handoff.

The executable NC pilot accepts only bill session `2025`. A live request to the `2025E1` filed-bill feed returned
1,092 Senate bills including July 2026 filings, so special-session routing is not accepted merely because its string
matches a session pattern. Historical rebuilding continues to use retained session archives. Additional runtime
sessions need explicit feed/session reconciliation before inclusion. Archived failed attempts remain readable.

Bill execution now also requires `bill_ids`: 1–10 unique identifiers such as `["S1091", "S1092"]`, from one chamber.
Events require `bill_ids: null`. Whole-session execution is rejected. The exact-match source policy checks that every
selected bill occurs exactly once in the feed before emitting bill data, then scrapes in numeric order. Missing or
duplicate selected source rows fail the attempt. New feed entries cannot shift an offset-based batch boundary.
The selected identifiers are retained with each attempt; retry the same identifiers, not an ordinal feed slice.
This bounds work per attempt but cannot guarantee source response time. The process deadline remains enforced.
Session-wide discovery, durable scheduling and the all-batches-complete checkpoint are still required before activation.
An extracted batch is never evidence that the whole session is complete.

The current Dockerfile defaults to `artifacts/openstates-runtime/clock-corrected-build-inputs` and
`artifacts/openstates-runtime/clock-corrected-dependency-inputs`. These are freshly generated from the retained, digest-verified
source archive using the current policy and dependency preparer. Earlier canary bundles remain unchanged evidence,
not current build inputs. Rebuild both bundles after a policy change; never edit their manifests to bless new bytes.

The runner writes `attempt.json` even if its subprocess cannot start. Exit-zero attempts with absent output, unexpected
files, links, or excessive output are rejected. Allowed `_data/nc/*.json` files receive byte counts and SHA-256 hashes.
The inventory is not semantic validation; `semantically_validated` remains false, and no canonical writes occur.
Timeout and nonzero-exit evidence is retained without forwarding raw child diagnostics into task logs. The final
uploader must verify these hashes again and archive failed attempts before cleanup. The runner's output limits are
64 MiB per file, 2 GiB total, and 100,000 files; these are rejection limits, not permission to promote partial output.

The orchestration handoff retains attempts through the shared archive writer using the existing `state-sources` Azure
container or an isolated local destination. It validates the runner result, lane/session contract, duplicate paths, size bounds, and all listed file
checksums before publishing `retained.json`. Uploads are create-only and read back for verification. Identical retries
are accepted; conflicts and corruption are rejected. Failed and timed-out attempts remain failures in the archive.
The local reader rejects linked paths, and machine-local work-directory values are removed from archived metadata.
Replay verifies the retained run identity and every listed checksum. This marker proves retention of the declared
inventory, not source completeness or semantic validation. It never advances a canonical checkpoint or deletes local
evidence; those steps remain the responsibility of the validated ingestion transaction and orchestration layer.

Subprocess stderr is drained concurrently into a bounded 64 KiB tail and then discarded. Only a fixed diagnostic
category is retained (timeout, TLS, HTTP, parse, validation, or generic subprocess failure); source bodies, exception
messages, URLs, and credentials are not copied into the attempt report. The category is diagnostic evidence, not
permission to promote partial output or a guarantee that retrying will succeed.

Run `pnpm test:openstates-runner` for build-input and runner tests. Real process-group and symlink tests require Linux;
the network-disabled Docker test uses fixtures, not live legislative sources. See the
[rollout checklist](openstates-rollout-checklist.md) for remaining activation gates and evidence.
