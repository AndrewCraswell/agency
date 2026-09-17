# Federal regulatory implementation progress

Updated September 15, 2026. Implementation is underway. Backfill first: all recurring regulatory source schedules remain
disabled. This is a dated execution ledger, not a recurring-agent configuration or task queue. Older entries describe
then-current blockers and counters; newer evidence and the production backlog supersede those operational directions.

Current task selection is owned by the [remaining production backlog](production-backlog.md), expanded September 15
into concrete source, orchestration, passage/index, evaluation/vector, HTTP/MCP, sync and operations tasks. The original
phase checklist is retained as prior art. This backlog update establishes no new implementation or deployed coverage.
The remaining-work plan contains 147 tasks with closure evidence, dependency ordering and five capability-specific
gates. Documentation review and `git diff --check` passed; root `pnpm verify` passed with nine successful tasks in
2m43s. Verification log: `C:/Users/andcra/AppData/Local/Temp/rostra-production-backlog-verify.log`.

## Implementation evidence, newest first

Expanded the canonical evaluation candidates from 26 to 40 complete versions using source-length quantiles rather than
only the shortest current records. The inventory now has five current prose and five current table versions per split;
Title 8 supplies only three bounded tables, so two Title 20 tables fill the held-out allocation. All 14 added versions
qualified, and the combined inventory has 170 common passages (70 development, 100 held-out), maximum 1,122 tokens.
Independent packet/source/passage hash and reconstruction audits passed. The reusable duplicate CLI exits 0 with 36
groups and no detected cross-split group. Export/selection/duplicate receipts are retained under
`artifacts/regulatory-backfills/evaluation-candidate-expanded-*` and `evaluation-duplicates-expanded-*`.

Drafted ten source-backed development questions, covering all five current-prose and five table/exception/number slots.
Each exact quote was checked against its identified canonical passage; proposals retain version/content/input/packet
hashes and source locators. These are automated known-answer suggestions, not exhaustive relevance or human judgments.
Twenty development queries, thirty held-out queries, family/semantic review and final freeze remain open. No held-out
source bodies or retrieval results were inspected for query writing. See the [expanded corpus and query draft](embedding-corpus-candidates.md).
No provider calls or canonical/index/vector writes occurred. The full-current scanner continues with eight completed
editions and 51,022 members, with zero preparation failures; full 49-title qualification remains incomplete.
`git diff --check` passed. Root `pnpm verify` stopped at unrelated Knip findings for existing Storybook/generator files,
root dependencies/binaries and `EntityResults`; coverage did not run. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-evaluation-expanded-verify.log`.

Added a reusable bounded near-duplicate screen for the evaluation corpus. It hashes original and normalized bodies,
detects normalized equality or five-word-shingle overlap, and groups transitive matches deterministically. The CLI retains
diagnostic evidence but exits 1 for a cross-split group, preventing a leaking proposal from passing this screening gate.
It never claims semantic review or authenticates supplied source bodies. It rejects duplicate version IDs, empty lexical
content and excessive aggregate work; unrelated short inputs are not linked through empty shingle sets.

Four focused tests passed, covering Unicode/short text, transitive leakage, stable same-split historical grouping and
rejection bounds. Real retained candidate inputs reproduced the prior finding: initial selection exits 1 with one
cross-split group; replacement selection exits 0 with 22 groups and none crossing splits. Both reports contain metadata
only, with zero provider calls or canonical writes. See [CLI and evidence paths](embedding-corpus-candidates.md).
Scoped lint and ingestion types also passed. Root `pnpm verify` stopped during formatting with Windows mapped-file
error 1224 on concurrently edited web conversation files; coverage did not run. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-evaluation-duplicates-verify.log`. The current-title scanner remains live at
38,485 members across six completed editions, with zero preparation failures; full qualification remains incomplete.

Exported and independently audited 26 canonical evaluation candidate versions across current prose/tables, annual history,
proposals, final rules and notices. All complete versions qualified under both pinned tokenizers, producing 55 shared
passages (17 development, 38 held-out candidates), maximum 777 tokens. Before freezing anything, replaced four historical
pairs whose normalized words were identical despite distinct canonical hashes, and replaced two notices whose boilerplate
crossed the proposed split. The replacement screen has zero exact-input cross-split duplicates and zero cross-split
five-word-shingle pairs at Jaccard >= 0.5. Semantic/family review and final corpus/query expansion remain open; this small,
short-record-biased candidate inventory does not close EVAL-02. See the [candidate report](embedding-corpus-candidates.md)
and its exact identity/hash manifest. No provider calls or canonical/index/vector writes occurred.
The live exports and independent packet audit passed, as did `git diff --check`. Root `pnpm verify` stopped at unrelated
Knip findings for existing Storybook/generator files, root dependencies/binaries and `EntityResults`; coverage did not run.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-evaluation-candidates-verify.log`.

Full-current qualification process 40548 continues with five completed editions and 29,621 canonical members, zero
preparation failures under both tokenizers. The full 49-title run is still incomplete.

Added the Federal Register counterpart to canonical evaluation export. One read-only statement binds the published
batch, observation, document/version, active rights and registered supporting PDF. The verifier reproduces the original
XML or HTML content-hash rules, checks source/identity/rights/byte bounds, and prepares the complete version for both
tokenizers. The packet preserves observation metadata and hashes without elevating unapproved source fields or claiming
publisher-byte replay, family assignment, human review or model selection.

All 14 focused publication/common-passage tests, scoped lint and ingestion types passed. A retained canonical notice
export produced one common passage, evidence hash `bf8521123802c3ad80cb8414883dcacdb38d096e8ff85c7a284c15562dc5126b`,
at `artifacts/regulatory-backfills/evaluation-publication-notice.json`. An invalid observation exited 1 with
`evaluation_publication_observation_unavailable` and created no output. No provider calls or canonical writes occurred.
The retained publication/annual pilot containers were started without reimporting data. Tests/denial logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-publication-export-tests.log` and `tabra-publication-export-denied.log`.
Root `pnpm verify` stopped at unrelated web type errors before coverage; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-publication-export-verify.log`.

Full-corpus qualification process 40548 remains live. Its progress manifest now includes three completed editions and
23,071 canonical members, all prepared by both tokenizers with zero preparation failures. Nine empty-table shape
diagnostics are recorded separately and did not prevent whole-version preparation. The 49-title run remains incomplete.
Scanner JSON progress is being written to the named stderr log; inspect both logs and the progress manifest.

Added a canonical code-source exporter for EVAL-02. It reads published eCFR/annual-CFR membership, source text and active
rights together in one read-only database snapshot; verifies requested identity/content hash, canonical parser-content
hash, rights hash and display/search/embedding/export permissions; then prepares complete common passages for both models.
Source/context/passage limits are enforced before creating a new output file. The evidence packet records source
dates/locator and generation/rights/context hashes, while explicitly leaving publisher-artifact replay, split assignment,
human review and model selection unverified. No existing embedding freshness contract changed.

All 12 focused snapshot/common-passage tests, scoped lint and ingestion types passed. A real canonical export of
40 CFR 152.175 produced 52 common passages (maximum 185 tokens under either counter), evidence hash
`90400a51ac7f174e2483424c31d8f7dbc6e5086cc843ef7e91dc25139c03f872`, at
`artifacts/regulatory-backfills/evaluation-code-pesticides.json`. A mismatched edition/version CLI canary exited 1 with
`evaluation_code_published_membership_unavailable` and created no output. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-evaluation-export-tests.log` and `tabra-evaluation-export-denied.log`.
No provider calls or canonical writes occurred. This is an exporter smoke, not the final frozen multi-cohort corpus.
Full `pnpm verify` stopped at repository lint before coverage; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-evaluation-export-verify.log`.
Full-corpus qualification process 40548 was confirmed live while this independent exporter was implemented.

Resolved the last known table blocker in 40 CFR 152.175. The cited 1981 final rule's printed page 5699 provides the
missing alignment evidence for the zinc-phosphide record. A narrowly bounded in-memory repair joins its exact source
fragments into one logical row. Both row segmentation and continuation cell lookup use that layout; the complete
reader text must remain identical and stored XML is unchanged. The match requires all headers and all six reviewed
rows, refusing changed identities/quantities/neighboring formulations. See [source review](ditto-source-review.md)
for primary-source evidence and its PDF hash.

All 88 table tests, scoped lint and ingestion types passed, including column positions, exact source preservation,
ditto evidence and both tokenizers. Canonical version `81d3d42c-0451-4a2b-99e5-4144a821be59` prepares 52 passages
per model, maximum 173 OpenAI / 185 Voyage tokens. Parser hash:
`fb3051e81e6b0cd20d4a1ce66f8d4ff6421a9b6fa01aff06c14233aeb78775c3`; report:
`artifacts/regulatory-backfills/pesticides-alignment-recheck.json`; tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-zinc-tests.log`. No provider calls or source/index/vector writes occurred.
All previously known blocked versions have qualified individually; full-corpus qualification remains required.

Process 59028 was confirmed live and deliberately stopped before this parser change, which would invalidate its
implementation fingerprint. Its old completed/partial output remains retained. This was an intentional revision,
not a restart inferred from an observation timeout.
The revised full read-only scan started September 16 at 21:56 local as hidden Node process 40548, confirmed live
after the first 33-member edition completed without blockers. Output remains
`artifacts/regulatory-backfills/canonical-preparation-all-current`; implementation fingerprint:
`2f961df4618361ef08d65c77286e592d0d41a938cc36e236eb9973a72e3df973`. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-current-requalification-zinc.stdout.log` and
`C:/Users/andcra/AppData/Local/Temp/tabra-current-requalification-zinc.stderr.log`.
Root `pnpm verify` stopped at repository lint before coverage; focused ingestion checks passed. Full log:
`C:/Users/andcra/AppData/Local/Temp/tabra-zinc-verify.log`.

Resolved 21 CFR 177.1520's sparse item 3.1c solubility reference. Exact source headers, item identity, density and
blank-cell structure bound recognition. The blank entry gains no value; the subsequent explicit ditto retains its
earlier printed source. Current PDF pages 301–302 were visually checked. The full canonical block is retained in
`fixtures/olefin-polymers-table.json` with membership/content/XML hashes. All 87 table tests, scoped lint and ingestion
types passed, including both tokenizers' complete reconstruction and independent recounts.

Canonical version `c87d689a-d651-43fa-9c5e-d7d8c7ca4a73` prepares 36 OpenAI / 37 Voyage passages with maximum
765 / 795 tokens. Parser hash: `b936bee309d065119090ab1708fb8967e297089b7427653f077a0060084a0933`; report:
`artifacts/regulatory-backfills/polymers-version-recheck.json`; tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-polymers-tests.log`. Only the pesticide section remains among known blockers;
the full corpus has not yet been requalified. No provider calls or source/index/vector writes occurred.
Root `pnpm verify` passed ingestion lint but stopped at five unrelated web lint errors before coverage. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-polymers-verify.log`.

Restarted the full read-only current-eCFR qualification September 16 at 21:49 local as hidden Node process 59028.
No matching scanner process was live beforehand; the former ignored output directory was absent after the repository
reorganization. The scanner uses the retained database on port 55438 and the existing bounded inventory, rights,
source-content and dependency-fingerprint checks. Output: `artifacts/regulatory-backfills/canonical-preparation-all-current`;
implementation fingerprint `77e0b095ebbe1cbda67ea37d37b9119647f2be51b68a41e3c61588529b99227d`.
The first completed edition has 33 members and zero blockers (35 OpenAI / 36 Voyage passages). Process 59028 was
confirmed live after this output; completion remains unproven. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-current-requalification.stdout.log` and
`C:/Users/andcra/AppData/Local/Temp/tabra-current-requalification.stderr.log`.

Resolved both sparse-entry defects in 9 CFR 424.21 using the current published PDF, visually checked at printed pages
577–578. Disodium guanylate's amount and Potassium hydroxide's purpose/products stay blank. Later explicit dittos
retain source-backed earlier values. Exact headers, row names, blank-cell structure and populated siblings bound the
rule. The full retained fixture is `fixtures/food-ingredients-table.json`, exported with canonical membership,
content hash and XML hash checks. All 86 table tests, scoped lint and ingestion types passed, including complete source
reconstruction and both tokenizers' independent recounts.

Canonical version `59d4eb4f-49cf-420f-b6b2-2f175afbdb92` prepares 160 passages per model, maximum 720 OpenAI /
790 Voyage tokens. Parser hash: `86b8cf646ee57ef312e17d99314073fbf91a2dcf17b6bd41d9d1406e99cc650a`; report:
`artifacts/regulatory-backfills/food-ingredients-version-recheck.json`; tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-ingredients-tests.log`. Two known versions remain blocked, pending their
resolution and full-corpus qualification. No source/index/vector writes or provider calls occurred.

The zinc-phosphide alignment cannot be repaired from the current official PDF: visual review of printed page 45
confirms missing values there too. The retained XML's shifted values therefore remain quarantined by failed passage
qualification. See [source review](ditto-source-review.md) for PDF hashes and the unresolved evidence requirement.
Root `pnpm verify` stopped before coverage on unrelated web `ResearchActivity.tsx` lint errors and Windows mapped-file
save errors for web conversation tests/stories. Ingestion lint passed in that run. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-ingredients-verify.log`.

Repaired one of two defects in 40 CFR 152.175: sparse criteria preserve the prior printed criterion across verified
unclassified rows for later explicit dittos. Empty entries acquire no criterion. Recognition requires exact pesticide
headers, unspanned cells, populated formulation/use/classification, and an explicit or resolved `Unclassified` value.
The full source block was exported read-only with version/edition membership, content hash and XML hash verification.

The retained Zinc Phosphide record exposes a separate shifted-row defect; the complete section remains blocked under
both models. The test verifies this rejection while reconstructing the preceding source exactly with both pinned
tokenizers. All 85 table tests, scoped lint and ingestion types pass. Canonical report:
`artifacts/regulatory-backfills/pesticides-version-recheck.json`, parser hash
`d274adda54dce34525153aaf36d8459f5cf5db5b0ca94cb58db09a6097b90e8a`. Tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-pesticides-tests.log`. Three known blocked versions and full-corpus
requalification remain open. No provider calls or source/index/vector writes occurred. See the
[source review](ditto-source-review.md) for the exact misalignment and the next required evidence.
Root `pnpm verify` stopped at unrelated knip findings before coverage. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-pesticides-verify.log`.

Resolved the reviewed child-only rows in the 38 CFR 3.261 income table. Parent-benefit reference retention is limited
to the exact earned-child-income and chapter-35 educational-assistance labels, all six reviewed headers, empty
parent/citation cells and populated pension cells. These blank parent cells receive no inferred inclusion/exclusion.
Later explicit dittos reference the earlier printed value, with source offsets and intervening gift-group context.
The [published CFR](https://www.govinfo.gov/content/pkg/CFR-2025-title38-vol1/pdf/CFR-2025-title38-vol1-sec3-261.pdf)
corroborates the retained layout. Changed labels or headers remain rejected.

All 84 table tests, scoped lint and ingestion types passed. Canonical version
`6049b627-cfbb-4eb9-85bf-319095b51d97` prepares 61 passages per model, maximum 482 OpenAI / 669 Voyage tokens.
Parser hash: `e5aa67792abe9f1d301543e61dcba04da1a5f8ca26f7e28476da75b310a4c0ef`; report:
`artifacts/regulatory-backfills/income-version-recheck.json`; tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-income-tests.log`. No provider calls or source/index/vector writes occurred.
Three known versions remain blocked; complete current-title requalification remains open. Docker's retained source
database is live. Historical process 76852 is absent; no duplicate qualification process was started.
Root `pnpm verify` stopped at knip's unrelated theme-file inventory, root dependency/binary declarations,
Storybook dependencies and the web `EntityResults` export. Coverage was not reached. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-income-verify.log`.

Resolved the sparse station-class reference in 47 CFR 90.35. Exact reviewed headers, numeric frequency, four
unspanned cells and populated limitations/coordinator cells bound recognition. Blank station-class entries remain
blank; later explicit dittos retain the last printed class. The complete retained table reconstructs exactly under
both pinned tokenizers, with independently recounted token limits. Changed headers and nonnumeric intervening rows
remain rejected. All 83 table tests, scoped lint and ingestion types passed.

Canonical version `7918aef4-df16-4576-88fd-73b18d1e6bf3` qualifies with 341 OpenAI / 354 Voyage passages and maximum
766 / 793 tokens. Parser hash: `f6363c1f529032b0b104666b8fb4d869395a7cbfdb57e18ac0ca5176998bf95e`.
Report: `artifacts/regulatory-backfills/frequency-version-recheck.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/tabra-frequency-tests.log`. Four known source versions remain blocked, pending
their individual resolution and a fresh full-corpus qualification. No source/index/vector writes or provider calls
occurred. Root `pnpm verify` stopped at unrelated Storybook dependencies, root binary declarations and the web
`EntityResults` unused export in knip; coverage was not reached. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-frequency-verify.log`.

Resolved the sparse limitations column in 21 CFR 172.510. The exact common/scientific-name/limitations headers,
populated name cells and a plain empty limitation cell are required. An empty entry does not acquire a limitation;
only a later explicit ditto uses the last printed limitation. A newly printed limitation replaces that reference.
Other tables retain their existing blank-cell boundaries. The
[published CFR](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-sec172-510.pdf)
corroborates the source's repeated dittos across intervening blank limitations. No legal restriction is inferred for
an empty row and no source text is substituted.

`fixtures/flavoring-substances-table.json` retains the full canonical block, verified against version/edition
membership, content hash and XML hash. All 82 table tests, scoped lint and ingestion types passed, including blank
row context, replacement limitation references, changed-header rejection and both tokenizers' reconstruction/recounts.
Whole version `33c04c75-c9cf-4e49-a366-828601e74e19` qualifies with 62 passages per model, maximum 356 OpenAI /
384 Voyage tokens. Parser hash: `602be5ffcf55f23d8c9efdbd371d14fc9b95bef7d9c90211cc388d0ae5d8b308`.
Report: `artifacts/regulatory-backfills/flavoring-version-recheck.json`; tests:
`C:/Users/andcra/AppData/Local/Temp/tabra-flavoring-tests.log`. This closes one of six known blockers; five remain
without a fresh full-corpus requalification. No source/index/vector writes or provider calls occurred.
The benefits-income table remains under review: its blank parent-only cells require an independent applicability
interpretation and do not inherit the flavoring table's rule.
Root `pnpm verify` stopped before coverage on the unrelated generated Storybook worker's unused eslint-disable
directive. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-flavoring-verify.log`. Scoped `git diff --check` passed.

Resolved 40 CFR 52.2723's approval-date ditto after an explicitly reserved rule. Recognition requires the exact
Puerto Rico approval-table headers, a `Rule <number>—(Reserved)` label and otherwise empty, unspanned cells.
Only the earlier EPA approval-date reference survives; the reserved rule acquires no date or ditto context.
Ordinary unmarked blanks and changed headers remain rejected. The
[published 2025 CFR table](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol5/pdf/CFR-2025-title40-vol5-part52-subpartBBB.pdf)
corroborates the reserved row followed by the approval-date ditto. Original source text is unchanged.

All 81 table tests, scoped lint and ingestion types passed. Tests cover the reserved row's absent date context,
the following rule's exact prior date and new part heading, negative cases and full-table reconstruction with both
tokenizers. Canonical version `05827c65-3009-49c2-a97d-3148a31f75fc` is eligible under both models: 30 passages each,
maximum 407 OpenAI / 484 Voyage tokens. Exact version/edition membership and content hash were checked read-only.
Parser hash: `e4025abf5ecc47b6740270d1f29b6291352e95c5a93229618fd9e46a6286db79`.
Report: `artifacts/regulatory-backfills/reserved-rule-version-recheck.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/tabra-reserved-rule-tests.log`.
This closes one of seven known remaining blockers; the other six were not rerun here. Full-corpus qualification
remains open. No source/index/vector writes or provider calls occurred.
Root `pnpm verify` stopped before coverage on two unrelated web lint findings: a conditional expect in a
conversation test and the generated Storybook worker's unused eslint-disable directive.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-reserved-rule-verify.log`. Scoped `git diff --check` passed.

Docker access is restored, and retained container `tabra-fr-html-storage-pilot` was started without reset or data
replacement. Recovery preserved inaccessible transient socket directories under timestamped
`run-before-regulatory-recovery-*` and `docker-secrets-engine-before-regulatory-recovery-*` names; no container
volumes, credentials or database files were removed. The user confirmed starting Docker. Earlier pending startup
and unavailable-engine notes below are superseded.

The pending canonical 21 CFR 176.170 recheck completed at `2026-09-17T04:08:50Z`, verifying exact version/edition
membership and the retained content hash. Both models are eligible: 79 OpenAI passages, maximum 798 tokens;
81 Voyage passages, maximum 832 tokens. Parser hash:
`454f6a65578bfa902a37a655dca2b7481e9a00e10f43044447def9842744eda5`.
Report: `artifacts/regulatory-backfills/food-contact-version-recheck.json`. No source/index/vector writes or provider
calls occurred. This closes one of the eight known blocked versions; the other seven were not rerun in this check.
Full-corpus requalification remains required. All work now targets `apps/legislation-ingestion` and the shared
`packages/legislation-core`; web and MCP consumers live in their separate applications. Historical artifact paths
under the former `apps/legislation` directory are not evidence of current file availability.

Commit `5c18178` repaired 24 shared-core relative imports across 13 files to include `.js` extensions required by ingestion's
NodeNext module resolution. The package split exposed these errors in embeddings, legal text, storage, domain
contracts and database primitives. No runtime logic, dependencies or source contracts changed. Ingestion's current
type-check now passes, including the previously cascading implicit-any errors. Scoped lint and all 55 shared
embedding/legal-text tests passed. Logs: `C:/Users/andcra/AppData/Local/Temp/tabra-ingestion-types-fixed.log` and
`C:/Users/andcra/AppData/Local/Temp/tabra-core-import-tests.log`. Scoped `git diff --check` passed.
Root `pnpm verify` still fails before coverage on the generated Storybook worker's unused eslint-disable directive;
the shared-core type-check also reported OS thread-creation failure (`runtime.newosproc`, 98 existing threads).
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-core-imports-verify.log`. No full repository pass is claimed.

Docker's startup failure is now confirmed by its backend log, rather than inferred from a slow start: initializing
the Ingest listener failed to rename `AppData/Local/Docker/run/sailor-ingest.sock` to `.stale` because Windows could
not access the file. The backend reported a crash at `2026-09-17T04:00:02Z` and exposed an error dialog. Pending
CLI handles do not establish a healthy engine. No factory reset or database deletion was attempted. Recover this
transient socket/startup issue while preserving the retained containers before the pending canonical qualification.

Implemented a source-reviewed continuation for the wrapped `Titanium dioxide-magnesium` / `silicate` name in
21 CFR 176.170. The exact substance/limitations headers, name fragments, equal indentation, unspanned cells,
preceding ditto and empty continuation limitation are required. Parent and earlier limitation references survive
without changing source text. Unknown names and headers remain rejected. The official
[2025 CFR, printed page 231](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-sec176-170.pdf)
shows the wrapped name with one limitation entry; this corroborates the retained source layout, not a new legal rule.
`fixtures/food-contact-material-table.json` retains the full source block and its canonical hashes. All 80 table tests
pass in the reorganized `apps/legislation-ingestion` package, including exact reconstruction under both tokenizers.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-food-contact-tests.log`. Scoped lint passed before the reorganization.

Whole-version qualification remains pending: Docker Desktop processes are live, but its Linux engine pipe is not
available. Startup command session `99020` and status session `92531` were still pending at the last observation.
The read-only recheck is prepared at `artifacts/regulatory-backfills/recheck-food-contact.ts`; it has not run.
Keep the verified remaining count at eight until the whole-version check completes. Old ignored qualification
artifacts were not found at their former workspace paths after the package split; do not claim they were restored.

The old root verification session `78277` is gone, with no terminal success in its dependency-preparation log.
A fresh `pnpm verify` failed before coverage on the generated web Storybook worker's unused eslint-disable
directive at `apps/legislation-web/.storybook/public/mockServiceWorker.js:1`.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-food-contact-verify.log`.
The reorganized ingestion type-check also fails on shared-core relative imports under NodeNext resolution and
resulting implicit-any errors. The earlier service type pass does not establish a pass for this new package layout.
No source/index/vector writes or embedding provider calls occurred.

Resolved the full 49 CFR 1152.32 railroad expense table. Recognition requires the exact expense/account/basis
headers, a nonempty heading with empty account and assignment cells, and at least two populated children at
publisher indentation two with matching account-code family suffixes. The heading's varying indentation does
not define its semantic level. Each recognized run retains its heading and exact earlier assignment reference;
context ends when the account family or row structure changes. Ordinary missing values are not substituted.

`fixtures/railroad-expense-table.json` retains the full block, verified read-only against canonical content and XML
hashes in 55438. All 77 table tests, scoped lint and service types passed, including full-table reconstruction and
both model token recounts, correct bridges/signals/repair headings and invalid header/account-family rejection.
The completed canonical recheck of all 17 original blocked versions now leaves eight blocked, down from nine.
Version `64997597-bf83-4592-8475-b6d48814a484` prepares 377 OpenAI passages (maximum 759 tokens) and
380 Voyage passages (maximum 718 tokens). Parser hash:
`705e5a8607847a27a41f5bc18efdc5dd69e7da04da87e056042513d66e724c37`.
Report: `artifacts/regulatory-backfills/ditto-version-recheck.json`; previous report retained as
`ditto-version-recheck-before-expense-groups.json`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-expense-ditto-recheck.log`.
No source/index/vector writes or provider calls occurred. Full 49-title requalification remains open.
Root `pnpm verify` is still running in command session `78277`, observed alive while pnpm resolves/links
workspace dependencies before executing checks. Resume that session rather than starting another verification.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-expense-ditto-verify.log`. No repository-wide pass is claimed.
Scoped `git diff --check` passed.

Resolved 40 CFR 799.5025's numbered chemical groups. The exact mixture/test/citation headers, an Arabic-numbered
colon-ended chemical heading, empty sibling cells and consecutive Roman-numbered populated members establish
the group despite equal publisher indentation. Recognition is bounded to the reviewed i-through-x sequence;
unsupported or broken sequences remain rejected. Both the composite-substance heading and the numbered group
are retained as source context, with exact earlier test/date spans for ditto references. Group context does not
leak into the next composite substance. No original cell text is replaced.

`fixtures/chemical-substance-group-table.json` retains the full source block, verified against canonical content
and XML hashes read-only from 55438. All 73 table tests, scoped lint and service types passed. The completed
17-version canonical recheck leaves nine blocked versions, down from ten. Version
`fb6df7d5-25d9-419f-8d5d-fb6dd315ed98` prepares 25 passages per model, maximum 462 OpenAI / 510 Voyage tokens.
Parser hash: `486f26cc399ddec86bfdc338611333fcfa3252ef8f8f803ea158086556306bd4`.
Report: `artifacts/regulatory-backfills/ditto-version-recheck.json`; earlier evidence retained as
`ditto-version-recheck-before-chemical-groups.json`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-chemical-ditto-recheck.log`.
No DB/index/vector writes or provider calls occurred. Full-title requalification and embedding evaluation remain open.
Root `pnpm verify` stopped before coverage on four unrelated web type errors in `app/chat/agent.ts` and
`app/chat/clarificationTool.ts` concerning AI SDK Context, Output and DynamicTool exports/types.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-chemical-ditto-verify.log`. Scoped `git diff --check` passed.

Resolved the Title 25 trust-period appendix's reservation-group boundary using explicit publisher evidence.
Recognition requires State/Reservation headers, a colon-ended reservation heading with otherwise empty cells,
populated same-width member rows retaining the state ditto, and an exact `All of above <group>` closing row.
Group context stops at that closing row. Missing/mismatched closers, incompatible headers and empty members
remain rejected; ordinary blanks never acquire guessed values.

`fixtures/tribal-trust-period-table.json` retains the full canonical source block, verified read-only against
content and XML hashes in 55438. All 69 table tests, scoped lint and service types passed. The tests cover
source references, group termination, negative boundaries, exact reconstruction and independent token recounts.
The canonical 17-version recheck completed with 10 versions still blocked, down from 11. Title 25 version
`ccb253a2-5622-4e87-9097-627c9cf7c54a` prepares 156 passages for each model, maximum 465 OpenAI / 630 Voyage tokens.
Parser hash: `04bcde3f68c472b56a1b6d075d6e6ffe1433006f9978d254b63416666f9b030c`.
Report: `artifacts/regulatory-backfills/ditto-version-recheck.json`; prior report retained as
`ditto-version-recheck-before-reservations.json`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-reservation-ditto-recheck.log`.
No source/index/vector writes or provider calls occurred. Full 49-title requalification remains required.
Root `pnpm verify` passed its check phase, then failed in unrelated Shopify email coverage: eight five-second
timeouts in `packages/shopify-emails/src/admin/build.test.ts` and `cli.test.ts`. Regulatory coverage did not
complete in that interrupted run. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-reservation-ditto-verify.log`.
Scoped `git diff --check` passed. The next reviewed source shape is 40 CFR 799.5025's numbered heading followed
by Roman-numbered children at the same publisher indentation; existing indentation rules correctly do not infer it.

Resolved the designation-table boundary and classification continuations in 40 CFR 81.305. A populated partial-
county row now supplies context to a more deeply indented `That portion` boundary description with empty sibling
cells. In the explicit designation/classification header layout, a row continuing the populated classification
columns preserves the preceding designation references. Later classification ditto context retains the complete
parent-plus-continuation source span, including `Not classified/Moderate under 23 U.S.C.` and `104(b)(2).` rather
than citing only the fragment. Ordinary blank cells and unproven indentation remain boundaries.

The retained full source block is `fixtures/partial-county-boundary-table.json`, extracted read-only from canonical
55438 and checked against its existing content/XML hashes. All 64 table tests, scoped lint and service types passed,
including full-table reconstruction/recounts for both models and explicit source-span assertions.
The final canonical recheck completed all 17 original versions and leaves 11 blocked, down from 12.
Version `7cb9fa5b-b4e7-4880-b4a3-02f97279f47e` prepares 755 OpenAI passages (maximum 765 tokens) and
756 Voyage passages (maximum 751 tokens). Report: `artifacts/regulatory-backfills/ditto-version-recheck.json`,
parser hash `41febc55d32866ac42fcf0532d381bd74d76ac57f5bc8bb71fef5a5699cf160b`.
Previous evidence is retained as `ditto-version-recheck-before-boundaries.json`; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-boundary-ditto-recheck.log`. No DB/index/vector writes or provider calls
occurred. Full-title requalification and remaining source blockers are still open.
Root `pnpm verify` stopped before coverage: `check:lint` reported an I/O error, "The system cannot find the
file specified" (OS error 2), without identifying the missing path. This is not a passing repository check;
the cause remains unresolved. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-boundary-ditto-verify.log`.
The focused regulatory tests, lint and service type-check above passed independently.

Resolved the STCC commodity-exception structure in 49 CFR 1039.11. Recognition requires the explicit STCC
number/tariff/commodity headers, an `except` parent, blank sibling cells, and exception codes beneath that parent
code. Exception rows retain the parent commodity and earlier same-column tariff span. Unrelated tables, missing
anchors and mismatched codes remain blocked. Header classification is performed once per table, avoiding repeated
whole-table searches for each row. All 61 table tests, scoped lint and service types passed, including full-table
reconstruction and independent recounts under both pinned tokenizers.

The final read-only recheck completed all 17 originally blocked canonical versions and leaves 12 blocked, down
from 13. Version `2110d5bd-ecfe-4d24-bc07-412f7edb6c86` now prepares 29 OpenAI passages (maximum 736 tokens)
and 30 Voyage passages (maximum 484 tokens). Canonical source text was unchanged. Report:
`artifacts/regulatory-backfills/ditto-version-recheck.json`, parser hash
`1d1b28a587c817648b8fc1bed9adc53aef72fb09203920bd0a4adc51ae40d68d`; prior results are preserved as
`ditto-version-recheck-before-commodity.json` and `ditto-version-recheck-before-header-cache.json`.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-commodity-ditto-recheck.log`. No source/index/vector writes or
provider calls occurred. Full current-title requalification and common-boundary comparison selection remain open.
Root `pnpm verify` stopped before coverage on five unrelated lint findings in Open States normalization and
`src/db/queries/bill-resolved-links.ts`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-commodity-ditto-verify.log`.
Scoped `git diff --check` passed; concurrent work was preserved.

Investigated the two incomplete-metadata candidate families. They contain three canonical versions: two distinct
publications printing `00-113`, plus `00-1083`. The omissions are intentional source-review boundaries: the API mixes
the two `00-113` publications, and only approved fields were published. Original candidates are not approved family
identifiers and must not refill those omissions. Existing source evidence remains in `fr-source-identities.md` and
`fr-source-review.ts`; no metadata correction or new human review was invented.

Family input now requires canonical document IDs and output retains them per member. Multiple canonical documents
with the same printed number receive `printed_document_number_collision`; reviewed-field-only metadata also receives
`source_review_restricts_metadata`. Ambiguous numbers stay conservatively coassigned for split planning, never merged
as canonical documents or actions. Regression coverage confirms that original-candidate RINs cannot leak into links.
All 12 grouping/reconciliation tests, scoped lint and service types passed. The refreshed read-only 110-version CLI
run retains 104 candidate families and 51 warned families, now with explicit source boundaries.

Current input/review artifacts are `publication-family-canonical-input.json` and
`publication-family-canonical-review.json`; previous artifacts remain historical. No DB/index/vector writes or
provider calls occurred. Actual family adjudication and evaluation split assignment remain open.
Root `pnpm verify` stopped before coverage on unrelated lint findings in `src/db/queries/bill-resolved-links.ts`
and unused Shopify email fixtures. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-family-identity-verify.log`.
Scoped `git diff --check` passed; concurrent work was preserved.

Added `group-evaluation-publications` for conservative family coassignment before evaluation splitting. It reuses
publisher source references and correction URL validation, links shared RINs, same-agency exact docket strings,
same document/content identities and explicit corrections transitively, and never changes canonical actions.
Same docket text from different or unidentified agencies does not automatically link. Missing targets, unknown
identifiers and incomplete publisher metadata remain explicit review warnings; no split is assigned automatically.

The actual CLI processed all 110 retained publication versions from a read-only 55452 metadata export into 104
candidate families, including three groups with multiple members and 51 families with warnings. Input/export and
review artifacts: `publication-family-input.json`, `export-publication-family-input.ts`, and
`publication-family-review.json` under `artifacts/regulatory-backfills/`. The first run exposed incomplete source
metadata; the implementation now retains those versions as unresolved instead of dropping them. All 11 focused
grouping/reconciliation tests, scoped lint and service types passed; the CLI passed on the complete inventory.
No canonical writes, provider calls, corpus promotions or human-review claims occurred. Family review and frozen
development/held-out assignment remain open.
Warnings comprise two families with incomplete publisher metadata and 49 lacking a rulemaking-family identifier.
Root `pnpm verify` stopped before coverage on an unrelated unused Shopify email fixture
(`packages/shopify-emails/.build-fixture-xsuXnl/greeting.tsx`); log:
`C:/Users/andcra/AppData/Local/Temp/tabra-publication-families-verify.log`. Scoped `git diff --check` passed.

Completed read-only canonical passage qualification for both newly backfilled annual Title 6 editions. All 1,317
memberships were checked with both pinned tokenizers, with zero invalid, oversized or blocked records. Each year
contains three empty structural records; those are not usable text passages. OpenAI produced 992 passages for 2023
and 996 for 2024 (1,988 total), maximum 800 tokens. Voyage produced 1,014 and 1,019 (2,033 total), maximum 799 tokens.
Both table-bearing records qualified. Different per-model counts still require the common-boundary preparation
path before final evaluation selection.

Terminal evidence: `artifacts/regulatory-backfills/annual-title6-preparation/inventory.json`, `complete: true`,
implementation hash `e7a3f471d6bdfbbaf7cb15ec3aa1566ba31aef5eb985c92e51de9206ccbe417a`, with per-edition hashed
record files and rights/inventory evidence. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-title6-preparation.log`.
The tool read canonical bodies internally for deterministic qualification; passage text and questions were not
inspected in conversation. No canonical/index/vector writes or provider calls occurred.

Metadata-only Federal Register inspection found RINs on 5/12 final rules and 4/6 proposed rules; docket IDs on
10/12 final rules, 5/6 proposed rules and 41/92 notices. Absence of an identifier does not prove independence.
Final publication-family split assignment must account for overlapping identifiers and review unidentified documents.
Root `pnpm verify` passed its check phase, then failed on two five-second timeouts in the unrelated
`packages/fc-theme-base/tests/component-library.test.js` coverage run. This does not establish completed regulatory
coverage. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-title6-qualification-verify.log`.
Scoped `git diff --check` passed.

Expanded retained historical coverage to support a held-out evaluation family. Metadata-only inventory found 49
current editions, annual data only for excluded Titles 2/5, and 110 Federal Register versions (12 final rules,
6 proposed rules, 92 notices). The inventory is retained as `evaluation-source-inventory.json`; it predates this
Title 6 addition. No held-out passage text or questions were inspected during this inventory.

Backfilled annual Title 6 for 2023 and 2024 from GovInfo under manifest
`c624cac470765a47214d28daaf723f7d0e311b8b07032d35f6b0af4acdb9a409`. Both inventoried units were acquired
(4,595,082 bytes total), parsed without warnings, and passed the date audit: printed revisions January 1, 2023
and January 1, 2024 match their package years and have distinct source hashes. Both complete one-volume titles
were imported and published through the existing annual gate in retained local database 55440. A direct DB query
confirmed 658 memberships for 2023 and 659 for 2024, with one published volume each. These are local canonical
publication results, not public API/search readiness.

Artifacts under `artifacts/regulatory-backfills/`: `annual-title6-evaluation-plan.json`, its `-raw` and `-normalized`
directories, `annual-title6-evaluation-date-audit.json`, `annual-title6-evaluation-import.json`, and
`annual-title6-2023-publication.json` / `annual-title6-2024-publication.json`. Edition IDs:
`76890533-9d9f-426d-a00e-db494b3d6d07` and `1ad91e23-5b1e-4a0d-9df8-e33787ad1c03`.
Source writes were limited to this explicit backfill. Index/vector writes and model calls were zero; recurring
ingestion remains disabled. Passage qualification, rights-aware corpus selection and reviewed comparisons remain open.
Metadata-only comparison found 285 shared unchanged provision identities and 253 shared identities with different
versions; 121 identities are present only in 2024 and 120 only in 2023. These include structural records and are
not an assertion about the number of legal amendments. Root `pnpm verify` stopped before coverage on unrelated
`ProcessEnv` type errors in `app/lib/chatRequest.test.ts`; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-title6-backfill-verify.log`. Scoped `git diff --check` passed.

Implemented common-passage preparation for embedding comparisons. The entire source version must first qualify
with each pinned tokenizer. A combined counter then applies the larger model-specific count to each candidate
input, producing one set of lossless passage boundaries and input bytes. Independent per-model counts are retained;
the maximum counter is explicitly not provider billing usage. Blocked whole versions are rejected before a subset
can be selected. Two focused tests, scoped lint and service types passed, including deterministic replay with the
real tokenizers and rejection of inconsistent source blocks.

The actual CLI prepared 71 shared passages from canonical 40 CFR 81.324, exported read-only from retained 55438
after matching version/edition membership and expected content hash. Artifacts:
`common-county-canonical-input.json`, `common-county-passages.json`, and `export-common-county-input.ts` under
`artifacts/regulatory-backfills/`. Shared manifest hash:
`425de14c582ed869942defb02ff23e1d61db9fd862b94ef1a3b5f5fbd9a57e13`.
No provider calls, canonical writes, index writes or vector writes occurred. The general CLI reports source
provenance unverified because it accepts a supplied file; the retained export supplies this smoke's separate
canonical evidence. Multi-cohort corpus selection, reviews and live model comparison remain open.
Root `pnpm verify` stopped before coverage on five unrelated lint findings in Open States normalization and its tests.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-common-passages-verify.log`. Scoped `git diff --check` passed;
Open States work was preserved.

Resolved the partial-county grouping in 40 CFR 81.324. The parser recognizes a `County (part)` label only inside
a publisher `Designated area` table with blank sibling values and a following area row. The label supplies scope
to that next row only; the same-column ditto date remains tied to its earlier source span. Ordinary county blanks
and labels in other tables still break references. All 57 table tests, scoped lint and service types passed, including
full retained-table reconstruction and token recounts for both models; strengthened negative cases also passed.

The read-only 17-version canonical recheck completed with 13 blocked versions, down from 14. Version
`4665d270-022a-489d-876a-70c3e9e480a7` now prepares with both tokenizers: OpenAI 35 passages/max 1,176 tokens;
Voyage 71 passages/max 1,150 tokens. Source hash remains
`6fb9b943c21135b512cd7fda0ac62a75d7dd181d7a86aa222f58e3e3954ccdfb`. Different passage boundaries still require
a common-boundary evaluation corpus; this is eligibility evidence, not comparative model quality.

Report: `artifacts/regulatory-backfills/ditto-version-recheck.json`, parser hash
`970a60df601e479e8197f300cccdf88aad09b6ad3ca9460c4332e48ace0ae3a1`. Prior report:
`ditto-version-recheck-before-county.json`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-county-ditto-recheck.log`.
No canonical source, index or vector writes and no provider calls occurred. Full 49-title requalification remains open.
Root `pnpm verify` reached web type checking and stopped before coverage on seven unrelated `ProcessEnv` assignment
errors in `app/lib/chatRequest.test.ts`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-county-ditto-verify.log`.
Scoped `git diff --check` passed; concurrent chat changes were preserved.

Restored Docker Desktop and started the retained `tabra-fr-html-storage-pilot` container without resetting data.
The read-only recheck completed all 17 originally blocked canonical versions. Fourteen remain blocked, down from
15 in the previous completed recheck. The Title 5 hazard appendix (`a593c1be-d111-433f-916c-21974697a2a0`) now
qualifies for both tokenizers: 57 passages each, maximum passage tokens 480 OpenAI and 510 Voyage, unchanged source
content hash `c65a448cd962e5cbd78667fe5881c2cca3ea2ab6a1984f205d39f9696e29e86a`.

Evidence: `artifacts/regulatory-backfills/ditto-version-recheck.json`, complete with parser hash
`82b55583252fb323665d23c1accfcecfd27ec73eaea8393f91168e8f242f2049`; the prior report is preserved as
`ditto-version-recheck-before-conditions.json`. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-condition-ditto-recheck.log`.
This resolves the database availability limit in the preceding entry. Source, index and vector writes and provider
calls were zero. It is a targeted canonical recheck, not a new full 49-title qualification or shared model-selection corpus.
Scoped `git diff --check` passed. Root `pnpm verify` stopped before coverage on concurrent chat lint findings and
Windows mapped-file errors formatting `app/evals/langfuse.ts` and `app/chat/route.ts`.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-canonical-condition-verify.log`; unrelated work was preserved.

Resolved the retained Title 5 hazard-table continuation in offline preparation. A filled duty row ending `when:`
followed by consecutive `(a)` onward conditions, explicit `; or,` separators and a final period now supplies parent
context to its conditions while preserving the earlier same-column ditto source. Only blank sibling cells in that
complete source sequence retain references; ordinary blanks, skipped letters, unfinished sequences and missing
anchors still break them. The full retained table reconstructs losslessly under both pinned tokenizers, with every
passage at or below 1,200 tokens. All 54 table tests, scoped lint and service types passed.

The canonical 17-version recheck could not start: PostgreSQL at `127.0.0.1:55438` refused the connection and the
Docker Desktop Linux engine pipe was unavailable. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-condition-ditto-recheck.log`.
The previous 15-version blocker count remains the last completed canonical recheck, not a result for this parser.
No source, index or vector was changed. Resume the canonical recheck when the retained DB is available, then regenerate
the full qualification manifest after the remaining source-backed fixes.
Root `pnpm verify` stopped before coverage on an unrelated `unicorn/no-useless-spread` finding in
`app/chat/capture.ts:11`; the concurrent chat change was preserved. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-condition-ditto-verify.log`. Scoped `git diff --check` passed.

Added corpus assignment preflight to `smoke-regulatory-embeddings --assignments <file>`. It binds the frozen protocol
and normalized full manifest, enforces all 60 assignments and cohort counts, rejects declared split/exposure leakage,
and checks CLI split labels before filtering or provider access. Three focused tests, scoped lint and service types
passed. The actual CLI preview selected 30 held-out queries from a synthetic 60-query packet; evidence is retained in
`artifacts/regulatory-backfills/assignment-cli-preview.log` with manifest and assignment companions. No provider calls
or data/vector writes occurred. Source authenticity, cohort semantics, actual corpus selection, human review and
full protocol compliance remain unverified; the preflight explicitly reports these limits.
An actual CLI negative smoke rejected a changed query split with `embedding_query_split_assignment_mismatch`;
see `assignment-cli-rejection.log`. Root `pnpm verify` again stopped before coverage on the five unrelated
Shopify email fixture files; log: `C:/Users/andcra/AppData/Local/Temp/tabra-corpus-assignment-verify.log`.

Added reviewed regulatory scoring with grades 0–3, recall based on grades 2–3, and graded nDCG.
The scorer requires the complete pooled top-25 plus known-answer packet, bound to the manifest, system rankings,
query text and exact passage identities/text. Missing grades, changed evidence and contradictory no-answer judgments
are rejected. No-answer cases are excluded from recall/nDCG averages. Reviewer declarations do not establish human
adjudication: human-review, protocol-compliance, model-selection and bulk-embedding flags remain false.

Fourteen focused evaluation tests passed; service types and scoped lint passed. The real
`pnpm tool regulations/score-regulatory-judgments` CLI passed with a synthetic automated no-answer review, retained in
`artifacts/regulatory-backfills/graded-cli-report.json` and its manifest, systems, pool and review companions.
This is executable scoring evidence only, with no provider calls, vector writes or model-quality claim.
EVAL-04 remains open for actual blind review; corpus/split binding and full protocol enforcement remain outstanding.
Root `pnpm verify` stopped before coverage on five unused `.build-fixture-*` files in `packages/shopify-emails`.
Those unrelated files were preserved. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-graded-review-verify.log`.
This supersedes earlier root-check failures only for this run and does not establish a clean repository gate.

Closed EVAL-01 by freezing the next final-passage comparison protocol before new scoring. The 60-query allocation
has 30 development/30 held-out questions across current prose, tables, annual history, proposed rules, final rules,
notices and no-answer cases. It records source-family leakage rules, earlier diagnostic/pilot title exclusions,
review requirements, per-cohort/aggregate quality floors, 20-reader latency targets, USD 5 live-run ceiling and the
0.01 nDCG practical-tie rule. Missing cohorts and unresolved human judgments block selection.

Protocol SHA-256: `8bf27836fb7ba2a891ab65ea8d1fe275a5f284f88aa29b8bea2a6546e3797d9e`.
The exact bytes are retained in `artifacts/regulatory-backfills/embedding-evaluation-protocol-8bf27836fb7ba2a891ab65ea8d1fe275a5f284f88aa29b8bea2a6546e3797d9e.json`.
The tracked protocol and interpretation are linked from [evaluation protocol](embedding-evaluation-protocol.md).
This freezes methodology only: actual corpus/family assignments, protocol-bound CLI enforcement, graded review,
new scoring and deployed acceptance remain open. No provider requests, source writes or vector changes occurred.
Documentation was reviewed directly and scoped diff checks passed; no prose validation tests were added.
Root `pnpm verify` stopped before coverage on five concurrent chat/evaluation test lint errors;
log: `%TEMP%/tabra-evaluation-protocol-verify.log`.

Added explicit no-answer cases to the embedding diagnostic. Empty relevant-ID lists require `answerability: "no_answer"`;
contradictory declarations fail before provider calls. Both candidate models retain rankings for these questions,
but their ranking metrics are null and no-answer acceptance remains false. The blind review pool includes retrieved
candidates without inventing relevant IDs or human grades. This closes a runner capability gap, not model selection.

Smoke CLI preview and judgment-pool CLI accepted a held-out no-answer fixture without external calls. Evidence:
`artifacts/regulatory-backfills/no-answer-cli-manifest.json`, `no-answer-cli-systems.json` and `no-answer-cli-pool.json`.
The final source-backed corpus, frozen protocol, reviewed labels and abstention evaluation remain outstanding;
the earlier excerpt benchmark is still insufficient for bulk-vector authorization.
Eleven focused tests passed, including both model routes, missing/contradictory intent refusal and rank-blind pooling.
Service typecheck, focused lint and scoped diff checks passed. Root `pnpm verify` stopped before coverage on 12
concurrent lint errors in chat/evaluation/PDF-cleanup tests. Logs: `%TEMP%/tabra-no-answer-evaluation-tests.log` and
`%TEMP%/tabra-no-answer-evaluation-verify.log`. The focused tests use fixture responses; no live model comparison ran.

Closed the serving-time live inventory/context gap that generation counters cannot cover. The source query now locks
and reconstructs complete selected edition/publication inventories in PostgreSQL, requires exact counts and matches
each ordinal, version and preparation context before comparing revision receipts. Context trimming matches JavaScript
preparation whitespace rules. Extra source provisions without generations cannot disappear from expected-row joins.

Two selected real PostgreSQL regressions passed (64 not selected): an added unprepared source provision, changed code
name and changed Federal Register document number each deny serving without relying on changed passage counters;
restoring metadata restores reads. Existing copy/commit-failure/rights tests also passed. The nine edition API unit
tests, service typecheck and focused lint passed. Evidence: `%TEMP%/tabra-source-membership-serving-tests.log`.
Retained Title 3/23 HTTP and MCP canaries passed with the new inventory guard; logs:
`%TEMP%/tabra-membership-http-canary.log` and `%TEMP%/tabra-membership-mcp-canary.log`. Scoped diff checks passed.
Root `pnpm verify` stopped before coverage on the same two unrelated chat-test lint errors;
see `%TEMP%/tabra-source-membership-verify.log`. Deployed credentials and routing were not exercised.
No new schema or vector generation was required. Full-corpus latency and deployed correction behavior remain open.

Renewed the retained Title 3/23 source proofs and search receipts. Revision/provenance DDL is now installed on source
55438 and both search pilots 55454/55455. All 1,270 source generations replayed exactly and remained reused; all 1,953
passages passed bounded copy verification on each target before acknowledgement. No canonical text, generation
identity or embeddings were replaced. Target counter initialization preceded actual page verification and was not
used as a substitute for content evidence. Renewal evidence: `artifacts/regulatory-backfills/retained-copy-proof-renewal.json`
and `%TEMP%/tabra-retained-copy-renewal.log`.

Title 23 used 50 verification pages per target: 36.99/37.26 seconds for page verification and 1.39/1.58 seconds for
final acknowledgement. These local measurements cover 1,237 generations and 1,918 passages, not full-corpus scaling.
The renewed HTTP/typed-client canary passed provenance, pagination, current selection, fallback and auth checks plus
stale revision denial, page-only revalidation denial, renewed serving and old-cursor refusal. The streamable MCP
canary then passed search/pagination/exact-text parity with separate signed API/MCP audience credentials. Evidence:
`%TEMP%/tabra-renewed-http-canary.log`, `%TEMP%/tabra-renewed-mcp-canary.log`, and the corresponding canary JSON artifacts.
This renews local acceptance only; deployed Next/real WorkOS credentials, national scaling and semantic retrieval
remain open. No provider calls or vector writes occurred.
Scoped diff checks passed. Root `pnpm verify` ran with `GOMAXPROCS=4` to bound compiler thread use and stopped before
coverage on the same two unrelated chat-test mock-type lint errors. Log: `%TEMP%/tabra-retained-renewal-verify.log`.

Extended source category recognition to explicit centered-heading/left-data publisher styling. The current Title 5
hazard-pay table is retained in full with its source hash. The exact prefix through fuel-storage work reconstructs
and recounts deterministically with both tokenizers. The complete table remains blocked by later diving-description
continuations with blank date/rate cells; no missing value is guessed and the test explicitly verifies that refusal.
This removes an earlier structural failure without promoting the incomplete version. All 51 table tests and focused
service typecheck/lint passed. Evidence: `%TEMP%/rostra-centered-category-tests.log` and
`artifacts/regulatory-backfills/centered-category-diagnostic.json`. Existing source text and vectors are unchanged.
The complete 17-version scoped recheck still reports 15 blocked versions (14 OpenAI, 15 Voyage), with production
contexts and both pinned tokenizers. Scoped diff checks passed. Root `pnpm verify` stopped before coverage on the
same two concurrent chat-test lint errors and also reported OS thread creation exhaustion in another workspace's
typecheck. Log: `%TEMP%/rostra-centered-category-verify.log`; the focused regulatory checks passed independently.

Resolved two of the 17 baseline table blockers through publisher-indented category recognition. The complete Seaway
schedule (33 CFR Part 401, Schedule III) and 49 CFR 1220.6 now prepare with both pinned tokenizers. Only colon-ended rows with empty
remaining cells and an explicitly more-indented publisher child qualify; parent categories and the prior referenced
cell are retained as source spans, and the marker/text is unchanged. Ordinary blank rows and unsupported boundaries
remain blocked. The complete final Seaway/radio source tables are retained in `fixtures/ditto-final-tables.json`.

All 48 table tests passed, including complete-table reconstruction, independent token recount, deterministic replay,
negative indentation cases and continued radio-table refusal. Focused service typecheck/lint passed. A read-only
recheck of all 17 complete canonical blocked versions found two newly prepared versions, leaving 15 blocked versions
(14 OpenAI, 15 Voyage). Evidence: `artifacts/regulatory-backfills/ditto-version-recheck.json`,
`%TEMP%/rostra-ditto-version-recheck.log` and `%TEMP%/rostra-indented-table-tests.log`.
Scoped diff checks passed. Root `pnpm verify` stopped before coverage on the same two concurrent chat-test mock-type lint errors; log: `%TEMP%/rostra-indented-table-verify.log`.
No source/vector writes or model calls occurred. The earlier 49-title manifest predates this parser change; a fresh
full-corpus qualification remains required after the remaining source-backed repairs. See [source review](ditto-source-review.md).

Added serving-time revision receipts. Acknowledgement snapshots source/target generation revisions independently of
replaceable page checkpoints. Edition API search and acknowledged provision/publication canaries compare the complete
snapshot against live counters before ranking, including queries that would return no hits. Revalidating a page cannot
silently renew an acknowledgement; restored content requires acknowledgement again. Revision manifests also bind the
frozen cursor generation. PostgreSQL aggregates manifests instead of sending all revision rows to the application.

Real disposable PostgreSQL regressions passed CFR mutation/repair/re-acknowledgement and edition API unavailable/restore
checks (one selected test, 29.82 seconds total), and Federal Register source revision invalidation/recovery (one selected
test, 6.44 seconds). The nine focused edition API tests passed, as did focused service typecheck/lint. Evidence:
`%TEMP%/rostra-serving-revisions-postgres.log` and `%TEMP%/rostra-publication-serving-revisions.log`.
Scoped diff checks passed. Root `pnpm verify` stopped before coverage on the same two concurrent mock-type lint
errors in `VoteDetails.test.tsx` and `resultStore.test.ts`; log: `%TEMP%/rostra-serving-revisions-verify.log`.
The target snapshot table was applied only to disposable search database 55456. Retained national pilots need explicit
schema/proof upgrades and fresh acknowledgements; historical HTTP/MCP canary success is not renewed acceptance.
National-scale manifest latency, source hierarchy/observation correction handling and deployed gates remain open.

The retained eCFR tokenizer qualification has completed all 49 editions and 275,149 members. The terminal
`canonical-preparation-all-current/inventory.json` has `complete: true`; `progress.json` remains an intermediate
snapshot by design. The final audit verified all NDJSON hashes and record counts. Seventeen versions remain blocked
by unresolved table ditto values: 16 for OpenAI Small and 17 for Voyage. The two latest reviewed identities are
47 CFR 90.35 and Schedule III to Subpart A of 33 CFR Part 401; source-block review and parser resolution remain open.
Evidence: `artifacts/regulatory-backfills/preparation-blocker-review.json` and `%TEMP%/rostra-final-preparation-audit.log`.
Completion of this offline run does not establish lossless acceptance for blocked versions or model-quality selection.

Added explicit checkpoint finalization to `regulatory-copy-validation` using `{ operation: "finalize", preparationId }`.
It checks full canonical/retained inventory, rights, preparation state, source proofs, target membership completeness,
metadata and all saved revision-bound checkpoints before acknowledging. Missing revision rows fail rather than relying
on an unlocked zero baseline. Passage bodies are not reread; exact reconstruction and manifest evidence comes from
the verified pages. Target receipt commit still precedes canonical acknowledgement. The selected real PostgreSQL
regression passed missing-page and stale-source/target refusal, receipt failure, lost canonical commit and retry,
alongside existing search/rights checks (one passed, 65 not selected; 52.48 seconds total).
Focused lint and service typecheck passed. Evidence: `%TEMP%/rostra-copy-finalization-tests.log`.
Scoped diff checks passed. Root `pnpm verify` stopped before coverage on two concurrent chat-test lint errors;
see `%TEMP%/rostra-copy-finalization-verify.log`. The full repository is not verified clean.
Serving-time receipt revision binding, finalization scale measurements and deployed acceptance remain open.

Added preparation-time source provenance for copy validation. PostgreSQL hashes the body, heading, complete source
blocks and input contract; preparation records that proof only after snapshot validation and exact passage insertion
or replay. Page and whole-copy verification now reject changed markup even when plain body text is unchanged.
Missing proofs are rejected, not populated from current source without re-preparation. Identical passage replay can
establish the proof without changing generation identity or regenerating vectors. Proof changes advance source revisions.

The selected PostgreSQL regression passed markup-only mutation refusal, missing-proof refusal and replay recovery,
plus existing page/acknowledgement/rights checks (one test passed, 65 not selected). Focused lint, service typecheck,
formatting and scoped diff checks passed. Root `pnpm verify` stopped on concurrent lint before coverage. Logs:
`%TEMP%/rostra-copy-provenance-tests.log` and `%TEMP%/rostra-copy-provenance-verify.log`. DDL was applied only to disposable
source 55453; retained national source/index proofs still require an explicit upgrade and preparation replay.

The refreshed read-only qualification audit covers 48 editions and 268,661 members: 17 blocked versions (16 OpenAI,
17 Voyage). Title 10 is the final active edition. These remain partial counts, not final corpus qualification or
model-quality results. No fingerprinted tokenizer/preparation algorithm changes or provider calls were made.

Added bounded durable copy-verification pages and the explicit `regulatory-copy-validation` task. Each call compares
at most 26 canonical/retained inventory entries and verifies at most 25 generations (default ten), preserving exact
metadata, membership, passage and hash checks. The target transaction saves checkpoints bound to scope, inventory,
ordinal, generation, metadata hash, passage count and source/target revisions. Retries revalidate before overwriting.
No receipt or canonical acknowledgement is created, even when the page reports exhaustion.

Also reject a prepared generation whose body hash differs from current canonical body text, in page and whole-copy
verification. The selected PostgreSQL integration test passed continuation, retry, invalid cursor refusal, changed-body
refusal, three saved checkpoints and unchanged pending source outbox, plus existing acknowledgement/rights checks.
One test selected, 65 skipped; log `%TEMP%/rostra-copy-validation-page-tests.log`. Focused lint, formatting and service
typecheck passed. Root `pnpm verify` stopped on concurrent lint before coverage; log
`%TEMP%/rostra-copy-validation-page-verify.log`. Finalization, stale-revision serving checks and source-markup provenance
binding remain open; see [checkpoint boundaries](copy-validation-checkpoints.md). No embedding freshness or fingerprinted
tokenizer code changed.

Added per-generation mutation counters to both original database schemas as the foundation for INDEX-03. Triggers
advance independent bigint revisions on canonical generation/passage changes, related provision/publication version
changes, and target generation/passage/membership writes. Moves invalidate both IDs; deletion retains tombstones;
truncation advances retained counters; rollback restores prior revisions. Transfer metadata and embedding freshness
contracts are unchanged. These counters are not yet connected to durable validation pages, receipts or serving.

At `2026-09-16T05:20:05Z`, the PostgreSQL canary passed eight mutation/rollback scenarios on disposable source 55453,
Federal Register clone 55456 and its isolated search database. Test content mutations were rolled back. Evidence:
`artifacts/regulatory-backfills/copy-revision-canary.ts/.json`. The tracked acknowledgement/rights integration regression
also passed with source and target counter assertions (one selected test, 65 skipped). Focused lint, service typecheck,
formatting and scoped diff checks passed. Root `pnpm verify` stopped on concurrent lint before coverage; log
`%TEMP%/rostra-copy-revisions-verify.log`. Qualification advanced to 45/49 editions with PID 76852 still live at
12,633.02 CPU seconds. See [checkpoint boundaries and remaining work](copy-validation-checkpoints.md).

Measured copy inspection against retained canonical 55438 and isolated index 55454; the initial run hit the real
`legal_copy_inspection_deadline`. Batched the metadata and membership reads at the existing 25-generation boundary,
retaining row locks, full metadata equality, exact membership checks and all source/passage/hash verification.
For Title 23 this reduces those target queries from 2,474 to 100, without changing the 60-second deadline.

At `2026-09-16T05:11:16Z`, read-only inspection passed Title 3 (33 generations/35 passages, 0.77 seconds) and Title 23
(1,237 generations/1,918 passages, 44.95 seconds). Evidence: `artifacts/regulatory-backfills/copy-inspection-timing.json`
and `measure-copy-inspection.ts`; failure log `%TEMP%/rostra-copy-inspection-timing.log`, successful log
`%TEMP%/rostra-copy-inspection-batched.log`. No source/index writes or provider calls occurred. This is local evidence
under changing workstation load, not a controlled speedup measurement. INDEX-03 remains open: larger scopes need
durable validation checkpoints with mutation invalidation.

The selected real PostgreSQL acknowledgement/recovery/rights regression passed after batching (18.33 seconds of
test time; 65 tests not selected). Scoped lint, service typecheck and diff checks passed. Root `pnpm verify` again
stopped on concurrent lint before coverage; log `%TEMP%/rostra-copy-inspection-batch-verify.log`. The previous pending
verification session 66358 also finished with concurrent lint failures. Qualification remained active at 43/49
completed editions and 12,281.06 CPU seconds; no duplicate run was started.

Closed a copy-acknowledgement completeness gap: checking expected generations did not reject additional target scope
memberships. Inspection and acknowledgement now require the membership count to equal canonical inventory length
before validating every expected item. The real PostgreSQL regression injected 30 extra memberships and verified
both operations reject them, while retaining the existing commit-failure recovery, current-head and rights-cleanup
checks. The selected integration test passed on disposable source 55453 and the isolated search database on 55456;
65 other integration tests were intentionally not selected. Log: `%TEMP%/rostra-copy-membership-tests.log`.

The multi-stage database test required increasing its test allowance from 15 to 60 seconds under workstation load;
its rerun completed in 34.13 seconds of test time. Production deadlines and assertions were unchanged. Focused lint,
service typecheck and scoped diff checks passed. Root `pnpm verify` was invoked and remains in workspace dependency
resolution at this checkpoint (session 66358); log `%TEMP%/rostra-copy-membership-verify.log`. Do not treat it as passed
or start a duplicate until its live handle is checked. INDEX-03's durable resumable validation remains open.

The embedding comparison helper now preflights every document batch and query through both pinned tokenizers before
cache writes or provider requests. The same manifest must satisfy individual and aggregate batch token budgets for
both models. Malformed Unicode is rejected at the manifest boundary. Results retain per-model tokenizer IDs and
per-input IDs, hashes and local token counts; these are not provider billing counts or source-eligibility evidence.

Eleven smoke/cache tests passed, including a token-heavy 65th document rejected before sending the first 64 and an
invalid query rejected before document embedding. The first dual-tokenizer loading test needed a 30-second timeout
under workstation load; its assertions and provider deadlines were unchanged. Service typecheck and scoped lint,
formatting and diff checks passed. Root `pnpm verify` still stopped on concurrent lint before coverage; log
`%TEMP%/rostra-embedding-preflight-verify.log`. Focused log: `%TEMP%/rostra-embedding-preflight-tests.log`.
No live provider calls, source changes or existing-vector regeneration occurred. The running full qualifier remained
live at 11,873.06 CPU seconds with 42/49 editions checkpointed; its fingerprinted implementation was unchanged.

The checkpoint audit now verifies 40 editions and 223,136 canonical members by their retained NDJSON hashes. The
blocked population remains 15 versions (14 OpenAI, 15 Voyage), all unresolved table ditto references; this is not the
final 49-edition result. Extracted and inspected full canonical tables for the four additional provisions outside the
earlier excerpt sample: 40 CFR 52.2723 and 81.324, 49 CFR 1039.11 and 38 CFR 3.261. The complete 85,116 XML bytes are
retained with exact membership/content/artifact hashes and publisher provenance in
`src/ingestion/regulations/fixtures/ditto-continuation-tables.json`.

The failures cross reserved rows, category labels or exception continuations. They remain unresolved rather than
being repaired with a general blank-cell carry-forward rule. Full-table diagnostic replay reproduced each failure.
See [source findings](ditto-source-review.md) and
`artifacts/regulatory-backfills/additional-ditto-source-blocks.json` (`2026-09-16T04:53:34Z`). Source reads and artifact
writes only: no canonical writes, provider calls or fingerprinted implementation changes. Scanner PID 76852 remained
live at 11,644.375 CPU seconds.

Scoped `git diff --check` passed. Root `pnpm verify` stopped before coverage on concurrent chat/agent-pilot lint;
log `%TEMP%/rostra-ditto-source-review-verify.log`. By the end of this review, the active qualifier had checkpointed
42/49 editions. The 40-edition audited counts above remain explicitly scoped to that earlier snapshot.

Extended the bounded planner to `govinfo-fr`, selecting publication observation IDs through their committed batch.
The cutoff is the batch's Rostra publication time, not the document's historical date. Both rights checks and durable
intents now use publication scopes for this source. Added a partial source/ID index with generation references.

At `2026-09-16T04:50:55Z`, the real PostgreSQL canary on disposable clone 55456 selected all 110 retained observations
exactly once across eleven pages. Concurrent calls serialized to distinct pages; recovery preview found all 110 saved
intents with zero remote calls. Revoked rights rolled back the plan and intents. Historical-cutoff rejection,
terminal retry and the actual task wrapper also passed. The source database 55452 was not modified, and temporary
rights changes were restored in the clone. Evidence and query plan:
`artifacts/regulatory-backfills/fr-preparation-plan-canary.ts/.json`. This expands local orchestration evidence without
claiming national completeness, provider throughput or deployed Trigger verification.

Twenty-six focused tests, service typecheck, scoped lint, formatting and scoped `git diff --check` passed.
Root `pnpm verify` remained blocked by concurrent chat lint before coverage; log `%TEMP%/rostra-fr-plan-verify.log`.
The full tokenizer qualification remained live as PID 76852 at 11,528.95 CPU seconds and advanced to 40/49 completed
edition checkpoints. No source schedules or provider embedding jobs were enabled.

Added source-based preparation planning to the dispatch task, advancing ORCH-02. An indexed keyset selects at most ten
published federal eCFR or annual CFR editions per call. Immutable wave parameters, a non-future publication cutoff,
rights validation, dispatch intent and the checkpoint are persisted transactionally before any remote submission.
Recovery uses the same saved wave; planning itself never submits children. This remains a live published-inventory
scan, not a frozen national manifest or a claim of historical completeness. See [selection boundaries](preparation-dispatch.md).

At `2026-09-16T04:44:44Z`, the real PostgreSQL canary on disposable 55453 passed published selection, durable intent and
checkpoint, exhausted replay, changed-model rejection, recovery preview with zero remote calls, conflicting-intent
rollback, future-cutoff refusal and empty-source completion. A revoked rights profile also rejected selection and
rolled back the plan. Its original inactive state was restored after the positive canary. The first canary caught
and corrected a jurisdiction selector mismatch before acceptance. Evidence:
`artifacts/regulatory-backfills/preparation-plan-canary.ts/.json`. The database contained one eligible edition;
eleven-row selection bounds and full-page rights ordering are covered by focused tests, not a national-scale DB trial.

Twenty-five focused planning/recovery/dispatch tests passed, as did service typecheck, scoped lint, formatting and
`git diff --check`. Root `pnpm verify` stopped on two concurrent chat test lint failures (`VoteDetails.test.tsx` and
`resultStore.test.ts`), before coverage. Log: `%TEMP%/rostra-preparation-plan-verify.log`.
Tokenizer PID 76852 remained live at 11,290.80 CPU seconds, and its completed checkpoint count advanced to 38/49.
No fingerprinted preparation code, existing vectors, source schedules or deployed services were changed.

Cleared the Windows formatter blocker with an import-order-only edit to `next.config.ts`, preserving its configuration.
The regulatory/backend coverage pass exercised 45 files: 373 tests passed, 66 database-dependent tests were skipped,
and three tests exceeded the default five-second timeout. No assertion failures were reported. The parser bridge and
replay suites now allow 30 seconds for real Python process startup and filesystem validation; the first dual-tokenizer
table test has the same allowance for loading pinned tokenizer implementations. Production deadlines and assertions
are unchanged. A subsequent parser case also hit five seconds before the suite-level allowance was applied.

All 71 tests in the three affected files then passed with V8 coverage. Service typecheck, focused lint and formatting
passed. This is focused verification, not a full regulatory coverage gate or database integration run. Logs:
`%TEMP%/rostra-regulatory-backend-coverage.log` and `%TEMP%/rostra-regulatory-coverage-retry.log`; the focused coverage
report is under `artifacts/regulatory-backfills/backend-coverage-retry`. Final root `pnpm verify` remains blocked by
concurrent chat lint (`app/chat/resultStore.test.ts`, missing mock type parameters); the earlier attempt also reported
unrelated state-ingestion/frontend unused-code findings. Log: `%TEMP%/rostra-regulatory-verification-unblock.log`.
The full read-only tokenizer process remains active with 36/49 completed checkpoints. No source, vector, provider,
schedule or deployment changes were made in this verification slice.

Preparation dispatch now supports bounded recovery from stored intent using `{ recovery: { waveId } }`, with read-only
preview by default and explicit `execute: true` for submission. Keyset pages contain at most ten intents and verify
the complete selected page's payload hashes and wave/scope/model identities before any remote call. Ready intents
retain their original keys; saved handles are reused; busy and old uncertain records are reported separately. A scan
ending does not imply wave completion, and deferred records require another scan from the beginning.

At `2026-09-16T04:27:45Z`, the disposable 55453 PostgreSQL canary passed five-intent paging without omissions, zero-call
preview, recovery of ready intents only, stored-handle reuse, and corruption rejection before submission. The actual
task function's preview path also passed against that database. Remote responses were simulated; no source, preparation,
provider or embedding work ran. Evidence: `artifacts/regulatory-backfills/preparation-recovery-canary.ts/.json`.
Seventeen focused tests, service typecheck, scoped lint and scoped `git diff --check` passed. Automatic scanning,
Trigger disposition lookup and cancelled/expired-child reconciliation remain open.

Root `pnpm verify` reached clean legislation lint but failed formatting on the existing Windows mapped-file error
for `next.config.ts`; coverage was not reached. Log: `%TEMP%/rostra-preparation-recovery-verify.log`.
Tokenizer PID 76852 remained live at 10,384.44 CPU seconds with 36/49 editions checkpointed; it was not restarted.

Added durable explicit preparation dispatch, advancing ORCH-02/07. The original regulatory migration now defines
`legal_preparation_dispatches`; the Trigger task validates 1–10 reference-only items, records the entire bounded wave
before submission, and serially admits children to the existing two-worker preparation queue. Immutable payload hashes,
fenced leases, globally scoped Trigger keys and saved run handles protect retry behavior. Old uncertain submissions
fail for reconciliation before their seven-day key TTL expires. Submission never counts as preparation completion.

At `2026-09-16T04:21:31Z`, the real PostgreSQL canary on disposable 55453 passed uncertain acceptance replay, saved
handle reuse, changed-payload rejection, expired-key refusal, concurrent submission exclusion, expired-lease fencing
and recovery. Trigger responses were simulated; no children/provider/source/preparation/vector writes occurred.
Evidence: `artifacts/regulatory-backfills/preparation-dispatch-canary.ts/.json`. Seven focused tests passed, including
global key generation and persistence of all wave intents before remote calls. See [dispatch boundaries](preparation-dispatch.md).
National manifest selection, cancelled-run reconciliation, database admission and deployed fault injection remain open.

Service typecheck, focused lint and scoped `git diff --check` passed. Root `pnpm verify` stopped on concurrent
frontend/evaluation lint failures and the existing `next.config.ts` mapped-file error, before coverage.
Log: `%TEMP%/rostra-preparation-dispatch-verify.log`. Tokenizer PID 76852 remained live at 10,110.36 CPU seconds
with 36/49 complete editions; its fingerprinted preparation implementation was not changed.

At `2026-09-16T04:09:41Z`, a read-only audit verified the data-file SHA-256 of all 36 completed tokenizer checkpoints:
202,108 current eCFR members, with 14 OpenAI-blocked and 15 Voyage-blocked versions. All preparation failures were
unresolved ditto references. This incomplete-run snapshot supersedes earlier partial counters, not the eventual full
49-edition result. `artifacts/regulatory-backfills/preparation-blocker-review.json` retains version IDs, locators,
context/tokenizer hashes and first-failure row evidence. Whole-version qualification adds four provisions beyond the
previous blocked-block sample: 40 CFR 52.2723 and 81.324, 49 CFR 1039.11, and 38 CFR 3.261.

Twelve unresolved source-row excerpts are now retained in
`src/ingestion/regulations/fixtures/unresolved-ditto-source-rows.json`. Extraction independently compared complete
block XML and canonical content hashes against source databases 55438/55440, preserving publisher/artifact provenance
and neighboring rows without inferred values. The [source review](ditto-source-review.md) separates label rows,
descriptive continuations and ordinary blank cells, and identifies the additional full-version review work. It does
not authorize a general carry-forward rule. No source writes, embedding calls or fingerprinted implementation edits
occurred. Scanner PID 76852 remained live at 9,645.34 CPU seconds; no duplicate run was started.

`git diff --check` passed for the review and fixture. Root `pnpm verify` was attempted; unrelated concurrent frontend
lint failures and the existing `next.config.ts` mapped-file error stopped verification before coverage.
Log: `%TEMP%/rostra-ditto-source-review-verify.log`. No tests were added for this evidence-only review; canonical
database/block/hash comparisons supplied the extraction validation.

The organization-gated `search_regulations` MCP tool now delegates to `LegislationApiClient.searchLegal` through the
existing same-principal API credential provider. It shares the public request schema, HTTP response validation,
frozen continuation and combined response-size budget. Discovery excludes unapproved organizations; every invocation
checks credential audience and caller identity before HTTP access. No database/provider access was added to MCP.

At `2026-09-16T04:04:09Z`, the real-database streamable HTTP MCP canary passed search discovery, exact hit/generation
parity with HTTP, the next frozen page, and composed exact-text and selected-context parity. Unknown tool arguments
were rejected before HTTP. Source 55438 and disposable target 55455 were used with separate signed fixture API/MCP
tokens. Only target query-cache writes occurred; source/index writes and provider calls were zero. Evidence:
`artifacts/regulatory-backfills/legal-search-mcp-canary.ts/.json`. This advances TOOLS-01/03/04/08/09 without closing
deployed credentials/router acceptance, broader source scopes or semantic/vector search.

Focused MCP tests passed (49 tests), including changed-principal denial, revocation and oversized combined response
rejection. Service typecheck and scoped lint passed. Root `pnpm verify` stopped on six unrelated frontend mock-type
lint errors (`app/chat/prompt.test.ts`, `app/chat/agent.test.ts`) and the existing mapped-file error in `next.config.ts`;
coverage was not reached. Log: `%TEMP%/rostra-legal-search-mcp-verify.log`. Tokenizer process 76852 was confirmed live
at 9,238.42 CPU seconds with 35/49 editions checkpointed; no duplicate process was started.

`POST /api/search/legal` now has an explicit Next route, authenticated reusable handler, application orchestration and
`LegislationApiClient.searchLegal`. It projects verified edition hits into the public DTO with publisher provenance,
acquisition date, rights attribution, canonical version hash, exact selected context and bounded snippets. Current
eCFR heads can be selected by code IDs; explicit edition selection supports published eCFR/annual scopes with copy
acknowledgements. Missing/unprepared requested scope is never silently excluded. Public filters and requested mode
are bound into persisted cursors. Unsupported publication/statute/agency/state scopes fail explicitly; semantic requests
require explicit permission for lexical fallback. See [search serving](../../../legislation-web/docs/regulations/legal-search-serving.md) for exact limitations.

At `2026-09-16T03:59:22Z`, the real-database HTTP/client canary passed exact cross-title hits, canonical version hashes,
provenance, pagination, current-code selection, explicit fallback, unavailable-scope refusal, changed-mode cursor rejection,
and separate missing-token/MCP-audience/wrong-organization rejection. Source 55438 and disposable target 55455 were used;
only query-cache records were written, with no source/index writes or provider calls. Evidence:
`artifacts/regulatory-backfills/legal-search-http-canary.ts/.json`. This uses signed test credentials through the actual
authenticated Web Request/Node handler bridge, not deployed Next or real WorkOS credentials. Focused tests passed
(56 tests), service typecheck and scoped lint passed. HTTP-09/14/15 are advanced, not closed; MCP search, broader corpus
filters, semantic search and deployed verification remain open.

Root `pnpm verify` was attempted for the HTTP slice and again failed on four unrelated mock-type lint errors in
`app/chat/prompt.test.ts` and Windows mapped-file error 1224 for `next.config.ts`. Coverage was not reached.
Log: `%TEMP%/rostra-legal-search-http-verify.log`; scoped `git diff --check` passed. The existing tokenizer process
76852 was verified live at 9,054.73 CPU seconds, with 32/49 completed editions; no restart was performed.

Public search response validation now binds results to the normalized request, advancing HTTP-01/09 before endpoint
wiring. It rejects mismatched corpora, jurisdictions, source-agency IDs, codes, editions, publication kinds/dates,
requested modes/limits and unapproved lexical fallback, including empty responses. Historical `asOf` results must
carry the exact date with publisher point-in-time evidence. Duplicate owner/version pairs, inconsistent truncation,
short continuing pages and repeated cursors are rejected. Code filters now explicitly require code-only corpora.
The agency selector uses source-agency IDs so unresolved agencies remain queryable; no organization mapping is invented.

Focused wire/request tests passed; service typecheck and scoped lint passed. Root `pnpm verify` failed on four
unrelated mock-type lint errors in `app/chat/prompt.test.ts` and the mapped-file error 1224 in `next.config.ts`;
coverage was not reached. Log: `%TEMP%/rostra-search-response-verify.log`. This is shared contract implementation,
not a shipped public search route/client/MCP tool. Public projection, scope resolution and transport wiring remain next.
Tokenizer PID 76852 was verified live at 8,524.94 CPU seconds with 30/49 editions checkpointed; no duplicate was started.

Internal edition search now supports persisted frozen pagination, advancing INDEX-08 without closing the public
search API/MCP gate. Candidate identities and scores expire after 15 minutes, bind caller/query/scope/page size and
rights/generation state, and are rehydrated against canonical storage per page. The ranked window is capped at 1,000
exact versions with an explicit truncation flag. At `2026-09-16T03:41:52Z`, a real database canary verified frozen
ordering, fresh-service replay, changed-request rejection, corrupted candidates, expiry and bounded cleanup.
Only query-cache records on disposable target 55455 were written; source/index writes and provider calls were zero.
Evidence: `artifacts/regulatory-backfills/edition-pagination-canary.ts/.json` and
[pagination contract](../../../legislation-web/docs/regulations/edition-search-canary.md). Focused search tests passed (14 tests); service typecheck and scoped
lint passed. Public filters/snippets, default-current and publication scopes, HTTP/MCP wiring and deployed acceptance
remain open. Dedicated snapshot retention cleanup is also an operational gate.

Root `pnpm verify` was attempted for this slice but stopped at the unrelated Windows mapped-file error 1224 while
formatting `next.config.ts`; coverage was not reached. Log: `%TEMP%/rostra-search-pagination-verify.log`.
`git diff --check` passed. The existing read-only tokenizer process remains active and has checkpointed 26 of 49
editions; it was not restarted or duplicated.

Cross-edition lexical retrieval is implemented as an internal application service in `src/api/legal-edition-search.ts`.
It accepts discovered edition IDs instead of internal passage/preparation IDs, checks every selected source's rights
before target access, selects matching acknowledged preparations through target receipts, compares ordered generation
identity/metadata signatures and passage counts, then ranks across the authorized editions. It returns one best
passage per exact version and checks returned text/input, metadata and source membership against canonical storage.
See [cross-edition lexical retrieval](../../../legislation-web/docs/regulations/edition-search-canary.md). This advances INDEX-02/06/07; publication/default-current
selection, public search DTO/route/MCP, snippets and full reconciliation remain open. Frozen paging was added above.

At `2026-09-16T03:23:40Z`, the retained Titles 3 and 23 canary returned both the ethical-conduct section and the
reimbursement table from one query, with unique versions, explicit truncation and stable replay after edition-ID
reordering. Narrowing to Title 3 excluded Title 23. Adding an unacknowledged edition refused the entire request.
The final all-generation metadata check took 340.2771 ms over the local 1,270-generation / 1,953-passage pilot;
this is not a national-volume performance result. Evidence: `artifacts/regulatory-backfills/current-edition-search-canary.ts/.json`.

At `2026-09-16T03:29:22Z`, six real fault injections passed against a disposable copy of the target database on port
55455 (`rostra-edition-search-corruption`): missing passage, missing membership, changed receipt, metadata drift in a
generation that was not returned, scope revocation and changed copied text. Every case failed closed and every
restoration produced the exact baseline result. Source port 55438 and retained target port 55454 were not mutated.
Evidence: `artifacts/regulatory-backfills/edition-search-corruption-canary.ts/.json`; clone source is
`artifacts/regulatory-backfills/legal-search-canary.sql`. No provider calls, source reimports or embeddings were made.

Eight focused search tests, service TypeScript and scoped lint/format/diff checks passed. Required root `pnpm verify`
failed on six unrelated missing mock-type lint errors in `app/chat/prompt.test.ts` and the mapped `next.config.ts`
formatter lock, before coverage. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-edition-search-verify.log`.
Public/deployed acceptance is not implied. The current qualification process remains live as PID 76852; its latest
completed checkpoint is still 25/49 editions, 162,230 records, ten OpenAI and eleven Voyage unresolved-ditto version
blockers. It was neither restarted nor duplicated while independent implementation proceeded.

Edition discovery and provision traversal are implemented locally through explicit code-editions and code-provisions
HTTP routes, typed client methods and `list_legal_editions` / `list_legal_provisions` MCP tools. They support source/date
edition filters and root/child/all structural traversal, preserve exact version membership, and pin continuation to
the selected edition even when selection began at the current eCFR head. Traversal checks API/MCP and display rights
before headings or parent membership. Unsupported `asOf` returns 409 without substituting nearby text. See
[edition and provision browsing](../../../legislation-web/docs/regulations/legal-edition-browsing.md). Code/edition detail and coverage reporting remain open.

The current-corpus canary at `2026-09-16T03:01:35Z` verified all 1,237 Title 23 provisions across 13 HTTP pages in
exact database structural order, plus root/child traversal. Through real MCP transport and its API-backed client it
discovered Title 3's edition, enumerated all 33 members across two pages, and read 3 CFR 100.1 losslessly. The text
hash matched `17a38a2e270a2659429dad1a954341ba5b70ec5627f84a464878d471398cc188`. Wrong-code edition selection
returned 404 and unsupported historical selection returned 409. The local canonical database now also has the
`legal_edition_provisions_children_idx` from the updated original migration baseline and Drizzle schema; no source
rows or embeddings were changed. Evidence: `artifacts/regulatory-backfills/current-regulatory-browse-canary.ts/.json`.

The separate annual-CFR service canary at `2026-09-16T03:02:40Z` paged all three published Title 5 volumes, excluded
two unpublished editions, and traversed an explicitly selected annual volume. The selected native package
`CFR-2025-title5-vol2` retained its `2025-01-01` issue date and `annual_volume` scope. This is published-volume discovery,
not a historical coverage assertion. Evidence: `artifacts/regulatory-backfills/annual-browse-canary.ts/.json`.
Both canaries use retained local data and test identities; neither proves deployed Next routing or live WorkOS acceptance.

The real HTTP canary exposed a shared client defect: the server emitted a JSON object in optional error `details`,
but the strict client rejected any details field as malformed. The client now validates/preserves those details,
and the MCP adapter retains them internally with trusted correlation/status/retryability fields. A regression test
covers the historical-coverage error, and the shared error contract now matches runtime behavior.

Verification: 66 focused tests passed across eight suites, including the API client and MCP adapter regressions.
Service TypeScript, scoped lint, formatting and `git diff --check` passed. A mapped-file formatting failure in the
changed adapter test was repaired with the formatter's exact output and its check passed. The final root `pnpm verify`
run had ten successful check tasks but still failed formatting on unrelated `next.config.ts` (Windows error 1224),
before coverage. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-legal-browse-verify.log`. Fluent MCP remains unavailable.

Qualification checkpoint: PID 76852 remains live, with 25 of 49 editions / 162,230 records complete and ten OpenAI /
eleven Voyage unresolved-ditto full-version blockers. New blocked editions since the prior entry include
`6e0257ba-0820-4cdb-af75-9e7f9e74f99b` (three) and `7785659b-631d-4d9a-a7c6-682d3f2e0fa6` (one).
These partial results require source review; they do not establish model retrieval quality. No restart, provider
embedding calls, existing-vector regeneration or recurring source ingestion was performed.

Published code discovery is implemented locally through `GET /api/legal/codes`, the strict typed client and the
API-backed `list_legal_codes` MCP tool. The service locks and validates active API/MCP rights before metadata
aggregation, restricts this release to published official federal editions, and binds continuation to the caller,
filters, page size, rights hashes and visible catalog. See [the discovery contract](../../../legislation-web/docs/regulations/legal-code-discovery.md).
Code detail, editions and traversal remain open; catalog membership makes no search or historical completeness claim.

The retained database canary at `2026-09-16T02:44:47Z` returned exactly 49 canonical code IDs over three HTTP pages
and three MCP pages, with identical ordering and no duplicates. It used the real PostgreSQL pilot on port 55438,
signed test tokens, the API authentication handler, typed HTTP client and real MCP transport. Changed page-size
continuation returned 409, and state/statute filters returned empty pages with the coverage warning. No source data
or embeddings were written. Evidence: `artifacts/regulatory-backfills/current-codes-http-canary.ts` and its `.json`
report. This proves local transport/database integration, not deployed Next routing or live WorkOS credentials.

Focused verification: 17 tests passed across the codes service, codes HTTP, existing text HTTP and MCP suites
(the codes HTTP fixture was corrected and its two tests rerun). Service TypeScript, scoped lint and `git diff --check`
passed. Root `pnpm verify` reached ten successful check tasks but failed formatting on Windows error 1224 for
`next.config.ts` and `src/db/queries/events.ts`; coverage did not run. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-legal-code-discovery-verify.log`. Those unrelated mapped files were not altered
to clear the lock. Fluent MCP was unavailable, so new API/tool strings have not received Fluent validation.

The full offline qualification remains live as PID 76852. At this checkpoint, 20 of 49 editions and 133,805 records
were complete, with six OpenAI and seven Voyage full-version preparation blockers, all unresolved table ditto cases.
The newly observed blocked edition is `5d3e8147-f208-4ead-980c-ad33d62fa221`, report key
`5ff8ec6117d428e366fdb66f7574734f512a75c6a6ee50d8b9f5e29bb2ebadcf`. These are partial counts, not a completed corpus
qualification or model-quality comparison. The running job was not restarted or duplicated.

Title 23 now completes the persistent lexical pipeline in the retained local pilot. Edition
`40bd49b4-6207-48f0-ada0-9c35181986d5` has 1,237 prepared versions, 51 source table blocks and 1,918 passages
using the pinned OpenAI tokenizer. All stored passage-manifest hashes/counts match its completed offline qualification.
Preparation and copy each used 124 sequential batches of at most ten records, followed by whole-copy inspection,
acknowledgement and replay. Total elapsed time was 340.861 seconds; acknowledgement and replay took approximately
17.752 and 16.541 seconds between inspection timestamps. This is a local sequential pilot, not a deployed fan-out benchmark.

The appendix to 23 CFR Part 140 Subpart F supplies the table retrieval canary: `Cumulative amount reimbursed`
returns one hit identical to canonical search. Unacknowledged, absent-identity and wrong-organization reads are denied.
The separate search database on port 55454 now holds acknowledged Titles 3 and 23, totaling 1,270 generations and
1,953 passages. No embeddings or source reimports were performed. Preparation ID:
`9409c0005f2857a85cb42fe6785309f24acf163e5a009b3b221d19d2701ee813`.
Evidence: `artifacts/regulatory-backfills/current-title23-index-pilot.ts` and `current-title23-index-pilot.json`;
log `C:/Users/andcra/AppData/Local/Temp/rostra-current-title23-index-pilot.log`. Required root `pnpm verify` stops on
unrelated legislative-query/UI lint errors and formatter file locks before coverage (`rostra-current-title23-index-verify.log`).
National qualification remains active; large-scope resumable acknowledgement and deployed HTTP/MCP remain open.

The still-running whole-current-corpus scan has completed Title 40 (30,310 versions). OpenAI prepares 30,306 and
blocks four; Voyage prepares 30,305 and blocks five, all on unresolved ditto references. The additional Voyage blocker
is 40 CFR 81.324, version `4665d270-022a-489d-876a-70c3e9e480a7`; OpenAI prepares 35 passages / 14,392 tokens there
(maximum 1,176 tokens). This is tokenizer-dependent passage eligibility, not a retrieval-quality result or a reason
to silently omit a version from one candidate's evaluation. Source review and common-corpus disposition remain open.
Evidence: completed edition report `3e72bbf6ec4c13649d070dbd632ad0ef2f6ce258f0ee474fbd937bf12276a503` and its
`records.ndjson` under `artifacts/regulatory-backfills/canonical-preparation-all-current`.

The retained current-eCFR database now has its first complete persistent lexical partition: Title 3, edition
`0444c74f-653e-4728-81f5-df9adccb4cf5`. All 33 canonical members prepared with the pinned OpenAI tokenizer into
35 passages; every persisted manifest hash and passage count matches the offline qualification. Four bounded
preparation batches and a zero-work replay passed. Four bounded copy batches, whole-copy inspection, acknowledgement
and acknowledgement replay passed in the new isolated `rostra-current-regulatory-search` database on port 55454.
Preparation ID: `a46f1c4b9570fe1c1d86beb12ec85e190c86dc2296604f5dcaeebade0141fb09`.

The explicit-version application canary for 3 CFR 100.1 returns one `ethical conduct` hit identical to canonical
search, including passage identity, data and score. The same request is refused before acknowledgement, without
identity and under another organization. These are local application-boundary checks using synthetic request context,
not deployed HTTP/WorkOS/MCP authentication evidence. No embeddings were requested or existing vectors changed.

Only the four previously absent passage/preparation tables and their indexes were provisioned on retained port 55438,
transactionally from the current original migration baseline. Existing source tables, memberships, imports and rights
were preserved; no stale workflow records were migrated. The separate search database uses `infra/passage-search/legal.sql`.
Evidence: `artifacts/regulatory-backfills/current-passage-bootstrap.sql`, `current-title3-index-pilot.ts` and
`current-title3-index-pilot.json`; log `C:/Users/andcra/AppData/Local/Temp/rostra-current-title3-index-pilot.log`.
The actual readiness CLI exits zero with expected/present/prepared counts all 33 and zero blocked, unattempted,
missing or extra checkpoints (`current-title3-preparation-status.json`). Source reconciliation remains 49 current
titles / 275,149 members after provisioning and execution. `git diff --check` passes. Required root `pnpm verify`
again stops before coverage on the concurrently open `next.config.ts` formatter write (Windows error 1224); log
`rostra-current-title3-index-verify.log` in the same temporary directory.
This advances PASS-09 and INDEX-12 for one current title. Full-scope qualification, unresolved table references,
large-partition resumable acknowledgement, cross-corpus search, model selection and deployed HTTP/MCP remain open.

The read-only preparation status service and `inspect:regulatory-readiness --preparation <id>` command now expose
expected/present/prepared/blocked/unattempted counters, missing/extra checkpoints, active leases, retry delays and
bounded failed-version pages. They use a repeatable-read snapshot and existing source-rights locks, return no source
bodies or lease tokens, and do not write checkpoints or acknowledge outboxes. The command reports preparation
checkpoints only: even an idle complete result is not source/target integrity, serving or embedding acceptance.

The PostgreSQL test on disposable port 55453 passes for pending/blocked accounting, two failure pages, unchanged job
state, active lease/delayed retry, deliberately missing checkpoint, revoked rights, unknown preparation and invalid
page size. The actual CLI under revoked rights returns only `rights_profile_unavailable` and exit 1. Service/script
type-checks and scoped lint pass. Required root `pnpm verify` stops at a concurrent-file formatting failure in
`next.config.ts` (Windows error 1224) before coverage; see
`C:/Users/andcra/AppData/Local/Temp/rostra-preparation-status-verify.log`. Focused evidence is in
`rostra-preparation-status-storage.log` and `rostra-preparation-status-denied.log` in the same directory. This advances
PASS-10/ORCH-12 diagnosis; broad stage reconciliation, deployed operator access and production acceptance remain open.
The full current-eCFR qualification process 76852 was confirmed live while this independent slice was implemented.

The first full current-eCFR offline qualification attempt stopped on `shape_implementation_changed` at 17:56 local:
the shared workspace lockfile changed at 17:54 while the scanner was running. It correctly refused to publish the
in-flight edition; only Title 3 completed under that fingerprint. The incomplete output is retained as failed-run
evidence. The scanner now fingerprints its selected dependency closure, including transitive/peer/optional packages,
integrity metadata and patches, instead of unrelated workspace dependencies. Actual implementation or relevant
dependency changes still invalidate the run; no integrity gate was removed. Node/platform identity also binds reports.

The dependency-fingerprint repair passed five regression tests covering unrelated workspace edits, peer cycles,
optional dependencies, selected patches, missing/unsupported references and stable YAML ordering. Service/scanner
types and scoped lint pass. The real Title 3 smoke and exact replay pass with unchanged 33-member / 35 OpenAI /
36 Voyage counts. Evidence: `artifacts/regulatory-backfills/qualification-dependency-smoke/inventory.json`, fingerprint
`b937c67b727196d5e97e66df41dd8cb8bbf1732eb5bc70762ea33d6bbfe78792`.
Required root `pnpm verify` passed legislation lint but stopped before coverage when the formatter could not write
the concurrently open `apps/legislation/next.config.ts` (Windows error 1224). Logs in the temporary directory use
`rostra-qualification-dependencies-` with `retest.log`, `types.log`, `smoke.log`, `replay.log` and `verify.log` suffixes.
The full read-only 49-title qualification has been restarted under the repaired fingerprint in the same output root;
the former content-addressed results and failed-run partial data remain retained. Restarted September 15 at 18:06 local
as hidden Node process 76852. New logs: `rostra-preparation-scoped-dependencies.stdout.log` and
`rostra-preparation-scoped-dependencies.stderr.log` in the temporary directory. No source imports or vectors were changed.

The initial full current-eCFR offline qualification used the retained read-only pilot on port 55438. A fresh source
query reconciled 49 current editions and 275,149 members before dispatch; no completed imports were repeated.
The scanner runs both pinned tokenizers with production context across every selected canonical member. This is
PASS-07 execution only: it does not persist preparations, create vectors or enable serving/recurring ingestion.

Started September 15 at 17:48 local time as hidden Node process 35948. Output:
`artifacts/regulatory-backfills/canonical-preparation-all-current`; implementation fingerprint:
`1c95624fc622d9ac30fc260bea1bc7e11909dac499607ee719d4dce3605440ea`.
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-preparation-all-current.stdout.log` and
`rostra-preparation-all-current.stderr.log`. The first completed edition is Title 3 (33 members, zero blockers,
35 OpenAI / 36 Voyage passages), matching its earlier counts. The progress manifest still says `complete: false`;
the remaining 48 editions and aggregate eligibility counts are not yet validated. Per-edition reports retain source
and implementation bindings; a changed implementation prevents publication of an in-flight edition report.
The launch-only follow-up changed no runtime code. `git diff --check` passes. Required root `pnpm verify` stopped at
six unrelated chat-research lint errors before coverage; log `rostra-preparation-all-current-verify.log` in the same
temporary directory. The qualification process remained active with a growing next-edition output after that check.

Canonical preparation now records deterministic source blockers per version and continues through later records.
Each failed checkpoint retains its version, ordinal, reason and timestamp under the existing rights and fenced-lease
checks. A fully accounted scope with any blocker ends in `blocked`, never `prepared`; index copying continues to reject
it. Trigger continuations stop at this terminal state. Explicit `retryBlocked` dispatches retry failed items without
rebuilding successful generations; the flag is not propagated to successors. Unknown/storage/tokenizer failures still
throw and retain the existing retry behavior. This changes the unreleased schema baseline; retained pilots have not
been migrated or reset. No embedding calls, existing-vector changes or recurring source schedules are involved.

Validation: 31 unit tests passed across blocker classification, offline inspection and Trigger continuation, plus four
real-PostgreSQL preparation tests on the fresh disposable `rostra-preparation-blocker-tests` database (port 55453).
The new database cases prove continuation beyond a blocked item, rejected index copying, explicit-only failed-item
retry, unchanged successful generations, rights/live-lease rejection and rollback when the lease expires during a
failure checkpoint. Existing bounded resume and committed-generation recovery tests also pass. Service and scanner
types and scoped lint pass. Tests used the isolated backend Vitest configuration because the shared frontend plugin
previously stalled test initialization. Required root `pnpm verify` stopped before coverage at unrelated unused
`@ai-sdk/mcp` and `CitedAnswer` declarations. Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-preparation-blockers-`
with suffixes `storage.log`, `unit.log`, `retest.log`, `types.log` and `verify.log`. The unit log contains the initially
incorrect pool-argument assertion; the retest confirms all 14 continuation tests pass after correcting it.

The complete read-only Title 25 qualification has finished: all 5,522 members / 5,226,692 canonical characters were
accounted for, including 62 versions with 70 table blocks. Both tokenizers prepare 5,521 versions and block the same
one appendix on `passage_table_unresolved_ditto`. OpenAI produces 5,990 passages / 1,328,601 tokens (maximum 1,097);
Voyage produces 6,024 passages / 1,425,145 tokens (maximum 955). No invalid reader, oversized version or empty-text
failure was recorded. Evidence: `artifacts/regulatory-backfills/canonical-preparation-title25/inventory.json`, under
the earlier implementation hash `409b3f8a72b226c29792ee6003689cfad50fa9303dc4c86eb5f0e5e848999354`.
These are offline qualification results, not persisted preparation or embedding-quality results.

The read-only edition inventory now has `--prepare` for full canonical-version qualification with both pinned
tokenizers. It uses the production context expression and real version anchors, records each model's prepared/blocked
disposition, manifest/context hashes, passage/token totals, maxima and continuation counts, and independently recounts
every model input. Known source-shape failures remain explicit while other records continue. Unknown/tokenizer errors
and recount/reconstruction mismatches stop the run. Empty structural nodes have zero passages; oversized reads count
as model blockers. Mode, tokenizer identities, context-producing metadata and implementation hashes bind replay.
Completed reports cannot publish after an implementation change. This adds PASS-07 execution tooling, not persisted
preparations, embeddings, source imports or search promotion.

The complete retained Title 3 smoke accounts for all 33 members / 27,555 canonical characters: 35 OpenAI passages
(6,829 tokens, maximum 777) and 36 Voyage passages (7,531 tokens, maximum 789), with zero blockers. Exact report replay
reuses the prepared result; structural-only mode selects a distinct report. Altering a stored token total causes
`shape_report_replay_mismatch`. Evidence: `artifacts/regulatory-backfills/canonical-preparation-inventory-smoke/inventory.json`,
implementation hash `409b3f8a72b226c29792ee6003689cfad50fa9303dc4c86eb5f0e5e848999354`. The smoke contains no tables;
a separate complete Title 25 qualification subsequently finished as recorded above, with output under
`canonical-preparation-title25` and log `C:/Users/andcra/AppData/Local/Temp/rostra-preparation-title25.log`.

Sixty-five focused tests across four files passed; after test-lint repairs, all seven new inspection tests passed again.
Service types, standalone scanner types and scoped lint passed. Required root `pnpm verify` stops on eight unrelated
chat UI lint errors and also reports a failed `origin/main` fetch. Full coverage was not reached. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-preparation-inventory-tests.log`, `rostra-preparation-inventory-retest.log`,
`rostra-preparation-inventory-smoke.log`, `rostra-preparation-inventory-replay.log`,
`rostra-preparation-inventory-corruption.log`, and `rostra-preparation-inventory-verify.log`.
Full selected-corpus qualification, the twelve known ambiguous references, graphics and persisted preparation/indexing
remain open. No existing vector, embedding freshness contract or recurring source schedule was changed.

Oversized rows now support already resolved ditto references. Cell extraction validates the row through the same
table-context resolver before allowing a split; the passage writer repeats exact referenced values and group labels
on every fragment. Plain and dotted chains across an explicit full-width heading pass both pinned tokenizers, exact
reader reconstruction, context-span checks, independent counts and deterministic replay. Missing/blank predecessors
and context that exhausts the target budget remain failures. No source text, freshness contract or stored vector changed.

The 457-block retained-source recheck still prepares 445 blocks with each tokenizer and records the same twelve
unresolved-reference failures. This repairs an independent continuation restriction, not those source ambiguities.
Evidence: `artifacts/regulatory-backfills/resolved-ditto-preparation-dispositions.json`, implementation hash
`6b28dbedc1982c267b2d88b51bfaf2150366204f4a0baa6d75f3ba1230bc2052`. The source inspection confirms remaining
cases include blank data cells, unmarked headings, and the physical split of `Titanium dioxide-magnesium` / `silicate`
in 21 CFR 176.170. No general carry-forward rule was introduced for these ambiguous cases.

Seventy-seven focused tests across four files passed in 10.15s using the temporary backend configuration described
below; service types, scoped lint and `git diff --check` passed. Required root `pnpm verify` again stops at the same
unrelated frontend unused dependencies and `CitedAnswer` export, before coverage. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-resolved-ditto-focused.log`, `rostra-resolved-ditto-canary.log`, and
`rostra-resolved-ditto-verify.log`. The twelve source reviews, full previously accepted-table requalification, graphics,
canonical partition preparation, indexing, model-quality evaluation and deployed API/MCP gates remain open.

Dotted ditto markers now resolve to exact earlier column spans instead of becoming literal replacement values.
The [source-backed repair](passage-shape-inventory.md#dotted-ditto-markers) covers the 561 `......do` and one
`............do` cells observed in the retained 457-block source set. A Title 25 excerpt verifies the original reservation
names across a dotted chain with both tokenizers; synthetic HTML/GPO cases verify missing predecessors, blank data
cells, literal lookalikes and rejection by unsafe oversized-cell continuation. The common predicate is used in both
row context and continuation validation. Canonical text, tokenizer contracts, existing vectors and schedules are unchanged.

All 457 original blocks were rechecked with both pinned tokenizers: 445 still prepare and 12 still fail with unresolved
ditto references. Correct source context adds 38 tokens per model to 14 CFR 171.311 block 65, retaining 32 passages per
model. Its complete 44,648-byte canonical provision also prepares with production context and real anchors: 82 OpenAI
passages (maximum 759 tokens) and 84 Voyage passages (maximum 792). Both reconstruct exactly, recount within limits and
replay identically. Evidence: `dotted-ditto-preparation-dispositions.json` and `canonical-dotted-ditto-smoke.json` under
backfill artifacts, implementation hash `6dcaafde20841056820d99447c9e73e3348cb9c3f8a29038ddb2947b5b6a8a51`.
Earlier canary reports were retained. No preparation records or embeddings were written. Requalifying all previously
accepted split tables, the 12 unresolved cases and chart acquisition remain open; aggregate parity is not byte parity.

Seventy-four focused tests passed across four files, plus service types and scoped lint. The default Vitest invocation
stalled before reporting any test results while the shared configuration included the concurrent frontend CSS plugin;
only this task's test processes were stopped. Focused tests then passed in 8.39s with an ignored temporary backend
configuration that omits frontend plugins. This is not a claim that the shared test configuration passed. Root
`pnpm verify` passes all ten lint tasks but stops at unrelated chat UI unused dependencies (`@ai-sdk/mcp`,
`@ai-sdk/react`, `@openrouter/ai-sdk-provider`) and the exported `CitedAnswer` type. No unrelated configuration or
frontend files were edited. Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-dotted-ditto-focused-backend.log`,
`rostra-dotted-ditto-canary.log`, `rostra-dotted-canonical.log` and `rostra-dotted-ditto-verify.log`.

Explicit full-width table group headings now preserve a preceding same-column ditto reference while adding the new
group label as independent context. The source-backed 21 CFR 107.100 fixture covers `Minerals`, calcium and the earlier
`Milligrams` unit with both pinned tokenizers at deliberately small passage budgets. Partial groups, blank separators,
blank data cells and separate tables still cannot supply inferred values. Original text and embedding contracts are unchanged.

The [updated disposition canary](passage-shape-inventory.md#ditto-scope-and-preparation-gates) distinguishes structural
row-layout diagnostics from actual model-input preparation. Of the original 457 blocks, 298 now pass row layout;
138 retain header/caption-only diagnostics and 21 retain unresolved-ditto diagnostics. Actual preparation succeeds for
445 blocks with each tokenizer and fails for 12 unresolved-ditto cases. All 138 header-only blocks prepare their retained
text; chart acquisition is still a separate gate. This supersedes the earlier description of all 160 diagnostics as
preparation blockers. The group-heading repair improves one layout but does not reduce the 12 default-budget failures.

Two complete canonical provisions were also prepared read-only with real version anchors and the production inventory's
context expression. Both passed content-hash checks, exact reconstruction, independent token recounts and identical
in-memory replay. 21 CFR 107.100 produces three passages with each tokenizer (maximum 412 OpenAI / 455 Voyage tokens).
The 65,538-byte 7 CFR 1755.397 provision, including its intentionally unfilled form appendices, produces 47 OpenAI and
49 Voyage passages (maximum 780 / 753 tokens). Evidence: `table-preparation-dispositions.json` and
`canonical-table-context-smoke.json` under `artifacts/regulatory-backfills/`, each bound to implementation hash
`3f4fa5b147c3c0856471a038abe786b8802975f12d73c4a1b4180c413a36a58a`. These are local preparation checks,
not persisted manifests, indexing, model-quality evaluation or embedding requests. No retained database was migrated.

Sixty-five focused tests, scoped lint and service types passed. Full legislation coverage passed 3,187 tests (156
optional tests skipped), plus four receiver tests, in 6m0.782s. Root `pnpm verify` stops on `no-console` in the concurrent
The temporary OpenStates ranked-passage inspector used the shared search implementation; it was removed after acceptance.
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-ditto-group-verify.log` and `rostra-ditto-group-coverage.log`.
Next: source-backed resolution of the 12 actual failures, dotted-leader recognition with requalification of affected
accepted tables, separate graphic/form dispositions, and full canonical partition preparation. Existing vectors and
recurring schedules remain unchanged.

Blank publisher table-row support now covers whitespace-only HTML header/cell rows and GPO ruling rows containing
blank indented cells. Empty rows clear grouping and ditto context; unknown markup, images, invalid spans and interleaved
headers remain rejected. Four retained source fixtures include official URLs/artifact hashes, canonical versions and
exact block locators. Tests cover both pinned tokenizers, exact reconstruction and context-boundary failures.

The [complete blocked-table follow-up](passage-shape-inventory.md#blank-publisher-rows) reads the retained baseline
reports and verifies their NDJSON hashes before publishing evidence collected for all 457 blocked blocks through
read-only, rights-checked canonical queries. The source evidence contains 1,538 blank rows. After the repair, 297 blocks (292 eCFR, five annual)
pass row reconstruction and both model-tokenizer preparation/recount canaries. None exceeds the 1,200-token/16,000-character
canary budgets. This is source-block evidence with synthetic anchors and a fixed `Federal code` context, not publication
of final canonical preparations, an embedding request or a full corpus readiness claim.

There are now 160 explicitly blocked cases in that inventory: 138 eCFR blocks contain a table with headers/captions
but no textual data rows, and 22 have unresolved ditto references (21 eCFR, one annual). Review the first group against raw source,
adjacent graphics and intentionally blank forms before claiming table acquisition. Resolve the second with exact
source-column references; no inferred values or cross-separator context were introduced. The next step is those
dispositions followed by full canonical-version/tokenizer requalification. Source imports, vectors and schedules were unchanged.

Evidence under `artifacts/regulatory-backfills/`: `blocked-tables-source.json`, `empty-table-row-shapes.json`, and
`empty-row-repair-check.json`. Sixty-three focused tests and service types passed. Root verification's first run exposed
and prompted a test-lint repair; its final run passes lint but stops at unrelated unused/unlisted frontend files,
dependencies and exports in the concurrent chat UI work. Full legislation coverage passed 3,174 tests (156 optional
tests skipped), plus all four receiver tests, in 2m42.053s. `git diff --check` passed for this slice.
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-empty-row-repair.log`, `rostra-empty-rows-verify.log`,
`rostra-empty-rows-verify-final.log`, and `rostra-empty-rows-coverage.log`.

The [canonical passage inventory](passage-shape-inventory.md) now reads retained eCFR/annual editions with a database-enforced
read-only connection, 16 MiB body batches, canonical content-hash checks and exact reader reconstruction. Completed
edition reports bind the source inventory, rights, implementation and NDJSON hashes; replay checks the bytes and counts.
Corrupted valid JSON and malformed report data were rejected; a remote database URL was refused before connection.

The complete baseline accounts for all 275,149 current eCFR members and 9,003 annual members (Title 5's three volumes
plus Title 2 volume 1). No canonical hash mismatches or oversized-read omissions occurred. The eCFR baseline identifies
451 blocked table layouts across 268 versions: 430 empty-row and 21 unresolved-ditto rejections. Annual data adds six
blocked layouts across three versions. Bounded source-locator examples and longest-cell samples are in each inventory's
`samples.json`; all NDJSON hashes were independently verified while generating these samples. Annual replay reused all
four reports. A separate bounded eCFR replay succeeded; full current-code requalification remains distinct from the
recorded baseline implementation, as explained in the inventory page.

One eCFR reader rejection was traced to a U+200B tail after the source note in 15 CFR Part 774. The reader now preserves
that spacing without stripping it or admitting arbitrary unmapped text. Regression coverage checks exact bytes, offsets,
hashes and rejection of substantive gaps or directional controls. A fresh scan of all 2,884 Title 15 records reconstructs
9,980,341 characters exactly with zero reader failures. Source storage and existing embedding contracts were unchanged.

Fifty-eight focused reader, table, inventory, HTTP and native MCP tests passed. The initial full legislation coverage run
passed 3,130 tests plus four receiver tests; the final reader-repair coverage run passed 3,131 tests (156 optional tests
skipped) plus all four receiver tests in 5m30.499s. Scoped lint, service types, standalone CLI types and formatting passed.
The final scanner fingerprint includes its shared reader schemas and digest contracts; the bounded replay smoke passed
again after that fingerprint hardening. Root verification
is not clean: the first run found unused frontend files/dependencies; the later run found unrelated chat-component lint
errors in `ChatWorkspace.tsx` and `ChatProviders.tsx`. Those concurrent frontend changes were preserved. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-shapes-verify.log`, `rostra-regulatory-shapes-final-verify.log`,
`rostra-regulatory-shapes-coverage.log`, `rostra-regulatory-shapes-final-coverage.log`, and `rostra-title15-reader-spacing.log`.

Next passage work is source-backed empty header/layout rows and ditto references, followed by a fresh shape inventory
and both tokenizer manifests. PASS-01 is complete for these retained local scopes only; release-wide historical/FR
inventory, final preparation, deployment, search and embedding gates remain open. Recurring collection stays disabled.

The organization-gated `get_legal_text` MCP pilot now uses the existing typed HTTP client and exact-text endpoint.
Tool discovery is evaluated per authenticated request. The adapter verifies the outbound API token's audience and
requires its organization and subject to equal the incoming verified MCP principal; a shared credential cannot borrow
another caller's authority. Credentials are not forwarded from MCP. This is a restrictive same-principal pilot;
production delegated credentials remain a separate acceptance gate.

The tool returns up to three source blocks per call with exact continuation. The shared MCP response budget now counts
the complete text and structured result, including escaping, rather than only one representation. Native MCP tests
cover cross-account discovery, mismatched credential subjects/organizations/audiences, hostile source strings, Unicode,
oversized inputs, revocation, and exact continuation. Fifty-two focused MCP/adapter/runtime tests and type checks passed.

All 110 retained January 18 FR records round-tripped through a native MCP client, the Next MCP HTTP handler, typed API
client, authenticated API adapter and PostgreSQL pilot: 302 MCP windows, exactly 302 API reads, 1,704,173 reconstructed
characters and a maximum combined MCP result of 117,357 bytes. Both `00-113` publications remained distinct.
Evidence: `artifacts/regulatory-backfills/fr-jan18-legal-text-mcp.json`. This used local fixture keys with real separate
RS256 audience verification, not deployed WorkOS or the built Next router. No corpus, index or vector mutations occurred;
recurring source schedules remain disabled. Coverage discovery, legal search, other tools and deployed acceptance remain open.

Verification follow-up: the initial repository run hit two 5-second timeouts in OpenRouter retrieval and regulatory
backfill tests; their focused rerun passed all 23 tests. Turbo now permits the supported `VITEST_MAX_WORKERS` override
for coverage, preserving the default when unset. With four workers, legislation coverage passed all 3,123 tests
(156 optional tests skipped), while an unrelated web workflow-editor dialog test failed. Its isolated file rerun passed
all 30 tests. The final repository rerun uses four workers without changing test deadlines or editing that web feature.
Fluent MCP was unavailable for the new tool/error-copy review.

Final validation passed: the full web coverage suite passed all 81 tests with one worker; root `pnpm verify` then passed
all nine tasks (eight cached) in 2m54.531s with four workers. The workflow-editor source/tests were unchanged.
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-legal-mcp-tests.log`, `rostra-legal-mcp-web-coverage.log` and
`rostra-legal-mcp-verify-complete.log`. Earlier timeout/dialog failures remain recorded in `rostra-legal-mcp-verify.log`,
`rostra-legal-mcp-verify-bounded.log` and `rostra-legal-mcp-verify-final.log`; isolated rerun logs retain the 23/30 passing tests.

The [exact-version text API](../../../legislation-web/docs/regulations/legal-text-serving.md) now has an explicit Next route, organization-gated database service,
strict wire contract and typed client. Source rights are locked and checked before text reads, and every continuation
binds the account and source selection. MCP audience tokens fail the existing API authentication boundary. The route is
disabled for all organizations by default; no deployment or scheduler configuration changed.

All 110 retained FR pilot records round-tripped through the authenticated HTTP adapter and typed client in 116 windows,
reconstructing 1,704,173 characters exactly, including both distinct `00-113` publications. The smoke used local fixture
JWKS with real RS256 token verification, not deployed WorkOS credentials or the built Next router. Evidence:
`artifacts/regulatory-backfills/fr-jan18-legal-text-http.json`. Discovery, legal search, MCP and deployed acceptance remain
open; no embeddings were created or regenerated.

Validation: 47 focused tests passed; the complete disposable PostgreSQL regulatory suite passed 59 tests with four
optional separate-search-database tests skipped. Root `pnpm verify` passed all nine tasks (eight cached) in 2m17.543s,
including format, lint, types, unused-code checks and coverage. Logs are retained in
`C:/Users/andcra/AppData/Local/Temp/rostra-legal-reader-tests.log`, `rostra-legal-reader-db-full.log` and
`rostra-legal-reader-verify.log`. Fluent MCP was unavailable for API error-copy review.

The complete January 18 FR issue is now [prepared and indexed in the isolated lexical pilot](fr-publication-passage-pilot.md).
All 110 canonical versions reconstruct exactly through the reader. Sixteen publications contain tables; two initially
failed because five empty GPO ruling rows were treated as data. Table preparation now accepts only source-only empty ruling
rows, preserving all text and clearing ambiguous group/ditto carryover. Real-source fixtures and negative tests retain
rejection of empty cells, graphics, unknown attributes and unsupported spans. No existing freshness contract changed.

All 220 model/scope preparation jobs completed successfully. Independent audit verified exact body reconstruction,
reader spans, input hashes and tokenizer counts: OpenAI Small yields 873 passages / 412,347 input tokens, and Voyage 4
yields 927 passages / 445,847 input tokens. Maximum inputs are 1,116 and 1,072 tokens respectively, both below 1,200;
maximum length is 4,540 characters. The frozen combined manifest hash is
`bda326e6210eaeb209ddd7e409fe37e01e06427ed1b7fbbfbd4b024d9352b688`. No provider requests or embedding writes occurred.

Using OpenAI-tokenized boundaries for lexical testing only, the existing copy worker and verifier acknowledged all
110 scopes and 873 passages in `legislation_passage_search` on local port 55452. Zero publication lexical events
remain pending. Internal scoped positive/negative queries keep Hobbs and Seretha results separate across the two
`00-113` identities. This is not an embedding-model decision or authenticated HTTP/MCP/production acceptance.

Evidence: `fr-jan18-passage-shapes{,-accepted}.json`, `fr-jan18-passage-preparation.json`,
`fr-jan18-passage-manifest.json`, `fr-jan18-passage-audit.json` and `fr-jan18-lexical-copy.json` under backfill artifacts.
Twenty-eight focused table/passage tests passed. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-ruling-tables-tests.log`.
Root `pnpm verify` passed all nine tasks (eight cached) in 2m37s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-passage-pilot-verify.log`. `git diff --check` passed.
No source imports were repeated, no existing embeddings were rebuilt, and recurring regulatory collection remains disabled.

ING-05 is closed locally. The source-based publisher now combines the 107 independently validated ordinary
HTML/PDF associations with the three reviewed issue-PDF extracts and publishes the complete 110-record XML issue
atomically. It uses registered source identities, never the ambiguous printed number as a unique key. Reviewed
metadata exposes only evidenced fields while preserving original candidates; bodies, headings and blocks remain
unchanged from XML. Every source record receives persistent rendition evidence and one lexical outbox event.

Fresh test/pilot databases use ports 55451/55452. The pilot published generation
`ae822c65f12906a0732c06b6a8d6aecaa70a7eea1173949ae3179c2e298bf0fa` with 110 documents, 110 versions, 110
observations, 110 rendition dispositions and 110 pending lexical events. Three field reviews remain intact. Replay
reused the publication without additional rows. Independent SQL comparison verified all 110 canonical bodies,
headings, blocks, kinds and locators against staged XML with zero mismatches. The two `00-113` document IDs are
`3c706cd5-0f1d-40e1-b269-f16d01f92637` (Hobbs rule) and `ea81a0f0-6652-4d79-9556-849f49ffd9b7` (Minnesota notice).
Evidence: `fr-jan18-source-publish-import.json`, `fr-jan18-source-publication.json`,
`fr-jan18-source-publication-replay.json` and `fr-jan18-source-publication-audit.json` under backfill artifacts.

The 59 focused PostgreSQL/PDF-region tests passed; four optional search-copy checks were skipped without their
separate database. Tests exercise transaction rollback on outbox failure, missing-rendition rejection, stable
110-record replay, distinct collision identities, corrupted canonical text and revoked source rights. Service
type-check passed after correcting the reviewed-metadata type annotation. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-publication-tests.log` and
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-publication-types-accepted.log`.
Root `pnpm verify` passed all nine tasks (eight cached) in 1m44s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-publication-verify.log`. `git diff --check` passed.

ING-06 remains partial across the eventual release inventory: missing-XML/OCR fallback still needs qualification.
This pilot is not indexed, embedded or deployed. The next work can prepare/copy verified publications while frozen
scope, deployment orchestration and model/API/MCP gates proceed. Other retained eCFR/annual/FR pilots were not reset;
no embeddings were dispatched, and recurring regulatory source collection remains disabled.

ING-06 now has an offline reviewed-region PDF extractor for the three disputed January 18, 2000 records. It uses
explicit point-coordinate column regions from the original PDF, rejects text items crossing cuts, and requires
distinctive anchors plus exactly one matching footer while excluding known neighboring text. Original XML remains
canonical; these PDF extracts are supporting evidence and cannot publish document versions. Atomic output creation
and exact replay checks cover concurrent writers, changed source bytes and altered region evidence.

The retained complete PDF passed the existing PDF.js text/operator checks on all 321 pages in 4.8 seconds, with
2,022,967 characters. Its one empty-text page, page 300, was rendered and confirmed blank. Prior MuPDF decompression
warnings therefore do not fail the required PDF.js gate; earlier review records retain their original limited claims.
The new extracts contain 8,353 Hobbs characters, 2,907 Minnesota characters and 8,046 SO2-notice characters, each
with its own stable text hash. The Minnesota extract was read against the reviewed page and includes all seven
numbered items without its neighboring island notices. Re-running the staging CLI reused the exact generation.

Evidence: `fr-jan18-whole-pdf-inspection.json`, `fr-jan18-source-review/page-300.png`, and
`fr-jan18-reviewed-regions/3b5e2ac21dc7075b4613d71fa8dd507813233fe8b0076e80066ef8f67341f455.json` under backfill
artifacts. Five focused PDF/boundary tests and service type-check passed. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-pdf-regions-accepted-tests.log` and `rostra-fr-pdf-regions-types.log`.
An initial test assumed every document exceeded 3,000 characters; the full Minnesota notice is 2,907. That arbitrary
assertion was replaced with golden text hashes after checking the actual notice, preserving all boundary assertions.
Root `pnpm verify` passed all nine tasks (eight cached) in 1m51s, including the final formatted extractor and its
concurrent-worker tests. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-pdf-regions-verify.log`.
`git diff --check` passed.

Remaining ING-05/06 gates: persist required-rendition dispositions, consume source identities/reviews in the canonical
publication path, and reconcile all 110 source records through publication or explicit unavailable status. Region
extraction does not by itself validate OCR fallback or the individual PDFs. No database imports or embeddings were
repeated in this slice; recurring regulatory source collection remains disabled.

ING-05/06 now retain [field-level source reviews](fr-source-identities.md#reviewed-fields-and-rendition-boundaries)
for both `00-113` publications and `00-1083`. The new registration worker verifies the exact complete issue PDF,
replays the 110-record source inventory, and checks staged hashes, locators, identities and distinguishing text.
It persists reviewed titles, publication kinds, dates and printed page intervals in a separate review table.
Original metadata conflicts and canonical text remain intact. The SO2 title difference is confirmed typographic
against printed pages 2610–2611; no general whitespace normalization or parser freshness change was introduced.

The new baseline schema was applied to fresh isolated test/pilot databases on ports 55449/55450. The pilot stages
the retained FR generation `ae822c65f12906a0732c06b6a8d6aecaa70a7eea1173949ae3179c2e298bf0fa`; its import
remains correctly blocked on `corpus_publication_contract_pending`. Registration and exact replay retain 110
identities, 110 source records, three reviews and all three original conflicts, with zero text versions, publication
observations or outbox events. Evidence: `fr-jan18-review-import.json`, `fr-jan18-source-reviews.json`,
`fr-jan18-source-reviews-replay.json` and `fr-jan18-source-reviews-audit.json` under backfill artifacts.

The 59 focused identity/PostgreSQL tests passed; four optional search-copy tests were skipped without the separate
search database. Checks include changed PDF rejection, unchanged inventory replay, conflicting-review rejection,
transaction rollback and inactive-rights rejection. Service type-check passed. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-review-tests.log` and `rostra-fr-source-review-types.log`.
The focused suite used `--testTimeout 30000`; no production timeout or assertion was relaxed.
Root `pnpm verify` passed all nine tasks (eight cached) in 1m55s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-review-verify.log`. `git diff --check` passed.

Remaining: citation-based publication, per-document required-rendition reconciliation, isolated PDF text boundaries,
and resolution of the two decompression warnings observed in the full issue PDF. Shared-page visual review is not
whole-artifact PDF validation. Earlier eCFR/annual/FR pilots were preserved; no embedding work was dispatched and
recurring source collection remains disabled.

ING-05 now has a [persistent source identity inventory](fr-source-identities.md) for the January 18, 2000 collision.
Official printed pages 2537–2538 and 2639 were visually reviewed against the retained XML. An exact-artifact parser
rule gives the two `00-113` records separate citation identities while preserving their bodies and original footers.
The complete issue now normalizes to 110 records: 12 rules, six proposals and 92 notices. Changed source bytes still
fail the ordinary duplicate-identity gate. A full compressed source fixture exercises this boundary.

The new fenced source-inventory registration retains all 110 records and reconciles them against 109 supported
metadata records. A fresh pilot on port 55448 registered 110 canonical identities and source observations; replay
preserved exact identity mappings and evidence. The number resolver returns both `00-113` candidates as ambiguous,
and the existing number-only publication writer rejects ambiguous aliases. Registration creates zero text versions,
publication observations or outbox events. Both disputed records retain the contradictory API metadata as evidence.
There are 107 candidate metadata associations and three conflicts: the two disputed records plus an independent
`SO2` subscript/line-break heading difference for `00-1083`. No source-number observation is missing.

Evidence: `artifacts/regulatory-backfills/fr-jan18-source-inventory.json`, its replay and audit reports, the normalized
issue and retained PDF page renders. Source generation:
`ae822c65f12906a0732c06b6a8d6aecaa70a7eea1173949ae3179c2e298bf0fa`.
ING-05/06 remain partial: corrected metadata/rendition association and citation-based text publication still need
their own evidence and validation. Previously imported eCFR, annual editions and FR publications were not rerun;
no embeddings were regenerated and recurring regulatory collection remains disabled.

Focused parser, identity-resolution and PostgreSQL checks passed: 80 tests, with four optional search-copy tests
skipped because the separate search database was not configured. The isolated rerun used `--testTimeout 30000` after
a concurrent run hit five-second timeouts in four existing passage tests; assertions and production deadlines were
unchanged. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-identity-accepted-tests.log`.
Final root `pnpm verify` passed all nine tasks (eight cached) in 1m54s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-identity-final-verify.log`.

ING-04 now persists anchored duplicate-revision observations through the normal importer. The
[annual observation contract](annual-source-observations.md) introduces terminal source state `observed`, keeps the
original package and date warnings, and links to a complete, published revision-year volume. Exact source bytes,
parser implementation, title/volume and dates must agree; staged and canonical text/blocks and parents are compared
before the transition. Unresolved dates, other parser warnings, unavailable anchors and content drift stay blocked.
Replay revalidates content and reuses the observation. No newer package-year edition, code head or derived work is
created. The annual importer also reports an already-published anchor as published instead of merely materialized.

Fresh local pilot port 55446 verified the retained Title 1 2023–2025 packages: one 2023 annual edition with 368
canonical memberships and two source observations for 2024/2025, each pointing to January 1, 2023. The original
1,104 staged records and both source date warnings remain. Replay kept one lexical outbox event and created no
later-year editions or current heads. Evidence: `artifacts/regulatory-backfills/annual-title1-observation-audit.json`,
`annual-title1-observation-import.json`, `annual-title1-observation-replay.json` and the anchor publication report.
The 58 focused PostgreSQL/date tests passed; four unrelated search-copy tests were skipped without the separate search
database. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-annual-observation-final-tests.log`.
Root `pnpm verify` passed all nine tasks; coverage stage 1m42s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-annual-observation-verify-accepted.log`.
The new schema was applied to fresh isolated pilot/test databases (ports 55446/55445); retained eCFR/Title 2/Title 5
pilots were not reset or upgraded. Recurring source ingestion and embedding rebuilds remain disabled.
ING-04 stays partial pending date reconciliation over the final frozen release inventory. ING-05 FR collisions,
deployed orchestration, indexing, model qualification and API/MCP delivery remain open.

ING-03 is closed for the reviewed annual 2025 Title 5 volume 2 artifact. The official printed boundaries confirm that
1,631 of the 1,647 nested sections are current content wrongly enclosed by two future-revision quotes; 16 sections
remain quoted evidence. The [source review](annual-title5-source-review.md) records the exact paths, artifact hash,
printed pages and regression contract. The parser restores 45 logical parent relationships while retaining raw
locators and source bytes; unreviewed hashes still trigger the existing scope warning. A losslessly compressed full
source fixture exercises recovery, quote retention, complete section-number accounting and false-hash rejection.

All three retained annual Title 5 volumes normalized without warnings and published atomically in the existing local
annual pilot on port 55440. Revision date: January 1, 2025. Total: 6,803 records, including 5,353 current sections.
Annual edition: `b5b59bdf919c9224dc2168b122b3e762528e4f64368ea7e3f4141cbffcab2f00`.
A subsequent read-only canonical comparison verified every staged record, text/block hash, identity and parent
membership against normalized output: 6,803 checked, zero mismatches. Evidence:
`artifacts/regulatory-backfills/annual-title5-reviewed-canonical-audit.json` and the associated reviewed parse/import/
publication artifacts. The focused parser and PostgreSQL lifecycle run passed 73 tests; log:
`C:/Users/andcra/AppData/Local/Temp/rostra-annual-reviewed-tests.log`.
The final parser rerun passed all 20 checks, and root `pnpm verify` passed all nine tasks (coverage stage 1m38s).
Verification log: `C:/Users/andcra/AppData/Local/Temp/rostra-annual-title5-final-verify.log`.
No eCFR edition was reimported, no embedding was regenerated, and recurring source ingestion remains disabled.
Annual date dispositions (ING-04), FR collision identities (ING-05) and production/indexing delivery remain open.

ING-02 now has exact canonical eCFR verification and reuse at the existing normalized-import dispatch entry point.
The inspector uses one repeatable-read, read-only PostgreSQL snapshot per title and bounded record batches. It verifies
the raw artifact, stored manifest/generation identity, current rights, edition dates/head precedence, staged payloads,
record hashes, provision identities, version text/tables and every edition membership/parent against replayed output.
Counts alone cannot pass. Corruption, ambiguous generations and active writers prevent reuse; valid older-parser
editions are returned without new generations, leases or outbox work. `--reuse-only` also enforces read-only access at
the PostgreSQL connection level and cannot fall through to importing missing units.

The retained local pilot on port 55438 passed all 49 active eCFR titles: 49 distinct published/current editions and
275,149 exact records/memberships, zero mismatches and zero failures. Evidence:
`artifacts/regulatory-backfills/ecfr-canonical-reuse-audit.json`. A live Title 1 invocation through the actual importer
CLI returned its existing edition with `reused: true` under database-enforced read-only access; evidence:
`ecfr-canonical-dispatch-reuse-smoke.json`. These runs made no canonical writes, downloads or embedding requests.
The deployment destination and deployed Trigger controller still need their own inspection and admission/recovery gates.
Annual CFR and Federal Register canonical reuse remain separate work; ING-02 is therefore still partial.

All 66 focused checks passed, including 53 real PostgreSQL lifecycle tests. New tests prove cross-parser reuse on a
read-only connection across multiple record batches, changed inventory envelopes, corruption rejection, missing-unit
refusal and active-writer exclusion. Existing synthetic annual/FR manifests now compute size totals from their selected
units so they exercise the intended publication gates under the stronger manifest validator. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-canonical-reuse-final-tests.log`.
Final root `pnpm verify` passed with nine successful tasks in 1m55s; log:
`C:/Users/andcra/AppData/Local/Temp/rostra-canonical-reuse-accepted-verify.log`. The repeated-file replay test now has
30-second test-harness headroom after a five-second coverage timeout; production deadlines and assertions are unchanged.

The ING-02 replay command `replay:regulatory-parser` now processes up to five freshly audited units per invocation,
with a frozen-manifest cursor, parser-code pinning, exclusive comparison reports and safe reuse of committed parser
generations. It compares exact shards and all source/count/date/warning metadata; only parser hash, runtime version
and elapsed time are excluded from parity. Differences require review and cannot change canonical data. A failure
stops cursor advancement at the last completed unit. Exhausting a cursor alone never proves whole-manifest completion.

All 13 focused replay/audit tests passed, including damaged-source recovery, corrupted shards, invalid cursors and
source-date warning differences despite identical record shards. The four-subprocess recovery test now has a
30-second harness timeout after it exceeded five seconds under full coverage; its assertions and production parser
deadline are unchanged. Focused log: `C:/Users/andcra/AppData/Local/Temp/rostra-parser-replay-final-tests.log`.
Root `pnpm verify` passed with nine successful tasks in 1m58s; log: `rostra-parser-replay-accepted-verify.log`.

The full retained eCFR replay completed in ten batches: all 49 active titles, 275,149 records, zero failures and zero
differences requiring review. Current-parser outputs were newly generated under
`artifacts/regulatory-backfills/ecfr-current-parser-normalized/`. Every retained baseline matched exact shard hashes
and source metadata; all batches used parser hash
`c17afd84575e08e1ca80c99e379ad137a5e3353a906e87ef21c10ee70ca7501c`. Frozen manifest membership reconciled
without skipped or duplicate units; reserved title 35 remains excluded. Evidence:
`artifacts/regulatory-backfills/ecfr-parser-replay-20260915-085444/complete.json` and its ten referenced batch reports.
This closes current-parser parity for retained eCFR, not canonical database parity, annual CFR or Federal Register
coverage. No source downloads, canonical changes or embeddings occurred. Next ING-02 steps are exact canonical
edition/member/content verification, intended-deployment reconciliation and dispatch reuse integration.

ING-02 now has a read-only retained-file audit and `audit:regulatory-reuse` CLI. The audit replays the frozen manifest,
streams raw checksums, validates normalized shards/records and reports conflicts, missing input, damage and older
parser generations separately. It does not access canonical databases or enable dispatch. The eight new audit tests
and six delivery-plan tests passed, including conflicting self-consistent copies, missing shards, same-length raw
corruption, altered receipt semantics and older-generation damage. Focused log:
`C:/Users/andcra/AppData/Local/Temp/rostra-retained-audit-final-tests.log`.

The retained eCFR smoke verified all 49 raw units and older normalized generations with 275,149 records. No invalid
raw/normalized copies or unassigned inventory issues were found. None of these outputs uses the current Python parser
hash `c17afd84575e08e1ca80c99e379ad137a5e3353a906e87ef21c10ee70ca7501c`; they are intact retained evidence,
not current-parser reuse receipts. No downloads, parser execution, canonical writes or embedding calls occurred.
Evidence: `artifacts/regulatory-backfills/ecfr-retained-audit-locations.json` and
`ecfr-retained-generations-audit.json`; the earlier `ecfr-retained-input-audit.json` checked current generations only.
The subsequent full replay above closes the parser-version gap found by this initial audit. ING-02 remains partial;
the 275,149 count here measures normalized records and is not a fresh database-membership audit.
Root `pnpm verify` passed with nine successful tasks in 1m54s after fixing a test-hook assertion and registering the
audit CLI in package scripts. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-retained-audit-clean-verify.log`.

ING-01 now has deterministic read-only delivery partitions through planner `--delivery-output`, with corpus,
jurisdiction, current/recent/extended wave, explicit reserved exclusions, listed volumes and required evidence.
Federal Register windows without XML retain unknown document counts and require independent inventory; annual
publication dates are not inferred from package years. Full release-scope selection and non-reserved exclusion
decisions remain open, so ING-01 is still partial and no ING-02 canonical reuse audit is claimed.

Manifest validation now checks size accounting, unique inventory requests and source-bound evidence hashes. Offline
replay reconstructs the complete requested inventory and rejects omitted units/exclusions even after rehashing.
All 33 focused tests passed; the existing omission test was updated to falsify totals consistently so it still exercises
the deeper independent replay check. A retained-evidence eCFR plan produced 50 partitions, 49 acquisition units and
one reserved exclusion at the September 14 cutoff with zero HTTP requests and identical replay. Evidence:
`ecfr-frozen-delivery-manifest.json`, `ecfr-frozen-delivery-plan.json`. CLI replay also produced the three-volume
`annual-title5-delivery-plan.json`; its source parsing/publication blocker remains unresolved. All evidence is under
`artifacts/regulatory-backfills/`. No imports, canonical writes, embedding calls or recurring activation occurred.
Focused log: `C:/Users/andcra/AppData/Local/Temp/rostra-delivery-plan-final-tests.log`. Root `pnpm verify` passed with nine successful tasks in 2m16s (`rostra-delivery-plan-clean-verify.log`). The prior run hit an unrelated five-second bill-retrieval timeout; that test passed on the unchanged rerun. A test-only clone lint issue was also corrected.

Bounded passage-copy traversal and its explicit-dispatch Trigger worker are now implemented. The service validates
prepared inventory and live rights, copies at most 25 versions, yields after its admission deadline, and resumes only
from committed ordinals. The worker closes both pools before idempotent continuation. Traversal exhaustion never marks
search ready or acknowledges the outbox; whole-copy inspection remains mandatory.

All 44 focused tests passed, including the PostgreSQL lifecycle suite and four worker tests. New database coverage
proves replay, unavailable-target recovery, invalid-cursor rejection and refusal to acknowledge a skipped inventory.
The retained Title 2 smoke replayed ordinals 0–9 identically and advanced through 10–19 with zero HTTP calls. Evidence:
`artifacts/regulatory-backfills/passage-copy-batch-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/rostra-copy-batch-tests.log`. The smoke ran the local service, not a deployed task.
Controller admission, deployed runtime validation, cancellation recovery and large-scope resumable acknowledgement
remain open. No recurring source schedules or embedding requests were enabled. Root `pnpm verify` passed with nine successful tasks in 1m55s; log: `C:/Users/andcra/AppData/Local/Temp/rostra-copy-batch-verify.log`.

The explicit-dispatch `regulatory-passage-preparation` Trigger worker now wraps canonical preparation with strict
scope/model/batch payloads, two-worker concurrency, two connections per worker, lease-aware retries and idempotent
continuation. It closes its pool before submitting a successor, reloads remaining items from canonical checkpoints,
and refuses no-progress or inconsistent receipts. Completion stops the chain without copying, acknowledging or
embedding anything. This is one worker; controller admission, cancelled-run recovery and deployed packaging/load
smokes remain open. No schedules were created or enabled.

All 12 focused worker tests passed. A local execution against the retained annual CFR Title 2 pilot revalidated
all 2,200 completed versions, processed zero new versions and made zero HTTP requests (HTTP was blocked by the smoke).
The smoke called the actual worker function, not a deployed Trigger task. Evidence:
`artifacts/regulatory-backfills/preparation-worker-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/rostra-preparation-worker-tests.log`. Final root `pnpm verify` passed with nine successful tasks in 1m43s after correcting test assertions and mock types. Log: `rostra-preparation-worker-final-verify.log`.

Strict legal search transport schemas now validate corpus/date compatibility, bounded selectors, mode-dependent limits,
exact-version hit context and consistent generation/model/degradation metadata. Existing client envelopes are shared
without changing existing parsers. Route serialization, a callable client method and MCP wiring remain open; this
slice does not expose a new endpoint or run embedding requests. All 42 focused contract/client tests passed; root
`pnpm verify` passed with nine successful tasks in 1m42s after correcting braces and ESM import extensions.
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-legal-contract-tests.log` and
`rostra-legal-contract-clean-verify.log`. New validation messages have not been Fluent-validated; Fluent Agent is unavailable.


The application-layer legal search canary now requires verified request-context identity, an explicit organization
allowlist, an acknowledged preparation and API/MCP rights. It rejects caller-supplied identity/access fields and limits
this initial service to official federal sources with worldwide rights. Territory-limited data is denied until trusted
territory attributes exist. Denials return a generic forbidden error; infrastructure failures remain distinguishable.
No HTTP route, typed wire DTO or MCP tool is registered by this slice.

Scope authorization now reads locked ownership/policy metadata before any full text. Internal lexical reads can remain
allowed when external API permission is denied. All 44 focused checks passed, including the real PostgreSQL lifecycle
suite, account isolation and API-disabled/territory-limited policies tested against an unavailable target to prove early
refusal. The retained title-2 source pilot returned five hits across CFR 200.302, 200.303 and 200.318 through this service.
Its identity was a synthetic trusted request context, not a live HTTP/JWT/MCP authentication exercise. Evidence:
`artifacts/regulatory-backfills/legal-api-access-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/rostra-legal-access-tests.log`. No provider calls or embedding writes occurred.
Fluent Agent was unavailable; the new generic denial message has not received Fluent copy validation.
Final root `pnpm verify` passed with nine successful tasks in 1m53s after correcting a test-only literal type.
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-legal-access-final-verify.log`.

Maintenance continuation checks passed (five tests), including unchanged-cursor partial drainage, completion,
idempotent dispatch retry, database failure and no-progress protection. The first full verification detected formatter
changes to the exact Federal Register metadata fixture. Reconstructing its compact JSON recovered the original
127,967 bytes and SHA-256 `8293405067402d1b94263d11d07743fd0fae71e68fc25a29467ff721a9fd8df2` exactly;
the provenance record was not changed. The raw fixture is now excluded from formatting and Git text conversion.
Focused fixture/continuation tests passed; logs: `C:/Users/andcra/AppData/Local/Temp/rostra-rights-continuation-tests.log`
and `rostra-rights-continuation-fixture-tests.log`.
The subsequent parallel repository run hit an unrelated five-second fencing-theme timeout. Sequential coverage passed
all nine tasks without weakening that test, followed by a clean root `pnpm verify` (nine successful tasks, 2m34s).
Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-continuation-sequential-coverage.log` and
`rostra-continuation-clean-verify.log`. The final focused fixture/continuation run passed 26 tests. No provider calls,
embedding writes, maintenance deployment or recurring source activation occurred in this slice.

Search lifecycle handling is implemented: per-scope memberships preserve shared generations, whole-scope verified
receipts are committed before canonical lexical acknowledgement, and the current-provision reader follows and rechecks
the authoritative source head. An unindexed newer edition never falls back to an older copy. Explicit historical reads
remain possible under live rights. A receipt surviving a failed source commit cannot pass the acknowledgement gate.

Revocation reconciliation automatically scans memberships, clears selected scope receipts, resets affected lexical jobs
to pending and removes unreferenced regulatory passages/generations in 25-membership batches. Shared generations survive
until their last scope is removed. Restoring rights requires recopy/reverification. The bounded `regulatory-search-rights`
Trigger task includes continuation: an incomplete batch dispatches its returned cursor with a stable
parent-run idempotency key; uncertain dispatch retries reuse that key. Completed sweeps stop, failed database batches
dispatch nothing, and empty incomplete results fail rather than spawning a chain. Deployment and periodic activation
remain open. No source schedules or embedding rebuilds were activated.

Validation: 38 PostgreSQL tests plus two Trigger-wrapper tests passed on the sequential complete run. They cover
receipt-write rollback, deferred source-commit failure after target commit, replay, newer-head refusal, shared copies,
revocation, restoration and 25/8-member cleanup continuation. The additional Federal Register observation test passed
after correcting its fixture lookup column, verifying one publication acknowledgement leaves the other two pending
and revocation requeues only the selected observation. Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-search-lifecycle-final-tests.log`
and `rostra-publication-lifecycle-final-test.log`. An earlier run overlapped another coverage process and
timed out in two tests; the focused sequential rerun passed without relaxing assertions or timeouts.
Durable target revocation markers now preserve cleanup discovery when target deletion commits but the canonical job
reset fails. The real annual-CFR title-2 pilot reused all 2,200 existing generations, verified its 2,547 passages and
acknowledged the lexical job, then repeated acknowledgement successfully. A healthy rights sweep removed nothing.
The one pilot outbox item is now acknowledged; earlier pending counts below are historical. Evidence:
`artifacts/regulatory-backfills/passage-search-lifecycle-smoke.json` (164.2 seconds for membership registration,
acknowledgement/replay and rights sweep). No provider calls or embedding writes occurred.
The final recovery run passed all **41 checks** (39 real PostgreSQL tests and two Trigger-wrapper tests), including
deferred cleanup-commit failure followed by automatic recovery from a revocation marker. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-search-lifecycle-recovery-tests.log`.
Final root `pnpm verify` passed with nine successful tasks in 1m46s after correcting four test-lint findings.
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-search-lifecycle-final-verify.log`.

The isolated search canary now validates published source membership and current rights before connecting to the target.
Source rights stay locked until the read finishes, so revocation blocks disclosure even when the copy remains retained
or the target is unavailable. It checks generation ownership/metadata and completeness, then revalidates each hit against
canonical content and input hashes. It remains explicitly version-scoped and internal; API/MCP authentication, caller
entitlements, current-version selection, physical revocation cleanup and outbox acknowledgement are still open.

The real-source parity pilot identified an index mismatch: canonical FTS uses complete `input_text` (including context),
while the initial isolated table indexed only `body`. The original target schema now indexes `input_text` too, and the
regression suite includes a context-only query. Only the two disposable regulatory projection tables at ports 55443
and 55444 were reset; canonical imports, passages, preparation state, bill projections and existing embeddings were
untouched. The original failed diagnostic is retained in `artifacts/regulatory-backfills/passage-search-rights-smoke.json`.

All 37 PostgreSQL tests passed for the reader changes. The focused separate-database test passed again after the index
correction, including live-rights refusal before target access, changed-hit rejection, incomplete-generation refusal,
wrong-version refusal and the context-only query. Logs: `C:/Users/andcra/AppData/Local/Temp/rostra-search-rights-tests.log`
and `rostra-search-context-test.log`.
The corrected target copied and replay-verified all **2,200 generations / 2,547 passages** in 235.5 seconds:
`artifacts/regulatory-backfills/passage-replication-context-smoke.json`. Read-only search parity passed for CFR
200.302, 200.303 and 200.318 (five total hits), including exact IDs, order, scores and content:
`artifacts/regulatory-backfills/passage-search-context-smoke.json`. This is a bounded lexical canary, not a retrieval
quality comparison. One outbox item remains pending; zero provider requests or vector writes occurred. Final root
`pnpm verify` passed with nine successful tasks in 1m57s (`rostra-search-rights-verify.log`).

Whole-scope copy inspection is implemented in `passage-copy-readiness.ts`. It verifies the prepared inventory against
the source, every generation's ownership/context/tokenizer, and exact source/target passage equality and manifest hashes.
Separate repeatable-read transactions and row locks keep the inspected snapshots consistent. It writes no data and
leaves outbox acknowledgement and public search readiness false; those still require scope publication and access gates.

The retained annual CFR title-2 pilot passed the whole-scope inspection: **2,200 generations / 2,547 passages** in
11.7 seconds, with its one outbox item still pending and no embedding/provider activity. Evidence:
`artifacts/regulatory-backfills/passage-copy-readiness-smoke.json`. All 37 PostgreSQL integration tests passed,
including missing generation, changed target passage, changed preparation context and revoked-rights rejection.
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-copy-readiness-tests.log`. The inspector has a 60-second budget and
fails closed on larger scopes that cannot finish; resumable validation of those scopes remains open.
Final root `pnpm verify` passed with nine successful tasks in 1m40s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-copy-readiness-verify.log`.

Immutable passage generations now copy atomically into independent regulatory tables in the isolated
`legislation_passage_search` database. The worker validates ownership, canonical manifests, exact input hashes and
source rights, and holds source membership/rights locks through target commit. Target locking serializes concurrent
copies; replay checks all retained metadata and passage rows rather than trusting a previous receipt. Copy failures
roll back the whole target generation. Work is bounded by row, byte and aggregate time limits. This implements the
per-generation storage handoff; whole-scope acknowledgements, tombstones, current-version selection and public search
authorization remain open. The target uses PostgreSQL FTS for a private lexical canary, not BM25.

All 37 PostgreSQL integration tests passed, including the new separate-database test for concurrent replay,
failed-copy rollback, wrong scope, revoked rights and source/target corruption. Test source and target databases are
disposable local databases at port 55443. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-legal-replication-tests.log`.
The complete retained annual CFR title-2 pilot copied **2,200 generations / 2,547 passages**, then verified all 2,200
replays against a fresh isolated target database at port 55444. Combined copy/replay took 191.8 seconds. Canonical
publication work remains pending (one outbox item); no provider calls or vector writes occurred. Evidence:
`artifacts/regulatory-backfills/passage-replication-source-smoke.json`. Final root `pnpm verify` passed with nine
successful tasks in 1m34s after correcting two missing-brace lint findings. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-legal-replication-final-verify.log`.

Canonical passage preparation is now restartable for complete editions and publication observations. The job freezes
version/context inventory, pages metadata in bounded requests, processes at most 25 versions per invocation, and records
each completed generation. Renewable leases and fences reject active/stale workers; failures retain progress and a retry
delay. Final checks reconcile source and checkpoint inventory hashes, version/context/tokenizer associations, and passage
counts. `prepared` is a canonical-preparation state only: the source outbox stays pending until isolated-index work and
readiness gates are implemented.

The full retained 2025 annual CFR title-2 pilot at port 55444 completed **2,200/2,200 versions**, producing 2,200 immutable
generations and 2,547 passages with the OpenAI Small tokenizer. The final replay processed zero additional versions;
generation/passage counts were unchanged and the one publication indexing job remained pending. This used no embedding
provider calls or vector writes. Evidence: `artifacts/regulatory-backfills/passage-preparation-source-replay.json`.
The first run exposed a trailing-newline context mismatch on 142 empty-heading records. Context normalization was aligned,
and only this disposable pilot's preparation checkpoints were reset; all completed passage generations were retained and
reused. The initial diagnostic is retained in `passage-preparation-source-smoke.json`. Source parser summary, staged records,
and published membership all agree on 2,200 records. The earlier narrative count of 2,219 was corrected after checking
both the original annual source pilot and this new database. Existing eCFR imports and embeddings were not regenerated.

Validation: all 36 real PostgreSQL integration tests passed on the final sequential run, including bounded resume,
expired-lease recovery, checkpoint rollback, replay reuse, and inventory tampering. A preceding run overlapped the source
pilot and hit two existing five-second test timeouts; the sequential rerun passed without weakening assertions or timeouts.
Type checks and focused lint passed. Final root `pnpm verify` passed: nine successful tasks in 1m53s. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-preparation-serial-tests.log` and `rostra-preparation-verify.log`.
Next are isolated-index copying and acknowledgement, readiness gates, then authenticated API/MCP integration. Full
federal ingestion remains gated on these tasks, source reconciliation, and the final passage-based model comparison.

Persistent canonical passage storage and a version-scoped PostgreSQL lexical canary are implemented in
`passage-storage.ts`, with provision/publication ownership, atomic complete-generation insertion, bounded batches,
concurrent/replay integrity checks, exact inputs and source spans, and a generated English FTS GIN index. Published
source membership and current display/local-search rights are checked before preparation, again at write commit, and
on every lexical lookup. No embedding calls, vector writes, existing freshness changes or outbox acknowledgements occur.

An isolated real-source pilot at port 55442 published the retained 2025 annual CFR title 2 source and prepared sections
200.302, 200.303 and 200.318 with both model tokenizers: six generations, nine passages, six verified replays and six
successful lexical probes. One edition outbox item remains pending as intended. Evidence:
`artifacts/regulatory-backfills/passage-storage-source-smoke.json`. Disposable PostgreSQL regression tests use a separate
new database at port 55441; prior source pilots were not reset. The isolated search copy, outbox/recovery/readiness,
global version selection, embedding jobs, and authenticated API/MCP implementation remain open.
Validation: 54 focused tests passed before the final byte-bounded batching adjustment. The final focused run passed 53
and hit one existing history-replay test's five-second timeout while root coverage was running concurrently; that test
passed in isolation afterward. New passage-storage PostgreSQL tests passed in both runs. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-passage-storage-tests.log`, `rostra-passage-storage-final-tests.log`,
`rostra-passage-storage-history-retry.log`. Type checks and focused lint passed. Final root `pnpm verify` passed with nine
successful tasks in 1m43s (`rostra-passage-storage-verify.log`), superseding the earlier unrelated unused-script blocker.

Ordinary table passages now carry explicit source group labels and resolve chained ditto values through exact prior
single-column cell spans. Group changes and empty/missing/spanning cells prevent stale reference reuse. Passage packing
stops when required context differs; original reader text remains unchanged. The retained 100-version / 131-block
sample still passes all 131 blocks with both tokenizers after these context changes. Evidence:
`artifacts/regulatory-backfills/table-passage-context-smoke.json`. Focused tests passed: 37 passage/table/reader tests,
including chained references and refusal to carry a value across a new group. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-table-context-tests.log`. These results are source-layout acceptance for a
bounded sample, not retrieval-quality or full-corpus acceptance. No provider calls or embedding rebuild occurred.
Type checks and focused lint passed. Direct legislation coverage passed: 317 files / 2,996 tests, plus four webhook
receiver tests (database-dependent tests remain skipped without their disposable database setting). Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-table-context-direct-coverage.log`. Root `pnpm verify` is currently blocked
by the unrelated untracked `tools/openstates/inspect-openstates-content.ts` being reported as unused; that file was left intact.
Root log: `C:/Users/andcra/AppData/Local/Temp/rostra-table-context-verify.log`. This supersedes earlier clean root runs
for the current working tree; no current full-repository pass is claimed.

Oversized-row continuations now retain the complete column headings, the other identifying column values, the nearest
explicit spanning group label, and exact source/context spans. Each continuation identifies its complete original row
and long column. The complete prepared input is token-counted and hashed; original text is neither shortened nor replaced.
Ambiguous spanning continuation cells, unresolved ditto values, or identifying context too large for the target still fail.
The same read-only 100-version / 131-block sample now passes for **all 131 blocks with both tokenizers**, including the
three rows previously blocked. Evidence: `artifacts/regulatory-backfills/table-passage-row-continuation-smoke.json`.
The original failures below are retained diagnostic history, not current failures for those three records.
This smoke used local source data and local tokenizers only: no provider requests, persisted vectors, or source mutations.
Focused passage/table/reader tests passed: 36 tests, with long text in each column, Unicode, identifying context and
source group-label preservation, and explicit ditto rejection. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-table-row-continuation-tests.log`. Broader nested/spanning layouts, ordinary
row-group/ditto dependencies across passage boundaries, full-corpus validation, persistent indexing, model retrieval
acceptance, authenticated API/MCP and Trigger backfill/recovery gates remain open. Full embedding regeneration stays deferred.
Final `pnpm verify` passed with nine successful tasks in 1m28s. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-table-row-continuation-verify.log`.

Large-table passage generation now separates actual tables from prose and multiple-table appendix wrappers, preserves
whole data rows, repeats explicit multilevel headers, and records separate source/context spans plus exact input hashes.
Both token and transport-character limits apply. Exponential row-group probes avoid repeatedly tokenizing each growing
prefix. The source reader remains lossless and receives no repeated headers. No embeddings were regenerated.

The retained read-only pilot sampled 100 current-eCFR versions containing 131 source blocks over 6,000 characters.
With both OpenAI Small and Voyage 4 tokenizers, 128 blocks passed exact reconstruction and passage budgets; three blocks
remained blocked by an individual row exceeding the hard budget. The largest passing block was 206,057 characters.
This is a bounded layout smoke, not full-corpus or semantic retrieval acceptance. Evidence:
`artifacts/regulatory-backfills/table-passage-source-final-smoke.json`; initial diagnostic results remain in
`table-passage-source-smoke.json`. The blocked version/source-ordinal pairs are
`0dba3f46-e0e3-4664-880f-bb0d6226da55 / 2`, `133a26fa-00cf-4f76-82f5-e3c6ceb56948 / 197`, and
`194b31a5-b7fb-432b-8cf1-02beb72e0776 / 2`. They contain long ingredient/commodity/citation rows; no row was silently cut.
Nested tables, spanning data cells, row-group labels/ditto references, and individually oversized rows still need
broader source-layout and semantic acceptance before the full passage backfill. Focused passage/table/reader tests:
32 passed (`C:/Users/andcra/AppData/Local/Temp/rostra-table-passages-tests.log`).
Full `pnpm verify` passed: nine successful tasks, 1m34s; retained log
`C:/Users/andcra/AppData/Local/Temp/rostra-table-passage-verify.log`. No production deployment or full ingestion was started.

Shared embedding integrity repair: the client now rejects over-limit inputs and provider size errors without truncating
or retrying shorter text. Exact request bodies remain stable across transient retries. Added pinned model tokenizers,
per-input/per-batch token guards, and a shared lossless prose splitter consumed by regulatory passages. The user approved
this shared preparation work and explicitly deferred regenerating all existing embeddings. No freshness contract was
bumped, vectors deleted, production rollout dispatched, or existing embeddings regenerated. The remote read-only audit
confirmed there is no persisted shortened-retry flag; affected counts remain unknown. Full rebuild preparation is tracked
in [embedding rollout](../engineering/embedding-rollout-plan.md#input-integrity-repair-and-deferred-rebuild-september-15-2026).

Tokenizer verification: 33 focused tests passed, including exact text/Unicode preservation, 21 Voyage Rust-reference
cases, token-dense input/batch rejection, and no persistence after provider rejection. Synthetic OpenRouter checks matched
OpenAI usage exactly; Voyage reported one fewer token per input than both local and Rust-reference counters. This remains
an explicit provider-accounting discrepancy in `embedding-input-integrity-smoke.json`, not a change to the tokenizer.
Final tokenizer implementation passed full `pnpm verify` (nine successful coverage tasks, 3m9s), service compilation,
and loading/counting with both tokenizers from compiled output. Logs:
`C:/Users/andcra/AppData/Local/Temp/rostra-embedding-tokenizer-verify.log`,
`rostra-embedding-final-tokenizer-tests.log`, `rostra-embedding-final-build.log`. Production deployment remains pending.

Annual CFR publication is implemented with a frozen title-volume denominator, revision-date agreement, duplicate-provision
checks, and atomic fenced publication/outbox insertion. The unreleased baseline now includes annual title/volume grouping.
Real local pilot at port 55440 published 2025 title 2 (one volume, 2,200 records, printed revision 2025-01-01) and replayed
without duplicates. Evidence: `annual-title2-publication*.json`. Title 5 has three acquired volumes; volume 2 nests 1,647
section elements under quoted replacement text. The parser now retains replacement text in its owning provision and flags
extensive quoted structure for review. Title 5 remains unpublished with volume 2 blocked as `quoted_revision_scope_review`.
Evidence: `annual-title5-publication-*`, final parser report under its normalized directory. No publisher-year date repair
was invented. Synthetic two-volume PostgreSQL tests verify missing-volume refusal, whole-title replay, cross-volume duplicate
rejection and conflicting-date refusal. This closes the annual writer implementation, not all federal source reconciliation.

No active regulatory jobs were found. Implemented persistent local embedding reuse for the diagnostic command through
`--cache`. Keys bind exact inputs and model/dimension/input-contract/query-mode settings. Entries are immutable and
atomically retained; corrupt keys/vector checksums and mismatched provider models fail without paid fallback. Same-request input
duplicates are embedded once and restored to caller order. Cache hits and new token usage are reported separately.
This is diagnostic storage, not production rights enforcement or canonical vector persistence.

Verified a live fill using the retained 12-document/12-query smoke set, followed by a replay with network fetching
deliberately disabled. Both models returned 24 cache hits, zero requests/batches/new tokens, and byte-identical ranking
reports. A fresh fill/replay also verified vector checksums, which detect otherwise valid numeric corruption. Evidence:
`regulatory-cache-smoke-manifest.json`, `regulatory-cache-checksummed-fill.json`,
`regulatory-cache-checksummed-replay.json`, `regulatory-embedding-cache-checksummed/`. Nine focused tests passed.
Final checksum implementation passed full `pnpm verify` (nine successful coverage tasks, 1m21s).
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-cache-checksum-verify.log`. The full 350-document
benchmark was not repeated. Earlier cache artifacts lack checksums and are historical evidence only.

The idle-work check found no active regulatory jobs. Implemented a reusable blind relevance-review pool and CLI,
`pool:regulatory-judgments`, with complete-system/query coverage checks, candidate identity validation, exact source
version/input hashes, deterministic rank-blind ordering, and blank human grades/rationales. It pools competing answers
without changing the frozen labels or revealing model/ranking names in the candidate view. The real benchmark produced
60 question packets and 1,315 candidate excerpts across seven configurations; no external API calls were made. Evidence:
`regulatory-review-systems.json` and `regulatory-judgment-review.json` under `artifacts/regulatory-backfills/`.
Focused tests and service TypeScript passed. Full `pnpm verify` passed, with nine successful coverage tasks (1m30s).
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-judgment-pool-verify.log`. Human review is still incomplete.

Expanded the embedding diagnostic from 12 easy questions to a frozen 350-excerpt corpus and 60 queries across 12 eCFR
parts, with 30 development and 30 held-out questions split by regulatory title before execution. Both configured models
completed the run and an unchanged held-out repeat. Voyage's held-out Recall@5/nDCG@10 were 1.000/0.959; OpenAI Small's
were 0.933/0.857. Each model also completed 60 Cohere reranking calls; their held-out aggregates tied at 0.967/0.965.
All semantic Recall@25 scores were 1. This is provisional evidence, not model promotion: single-known-answer labels
are not exhaustive human judgments, and source review found an additional correct municipal-waste answer. Frozen labels
were not changed after scoring. Full details and limitations are in [search indexing](search-indexing.md#local-comparison-evidence-september-15).

Implemented the reusable `smoke:regulatory-embeddings` CLI with preview/live modes, frozen manifest hash, split selection,
exclusive output reservation before paid calls, and up to 512 inputs submitted in bounded 64-record batches. The shared
OpenRouter embedding client now rejects duplicate/skipped/out-of-range response indices even when counts and dimensions
match. No production route or canonical vectors changed. Source excerpts are not final tokenized passages; storage reuse,
historical/proposal/state cohorts, exhaustive relevance review and deployed API/MCP canaries remain open.

Annual CFR date disposition now links exact 2024/2025 title-1 volume-1 copies to the unique verified 2023 source
observation. It requires matching title/volume/hash/printed date and rejects ambiguous or cross-title anchors. Fresh
parsing and audit confirmed both duplicate observations. Later package years remain uncovered; no later legal-currency
date was invented, and the annual publication gate remains closed. This classifies the defect but does not implement
the multi-volume annual canonical writer.

Focused checks passed 17 tests, scoped lint and service TypeScript. Full `pnpm verify` passed (nine successful coverage
tasks; coverage phase 1m31s). Log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-comparison-verify.log`.
Evidence lives under `artifacts/regulatory-backfills/` with the `regulatory-comparison-*` prefix and
`annual-title1-revision-dispositions.json`. The initial lexical scoring result is invalid because of SQL regex escaping;
only `regulatory-comparison-corrected-results.json` is used for lexical/hybrid conclusions. No additional model requests
were made to repair lexical scoring.

Persistent HTML subject-conflict quarantine is implemented. Acquisition is separated from parsing so conflicting raw
evidence remains available. The loader catches only the typed `FrHtmlSubjectMismatch`; operational failures and other
validation errors still abort. Every metadata record must appear exactly once in the verified/quarantined partition.
The partition and parser dependency hash bind import generation identity. Registration retains raw artifact references,
quarantine evidence and coverage in the generation summary; publication retains the same report in batch reconciliation.
Only verified records create canonical documents and lexical outbox jobs. Even a fully quarantined day can retain a
report with zero publications. The unreleased baseline permits zero expected records only for the HTML import contract;
XML edition/issue validation retains its positive-record requirement. Existing pilot schemas were not migrated in place.

Real January 18 replay: 109 supported metadata identities, 108 verified, one quarantined (`00-113`), and
`issueInventoryVerified: false`. An initial smoke imported 108 into the consolidated local pilot at port 55438, bringing
that pilot's FR document count from 75 to 183. Final-code verification uses the separate `rostra-fr-quarantine-pilot`
at port 55439 with the updated migration baseline: **108 documents, 108 versions, 108 observations, 108 outbox rows**
after publication and replay (`reused: true`). These 108 are the same source records as the earlier smoke; do not add
them twice when counting coverage. No disputed record was published. Generation:
`b78b8df12842010631e21c425503fa0b4abd5106d839fc7eca95f04e999969f3`.

Evidence: `fr-jan18-quarantine-inputs.json`, `fr-jan18-quarantine-stage.json`, `fr-jan18-quarantine-publish.json`,
`fr-jan18-quarantine-final-stage.json`, `fr-jan18-quarantine-final-publish.json`,
`fr-jan18-quarantine-final-replay.json` and hash-addressed `fr-jan18-imports/` under `artifacts/regulatory-backfills/`.
Final storage verification passed all 28 real-PostgreSQL tests, including mixed/fully quarantined batches, rollback and
idempotent replay. HTML/input checks passed 12 tests. Scoped lint and service TypeScript checks passed. The disposable
test container was stopped. Root `pnpm verify`
is blocked by five unrelated Open States lint failures in `scraper-alaska-batches.test.ts` and `scraper-normalize.ts`;
full coverage did not run. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-quarantine-verify.log`.

Remaining work is explicit: ingest/persist the full issue's distinct source-location observations, reconcile all 110
publications rather than 109 metadata identities, and implement reviewed citation identity before resolving 00-113.
This quarantine slice does not close annual date handling, model comparison, full-issue completeness or search readiness.

January 18, 2000 alternate-rendition investigation recovered all 109 metadata-listed HTML files and 109 PDFs (383
validated PDF pages). It exposed a cross-rendition identity defect: metadata for 00-113 has the Minnesota notice's
title/pages but type `Rule`; HTML has the Hobbs airspace rule's body with a header claiming page 2639. Matching only
number/date/type/pages would have attached the wrong body. No January 18 canonical publication was performed. The raw
issue contains 110 supported records versus 109 metadata identities; individual download completion is not issue completeness.

`fr-html.ts` now requires the metadata subject in the rendition's subject area before AGENCY/ACTION/SUMMARY (or the bounded
leading area for other formats). `fr-subject.ts` compares publisher TeX/curly quotes, dash typography and hyphenated line
wrapping without rewriting retained text. New checks initially flagged ten records; nine were verified typography
differences. Normalized comparison then passed **108/109**, rejecting only 00-113 with `fr_html_subject_mismatch`.
All **75/75** earlier January 3 HTML records passed the stricter check. The parser hash changed: older reports remain
historical evidence, not current-parser publication approval.

`fr-identity-resolution.ts` adds a pure collision plan retaining artifact/locator-bound observations, distinct citation
keys and an explicitly ambiguous number alias. Metadata matching requires title/kind/page agreement. Duplicate citations
cannot be resolved with arbitrary suffixes or input order. Real evidence isolates `/FEDREG[1]/RULES[1]/RULE[5]`
(Hobbs, 65 FR 2537–2538) and `/FEDREG[1]/NOTICES[1]/NOTICE[62]` (Minnesota, 65 FR 2639). Neither matches all fields of
the mixed metadata record; both remain unresolved and publication-disabled. This planning foundation does not yet replace
canonical document-number identity or the strict whole-issue parser. Next: evidence-bound per-record quarantine and
citation-identity publication, so unaffected documents can publish without dropping the extra source record.

Evidence under `artifacts/regulatory-backfills/`: `fr-2000-jan18-html/`, `fr-2000-jan18-html-report.json` (old checks),
`fr-2000-jan18-pdfs/`, `fr-2000-jan18-pdf-report.json`, `fr-2000-jan18-pdf-validation.json`,
`fr-2000-jan18-subject-replay.json` (typography failures), `fr-2000-jan18-subject-normalized-replay.json`,
`fr-2000-early-subject-replay.json`, `extract-fr-identity-evidence.py`, `fr-jan18-identity-evidence.json`,
`resolve-fr-jan18-collision.ts` and `fr-jan18-collision-plan.json`. The diagnostic extractor found two empty PRTPAGE markers
and retains unknown page values instead of guessing; it is not a production parser replacement.

Focused verification passed: 41 tests across HTML parsing, publication inputs, collision planning and real-PostgreSQL
storage integration. A lint repair in the collision planner passed its three-test rerun; scoped lint and service
TypeScript checks passed. Root `pnpm verify` was attempted twice: the retry is blocked by an unrelated nested ternary
in `src/ingestion/openstates/scraper-normalize.ts` (line 281 in that snapshot). Full coverage did not run. Logs are
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-subject-verification.log` and
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-subject-verify-retry-20260915.log`. The isolated test container was stopped.
Annual source-date dispositions, the larger model comparison and full-ingestion gates remain open. Current eCFR data
and prior FR publications were not modified.

The user reprioritized full-ingestion blockers: model comparison, annual source-date remediation and missing/duplicate
FR resolution. The existing 10-minute follow-up now explicitly prioritizes these tasks instead of repeating completed
current-title backfills. None of these broader gates is closed merely by the following diagnostic successes.

`embedding-smoke.ts` implements a bounded comparison through the existing embedding client: identical validated inputs,
one attempt (preventing the client's oversized-input shortening retry), explicit document/query modes, dimension/finite/
nonzero vector checks, exact-version rankings and retained input hash. Three tests cover paired modes/version retrieval,
oversized input and invalid judgments, wrong dimensions, and no shortening retry. No production model is selected.

Live diagnostic: 12 explicit source excerpts and 12 provisional agent-authored topical queries, OpenAI Small/1,536 and
Voyage 4/1,024 dimensions. Both achieved Recall@5=1 and nDCG@10=1 on this small easy diagnostic. OpenAI reported 4,086
tokens and 2,937 ms total document/query latency; Voyage reported 4,291 tokens and 1,243 ms. These single-run totals are
not latency percentiles or a quality winner. Evidence under `artifacts/regulatory-backfills/`:
`run-regulatory-model-smoke.ts`, `regulatory-model-smoke-manifest.json`, `regulatory-model-smoke-results.json`.
After removing whitespace transformation from the input schema, a repeat against the same retained source inputs
again achieved Recall@5=1 and nDCG@10=1 for both models. Exact-input evidence:
`replay-regulatory-model-smoke.ts` and `regulatory-model-smoke-exact-input-results.json`. OpenAI: 4,086 tokens/2,572 ms;
Voyage: 4,291 tokens/714 ms. This repeats network calls and is not a persistent embedding-reuse test.
Inputs are explicitly bounded excerpts with offsets/body hashes, not complete production passages. The 60-query minimum,
hard negatives, development/held-out split, human relevance review, lexical/hybrid/reranking comparison, cost accounting,
reuse and deployed API/MCP confirmation remain required before bulk embeddings. No canonical vectors were written.

Fresh source investigation confirmed the Jan 18, 2000 duplicate is present in the official printed issue itself:
[GovInfo full issue PDF](https://www.govinfo.gov/content/pkg/FR-2000-01-18/pdf/FR-2000-01-18.pdf), PDF pages 25 and 126
(one-based), prints FR Doc. 00-113 for both the Hobbs airspace rule (65 FR 2537–2538) and a Minnesota land notice.
This is not solely an XML parsing defect. The remediation must preserve distinct citation/source-location identities
and the disputed publisher-number alias; it must not guess a corrected number, merge the records or discard one.
Existing strict duplicate publication gates remain in place until that identity/reconciliation path is implemented.

The [official 2024 title 1 HTML](https://www.govinfo.gov/content/pkg/CFR-2024-title1-vol1/html/CFR-2024-title1-vol1.htm)
likewise labels its wrapper 2024 while the title page and scope statement specify January 1, 2023. Preserve these as
separate publisher assertions; package year alone cannot establish later currency. [GovInfo CFR help](https://www.govinfo.gov/help/cfr)
also explicitly documents an unrelated 2007 title 49 volume 6 printed-header error, demonstrating why resolutions need
specific publisher evidence rather than a blanket rule. No correction notice resolving the title 1 conflict was verified.
Implement evidence-backed ingestion/coverage dispositions so retained conflicting source observations need not prevent
unrelated imports; do not advertise the conflicting package as a verified later point-in-time edition.

Three focused tests, scoped lint and service TypeScript checks passed. Initial root verification failed on unrelated
curly-brace lint errors in Open States and bill batch ownership files; those files were not changed. Final root retry
also failed at lint, log `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-model-smoke-verify-retry.log`.
No command from this slice remains active. This is not a clean repository-wide verification gate.
All broader blocker-remediation tasks remain active.

The first lexical-passage foundation is implemented in `src/ingestion/regulations/passages.ts`. It validates source-reader
hashes and contiguous offsets, produces deterministic version/context/tokenizer-bound IDs, counts prefixed input against
explicit tokenizer budgets, and maps each passage back to exact reader-block spans. It preserves Unicode/source text,
classifies empty bodies separately, and keeps fitting tables intact. Oversized tables explicitly block the generation
until row/header segmentation exists. SEARCH-01 remains partial; no outbox job has been consumed and no index is searchable.

Six focused tests passed: exact reconstruction/spans/budgets, identity invalidation, intact/oversized tables including
reader-split tables, corrupt input/invalid tokenizer rejection, empty/repeal eligibility, and astral-character boundaries.
A read-only smoke against 200 canonical section versions (50 each from titles 1/7/21/40) produced 1,068 passages with
exact reconstruction, no budget violations and zero oversized-table blockers in that sample. The smoke deliberately used
UTF-8 byte counts as a named test budget, **not a model tokenizer or model-quality evaluation**. No embedding calls or
database writes occurred. Evidence: `artifacts/regulatory-backfills/smoke-passage-foundation.ts` and
`artifacts/regulatory-backfills/passage-foundation-smoke.json`.

Root `pnpm verify` passed after correcting a focused test's explicit-exception lint requirement; log:
`C:/Users/andcra/AppData/Local/Temp/rostra-passage-foundation-verify-retry.log`. No command from this slice remains active.
Next: row/header-aware table splitting, selected-model tokenizer adapters and
bounded canonical passage/outbox projection. The embedding comparison remains mandatory before bulk embeddings;
recurring regulatory source schedules stay disabled. Current consolidated coverage remains 49 titles/275,149 members.

The current eCFR corpus is now consolidated in the port 55438 pilot: **49 non-reserved titles and 275,149 members**.
Titles 1/21/40 were imported from retained raw artifacts and the current-parser regression output, without new downloads,
database copying, schema changes or code changes. All three published and final replay reused the same editions and
generations. The original port 55434 pilot remains intact but must not be added to the consolidated coverage total.
LIVE-02 is complete for this frozen current local scope; broader foundation, historical, indexing and release gates remain open.

Source: `federal-pilot-2026-09-14.json`, raw `raw/`, normalized `historical-parser-regression/`, importer `--limit 3`.
That manifest also contains annual CFR and FR units, deliberately outside this consolidation command; its report's two
pending units are those unselected corpora, not missing current eCFR titles. Existing historical/source blockers remain.

The first attempt published titles 1 and 21 but title 40 hit SQLSTATE 57014 under the unchanged 60-second statement
timeout. Its 30,310 records were fully staged, with no edition members yet. A subsequent EXPLAIN ANALYZE of the staging
parent-validation query completed in 64.594 ms using a parallel hash join. The timeout was not reproduced and its exact
cause remains unproven. Resume passed without increasing timeouts or weakening checks; a final replay reused all three
editions. Preserve this failure as a throughput/recovery observation for profiling before large historical waves.

Independent SQL compared all 275,149 stored bodies/headings/blocks against staging with zero mismatches. There are 49
heads, 49 pending edition projection jobs and no active leases. The 75 FR publications and their identity digest are
unchanged. Single-database inventory reconciliation found no missing, unexpected or duplicate title keys; reserved title
35 is excluded. This is consolidated current eCFR source coverage, not full historical coverage or production search.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-consolidation-import.json` (initial failure),
`ecfr-consolidation-resume.json`, `ecfr-consolidation-replay.json`, `ecfr-consolidation-integrity.json` and
`ecfr-consolidated-title-coverage.json`. Root `pnpm verify` passed; log:
`C:/Users/andcra/AppData/Local/Temp/rostra-ecfr-consolidation-verify.log`. No command from this slice remains active.
Next dependency-ready work is lexical
projection implementation, with historical-source work continuing independently. Embedding model comparison remains
mandatory before bulk embeddings; recurring source schedules remain disabled and API/MCP delivery remains pending.

The final missing current eCFR titles, 3 and 7, completed acquisition, parsing and canonical import without warnings or
failures. Replay reused both editions and generations. No code changes were needed. Raw XML totals 40,683,555 bytes.
Manifest: `artifacts/regulatory-backfills/ecfr-president-agriculture-2026-09-14.json`, ID
`72c22febaefd8f459646e99b1a4f548eed3237433a37e9df47510a8ce9593322`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 3 | 33 | 27 | 2024-05-17 | 2026-09-11 |
| 7 | 20,552 | 17,205 | 2026-09-09 | 2026-09-11 |

This adds 20,585 section/structural records, including 17,232 sections. The port 55438 pilot now contains 234,708 members
across 46 title heads and 46 pending edition projection jobs. Independent SQL compared every body, heading and block to
staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are unchanged.

Live inventory reconciliation across this pilot and the older port 55434 pilot verified all **49 non-reserved current
eCFR titles**, **275,149 members**, no missing/unexpected/duplicate titles, and reserved title 35 excluded. The older
pilot holds 40,441 members for titles 1/21/40. Both pilots' title currency dates are September 11. This is a complete
title inventory for the frozen current eCFR scope across two local databases, not consolidated storage, full historical
edition coverage, complete federal regulatory data, executive-order coverage, or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-president-agriculture-raw/`,
`ecfr-president-agriculture-normalized/`, `ecfr-president-agriculture-import.json`,
`ecfr-president-agriculture-replay.json`, `ecfr-president-agriculture-integrity.json` and
`ecfr-current-title-coverage.json`. The inventory report initially hit PowerShell line-by-line JSON decoding; joining
the returned JSON lines corrected the report step, and the subsequent complete inventory gate passed.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-president-agriculture-verify.log`. No command from
this slice remains active. Next: consolidate the current corpus through the existing validated importer,
implement lexical projections, and continue unresolved historical-source work. Recurring source schedules remain
disabled, and the required embedding comparison must precede bulk embeddings. API/MCP delivery remains pending.

The frozen eCFR wave for titles 46–50 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures. Replay reused every edition and generation. Raw XML totals 117,956,550 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-transport-wildlife-2026-09-14.json`, ID
`eff7a280efa72b3dbe3a3aab060219b1bc1ce72e6ef4db7b6c19f58cb4d9e561`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 46 | 10,206 | 8,430 | 2026-09-01 | 2026-09-11 |
| 47 | 5,995 | 5,178 | 2026-09-11 | 2026-09-11 |
| 48 | 15,073 | 11,550 | 2026-09-01 | 2026-09-11 |
| 49 | 10,789 | 8,998 | 2026-09-11 | 2026-09-11 |
| 50 | 3,943 | 3,213 | 2026-09-11 | 2026-09-11 |

This adds 46,006 section/structural records, including 37,369 sections. The port 55438 pilot now contains 214,123 members
across 44 title heads and 44 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot; titles 3 and 7 remain to backfill. These current local
imports do not establish full historical edition coverage or production search availability.

Title 49 materialization took longer than earlier titles; live database inspection showed active short membership-write
batches and no reported lock wait. It completed successfully. Preserve this observation for throughput profiling before
larger historical waves rather than treating successful replay as a performance benchmark.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-transport-wildlife-raw/`, `ecfr-transport-wildlife-normalized/`,
`ecfr-transport-wildlife-import.json`, `ecfr-transport-wildlife-replay.json` and `ecfr-transport-wildlife-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-transport-wildlife-verify.log`. No command from
this slice remains active. Continue titles 3/7 and lexical projection implementation. Recurring source schedules
stay disabled, and the required embedding comparison must precede bulk embeddings.

The frozen eCFR wave for titles 41–45 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures; replay reused all editions and generations. Raw XML totals 52,007,882
bytes. Manifest: `artifacts/regulatory-backfills/ecfr-health-welfare-2026-09-14.json`, ID
`d84dc48aecc9a909f45afb58e648660eaf5c9a4d0372bd44031b638d7d846b8d`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 41 | 3,848 | 3,094 | 2026-08-31 | 2026-09-11 |
| 42 | 8,547 | 7,290 | 2026-08-13 | 2026-09-11 |
| 43 | 6,517 | 5,436 | 2026-08-12 | 2026-09-11 |
| 44 | 1,160 | 943 | 2026-06-22 | 2026-09-11 |
| 45 | 7,015 | 5,809 | 2026-08-31 | 2026-09-11 |

This adds 27,087 section/structural records, including 22,572 sections. The port 55438 pilot now contains 168,117 members
across 39 title heads and 39 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot. Titles 3, 7 and 46–50 remain to backfill. Current local
imports do not establish full historical edition coverage or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-health-welfare-raw/`, `ecfr-health-welfare-normalized/`,
`ecfr-health-welfare-import.json`, `ecfr-health-welfare-replay.json` and `ecfr-health-welfare-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-health-welfare-verify.log`. No command from this
slice remains active. Continue the remaining frozen titles and lexical projection implementation.
Recurring source schedules stay disabled, and the required embedding comparison must precede bulk embeddings.

The frozen wave for eCFR titles 32–34 and 36–39 completed without code changes. All seven acquisitions, parses and
canonical imports succeeded without warnings or failures; replay reused every edition and generation. Title 35 is
reserved and is not part of this requested scope. Raw XML totals 58,406,984 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-defense-education-2026-09-14.json`, ID
`c5febb307fce868e7c42db27412bb0ac372daa67dc0f866e36b81a50082123a4`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 32 | 4,473 | 3,640 | 2026-08-17 | 2026-09-11 |
| 33 | 5,388 | 4,649 | 2026-09-10 | 2026-09-11 |
| 34 | 4,045 | 3,259 | 2026-09-09 | 2026-09-11 |
| 36 | 3,717 | 3,135 | 2026-09-11 | 2026-09-11 |
| 37 | 1,627 | 1,331 | 2026-08-26 | 2026-09-11 |
| 38 | 3,506 | 2,953 | 2026-08-27 | 2026-09-11 |
| 39 | 1,350 | 1,137 | 2026-06-12 | 2026-09-11 |

This adds 24,106 section/structural records, including 20,104 sections. The port 55438 pilot now contains 141,030 members
across 34 title heads and 34 pending edition projection jobs. Independent SQL compared every body, heading and block to
staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are unchanged.
Titles 1/21/40 remain in the separate port 55434 pilot. Current eCFR coverage is still partial and local; titles 3, 7 and
41–50 remain to backfill. These imports do not establish historical edition coverage or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-defense-education-raw/`, `ecfr-defense-education-normalized/`,
`ecfr-defense-education-import.json`, `ecfr-defense-education-replay.json` and `ecfr-defense-education-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-defense-education-verify.log`. No command from
this slice remains active. Continue the remaining frozen titles and lexical projection implementation;
recurring source schedules stay disabled and embedding comparison remains required before bulk embeddings.

The frozen wave for eCFR titles 27–31 completed without code changes. All acquisitions, parses and canonical imports
succeeded without warnings or failures; replay reused all five editions and generations. Raw XML totals 66,549,204
bytes. Manifest: `artifacts/regulatory-backfills/ecfr-labor-treasury-2026-09-14.json`, ID
`c0ee31ac74640c8625f397a74119e234a9fe6df9d9facbc15baf004dcf106825`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 27 | 4,874 | 3,952 | 2026-08-17 | 2026-09-11 |
| 28 | 3,758 | 3,071 | 2026-09-10 | 2026-09-11 |
| 29 | 8,847 | 7,271 | 2026-09-09 | 2026-09-11 |
| 30 | 6,942 | 5,954 | 2026-09-10 | 2026-09-11 |
| 31 | 6,513 | 5,442 | 2026-09-10 | 2026-09-11 |

This adds 30,934 section/structural records, including 25,690 sections. The port 55438 pilot now contains 116,924 members
across 27 title heads and 27 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest remain
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot. These are local canonical backfills, not searchable
production coverage.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-labor-treasury-raw/`, `ecfr-labor-treasury-normalized/`,
`ecfr-labor-treasury-import.json`, `ecfr-labor-treasury-replay.json` and `ecfr-labor-treasury-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-labor-treasury-verify.log`. No command from this
slice remains active. Continue remaining frozen titles and lexical projection implementation. Recurring
source schedules remain disabled, and the required embedding comparison must precede bulk embeddings.

The frozen eCFR wave for titles 22–26 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures, and replay reused every edition and generation. Raw XML totals
115,569,281 bytes, including the 87,254,727-byte Internal Revenue title. Manifest:
`artifacts/regulatory-backfills/ecfr-housing-tax-2026-09-14.json`, ID
`f7fdc2138257f62a99fb5708b814f63fe0607399f31f86a75bc1402e0e250352`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 22 | 4,086 | 3,408 | 2026-09-11 | 2026-09-11 |
| 23 | 1,237 | 987 | 2026-09-11 | 2026-09-11 |
| 24 | 5,843 | 4,877 | 2026-08-20 | 2026-09-11 |
| 25 | 5,522 | 4,747 | 2025-12-01 | 2026-09-11 |
| 26 | 6,595 | 6,158 | 2026-09-08 | 2026-09-11 |

This adds 23,283 section/structural records, including 20,177 sections. The port 55438 pilot now contains 85,990 members
across 22 title heads and 22 pending edition projection jobs. Independent SQL compared all bodies/headings/blocks to
staging with zero mismatches. No active leases remain, and the 75 FR publications and their identity digest are unchanged.
The older titles 1/21/40 remain in the separate port 55434 pilot. These local imports are not yet searchable production
coverage. Title 25's older issue date is retained separately from the publisher's September 11 currency date.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-housing-tax-raw/`, `ecfr-housing-tax-normalized/`,
`ecfr-housing-tax-import.json`, `ecfr-housing-tax-replay.json` and `ecfr-housing-tax-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-housing-tax-verify.log`. No command from this
slice remains active. Continue the remaining frozen title imports and lexical projection
implementation. The embedding comparison remains mandatory before bulk embeddings; recurring source schedules stay off.

The frozen eCFR wave for titles 17–20 completed using the existing pipeline, without code changes. Acquisition and
parsing succeeded without warnings; all four imports published and replay reused the same editions and generations.
Raw XML totals 50,107,693 bytes. Manifest: `artifacts/regulatory-backfills/ecfr-finance-labor-2026-09-14.json`, ID
`0579da64f0a933b13e6ee05d190b3da12690f483c82193e5cc1df36fbee5a55c`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 17 | 4,117 | 3,525 | 2026-09-08 | 2026-09-11 |
| 18 | 2,486 | 2,048 | 2026-08-24 | 2026-09-11 |
| 19 | 3,840 | 3,172 | 2026-08-26 | 2026-09-11 |
| 20 | 6,706 | 5,635 | 2026-09-09 | 2026-09-11 |

This adds 17,149 section/structural records, including 14,380 sections. The port 55438 pilot now has 62,707 eCFR members
across 17 title heads and 17 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain. The 75 FR publications and their observation/version
identity digest remain unchanged. Titles 1/21/40 remain in the separate port 55434 pilot; these are local backfill
results, not consolidated national coverage or a searchable production release.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-finance-labor-raw/`, `ecfr-finance-labor-normalized/`,
`ecfr-finance-labor-import.json`, `ecfr-finance-labor-replay.json` and `ecfr-finance-labor-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-finance-labor-verify.log`. No command from this
slice remains active. Remaining work includes frozen title backfills, lexical projections,
the required embedding model comparison before bulk embeddings, and public API/MCP implementation. Recurring source
ingestion remains disabled; the 10-minute continuation remains active.

The next frozen wave imported eCFR titles 11, 13, 14, 15 and 16 without code changes. All downloads, parses and imports
succeeded without warnings or failures. Raw XML totals 42,040,552 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-business-transport-2026-09-14.json`, ID
`a44419cfbb6319f662489c04fe8420b878407794128623a3d861aa3ecc962409`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 11 | 675 | 587 | 2026-06-08 | 2026-09-11 |
| 13 | 2,082 | 1,707 | 2026-09-10 | 2026-09-11 |
| 14 | 7,638 | 6,363 | 2026-09-11 | 2026-09-11 |
| 15 | 2,884 | 2,237 | 2026-08-28 | 2026-09-11 |
| 16 | 2,750 | 2,158 | 2026-08-31 | 2026-09-11 |

This adds 16,029 section/structural records, including 13,052 section records. Replay reused all five editions. The
port 55438 pilot now contains 45,558 eCFR members across 13 heads, 13 pending edition projection jobs and the unchanged
75 FR publications. Independent SQL compared all 45,558 bodies/headings/blocks with staging and found zero mismatches;
no active leases remain. Older titles 1/21/40 remain in the separate port 55434 pilot.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-business-transport-raw/`, `ecfr-business-transport-normalized/`,
`ecfr-business-transport-import.json`, `ecfr-business-transport-replay.json` and `ecfr-business-transport-integrity.json`.
Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-business-transport-verify.log`; the prior unrelated
Open States lint blocker no longer prevents verification. No command from this slice remains active. Continue frozen
title backfills and lexical projection work; the 10-minute follow-up stays active and recurring source ingestion stays off.

The next frozen eCFR wave added titles 4, 6, 8, 9 and 10 using the existing pipeline, without code changes. All five
downloads/parses/imports succeeded without warnings, blockers or import failures. Raw XML totals 35,979,594 bytes.
Manifest: `artifacts/regulatory-backfills/ecfr-additional-titles-2026-09-14.json`, ID
`53ca6721aac1902e5297e746bef70ab90ab02606b1d24949a402745acf950e00`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 4 | 271 | 222 | 2024-07-18 | 2026-09-11 |
| 6 | 707 | 584 | 2026-08-12 | 2026-09-11 |
| 8 | 1,192 | 989 | 2026-09-09 | 2026-09-11 |
| 9 | 2,900 | 2,440 | 2026-08-19 | 2026-09-11 |
| 10 | 6,488 | 5,265 | 2026-09-09 | 2026-09-11 |

This wave adds 11,558 section/structural records, including 9,500 section records. Replay reused all five canonical
editions. The port 55438 pilot now contains 29,529 eCFR members across eight title heads, eight pending edition jobs,
and the unchanged 75 FR publications. Independent SQL compared all 29,529 bodies/headings/blocks with staging and
found zero mismatches; no active leases remain. The older titles 1/21/40 remain in the separate port 55434 pilot.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-additional-raw/`, `ecfr-additional-normalized/`,
`ecfr-additional-import.json`, `ecfr-additional-import-replay.json` and `ecfr-additional-integrity.json`.
`pnpm verify` was attempted but failed on unrelated `no-unsafe-finally` lint errors in
`src/ingestion/openstates/scraper-docker.ts`; that separate work was not changed. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-ecfr-additional-verify.log`. Do not treat this as a clean repository-wide gate.
The source/import/replay/integrity checks for this data slice passed. No command remains active from this slice;
the 10-minute continuation stays active, and recurring regulatory ingestion remains disabled.

The frozen eCFR expansion added titles 2, 5 and 12 using the existing acquisition, parser and canonical import pipeline.
All three downloads and parses succeeded without warnings. The new raw XML totals 53,691,217 bytes. No code change was
needed for this slice. Manifest: `artifacts/regulatory-backfills/ecfr-expansion-2026-09-14.json`, ID
`3a82510cb9c835e6627803a86270da626794aab2a4b808adc3bce9eaa506d921`.

| Title | Parsed/canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 2 | 2,273 | 1,522 | 2026-08-18 | 2026-09-11 |
| 5 | 6,834 | 5,382 | 2026-09-03 | 2026-09-11 |
| 12 | 8,864 | 7,180 | 2026-09-08 | 2026-09-11 |

These are 17,971 section/structural records, including 14,084 section records, not 17,971 distinct regulations.
All three editions are canonical/current within the local port 55438 pilot, alongside the 75 historical FR documents.
Replay reused the same generations/edition IDs. Independent SQL compared all 17,971 bodies, headings and block payloads
with staging and found zero mismatches; the FR observation/version ID digest is unchanged. There are three pending
edition projection jobs and no active leases. Search execution and embeddings remain pending.

Evidence: `ecfr-expansion-raw/`, `ecfr-expansion-normalized/`, `ecfr-expansion-import.json`,
`ecfr-expansion-import-replay.json` and `ecfr-expansion-integrity.json` under `artifacts/regulatory-backfills/`.
The older titles 1/21/40 pilot remains separate on port 55434; this is not yet a consolidated national dataset.
Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-ecfr-expansion-verify.log`.
No command from this slice remains active. Continue the remaining frozen title waves and lexical projection work;
the 10-minute follow-up stays active and recurring source ingestion stays disabled.

Canonical HTML publication is implemented in `fr-html-publication.ts` and `publish:fr-html-publications`. Both HTML
and XML adapters now reuse `fr-publication-write.ts` for canonical documents, versions, observations and lexical outbox
rows. HTML retains its preformatted source contract and source URL; titles stay in observation metadata and no semantic
heading is inferred. Both raw HTML and supporting PDF artifacts are attached. The batch publishes under the shared
fenced rights transaction with exact staging verification and replay identity checks.

The retained local `rostra-fr-html-storage-pilot` database on port 55438 now has 75 documents, 75 versions, 75 observations
and 75 pending lexical jobs for January 3, 2000. No lease remains active. Independent SQL compared canonical text,
blocks and metadata with all staged records and found zero mismatches. Replay reused the same generation and retained
the observation/version ID digest `56f2de2b674412ef1bbf1ee0b024040c`, with no extra outbox rows.
Evidence under `artifacts/regulatory-backfills/`: `fr-2000-publication-report.json`, `fr-2000-publication-replay.json`,
`fr-2000-publication-integrity.json` and `fr-2000-publication-replay-integrity.json`.

All 26 real PostgreSQL storage tests passed, including canonical HTML replay, absent source evidence, staged tampering,
revoked rights and complete artifact/publication rollback when outbox insertion fails. Full `pnpm verify` passed:
`C:/Users/andcra/AppData/Local/Temp/rostra-html-publication-verify.log`. The disposable test container was stopped;
the pilot database is retained. No command from this slice remains active. Search execution, embeddings, public API/MCP
delivery, archive-wide coverage and recurring source schedules remain pending. Next: expand frozen backfill coverage
and consume the lexical outbox; embedding model comparison remains mandatory before bulk vector generation.

HTML registration/staging is implemented in `fr-import-registration.ts` and `stage:fr-html-publications`.
`fr-publication-files.ts` now shares source revalidation between normalization and staging CLIs. The importer retains
the exact normalized input artifact, registers a format-specific generation in existing tables, and stages the full
bounded set under the shared rights/lease transaction. No XML unit or parser summary is fabricated.

The separate local `rostra-fr-html-storage-pilot` database on port 55438 now contains the 75 January 3, 2000 publication
inputs in `validated` state. Generation: `0021564bf55027ab50d00471b4a2ab4700179e6ee1971c3cbdc1f80f7176de25`.
Evidence: `artifacts/regulatory-backfills/fr-2000-staging-report.json`, `fr-2000-staging-replay.json`, and retained
normalized set artifacts in `fr-2000-import-artifacts/`. Canonical documents and publication outbox remain empty in
this database. All 23 real PostgreSQL storage integration tests passed on the separate disposable port 55436 database,
which was stopped after testing. Next: the atomic canonical HTML publisher, including raw artifact attachment,
version/observation identity, rights checks and lexical outbox rollback/replay validation.

Replay retained the same generation and 75 records. Independent SQL confirmed one generation, 75 staged records,
zero canonical documents, zero publication outbox rows and zero active leases. Full `pnpm verify` passed:
`C:/Users/andcra/AppData/Local/Temp/rostra-html-registration-verify.log`. No command from this slice remains active.
The 10-minute continuation remains active; recurring regulatory source ingestion stays off.

Storage lease enforcement is now format-independent through `withImportLease`. The existing `withLease` wrapper
continues to validate XML units and summaries before invoking XML writers. This removes the lease layer's XML
assumption while retaining one shared path for rights checks, transaction rollback, token/fence matching and expiry
checks before commit. No new database tables or canonical records were created by this slice.

All 22 real PostgreSQL storage integration tests passed, including two new checks for non-XML dispatch isolation,
revoked rights and end-of-transaction expiry rollback. The disposable `rostra-fr-storage-tests` database on port 55436
was used and its container was stopped afterward. Retained pilot databases were not touched. Next: register bounded
HTML generations under the shared lease contract, then publish their verified text and supporting artifacts atomically.

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-leases-verify.log`. No command from
this slice remains active. The 10-minute continuation remains active; recurring regulatory ingestion stays disabled.

`fr-publication-input.ts` and `normalize:fr-html-publications` now produce format-aware publication inputs from the
verified HTML and supporting PDFs. The offline adapter replays metadata, revalidates source bytes and PDF proof, and
uses the existing lossless reader projection. HTML remains `html_preformatted`; no XML structures or legal sections
are invented. Text keys are distinct from metadata observation keys. The XML issue database writer remains unchanged.

All 75 January 3, 2000 publications normalized to 128 reader blocks with zero reconstruction mismatches. Two independent
offline runs produced byte-identical files: `artifacts/regulatory-backfills/fr-2000-early-publication-inputs.json` and
`fr-2000-early-publication-inputs-replay.json`, SHA-256 `e790682d277011329bb851ff978ce875f60e671f82c0341dd7266116867e44b7`.
The serialized publication payload is 3,020,954 bytes. Normalizer hash:
`1b856b880aab2645d0ac37058d36362934b490f2626442cb0d0c24f04929aa19`.
Ten focused normalization/HTML tests passed, including a real synthetic PDF, metadata-only identity changes, source
scope/hash rejection and lossless multi-block text. No canonical records were published. Next: extend import-generation
storage and fenced publication to consume this input contract, with rights/outbox/replay tests on a disposable database.

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-publication-input-verify.log`. No command from
this slice remains active; the 10-minute continuation stays active and recurring regulatory source ingestion stays off.

The alternate-text continuation implemented `fr-html.ts` and `acquire:fr-html`. All 75 January 3, 2000 supported
publications have now been acquired as document-specific official GovInfo HTML (1,353,207 bytes; 1,333,371 retained
text characters). Every source passed header document-number, date/volume, type, page-range and expected-only-footer
checks. All 75 were hash-verified, reparsed and reused on replay. The shared-page contamination found in PDF-derived
text is avoided by these publisher-specific renditions; no PDF columns were automatically trimmed.

Evidence: `artifacts/regulatory-backfills/fr-2000-early-html-report.json`, `fr-2000-early-html-replay.json`, and raw
HTML/receipts under `fr-2000-early-html/`. Parser SHA-256:
`5a90aa88245304aad7b7b3f4c4c0327ffc64eeb72d80d24e9779ba9c12d42d06`.
Nine focused tests passed, covering preserved spacing, source assertion mismatches, foreign footers, offline replay,
corrupt retained bytes and the exact source URL allowlist. This remains source-text staging: canonical normalization,
rights-aware publication, API exposure, indexing and embeddings were not performed. Next: map verified HTML renditions
into the canonical publication contract without inventing XML structure, and retain the supporting PDFs separately.
See [HTML acquisition and validation](fr-metadata-validation.md#document-specific-govinfo-html).

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-html-verify.log`. No command from this slice
remains active. The 10-minute continuation remains active and all recurring regulatory source schedules stay disabled.

The PDF text slice adds `fr-pdf-text.ts`, `extract:fr-pdf-text`, its isolated worker and `fr-pdf-boundaries.ts`.
It reuses the existing document extractor and OCR assessment without submitting OCR jobs or changing the shared
extractor. Three worker/staging tests exercise actual digital and image-only PDFs, replay, hash corruption and
publisher page mismatches; three additional tests cover conservative boundary diagnostics. Existing three PDF
validation tests also pass.

All 75 January 3, 2000 PDFs extracted successfully and all 75 staged artifacts were verified and reused on replay.
The report is `artifacts/regulatory-backfills/fr-2000-early-pdf-text-replay.json`; the first run report is
`fr-2000-early-pdf-text-report.json`, and content-addressed artifacts are in `fr-2000-early-pdf-text/`.
Extractor fingerprint: `ae8ae492d73a46ac824de7090ba9d4ebe04753e5a773bc51da424db5ab0051b3`.
No source requested OCR under the shared extractor's assessment. This does not prove visual completeness or reading order.

The boundary audit flags 67 PDFs with foreign FR Doc footers; eight contain only the expected detected footer and remain
`boundaries_unverified`. For example, `99-33595` begins with neighboring publication `99-34038`. No staged PDF text is
ready for canonical publication. Next: acquire document-specific official text or implement evidence-backed page/column
boundary reconciliation; do not ingest the whole extracted PDF as the target publication. Other backfill waves remain
dependency-ready. See [PDF text staging](fr-metadata-validation.md#pdf-derived-text-staging) for runtime limits and replay.

Final `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-pdf-text-complete-verify.log`.
An earlier run observed organization-membership assertion failures in concurrently modified non-regulatory files;
the final full run is clean. No extraction or verification command from this slice remains active, and no canonical
records, indexes, embeddings or recurring source schedules were changed.

The September 14 historical PDF continuation acquired all 75 supported January 3, 2000 publications from official
GovInfo links (17,383,416 bytes). Replay reused all 75; isolated parser validation passed for all 258 pages with matching
document numbers and publisher page counts. There were no empty-text pages. Metadata links no XML for these records;
the missing bulk XML status remains valid even though official PDFs are now retained. This slice reused the existing
acquisition and validation code, without changing the extractor or canonical storage. PDF text normalization, OCR
assessment and source-to-canonical publication remain pending.

Evidence is in `artifacts/regulatory-backfills/fr-2000-early-pdf-acquisition.json`,
`fr-2000-early-pdf-replay.json`, `fr-2000-early-pdf-validation.json`, and `fr-2000-early-pdfs/`.
Full `pnpm verify` passed; log `C:/Users/andcra/AppData/Local/Temp/rostra-fr-historical-pdfs-verify.log`.
No command from this slice remains active. The 10-minute follow-up remains active; source schedules remain disabled.

Historical FR source checks now include `audit:fr-inventory`, which independently replays the bulk listing and metadata
before comparing each date. Smoke reports are `artifacts/regulatory-backfills/fr-2000-early-inventory-audit.json`,
`fr-2000-available-inventory-audit.json` and `fr-2024-inventory-audit.json` in the same directory. January 3, 2000 has
75 supported metadata records but no listed XML; January 18 has 109 supported records and a listed issue, yet parsing
fails on a duplicate source document number. The modern January 2, 2024 inventory has 63 supported records plus two
excluded presidential documents. Neither inventory agreement nor an empty day certifies publication completeness.
Historical FRDOC formatting was fixed and all five original pilot units reprocessed without failure, totaling 40,872
records. Missing-rendition acquisition and evidence-backed resolution of the duplicate remain pending; schedules and
canonical publication were not enabled. See [parser validation](parser-validation.md) and [acquisition workflows](acquisition-workflows.md).

Validation: 24 focused inventory/parser tests passed; all five reprocessed pilot units have byte-identical normalized
shards compared with the prior parser. Full `pnpm verify` passed, with log
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-historical-verify.log`. No command from this slice remains active.
The next historical task is alternate-rendition text normalization and reconciliation for the missing/ambiguous
January 2000 publications; raw January 3 PDF acquisition is now complete as recorded below. Other frozen backfill
waves can proceed independently.

- `src/ingestion/regulations/contracts.ts`: strict frozen acquisition scope, source evidence, unit/manifest identity and
  checksum validation. This is the acquisition portion of SRC-01; normalized envelopes and licensed capabilities remain.
- `backfill-plan.ts` and `tools/regulations/plan-regulatory-backfill.ts`: actual official inventories for dated eCFR titles, monthly
  FR bulk issues and annual CFR title/volumes. Saved-inventory replay requires no network, credentials, DB or Trigger.
- `artifact-backfill.ts` and `tools/regulations/acquire-regulatory-backfill.ts`: bounded local downloads, per-directory writer lock,
  streamed byte ceiling, immutable SHA-256 artifacts, atomic complete receipts and verified resume. HTML error bodies,
  unexpected hosts/paths, changed listing byte counts and damaged retained files fail instead of completing the unit.
- Shared HTTP client's optional `streamBody` path avoids prebuffering large regulatory XML; existing callers retain
  their current buffering behavior. Existing pacing, cooldown, timeout and provider-error handling are reused.

SRC-03, DATA-01, COL-02/04/05/07/11 and the local reader foundation API-13 are checked off. SRC-01/02/04/05/06/10/12, DATA-02/03/05/06/07/09/10/11/12/13/14 and
COL-01/03/06/08/09/12/13/14 have partial implementation or pilot evidence. Phases 0–2 have not passed their full gates.
Canonical eCFR schema and local database import are implemented. Trigger deployment, API/MCP release, embedding
execution and production coverage remain pending.

The second implementation slice adds `python/regulations/parse_xml.py`, strict normalized-record and summary schemas,
the isolated TypeScript subprocess bridge, retained official-source excerpt fixtures, and `parse:regulatory-backfill`.
The parser file is explicitly included in Trigger's Python packaging. Local execution is verified; deployment is pending.
See [parser contract and pilot validation](parser-validation.md) for bounds, evidence, source anomalies and remaining gates.

The third slice adds the initial regulatory storage migration, durable generation staging and database leases,
canonical eCFR edition/provision/version membership, fenced publication and a transactional lexical outbox. See
[storage validation](storage-validation.md) for the exact supported scope, recovery contract and retained limitations.
Rights are explicitly versioned; later licensed source adapters and read-side enforcement remain separate work.

The fourth slice adds FederalRegister.gov metadata acquisition, exact cursor traversal, saturated-window splitting,
durable page evidence/offline replay and the GovInfo XML document-number reconciliation. See [FR metadata validation](fr-metadata-validation.md).
The live pilot matched every supported publication. No canonical Federal Register publication was written by this slice.

## Live pilot evidence

Manifest: `artifacts/regulatory-backfills/federal-pilot-2026-09-14.json`, ID
`be0024b71aedb90b20e34ec70358d2225d4d8f9d2b7236b4b4a93f1ee6ff9c8a`.
Source inventory replay produced the same ID. Original JSON inventories, source URLs, retrieval timestamps and hashes
are embedded in the manifest. Raw artifacts and per-unit receipts are in `artifacts/regulatory-backfills/raw/` (local,
ignored by git); attempt reports are in its `attempts/` directory. Transfer completed at 2026-09-14T21:28:25.655Z.

| Frozen source unit | Acquired bytes | Status |
| --- | ---: | --- |
| eCFR title 1 | 477,387 | Parsed and text-audited: 368 records |
| eCFR title 21 | 21,352,229 | Parsed and text-audited: 9,763 records |
| eCFR title 40 | 157,033,410 | Parsed and text-audited: 30,310 records |
| Annual CFR 2024 title 1 volume 1 | 814,725 | Parsed: 368 records; source-date mismatch flagged |
| Federal Register January 2, 2024 issue | 1,897,193 | Parsed and text-audited: 63 publications |
| eCFR title 35 | — | Explicitly excluded as reserved |

Title 40 demonstrates why downloads must stream and parser memory must be measured. The first transfer used the
existing buffered HTTP path; the streaming correction and focused regression check were added afterward. No memory
benchmark or recommended fan-out follows from this first transfer.

A separate streaming XML structure inspection verified all five files are well formed. Retained report:
`artifacts/regulatory-backfills/federal-pilot-xml-inspection-2026-09-14.json`. Title 40 contains 1,891,004 XML elements,
maximum nesting depth 15; its structure scan took 2.89 seconds locally. This scan clears source elements and does not
normalize legal records, preserve searchable text, measure parser memory or establish production throughput.

The resume run at 2026-09-14T21:31:18.010Z verified every retained artifact's SHA-256/byte count and reused all five
receipts, with zero failures and no pending raw units in this pilot. Raw bytes remain local; Azure retention is pending.

## First-slice verification

- 35 focused tests passed across regulatory backfill and shared HTTP/cooldown suites, including 20 new regulatory tests.
- Scoped oxlint and service TypeScript checks passed.
- Root `pnpm verify` passed. Legislation coverage run: 282 test files passed, 6 skipped; 2,724 tests passed, 79 skipped.
  Environment-dependent integration skips remain skips, not evidence of production DB/schema acceptance.
- Full verification log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-backfill-verify.log`.
- Review/checks apply to the current working tree. Existing unrelated Open States, ingestion and documentation changes
  were preserved. No git commit or production deployment was made by this implementation slice.

GovInfo JSON listing endpoints require a trailing slash in the tested environment. The same paths without `/` returned
HTTP 200 HTML service-error pages. Official returned folder links omit the slash, so the annual CFR adapter normalizes
it before requesting directories. File links come directly from the listing; dates without issues are not guessed.

## Parser-slice verification

- 38 focused tests passed across regulatory acquisition, the real Python parser/bridge, and Trigger packaging configuration.
- Scoped oxlint and service TypeScript checks passed.
- Root `pnpm verify` passed, including format, lint, types, knip and coverage tests. Legislation: 283 test files passed,
  7 skipped; 2,742 tests passed, 83 skipped. Environment-dependent integration skips do not establish database readiness.
- Full verification log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-parser-verify.log`.
- All five pilot files parsed successfully: 40,872 records in 35 shards. An independent source XML comparison found
  zero text-content mismatches across those records and matched every source element count.
- The annual CFR advertised 2024 edition contains a printed January 1, 2023 revision date. Both values and a warning
  are retained; publication requires resolving the discrepancy. No canonical database writes or embedding runs occurred.

## Commands

The storage slice has its own [execution and database safety contract](storage-validation.md#execution-and-checks).

Run from `apps/legislation-ingestion`. Quote comma-separated options in PowerShell. Outputs are exclusive writes; choose a new
manifest filename for a fresh source observation. Acquisition preview is the default; `--apply` writes local files only.
The dated inputs remain historical evidence under `apps/legislation/artifacts`; resolve their actual local paths
before replay. Earlier source paths and verification results describe the combined workspace at the recorded date.

```powershell
pnpm tool regulations/plan-regulatory-backfill --cutoff 2026-09-14 --ecfr-titles '1,21,35,40' --fr-start 2024-01-02 --fr-end 2024-01-02 --cfr-years 2024 --cfr-titles 1 --output artifacts/regulatory-backfills/federal-pilot-2026-09-14.json
pnpm tool regulations/plan-regulatory-backfill --replay artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --output artifacts/regulatory-backfills/federal-pilot-replay-2026-09-14.json
pnpm tool regulations/acquire-regulatory-backfill --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --output artifacts/regulatory-backfills/raw --limit 5 --apply
pnpm tool regulations/parse-regulatory-backfill --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --raw artifacts/regulatory-backfills/raw --output artifacts/regulatory-backfills/normalized --limit 5 --apply
```

`--limit` bounds new unit attempts; already complete receipts are hash-checked and reused. Partial bounded acquisition
reports pending counts; source failures exit nonzero. A stale local lock after a killed process is deliberately not
auto-deleted: inspect its PID and confirm the writer ended before removing that exact lock. This local lock is not the
cross-host DB lease/fencing implementation required for Trigger. Artifact-only downloads do not validate complete XML,
legal identities or usable text; parsing and publication are separate stages. Parsing `--limit` selects the first N
manifest units; increase it for larger saved manifests. Matching parser generations are revalidated and reused.

## Next dependency-ready work

Use the [production backlog](production-backlog.md#recommended-first-execution-slices), checking its dependencies against
the newest evidence above. The old five-step queue was superseded by implemented annual publication, metadata/rendition
work and local search lifecycle services. No vendor license, source activation or full serving readiness is inferred.

## Storage pilot and verification

Migration 0048 created 13 regulatory tables using the normal migration runner on disposable PostgreSQL 18. The existing
canonical jurisdiction `jurisdiction:us` owns the code records. Runtime code is in `storage.ts`, `storage-contract.ts`,
`import-normalized.ts` and `tools/regulations/import-regulatory-backfill.ts`. No production migration or data write occurred.

| Unit | Staged | Canonical members | Disposition |
| --- | ---: | ---: | --- |
| eCFR title 1 | 368 | 368 | Published in disposable database |
| eCFR title 21 | 9,763 | 9,763 | Published in disposable database |
| eCFR title 40 | 30,310 | 30,310 | Published in disposable database |
| Annual CFR 2024 title 1 volume 1 | 368 | 0 | Blocked: printed source date needs review |
| FR January 2, 2024 | 63 | 0 | Blocked: canonical publication/metadata contract pending |

The successful bounded run took 101.404 seconds locally, including retained-file validation, staging and canonical
materialization. This is one local worker under shared workstation load, not a deployed fan-out or throughput guarantee.
Its structured result has zero execution failures, three published units and two explicit blockers; CLI exit status is
nonzero because blockers remain. All 40,872 records are staged. All 40,441 canonical members match staged text, headings,
structured blocks, source locators and ordinals, with zero mismatches in an independent read-only SQL comparison.

There are three current edition pointers, 40,441 provision versions, three pending lexical outbox jobs, no embedding or
event jobs and no active leases after completion. The lexical jobs are retained work, not completed indexing. A full
second import revalidated the raw/normalized files and reused all five generations, preserving edition IDs and blockers.

The first title-40 attempt hit the 60-second PostgreSQL statement timeout during parent validation. The initial
unreleased schema was corrected to store hierarchy metadata separately from large JSON text payloads, then the
disposable database was reset and migrated again. The corrected complete run above passed. Retained failure evidence
remains in `federal-pilot-storage-2026-09-14.json`; it is not the current pilot result.

Reports under local ignored `artifacts/regulatory-backfills/`:

- `federal-pilot-storage-metadata-2026-09-14.json`: complete run and exact generation/edition IDs.
- `federal-pilot-storage-integrity-2026-09-14.json`: independent data comparison, counts and actual query plans.
- `federal-pilot-storage-replay-2026-09-14.json`: full retained-data replay.
- `federal-pilot-storage-implementation-2026-09-14.json`: source hashes, git base, database version and verification outcome.

The title-40 keyset browse and canonical identity lookup both used their B-tree indexes. Recorded database execution
times were 0.071 ms and 0.082 ms on this warm local pilot; these exclude HTTP latency and do not establish production SLAs.

18 focused storage checks passed, including 16 real PostgreSQL cases and two strict rights-policy tests. They include
outbox failure and mid-transaction lease expiry injected after the head write: both roll back visibility and recover on
retry. Test database reset and migration ran on a separate local instance from the retained real-data pilot.
Root `pnpm verify` passed, including formatting, lint, types, knip and coverage. The legislation coverage run passed
284 files and 2,746 tests; eight files and 101 tests were skipped for their environment requirements. The separate
18-check storage run above executed against PostgreSQL and is not represented by the default run's integration skips.
Final log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-storage-verify-final.log`.
The first full check identified an undeclared use of the repository's existing `tiny-invariant` dependency; its app
declaration and lockfile were corrected before the passing final run. Unrelated working-tree changes were preserved.

Retained local pilot container: `rostra-regulatory-storage-check`, loopback port 55434, database `regulations_test`.
The isolated `rostra-regulatory-storage-fault-check` container uses port 55435 and is stopped after verification.
Neither is the existing legislation development database. No import or verification process remains running for this slice.

## Federal Register metadata pilot and verification

The January 2, 2024 metadata inventory completed four source pages containing 65 distinct documents. Offline replay
reconstructed the same manifest, and a separately acquired single-page response matched all 65 normalized records.
The GovInfo XML reconciliation matched all 63 supported publications with zero gaps. Two presidential documents remain
explicit scope exclusions, with their metadata count checked against the XML source element count.

All 63 matched publications have validated publisher-listed PDF URLs. The later rendition slice below acquired them;
the original reconciliation report still leaves `artifactsComplete` and `publicationReady` false. Correction links retain unresolved
targets outside the selected issue. No Federal Register canonical records, embeddings or recurring schedules were created.

44 focused checks passed: 28 metadata/reconciliation cases and 16 existing parser/bridge cases. The first full repository
run encountered an unrelated concurrent Next build lock and the large two-subprocess parser test's five-second timeout.
That single test now has a bounded 30-second timeout to accommodate full coverage load; the parser's runtime contract
and retained generation hashes are unchanged. The focused rerun passed before restarting repository verification after
the competing build completed.

Root `pnpm verify` passed: format, lint, types, knip and coverage. Legislation passed 286 test files and 2,774 tests;
eight files and 103 tests were skipped for their environment requirements. This includes all 240 Next router acceptance
tests. Integration skips do not establish production or regulatory database readiness.
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-metadata-verify-final.log`. The retained
`artifacts/regulatory-backfills/fr-metadata-implementation-2026-09-14.json` records source hashes, git base and outcomes.
No verification or acquisition process remains running for this slice. The 10-minute continuation remains active.
See [FR metadata validation](fr-metadata-validation.md) for the exact manifest, source fixtures, commands and reports.

## API review implementation and source reader

The approved API names now use `/api/legal/...` and `/api/search/legal` throughout the active contracts. The three
review perspectives are reflected in explicit text reading, edition membership discovery, source agency aliases,
capability states, strict wire-schema integration and a separately gated enterprise synchronization protocol.
See [API and MCP contract](../../../legislation-web/docs/regulations/api-mcp-contract.md). Public regulatory routes are still planned, not deployed.

`reader-contract.ts` and `reader-text.ts` implement strict selection/context/capability schemas and a lossless source
text projection. Edition plus version asserts membership; publisher-date selection is exclusive. Reader windows
preserve table tabs, footnotes and whitespace, bound blocks to 16,384 UTF-16 units and windows to 100,000, and bind
continuation to caller, edition, observation, rights revision, content generation and limit. Authorization must still
run in the future read service before every call. Source XML is not emitted, and this is not a rich table-cell renderer.

17 focused checks passed. `smoke:regulatory-reader` revalidated raw hashes and normalized shards, then reconstructed
all 40,872 retained source bodies exactly across 1,015,792 blocks and 76,301 windows, with zero failures. The largest
observed window was 99,900 characters. The smoke took 20.675 seconds locally and used preview source-record identities;
it does not prove canonical API identity, authorization, HTTP or MCP delivery. The Python parser remained unchanged.
Report: `artifacts/regulatory-backfills/federal-pilot-reader-2026-09-14.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-reader-verify.log`.

## Federal Register PDF acquisition

`fr-pdf.ts` and `acquire:fr-pdfs` implement serial, paced, bounded downloads from exact publisher-listed GovInfo URLs.
Receipts bind the metadata manifest, issue date and document number. Downloads reject wrong MIME types, missing PDF
signature/end markers, length mismatches and oversized bodies. Immutable bytes and receipts use atomic links and
flushes; a per-directory writer lock prevents overlapping workers. Resume verifies every cached hash before reuse.
A process killed before cleanup can leave `writer.lock`; verify the writer is gone before removing that exact lock.
Failed records retain explicit reasons; a bounded subset never claims complete issue acquisition.

The pilot acquired all 63 supported January 2, 2024 PDFs, totaling 23,328,275 bytes. A second run reused all 63 verified
receipts. Reports are `fr-pdfs-pilot-2026-09-14.json` and `fr-pdfs-replay-2026-09-14.json` under the same artifact root;
bytes and receipts live in `fr-pdfs/`. Acquisition does not validate cross-reference tables, embedded objects, page
rendering or text extraction. Structural validation remains pending and `publicationReady` stays false. No canonical
FR records, embeddings or source schedules were created. Nine PDF tests plus 20 existing backfill tests passed;
service TypeScript and scoped lint passed before subsequent concurrent Open States edits.

Two combined verification attempts encountered concurrent-workspace coverage directory removal after the new tests
passed. The optional `LEGISLATION_COVERAGE_DIRECTORY` setting now selects an isolated Vitest report directory and is
passed through Turbo's coverage task; ordinary runs still default to `coverage`. This changes report storage only.
The isolated final run uses `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-reader-pdf-coverage-20260914`.

The reduced-concurrency coverage run passed legislation: 289 test files and 2,814 tests, with eight files and 103
environment-dependent tests skipped. It also passed the theme package after the earlier contention timeouts; unrelated
web UI tests failed. Log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-coverage-reduced.log`.
The latest root `pnpm verify` cannot be reported clean: concurrent Open States work introduced TypeScript literal-type
errors in `src/ingestion/openstates/people-archive-pair.test.ts` at lines 23 and 31. Those unrelated files were preserved.
Log: `C:/Users/andcra/AppData/Local/Temp/rostra-regulatory-reader-pdf-verify-complete.log`. Recheck root verification once
that active work settles; do not rerun the successful network acquisition or source-reader smoke without a relevant change.
No acquisition or verification command from this slice remains active.

The subsequent slice below completes the bounded FR publication writer and required-PDF attachment. Remaining work
includes canonical agency aliases, the annual CFR source-date mismatch, authenticated legal reads and route/client/MCP
integration. API-14 enterprise synchronization and embedding-model comparison remain independent explicit gates.

## Canonical Federal Register pilot

The PDF gate passed all 63 retained originals across 266 pages. Each file's current SHA-256, publisher document number
and publisher page count matched. Every page's text and drawing operators were parsed in a bounded child process.
The largest document has 51 pages; its first page was rendered with Poppler and visually inspected. Full visual review,
PDF conformance certification and malware sanitization are not claimed. Report: `fr-pdf-validation-2026-09-14.json`.

The revised unreleased migration adds five FR tables. The issue writer preserves stable document IDs, XML text versions,
metadata observations and required rendition evidence; it publishes one reconciled issue and its pending lexical jobs
in one fenced transaction. It rejects missing renditions, identity/page-count mismatches and changed snapshots on replay.
The current limit is 1,000 publications and 8 MiB staged payload per issue. Larger issues need the partitioned writer.
Agency/RIN/docket/correction evidence is retained but is not promoted into canonical agency/action/relationship records.
Metadata-only refresh under the same XML generation remains an explicit conflict, not an automatic overwrite.

Real PostgreSQL validation passed 20 storage tests, including four new FR scenarios: stable replay, missing/mismatched
renditions, full rollback after outbox failure with successful retry, and revoked rights/expired lease rejection.
Three PDF parser/gate tests passed alongside them, for 23 focused checks. The first run exposed a test cleanup omission
for the new document table; after correcting isolation, all checks passed. Service types and scoped lint passed.

The real January 2, 2024 pilot contains 63 publications, 63 versions, 63 observations and one published batch. Independent
SQL comparison found zero XML text/heading/block mismatches. A full retained-file replay preserved all IDs and counts.
There are 63 pending lexical jobs and zero active leases. No index, embedding, customer alert or source schedule was run.
The unresolved correction target `2023-27742` remains publisher evidence; its separate correction publication was retained.

Reports under local `artifacts/regulatory-backfills/`: `fr-publication-storage-2026-09-14.json`,
`fr-publication-integrity-2026-09-14.json`, and `fr-publication-replay-2026-09-14.json`.
Retained pilot: container `rostra-fr-storage-pilot`, loopback port 55437, database `regulations_test`.
Separate destructive test container `rostra-fr-storage-tests`, port 55436, is stopped. The earlier eCFR pilot on 55434
and ordinary development database on 55432 were not modified. The revised migration was applied only to fresh FR databases.
See [storage validation](storage-validation.md) for commands, bounds and recovery semantics.

Root `pnpm verify` passed: formatting, lint, types, unused-code checks and coverage. Legislation passed 291 files and
2,819 tests; eight files and 108 environment-dependent tests were skipped. The separate 20-test real PostgreSQL run
above exercised regulatory storage instead of relying on its default skips. Log:
`C:/Users/andcra/AppData/Local/Temp/rostra-fr-publication-verify-complete.log`.
An earlier attempt encountered concurrent web coverage-file removal. A subsequent run exposed a five-second timeout
in the existing corrupt-input/shard-reuse parser test, which launches real processes. That test now has a bounded
30-second timeout; all 16 parser checks passed on focused rerun, then the full repository passed. Parser production
limits and retained parser hashes were unchanged. Coverage files are retained in the isolated temporary directory;
Turbo's missing-default-output warning does not indicate a failed check. No command from this slice remains running.
The 10-minute continuation remains active. Next: larger-issue publication, source/agency relationships and remaining
historical coverage gates, then lexical-index consumption and authenticated API/MCP reads. Bulk embeddings remain gated
on the required held-out model comparison.

## Publisher agency and proceeding-reference projection

The continuation found no active regulatory worker or verification process and completed a local source-reference
projection. `fr-source-references.ts` and `project:fr-references` normalize publisher agency IDs, source parent IDs,
RINs and document-scoped dockets while retaining every original field and occurrence. No canonical organization/action
is assigned and no cross-document name or docket merge is performed. Missing names/identifiers have explicit reasons.

Offline replay of the retained metadata manifest projected all 63 supported publications: 94 agency occurrences,
40 distinct usable publisher agency IDs, seven RIN occurrences and 68 docket occurrences. No missing names, unidentified
agencies or blank identifiers appeared in this pilot. Report:
`artifacts/regulatory-backfills/fr-source-references-2026-09-14.json`. It contains the per-publication source evidence,
stable hashes and explicit unresolved assignments; it made no network requests or canonical database writes.

Five focused tests passed, covering the complete official fixture, name changes under a stable native ID, same-name
unidentified agencies, unusable values, docket collisions and shared RINs without action merging. Scoped lint and service
types passed. Full `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/rostra-fr-source-reference-verify.log`.
No command from this slice remains running. Normalized DB reference storage, reviewed organization resolution,
action/relationship promotion and public directory endpoints remain open; this projection does not close DATA-02.

## Annual CFR title-1 date audit

The idle continuation expanded the frozen annual pilot to title 1 volume 1 under package years 2023, 2024 and 2025.
All three official inventories and downloads succeeded. Each XML is 814,725 bytes, with the identical SHA-256
`443032797d95acd1d1f338e5f6252544b97ec35bd12e6fc0979d3773f9913595`. All parse to 368 records with a printed revision
of January 1, 2023. These are three package observations of the same source bytes, not three distinct code revisions.
The 2024/2025 official PDFs independently print the same date; source links are in [the data contract](../../../../packages/legislation-core/docs/regulations/data-contract.md).
The reuse is upstream, not a parser date-extraction bug. Why the publisher reused those bytes, and whether that supports
a later legal-currency claim, remains unresolved. No date override or canonical annual publication was performed.

`annual-cfr-dates.ts` and `audit:annual-cfr-dates` implement a repeatable evidence gate. The CLI rechecks raw hashes,
receipt scope and every normalized shard before comparing package years and printed dates. Missing or conflicting
dates are explicit outcomes. Shared content is grouped by hash. Even consistent dates do not bypass other publication
gates. A completed audit exits nonzero when date review is required; that is its expected outcome for this source set.

Retained files under `artifacts/regulatory-backfills/`:

- `annual-title1-date-audit-2026-09-14.json`: frozen manifest, ID `5760b9256bae54460ae5ca4be70f8560cca5ba1ae451c45a8e8a66eebb1bd052`.
- `annual-title1-raw/`: source receipts and one content-addressed blob shared by the three packages.
- `annual-title1-normalized/`: three validated generation directories and parser report.
- `annual-title1-date-assessment-2026-09-14.json`: one consistent year, two year mismatches, no publication approval.

Reproduce from `apps/legislation-ingestion`, resolving the retained input paths and selecting fresh outputs:

```powershell
pnpm tool regulations/plan-regulatory-backfill --cutoff 2026-09-14 --cfr-years '2023,2024,2025' --cfr-titles 1 --output artifacts/regulatory-backfills/annual-title1-date-audit-2026-09-14.json
pnpm tool regulations/audit-annual-cfr-dates --manifest artifacts/regulatory-backfills/annual-title1-date-audit-2026-09-14.json --raw artifacts/regulatory-backfills/annual-title1-raw --normalized artifacts/regulatory-backfills/annual-title1-normalized --output artifacts/regulatory-backfills/annual-title1-date-assessment-2026-09-14.json
```

Use fresh output filenames for another run. Quote comma-separated lists in PowerShell. Four focused date-gate tests,
scoped lint and service types passed. Full `pnpm verify` passed; log:
`C:/Users/andcra/AppData/Local/Temp/rostra-annual-cfr-date-verify.log`. No command from this slice remains active.
No DB, index, vector or recurring source
schedule was changed. Other backfill work can continue independently of this annual-date gate.
