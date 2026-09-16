# Remaining ditto-reference source review

## Latest scoped requalification

Centered category support now also requires explicit publisher styling: a colon-ended centered first cell, empty
remaining cells with no hidden elements, followed by a same-width left-aligned data row containing data in another
column. A centered label without the data-row styling does not qualify. Category context survives unindented children;
the existing indentation-based rule remains separate. `fixtures/centered-category-table.json` retains the full current
Title 5 hazard-pay appendix table and its verified source-block hash.

The exact table prefix through fuel-storage work passes reconstruction, recount and deterministic replay with both
tokenizers, including the physiological-hazard heading and its preceding date reference. The complete table deliberately
still fails: subsequent diving-description rows have blank rate/date cells, and the Sea Duty category's following
ditto has no supported reference after those rows. The next blocker is row 61 in the retained diagnostic, not the
earlier category heading. Evidence: `artifacts/regulatory-backfills/centered-category-diagnostic.json` and
`%TEMP%/rostra-centered-category-tests.log`. All 51 table tests pass; this is not whole-version qualification.

The full baseline completed 49 editions and 275,149 records with 17 blocked versions (16 OpenAI, 17 Voyage).
Its fingerprint remains historical after the following parser change. Rechecking all 17 complete canonical versions
now prepares Schedule III to Subpart A of 33 CFR Part 401 and 49 CFR 1220.6 with both pinned tokenizers. Fifteen versions remain blocked
(14 OpenAI, 15 Voyage); no full-corpus requalification or embedding model-quality selection is implied.

`fixtures/ditto-final-tables.json` retains the complete Seaway schedule and 47 CFR 90.35 table with source hashes,
artifact hashes, exact canonical version/edition identities and publisher URLs. Extraction compared the canonical
content hashes before retaining the bytes. In the Seaway schedule, the Montreal Harbor category ends in a colon,
has blank remaining cells, and is followed by a publisher-styled child at a greater `primary-indent-hanging` level.
The parser recognizes this narrow structure as a category, retains parent category spans and the earlier channel
reference, and leaves the original ditto marker untouched. Ordinary blank cells, equal/lower indentation, absent
child indentation, partial-width groups and ruling dividers retain their existing rejection boundaries.

The retained 49 CFR 1220.6 rows also show the supported pattern: `4. Vouchers:` has a blank second cell and publisher-indented children; its later ditto retains the preceding `3 years.` reference without substitution.

The complete retained table passed exact reconstruction, independent token recount and deterministic replay with both
tokenizers. All 48 table tests passed. The radio frequency table remains blocked: its ordinary 153.560 row has a blank
station-class cell before the next ditto, without the supported category structure. No value is guessed.
Evidence: `artifacts/regulatory-backfills/final-ditto-source-blocks.json`, `ditto-version-recheck.json`, and
`%TEMP%/rostra-indented-table-tests.log`. The scoped recheck uses production context and all source blocks for each
version, with no canonical writes or provider calls. A fresh full manifest is required after parser repairs settle.

## Earlier review evidence

At `2026-09-16T04:09:41Z`, 36 of 49 current editions accounted for 202,108 canonical members: 14 versions failed
OpenAI preparation and 15 failed Voyage preparation. All preparation failures were `passage_table_unresolved_ditto`.
Every completed `records.ndjson` was SHA-256 checked against its edition report before counting. This is an incomplete
run, not a final corpus count or model-quality result. Evidence: `artifacts/regulatory-backfills/preparation-blocker-review.json`,
produced by `review-preparation-blockers.ts`. The live scanner's fingerprinted implementation was not changed.

## Retained source excerpts

`src/ingestion/regulations/fixtures/unresolved-ditto-source-rows.json` retains 12 unresolved table excerpts from the
earlier 457-block sample. Each has exact edition/version IDs, content hash, publisher URL, artifact hash, source
locator, full table XML hash, failing column and neighboring rows. `retain-ditto-review-fixture.ts` compares the entire
retained block XML and content hash against canonical databases 55438/55440 before writing it. No cell values are
inferred or substituted. These excerpts are review evidence, not independently preparable full-table fixtures.

| Shape before the failing marker | Examples | Required review |
| --- | --- | --- |
| Label with blank/missing other cells | Title 25 appendix; 40 CFR 799.5025; 49 CFR 1152.32 and 1220.6; Title 5 pay appendix in both formats | Establish source-backed group context, then verify every later reference. |
| Descriptive continuation in one column | 40 CFR 81.305 boundary; 21 CFR 176.170 split material name | Prove continuation from source layout before carrying other columns' context. |
| Ordinary data row with a blank referenced column | 40 CFR 152.175; 9 CFR 424.21; 21 CFR 172.510 and 177.1520 | Inspect preceding populated values and intervening rows. Blank does not automatically mean repeat. |

The Title 5 label `Exposure to Physiological Hazards:` appears as a three-cell HTML row with two empty cells in
current eCFR and a single GPO `ENT I="21"` row in annual CFR. This supports investigating a label classification;
it does not authorize all following references or a blanket blank-cell rule.

## Whole-version qualification gaps

The run additionally reports 40 CFR 52.2723, 40 CFR 81.324, 49 CFR 1039.11 and 38 CFR 3.261, outside those 12 excerpts.
Their exact version IDs, locators, tokenizer IDs and context hashes are in the checkpoint audit. Extract and inspect
their full source blocks before choosing a repair. 40 CFR 81.324 currently fails only Voyage preparation: a table
that fits one tokenizer's passage may require splitting with the other. One model's success does not qualify both.

At `2026-09-16T04:52:37Z`, the refreshed hash-verified audit covered 40 editions and 223,136 members; the blocked
version count remained 15 (14 OpenAI, 15 Voyage). This is still an incomplete baseline. The four additional full
tables have now been extracted from canonical 55438 and retained in
`src/ingestion/regulations/fixtures/ditto-continuation-tables.json`, including edition/version membership, content hash,
artifact hash, publisher URL and exact source block text/XML. Extraction evidence:
`artifacts/regulatory-backfills/additional-ditto-source-blocks.json`, checked at `2026-09-16T04:53:34Z`.
Only a diagnostic copy of the table parser was instrumented; the running qualification implementation was unchanged.

| Provision | First unresolved reference | Intervening source structure |
| --- | --- | --- |
| 40 CFR 52.2723 | Rule 301, column 3 | Reserved Rule 210 has blank cells, followed by a full-width Part III heading. |
| 40 CFR 81.324 | Carver municipalities, column 2 | Anoka has a date, then a Carver County (part) label has blank date/type cells. |
| 49 CFR 1039.11 | Textile mill products, column 2 | Several commodity exception rows populate only column 3. |
| 38 CFR 3.261 | Gifts of property, column 2 | Child income leaves the column blank, then a gifts category label has blank data cells. |

Each full table reproduces the current unresolved-marker condition independently of the smaller excerpt fixture.
This establishes the structural gap but does not establish a correct replacement value. In particular, ordinary
blank data cells and category transitions must remain distinct from recognized layout-only separators. Future
repairs must preserve the marker, source spans and relevant intervening labels, and prove source-backed context
with both tokenizers. The four tables total 85,116 bytes of original XML; no publisher text was rewritten.

Next: finish the baseline; review additional blocks and publisher layouts; implement narrow classification with
source-span assertions; rerun affected full versions with both tokenizers, exact reconstruction, independent recount
and deterministic replay. Requalify the full manifest after code changes. Keep uncertain references blocked, preserve
canonical source text and do not regenerate existing vectors to make the counts pass.

September 16 continuation: the retained full Title 5 hazard table now prepares losslessly for both tokenizers.
Its diving-duty `when:` row is followed by a complete alphabetic condition sequence with blank sibling cells.
The parser preserves that parent and the earlier date source only for this explicit sequence; blank standalone
data rows still invalidate references. Regression coverage includes incomplete sequences, skipped letters and
missing parent anchors. The later sea-duty `Do.` resolves through the retained source date span.
The 54-test table suite passed. This is fixture evidence: the full canonical-version recheck failed to connect
to retained PostgreSQL port 55438 while Docker's engine was unavailable. No canonical blocker count was reduced.

Subsequent canonical verification: Docker and the retained container were restored without resetting data. The
17-version recheck completed under parser hash `82b55583252fb323665d23c1accfcecfd27ec73eaea8393f91168e8f242f2049`.
Title 5 now qualifies under both tokenizers, with 57 passages each and unchanged canonical source content. Fourteen
versions remain blocked (previously 15). The complete report is `artifacts/regulatory-backfills/ditto-version-recheck.json`;
the prior result is retained as `ditto-version-recheck-before-conditions.json`. No DB, index or vector writes occurred.

The subsequent partial-county repair qualifies 40 CFR 81.324 for both tokenizers. Its `Designated area` table
explicitly places `Carver County (part)` before the municipality list. The parser carries that source scope for one
row and retains the earlier date span for the dotted ditto marker, without applying the scope to the next county.
Complete canonical rechecking now leaves 13 blocked versions under parser hash
`970a60df601e479e8197f300cccdf88aad09b6ad3ca9460c4332e48ace0ae3a1`. The earlier result is retained in
`ditto-version-recheck-before-county.json`. Both tokenizers qualify, but produce 35 versus 71 passages; common
comparison boundaries remain required. Full-table reconstruction, recount and ordinary-blank negative tests pass.

The STCC commodity exception rows in 49 CFR 1039.11 now retain their explicit parent commodity and tariff source.
This applies only to the three-column STCC table, an `except` parent and matching child commodity codes; arbitrary
blank tariff rows remain boundaries. Both tokenizers pass the complete retained table and canonical version.
The final 17-version recheck leaves 12 blocked versions under parser hash
`1d1b28a587c817648b8fc1bed9adc53aef72fb09203920bd0a4adc51ae40d68d`. No canonical source or vectors changed.

40 CFR 81.305 now qualifies after source-backed county-boundary and classification-continuation handling.
Its indented `That portion` rows retain the populated partial-county parent. Its explicit classification continuation
retains both the preceding wording and continued citation in subsequent ditto context; it does not treat the trailing
`104(b)(2).` as the whole classification. The 60,023-byte source XML block is retained with its canonical hash in
`fixtures/partial-county-boundary-table.json`. All 64 table tests pass; the complete canonical version qualifies with
both tokenizers. The final recheck leaves 11 blocked versions under parser hash
`41febc55d32866ac42fcf0532d381bd74d76ac57f5bc8bb71fef5a5699cf160b`. Full 49-title requalification remains required.
