# Canonical passage shape inventory

Owner: [remaining search tasks](search-production-tasks.md), PASS-01. The inventory reads canonical memberships,
checks their content hashes, reconstructs reader text and identifies unsupported table layouts. Optional `--prepare`
adds offline full-version passage preparation with both pinned tokenizers. Neither mode calls embedding providers,
writes preparation rows or establishes serving readiness.

The [remaining ditto-source review](ditto-source-review.md) records the whole-version checkpoint audit and canonical
row excerpts needed for the next reference-context repairs. Earlier blocked-block samples are not full-corpus proof.

## Run against a retained local pilot

From `apps/legislation-ingestion`, set `REGULATORY_TEST_DATABASE_URL` to the retained local `regulations_test` database, then run:

```powershell
pnpm tool regulations/inspect-regulatory-shapes --output artifacts/regulatory-backfills/ecfr-current-passage-shapes
```

Existing historical outputs remain under `apps/legislation/artifacts`; resolve those paths explicitly for replay and
use a new output directory for a new scan. Workspace relocation does not move or refresh that evidence.

Omitting `--edition` selects every published current eCFR head in that database. Repeat `--edition <uuid>` to select
specific eCFR or annual CFR editions. The connection enforces read-only transactions and rejects remote hosts or
another database name. Active display and local-search rights are checked throughout the scan.

Add `--prepare` to evaluate every complete canonical version with both OpenAI Small and Voyage 4 tokenizers. The
context matches the preparation worker: jurisdiction, code name, native provision ID and heading. Each model records
an explicit prepared/blocked result, context and manifest hashes, passage/token totals, maxima and continuation counts.
Empty structural versions are prepared with zero passages. Oversized read dispositions count as blocked for each model;
known source-shape failures do not stop other records. Unexpected errors, invalid tokenizer counts and independent
recount/reconstruction failures stop the scan. This measures input eligibility, not embedding relevance or model quality.

Preparation mode and tokenizer identities bind the report directory and replay. Source inventory hashes also bind
the context-producing metadata, and implementation fingerprints are rechecked before publishing completed reports.
Structural layout diagnostics remain separate from model eligibility: a short table can prepare intact even when it
cannot be split into rows. Use a new output directory for qualification; retained older baselines remain historical evidence.

Membership pages contain 100 records. Body reads are grouped within 16 MiB of stored body plus block JSON; an individual
record larger than that budget receives an explicit `inspection_row_byte_limit` disposition. The final count includes
those dispositions. Canonical hash mismatches or unexpected programming errors stop the scan rather than appearing as
ordinary source-shape failures.

## Evidence and replay

Each edition has a content-addressed output directory bound to its generation, memberships, rights policy, scanner
implementation and dependency closure. The fingerprint includes the scanner's direct dependencies, their complete
transitive/peer/optional lock snapshots and package integrity metadata, selected patches, and Node/platform identity.
Unrelated workspace lock changes do not invalidate qualification. Missing or unsupported dependency references fail
before scanning; changes to the selected closure or source implementation still prevent publication. Tokenizer model
files retain their independent pinned checksum checks. `records.ndjson` records every member's version, content hash, source locator, byte size,
reader reconstruction result and table measurements. Tables report nesting, spans, headers, graphics and longest cells,
plus the existing table-layout rejection reason. A classified table can still fail later tokenizer preparation.
Layout validation reports the first rejection per source block. Repairing it can expose another rejection, so rerun
the inventory after parser changes rather than treating reason counts as independent or exhaustive defects.

`report.json` binds the complete NDJSON hash and counters. Re-running verifies its bytes, recomputes counters and checks
current memberships and rights before reuse. Completed editions resume independently. An incomplete edition restarts;
after a killed process, inspect its `active.lock` and confirm that no scanner owns it before removing that specific lock.
No automatic stale-lock reclamation or mid-edition checkpoint recovery is claimed.

`progress.json` records completed editions with `complete: false`. `inventory.json` is published only when all selected
editions finish and the head selection remains unchanged. Inspect the manifest's implementation and generation bindings
when comparing runs; an earlier completed manifest does not describe a later unfinished invocation.

No source text is copied into these reports. Source locators and version IDs identify retained canonical records for
bounded follow-up fixtures. Production orchestration, complete historical/FR inventory, both tokenizer passes and
embedding evaluation remain separate backlog gates.

## September 15 baseline and repair order

The complete retained scans produced these results before the zero-width-spacing reader repair:

| Scope | Members | Table blocks | Blocked table blocks | Reader failures |
| --- | ---: | ---: | ---: | ---: |
| All 49 current eCFR titles | 275,149 | 22,347 | 451 across 268 versions | 1 |
| Annual Title 5 volumes 1–3 and Title 2 volume 1 | 9,003 | 116 | 6 across 3 versions | 0 |

Every canonical content hash matched. No record exceeded the 16 MiB read budget. The eCFR scan has 430 empty-row
rejections and 21 unresolved-ditto rejections; the annual scan adds five empty-row and one unresolved-ditto rejection.
Five annual structural records have empty bodies. Attribute counts are structural measurements, not failures: eCFR has
4,419 blocks containing row-span attributes and 10,967 containing column-span attributes. The longest raw cell contains
5,849 characters in 40 CFR 180.41. No nested table was observed in the classified blocks of these retained samples;
other historical and FR inputs still require their own inventories.

Artifacts under `artifacts/regulatory-backfills/`:

- `ecfr-current-passage-shapes/inventory.json`: complete original 49-title baseline.
- `annual-retained-passage-shapes/inventory.json`: four annual editions, replay verified.
- Each directory's `samples.json`: independently rehashed NDJSON, aggregate counts, at most three examples per reason
  or span category and ten longest cells, including exact versions, hashes, locators and block ordinals.
- `ecfr-shape-replay-smoke/inventory.json`: bounded current-implementation replay check.

Repair priorities are concrete:

1. The reader failure is version `59403182-5f90-48eb-a1b0-9a9e16af21d2`, 15 CFR Part 774. Its canonical body ends with
   U+200B after the `SOURCE` element; the stored XML preserves that tail. The reader now permits that spacing in a gap
   and emits it unchanged. Substantive unmapped text and unrelated directional controls still fail. No source rewrite
   or embedding contract change is required. A fresh read-only scan of all 2,884 Title 15 members reconstructs
   9,980,341 characters with zero reader failures; its one empty-row table rejection remains explicit. Evidence:
   `ecfr-title15-reader-spacing/inventory.json`.
2. Separate empty HTML header/layout rows from missing data. A concrete sample is 7 CFR 52.38, version
   `22647649-463d-435a-91d4-8e370fbe939e`, block 15: blank `TH` cells in the second header row currently trigger
   `passage_table_empty_row`. Do not indiscriminately accept every empty data row or carry ditto context across it.
3. Resolve only source-supported ditto references. Start with Title 25's appendix, version
   `ccb253a2-5622-4e87-9097-627c9cf7c54a`, block 3, and the distinct annual example. Test chains, blank intervening
   cells, dotted leaders and group boundaries without inventing values.
4. Re-run structural validation after those repairs, then prepare and recount both tokenizer manifests. The inventory
   does not establish final passage eligibility, semantic quality or full search readiness.

The baseline remains immutable evidence for its recorded implementation hash. A later attempt to replay the entire
eCFR scan selected a different implementation fingerprint during shared-workspace changes and began fresh work; that
redundant attempt was stopped. Its partial `progress.json` does not replace the complete baseline `inventory.json`.
Future runs use new generation directories when code or the lockfile changes; no report binding was rewritten to force reuse.

## Blank publisher rows

The retained blocked-table evidence contains 1,538 blank rows. The table parser now recognizes explicit HTML rows with
whitespace-only `TD`/`TH` cells (optional class and valid column-span attributes), and GPO ruling rows with empty or
whitespace-only indented `ENT` cells. These rows contribute no canonical body text. They form context boundaries:
group labels and ditto references are cleared rather than carried across an empty row. Reader text and cell offsets
remain unchanged. Unknown attributes, child markup such as images, unsupported row spans and bare unknown rows still fail.

Blank header rows are allowed only before data, using the same header recognition for row layout and cell continuations.
Direct row segmentation still fails with `passage_table_data_rows_required` when a table contains only publisher
headings or blank form cells. Structural inventory now records that case as an atomic layout instead of a blocked source
shape. Complete-version preparation then proves the intact table against the selected tokenizer's 1,200-token and
16,000-character limits. The absence of textual data is still not evidence that a chart or figure was acquired. Four
retained publisher fixtures cover a multilevel header, a blank form, a GPO ruling cell and that caption-only case.
Fixture passages are recounted with both pinned tokenizers, without embedding calls. Full post-repair qualification
remains separately recorded in the progress ledger.

The September 15 follow-up rechecked all 457 previously blocked source blocks, preserving source hashes and locators.
It cleared 297 blocks (292 eCFR and five annual); all 297 reconstruct exactly and pass independent OpenAI and Voyage
token recounts with the fixed `Federal code` context. These are isolated block canaries with synthetic anchors, not
published canonical passage manifests. No model provider was called and no persisted preparation was replaced.

The historical follow-up left 160 blocks for disposition: 138 eCFR blocks contain at least one table with
headers/captions but no textual data rows after blank layout rows are removed, and 22 retain unresolved ditto references
(21 eCFR, one annual). Other tables and prose in the same appendix block can still contain substantive text. The first
group required separating intact atomic text from graphics completeness; do not treat a caption as recovered visual
data.
Examples include 7 CFR 1755.397 and the visual-field chart in Title 20's disability appendix. The second group requires
source-backed resolution within the correct column and table. Evidence: `blocked-tables-source.json`,
`empty-table-row-shapes.json` and `empty-row-repair-check.json` under backfill artifacts.
The retained text of 7 CFR 1755.397 explicitly identifies information to be supplied by an owner or bidder and blank
equipment fields: it is a concrete candidate for an unfilled-form disposition, not evidence that values were lost.
The Title 20 visual-field caption is a separate chart case. These categories need distinct source-backed handling.

The current implementation resolves the 138 text-layout diagnostics without a source waiver. Their retained review
packet contains 163 individual tables, all no larger than 1,324 characters. Structural inspection preserves those tables
atomically, while complete-version preparation remains the tokenizer-specific admission gate. Replaying all 138 exact
source blocks classified all 163 layouts and produced zero blocked blocks. Visual chart completeness remains a separate
review concern and is not implied by this result.

The pinned full current-eCFR requalification completed September 17 under implementation hash
`2f961df4618361ef08d65c77286e592d0d41a938cc36e236eb9973a72e3df973`. Its terminal manifest covers all 49
nonreserved current editions and 275,149 records. An independent audit rehashed every per-edition report and NDJSON
stream. OpenAI Small prepared all records into 501,407 passages / 171,162,558 tokens; Voyage 4 prepared all records into
522,063 passages / 187,689,692 tokens. Neither model has a blocked, invalid, oversized or empty record. Both observed
maximums are 1,200 tokens and 6,422 input characters; continuation counts are 62 and 91 respectively.

Structural review remains distinct. The same complete run retains 148 table diagnostics across 101 versions: 138
`passage_table_data_rows_required` cases and ten `passage_table_unresolved_ditto` cases across nine versions. All still
produce bounded fallback passages, which proves tokenizer transport eligibility but not table-layout fidelity. The ten
ditto diagnostics occur in 40 CFR 52.730, 52.876 and 81.331; Appendix A to 49 CFR Part 210; 21 CFR 73.1, 155.200 and
177.2800; 47 CFR 73.182; and 33 CFR 110.214. Exact edition/version/content hashes, locators and table indexes are in
`canonical-preparation-all-current/table-diagnostics-current.json`; the terminal integrity/count report is
`canonical-preparation-all-current/audit-2026-09-17.json`. These identities remain a source-review queue and cannot be
treated as resolved by the zero tokenizer-blocker count.

The hash-bound review packet
`canonical-preparation-all-current/unresolved-ditto-source-reviews.json` joins those ten diagnostics back to their
published canonical edition memberships, active rights policies and official eCFR artifacts. It retains the exact table
XML and a row/cell rendering with span and publisher-style attributes. Its report hash is
`566001f48ba0391db84fd7020f01080e3a5c4d8391f9b67ada9de12ba0b8ad1b`. This packet makes source review reproducible;
it is not a disposition and does not authorize carrying a value across a blank or group boundary.

Source review resolved nine of the ten ditto diagnostics without changing canonical text. Complete canonical scans of
Titles 21, 40, 47 and 49 report no remaining unresolved-ditto tables under implementation hash
`64d511222780d9e595722579cdb9bdf0d344c634e6801e52e1fff5e0c619f696`. The retained fixtures require each exact header,
row identity and sparse/group sequence, and mutation tests continue to reject a changed source shape.

The remaining 33 CFR 110.214 diagnostic is an upstream rendition gap. The current eCFR block begins with Anchorage B,
whose purpose and regulation are ditto markers, while the
[official 2025 CFR table](https://www.govinfo.gov/content/pkg/CFR-2025-title33-vol1/pdf/CFR-2025-title33-vol1-part110.pdf)
prints Anchorage A immediately before B with the referenced values. The reviewed PDF is 517,451 bytes, SHA-256
`59993d7377fbbecd6a50acec9e524ac3229b514c6e51168dfbdf85a9a7a5ab88`. The parser must not synthesize that missing row
inside the current eCFR version. It is now explicitly quarantined in the terminal qualification and final passage
manifests; derived preparation keeps the version accounted for without synthesizing the missing row.

The targeted whole-version recheck bound all ten original diagnostics back to the same source-review hashes and ran
both pinned tokenizers over all nine affected versions. All 18 preparations succeeded; the maximum passage size was
894 OpenAI tokens and 899 Voyage tokens. Report hash:
`4f617bb5e367a2a2a5e72f5ef6083e20834ccc51392df3d77211bcb2bb0f8951`. The single Title 33 table remains a structural
source gap even though its intact fallback fits the transport budget.

The final current-eCFR manifest is frozen per edition and per candidate model under
`artifacts/regulatory-backfills/final-passage-manifests-v2`. Both 49-edition catalogs bind all 275,138 version memberships,
their source/rights/reader contracts, tokenizer identities, context hashes, eligibility and complete passage-input
manifest hashes. OpenAI Small's catalog hash is
`182877d0af5398031ae430ae496a4a258245a759d01545cc65c19d8b0ca0b6d8`; Voyage 4's is
`bb6999acc86604f8dff42237b8c9026f77d270fb9fbcc2a6661f58cc4ffe68d5`.

## Ditto scope and preparation gates

A fully spanning group heading inside one table can qualify later rows without replacing earlier column values.
The reader retains a ditto reference across that heading only when its explicit column span equals the preceding
data-row width. Both the new heading and the exact earlier column value are included as source context. The retained
21 CFR 107.100 fixture supplies the concrete case: a four-column `Minerals` heading followed by calcium's `Do.` in
the units column references the earlier `Milligrams` value. Partial-width groups, blank rows, missing/blank data cells
and different tables still cannot supply inferred references. The original cell text is never rewritten.

Structural diagnostics and actual model-input eligibility are separate checks. A short table can fit intact without
row splitting or ditto expansion. An appendix can contain a small header-only form table alongside substantive prose;
the form's lack of filled values must not be confused with loss of that prose. The source-block preparation canary now
evaluates every selected block with both tokenizers, even when row-layout diagnostics report a failure, and retains
both results. Chart/graphic completeness and final canonical preparation remain separate acceptance gates.

The completed follow-up reports 298 row-layout passes, 138 header/caption-only diagnostics and 21 unresolved-ditto
diagnostics across the original 457 blocks. Actual input preparation succeeds for 445 blocks with each pinned tokenizer;
12 blocks still fail with `passage_table_unresolved_ditto`. All 138 header/caption-only cases prepare their retained text.
This does not establish that a figure's nontext content was captured. The full-width-heading repair improves one row
layout; that short table already fit intact at the default budget, so it does not reduce the 12 preparation failures.

Evidence: `table-preparation-dispositions.json`, source hash
`066490e45eace11d4ee35532f875a29257ccfde07a3d319823eecd3ab27bcef5`, implementation hash
`3f4fa5b147c3c0856471a038abe786b8802975f12d73c4a1b4180c413a36a58a`. The canary verifies the implementation
fingerprint before and after execution, exact source reconstruction, independent counts, the 1,200-token ceiling and
the 16,000-character input limit. Its fixed context and synthetic block anchors are unchanged; complete canonical
versions require separate preparation. Remaining source work includes dotted-leader ditto markers, currently treated
as literal cell text, and requalification of affected accepted tables. Do not skip blank cells or guess missing values
to resolve a reference.

A separate read-only full-provision smoke uses the production context expression and real canonical version anchors.
It verifies content hashes, full-body reconstruction, token recounts and identical in-memory manifest replay for
21 CFR 107.100 (three passages per tokenizer) and 7 CFR 1755.397 (47 OpenAI / 49 Voyage passages). The latter includes
the intentional blank-form appendices and 65,538 bytes of canonical text. Evidence: `canonical-table-context-smoke.json`.
No preparation rows were persisted; storage replay, full partition coverage and index publication remain open.

## Dotted ditto markers

The retained source evidence includes 561 `......do` cells and one `............do` cell across the original 457
blocked blocks. These are column references, not literal replacement values. The shared table predicate now recognizes
a contiguous leader of two or more periods before `do` (case-insensitive, optional final period), alongside the existing
plain markers. Ordinary cell text, a lone leading period and punctuation without `do` remain literal.

The regression excerpt preserves the first header and four data rows from Title 25's chapter appendix, block 3,
version `ccb253a2-5622-4e87-9097-627c9cf7c54a`. The dotted reservation cell points to the exact earlier `*Papago`
span. Canonical cell text remains unchanged, including its dots. Chained references retain that original span;
missing or blank predecessors still fail. The same predicate prevents the oversized-cell continuation path from
treating a dotted reference as a standalone value. This repair does not authorize skipping blank cells or guessing
values across headings. Already accepted split-table inputs containing dotted markers require requalification;
no existing embedding freshness contract was changed and no stored vectors were regenerated.

The post-repair 457-block canary still prepares 445 blocks with each tokenizer and retains the same 12 explicit
preparation failures. The changed aggregate output is 14 CFR 171.311 block 65: 32 passages with each tokenizer, gaining
38 context tokens per model (3,299 OpenAI / 3,567 Voyage total). This is added source-backed context, not a source-text
rewrite. Evidence: `dotted-ditto-preparation-dispositions.json`, implementation hash
`6dcaafde20841056820d99447c9e73e3348cb9c3f8a29038ddb2947b5b6a8a51`; the earlier report remains retained separately.
Unchanged aggregate counts do not prove identical passage bytes, and this original blocked-block set does not cover
every previously accepted table in the corpus. Full manifest requalification remains open.

The affected complete 14 CFR 171.311 provision was separately read and hash-checked: 44,648 bytes produce 82 OpenAI
passages (maximum 759 tokens) or 84 Voyage passages (maximum 792). Production context, exact reconstruction, independent
counts and in-memory replay pass. `canonical-dotted-ditto-smoke.json` records the real version and manifest hashes;
it does not claim persisted storage replay or an embedding evaluation.

## Resolved references in oversized rows

An oversized row can now continue across passages when its ditto references resolve to exact earlier cells in the
same table. Cell extraction independently checks those references through the table validator before permitting a
continuation. The existing passage writer repeats the verified values and group context on every fragment, including
fragments that do not contain the original marker. Canonical reader text and source-span mappings remain lossless.

Both pinned tokenizers cover plain/dotted chains, an explicit full-width group change, deterministic replay and token
recounts. Missing or blank predecessors still fail; references whose complete context exceeds the target budget are
not truncated. This closes the previous unconditional rejection of even resolved ditto cells during continuation.
It does not resolve the separate twelve missing-reference cases. Their retained source includes unmarked headings,
blank data cells, and a label split across physical rows (the `Titanium dioxide-magnesium` / `silicate` entry in
21 CFR 176.170). Those shapes require source review rather than a general rule to skip empty cells.
