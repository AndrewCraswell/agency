# Open States rollout requirements and results

## September 16 continuation and identity verification

September 17 vote-date contract diagnosis:

- [x] Production HB1 contains two incomplete vote rows, House passage 40-0 and Senate passage 19-1. Both lack held-at, source URL, provider, retrieval date and source sequence; `timeline_complete` is false. This is not fixed by setting the completeness flag.
- [x] Checksum-verified original AK34 archive has the same two vote identities and tallies, dated May 7 and May 12, 2026. It contains empty individual-position arrays and no vote-source URLs. Replaying this archive alone cannot produce complete vote detail.
- [x] Fetched the official [House journal page 2441](https://www.akleg.gov/basis/Journal/Pages/34?Chamber=H&Bill=HB1&Page=02441) and [Senate journal page 2602](https://www.akleg.gov/basis/Journal/Pages/34?Chamber=S&Bill=HB1&Page=02602), both HTTP 200. House lists 40 named yeas; Senate lists 19 named yeas and Kiehl as the sole nay. Both state zero excused and absent. These pages substantiate the dates and outcomes, but do not supply an exact vote instant.
- [x] Identified a systemic contract mismatch: `normalizeBills` preserves Alaska's date-only source value, but `normalizeOpenStatesBill` accepts only timezone-qualified timestamps for `heldAt`. The canonical database completeness constraint and vote readers require non-null `heldAt`. Even a corrected Alaska scraper with journal provenance and positions therefore cannot close this gate under the current contract. Existing tests intentionally confirm no invented instant, but do not establish serving readiness.
- [ ] Next coherent implementation: retain a source calendar date separately from an optional exact instant across C schema, I normalization/persistence and W/API/MCP contracts. Preserve exact-time behavior for sources that provide it. Update completeness, ordering, cursors, date-range filtering and consumer validation together; test date-only, exact timestamp, missing date, mixed precision and boundary pagination. Do not represent an unknown time as midnight or bypass completeness.
- [ ] After that contract is deployed, replay verified scraper journal evidence through ordinary ingestion, preserve source-name positions without fabricated people, and verify HB1 vote/detail endpoints and NC exact-time regressions. Original archive vote records cannot substitute for journal-derived positions. This remains implementation work, not an achieved gate.

September 17 05:01Z action-provenance canary:

- [x] Bounded production audit before repair: AK34 has 21,465 actions, all missing source URLs across 857 bills. NC2025 has 19,976 actions, 19,930 missing across 2,337 bills. The previously reconciled NC S1041 has no missing action URLs. A broad cross-state join timed out; indexed 25-bill batches completed without changing timeouts.
- [x] Retrieved AK34's original retained archive and verified SHA256 `f2469b6e2039fd7a30bbd645b626a018adb33f1ba637e6bc0195643b915e166d`, 857 records, acquired August 17 07:41:51Z. Current shared normalization supplies all 65 HB1 action URLs; the persisted rows lacked them. Existing archive checkpoints skip completed input hashes unless explicitly forced, so document/OCR continuation does not repair these action records.
- [x] Added `tools/openstates/reconcile-action-provenance.ts`: explicit state/session/bill, archive stream and SHA256, dry-run default. Reads checksum-verified retained bytes and uses the shared normalizer. Requires complete timeline identity/count, ordinal, description, date and classifications to match; refuses conflicting non-null provenance. Apply locks the parent and actions and changes only missing source URLs in one transaction. It never rewrites documents, OCR, embeddings, people or votes.
- [x] HB1 production canary: all 65 action URLs filled from the exact retained archive; repeat dry-run reports zero missing. Nine focused safety tests, ingestion type-check and ingestion lint passed.
- [ ] Authenticated HB1 detail now advances past the action guard but still returns 422, `Vote canonical persistence is incomplete`, correlation `d24b9534-840a-4eb1-850b-cbd222ea73ef`. The endpoint is not yet working. Reconcile vote provenance/completeness from retained evidence before calling bill-detail acceptance complete; do not weaken the projection guard.
- [ ] Remaining action repair needs bounded session orchestration and acceptance on both states, including changed-timeline quarantine. No broad archive replay or deployment occurred in this canary.
- [ ] `pnpm verify` fails on three unrelated curly-brace lint errors in web `ResearchActivity.tsx`; full verification is not green.

Example dry run from the ingestion app (add `--apply` only after reviewing the result):

```powershell
node --env-file=../legislation-web/.env --import tsx tools/openstates/reconcile-action-provenance.ts --state ak --session 34 --archive-stream ak-34 --archive-sha256 f2469b6e2039fd7a30bbd645b626a018adb33f1ba637e6bc0195643b915e166d --bill-id bill:ak:34:hb:1 --database-env DATABASE_URL
```

September 17 04:46Z authenticated retrieval diagnosis:

- [x] SB277 docid12203 reviewed source refresh completed: processed/OCR processed, 103,631 characters, source hash `ab0d701c2699eeae89fcd92d2dbb440ead1dc8f45f3926063272a6b0c4f98904` exactly matches reviewed publisher bytes. Downstream embedding/search refresh still needs specific acceptance.
- [x] The four recovered malformed-document audit gaps have all 37 sections present with matching hashes in the hosted passage-search copy.
- [ ] Authenticated machine API smoke using existing WorkOS smoke credentials: AK and NC lexical `education` searches return 503 (25.3s/15.8s); semantic/hybrid return 200 with empty data. Machine checks do not satisfy the separate MCP user-consent canary.
- [x] Confirmed deployed W service `786fbca7-8798-4357-9b45-f0ba092a9750`, deployment `d8e6266c-fb71-4f70-a5dd-6532ef9c4110` SUCCESS. It has no passage-search enablement/database variables; it uses canonical-database lexical search.
- [x] Dedicated search readiness at 04:45:41Z: backfill complete, pending zero, failed zero, index valid/ready. `cutoverApproved` remains false: corpus parity, full-corpus search, authenticated API/MCP and ingestion-overlap acceptance remain required.
- [x] Direct read-only dedicated-ranked-search canary including canonical hydration: AK returns two correctly scoped education passages in 5,972ms; NC returns two in 1,481ms. No production config changes made. This is bounded query evidence, not whole-corpus acceptance.
- [ ] Semantic diagnosis: production pgvector 0.8.6 plan traverses global HNSW index before jurisdiction filtering. Same education embedding returns zero AK candidates under defaults (295ms); transaction-local strict iterative scanning and scope-first exact distance scan both exceed 15s. Do not ship either timed-out experiment as a fix or rebuild the existing global indexes blindly.
- [ ] Additional API gate: known AK34 HB1 detail returns 422, `Bill action canonical provenance is not persisted`; bill list works. Reconcile persisted action provenance through shared ingestion rather than inventing evidence or hiding the projection error.

September 17 04:37Z validation and source-refresh correction:

- [x] All four stale malformed-document audit gaps completed OCR: HB261 8,216 characters; SB124 73,032; SB148 7,184; SB174 15,287. Their downstream retrieval acceptance remains to be verified.
- [x] NC2019 freshness: 2,109 bill / 31,146 section vectors. NC2017: 1,953 / 29,035. NC2017e1: 12 / 81; e2: 8 / 46; e3: 9 / 171. All zero missing/stale, read-only snapshots. Together with earlier snapshots, every inventoried NC session has now had a freshness check, not a completeness certification.
- [x] Reviewed-source refresh CLI added (`8aa7b93`); live validation exposed retained-blob reuse. Initial SB277 retry OCRed the older blob into 105,675 characters but did not replace its source bytes. That attempt is not source-refresh completion.
- [x] Fixed refresh to upload and checksum-verify the reviewed immutable blob, then atomically switch the pending record's blob pointer under the existing source/text/status guard (`9f2e329`, seven focused tests and ingestion type-check passed). Old blob and served text remain retained. Corrected SB277 refresh was successfully requeued against its revalidated text hash; await the reviewed source hash in completed production output.
- [ ] Full repository verification remains non-clean; do not substitute focused tests for that gate.

September 17 04:25Z continuation:

- [x] New-inventory first ten repairs: all ten processed/OCR processed with original raw hashes unchanged; all 63 resulting section IDs/hashes match the hosted search copy. Retrieval behavior is not implied by copy parity.
- [x] AK33 embedding freshness: 812 bill vectors and 60,938 section vectors, no missing/stale. NC2023: 2,005 and 28,235 respectively; NC2021: 2,095 and 27,096. Each is a read-only production snapshot, not archive-completeness evidence.
- [x] Audit now distinguishes existing incomplete extraction from absent source records (`c639db5`, nine tests). Four previously "missing" AK sources were existing unsupported documents with stale malformed-text failures, not absent records.
- [x] Extended guarded recovery to explicitly selected `malformed-document` classifications (`690ec9e`, eight tests). Ten freshly validated scanned PDFs requeued, including the four audit gaps; no failed validation or active record was reset.
- [ ] Recovery controller `run_06gar6ouqsedi08027r6qg3g01` executing on pinned `20260916.3`, after previous AK run completed and no AK lease remained. HB261 docid15388 already processed/OCR processed with 8,216 characters; the other three audited gaps remained pending at the check.
- [ ] SB277 docid12203 is a source-version mismatch: official fresh download SHA256 `ab0d701c2699eeae89fcd92d2dbb440ead1dc8f45f3926063272a6b0c4f98904` matches the local reference (10,245,823-byte PDF), while production stores `23150ccff9d5868b8be90c363114d69de60e9edb4f014c8ee9a3a1c5a37e1eca`. Requires reviewed source refresh, not same-source OCR repair. No production mutation for this case yet.
- [ ] Full verification continues to fail in unrelated web lint; ingestion focused tests/types and commit hooks passed. Neither onboarding is closed.

September 17 continuation after Docker recovery:

- [x] Local reference database restarted; all 2,302 Alaska OCR reference documents are present.
- [x] Fresh read-only Alaska 34 parity audit saved as `artifacts/openstates-runtime/production-ocr-audit/ak/3fea07281d148b05ce9e5c595c068e2da339f43b6d56559ad9e2731796d92433.json`: 1,384 identical text hashes, 913 differences, five unresolved source identities/hashes. Differences are not by themselves proof of inferior production text. No production writes from this audit.
- [x] Audit query now uses bounded indexed bill-ID batches after the broad document-prefix query hit its statement timeout. Eight focused tests, ingestion type-check and commit hooks passed; implementation committed as `2274ae4`.
- [x] OCR diagnostic change committed as `073f408`, with 15 client tests passing; not yet deployed.
- [x] Alaska session 31 production freshness at 04:16:19Z: 674 bill vectors and 29,345 section vectors current, zero missing/stale. Historical coverage and search acceptance remain separate gates.
- [ ] New inventory first ten candidates dispatched as `run_06gar51du3o05748j3vnpfet01`, pinned to `20260916.3`, after previous AK controller completed and no AK lease remained. Last observed executing; next new-inventory offset is 10, not the old inventory's offset 40.
- [ ] NC controller `run_06gar1fcalhl0b45fi1044d001` remains executing with an active NC session lease; not restarted.
- [ ] Repository verification is not clean: unrelated web `research.test.ts` conditional-expect lint and Storybook generated-worker unused-disable lint failed. Focused ingestion checks do not override this gate.

September 17 04:03:36Z production freshness audit: Alaska session 30 has all 649 bill vectors and 49,103 section
vectors matching current input hashes/contracts/dimensions, with zero missing or stale. Search and historical completeness
are still separate gates. Added reusable read-only `tools/openstates/audit-state-extraction-parity.ts` to regenerate
checksum-verified reference/target comparison evidence after lost local artifacts. It rejects empty scopes and excludes
ambiguous identity matches or changed/missing source hashes. The initially blocked live comparison was subsequently
completed after Docker recovery, as recorded above.

Live provider diagnosis of Alaska session-30 HB132 docid 12754: Azure returned `InvalidRequest` with a `details`
entry `UnsupportedContent`, stating that the image is corrupted or invalid. Dimensions are 961 by 1200; size 352,824 bytes.
The OCR client now retains bounded `details` entries as well as nested `innererror` codes/messages. Do not count this
document as usable or repeatedly retry identical bytes. Old retained Alaska audit inventories were not found after the
repository split; a fresh checksum-verified inventory has now been regenerated from the surviving reference database.

After the repository split, ingestion code and this ledger live in `apps/legislation-ingestion`. Refreshed Trigger
status confirms NC's 100 batches, Alaska session 30's 100 batches, and Alaska offset 30's ten batches all completed
their budgets, with zero complete scan rounds. The OCR client now preserves bounded nested provider error codes/messages
without recording full response bodies; 15 focused client tests pass. This diagnostic change remains undeployed.

- [x] Focused downloader/recovery verification: 44 tests across two files passed after typed unsupported-format errors.
- [x] Alaska audited inventory offsets 10 and 20: all twenty documents processed and OCR processed, original raw hashes unchanged. Combined with the initial canary, thirty audited repairs are processed; only the initial canary has separate search-copy acceptance so far.
- [ ] Offset 30 controller `run_06gamhq9l2c80eg5k3angkfm01` submitted after ten exact source guards passed; next inventory offset 40. Queue limits remain unchanged.
- [ ] Full verification still fails in unrelated Shopify email build/CLI tests and scoring observatory integration; focused success is not a repository-wide pass.

Historical session-30 controller `run_06gamgfpn0829kojiv62dms901` is processing 20 recovered pending documents.
The scanned PDF for HB268 remains correctly queued for OCR; no lost error category was found there. The downloader's
unsupported-binary rejection did use an untyped Error, unlike extraction. It now emits `DocumentExtractionError`
with `unsupported-format`, so callers can distinguish a known unsupported source from an operational failure.
Historical sessions 31/32 were also checked: binary Excel, Outlook, and an unrecognized ZIP remain unresolved, not requeued.

Historical production inventory confirms stored bills in Alaska sessions 30–34 and NC sessions 2017, 2017e1/e2/e3,
2019, 2021, 2023, 2025. This is presence evidence, not archive-count completeness. Session-30 recovery found valid
PDFs and scanned PNGs behind stale unsupported-format outcomes. The retry command now hashes raw bytes before
extraction and accepts the explicit `ocr-required` category for normal OCR handoff (without inventing extracted text).
Six safeguard tests pass, including OCR handoff. Existing Outlook and binary Word formats remain unresolved.

The supported-format recovery CLI now reports operational failures with nonzero exit status instead of labeling them
unsupported content. Five regression checks pass: dry-run no-write, guarded apply with full timestamp precision,
changed publisher bytes rejected, concurrent change rolled back, and unsupported content left untouched.
Alaska inventory offset 20 is running as `run_06gamer1icck540f98ik3fcr01` (next offset 30); NC's 100-batch run is
still executing. Neither running job was restarted. Full verification continues to be blocked by Shopify email tests.

Reusable `tools/openstates/retry-supported-documents.ts` now validates actual downloaded bytes with the shared
extractor before optionally requeuing unsupported-format records. It requires exact state/session/database selection,
is bounded to at most 100 candidates, preserves source-hash review when artifacts exist, and guards updates by
unchanged timestamp/source/error/status. Live Alaska 34 pass requeued 13 supported Office records and left all
11 MSG failures unresolved. This is queue recovery, not completed hosted extraction or MSG support.

Three additional Alaska current-session unsupported records are recoverable Office documents, not source limitations:
docids 15122 (Word, 1,494 extracted characters), 11634 (Excel, 45,513), and 14046 (PowerPoint, 2,561).
Fresh official downloads verified ZIP signatures and extraction with the shared detector; deployed candidate source
contains the same Office detection/extraction path. Their stale `ocx`/`lsx`/`ptx` failure records had no retained
blob/hash. Guarded transaction reset only those three exact ID/URL/error/status/null-artifact matches to pending,
so the ordinary hosted download/OCR/embedding path can retry. Hosted completion remains pending; no invented format aliases.

- [x] Production repeatable-read freshness: NC 2025, observed 17:09:32Z, all 2,338 bill and 36,187 section vectors current; zero missing/stale.
- [x] Production repeatable-read freshness: Alaska 34, observed 17:07:30Z, all 857 bill and 66,568 section vectors current; zero missing/stale.
- [x] Alaska first ten audited repairs: all documents processed/OCR processed with original raw hashes retained; all 136 resulting section hashes match hosted search, none missing.
- [ ] Alaska inventory offset 10: all ten target guards revalidated, next repair controller `run_06gamd449lr9unu23pridkpm01` submitted pinned to `20260916.3`; next inventory offset 20 of 952. No claim that the remaining 932 candidates are repaired.

Vector freshness covers canonical stored content, not missing documents or historical coverage. Search-copy hash equality
is not a substitute for lexical/semantic/hybrid retrieval acceptance. Those broader gates remain open.

Alaska canary `run_06gamb0lptqui2vjgfgvc0ei01` completed its ten batches; this is not yet downstream acceptance.
NC is continuing with a bounded 100-batch controller `run_06gambiu9spur3dr4d7l8jd001`, unchanged single-bill
concurrency and pinned deployment. Production current-session scope contains 2,338 NC bills and 857 Alaska bills.
The freshness audit now supports explicit `--database-env DATABASE_URL` selection, keeps its read-only transaction,
sets transaction-local timeouts compatible with PgBouncer, and checks sections in 25-bill scopes to avoid a global
embedding join. Initial whole-state production queries exceeded the 30-second deadline; optimized acceptance is pending.
Repository verification passed preliminary checks but stopped on unrelated Shopify email CLI five-second test timeouts.

Alaska's ten retained targets were revalidated against current production bill/URL/raw SHA/text hash/status.
NC hosted repair acceptance satisfied the recorded prerequisite. Content activation is now explicitly `nc,ak`,
read back from Trigger; no recurring schedule or deployment promotion was added. Initial Alaska run
`run_06gamam10n6dq5p2stc86tja01` failed before work at the activation guard because the installed SDK's
`envvars.update` helper threw locally. Activation was then updated using the supported import operation.
After confirming that terminal guard failure, submitted the same checksum-verified payload pinned to
`20260916.3` as `run_06gamb0lptqui2vjgfgvc0ei01`. Hosted results remain unverified.
The repair CLI now requires `--project` when applying and verifies hosted activation before submission.
NC continuation `run_06gam9ugthb2g7lalq5fascn01` completed all ten batches, without completing the full scan.
Full verification retry was blocked by an unrelated Shopify email temporary fixture reported by knip.

- [x] Reject changed bill/source/motion provenance even when an incoming vote reuses a persisted primary ID; seven focused identity tests passed.
- [x] Confirm previous NC controller completed and no active ingestion leases before resuming pinned deployment `20260916.3`.
- [ ] NC continuation `run_06gam9ugthb2g7lalq5fascn01`: bounded ten batches, eight bills per batch, one bill at a time. Latest pre-dispatch checkpoint was HB1078 with no pending embedding bills; full scan and search acceptance remain incomplete.
- [ ] Publish and verify the newer vote importer/persistence changes; these are still local.
- [ ] Full repository verification: earlier attempt hit a Windows mapped-file lock in regulations. Retry found task-scoped lint issues (corrected) plus a concurrently missing API file; a clean full run is still required.

Alaska hosted acceptance and broader historical/person-resolution gates remain open. These checks do not establish whole-state readiness.

## Hosted NC repair acceptance, September 16

SB1041 live vote-list acceptance now passes: HTTP 200, two votes, 323 ms. In a guarded transaction,
cleared only 168 confirmed name-only placeholder references (exact source identity/name and absent
person provenance). All 170 voter observations remain, with names/options/sequences intact; no people
were deleted. Person resolution is explicitly incomplete, not falsely claimed by synthetic references.
The general Open States normalizer now creates people only for actual provider identities and keeps
name-only observations unresolved; source identity, not an undefined person ID, controls deduplication.
All 32 focused normalizer/scraper tests pass. Combined main `pnpm verify` started with one worker,
log `%TEMP%/agency-nc-vote-contract-verify.log`. These importer/persistence fixes are not deployed.

Guarded production vote repair committed two audited SB1041 snapshots, preserving vote IDs and all
168 existing person references, adding two observations (170 total). Exact bill/motion/tallies and all
prior source identities/names were checked under row locks; only the verified abstain-to-not-voting
parser correction was allowed. Live bill detail now returns HTTP 200 (721 ms). Vote list still returns
422 `Vote position person canonical provenance is incomplete` (correlation `e391a574-7130-4314-9529-31d51cb6df6a`).
Inspection shows the old links point to `person:openstates-voter-name` name-only placeholders with
no source URL, not verified legislator identities. Preserving a reference did not validate its person.
Keep the observed voter names/options; reconcile or explicitly unresolve these placeholder links,
never fabricate person provenance merely to satisfy the endpoint.

All 32 focused TypeScript normalizer/scraper tests passed in current ingestion project. Existing
production voter observations match fresh extraction by exact source identity and name: 50/50 Senate,
118/118 House; all 168 have person links. House adds two source observations. Added shared persistence
identity reuse requiring the same bill, source URL AND source observation ID, with ambiguous matches
rejected; position keys follow the retained vote ID so resolved links survive. URL alone is deliberately
insufficient because Alaska journal pages contain multiple motions. New regression covers distinct
motion IDs on one source page. Full verification and guarded production reconciliation remain open.

Action-only candidate suite reported one failure: Next acceptance build exceeded its existing 600-second
deadline; 330 files/2854 tests passed, 386 tests skipped. Not a release pass. Current main Vitest config
was concurrently reorganized into projects after focused session `85222` started. Stopped only its
identified Vitest PID 20368 and direct workers and restarted the three normalizer suites explicitly in
the ingestion project, one worker, session `12848`. No unrelated processes stopped.
Current scraper vote identity already derives from the official transcript URL; keep it. Old production
votes have null source IDs, URLs, roll-call numbers and chambers, so provenance correction requires
explicit retained-evidence reconciliation rather than assuming current generated IDs already exist.

Fresh evidence archived through `archiveScraperAttempt` (seven files) under
`artifacts/openstates-runtime/nc-vote-repair-archive/openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/nc-vote-repair-20260916/retained.json`.
Shared main normalizer validates both vote rows as timeline-complete with 50/120 positions, exact
47/110 yes, 0/2 not-voting and 3/8 absent counts, source transcript URLs, and UTC instants
`2026-07-01T20:27:00Z` / `2026-06-30T22:52:00Z`. This is normalization evidence only: generated vote
IDs differ from old production rows, so persistence must reconcile identities and avoid duplicates.
Production votes remain unchanged. Archive/normalization session `15832` and raw export `46614`
finished successfully. Focused TypeScript test `85222` remains live without a final result.

Fresh S1041 extractor canary COMPLETED (session `96910`, exit zero), build-input digest
`8976b92870a73ae2448eef8d6468199c6ff39ad569ec2be4f546c111a5921073`, retained directory
`/prepared/staging/openstates-nc-ll9wvd1v`. Verified every retained file SHA against the attempt manifest.
Both vote rosters reconcile exactly: Senate 665 has 50 positions (47 yes, three absent), House 769
has 120 (110 yes, two not voting, eight absent). Fresh timestamps are explicitly Eastern:
`2026-07-01T16:27:00-04:00` and `2026-06-30T18:52:00-04:00`, matching official transcripts.
No production votes changed. Canonical normalization/persistence and API acceptance remain required.

Stopped only the identified outdated Windows preparation process (PID 54324/session 70170), because
its source policy predates the final selector. Regenerated from the pinned archive in local Docker
volume `legislation-nc-vote-repair-inputs`: 496 files, exit zero. Network-disabled runtime verification
passed for NC and Alaska with installed Open States 6.25.5. Started bounded S1041 extraction as session
`96910`, container `legislation-nc-vote-repair-canary`, with the final read-only adapter and regenerated
source inputs; timeout 1200 seconds. Output retained under `/prepared/staging` in that volume.
This uses the existing verified dependency image and does not publish an image or write canonical data.

Live vote-parser acceptance: broad class-token matching initially included nested container rows and
double-counted positions. Restricted the reviewed selector to innermost matching rows and added the
nested-wrapper regression. Against the official H/769 HTML, the corrected selection/parsing returns
exactly 120 names: 110 yes, two not voting, eight absent, including Cunningham and Majeed. All ten
Python policy tests pass inside the scraper image. This is live parser evidence, not a rebuilt-image
or production-ingestion pass. Preparation session `70170` began before the final selector correction;
its output must not be treated as current verified build input without regeneration/verification.

NC vote selector regressions now run against lxml inside the existing scraper image with networking
disabled: all ten Python source-policy tests pass. New coverage checks additional/reordered CSS class
tokens, rejects a similar class-name suffix, retains unaffiliated groups, and preserves Not Voting.
Fresh build-input preparation is running as local session `70170` using the pinned retained upstream
archive into `artifacts/openstates-runtime/nc-vote-repair-build-inputs`. Do not dispatch a new extractor
until this completes and the refreshed image passes validation. Main focused TypeScript session `85222`
and candidate action-only verification `75762` are still live; neither has a final result yet.

Official NC House roll-call 769 confirms the omitted voters are Cunningham and Majeed under Ayes
(Unaffiliated). The row uses `row ncga-row-no-gutters mt-2`; upstream matches the entire class string,
so this is a scraper omission, not unavailable data or a party-name whitelist. Source policy now matches
CSS class tokens and preserves Not Voting as `not voting` instead of `abstain`. Eight existing Python
policy tests passed; rebuilt-image and live extraction acceptance remain open. No runtime activation.
Official Senate roll-call 665 reports July 1 at 4:27 p.m.; the archive's explicit 13:27 -07:00 denotes
the same instant as 16:27 Eastern. Existing production 08:27Z is wrong, not the retained offset conversion.
Sources: https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/H/769 and
https://www.ncleg.gov/Legislation/Votes/RollCallVoteTranscript/2025/S/665.

Vote contract implementation in main (not yet in the isolated candidate or deployed): preserve all
reported vote-option count categories, normalize pass/fail results, persist provider/retrieval/source
sequence, require an explicit timestamp offset, and gate timeline completeness on exact aggregate-count
versus unique-position reconciliation. Four regressions cover complete data, mismatched counts, date-only
and offset-free timestamps. Focused test session `85222` is running. Formatting hit a Windows mapped-file
error and needs retry. Existing action-only full verification session `75762` remains running and cannot
certify these later vote changes.

Retained SB1041 House roll-call counts sum to 120 but its archive contains 118 voter positions; do not
mark this source snapshot complete. Its Senate vote has 50 reported/50 listed positions. Archived
timestamps also differ from the existing production timestamps and require source-level validation
before any vote repair. No vote rows or completeness flags have been changed in production.

Action provenance follow-up: production SB1041 actions were confirmed to have null `source_url`, while
the bill retains its official bill lookup URL. The shared Open States normalizer omitted the URL from
action rows; both single and bulk persistence preserve fields they receive. Added `sourceUrl: billSourceUrl`
to the shared mapping in main and the isolated candidate, plus a regression assertion. All 28 focused
normalizer/scraper tests passed. Full candidate verification is running in
`%TEMP%/agency-action-provenance-verify.log`; this fix is not deployed and existing production actions
have not been rewritten. Re-import from retained source evidence remains required.

Located SB1041 in retained NC batch `resume-deb47722-2c7a-4106-8d99-156671cbc986` under
`artifacts/openstates-runtime/local-batch-acceptance`. Its bill-file SHA matches the manifest:
`85a025acbba1ca8e5de9ecf412e574d7356bd265bf7d2b9214398855d07e700d`. Read-only comparison confirms
all 46 production action descriptions, dates, classifications and ordered positions match retained
source observations. The scraper adapter's current generated action IDs differ from production IDs;
do not blindly replace the aggregate merely to repair provenance. All 46 live source URLs remain null.
Full verification session `75762` is still running; no production provenance writes occurred.

Subsequent guarded provenance repair committed exactly 46 SB1041 action source URLs, preserving IDs
and all other fields. The transaction locked the bill/actions and required the manifest SHA, exact bill
scope/source URL, complete action count, ordinal, date, description, classification and empty-or-equal
existing provenance. Live timeline now returns HTTP 200 (226 ms). Bill detail progresses to a distinct
HTTP 422, `Vote canonical persistence is incomplete` (correlation `d28405b2-2967-44f6-b5c4-09df106f25d3`).
The Open States vote mapper does not populate the canonical timeline contract; investigate shared
date precision, result/count normalization and provenance rather than setting completeness flags blindly.

- [x] Memory-fix controller `run_06galu420i5ssvdugbokrknm01` on `20260916.3` completed all ten children without failures.
- [x] All ten audited documents are processed with processed OCR; exact source SHA hashes remain unchanged.
- [x] All 17 resulting document sections have current routed 1536-dimensional embeddings and matching content hashes in the hosted passage-search database.
- [x] Previously interrupted SB1041 recovered normally and produced 8323 characters from four pages; no manual claim reset or index rebuild was needed.
- [ ] Broader NC scan remains incomplete. Controller stopped truthfully at its continuation budget with SB257 still in its bill-level embedding queue, despite the audited document itself being fresh.

After confirming the prior controller completed and no active state-content lease existed, resumed
the saved checkpoint as `run_06galvrs1p40i2i9vdao863c01`, pinned to `20260916.3`: eight bills per
batch, one bill at a time, ten continuations. No repair payload replay, default promotion, or Alaska activation.
The successful ten-document canary is not full state-onboarding acceptance.

- [x] Obtained the existing WorkOS machine smoke token in memory and verified the live SB1041 document-list API returns HTTP 200 (170 ms).
- [ ] Live SB1041 bill detail returns HTTP 422: `Bill action canonical provenance is not persisted` (correlation `a73dafe1-d5ce-475d-98ed-18e0b170c4b4`). The current projection rejects a null action source URL. Reconcile against retained source evidence through the shared importer; do not weaken this assertion or invent action URLs.

The first smoke requests incorrectly used `/api/v1`; current routes use `/api`. Those route-not-found
responses were smoke invocation mistakes, not application defects. Positive machine API authentication
does not establish browser-consent MCP authentication.

## Repair release verification follow-up

Memory fix deployed unpromoted as `20260916.3`, deployment `923hjw4t`, 34 tasks, exit zero.
Submitted the same audited NC payload pinned to it as `run_06galu420i5ssvdugbokrknm01` with a
version/digest idempotency key. The main dispatch script was concurrently removed, so submission used
the installed SDK and the verified candidate's scope validator without restoring unrelated changes.
No default promotion or Alaska activation occurred. Hosted recovery and resulting freshness remain to verify.

Memory-fix serial full `pnpm verify` PASSED, exit zero: 331 legislation files and 3094 tests passed;
eight files and 146 tests skipped. All 240 standalone API acceptance tests passed and all nine coverage
tasks succeeded. Log `%TEMP%/agency-pdf-memory-repair-verify-serial.log`. Publishing the corrected
candidate with `--skip-promotion` has started; retain the default deployment until hosted acceptance.

At `2026-09-16T15:55Z`, production confirms the NC state-content lease is expired. SB1041 still has its
interrupted processing claim from `06:49Z`; the shared four-hour worker window plus margin has now
elapsed. Use normal interrupted-claim recovery after the corrected deployment; no manual reset was made.

Memory-fix full verification retry ended with one setup failure: Next compiled and type-checked but
exceeded its unchanged 600-second build deadline. There were 330 passing files and 2854 passing tests;
240 acceptance cases did not run, so this is not a release pass. The process is gone and verification
has restarted with one Vitest worker to reduce contention, without widening the deadline or skipping
acceptance. Log: `%TEMP%/agency-pdf-memory-repair-verify-serial.log`. Memory changes remain undeployed.

Exact-source memory smoke with the updated extractor: SB1041's retained 6,571,616-byte PDF was assessed
in 5665 ms and correctly returned `ocr-required` (three of four pages materially scanned). Peak process
RSS was 727,696 KiB (about 711 MiB) on local Node24. No provider calls or database writes occurred.
This is measured local evidence, not proof of the new hosted allocation; hosted retry remains required.

SB1041 memory evidence: retained source SHA `65a6a6ec14b2e47fe10ca66c2770fdd7baa488d4e7eb8d93bfc79ae34bb107e2`
is a 6,571,616-byte, four-page PDF. Poppler reports one roughly 5050-by-6500 RGB image per page at
600 DPI. Decoding all four images alone can require roughly 395 MB before parser/runtime overhead,
despite the small compressed file. Local OCR previously produced 8323 characters from those four pages.
This supports page-resource cleanup plus an OCR-capable worker allocation; it is not a page-count-limit failure.

Prepared (not dispatched) Alaska's first ten-target repair payload:
`artifacts/openstates-runtime/production-ocr-audit/ak/payloads/38a34c88dc3314b3ad9c373ec15105887390f2c7f332cf4f32de8e1d557197a6.json`.
Its retained inventory has 952 differences. A fresh read-only production check confirms all ten targets
still match the exact audited bill, URL, source hash, text hash and processed state. Alaska activation
remains off pending NC hosted acceptance; no production repair was submitted for Alaska.

NC recovery check after the crash: the state-content lease expires at `2026-09-16T07:49:01.336Z`.
SB1041 remains `processing`, last attempted `2026-09-16T06:49:02.450Z`. Shared document-claim recovery
also enforces the derived-worker duration plus safety margin; lease expiry alone is not permission to
force-reset that document. The memory-fix verification retry is live and has passed preliminary checks.

Memory follow-up: fourth child `run_06gahuehd0frrrq30cj66ikc01` CRASHED with
`TASK_PROCESS_OOM_KILLED` while SB1041 was processing. Controller `run_06gahu2v9i0o7a4ujcib9q1201`
is now FAILED, not running; no overlapping replacement was submitted. The shared state worker now
matches the dedicated OCR worker's `medium-1x` machine and `large-2x` out-of-memory retry policy.
PDF extraction also cleans up each page in a finally block rather than retaining decoded resources
until whole-document disposal. Thirty focused tests passed, including cleanup on success/failure.
The isolated candidate is running full verification again (`%TEMP%/agency-pdf-memory-repair-verify.log`).
These changes are not deployed yet. Resume only after verification and recovery/lease checks.
The first memory-fix verification stopped on mock typing and an unspecified rejection assertion in the
new regression test. Those test defects were corrected; both cleanup tests pass again. Full verification
has restarted with log `%TEMP%/agency-pdf-memory-repair-verify-retry.log`.

Hosted correction verified in execution: the first three `20260916.2` workers completed successfully.
Seven of ten audited documents are now OCR-processed. Their twelve sections all have matching hashes in
the actual hosted passage-search database; eleven have fresh routed embeddings. HB40's remaining
embedding is explicitly retained in `pendingEmbeddingBillIds` after a bounded 513-skip pass, not silently
marked complete. SB1041 is processing; SB257 and SB479 remain pending. The controller and fourth child
are still live. Initial apparent search gaps caught up through the existing replication path without a
manual copy or configuration change. Railway CLI access is healthy; the separate Railway MCP returned
Unauthorized, so it was not used to infer service failure.

Corrected hosted retry: `20260916.2` deployed unpromoted with 34 tasks (deployment `cdlvt1wv`, exit zero).
The same retained ten-target NC payload was dispatched pinned to that version as
`run_06gahu2v9i0o7a4ujcib9q1201`, using its version/digest idempotency key. The previous run was confirmed
FAILED and no `nc:2025` ingestion lease remained before submission. Retry completion and downstream
freshness are still pending; default production was not promoted and Alaska remains disabled.

Tokenizer correction: isolated candidate full `pnpm verify` exited zero. All nine coverage tasks
succeeded; legislation reported 330 passing files, 3092 passing tests, eight skipped files and 146
skipped tests. All 240 standalone route acceptance tests passed. Log:
`%TEMP%/agency-tokenizer-repair-verify.log`. Unpromoted publication of the corrected candidate has started;
no retry is submitted until its deployment version is confirmed.

Fresh read-only production audit: the two OCR-repaired documents contain four sections, with zero fresh
routed embeddings. The other eight targets remain pending and retain embeddings for their old text;
those are not evidence of completed OCR repair. All ten source hashes still match the retained audit.

Canary result: controller `run_06gahoq3pgdkm1jd3da5446801` FAILED after its worker retries. Two HB171
documents completed OCR with unchanged source hashes (7705 and 551 characters); eight audited targets
remain pending. Native ingestion-run diagnostics identify the embedding failure: external
`tiktoken/encoders/cl100k_base.json` lost its JSON import attribute in the hosted bundle. The loader now
uses Node's package JSON require path, retaining the vocabulary checksum and validating its shape.
Focused regression and a Node-targeted bundled smoke with external tiktoken passed. The corrected release
candidate is undergoing full verification; no repair retry has been submitted yet. Default version remains
unpromoted, and this partial OCR result is not downstream completion.
Read-only recovery check found no remaining `openstates-content` lease for `nc:2025` after failure.
The external-tiktoken bundle also loaded the pinned Voyage tokenizer successfully; both routes counted
`hello world` as two tokens without provider calls. Hosted retry remains gated on corrected release verification.

Hosted canary started: version `20260916.1` deployed successfully with `--skip-promotion`, deployment
`hv18sln3`, 34 detected tasks. Explicit NC-only activation was created and read back as `nc`; no Alaska
activation or recurring schedule was created. The ten-target retained NC payload was submitted pinned to
that version as `run_06gahoq3pgdkm1jd3da5446801`, using a digest/version idempotency key. Submission is not
completion: verify extraction, OCR, embeddings and retrieval before closing this gate or promoting.

Release candidate full `pnpm verify` PASSED (exit zero): 329 legislation files passed, eight skipped;
3091 tests passed, 146 skipped; all nine coverage tasks succeeded. Log:
`%TEMP%/agency-release-complete-verify.log`. Candidate is `D:/agency-repair-release`; this does not certify
unrelated current-main dirty changes. Publication with `--skip-promotion` has now started. Default
production promotion and state-content activation remain off pending hosted canary evidence.

Production deployment readback: Trigger `list_deploys` returned newest deployed version `20260914.2`
(`mqyvi1ai`, September 14 21:28:38 UTC), with commit message matching local `bda3143`.
The candidate baseline `4c382c4` descends from it but also adds committed regulatory Trigger tasks.
The repair overlay is isolated from current dirty work, not from those undeployed baseline additions.
Do not promote it as a repair-only release without resolving this deployment scope. No deployment made.

Latest terminal full result: 327 passing files, 2850 passing tests, eight skipped files; only Next build
setup failed at its old four-minute deadline. The isolated candidate now includes the ten-minute setup
allowance and the dispatch command/tests. Full verification is running again with two workers; no release
approval is inferred from the prior partial result.

Canary dispatch now has a reusable command: `tools/openstates/run-state-extraction-repairs.ts --payload <file>
--sha256 <retained-digest> --version <deployment>`. It defaults to a local plan; `--apply` explicitly submits through Trigger.
The command verifies exact bytes, requires audited targets, validates state/session scope and derives
an idempotency key from the payload digest and explicit deployment version. It does not enable states or bypass hosted activation.
The installed SDK supports version-pinned submission and `triggerAndWait` pins children to the executing
worker version. This permits an unpromoted canary without replacing the default deployment. The updated
CLI regression passed, as did focused lint/format. No version has been published or triggered by this work.
Dry-run of the retained NC payload reports ten targets and `dispatched: false`.
The CLI regression passed in a plugin-free backend test configuration: repeat planning is identical,
altered checksums reject, and cross-state evidence rejects. The normal frontend-plugin test invocation
stalled before reporting cases and was stopped after this diagnostic passed; the full release suite was
left running. Temporary diagnostic configuration was removed. This is a focused pass, not full verification.

Same-drive verification candidate: `D:/agency-repair-release`, detached at `4c382c4`,
contains the 15 repair source/test files over the committed baseline plus the existing main-checkout
Turbo passthrough for `VITEST_MAX_WORKERS`. The first same-drive run compiled and type-checked Next,
fixing the cross-drive module-resolution problem, but timed out during build tracing and six tests.
Full `pnpm verify` is rerunning with two Vitest workers and unchanged timeout limits. Previously failing
parser, retrieval and embedding checks have passed in this run; full completion remains unverified.
The same-drive Trigger dry run exited zero: `.trigger/tmp/build-YjmWIJ`. It warned that optional skill
discovery timed out and skipped skill bundling. Nothing was published or activated.
The two-worker full run ended with 326 passing files/2849 passing tests, a Voyage test timeout and another Next build
timeout, so it cannot be considered a passing release gate. Inspection found that build acceptance
spawned a synchronous wrapper and timed out that wrapper rather than Next itself. The test now resolves
and spawns the Next CLI directly. Standalone acceptance passed all 240 tests in 156 seconds, with the
original four-minute build deadline. Standalone embedding-client tests passed all 13 tests with unchanged
deadlines. A final single-worker full verification is required; these focused passes do not replace it.
The single-worker full run also exceeded the four-minute build setup limit. After the 156-second
standalone acceptance success established functional correctness, the build-only deadline was increased
to ten minutes for shared-machine cold builds and tracing. API request deadlines and all route assertions
are unchanged. Lint/format pass; full acceptance with this new setup allowance is still pending.
Production Trigger variable-name inventory confirms database, blob storage, Azure identity, OCR endpoint,
OpenRouter and passage-search configuration keys exist (values not inspected or printed).
`OPENSTATES_CONTENT_ENABLED_STATES` remains absent: workers have not been activated.

- [x] Expanded transactional repair smoke: wrong document/bill/URL, changed source/text,
  active worker and duplicate attempts all reject; successful requeue resets retry state and
  preserves served text. Every test mutation rolls back; no production writes.
- [x] Isolated release coverage ran 2849 passing tests. The regulations parser suite passed all
  18 tests on a focused rerun; its full-suite failure was a five-second timeout.
- [ ] Full verification is not green: isolated Next acceptance cannot resolve cross-drive
  junctioned Next dependencies (`./D:/agency/node_modules/next/...`). The current checkout's
  `pnpm verify` separately stops on untyped mocks in `VoteDetails.test.tsx` and
  `resultStore.test.ts`, outside this repair scope. No unrelated files changed to bypass gates.
- [ ] Hosted repair deployment, activation, NC canary and production downstream validation remain
  open. Local smoke success is not production onboarding completion.

## Read-only configured production history audit (September 16)

OCR parity follow-up joined by canonical bill and exact source URL, then checked source content hashes before comparing
text. The temporary comparison harness was removed after retaining its audit artifacts. Local and production document IDs differ;
ID-only lookup falsely appeared absent and was replaced, without interpreting that as missing source data.
NC: all 12 local OCR documents matched; two have identical text and ten have longer local text.
AK: all 2302 matched by bill/URL; five source hashes differ or are unavailable, 1345 texts match,
and 952 texts differ (852 longer locally). For example, AK HB101 local extraction has 69495 characters
where production has 409 from the same hashed source. These are concrete production extraction gaps.
Immutable audit artifacts under `artifacts/openstates-runtime/production-ocr-audit` retain exact
production IDs, source hashes and text hashes for revalidation before pipeline-based repair. No production
rows were updated. Length alone is not a quality score; do not overwrite differing results blindly.

Repair safety implementation: `requeueVerifiedExtraction` atomically requires matching document ID,
source URL, source SHA-256, previous text digest and processed status before marking a document pending.
It preserves served text and uses the normal downstream pipeline rather than copying local rows.
Local transactional smoke verified stale source/text rejection, duplicate rejection and text preservation;
all changes were rolled back. Focused types/lint and the service type-check passed. Production repair
dispatch and hosted activation remain open. The existing state-content worker now accepts at most ten
audited repair records, validates state/session scope and duplicates before writes, then uses guarded requeue
and the existing document/OCR/embedding scan. Controller forwards repairs only to its first child; retry
safety comes from compare-and-set evidence and durable pending state. Six policy tests and local rollback
smoke passed; no hosted deployment or production activation was performed.

Hosted preflight (September 16): the documented production API `/ready` ingestion-contract check passed;
Trigger CLI authenticated to the Legislation project. `trigger deploy --dry-run --skip-update-check
--skip-telemetry --config trigger.config.ts` built successfully, exit 0, without publication.
Build output: `.trigger/tmp/build-gid8YS`. The working tree also contains unrelated regulatory task
edits, so this full bundle has not been promoted as an NC/AK repair release. Latest full verification
failed in unrelated `app/chat/resultStore.test.ts` mock typing; focused repair checks remain passing.

NC canary payload prepared (not dispatched): `tools/openstates/prepare-state-extraction-repairs.ts` verifies
the retained audit checksum, validates exact state/session scope, caps batches at ten and retains a
content-addressed controller payload. Repeat generation produced the same payload hash
`5298509091077ba5fdea6b8c8adfb63b6c4de54bdba55dc6c8b96b1039783206` for all ten NC candidates.
Location: `artifacts/openstates-runtime/production-ocr-audit/nc/payloads/5298509091077ba5fdea6b8c8adfb63b6c4de54bdba55dc6c8b96b1039783206.json`.
Focused types and lint passed. Publication scope for unrelated regulatory edits was raised with the user;
do not confuse preparing a payload with deployment, activation or successful production repair.

Repair execution priority now merges audited bill IDs ahead of existing pending continuations without
discarding the previous backlog or advancing the ordinary scan cursor. Checkpoint backlog remains bounded
at 100 IDs. Four focused checkpoint tests and lint pass; this change still awaits hosted release acceptance.

Isolated release snapshot prepared at
`C:/Users/andcra/AppData/Local/Temp/legislation-repair-release-d769abb6758942f69ffa3ee59586830c`
from commit `4c382c43a7e1048ce7597f3ccdefd694f4baebed`, overlaying only 15 OCR/embedding/state-content
files. Unrelated regulatory/frontend edits are excluded. Existing dependencies are junction-linked for local
verification only; pnpm's attempted dependency reconciliation was not allowed to purge them. Direct installed
compiler service types passed, Trigger dry run passed (`.trigger/tmp/build-ybS9xN`), and 37 focused tests
passed across five files. Temporary test config removed. No deployment or activation occurred.

Isolated full verification is running with `pnpm_config_verify_deps_before_run=warn` to avoid mutating
the junction-linked shared dependency installation. It reached coverage tests; at least one test has
failed, so full release verification is not established. Process handle 98558 owns the run, log
`C:/Users/andcra/AppData/Local/Temp/agency-isolated-repair-verify.log`.
Live Trigger production configuration lookup confirmed `OPENSTATES_CONTENT_ENABLED_STATES` is absent.
Hosted content execution remains disabled; no flag, deployment, or schedule was changed.

The completed state-history audit used indexed canonical jurisdiction/session selection and 25-bill document batches,
read-only transactions, 10-second statement limits and two-second lock limits.
Canonical session normalization is essential for NC special sessions; uppercase literal IDs initially
returned zero, corrected by the shared identifier helper and rechecked below. No writes occurred.

| State/session | Bills | Processed documents | Other outcomes |
| --- | ---: | ---: | --- |
| AK 30 | 649 | 12079 | 8 malformed, 30 unsupported format |
| AK 31 | 674 | 7691 | 7 malformed, 1 unsupported format |
| AK 32 | 831 | 12444 | 7 malformed, 4 unsupported format |
| AK 33 | 812 | 14110 | 2 malformed, 7 unsupported format |
| AK 34 | 857 | 15026 | 11 malformed, 27 unsupported format, 2 not found, 2 transient download failures |
| NC 2017 | 1953 | 6030 | 1 not found |
| NC 2017E1 | 12 | 32 | None |
| NC 2017E2 | 8 | 25 | None |
| NC 2017E3 | 9 | 35 | None |
| NC 2019 | 2109 | 6505 | None |
| NC 2021 | 2095 | 5970 | None |
| NC 2023 | 2005 | 5526 | None |
| NC 2025 | 2338 | 6192 | None |

Only AK 33 records one OCR completion; all other audited sessions record zero. This differs from local
current-session OCR results and requires extraction-quality comparison before accepting production
"processed" status. Do not blindly repeat archive ingestion. These counts establish stored outcomes,
not source completeness, embedding freshness, or hosted end-to-end acceptance.

## NC document library bounded crawl (September 16)

- [x] Added restart-safe publisher folder discovery with immutable, SHA-256-verified HTML receipts,
  a 25-second request timeout, streaming 4 MB response limit, request/folder limits, and cycle detection.
- [x] Crawled Child Fatality Task Force site 512, meeting-documents root 12626:
  29 folders and 132 distinct file IDs retained. First invocation stopped after 20 requests;
  the resumed invocation fetched the remaining 9 folders and reported complete.
  Evidence: `artifacts/openstates-runtime/nc-document-library-crawls/meetings-20260916`.
- [x] Three focused parser/crawler tests passed; focused TypeScript and lint checks passed.
- [x] Added `tools/openstates/import-nc-library-content.ts`: requires complete retained evidence, registers
  all 132 files transactionally using canonical jurisdiction identifiers, rejects conflicting metadata,
  and invokes the shared supporting-material download/extraction processor in bounded local batches.
  No inferred document dates or meeting links are inserted. Canary: four processed PDFs and one
  mixed scanned/digital PDF correctly queued as OCR-required. Expanded local extraction is running;
  the completed database count confirms all 132 files processed and 610 extracted sections.
  Focused script types and lint pass. No production writes were performed.
- [x] The three OCR-required PDFs completed through the existing Azure Document Intelligence client:
  128 pages, three processed, zero failures. The shared supporting-material pipeline scoped OCR and embedding work to
  the imported library materials in the local database. The shared supporting-material
  embedding route and input-hash freshness checks are reused; section cursors advance for large files.
- [x] Local library embedding pass completed: 610/610 sections have the configured supporting-material
  model/input-contract embedding and zero missing lexical vectors. Shared query-service smoke returns five
  canonical NC publisher-backed hits in each of lexical (76 ms), semantic (2162 ms), and hybrid (276 ms)
  modes. These are one-run timings, not a load-test guarantee. Supporting-material search uses canonical
  storage; this result does not claim separate bill-passage synchronization, HTTP/MCP, or production acceptance.

Alaska session 34 event import completed all 285 planned batches. Publisher-fact audit compared all
2846 admitted occurrences with retained official XML: 2846 matched, zero name/location/status/start-time
mismatches. Quarantined conflicts remain excluded. Final relationship/readiness reconciliation completed
285 batches and 2846 events, with 3178 bill links and 2304 organization links. Local HTTP/MCP meeting smoke
passed seven HTTP requests plus MCP search and three detail calls. Production authentication was not tested.
Source-fact parity alone does not establish full historical state onboarding or production deployment.
- [x] Download/extract the 132 inventoried files through the shared content pipeline and validate
  all 610 section embedding-input hashes against current text. Local MCP client/handler lexical,
  semantic and hybrid supporting-material searches each returned five canonical publisher-backed hits.
  This is not production OAuth or HTTP-adapter acceptance.
- [x] Fixed scoped supporting-material embedding pagination: a material filter previously ignored
  the section cursor. Live-database regression now checks the exact remaining tail after a cursor
  and rejects any provider call for fresh embeddings. Focused types, lint, and local smoke pass.
- [ ] Establish meeting relationships from publisher evidence, not filename/date guesses.
  This single committee library does not establish statewide archival completeness.

Resume with `pnpm tool openstates/crawl-nc-document-library 512 12626 meetings-20260916 20`.
Reusing the crawl ID reads retained evidence; a fresh sync needs a new crawl ID.
Full `pnpm verify` remains unsuccessful: formatter cannot save `next.config.ts` because Windows
reports an open user-mapped section. Do not treat focused checks as full repository acceptance.

## Blocking delivery priority: NC and Alaska end-to-end ingestion

Scope correction, September 15: production and local scraper validation are different databases.
Live read-only production checks confirm completed checkpoints for all 13 retained NC/AK session archives:
AK 30–34; NC 2017, 2017E1, 2017E2, 2017E3, 2019, 2021, 2023, 2025. Do not blindly reload them.
This proves archive checkpoint completion, not historical document/OCR/embedding or entity completeness.
The earlier assertion that historical bill ingestion had not happened was incorrect. A broad production document
inventory hit its 20-second read-only timeout; finer-grained coverage remains to be audited.
Bounded production acceptance for NC 2017E1: all 12 bills have routed bill embeddings; all 32 documents are processed;
all 81 extracted sections have routed section embeddings. No OCR was recorded for those documents. This one-session
result does not establish freshness or API/MCP acceptance for every historical session, but it disproves a blanket
claim that historical content/embeddings were never ingested. Inventory actual gaps before further production backfill.

User decision, 2026-09-15: do not onboard additional states until NC and Alaska
complete content processing and search acceptance. Checked source-import items
below mean record promotion only, not complete ingestion.

| Complete | Requirement | Acceptance evidence |
| --- | --- | --- |
| [ ] | Shared durable orchestration after scraper promotion | Backfill and recurring scrapes invoke the same bounded downstream services; retries and restarts cannot lose a handoff or duplicate work. |
| [ ] | Source artifact download and extraction | NC's 6,192 and Alaska's 15,064 currently pending document records have reconciled processing outcomes; preserve exact bytes, hashes and source provenance. Counts are a starting snapshot, not an OCR estimate. |
| [ ] | OCR when needed | Reuse existing OCR detection, claims, provider and persistence; persist native/OCR sections under the same document identity. Failed or unsupported content stays visible, not counted as success. |
| [ ] | Current embeddings | Reuse canonical product routes and input hashes; generate missing/stale vectors only. Scope workers to approved NC/AK records, including late OCR results. |
| [ ] | Search indexing and synchronization | Reuse PostgreSQL vector indexes and the existing ranked lexical projection; reconcile missing/stale rows and pending retries. Do not rebuild valid global vector indexes for routine additions. |
| [ ] | End-to-end API/MCP acceptance | Source-backed NC/AK fixtures cover native and OCR content, canonical citations, lexical/semantic/hybrid retrieval, changed-content refresh and interrupted-run recovery. Report uncovered source data separately. |

Shared embedding contract (`src/models/embedding-routing.ts`): bills and supporting
materials use `voyageai/voyage-4`, 1,024 dimensions; document sections, document-backed
amendments and structured amendments use `openai/text-embedding-3-small`, 1,536
dimensions. Query embeddings must use the matching route and input contract.
No per-state models, index copies or OCR implementations are planned. State-specific
code is limited to source parsing, selection, validation and host/request limits.

The local scraper CLI currently stops at canonical promotion. Existing Trigger
document dispatch and derived-processing services are reuse targets, not evidence
that this end-to-end connection has already been implemented or activated.

## Source and runtime milestones

### North Carolina meeting-status correction (2026-09-16)

- [x] Identified a separate NC committee document-library source omitted by calendar scraping. Added strict publisher
  folder/file discovery and checksummed local HTML retention. Live site 512/folder 24091
  exposes six files, including agenda 120383 for August 27, 2026. This is not evidence for the September 15–16 notices;
  no date/title-based meeting link is created. The parent folder exposes historical year ranges back to 2010–2011.
  Parser regression covers explicit identities, cross-site targets, untrusted file hosts and unexpected login content.
- [ ] Crawl approved document-library folders with bounded checkpoints, retain document bytes, process native/OCR text,
  and validate explicit meeting associations. Current discovery is not completed content ingestion.

- [x] Corrected runtime built locally from verified retained dependencies and 496 source inputs. Input digest:
  `8dd4689bcfe72cf8b1cee5372c1106bd9f077845bea3187074fe17cc833beaeb`; image manifest:
  `40285d0f2080700daa604ae9c1c7ba38b2097e4d8bd2d4f483ca143f97926dc0`. Offline startup passed both NC/AK lanes after
  correcting the stale startup probe to use bounded Alaska event keys. A live 180-second NC canary exited zero and
  extracted notices 10724/10725/10726 as tentative, with zero agenda items. No database credentials or writes were used.
  Local retained attempt: `artifacts/openstates-runtime/nc-event-status-canary/openstates-nc-y8xnmtdy`.

- [x] Removed the pinned scraper's elapsed-clock inference of `passed`. Merely reaching a scheduled start is not proof
  that the meeting occurred. Retained old `passed` records normalize to `other`, not `completed`; explicit cancellation
  is preserved. Six normalization tests and eight Python source-policy tests passed. Three hash-verified local notice
  records were replayed from the approved retained build. This does not establish meeting readiness or agenda coverage.
- [ ] Build and activate the updated NC scraper runtime; the source patch is not yet deployed. Continue source-backed
  committee/session and notice-agenda validation before exposing these NC meetings.

### Alaska bounded event import and replay (2026-09-16)

- [x] Real MCP client acceptance passed for bounded Alaska `search_events` and three `get_event` calls through the
  HTTP adapter, retaining canonical IDs and jurisdiction. This exposed and fixed repeated date-schema validation:
  timestamp strings now remain wire-safe until the service callback converts them to Date. Event, vote and change
  searches share the correction; a protocol regression covers all three. Fourteen MCP tests passed. Seven HTTP meeting
  checks also passed. This remains loopback acceptance, not production OAuth verification.

- [x] Explicit local readiness refresh (`reconcile-alaska-event-plan --refresh-readiness`) verified and applied to
  139 committed batches/1,390 meetings. It checks stored title, status, location, classification, timing, jurisdiction
  and remaining meeting facts before changing links/readiness, and refuses stale source facts. At the subsequent read,
  1,099 of 1,430 imported records passed existing public visibility gates; later batches remain pending refresh.
  Seven loopback HTTP requests passed across meeting list, three details and three organization meeting collections.
  A temporary acceptance harness exercised real database repositories and HTTP handlers before removal. No production authentication
  or full historical/session completion is claimed.

- [x] Alaska readiness canary: the source adapter asserts its verified session and explicit single-host scope. The
  shared organization resolver requires every reference to resolve uniquely within the same jurisdiction; missing or
  ambiguous references revoke organization completeness before persistence. A blank chamber-only title remains held.
  Seven focused tests and service type-check passed. Local receipted replay preserved rollback/conflict safeguards.
  The existing public meeting query and projection returned House Finance occurrence
  `a779bdb0e2d1e11871e365c3599785a544a28aeab87b90ac047719def26cb3e2` with its canonical organization and session.
  No public query filters were weakened. The other canary remained hidden. Existing bulk receipts still require reviewed
  re-promotion to adopt readiness; relationship-only reconciliation deliberately never changes completeness flags.

- [x] Read-only publisher-fact audit (`python/audit_alaska_meeting_facts.py`) compared 1,181 local meetings with the
  frozen official XML: all titles, publisher locations, scheduled/cancelled statuses and instants matched. Offset-equivalent
  timestamps are compared as instants. The audit rejects unsafe/conflicting inventory through the shared planner and
  reports non-admitted occurrences. Its regression test catches invented locations and incorrect statuses.
- [ ] Public meeting acceptance remains open: live local SQL found no NC/AK meetings with canonical/session/organization
  completeness asserted. Linked records alone are therefore not visible through the public meeting query. The above
  four-field audit is not sufficient to raise every completeness flag; validate the source's relation scope and remaining
  canonical fields before promoting readiness. Do not weaken the API filters to conceal this ingestion gap.

- [x] Decoupled committee identity acceptance from roster acceptance in the shared NC/AK importer. Local AK replay now
  persists 33 structurally accepted identities while preserving 13 held rosters/97 held membership assertions and 136
  accepted memberships. No partial roster is labeled complete. Parent cycles, missing parents and unknown chambers
  still block identity acceptance; parent membership holds do not erase an otherwise verified identity. Eighteen focused
  committee tests and service type-check passed. Replay preserved membership identities.
- [x] Reconciled 104 committed batches/1,040 meetings after identity import: 1,329 bill links and 857 organization links.
  These are local counts, not production acceptance or whole-session completeness. The event controller is still active.

- [x] Relationship-only reconciliation verified against local PostgreSQL for 88 committed batches/880 meetings:
  1,015 bill links and 550 organization links. Replay leaves event facts and completeness flags unchanged; changed event
  identity/facts and changed agenda identity sets are rejected. This checks committed archives, not full inventory coverage.
  The sequential controller remains active; later batches need the same reconciliation before final acceptance.
- [ ] Resolve remaining organization coverage without inventing identities. Retained Energy and Fisheries committee
  identities now import independently; their rosters remain held for `unaccepted_person` dependencies.
  Other unlinked codes include budget subcommittees and joint/conference meetings; absence of a canonical link is not
  proof that the publisher omitted the organization. Membership acceptance and organization identity need separate review.
- [x] The continuation schedule is deleted at the user's request; the onboarding goal remains active.

- [x] Replayed verified committee artifacts locally: 20 eligible
  organizations now carry current Legislature 34 official identifiers; 136 membership identities remained stable on
  repeat. Thirteen committees/97 assertions remain held. No people rewrite, migration or production write ran.
- [x] Verified House Finance event-to-organization linking against local PostgreSQL using the exact source committee
  identifier. General reconciliation of previously admitted event batches remains open; source completeness flags were
  not promoted to true by this link check.

- [x] Reproduced and fixed a batch-stopping blank-location validation error without inventing a venue. The optional
  location name is omitted after coordinate matching. Failed partial batches were retained, not promoted. The corrected
  ten-event Energy batch committed after the prior 310 meetings; controller resumed with explicitly approved builds.
  Current build inputs: `0aa565ffa56a0784a034b4a6de46447cbaac7ee7744724e9d7139951fc215b08`.

- [x] Shared explicit bill matching tested for unique resolution, duplicate candidates, ambiguity, session separation,
  jurisdiction separation and unchanged source/completeness claims. Three focused resolver tests passed.
- [ ] Organization relationships: inspected stored AK committee website URLs refer to Legislature 33, while the event
  inventory is Legislature 34. Follow-up inspection of the pinned Senate Labor and Commerce YAML found both 33 and 34
  official URLs under the same source organization ID; the single stored website field omits that evidence. Reconcile
  the complete retained source URLs before marking meeting detail or organization meetings ready; do not match by name.

- [x] Corrected publisher `L&C` code validation and URL encoding; a live House Labor and Commerce occurrence imported
  locally with eight agenda items from build `c9eaa836032422585a4a0f4539f36fac3161df30d4243d4855b54f16d85bd061`.
- [x] Verified durable event receipts against local PostgreSQL: identical replay preserves the row, conflicting receipts
  reject, and a bad agenda foreign key rolls back both changes and receipt. Shared bill/event receipt admission avoids
  separate retry semantics. Full event batch execution and recovery wiring remain open.

- [x] Imported two retained official occurrences locally through the shared transactional event writer: House Finance
  on January 22, 2025 and the House seafood-industry task force on January 9, 2025. Five agenda items were retained.
- [x] Replayed the same hash-verified archive. Direct SQL still reports exactly two Alaska meetings and five agenda
  items. Three focused normalization tests pass, including publisher timestamp equivalence, correction-stable identity,
  distinct rescheduled identity and rejection of mismatched official sources.
- [x] Kept both conflicting occurrence keys quarantined with all source variants. No production writes occurred.
- [ ] Expand beyond the two-occurrence batch, reconcile relationships and validate hosted orchestration. This does not
  close the six end-to-end gates above or prove historical event completeness.

Evidence: archive `ak-events-archive-20260916`, retained run `ak-events-20260916`, upstream revision
`d43f853796ceeeb49205f7d144790647764ce105`, approved build inputs
`867b1d2631ea4e8ab78a84c05e3e099bfd7eac5ee62d48f2e58c782b11548235`.
Focused tests used an isolated diagnostic Vitest configuration; repository-wide verification is a separate gate.

### Local current-session content closure (2026-09-15 22:42Z)

| Complete | Local requirement | Evidence |
| --- | --- | --- |
| [x] | Drain NC 2025 and AK 34 document queues | NC 6,192 processed; AK 15,046 processed plus 18 retained unsupported outcomes. Zero pending/processing documents, OCR backlog or active leases. |
| [x] | Verify retained source artifacts | At 23:00Z all 21,256 NC/AK files existed, were non-empty and had SHA-256 checksums matching their content-addressed storage paths. Zero missing files, invalid paths or checksum mismatches; 8,894,637,798 bytes checked. |
| [x] | Current extracted-content vectors | Final Alaska audit: 856 bill and 65,882 section vectors, zero missing/stale canonical hashes or dimensions. NC audit at 21:17Z: 2,338 bills and 36,187 sections, zero missing/stale; no subsequent NC processing. |
| [ ] | Unsupported-format closure | Eleven MSG attachments need supported extraction; seven individually reviewed no-text artifacts remain explicit non-text outcomes, not successful text extraction. |
| [x] | Local ranked lexical projection and canonical mapping | Copied 102,069 sections into isolated ParadeDB 0.25.9; exact parity verified for IDs, document IDs, headings, text, hashes and page bounds. NC, AK and OCR-document positive searches and a no-results query passed. |
| [ ] | End-to-end and hosted closure | HTTP/API/MCP and semantic/hybrid acceptance, historical/entity/event coverage, durable hosted handoff and full repository verification remain separate open gates. |

### Non-document data follow-through (2026-09-15)

Alaska collision handling implemented in shared prepared-source helper `alaska_meeting_partition.py`: exact XML
duplicates collapse; differing rows under the same occurrence key are all retained in a quarantine report and excluded
from admission. The scraper writes `_data/ak/meeting_partition.json`, captured by the existing archive inventory.
The report marks `complete_snapshot: false` whenever conflicts exist. Eleven partition/source-policy tests pass.
Live source replay matched 2,846 accepted occurrences, five duplicate rows and two quarantined keys containing all
four conflicting rows. This was read-only validation; it has not yet imported Alaska events. Fresh pinned build inputs
contain 496 files. Runner/archive contract activation, bounded extraction and canonical promotion remain next.

September 16 01:58Z full Alaska session-34 source audit: 2,855 XML meeting rows form 2,848 occurrence keys.
Seven keys repeat: five pairs are byte-identical; two keys (H/S LEC, March 18 2026 17:15 -08:00) disagree in
agenda, location, sponsor attributes and title. Twenty-four rows lack source locations; none are date-only.
Do not arbitrarily choose a conflicting version. The remaining extraction work must collapse exact duplicate rows,
retain/quarantine both conflicting variants and admit the 2,846 non-conflicting occurrences independently.
No canonical writes, active local content workers or leases; hosted jobs remain unverified.

Alaska meeting correctness implementation: source policy now preserves publisher location text (including empty),
avoids regex crashes on unfamiliar room labels, retains exact minutes/seconds in meeting links, and uses
chamber/sponsor/scheduled-time occurrence keys instead of title/location keys. Duplicate occurrence keys fail extraction
rather than silently dropping records. A time change is not claimed to be the same meeting; reschedule reconciliation
remains open. Eight policy tests and all 495 freshly prepared source files passed verification. An isolated invocation
of the actual patched scraper passed unknown-location, 13:37:15 URL, occurrence-key and agenda assertions; media HEAD
was stubbed only in that test. Alaska runtime activation and canonical event import remain pending.

September 16 Alaska event review: the approved official `/publicservice/basis/meetings` endpoint with session 34
returned 2,855 meetings and agenda content over verified TLS. Its scraper's optional `date` query instead returned
an `IllegalBasisUrlException` inside HTTP 200. Source policy now requires TLS verification and 10/60-second
connect/read bounds for API and media probes, checks HTTP status, and rejects XML Error envelopes rather than
treating them as an empty successful scrape. Eight policy tests pass. Event identity, source location fidelity,
bounded session extraction and promotion still require implementation; Alaska events are not enabled yet.

September 16 event-lane progress: bounded NC scrape using the existing journal image completed successfully
(build inputs `fa0a1820148b4ee765dbed9db32b0e8c81d2011f42bba7bc7fc91b946410f526`). Seven raw files were
archived and checksum-verified under local `artifacts/openstates-runtime/nc-events-archive-20260916`.
The three official notices 10724, 10725 and 10726 normalized with stable notice identities and were imported through
the shared transactional event writer into the local test database. All three canonical event-detail reads passed.
Their output has zero agenda items and no resolved organization IDs; participant names are retained without identity
guesses. This is current-calendar acceptance, not historical coverage or production import. Alaska events remain
disabled pending the pinned source's identity/location/TLS review; that guard was not bypassed.

September 16 01:20Z read-only local inventory: NC has 674 people, zero legislative events and zero agenda items;
Alaska has 164 people, zero legislative events and zero agenda items. These totals do not prove historical completeness
or current roster accuracy and are not production counts. Upstream people HEAD remains
`677c6d0a566ad9bd62b6324e502af76acc3d22f3`; no corrected source revision is available. No local content worker or
ingestion lease was active. The next independent data lane is event-source extraction and bounded promotion acceptance;
do not mark event endpoints covered by successful passage searches. Hosted Trigger jobs remain unverified.

| Complete | Requirement | Latest evidence / remaining work |
| --- | --- | --- |
| [x] | Recheck source revision for held people | Upstream people HEAD remains `677c6d0a566ad9bd62b6324e502af76acc3d22f3`; no corrected-source refresh available. |
| [ ] | People and committee dependency closure | Preserve four Alaska history quarantines and dependent committee holds; NC Senate district 1 and full roster reconciliation remain unresolved. |
| [x] | Implement Alaska journal voter extraction | Shared prepared-source policy now fetches journals and parses complete, uniquely matching roll calls without person-ID guesses. Python parser/policy tests pass; 495 prepared files reverified; rebuilt container startup passes. |
| [x] | Bounded real-source voter acceptance | Actual patched scraper method yielded all 40 HB1 House yes voters from the May 7, 2026 page-2441 journal; no canonical writes. |
| [x] | Additional live journal cases | Parser matched HB1 Senate (19 yes/1 no), HJR4 House passage (28 yes/10 no/2 excused), and HJR4 amendment failure (17 yes/21 no/2 excused): 140 source positions across four roll calls including the House HB1 case. |
| [ ] | Full-session voter ingestion and sponsor/person linkage | New build has not replaced frozen-cycle fingerprints or been activated; broader journal fixtures, source-ID linkage and replay/promotion remain. |
| [ ] | Meetings, agendas, event details and historical coverage | Still open; documents and bill-vector completion do not close these lanes. |

Journal-change verification: four parser tests, seven source-policy tests, and six preparation tests passed
(one Linux-only preparation test skipped on Windows). The rebuilt isolated container passed startup and actual
patched-method HB1 replay. Full `pnpm verify` is not green for this change: the first run lost a temporary coverage
file; the isolated-directory retry passed 3,009 legislation tests but timed out in one unrelated five-second
OpenRouter retrieval test. That test passed separately (all three retrieval tests). No timeout threshold was raised
and no unrelated implementation was changed to hide the failure. Both existing NC/AK content processes remained active.

### Shared downstream canary evidence (2026-09-15)

- [x] September 16 01:03Z policy verification: all five Vitest policy tests passed with a temporary minimal configuration (576 ms, exit 0). The normal configuration with one thread also reported five passing cases but was interrupted before clean completion. This narrows the unresolved runner issue to broader setup/teardown; it does not establish its exact cause or a green full suite. Temporary diagnostic config removed. No local worker, active query or lease at check-in; hosted status remains unverified and no schedule activated.
- [ ] September 16 00:46Z: no local content worker or ingestion lease. Extracted the shared NC/AK schema into `state-content-scope.ts` so schedule-policy validation no longer imports the document-processing runtime. All callers use the same schema. Eight direct schedule-policy assertions, focused lint and service types passed. Vitest still stalled before reporting cases and was stopped; import decoupling did not resolve the test-runner issue. Hosted status remains unverified and schedules remain unactivated.
- [ ] Scheduled-entry verification: focused lint and service type-check pass. The focused Vitest invocation stalled before reporting cases; no passing test claim. Full verification is blocked by unrelated `regulations/passage-preparation.ts` nested-ternary lint and an origin/main fetch failure. Schedule remains unactivated pending successful tests and hosted acceptance.
- [ ] Implemented the opt-in `openstates-content-schedule` entry point for durable resumption. An explicitly created schedule must supply an exact `state:session` external ID (for example `nc:2017E1` or `ak:34`) and the state must be approved in `OPENSTATES_CONTENT_ENABLED_STATES`. Each occurrence dispatches one bounded controller continuation with an occurrence idempotency key; existing database leases/checkpoints remain authoritative. No cron or hosted schedule was created. Hosted retry/non-overlap acceptance and activation remain open; this is not an immediate promotion callback or search-sync activation.
- [x] September 16 00:25Z repeatable local adapter acceptance: `inspect:openstates-ranked-passages --with-models` now includes MCP client → MCP handler → real HTTP adapter → loopback API → query service. All six NC/AK mode cases passed (43–891 ms), alongside nine direct service cases and HTTP invalid-mode rejection. Focused lint and service types passed. Explicit local DB URLs and loopback binding prevent production mutation; listeners, transport and pools close after completion. Production OAuth and hosted acceptance remain open.
- [x] September 16 00:21Z check-in: no local Open States worker or ingestion lease. Actual loopback HTTP listener using `createLegislationServer` and the real passage API handler passed six POST `/api/search/passages` requests: NC/AK lexical, semantic and hybrid each returned HTTP 200 and three projected results (33–1,120 ms). Invalid mode returned 400. Listener and pools closed afterward. This verifies local HTTP routing/serialization with live models, not production OAuth or the MCP-to-HTTP adapter. Hosted jobs remain unverified; no production changes.
- [x] September 16 00:04Z check-in: no local content worker, active database query or ingestion lease. Real MCP client negotiation, tool discovery and six `search_bill_text` calls passed through the in-process StreamableHTTP handler backed by the actual local query service and live model client. NC/AK lexical, semantic and hybrid each returned three correctly linked canonical results (81–1,568 ms). This checks MCP protocol/serialization, not the production HTTP API adapter, network listener or OAuth boundary. Hosted Trigger status remains unverified. No production writes or new workers.
- [x] 23:47Z live model integration passed all nine shared-query-service cases (three modes each for NC education, AK education and OCR-recovered SB133 prior authorization). All returned five canonically mapped results. The temporary inspector was removed after acceptance. HTTP/MCP remained unverified at this checkpoint.
- [x] 23:34Z check-in: no local Open States Node worker, active canonical query or ingestion lease. Read-only stored-vector self-retrieval through `semanticPassageSearch` returned five correctly mapped results for each state and included the source section (NC 65 ms, AK 57 ms). This verifies the vector retrieval path only, not query-embedding provider integration, hybrid ranking or HTTP/MCP. Hosted Trigger status remains unverified; no jobs dispatched.
- [ ] Repository verification remains blocked: the final ranked-acceptance `pnpm verify` rerun stopped at unrelated UI unused-dependency/export findings (`class-variance-authority`, `ConversationEmptyState`, `ConversationScrollButton`, `Suggestions`). The new smoke script's focused lint and live rerun passed; no production or end-to-end completion claim is made.
- [x] Local ranked acceptance at 23:13Z exercised the shared search implementation against canonical port 55432 and isolated search port 55433. Five results each for NC education, AK education and the OCR-recovered SB133 prior-authorization document passed. The temporary inspector was removed after acceptance.
- [x] 23:00Z artifact acceptance: read-only filesystem audit checked all 21,256 NC/AK document artifacts (8,894,637,798 bytes), including unsupported outcomes. Every file exists and is non-empty; every streamed SHA-256 matches its storage-path hash. Zero unsafe/invalid paths or mismatches. This upgrades the earlier database-reference-only evidence to verified retained bytes.
- [x] No content worker or active lease at check-in; drained queues were not restarted. No executable/production changes, unrelated dirty work preserved.
- [ ] MSG parsing, lexical/API/MCP acceptance, historical/entity/event coverage, durable hosted orchestration and full repository verification remain open; no source or activation gate bypassed. Hosted Trigger status not verified.

- [x] 22:42Z local queue milestone: prior bounded worker finished, no process or active leases, and 41 successful batches since 22:22Z. Alaska has 15,046 processed documents, eighteen unsupported (eleven MSG/seven reviewed no-text), 2,302 OCR completions, no pending/processing documents or unresolved OCR, and no processed documents without sections. NC remains 6,192 processed with twelve OCR completions. All document records have blob-path references. No restart is needed solely to rescan this drained queue.
- [x] Final Alaska freshness audit passed at 22:42:40Z: all 856 bill and 65,882 section vectors present and current, zero missing/stale; both global vector indexes valid/ready. No production changes or new executable changes; unrelated dirty work preserved.
- [ ] Broader delivery is not complete: remaining gates listed in the local closure table above. Hosted Trigger status unverified; prior full repository verification remains blocked/unclosed and is not replaced by these read-only data checks.

- [x] 22:22Z check-in: Alaska process active, 135 successful batches since 22:06Z, no failures or blocked sessions. Snapshot: 14,998/15,064 processed, 2,293 OCR completions, 46 pending, two processing and eighteen unsupported with all artifacts retained (eleven MSG, seven reviewed no-text). A subsequent queue check had 38 unattempted documents and two transient download retries. NC unchanged; indexes valid/ready. No duplicate dispatch or production changes.
- [x] Repeatable-read Alaska freshness audit at 22:22:20Z passed all 856 bill and 65,783 section vectors: none missing/stale. This remains a snapshot before the final documents finish, not lexical/API acceptance.
- [ ] Final document drain, MSG support, final freshness/search/API, historical/entity/event coverage, hosted orchestration and full repository verification remain open. No executable changes this check-in; unrelated work preserved, hosted Trigger status unverified.

- [x] 22:06Z check-in: Alaska process active, 125 successful batches since 21:49Z, no failed content runs or blocked sessions. Local Alaska reached 14,684/15,064 processed documents (up 335), 2,249 OCR completions, 362 pending, one processing and seventeen unsupported with all artifacts retained (ten MSG, seven reviewed no-text). Download retries down to 39. NC remains 6,192 processed and no missing routed vectors; both indexes valid/ready. No duplicate dispatch or production changes.
- [ ] One OCR operation and sixteen section vectors pending at the moving snapshot. Final content/freshness/search/API, MSG support, historical/entity/event coverage, hosted orchestration and full verification remain open. No executable changes in this check-in; unrelated dirty work preserved. Hosted Trigger status not verified; prior focused checks passed and last full check was blocked by unrelated lint.

- [x] 21:49Z recovery: verified all three old leases expired, no state-content worker and no local database client sessions. Started exactly one bounded 300-batch continuation at the existing concurrency two using ordinary lease admission and checkpoint recovery; four batches succeeded. No manual lease deletion, queue reset, attempt-history rewrite or production writes.
- [x] Recovery snapshot: Alaska 14,349/15,064 processed, 698 pending, seventeen unsupported, 2,197 OCR completions and all 63,507 routed section vectors present. NC unchanged at 6,192 processed and zero missing routed vectors; both indexes valid/ready. This validates local expiry-based resumption, not durable hosted dispatch or complete ingestion.
- [ ] Remaining final-processing/freshness/search/API, MSG, historical/entity/event, hosted orchestration and repository-verification gates remain open. No executable changes this check-in; unrelated dirty changes preserved. Hosted Trigger status not verified.

- [x] 21:33Z recovery inventory: no state-content process or database client sessions. All 704 pending Alaska documents are due: 620 unattempted, 73 with one transient download attempt, and eleven with one attempt but no recorded error. None has a future retry time or exhausted attempt budget. No queue reset or attempt-history changes are needed before normal recovery.
- [ ] State lease still unexpired until 21:39:21Z; document/embedding leases expired. No overlapping worker or forced lease removal. Current vector freshness was verified at 21:17Z; final processing and other delivery gates remain open. No executable/production changes; unrelated work preserved, hosted Trigger status unverified.

- [x] 21:17Z paused-worker validation: repeatable-read input-hash audits passed for Alaska (856 bills, 63,498 sections) and NC (2,338 bills, 36,187 sections), zero missing/stale routed vectors in both. No provider calls or production writes. Open States people HEAD remains `677c6d0a566ad9bd62b6324e502af76acc3d22f3`; existing source holds remain.
- [ ] Alaska worker still absent with zero database client sessions; document and embedding leases have expired, but the state lease remains valid until 21:39:21Z. No premature restart or lease deletion. The 704 pending documents and final search/API, MSG, historical/entity/event and hosted gates remain open. No executable changes or new full verification run; unrelated dirty changes preserved. Hosted Trigger status unverified.

- [ ] 21:00Z intervention finding: Alaska counts are unchanged at 14,343 processed, 704 pending, seventeen unsupported and zero missing routed vectors. No content process or local PostgreSQL client session exists; the prior tool process session is no longer available. Three leases remain from 20:39Z, so the previous active-worker inference from leases was insufficient. Cause of process disappearance is not established; do not label this another DNS failure.
- [x] Verified no blocked sessions, no new batches since 20:44Z, all seventeen unsupported artifacts retained, and both vector indexes valid/ready. NC unchanged. Preserved existing leases and did not overlap/restart prematurely: document/embedding leases expire at 21:09Z and the state lease at 21:39:21Z. Next recovery should use normal expiry-based admission and the durable checkpoint after confirming no worker has returned.
- [ ] All final delivery gates remain open as recorded below. No executable or production changes in this check-in, unrelated dirty work preserved, hosted Trigger status unverified. Full verification remains open; prior focused checks passed.

- [x] 20:44Z check-in: active Alaska database job and state/document/embedding leases observed; 103 successful batches since 20:25Z, one running, no failures or blocked sessions. Local Alaska has 14,343/15,064 processed documents, 2,197 OCR completions, 704 pending and seventeen unsupported, all retained (ten MSG, seven reviewed no-text sources). Download retries fell to 73. NC remains 6,192 processed and no missing routed vectors; both indexes valid/ready. No duplicate dispatch or production changes.
- [x] Independent repeatable-read Alaska input-hash audit at 20:44:21Z passed: all 856 bill vectors and 63,498 document-section vectors match canonical current input hashes and route dimensions; zero missing/stale. This is a snapshot while further documents are pending, not final content completion or lexical/API acceptance.
- [ ] Remaining gates: pending Alaska documents and final re-audit, MSG support, search/API acceptance, historical/entity/event coverage, hosted orchestration and full repository verification. No executable changes in this check-in; unrelated dirty work preserved. Hosted Trigger status not verified. Prior focused tests/type checks passed, last full check blocked by unrelated concurrent lint errors.

- [x] 20:25Z check-in: Alaska worker active, 126 successful batches since 20:08Z, no failed content runs or blocked sessions. Local Alaska reached 14,029/15,064 processed documents (up 461), 2,134 OCR completions, 1,018 pending, seventeen unsupported with all artifacts retained (ten MSG, seven reviewed no-text sources) and six section vectors pending. Download retries down to 127. NC remains 6,192 processed and no missing routed vectors; both indexes valid/ready. No new failure class, duplicate worker or production changes.
- [ ] Final Alaska processing and freshness/search/API acceptance, MSG support, historical/entity/event coverage, hosted orchestration and full repository verification remain open. No executable changes in this check-in; prior focused tests/type checks passed, last full verification blocked by unrelated regulatory lint. Hosted Trigger status not verified; unrelated dirty work preserved.

- [x] 20:08Z check-in: Alaska's prior bounded continuation was idle; last batch succeeded at 19:53:01Z, with 111 successful batches since 19:39Z and no failures, active leases or blocked sessions. Resumed one bounded 500-batch continuation at concurrency two from the durable checkpoint; first batch succeeded. No overlapping worker, production change or index rebuild.
- [x] Local snapshot before resume: Alaska 13,568/15,064 processed documents, 2,057 OCR completions, 1,479 pending, seventeen unsupported with all artifacts retained (ten MSG and seven reviewed no-text sources), six section vectors pending. NC remains 6,192 processed with no missing routed vectors; both indexes valid/ready.
- [ ] Final Alaska processing/freshness/search/API acceptance, MSG parsing, historical/entity/event coverage, hosted orchestration and full repository verification remain open. No executable changes in this check-in; prior focused tests/type checks passed and full verification was last blocked by unrelated regulatory lint. Hosted Trigger status not verified; unrelated dirty changes preserved.

- [x] 19:39Z check-in: Alaska worker active, 115 successful batches since 19:22Z, one running, no failures or blocked sessions. Local Alaska reached 13,066/15,064 processed documents (up 478), 1,980 OCR completions, 1,982 pending and sixteen unsupported, all retained (nine MSG, seven reviewed no-text sources). Download retries declined to 204. No duplicate worker, production writes or index rebuild; unrelated dirty regulatory/design changes preserved.
- [x] SB206's older missing-vector backlog cleared through ordinary processing: zero missing expected model/dimension vectors for that bill. Total current Alaska backlog is 38 section vectors. NC remains 6,192 processed and no missing routed vectors; both vector indexes valid/ready.
- [ ] Remaining gates unchanged: final Alaska processing/freshness/search/API acceptance, MSG extraction, historical/entity/event coverage and hosted orchestration. Hosted Trigger status not verified. No executable changes or new verification run in this check-in; prior focused tests/type checks passed, full verification remains open after unrelated concurrent lint failures.

- [x] 19:22Z check-in: Alaska worker active with 104 successful batches since 19:06Z, one running, no failures or blocked sessions. Local snapshot: 12,588/15,064 processed documents, 1,898 OCR completions, 2,460 pending, one processing, fifteen unsupported with all artifacts retained; download retries down to 263. NC unchanged at 6,192 processed and zero missing routed vectors. Both indexes valid/ready. No duplicate dispatch or production changes.
- [x] Individually rendered the new SJR13 no-text artifact `d0d33226944fd9f306e5524f`, SHA-256 `10b5c7b73d1228a697af213a51f5037d5a47a8a4e8e0a3cbe7c5c249664e7808`: one blank letter-sized page, 8,319 bytes. Consistent with the terminal empty-OCR result; no extra OCR charge or invented text. Unsupported outcomes now comprise eight MSG files and seven individually reviewed no-text sources.
- [ ] 259 section vectors pending, including 37 SB206 sections predating 19:06Z; do not call this backlog cleared. Worker discovery cursor was HJR40 with HB69 carried for embeddings; observe SB206 on the next scan before concluding a persistent failure. Final freshness/search/API, MSG support, entity/event/history and hosted orchestration remain open. No executable changes this check-in; full verification remains unclosed after unrelated concurrent lint failures. Hosted Trigger status not verified.

- [x] 19:06Z check-in: existing Alaska worker active, 75 successful batches since 18:50Z, no failed content runs or blocked sessions. Local Alaska has 12,100/15,064 processed documents (up 503), 1,824 OCR completions, 2,950 pending and fourteen unsupported (eight MSG and six reviewed no-text sources), all retained. Download retries declined to 302. NC remains 6,192 processed and no missing routed vectors. Both vector indexes valid/ready; no duplicate worker, production changes or global index rebuild.
- [ ] Alaska has 226 section vectors pending in the moving snapshot; final freshness/search/API acceptance is not complete. MSG extraction, historical/entity/event coverage, hosted orchestration and full repository verification remain open. No executable changes in this check-in; prior focused tests/type checks passed, last full check was blocked by unrelated regulations lint. Hosted Trigger status not verified.

- [x] 18:50Z check-in: Alaska recovery remains active, 93 successful batches since 18:32Z, one running, no failed content runs or blocked sessions. Local Alaska reached 11,597/15,064 processed documents, 1,711 OCR completions, 3,452 pending, one processing and fourteen unsupported with retained artifacts (eight MSG attachments plus the six reviewed no-text sources). Download retry backlog declined to 354. No duplicate dispatch or production changes.
- [x] The pre-failure Alaska section-vector backlog is now cleared: zero sections created before 17:39Z lack the expected model/dimension vector. Only two newer section vectors pending at the snapshot. NC remains 6,192 processed and no missing routed vectors; both vector indexes valid/ready.
- [ ] Final freshness/lexical/API acceptance, MSG parsing, historical/entity/event coverage and hosted orchestration remain open. Hosted Trigger status not verified. No executable changes or repeated full verification in this check-in while unrelated regulatory implementation remains active; last full check was blocked by its lint errors. Connection-retry/OCR focused checks and legislation type checks passed.

- [x] 18:31Z failure diagnosis: Alaska stopped at 17:38Z after Node fetch reported `getaddrinfo ENOTFOUND openrouter.ai`. Active siblings drained and all leases released; no worker remained. DNS resolved successfully at this check. Implemented bounded retries for recognized DNS/socket codes through the structured error cause chain, preserving exact embedding inputs and existing attempt limits; arbitrary errors, certificate failures and cancellation are not newly retried. Forty-three focused embedding/OCR tests passed.
- [x] Resumed one bounded local Alaska continuation from its durable checkpoint after confirming no overlap; first two batches succeeded. Snapshot before restart: 11,088/15,064 processed, 1,627 OCR completions, 3,963 pending and thirteen unsupported (seven MSG plus six reviewed no-text sources), all retained. NC unchanged; indexes valid/ready; no blocked sessions. The 58 pending section vectors are not declared resolved: 52 older vectors still remained at the first recovery check.
- [ ] Full verification blocked by unrelated concurrent `fr-source-inventory.ts` lint errors (nested ternaries and missing braces). No unrelated code altered. Final freshness/search/API, MSG extraction, entity/event/history and hosted orchestration remain open. Hosted Trigger status not verified; these are local worker/database observations.

- [x] 17:29Z check-in: existing Alaska worker active with its state lease; 90 successful batches since 17:12Z and no failed content runs or blocked sessions. Local snapshot: 10,937/15,064 processed documents, 1,600 OCR completions, 4,114 pending, thirteen unsupported with all artifacts retained. Unsupported outcomes are seven MSG attachments and the six already reviewed empty-OCR sources; no new failure class. Download retry backlog fell to 404. No duplicate worker, interruption, production write or index rebuild.
- [x] Earlier Alaska section-vector backlog cleared: no sections created before 17:12Z lack the expected model/dimension vector. The snapshot's 58 pending vectors belong to newer content; both vector indexes valid/ready. NC remains 6,192 processed documents and no missing routed vectors. Upstream people HEAD unchanged at `677c6d0a566ad9bd62b6324e502af76acc3d22f3`.
- [ ] Existing source/entity/history holds, MSG parsing, final freshness/lexical/API acceptance and hosted orchestration remain open. Hosted Trigger status not verified. No executable changes in this check-in; concurrent regulatory implementation remains dirty, and the last full-verification attempt was blocked by its lint errors. OCR focused tests and type checks passed previously; full verification is not claimed complete.

- [x] 17:11Z check-in: previous local Alaska continuation was idle, last batch succeeded at 16:55:47Z, and no process or lease remained. Resumed a single bounded 500-batch continuation at the existing concurrency of two from its durable checkpoint; first resumed batch succeeded. No duplicate dispatch, production writes or index rebuild. Local snapshot: 10,363/15,064 processed, 1,505 OCR completions, 4,689 pending, twelve unsupported (all artifacts retained), five pending section vectors. NC unchanged at 6,192 processed and no missing routed vectors; both vector indexes valid/ready. Download retry backlog is 443; no blocked sessions.
- [x] Rechecked Open States people HEAD: still `677c6d0a566ad9bd62b6324e502af76acc3d22f3`; known roster/history holds remain, without fabricated replacements or tenure changes.
- [ ] Full verification retry remains blocked by concurrent regulations work: four missing-braces lint errors in `annual-cfr-observations.ts` and `import-normalized.ts`. Earlier parser-test lint error was corrected independently. No unrelated implementation touched. OCR focused tests/type checks remain passed; final repository verification, MSG support, Alaska final acceptance, historical/entity/event coverage and hosted orchestration remain open. Trigger status was not verified (no direct Trigger connector available); local database job status was verified.

- [x] 16:50Z empty-OCR source review: rendered and inspected every page of the five remaining HB121 artifacts (`5fd55675f9763cc33ac7ea92`, `811e101b6858b1b44730c354`, `c45a59caa46a1d22e7c4d9bf`, `f49a5f270c5987e61155ce77`, `f76549badbdd28979d5db280`). Each is a single blank letter-sized page (8,319 or 8,321 bytes). Together with the separately reviewed HJR14 aerial map, all six empty-OCR cases have source evidence consistent with no recognized text. No extra OCR calls or invented sections/vectors.
- [x] Implemented a structured empty-analysis error in the shared OCR client, classified through the existing terminal unsupported-content category with the precise no-usable-text reason. It no longer reports a transient execution failure. Missing/non-string provider content is separately retryable as an invalid response; empty text alone never asserts that every source is visually blank. Retained artifacts remain available for review. All 21 focused tests and both legislation type checks pass.
- [x] Reconciled exactly the six visually reviewed local records to `processing_error_category=unsupported-format` and `ocr_status=unsupported`, guarded by their IDs, previous status/reason and retained blob presence. Original errors, attempts, source bytes and identities are unchanged; no documents were marked processed and no provider calls occurred. Future classifications use the generic typed error, not these IDs.
- [ ] Full `pnpm verify` for the empty-analysis change stopped at unrelated concurrent `src/ingestion/regulations/parser-bridge.test.ts:118` (`vitest/require-to-throw-message`). No unrelated code modified. Final repository verification remains open. At 16:54Z the Alaska worker remained active with 41 successful batches since 16:44Z, one running and no blocked database sessions.
- [ ] Local Alaska continues: 10,216/15,064 processed documents, 1,471 OCR completions, 4,835 pending, two processing and eleven unsupported at 16:50Z. Five section vectors pending; both indexes valid/ready. NC remains 6,192 processed with no missing routed vectors. MSG support, final Alaska acceptance, source/entity/event coverage, historical auditing and hosted orchestration remain open.

- [x] 16:44Z check-in: Alaska passed 10,001/15,064 processed documents, with 1,438 OCR completions, 5,052 pending, one processing and ten unsupported. All unsupported records at this snapshot have retained source artifacts. Worker active, 90 successful batches since 16:28Z, no failed content runs or blocked sessions. Retry backlog declined to 472. Both vector indexes valid/ready; 27 Alaska section vectors currently pending. NC remains 6,192 processed with all routed vectors present. No duplicate dispatch or production writes; hosted Trigger status not verified.
- [ ] Remaining gates unchanged: inspect the other empty-OCR artifacts individually, add reviewed MSG extraction support, finish Alaska processing and final freshness/search/API acceptance, then close entity/event and historical/hosted requirements. Git status was clean before this checklist update; no executable changes in this check-in. Previous full verification passed.

- [x] 16:28Z check-in: Alaska worker active, 139 successful content batches since 15:53Z and no failed content runs or blocked database sessions. Local Alaska has 9,359/15,064 processed documents, 5,694 pending, 1,333 OCR completions, 46,848 sections and 11 pending routed section vectors at the repeatable-read snapshot. NC remains 6,192 processed with no missing routed vectors. Both vector indexes valid/ready. No duplicate worker or production writes; hosted Trigger status not verified.
- [ ] Unsupported Alaska outcomes now comprise six empty OCR responses and five MSG attachments. All empty-OCR source artifacts are retained, but only the earlier HJR14 map has been visually classified; do not extrapolate that finding to the other five. Four MSG artifacts are retained. Requeued exactly HB78 `2c2f0f99130fd7a5cae7e545`, the one older MSG failure lacking a blob, through the normal pending queue without resetting attempt history. MSG parsing remains unsupported. Rate-limit retry backlog fell from 546 to 495. No executable changes; last full verification passed.

- [x] Bounded exact-document recovery verified after 15:53Z: SB133 docid 3565 passed the shared claim-based extraction/OCR pipeline, OCR completed all ten pages, and all 11 sections received routed embeddings. Retained bill text is 21,514 characters; its opening matches the visually inspected source title and operative subject. No forced reset, index rebuild or production write. This closes the outlined-PDF canary, not every requeued file.
- [x] HB17 docid 13738 now retains its exact Outlook MSG artifact under SHA-256 `8fa638279fffabe0438e0749d8204fea84404ac5c3ba95c0342b029779be08e8`; filesystem hash verified. It remains unsupported for text extraction, correctly, rather than falsely processed. Exact-document replay used existing atomic row claims and the shared database host limiter while the ordinary state worker continued.
- [ ] Remaining format work: MSG parsing needs a reviewed parser dependency or approved conversion runtime; no dependency added and no name/body guessed from binary strings. Remaining outlined-document cohort outcomes, source throttling retries, search/API, entity/event and historical gates stay open. No executable changes in this verification turn; the preceding full verification passed.

- [x] 15:53Z verification closure: full `pnpm verify` passed for unsupported-artifact retention after the unrelated unused-file blocker cleared. Rechecked official NC Senate roster: Jerry Tillett remains listed as appointed September 3 following Bobby Hanig's August 24 resignation; upstream Open States people HEAD is unchanged at `677c6d0a566ad9bd62b6324e502af76acc3d22f3`. This reconfirms the existing source omission, not a new vacancy or permission to fabricate a person.
- [ ] Local Alaska: 8,245 documents processed, 6,816 pending, one processing, two unsupported, 1,136 OCR completions and 461 pending section vectors at 15:53Z. NC remains 6,192 processed with no missing routed vectors. MSG retention replay and SB133 outlined-PDF recovery still pending; code verification does not close these runtime gates. No duplicate workers or production changes.

- [x] 15:45Z MSG investigation: official Alaska HB17 docid 13738 returns HTTP 200 with a 279,040-byte OLE/Outlook file and declared content type `msg`; it is not a mislabeled PDF. Found and fixed a shared retention gap: bill and supporting-material workers now archive bounded downloaded bytes before format classification, preserving unsupported artifacts for later replay. Existing detection still rejects unsupported formats and no text/embeddings are invented. Forty-two focused download/job tests passed.
- [ ] Requeued exactly the local HB17 MSG record that had no blob path; worker replay must verify retention. MSG extraction remains unimplemented. Full verification stopped at the unused-file gate for unrelated concurrent `tools/regulations/audit-regulatory-reuse.ts`; retention-change focused tests passed and the full check logged clean legislation lint. Alaska continues ingestion; NC current-session content and embedding freshness stay verified, but search/API, hosted and historical gates remain open.

- [x] 15:33Z repeatable-read local freshness audit: NC 2025 has all 2,338 bill and 36,187 section vectors matching canonical current input hashes, model contracts and dimensions; zero missing/stale. Alaska 34 has 856 fresh bill vectors; of 40,268 sections, 386 await vectors and zero existing vectors are stale. Reusable bounded read-only command: `pnpm tool openstates/inspect-openstates-embedding-freshness nc` (or `ak`, optional session argument). Returns nonzero for missing/stale vectors or empty scope; does not call providers or write production. Search/API and historical acceptance remain separate.
- [ ] Alaska retry inventory: 546 pending documents retain HTTP 429 download errors (542 at one attempt, four at two); latest recorded attempt 14:35Z, with scheduled retry times already elapsed. They remain eligible for normal bounded replay. Do not increase source concurrency merely to clear this rate-limit backlog.
- [x] Full `pnpm verify` passed after registering the reusable freshness audit command. This passing run also includes the pending-document priority implementation.

- [x] 15:23Z local NC current-session content milestone: all 6,192 documents processed, 12 via OCR; all 2,338 routed bill vectors and 36,187 section vectors present, with no processed documents lacking sections. HB87's final document completed after the worker resumed. This does not close input freshness, lexical/API acceptance, historical coverage or hosted activation.
- [x] Implemented one bounded due-document priority slot in the shared state worker, after carried embedding work, so pending/requeued documents behind the main cursor need not wait a full scan. Preserves the discovery cursor, jurisdiction/session scope, attempt budget, due time and existing job lease. Seven focused tests and legislation type checks passed.
- [ ] Full verification for priority selection is not clean: Next router acceptance collided with another running Next build; OpenRouter retrieval and regulations embedding-smoke each hit a five-second timeout. 2,826 tests passed; no unrelated build was interrupted or timeout threshold changed. Earlier full verification for vector-PDF eligibility passed.
- [x] Visually inspected HJR14 docid 7906: the retained one-page ArcGIS PDF is an unlabeled aerial map, consistent with OCR returning no text. Preserve the source artifact and no-text outcome; do not fabricate textual content or embeddings. Its generic processing-transient category remains misleading, but retryable=false already prevents repeated OCR charges.
- [ ] Alaska at 15:23Z: 7,426 processed, 7,632 pending, four processing and two unsupported; 963 OCR completions and 38 pending routed section vectors. Requeued outlined PDFs are still being revisited; SB133 canary remains pending at this snapshot. MSG extraction, full voter import, people/committee reconciliation, events and broader acceptance remain open.

- [x] 15:04Z failure investigation: visually rendered retained SB133 docid 3565, a ten-page bill PDF with readable outlined glyphs but no extractable text. PDF.js reports vector drawing paths, not raster operators. Fixed the shared OCR eligibility check to include vector graphics on text-poor pages; blank pages remain distinguishable. Real retained-file replay now reports OCR-required for all ten pages; 19 extraction tests passed. This is a generic format fix, not a bill-specific exception.
- [x] Requeued exactly 60 local Alaska unsupported documents with the old no-raster malformed error for ordinary extraction/OCR; retained original bytes and attempt history, did not mark them successful, and did not start an overlapping worker. Pending replay outcomes still require verification. The two other unsupported classes (MSG attachment and OCR no-usable-text) remain unresolved.
- [ ] 15:04Z local counts: NC 6,191/6,192 processed, 12 OCR completions and no missing section vectors; final HB87 document is unattempted and awaiting the next scan. AK 6,834/15,064 processed, 8,225 pending (including requeues), three processing, two unsupported, 857 OCR completions and 537 pending section vectors. Both states retain full bill-vector presence and valid/ready indexes. Existing two-state concurrency continues; no further fan-out before replay validation. Production and broader onboarding gates remain open.
- [x] Full `pnpm verify` passed for the vector-PDF change using isolated coverage output. Existing workers continued successful batches during verification.

- [x] 14:53Z check-in: both local workers active, with 495 NC and 118 AK successful batches since 14:29Z and no failed content runs in that window. No blocked database sessions. The older Alaska embedding backlog cleared: zero sections created on or before the 14:29:12Z snapshot remain without the expected model/dimension vector, including the previously pending HB2 sections. No manual repair or index rebuild was needed.
- [ ] Current local processing: NC 6,180/6,192 documents processed, 12 pending, 11 OCR completions, 36,163 sections and no missing routed section vectors. AK 6,544/15,064 processed, 8,467 pending, one processing, 52 unsupported, 815 OCR completions, 34,760 sections and 166 currently awaiting routed vectors. One OCR-required document is in flight. Both bill-vector sets are present and both indexes valid/ready. Broader freshness/search, hosted orchestration, source coverage and entity/event gates remain open. No production writes or worker duplication; hosted Trigger status not verified. No executable changes; last full verification passed.

- [x] 14:29Z check-in: both local workers active; 279 NC and 100 AK batches succeeded since 14:09Z, with no failed runs in that window or blocked database sessions. No duplicate dispatch, interruption, production writes or global index rebuild. NC: 6,034/6,192 documents processed, 158 pending, 8 OCR completions, 35,480 sections and zero missing routed section vectors. AK: 5,655/15,064 processed, 9,361 pending, 48 unsupported, 695 OCR completions, 30,327 sections and 21 missing routed section vectors. Bill vectors remain complete by existence; vector indexes valid/ready. Counts are a moving snapshot, not source/freshness acceptance.
- [ ] Unsupported Alaska source outcomes at 14:29Z: 46 malformed documents, one unsupported MSG attachment (HB17, docid 13738), and one OCR no-usable-text outcome (HJR14, docid 7906). Preserve these as unresolved coverage, not successful extraction. NC remaining pending records are unattempted, not exhausted retries. Hosted Trigger status was not verified; the active workers are local. Broader people, committees, journal voter ingestion, events, historical coverage and API/MCP gates remain open. No code changes in this check-in; last full verification passed.

- [x] 14:08Z local inventory: NC 5,747/6,192 documents processed, 445 pending, 8 OCR completions and 2,564 missing section vectors. Alaska 4,853/15,064 processed, 10,170 pending, 41 unsupported, 580 OCR completions and 45 missing section vectors. Both states have every routed bill embedding; both existing vector indexes remain valid/ready. No unresolved OCR or processed documents without sections at this snapshot.
- [x] NC's 13:49Z timeout drained active siblings and released all NC leases. Confirmed no NC process or lock before resuming from its durable checkpoint; the resumed worker passed nine batches. Alaska was not interrupted. Added bounded embedding deadline retries covering headers/body while preserving exact inputs and rejecting unrelated cancellation/errors. Thirteen focused tests, focused lint and legislation type checks passed.
- [x] Full `pnpm verify` rerun passed with isolated coverage output, including the new deadline tests. The initial attempt encountered a scoring-circuit simulation failure; no scoring-circuit fix was made in this work. Resumed NC completed 25 successful batches by the next database check.
- [ ] Broader acceptance remains open: these local counts do not establish production historical coverage, fresh search projections, full-session Alaska voter ingestion or people/committee/event closure.

- [x] 13:14Z live check: both existing local workers still active, NC through batch 283 and AK through batch 111. All 2,338 NC and 856 AK bills now have routed bill embeddings (existence, not input-freshness acceptance). Processed documents: NC 5,032/6,192; AK 2,979/15,064. OCR completions: NC 5, AK 359; no unresolved OCR or processed documents without sections at the snapshot. Both vector indexes valid/ready.
- [ ] Remaining local content at 13:14Z: NC 1,160 pending documents and 354 missing section vectors; AK 12,066 pending documents, 19 unsupported outcomes requiring review, and 1,199 missing section vectors. Existing workers continue without duplicate dispatch. Historical completeness, hosted orchestration/recovery, lexical synchronization and API/MCP acceptance remain open; no production activation or hosted Trigger verification in this check-in. No executable changes were made; the last passing code verification remains recorded above.

- [x] 12:57Z live check: both local workers active without overlap; NC batch 207 and AK batch 61 succeeded. NC has 4,147 processed documents and 1,925/2,338 routed bill vectors; Alaska has 2,455 processed documents and 856/856 routed bill vectors. OCR completions: NC 5, AK 289; no unresolved OCR at that snapshot. Existing vector indexes remain valid/ready and no database sessions are blocked.
- [ ] Alaska's 18 unsupported PDFs all report too little usable text and no detected raster pages. They require source-level review before assigning a coverage gap; they are not successful processing outcomes. Section-vector backlogs remain (NC 447; AK 1,134 at the snapshot), and vector existence alone does not establish input freshness or lexical/API acceptance. No workers were duplicated or interrupted, no production activation occurred, and hosted Trigger status was not verified in this check-in. Last code verification remains the passing 12:41Z result.

- [x] 12:34Z follow-up: NC remained active and passed 100 additional batches. Alaska exited again after two batches with unsettled top-level await; the prior PDF deadline is not evidence of complete resolution. Recovered only its two exact dead leases and one abandoned document claim; NC was not interrupted.
- [x] The Alaska SB83 document (`docid=12225`) downloaded and correctly classified as mixed-scan/OCR-required in isolated and repeated concurrent extraction replays. No document-specific exception or fabricated content was added. Fixed a separate verified resource-policy gap: the document worker now shares one PDF extraction limiter across concurrent bill batches, with reserved-slot handoff and failure-release testing. Network acquisition and embeddings retain fan-out.
- [ ] Sustained Alaska restart acceptance remains open. Restarted at two bill pipelines; first eight-bill batch succeeded. At 12:38Z local processed totals were NC 3,030 and AK 1,780, with one unresolved Alaska OCR item. Both existing vector indexes remain valid and ready. Do not declare the intermittent exit root cause resolved from one successful batch.
- [x] 12:41Z acceptance refresh: NC 3,111 processed documents, AK 1,846; zero unresolved OCR items in either state and zero blocked database sessions. Alaska passed seven restart batches. `pnpm verify` passed after the limiter change: 3,005 legislation tests passed, 131 conditional tests skipped, and four receiver tests passed. Historical source checkpoints remain distinct from these local current-session content counts; hosted Trigger activation was not performed or verified in this check-in.

- [x] Recovered the interrupted Alaska local run: verified no content worker remained, released its three exact pre-12:08Z leases, and requeued the two abandoned native document claims within that attempt's time window. No production writes.
- [x] Bounded PDF.js loading and decoding to 120 seconds with a referenced timer and awaited disposal, including failed loading. Budget exhaustion routes retained content to provider extraction rather than silently losing the process. This does not preempt synchronous CPU stalls or establish hosted hard-kill recovery.
- [x] Restart acceptance: an eight-bill Alaska batch succeeded with three successful OCR operations; 21 focused extraction/lifecycle tests passed. NC and Alaska bounded local continuations restarted at two bill pipelines per state. Earlier sustained processes had stopped (NC network timeout; AK unsettled top-level await), so earlier active-run entries are historical, not current liveness evidence.
- [ ] Complete sustained-run acceptance, network-timeout recovery, remaining content, lexical synchronization and API/MCP verification. A successful restart or scan round is not ingestion completion.
- [x] Post-recovery repository verification passed: `pnpm verify`, 3,004 legislation tests passed, 130 conditional tests skipped, plus four webhook-receiver tests. The shared ingestion database was not reset for integration testing. At 12:17Z local processed documents were NC 1,691 and AK 1,756; existing bill/section vector indexes remained valid and ready.

- [x] Reused the retained Azure manifest and existing archive importer for local NC 2017E1 replay: 12/12 bill records imported with no failures. Exact source bytes retained locally; no production writes or invented fuzzy dates.
- [x] Historical local content replay completed for NC 2017E1: 32/32 documents processed, 12 bill embeddings and 81/81 section embeddings. This matches the bounded production coverage counts for that session, without proving query-time search or input freshness across other sessions.
- [x] Content worker and gated Trigger payload now accept an explicit historical session, normalized through the canonical session identifier helper. Default current-session behavior remains unchanged; per-session checkpoints/leases are separate.
- [ ] Sustained current-content continuation is active (up to 1,000 bounded invocations per state, two bill pipelines each), stopping on failed batches. Historical content acceptance is proceeding independently; do not duplicate the active workers.

The completed historical replay selected the exact retained NC 2017E1 manifest entry and used the shared checkpointed
importer. Continue historical content with `pnpm tool openstates/run-openstates-content nc 2 8 2017E1` when needed.

- [x] Added within-state bill fan-out (1–4 concurrent bills) under one state lease/checkpoint, with exact-target document leases and shared database-backed publisher throttling. A failed bill stops new admission and active siblings drain before releasing the state lease; regression tests cover that failure boundary.
- [x] NC live eight-bill samples: concurrency 1 took 14.0 seconds, 2 took 8.0 seconds, 4 took 7.0 seconds; all succeeded. Different source documents make this directional evidence, not a controlled speedup or full-backfill ETA. Two concurrent bills is the conservative operating default.
- [x] Alaska eight-bill samples also succeeded: 112.0 seconds at concurrency 1 (two OCR documents), 9.3 at 2 (zero OCR), 8.9 at 4 (two OCR). Workload/provider variance prevents attributing that entire difference to concurrency. Both states continue at two bill pipelines each; four-way samples showed little additional benefit. Database observations showed zero blocked sessions and approximately 5% CPU during one sample.
- [ ] Ten eight-bill continuation batches per state are running with concurrency two; do not overlap another coordinator for either state. No hosted activation occurred.
- [ ] Fan-out verification: 30 focused tests and scoped lint passed. Final `pnpm verify` stopped on concurrent regulations integration-test type errors (missing third arguments at lines 259 and 291), not on the state changes. Full verification must pass again before closure.
- [x] Added `pnpm tool openstates/inspect-openstates-content`: a local-only, repeatable-read, read-only inventory of document outcomes, routed embedding gaps and vector-index validity. It explicitly leaves freshness, lexical/API/MCP, hosted recovery and source-completeness gates unverified.
- [x] Added a bounded persistent carry-forward queue for incomplete per-bill embedding passes. These bills resume on the next batch rather than waiting for an entire state scan; scope/duplicate guards cover every carried ID, and a full queue cannot falsely complete a scan round.
- [ ] Closure work begun: 25 further bounded content invocations per state. Do not overlap a running per-state worker. Source completeness (NC upper-district gap; Alaska held people/committees and vote/event limitations), automatic hosted recovery/handoff and search acceptance remain separate gates.
- [x] Those two 25-invocation continuations completed successfully. At 10:54 UTC: NC 204 processed/5,988 pending documents; Alaska 226 processed/14,837 pending, 25 OCR processed and one unsupported. All processed documents have sections. Existing sections still missing routed embeddings: NC 331, AK 74; bills missing routed embeddings: NC 2,236, AK 746. Existence does not prove input freshness. Both local bill/section HNSW indexes are valid and ready.
- [x] Live carry-forward acceptance: NC HB1092 continued then cleared its pending entry; Alaska HB187 continued over successive batches and cleared. The queue remains bounded and persisted with the scan cursor.
- [x] 10:38 UTC check-in: no local content processes, held database leases or active/queued Trigger runs before continuation. Started ten bounded invocations per state, with separate jurisdiction leases and local-only writes.
- [x] Hosted worker now rejects recorded failed/partial results at its own task boundary, allowing task retries instead of returning a false successful task. Successful batch evidence is preserved; seven focused worker/policy tests passed. This does not close interrupted-attempt recovery or authorize activation.
- [x] Check-in continuation snapshot: NC 108 processed documents, 54 bill vectors and 304 passage vectors; Alaska 140 processed documents, 70 bill vectors and 348 passage vectors, including 15 OCR documents. Pending documents: NC 6,084 and Alaska 14,923; Alaska retains one unsupported outcome. No production writes.
- [x] Latest closure-report/carry-forward verification: focused tests (ten), service/web types and live report/replay checks passed. Final `pnpm verify` passed with 2,999 legislation tests, 124 conditional skips and four receiver tests. The earlier concurrent regulations lint blocker is no longer present.
- [x] Added a shared bounded NC/AK content worker using durable canonical pending/freshness state and leased per-state scan checkpoints. It resumes without requiring a live scraper callback and explicitly reports ingestion/search as incomplete.
- [x] First content-worker batches ran on two bills per state, processed source documents and generated missing embeddings. Separate saved cursors were verified in PostgreSQL.
- [x] Alaska real OCR canary: existing `leg-dev-document-intelligence` processed three pages into 3,470 text characters on the same document; a section embedding then completed.
- [ ] Connect the content worker to automatic scraper/hosted orchestration and finish bounded backlog continuation; this local worker is not production activation.
- [x] Final repository verification for the shared state worker and gated Trigger entry points passed (`pnpm verify`, exit 0), including the previously interrupted route/coverage checks. Focused worker/controller tests: six passed.
- [x] Added bounded `openstates-content-worker` and `openstates-content-controller` tasks, reusing the shared processor. Activation defaults closed via `OPENSTATES_CONTENT_ENABLED_STATES`; no hosted deployment, activation or scraper dispatch is claimed.
- [x] Configured PDF.js's installed image decoders for OCR eligibility. A retained Alaska HB118 JBIG2 PDF now replays as `ocr-required` without the missing-decoder warnings. Focused extraction/worker/controller tests: 24 passed.
- [ ] Hosted interrupted-attempt recovery and automatic producer handoff still require acceptance.
- [x] Parallel local continuation exposed and fixed a global document-lease collision: unpartitioned exact-jurisdiction jobs now use separate jurisdiction leases. A regression test verifies both lease and processor scoping. NC resumed from its unchanged failed-batch cursor.
- [x] Local ranked-search database provisioned separately as `legislation-openstates-passage-local`, pinned ParadeDB 0.25.9 on localhost 55433; canonical PostgreSQL remains unchanged. Full NC/AK current-session passage copy and service-level lexical smoke passed on September 15. HTTP/MCP acceptance remains open.

A finite local continuation (ten NC/AK pairs, two bills per invocation) completed after canary acceptance:
NC had 44 processed documents, 22 bill vectors and 142 passage vectors; Alaska had 45 processed documents,
22 bill vectors and 95 passage vectors, including two OCR-processed documents. These are local coverage snapshots.
A further ten bounded invocations per state were started concurrently, one process per state, with the approved OCR
endpoint configured. Do not overlap these processes with another content worker for the same state.
Alaska completed that continuation; NC stopped on the shared document-lock collision after two invocations.
After fixing jurisdiction lease scoping, four further invocations per state were started for concurrent acceptance.
Both completed successfully. The post-run local snapshot has NC 68 processed documents, 34 bill vectors and
201 passage vectors; Alaska 100 processed documents, 50 bill vectors and 233 passage vectors, including 12
OCR-processed documents. Pending counts are NC 6,124 and Alaska 14,963. One Alaska document remains explicitly
unsupported (insufficient text and no detected raster image), not counted as processed. Full ingestion remains open.
It resumes from saved state cursors, not from an assumed completed scrape callback.

Local continuation: `pnpm tool openstates/run-openstates-content <nc|ak>`.
It defaults to eight bills with two concurrent bill pipelines, two document candidates per bill and bounded embedding pages per invocation.
Optional positional arguments are concurrency (1–4) and bill limit (1–10): `tools/openstates/run-openstates-content.ts nc 2 8`.
Configure `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` with the approved existing endpoint for OCR; provider authentication
uses the existing Azure credential chain. Missing OCR configuration stays visible in the saved outcomes.
Scan rounds restart for late OCR/source updates; a completed scan is not a coverage or search-readiness assertion.
At the first verified worker/OCR snapshot, NC had four processed documents and Alaska five; the remaining pending
counts were 6,188 and 15,059 respectively. No production writes occurred.

- [x] Isolate targeted embedding checkpoints by exact target IDs and product set; reject unscoped products and empty targets.
- [x] Completed targeted passes recheck freshness for later source/OCR changes; incomplete passes keep their continuation cursor.
- [x] Native extraction canary through shared document processor: one NC document/one section and one Alaska document/two sections persisted locally.
- [x] Paid embedding canary: two Voyage 4 bill vectors (1,024 dimensions) and three OpenAI Small section vectors (1,536 dimensions).
- [x] Identical embedding replays skipped all five current vectors and inserted none.
- [x] Final repository verification passed: 2,966 legislation tests passed, 124 conditional skips, and four receiver tests passed. Focused derived-processing suite: 20 passed.
- [ ] Durable automatic scraper-to-content handoff, full backlog and lexical/API/MCP acceptance remain open; the OCR canary passed above.

The temporary content smoke harness covered one pending document and bounded embedding candidates, then was removed.
Use the durable content coordinator above for further processing.
The initial inline CJS invocation failed module resolution before text extraction; the normal module command succeeded.
Those attempts used the existing durable retry policy, not a manual content overwrite.

- [x] Alaska live bounded extraction through shared runner: HB1/HB2, eight retained and replayed files; Linux Python tests passed.
- [x] Alaska HB1/HB2 read-only normalization: source-qualified sponsorship observations remain distinct without name matching.
- [x] NC frozen local cycle: 2,338 bills in 235 promoted batches, zero pending and zero unreleased batch holds.
- [x] Alaska frozen discovery and shared promotion wiring: 856 records/87 batches; first ten bills promoted locally.
- [x] Alaska staged concurrent acceptance: two and four workers passed; eight-worker failures drained safely and passed on lower-concurrency retry.
- [x] Alaska frozen-cycle local import: September 15 09:20 UTC confirmed 856/856 records in 87/87 promoted batches; importer exited successfully. Events remain disabled pending independent validation.
- [ ] Alaska downstream processing: the initial snapshot had 15,064 pending documents and no extracted sections or bill embeddings. Processing has advanced as recorded above; finish the backlog and lexical/API/MCP acceptance before readiness.
- [ ] Alaska vote detail: implement/validate journal voter extraction; current pinned scraper emits totals only.
- [x] Committee dependency planning holds complete affected rosters and propagates parent holds deterministically.
- [x] Wire eligible committee plans to atomic, observation-only promotion; Alaska local replay retained stable IDs for
  20 committees and 136 memberships, omitting 13 held committees and 97 assertions.
- [ ] Verify committee API/MCP results and close source completeness gaps before production activation.
- [x] Local Alaska membership HTTP acceptance: 20 organizations and 136 memberships, paginated canonical mapping,
  incomplete-roster warnings for current and historical queries, and 422 guards for all 20 incomplete detail profiles.
- [ ] Complete committee detail acceptance and MCP acceptance; observation-only HTTP success is not full readiness.
- [x] Local MCP SDK/HTTP-adapter checks: 54 canonical person lookups and 20 typed incomplete-organization guards.
- [x] NC shared local replay and acceptance: 506 people, 581 terms, 94 committees, 1,678 memberships; HTTP passed,
  168 MCP person lookups passed, 94 incomplete-detail guards passed. Current upper district 1 remains missing.
- [x] Preserve explicit source homepage links without claiming complete profiles: 73 NC and 18 eligible AK committees
  now retain website URLs locally; invalid/ambiguous links are reported rather than guessed.
- [x] Serialize people/committee imports per checkpoint stream and reject older retrieval observations or conflicting
  revisions at the same observation timestamp before canonical writes. Same-snapshot retries remain permitted.
- [x] Wire verified bounded NC bill archives to the atomic writer, session ownership check and immutable receipt.
- [x] Add the leased batch coordinator and token-checked release; twenty-one focused tests passed, including nine real
  PostgreSQL checks. The coordinator requires an adapter that stops its worker before resolving or rejecting.
- [x] Implement the local pinned-image Docker adapter, shared checked directory reader and shutdown-confirmation guard.
  Network-disabled container smoke retained failure evidence and confirmed removal; no canonical writes.
- [x] Fresh-source leased local canary: H1-H10 extracted, archived, promoted atomically and replayed stably. Initial
  stale-runner image was rejected, then refreshed offline; source-only sponsor/voter references remain unresolved.
- [x] Read durable per-cycle promotion receipts and validate exact pending batches. Local cycle: 1/235 batches and
  10/2,338 bills promoted; 234 batches pending. This is read-only resume inventory, not an activated dispatcher.
- [x] Connect one-batch local resume with post-lease receipt recheck and durable-result verification. Live resume
  advanced to 2/235 batches and 20/2,338 bills; 233 batches remain. Automatic scheduling is not enabled.
- [ ] Finish durable cycle scheduling, full-session execution and remaining acceptance before activation.
- [x] Persist confirmed-release ownership before scraper execution; unconfirmed workers block takeover after expiry.
  Only matching-token release clears the hold. Runtime containers carry a run-ID label for recovery inspection.
- [x] Provide local operator recovery requiring matching host, executor absence, original Docker daemon identity,
  no remaining run-labeled container and token-checked release. Real child-process hold/recovery smoke passed.
- [x] Bind actual Docker execution/shutdown checks to the claimed daemon identity. Local live cycle advanced to
  210/2,338 bills across 21/235 batches, leaving 214 pending; no production activation.
- [x] Add bounded sequential cycle processing that reuses resume, stops on failure, reports each durable result and
  reserves a full ownership window before admitting more work. Local two-batch acceptance committed H51-H70 and
  stopped at the configured limit; H71-H80 are next. Twenty-eight focused tests passed.
- [x] Replace extraction-wide session serialization with batch ownership and short same-inventory admission locking.
  PostgreSQL acceptance covers concurrent promotion, duplicate claims, conflicting inventories and expired shutdown holds.
- [x] Add configurable 1–8 worker waves that drain all admitted work before surfacing a failure; no replacement wave
  starts after a failure. Local recovery locates the exact batch ownership record by run token.
- [x] Live 2/4/8-worker stages passed at approximately 30/49/83 bills per minute. Eight workers selected for sustained
  local processing; differing bill complexity means these are directional measurements, not a controlled speedup claim.
- [ ] Cloud executor/runtime recovery and automatic activation remain unverified; local process checks do not establish
  termination of a hosted Trigger execution.
- [ ] Hosted MCP authentication and successful source-complete committee details remain unverified for this rollout.

People ingestion supports [non-destructive partial imports](openstates-people-quarantine.md). Source defects quarantine
individual people instead of blocking all valid people. Older whole-roster rejection notes are superseded only for
additive people/history imports; directory replacement, runtime activation and completeness gates remain unchanged.

Scope: finish North Carolina while onboarding Alaska with shared logic and state configuration. The user waived the
seven-day expansion delay on September 14; state-specific acceptance still gates activation. A checkbox means the pilot requirement has
passed real-data validation and required persistence/replay checks, not merely that code exists. No automatic national
rollout. California and credentialed jurisdictions enter last, after their current requirements are checked.

## Data requirements

The complete ordered task list is [Jurisdiction onboarding queue](openstates-jurisdiction-onboarding.md).

| Complete | Data type | Pilot acceptance | Historical scope and limitations |
| --- | --- | --- | --- |
| [ ] | People and external identifiers | Current roster, exact OCD person IDs, aliases, deduplication | Import available retired people and identifier history; inventory date coverage first. |
| [ ] | Legislative service and districts | Chamber, district, party, source-supplied terms | Preserve supplied dates; unknown dates remain unknown. |
| [ ] | Committees and subcommittees | Identity, chamber, hierarchy, source links | Inventory prior snapshots; current files do not establish complete history. |
| [ ] | Committee memberships | Every member resolved; separate return tenures; safe departures | Reconstruct only available dated observations; detected dates are not actual appointment dates. |
| [ ] | Bills and resolutions | Current-session extraction and canonical reconciliation | Retained session archives; report available sessions per state. |
| [ ] | Bill actions and status | Ordered actions and source dates | Coverage follows available bill archives. |
| [ ] | Sponsorships | Sponsor relationships resolve to canonical people | Coverage follows available bill archives and identity resolution. |
| [ ] | Votes and individual positions | Roll calls, totals, member votes reconcile | Inventory session coverage and unavailable individual votes. |
| [ ] | Bill versions and documents | Source links, text extraction, OCR when needed, search indexing | Inventory downloadable versions; unavailable source files remain visible gaps. |
| [ ] | Bill relationships | Referrals, related bills, committee links where supplied | Do not infer absent relationships from names alone. |
| [ ] | Meetings and events | Supported event scraper, dates, participants and documents | Measure upstream archive reach; do not promise all past meetings. |
| [ ] | Agenda items | Ordered items and explicit bill relationships | Only source-published agendas; not inferred outcomes. |

## Operational requirements

- [x] Select North Carolina and identify immutable source revisions.
- [x] Compare the retained August 17 nationwide archive manifest against live import checkpoints.
- [x] Complete a validation-only people/committee run with no unresolved relationships.
- [ ] Independently reconcile roster completeness, including the 49-person Senate snapshot.
- [x] Diagnose missing Senate District 1 and reject incomplete or duplicate district coverage.
- [x] Replay the retained pilot offline with file checksums and source-tree completeness checks.
- [x] Inventory all pinned NC retired-person files and report missing service dates without inferring them.
- [x] Check retained historical dates for calendar validity, reversed dates, and strict full-date tenure overlaps.
- [x] Implement immutable archive publication and verify local read-back, idempotency, and corruption rejection.
- [x] Archive the current people/committee pilot in Azure `state-sources` and verify remote read-back and rejection preservation.
- [x] Archive the retired-person history in Azure and reproduce the inventory from checksum-verified remote files.
- [x] Inventory legislative roles from current and retired files together, preserving source paths and unknown dates.
- [x] Run entity transaction integration tests against isolated local PostgreSQL, including historical term protection.
- [ ] Package and validate the upstream bills/events extraction runtime.
- [x] Build the pinned local acceptance image and pass offline startup for both NC lanes.
- [x] Complete real NC event extraction and retain checksummed artifacts in Azure.
- [x] Bound bill attempts to explicit identifiers and complete a real two-bill batch with Azure read-back.
- [x] Validate stable staging identities for bills, roll calls and official NC meeting notices.
- [x] Freeze and archive the live two-chamber bill inventory with bounded batch planning and replay checks.
- [x] Correct NC AM/PM vote parsing and confirm a new live scrape against official published times.
- [x] Verify build inputs before extraction, retain their fingerprint, and accept corrected vote clocks only on approved-build archive replay.
- [x] Verify atomic bill-batch receipts in isolated PostgreSQL: concurrent replay, conflicting evidence, late-write rollback and successful retry.
- [x] Preserve omitted bulk child collections per bill; verify explicit empty replacement independently in a mixed PostgreSQL batch.
- [x] Verify opt-in retention of existing action/vote organization links and exact voter-observation resolutions, without name matching or premature receipts.
- [x] Preserve exact sponsor resolutions and observation bounds; reject ambiguous identity replacement without name matching.
- [x] Validate exact frozen-batch scope and reject a successful subset canary as whole-batch completion.
- [ ] Retain raw artifacts durably and make replay reproducible.
- [ ] Promote atomically with correct tenure reconciliation and checkpoint handling.
- [ ] Verify retries, timeouts, publisher throttling, and non-overlap in Trigger.dev.
- [ ] Validate API/MCP reads and representative ID mapping after import.
- [x] Remove the fixed seven-day expansion delay as requested; retain acceptance and ongoing monitoring per state.
- [ ] Inventory ordinary states and onboard them individually, starting Alaska alongside NC completion.
- [ ] Add credentialed jurisdictions and California's special database runtime last.

## Result history

### 2026-09-14: Alaska onboarding and shared people validation

- [x] Reused the existing people/committee downloader and validator with explicit NC/AK profiles; no duplicated state importer. Alaska uses lower districts 1–40 and upper districts A–T, checked against https://www.akleg.gov/basis/commbr_info.asp.
- [x] Downloaded and validated the pinned Alaska source: 60 people (40 lower, 20 upper), 33 committees, 233 memberships, zero unresolved IDs and zero district coverage issues. This is pinned-snapshot validation, not independent verification of current membership or a production import.
- [x] Retained raw source files, checksums, source tree, report and normalized output at `artifacts/openstates-pilot/1789428291315-cdd9b259-4d7d-464c-8ff0-46c7c05f3c59`.
- [x] Thirteen focused validator/import tests passed, including Alaska lettered districts and rejection of cross-state paths and committees.
- [x] Full `pnpm verify` passed; legislation reported 2,775 passing tests and 103 conditional skips.
- [ ] Alaska archive promotion, historical coverage, bounded bills/events runtime and API/MCP acceptance remain open. NC coordinator wiring also remains open.

### 2026-09-14 23:13 UTC: transactional batch ownership

- [x] Implemented database-clock ownership claims, single-winner concurrent acquisition, bounded expiry, and rejection of renewal of an expired token.
- [x] Added opt-in ownership checks to bulk bill promotion under a row lock and again after receipt insertion. Expiry during writes rolls back canonical data and receipt together.
- [x] Eight isolated PostgreSQL tests passed, including deterministic mid-insert expiry, stale-writer rejection, takeover after expiry, and idempotent claims without deadline extension. Both application type checks passed.
- [x] Full `pnpm verify` passed: legislation reported 286 passing test files and 2,774 passing tests, with 103 conditional tests skipped. The eight ownership/receipt integration tests passed separately against local PostgreSQL.
- [ ] Live coordinator claim/dispatch/promotion wiring, cycle ordering, source concurrency control and production activation remain open. These primitives alone do not serialize live scraper execution.

### 2026-09-14 23:07 UTC: immutable dispatch validation

- [x] Implemented create-only dispatch records binding an attempt ID to a verified frozen inventory and exact batch. Identical publication is idempotent; conflicting reuse is rejected.
- [x] Preparation now requires the matching dispatch and rejects another attempt, another batch, future execution windows and expired attempts. Windows are positive and capped at thirty minutes.
- [x] The 25 focused archive/mapping/planner tests and both application type checks passed.
- [ ] Full `pnpm verify` passed static checks but failed during coverage generation because `coverage/.tmp` was removed during execution. A clean non-overlapping coverage run is still required; database integration tests were skipped in this run.
- [ ] Dispatch records are not locks. Durable exclusive ownership and a final freshness check inside the canonical import transaction remain required; no production scraping or imports were activated.

### 2026-09-14 22:52 UTC: archive-to-batch preparation

- [x] Added read-only preparation linking the frozen inventory and exact batch scope to the checksum-verified archive and separately approved scraper build.
- [x] Preparation records the digest of the same manifest bytes used for validation; it returns `prepared`, never `promoted`, and performs no canonical writes.
- [x] All 25 focused archive, mapping and frozen-inventory tests passed, including wrong-batch, unapproved-build and invalid-time rejection.
- [ ] Coordinator dispatch freshness, lease ownership, transactional promotion and production activation remain open. Preparation alone does not establish freshness or authorize an import.
- [ ] Repository verification remains blocked: this run stopped on lint errors in concurrently edited regulations code, including `fr-metadata.ts`. Those unrelated changes were left untouched.

### September 14, 22:29 UTC check-in

The separate regulations task is active and changing shared schema/migration files. No local Open States scraper
process or active session in the isolated test database was observed; no database write or overlapping worker was
started. The dependency-ready frozen-batch validator was implemented instead. Five planner tests passed. A replay of
the retained S1092 canary against the live frozen inventory correctly rejected it because its batch also requires S1091.
The validator is not yet coordinator integration or proof of extraction freshness for a cycle.

Full `pnpm verify` was attempted and failed on three unlisted `tiny-invariant` imports in the concurrently developed
regulations files (`import-normalized.ts`, `storage.ts`, `storage.integration.test.ts`). Those files were preserved.
Production import, Trigger runtime activation, current roster completeness and seven-day acceptance remain open.
The authenticated Trigger check returned no executing, queued or waiting runs in the accessible environment.
Production PostgreSQL sessions were not verified during this check-in; no production database connection was available
in this process. This is not a claim that all remote database work is idle.

### Current four-item closeout status, September 14

| Item | Status | Remaining acceptance |
| --- | --- | --- |
| Stable mapping | Partial: tested staging adapters; live bills/votes and three meeting notices validated; approved-build clock replay verified | Reconcile canonical relationships and integrate the write path |
| Automated coordination | Partial: immutable live inventory and tested resume planner | Deployed Trigger children, durable promotion receipts, leases, recovery and source throttling acceptance |
| Safe import | Partial: atomic bill/receipt primitive verified in isolated PostgreSQL; no production writes | Wire verified scraper batches with relationship preservation, historical committee promotion and roster gate |
| Production acceptance | Open | Approved runtime activation, authenticated API/MCP reads and seven actual observation days |

New evidence: the live NC `2025` feeds contain 1,246 House and 1,092 Senate bills (2,338 total), partitioned into
235 batches. Raw XML and a frozen plan were uploaded and verified at
`openstates/scraper-plans/nc/2025/nc-discovery-20260914-cycle1/plan.json`. No batches were automatically launched.
Each cycle gets its own identity, so receipts for unchanged bill identifiers from yesterday cannot suppress today's
refresh. Tests reject another cycle's receipts, incomplete promotion, feed conflicts and corrupt replay.

The two-bill retained canary maps to `bill:nc:2025:sjr:1091` and `bill:nc:2025:sb:1092`, with four stable roll calls.
All 336 name-only vote positions remain unresolved and create zero people. No name-only person mapping was added.
The live calendar's official notice numbers 10724, 10725 and 10726 now survive extraction and map to stable event IDs.
The seven-file event run was archived/read back at the scraper revision prefix under
`nc/events/nc-events-notice-canary-20260914/retained.json`; local directory `openstates-nc-myh3fu_0`.

Clock diagnosis: a PowerShell display converted source offsets to the workstation timezone; that was not a scraper
timezone bug. Separate inspection confirmed a genuine AM/PM parser bug (`%H` with `%p`). The official SB 1092 page
lists 6:07 p.m. and 4:53 p.m.; old raw records contained 06:07 and 04:53 Eastern. The corrected `%I` parser produced
18:07 and 16:53 Eastern in a new live scrape. Its seven files were archived/read back under
`nc/bills/nc-vote-clock-canary-20260914/retained.json`; local directory `openstates-nc-fc17e5xj`.
Do not shift old timestamps by a guessed offset. Re-scrape and verify corrected build provenance.

Follow-up provenance acceptance: the runner now reconstructs its source inputs from the pinned archive and exact
source policy before starting the subprocess. It records the verified build-input manifest SHA-256 in the attempt.
Archive replay accepts clocks only when this fingerprint equals a separately supplied deployment-approved fingerprint;
missing fingerprints, other builds, failed attempts and changed raw bytes fail closed. Old evidence remains readable,
but the ordinary raw mapper still withholds its clocks.

A fresh SB 1092 extraction (`openstates-nc-oqh5gzuq`) retained seven files in the local immutable
`artifacts/openstates-runtime/provenance-archive` store, at the revision prefix under
`nc/bills/nc-provenance-canary-20260914/retained.json`. Approved fingerprint:
`11089591d74e926aea1bc98ecb0991bb0fb2c7512d1774e7311a630c44067274`.
Replay produced `2026-08-04T22:07:00.000Z` and `2026-07-28T20:53:00.000Z`, matching the previously checked official
Eastern times. Its 168 name-only positions remain unresolved. This run used the current adapter mounted read-only into
the pinned local acceptance image; it is not evidence of a new published image or production deployment.
The provenance subtask passed 23 focused TypeScript tests, 29 Linux Python tests, focused lint and service type-check.
The subsequent full `pnpm verify` completed successfully (including coverage), superseding the earlier unrelated lint
failure below. Database-dependent tests skipped by their environment are not production acceptance evidence.

The clock-corrected local image built successfully with config digest
`111845cb109225b18cb749360d6b2521dfde5351998092580eb02c967491de45`; offline startup and 28 Python tests passed.
Eight focused TypeScript mapping/planning tests and the service type-check passed. Full `pnpm verify` was attempted
but is not clean: concurrently changed regulations files failed lint (`artifact-backfill.ts` and
`tools/regulations/plan-regulatory-backfill.ts`, nested ternaries). Those files were not changed by this work. Shared bill-write
code also has concurrent edits; no overlapping changes or production deployment were made. This evidence does not
close the four items or start the observation clock.

| Date | Run or change | Result | Production effect |
| --- | --- | --- | --- |
| 2026-09-14 | Source inventory at people revision `677c6d0a566ad9bd62b6324e502af76acc3d22f3` | 169 NC legislature files and 94 committee files discovered; not yet evidence of complete coverage. | None. |
| 2026-09-14 | Validation-only run `1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42` | Passed: 169 people (120 lower, 49 upper), 94 committees, 1,678 memberships, zero unresolved member IDs. Raw YAML and checksums retained. This is identity/structure validation, not independent roster completeness. | No database writes or schedules. |
| 2026-09-14 | Adapter verification | Five focused tests and legislation type checks passed. Root checks passed; full verification stopped on an unrelated Shopify size-chart test timeout (5 seconds). | None. |
| 2026-09-14 | Independent Senate District 1 check | Official NCGA roster and biography list Jerry Tillett, appointed September 3, 2026. The latest pinned Open States snapshot lacks District 1. This is a source omission, not a current vacancy. No identity was invented. | Promotion remains blocked. |
| 2026-09-14 | Completeness gate and offline replay | Seven focused tests passed. Replaying all 263 retained files now correctly returns `rejected`, with `upper/1/count=0`, despite zero unresolved committee member IDs. The earlier validation result covered structure/identity only. | No database writes. |
| 2026-09-14 | Historical file inventory | Pinned NC directory also contains 358 retired-person files. Their term coverage and date ranges are not yet validated; file count is not historical completeness. Four executive and 21 municipal files are outside this legislative pilot. | None. |
| 2026-09-14 | Historical content inventory `1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75` | Parsed all 358 retired files: 334 people with 362 NC legislative roles. Earliest supplied start 2003-01-01, latest supplied end 2026-08-24. 114 roles lack starts; zero lack ends; no partial dates or reversed equal-precision dates found. These extrema do not prove continuous coverage since 2003. | Raw files and checksums retained locally; no canonical writes. |
| 2026-09-14 | Activity check | No local pilot process was active before this run. Recent Trigger results showed passage synchronization executing; it was left untouched. Direct PostgreSQL status could not be read because connection/query failed. Only isolated local validation was run. | No remote jobs launched or modified. |
| 2026-09-14 | Historical inventory verification | Four focused history tests passed. Root static checks passed. Legislation suite: 2,643 passed, 74 skipped; four receiver tests passed. Full `pnpm verify` with `TURBO_CONCURRENCY=2` still running (local session 8182); do not start a duplicate verification. Shopify tests passed this run. | No deployment. |
| 2026-09-14 | Verification completion | Previous full `pnpm verify` exited successfully with `TURBO_CONCURRENCY=2`; all nine test tasks passed. Session 8182 is finished. | None. |
| 2026-09-14 | Historical date validation | Eight focused tests passed before final lint correction. Checksum-verified offline re-read of all 358 files found no impossible dates, reversed dates, or strict full-date overlaps in the 362 legislative roles. All 114 unknown starts remain unknown. Same-day transitions are allowed; unknown-date overlap cannot be determined. | No database writes. |
| 2026-09-14 | Date validation final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`. Legislation: 2,647 tests passed, 74 skipped, plus four receiver tests passed. Session 16696 finished successfully. | No deployment or remote job changes. |
| 2026-09-14 | Archive implementation and local canary | Four archive tests passed. Copied 263 YAML files plus tree/report metadata (265 objects) to an isolated local archive; verified read-back and reproduced the expected missing-seat rejection. No overwrites; a completion manifest is written last. | No canonical writes. Azure verification pending. |
| 2026-09-14 | Azure archive canary | All 265 objects uploaded to the existing `state-sources` container and read back with verified hashes. Completion marker: `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/entities/1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42/complete.json`. Replay correctly remains rejected for missing upper district 1. | New immutable source artifacts only; no canonical database writes, permissions changes, or deployments. |
| 2026-09-14 | Archive final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`: legislation 2,651 passed, 74 skipped, four receiver tests passed. Session 98539 completed. | No deployment. |
| 2026-09-14 16:30 UTC | Activity check | No local onboarding process was active. Recent Trigger results showed passage synchronization run `run_06ga1g92e5oj044spnf2tp6n01` executing; left untouched. Database activity remains unavailable after connection/query failure. | No remote jobs started or interrupted. |
| 2026-09-14 | Historical Azure archive and replay | Archived 358 retired YAML files plus tree/report metadata, then verified remote checksums and re-ran the inventory: 334 people, 362 roles, 114 unknown starts, no date issues. Seven archive tests passed, including rejection of mixed current/history lanes. Manifest is under `nc/history/1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75/complete.json` at the pinned people revision. | Immutable Blob artifacts only; no canonical writes. Historical completeness remains unproven. |

Historical archive final verification: full `pnpm verify` passed with `TURBO_CONCURRENCY=2` on September 14, 2026.
Legislation: 2,654 passed, 74 database-dependent tests skipped, plus four receiver tests passed. Session 94677 finished;
no archive or verification process remains active from this check-in. No deployment or canonical import occurred.

Combined people inventory, September 14, 2026: checksum-verified 169 current and 358 retired files (527 total).
They contain 503 people with 577 NC legislative roles; earliest supplied start is 1996-05-09, not the retired-only
2003 minimum. There are 120 missing starts and 169 open ends, with no date issues. Open ends in current files are
not flagged as retired-source errors. No dates were inferred and no canonical records were written. Ten focused
history tests passed. This confirms why a history import must include current people, not just the retired folder.
Current/retired duplicate identities are rejected for review, and every role retains its source file path.

At the 17:01 UTC activity check, no local onboarding process was running. Recent Trigger results showed
`congress-wave-coordinator` and passage synchronization active; neither was modified. Database activity remained
unavailable. The existing current-person normalizer emits one current term; full source-role promotion is still pending.

Live archive audit, September 14, 2026: `DATABASE_DIRECT_URL` successfully supports read-only queries; the pooled
`DATABASE_URL` returned PostgreSQL `08P01`. The database has 627 non-federal sessions across all 52 supported
jurisdictions. Every one of the 624 archives in Azure
`manifests/openstates/session-json-2017-onward-2026-08-17.json` has a matching `complete: true` checkpoint.
This proves completion against that retained manifest, not against newly published archives or every child record.
The public index returned HTTP 200 but no discoverable archive links, so latest-source comparison remains open.
Do not classify the other checkpoint streams as failed archive imports without identifying their lane.

NC bill counts match all eight completed archive checkpoint indices: 2017=1,953; 2017E1=12; 2017E2=8;
2017E3=9; 2019=2,109; 2021=2,095; 2023=2,005; 2025=2,338. No NC archive reload is indicated by these checks.
There are zero NC legislative-term rows. Nationwide, zero legislative terms and zero organization memberships have
`source_provider = 'openstates'`; source-null rows were not classified by that query. Organization source counts are
OpenStates=1, null=385, Congress=243, GovInfo=850. This distinguishes bill-history completion from entity-history
readiness. No production writes, reloads, or deployments were performed during this audit.

Combined history verification completed successfully: full `pnpm verify`, session 59475, 2,656 legislation tests passed,
74 skipped, four receiver tests passed. Subsequent archive audit changes are documentation-only.

Term mapping implementation, September 14, 2026: `people-term-plan.ts` maps the combined retained sources to 577
canonical term candidates, preserving 120 null starts. Identity excludes the end date and current/retired file location
so closing a term does not create a duplicate. Distinct starts produce separate identities; indistinguishable
unknown-start terms and partial-precision dates block normalization rather than being merged or rounded. Historical
party and office titles remain null until source-backed mapping exists. Three focused tests passed. This is a plan,
not a production import: people persistence and atomic promotion remain unfinished. Corrections to identity-bearing
start dates will require reconciliation, not blind upsert. The archive CLI reports planned term counts for historical
replay. Full verification passed in session 33745: 2,659 legislation tests passed, 74 skipped, and four receiver tests
passed. The session is finished. No production writes occurred.

People import implementation, September 14, 2026: `import:openstates-people` reads the two immutable Azure manifests,
verifies their lanes/checksums, prepares current and retired people plus terms, and defaults to validation-only.
Explicit `--apply` uses the existing transactional snapshot writer only after roster acceptance. People, terms and
checkpoint share one transaction; organization replacement is disabled and unobserved people/terms are preserved.
Protected term imports take a transaction advisory lock and reject reactivation of an existing ended term. Three
focused import tests passed. A database integration test covers preservation and ended-term rejection but requires an
isolated test database; it must never be pointed at production.

The real Azure dry run prepared 503 people and 577 terms, then exited 1 with `upper/1/count=0` and
`canonicalWrites=false`. This is the expected safety rejection, not a completed import. Atomic database integration
and positive production/API acceptance remain open. The directory-specific upstream committee history contains 51
commits at the pinned revision, from 2021-05-06 through 2026-08-27 (2021:8, 2023:2, 2024:15, 2025:16, 2026:10).
Commit dates are repository observations, not appointment dates; renamed/older paths and snapshot semantics still need
review before this becomes a historical-membership import. No committee history was written.
The oldest directory snapshot (`eb1a5ec1e1e3c137eac8bd869efea92e09241440`) has 60 committee files in a non-truncated
tree. Its sampled Agriculture file uses `parent: lower`, lacks the current jurisdiction/chamber fields, and contains
at least one `person_id: null` entry (B. Jones). Historical parsing therefore needs an explicit source-format adapter
and unresolved-ID reporting; the current snapshot validator cannot simply be reused, and name-only matching is forbidden.
This is one sampled file, not an all-committee historical audit.

Import implementation verification finished: full `pnpm verify` passed in session 51957, with 2,662 legislation tests
passed, 75 database-dependent tests skipped, and four receiver tests passed. No positive database-import acceptance
is claimed; the Azure rejected-source dry run completed without writes. Production remains gated by roster completeness
and isolated database integration verification.

Historical committee parser and real-data runs, September 14, 2026: raw files and checksums are retained under
`artifacts/openstates-committee-history/`. The parser supports explicit old `parent` chamber values, preserves multiple
different roles for one person, rejects exact duplicate assignments, and never derives departures or effective dates.
Missing person IDs are reported, not guessed. Year samples are not a complete replay of the 51 commits:

| Snapshot | Commit | Committees | Role entries | Missing person IDs |
| --- | --- | --- | --- | --- |
| 2021 | `eb1a5ec1e1e3c137eac8bd869efea92e09241440` | 60 | 1,027 | 12 |
| 2023 | `42887e2ad272ebee1461c831e9edd857a0987acd` | 93 | 1,522 | 142 |
| 2024 | `3f463a03b5bba4684badf4fd4d7528a4a335031d` | 98 | 1,507 | 0 |
| 2025 | `3bb3a7e04b87ec19a64f02718c88dd4a39d2579b` | 88 | 1,515 | 0 |
| 2026 | `cec7dd8d4a9febc709b07513823c84fb2e4fa36f` | 94 | 1,678 | 0 |

The 2023 initial parser rejected Norman W. Sanderson's separate co-chair and ex officio roles. After correcting that
assumption, checksum-verified replay of all retained files produced the above counts. Its original failure marker
remains; no successful download report was fabricated. Presence of person IDs is not canonical identity reconciliation.
Full `pnpm verify` passed after the correction (session 80730). All inventory processes finished; no production writes.

Read-only coverage audit: NC has 30,315 processed bill documents and one unsupported document, but zero legislative
events. State events exist in 14 other jurisdictions; federal events number 33,164. The pinned NC event scraper reads
the current legislative calendar and has no historical-window argument; it is not evidence of past-meeting coverage.

Local database verification remains blocked: test connection returns `ECONNREFUSED`. Starting Docker Desktop and
`docker desktop start` both failed to make the Linux engine available. Docker's backend log reports inability to rename
`sailor-ingest.sock` (Windows error 1920); moving that temporary socket failed and removal was blocked by execution
policy. No Docker reset, volume deletion, or database deletion occurred. User requested local Docker rather than an
external temporary database. Do not provision an external test database under the earlier unanswered request.

Docker recovery follow-up, September 14, 2026: after the user reopened Docker, engine 29.7.2 responded. Started the
repository's local pgvector PostgreSQL service with Compose; verified the target database was local `legislation_test`
with no other sessions before running the destructive test-fixture setup. All 20 entity integration tests passed.
The first pass exposed interference from the new test's unnecessary committee fixture; changing it to a people-only
fixture removed that interference. Existing membership tests and the new ended-term/absence safeguards all pass.
Only isolated test schemas were created/dropped; no production rows or Docker volumes were deleted. The local database
is left running for subsequent tests. Positive end-to-end source import is still blocked by the incomplete NC roster.
Final repository verification also passed: 2,667 legislation tests passed and 75 database-dependent tests were skipped
in the default run; the 20 entity integration tests were separately run with the local database enabled and all passed.
Session 3972 completed successfully. Four receiver tests passed as well.

Independent validation references (not additional ingestion providers):
[NC Senate roster](https://www.ncleg.gov/Members/MemberTable/S) and
[Jerry Tillett biography](https://www.ncleg.gov/Members/Biography/S/1003).
Do not bypass the incomplete-roster gate or fabricate an OCD identifier. Continue independent runtime/history work
while the approved Open States source is missing the member. A confirmed vacancy also needs an explicit reviewed
coverage policy; the validator does not silently interpret an absent district as vacant.

The temporary pilot validation, replay, inventory, and archive commands were removed after the retained evidence was
accepted. Output remains under ignored `artifacts/openstates-pilot/<run>/`. `report.json` reports validation and unresolved identities;
`failure.json` records interrupted downloads. The command has a ten-minute source deadline and 30-second request
timeouts. It calls the pinned Open States people repository, not the hosted Open States API. It cannot promote data.
The snapshot is current-state only; this first adapter does not yet import historical terms or retired people.
The separate history command inventories retired YAML into ignored `artifacts/openstates-history/<run>/report.json`,
including every source role and missing-date counts. It is not a history import and does not close the historical
coverage requirement. Historical party alignment and completeness still require review; overlap cannot be established
where source dates are missing. Date checks do not independently prove the source's assertions match real events.

The archive command also accepts `azure` as its destination and uses the existing `AZURE_STORAGE_ACCOUNT`, default
Azure credential chain, and `state-sources` container. It does not provision a container or change permissions.
The source run must have a complete tree/report and valid checksums; a rejected roster may be archived for diagnosis.
Objects use `openstates/people/<revision>/nc/entities/<run>/files/` and an immutable `complete.json` marker. Retry the
same run safely: identical objects are reused, conflicting bytes fail, and incomplete uploads have no new completion
marker. Read-back verifies the marker, file sizes, hashes, revision and tree coverage before running validation again.
Cloud archive success does not authorize canonical promotion or close roster completeness.
The optional `history` lane archives only retired-person files under `nc/history/<run>/`; replay selects the historical
inventory validator rather than the current-roster validator. Both lanes enforce complete source-tree coverage and
reject files from the other lane. Historical files and metadata are now durably retained, but importing their roles
and verifying historical coverage remain separate requirements.

See [the rollout milestones](../engineering/self-hosted-openstates-milestones.md) for the full activation gates. Election results,
candidates, and inferred committee outcomes are not added to scope by this checklist.

### Full people-import database verification (2026-09-14)

- [x] All 21 entity PostgreSQL integration tests passed against the isolated local `legislation_test` database.
- [x] The full North Carolina importer persisted 170 synthetic current people and one retired person with 171 terms.
- [x] Unknown start dates stayed null; the ended term stayed inactive; repeat import retained the same term IDs.
- [x] Removing a current seat rejected the subsequent import and left stored terms and the checkpoint unchanged.
- [ ] Production promotion remains blocked by the pinned source snapshot's missing upper-chamber district 1 member.

These are synthetic transaction tests, not evidence of historical source completeness. No production import was run.

### Historical committee identity audit (2026-09-14, 18:30 UTC)

No local onboarding command or database index build was active. The bounded Trigger query returned no executing or
queued runs. Existing services were left untouched. Checksummed committee samples were compared with all 503 retained
NC legislative people, using exact primary IDs only:

| Snapshot | Committee role entries | Missing member IDs | Non-null IDs absent from primary people IDs |
| --- | --- | --- | --- |
| 2021 | 1,027 | 12 | 22 entries across four people |
| 2023 | 1,522 | 142 | 4 entries for one person |
| 2024 | 1,507 | 0 | 5 entries for one person |
| 2025 | 1,515 | 0 | 0 |
| 2026 | 1,678 | 0 | 0 |

The retained Bobby Hanig and Sarah Crawford files explicitly declare two of the older IDs in `other_identifiers`.
The people importer now preserves that source field alongside `identifiers`, deduplicated by scheme and value.
This is source-declared identity evidence, not name matching. It does not yet resolve or promote historical committee
memberships; ambiguous identifiers must fail reconciliation. Three other distinct absent primary IDs remain to research.

- [x] Audit sampled historical committee references against retained people IDs.
- [x] Implement retention of source-declared former identifiers.
- [ ] Resolve remaining historical IDs and validate uniqueness before committee promotion.

Verification: four focused importer tests passed; full `pnpm verify` passed (2,668 legislation tests passed,
76 database-dependent tests skipped, four receiver tests passed). No production import or deployment occurred.

### Former legislators in other office folders (2026-09-14)

All three remaining non-null sampled committee IDs are explained by the pinned source: Jeff Jackson's primary ID is
in `executive`, Rachel Hunt's primary ID is there too, and Hunt's `other_identifiers` explicitly supplies her former ID.
No name-only mapping or manually invented identity was used. The history collector, validator and archive completeness
gate now include `retired`, `executive`, and `municipalities`; only NC upper/lower legislative roles become terms.

The complete replacement history inventory is
`artifacts/openstates-history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5`: 383 files, including 358 retired,
four executive and 21 municipal files. Combined with current legislators, 552 files contain 506 people with 581
legislative roles, 122 unknown starts and 169 open ends, with no date issues or conflicting source-declared person IDs.
The 21 municipal files add no NC legislative roles at this revision. These counts supersede the earlier 503/577 totals.

The older 358-file history archive and intermediate 362-file archive remain evidence, but do not satisfy the expanded
source-tree coverage gate and must not be used for promotion. Neither archive was overwritten or deleted.

- [x] Include former legislative service retained in other office folders.
- [x] Explain the three remaining non-null IDs using exact source IDs and declared former identifiers.
- [ ] Resolve committee entries with absent source IDs; historical completeness remains unproven.
- [ ] Promote current NC data only after the missing current Senate seat is resolved.

Twenty-two focused tests passed. Full `pnpm verify` passed: 2,669 legislation tests passed, 76 database-dependent
tests skipped, and four receiver tests passed. All 383 history files were archived in the existing Azure `state-sources`
container and remotely read back with verified checksums. The replacement manifest is
`openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5/complete.json`.
No canonical database writes or deployment occurred.

### Six-item automated NC closeout

The approved closeout covers the NC pilot, not nationwide activation. Keep each gate open until operational evidence
exists; a passing unit test is not a production import or seven days of observation.

| Gate | Required machine-checkable outcome | Status |
| --- | --- | --- |
| Source coverage | Complete current district roster; every historical discrepancy explicitly classified | Blocked on current source omission; historical identity reconciliation implemented |
| Historical committees | Repeatable exact-ID reconciliation; missing/ambiguous IDs reported; dated observations preserved | Implementation in progress |
| Production import | Canonical records and checkpoint commit together; replay stable; ended tenures protected | Local transaction tests passed; production not run |
| Extraction runtime | Pinned extraction-only build; bounded requests/runtime; immutable output and validation | Not deployed; user confirmed GPL review resolved |
| Recurring sync and reads | Lease/retry/failure drills and authenticated API/MCP acceptance on imported records | Pending runtime and import |
| Seven-day observation | Actual scheduled-run history satisfies the documented canary acceptance gate | Not started |

The user confirmed on September 14, 2026 that the planned deployment's GPL review is resolved. This clears the review
dependency, not the implementation obligations: retain notices/license, pinned corresponding source and modifications,
and apply the reviewed distribution policy to the scraper artifact. Runtime build and activation tests remain pending.

Historical identity reconciliation verified committee source-tree coverage and hashes, remotely verified both people archives, and resolved
only primary or explicitly declared former Open States IDs. It reports `missing_person_id`, `unknown_person_id`,
`ambiguous_person_id`, or `no_legislative_service`. The temporary reconciliation harness was removed after this review.

Real reconciliation canary: the retained May 6, 2021 snapshot, replayed against both checksum-verified Azure people
archives, resolved 1,015 of 1,027 role entries automatically. The remaining 12 have no source person ID and produce
`needs_review` with exit code 1. No database writes occurred. This replaces manual investigation for repeatable ID
matching, but does not yet implement membership promotion or establish complete historical coverage.

Reconciliation verification completed: three focused tests passed; full `pnpm verify` passed on retry with 2,672
legislation tests passed, 76 database-dependent tests skipped, and four receiver tests passed. The preceding coverage
run failed because its temporary coverage directory disappeared; no test failure was reported by that run.

### Extraction process boundary

`python/openstates_runner.py` adds the NC-only extraction launcher. It forces `--scrape`, an explicit bill session,
the pinned scraper revision, and a maximum 1,500-second runtime. Event extraction accepts no historical session claim.
The child receives an environment allowlist rather than database/cloud/Trigger credentials, runs in a private work
directory and Linux process group, and is killed with its descendants on timeout. Raw stdout/stderr are not forwarded
to task logs. An attempt result is retained; callers must archive and validate output before promotion or cleanup.

This is not yet a packaged upstream runtime: the pinned dependency build, build provenance verification, publisher
request hardening, artifact integration and Trigger wiring remain pending. `UPSTREAM_REVISION` is a build stamp checked
by the launcher, not independent proof of all packaged source bytes. The current command is `pnpm --filter legislation-ingestion test:python`; real
subprocess tests require Linux and use a local fixture module, not the NC publisher or production data.

Linux runner evidence: all five tests passed with networking disabled in
`python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`.
The tests exercised real child-process success, nonzero exit, and a one-second deadline, plus input validation and
credential exclusion. The disposable test container was removed; the downloaded base image remains locally cached.

### Pinned build inputs and output integrity

The [build preparer](openstates-runtime-build.md) retained 494 checksummed files locally in
`artifacts/openstates-runtime/locked-build-inputs`, including the complete pinned upstream archive, license,
source, dependency lock, and hash-locked requirements export. No upstream source was added to the TypeScript package.
An earlier preparation directory is incomplete and lacks `build-inputs.json`; it must not be deployed.

The runner now retains startup failures, rejects exit-zero attempts with missing or unsafe output, inventories output
hashes and byte counts, and keeps semantic acceptance explicitly false. This is not production import completion.

Build verification encountered external download failures: the configured npm registry returned HTTP 401, a public
npm metadata attempt failed its TLS handshake, and the isolated Linux pip dependency dry run exhausted retries with
a TLS handshake failure to `files.pythonhosted.org`. TLS verification was not disabled. Python dependencies and
the Trigger Python extension were not installed; image startup and deployment remain unverified.

Verification for this unit: all 12 Python build-input/runner tests passed in the network-disabled Linux container.
Full `pnpm verify` passed with all nine coverage task groups successful. This verifies local implementation, not a
live scraper build, production import, or the seven-day scheduled observation gate.

### Offline build replay verification

Package downloads were retried: Linux pip still failed TLS negotiation with `files.pythonhosted.org`, and a direct
Windows HTTPS request to public npm also failed SSL negotiation. No TLS checks or version pins were relaxed.

Added offline verification that reconstructs expected source and requirement files from the digest-pinned archive.
Missing, extra, linked, modified, and falsely re-checksummed files are rejected. Generated files now use identical
UTF-8/LF bytes on Windows and Linux. The portable build inputs are retained at
`artifacts/openstates-runtime/verified-build-inputs`. Cross-platform replay caught and fixed an additional difference:
path ordering now uses explicit POSIX-relative strings rather than platform-specific path comparison. Earlier
`portable-build-inputs` and `locked-build-inputs` directories predate the final portable manifest contract.
The real 494-file bundle prepared on Windows passed offline reconstruction and verification in Linux. All 15 Linux
tests passed; Windows passed 11 applicable tests with four Linux-only tests skipped. This does not clear the runtime
installation or deployment gates.

Full `pnpm verify` passed on retry with all nine coverage task groups successful. The first attempt failed when
Vitest's temporary coverage directory disappeared; no overlapping test process was found before retrying. The cause
of that intermittent coverage-directory loss remains undiagnosed and is not a scraper-runtime failure.

### Approved feed authentication and archive handoff

The user confirmed that the machine intentionally blocks public npm and approved refreshing the configured private
feed sign-in. The installed Microsoft `ado-npm-auth` tool refreshed Azure Artifacts authentication successfully.
The approved feed then returned and installed `@trigger.dev/python@4.5.10`. No registry change, public-feed bypass,
TLS weakening, or token disclosure was used. The user will provide the approved Python feed details; Python package
installation remains pending that information.

Trigger configuration now packages the standard-library adapter through the official Python extension. It does not
yet install upstream scraper dependencies, package the upstream source, or activate scraper tasks/schedules.

Added the TypeScript scraper-attempt archive/replay handoff and CLI. It validates lane/session ownership and runner
status, rejects unsafe/duplicate paths and checksum mismatches, verifies create-only uploads, and retains failure
status without advancing canonical checkpoints. Six focused archive tests passed. A live Azure failure-fixture
retention and replay succeeded twice at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/fixture-retention-20260914/retained.json`.
This fixture has zero raw files and is explicitly failed; it proves archive plumbing and identical retry behavior,
not a successful source scrape or production import.

A fresh GitHub check found the last NC legislature-source change still dated August 31, 2026. The current-roster
source omission therefore remains open; no identity was invented or coverage gate bypassed.

Verification: eight focused archive/configuration tests passed; full `pnpm verify` passed with 2,679 legislation tests
passed, 76 database-dependent tests skipped, and four receiver tests passed. No production deployment, canonical
import, or schedule activation occurred. Pending external input: approved Python package feed and authentication.

### Approved Python feed discovery and NC request hardening

The machine-wide `C:/ProgramData/pip/pip.ini` already configures the approved Microsoft Python feed at
`https://packagefeedproxy.microsoft.io/pypi/simple/`. Docker did not inherit that configuration. Explicitly passing
the existing feed allowed the locked package downloads, including the source-only `sgmllib3k==1.0.0` package.
The earlier pending-feed note is superseded: no additional feed information is required for this tested environment.
TLS verification and runtime dependency hashes remained enabled. A dedicated local Docker pip cache was retained.

The dependency dry run now exposes an upstream compatibility failure rather than a network failure:
`textract==1.6.5` declares `extract-msg (<=0.29.*)`, which pip 25.0.1 rejects as invalid metadata. Installation did not
complete. No older installer, unchecked install, or silently modified third-party distribution was substituted.
Source-only package build dependencies also need a pinned build toolchain before claiming reproducible installation.

Build preparation now applies exact-match reviewed changes to NC events and shared HTML helpers: verified TLS,
10-second connection and 60-second read timeouts, HTTP error rejection, and no insecure certificate-error retry.
NC bill-link requests use the scraper session rather than a separate unbounded request. Original upstream source
remains retained in the digest-pinned archive, and offline verification reconstructs the hardened source.
The current bundle is `artifacts/openstates-runtime/hardened-build-inputs`; the older `verified-build-inputs` bundle
predates the request policy and is not the current deployment candidate. All 494 hardened files verified in Linux.

The runtime installation, live source canary, production import, recurring activation, and seven-day observation gates
remain open. These changes do not resolve the current NC roster omission or authorize incomplete-roster promotion.

Verification: all 18 Python tests passed in network-disabled Linux; Windows passed 14 applicable tests with four
Linux-only skips. Full `pnpm verify` passed: all nine coverage task groups successful, 2,679 legislation tests passed,
76 database-dependent tests skipped, and four receiver tests passed. No production deployment or canonical writes.

### Installed runtime and live event extraction

The `textract` dependency blocker is resolved by a deterministic, checksum-gated metadata repair matching the retained
Poetry lock (`extract-msg <=0.29`). Original distribution bytes are retained. Executable code, package versions, and
licenses are unchanged; the derived wheel has its own build tag, RECORD, checksum, and replay-verifiable manifest.
The entire locked dependency graph installed successfully and `pip check` passed. Source-only builds use the pinned
setuptools bootstrap with build isolation disabled, not unpinned build dependencies.

Actual startup testing found Python 3.12 incompatible with upstream `six==1.12.0`. The Python 3.11 acceptance image
uses base digest `9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534` and successfully loaded the real
Open States 6.25.5 CLI plus both NC lanes. Its parser verified explicit scrape-only actions. The clean Dockerfile build
also succeeded, and its startup test passed with networking disabled. All 22 then-current Python tests passed in that
image. This is local runtime acceptance, not a Trigger deployment.

Two real NC event scrapes completed with three meetings each. The first exposed upstream's colon-containing metadata
filename, which the Windows-portable archive contract rejected. The runner now renames that exact known file before
inventory without changing its JSON bytes, rejecting collisions and unsafe names. The second scrape's seven files
were retained and read back from Azure at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/events/nc-events-live-20260914/retained.json`.
No canonical writes occurred. The raw event IDs are per-scrape UUIDs, and committee references can be unresolved name
expressions; these must not be treated as durable upstream entity identifiers during canonical promotion.

The existing 15-minute onboarding follow-up remains active. Current-roster completeness, historical committee
promotion, stable scraper normalization, Trigger deployment/activation, authenticated acceptance, and the seven-day
observation period remain open. The successful events extraction does not close those requirements.

The bill-lane canary uncovered a second source-routing issue: requesting `2025E1` returned a feed containing 1,092
Senate bills, including `S1092` filed July 27, 2026. The executable pilot now accepts only regular session `2025`;
unverified special/historical session routing is rejected before starting a child. The earlier special-session attempt
failed, retained four metadata files in Azure at `nc/bills/nc-bills-live-20260914/retained.json` under the same scraper
revision prefix, and performed no canonical writes. Direct diagnostics observed read timeouts; a separate bounded
request subsequently returned HTTP 200 and the mismatched feed. Successful transport did not establish session validity.

A regular `2025` canary extracted 51 bills and 23 votes plus four metadata files before its deliberate 90-second
deadline. One inspected example, SB 1092, retained 20 actions, one sponsorship, and six versions with the official
`https://www.ncleg.gov/BillLookUp/2025/S1092` source. All 78 files were archived and read back at
`nc/bills/nc-bills-regular-canary-20260914/retained.json` under the same revision prefix. The attempt remains timed out,
not complete, and was not promoted. No scraper container remained active afterward; the local test database stayed
healthy. This confirms extraction and timeout retention, not whole-session completeness. Recurring bill work requires
bounded batches rather than treating an entire large session as one short scheduled task.

### Bounded bill extraction verified

The executable pilot now rejects whole-session bill attempts. Each request specifies 1–10 unique bill IDs from one
chamber, and only regular session `2025` is accepted. The reviewed source patch requires every selected ID to appear
exactly once in the feed before yielding selected bills, then uses numeric ordering. A new filing cannot shift an
offset-based boundary because no feed offsets are used. Request IDs remain in retained attempt metadata. Timeouts
still fail safely; successful batches are not whole-session completion or canonical promotion.

The rebuilt local image passed dependency verification, `pip check`, network-disabled startup, and 27 Python tests.
Its image config digest is `f2444588e2eb3e50dd9bda285f421c4b7643138326ec2888e1b93786cc0cfe79`.
The current source manifest SHA-256 is `d332b3722b6718ff379f8b65c15ae2c78b5654081bafd326593f6776ae468b6b`.
The dependency manifest SHA-256 is `6bcf77e389439a651c714b122f1ac30bbb2fad4eded24f54aabd0db992342119`.
These bundles reside in `artifacts/openstates-runtime/batched-build-inputs` and `batched-dependency-inputs`.

A live batch requesting `S1091` and `S1092` completed with exit zero inside its 180-second deadline. Its two bill
records are SJR 1091 (22 actions) and SB 1092 (20 actions), both session 2025, with the corresponding official NCGA
BillLookUp source URLs. All 10 output files were archived and verified by read-back at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/nc-bills-batch-canary-20260914/retained.json`.
Local evidence: `artifacts/openstates-runtime/live-canary/openstates-nc-e42pidjp`.

The archive suite passed 13 tests. Final root `pnpm verify` passed: legislation 2,686 tests passed, 76
database-dependent tests skipped, and four receiver tests passed. The initial lint failure for a missing expected
error message in a new test was corrected before this successful verification. No production deployment or canonical
writes occurred. Remaining work includes durable whole-session discovery/scheduling, stable raw-record normalization,
historical committee promotion, deployed Trigger safeguards, authenticated reads, source roster completeness, and
the seven-day observation period. The existing 15-minute continuation schedule remains active; none was duplicated.
