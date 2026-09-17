# Remaining ditto-reference source review

## Terminal current-title review

The terminal 49-title qualification found ten structural ditto diagnostics across nine versions. Hash-bound canonical
review resolved nine with narrow retained layouts. Published CFR evidence corroborates the affected group and sparse-row
boundaries in [40 CFR 52.730](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol3/pdf/CFR-2025-title40-vol3-sec52-730.pdf),
[40 CFR 52.876](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol3/pdf/CFR-2025-title40-vol3-sec52-876.pdf),
[40 CFR 81.331](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol20/pdf/CFR-2025-title40-vol20-sec81-331.pdf),
[Appendix A to 49 CFR Part 210](https://www.govinfo.gov/link/cfr/49/210?link-type=pdf&sectionnum=31&year=mostrecent),
[21 CFR 73.1](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol1/pdf/CFR-2025-title21-vol1-sec73-1.pdf),
[21 CFR 155.200](https://www.govinfo.gov/link/cfr/21/155?link-type=pdf&sectionnum=200&year=mostrecent),
[21 CFR 177.2800](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-chapI.pdf) and
[47 CFR 73.182](https://www.govinfo.gov/content/pkg/CFR-2025-title47-vol4/pdf/CFR-2025-title47-vol4-sec73-182.pdf).
The rules preserve reference state only through those exact reviewed rows. They neither fill blank cells nor replace
ditto text.

One source defect remains. The current eCFR block for 33 CFR 110.214 starts with Anchorage B and therefore lacks the
Anchorage A values referenced by its first two ditto cells. The
[official 2025 annual CFR table](https://www.govinfo.gov/content/pkg/CFR-2025-title33-vol1/pdf/CFR-2025-title33-vol1-part110.pdf)
contains the A row directly before B. The reviewed 517,451-byte PDF has SHA-256
`59993d7377fbbecd6a50acec9e524ac3229b514c6e51168dfbdf85a9a7a5ab88`. Keep the current eCFR table structurally blocked
until rendition reconciliation or an explicit quarantine disposition is recorded; external values are not injected
into its canonical body or embedding inputs.

## Latest scoped requalification

40 CFR 152.175 now qualifies with 52 passages per model, maximum 173 OpenAI / 185 Voyage tokens. The cited
[1981 final rule, printed page 5699](https://archives.federalregister.gov/issue_slice/1981/1/19/5667-5721.pdf)
was downloaded and visually reviewed: it unambiguously places the zinc 60%-formulation values in use pattern,
classification and restriction criteria. PDF SHA256:
`d8d86fe2a5a0ec921f1a33b11dc735642cdefe1edd07a515260ca3e7eec002af`.
This resolves the earlier evidence gap from the incomplete current CFR PDF.

An in-memory layout repair requires the exact five headers and complete six-row zinc sequence, including the
formulation-only row, empty separator, shifted values and following two formulations. It joins those fragments into
one logical row and checks that the entire source text is identical before/after. Stored XML is untouched. Both
normal row segmentation and oversized-row cell lookup see the same repaired columns. No values are imported from
the old rule; it establishes alignment of values already present in the retained XML. Altered identities, quantities
or following formulations remain rejected. All 88 table tests pass. Canonical report:
`artifacts/regulatory-backfills/pesticides-alignment-recheck.json`; parser hash
`fb3051e81e6b0cd20d4a1ce66f8d4ff6421a9b6fa01aff06c14233aeb78775c3`.
All original known blocked versions have now qualified individually. Full-corpus qualification remains outstanding.

21 CFR 177.1520 now qualifies with 36 OpenAI / 37 Voyage passages, maximum 765 / 795 tokens. Exact polymer-table
headers, item 3.1c's source identity, density `Not less than 0.92` and empty unspanned final cells bound retention of
the prior solubility reference. Item 3.1c itself gains no solubility value; item 3.2a's explicit ditto references the
earlier printed value. The
[current CFR PDF](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-sec177-1520.pdf)
was rendered and checked at printed pages 301–302; SHA256
`93403df1e15dcffdada0bb36c7a6cd05752fd696ad962b0e3a5a2734fdd4f525`.
All 87 table tests passed, including full reconstruction, both tokenizers and rejection of changed headers, density
or item identity. Report: `artifacts/regulatory-backfills/polymers-version-recheck.json`; parser hash
`b936bee309d065119090ab1708fb8967e297089b7427653f077a0060084a0933`.
Only 40 CFR 152.175 remains among the known blocked versions; a fresh full-corpus qualification is required.

9 CFR 424.21 now qualifies with 160 passages per model, maximum 720 OpenAI / 790 Voyage tokens. Exact ingredient
headers and unspanned five-cell rows recognize two reviewed sparse entries: Disodium guanylate's amount and Potassium
hydroxide's purpose/products. These blanks receive no references; later explicit dittos retain the earlier printed
values. The [current published CFR](https://www.govinfo.gov/content/pkg/CFR-2025-title9-vol2/pdf/CFR-2025-title9-vol2-sec424-21.pdf)
was downloaded and rendered; printed pages 577–578 visually confirm both patterns. PDF SHA256:
`add72c2142003bb52319cfc2eddcbb435558598ee98e7afa6a1960591cbc4f50`.
All 86 table tests pass, including full reconstruction, independent token recounts and rejection of changed row labels
or headers. Canonical report: `artifacts/regulatory-backfills/food-ingredients-version-recheck.json`, parser hash
`86b8cf646ee57ef312e17d99314073fbf91a2dcf17b6bd41d9d1406e99cc650a`.
Two known versions remain: 40 CFR 152.175 and 21 CFR 177.1520; full-corpus qualification remains open.

The [2025 pesticide PDF](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol26/pdf/CFR-2025-title40-vol26-sec152-175.pdf)
was also downloaded and rendered after browser retrieval failed. Printed page 45 itself omits the use/classification/
criteria values for the zinc dry-formulation entry; it does not corroborate the shifted XML values. SHA256:
`2547443dc3fa6f29ebbee93a88f171f34bf99c581d4430cb0762545dbea6819d`.
Keep this section blocked. A prior promulgating source or authoritative correction must establish the row alignment;
do not derive the classification from the neighboring unclassified entry or silently move XML cells.

40 CFR 152.175 has two independent defects. The sparse restriction-criteria reference is repaired only for
unclassified entries with the exact five pesticide headers and populated formulation/use/classification cells.
Explicit classification dittos must resolve to `Unclassified`; blank criteria receive no inferred restriction.
The [2017 published table](https://www.govinfo.gov/content/pkg/CFR-2017-title40-vol26/pdf/CFR-2017-title40-vol26.pdf)
corroborates the same retained sequence across the Methomyl and Methyl bromide rows. This historical corroboration
does not substitute for the retained current version or establish current legal status.

The complete current section still fails: the Zinc Phosphide dry-formulation record is split across a formulation-only
row, a blank row and a shifted row containing `All uses`, `Restricted`, `Acute inhalation toxicity.` in columns 1–3
instead of 3–5. The following bait row's classification ditto has no valid column-4 source. Do not fill this from a
different column without a separately reviewed alignment rule. The full canonical fixture is
`fixtures/restricted-pesticides-table.json`; all 85 table tests pass, including exact prefix reconstruction with both
tokenizers and continued rejection of the complete malformed table. Whole-version report:
`artifacts/regulatory-backfills/pesticides-version-recheck.json`, parser hash
`d274adda54dce34525153aaf36d8459f5cf5db5b0ca94cb58db09a6097b90e8a`.
Three known versions remain blocked; this change does not close the pesticide section.

38 CFR 3.261 now qualifies with 61 passages per model, maximum 482 OpenAI / 669 Voyage tokens. The two reviewed
child-only income entries preserve earlier parent-benefit references for later explicit dittos. Recognition requires
all six income headers, exact row labels, empty parent/citation cells and populated pension cells, without spans.
Blank parent cells gain no reference. The
[published CFR, printed pages 233–234](https://www.govinfo.gov/content/pkg/CFR-2025-title38-vol1/pdf/CFR-2025-title38-vol1-sec3-261.pdf)
corroborates this layout. All 84 tests pass, including blank-parent context, source-backed gift-property references,
changed-label/header rejection and complete reconstruction with both tokenizers. Report:
`artifacts/regulatory-backfills/income-version-recheck.json`; parser hash
`e5aa67792abe9f1d301543e61dcba04da1a5f8ca26f7e28476da75b310a4c0ef`.
Three known versions remain: 40 CFR 152.175, 9 CFR 424.21 and 21 CFR 177.1520. A fresh full-corpus run is still required.

47 CFR 90.35 now qualifies with 341 OpenAI / 354 Voyage passages, maximum 766 / 793 tokens. Exact frequency,
station-class, limitations and coordinator headers plus a numeric frequency and populated sibling cells are required
to preserve the last printed station class across an empty class cell. Only a later explicit ditto receives that
reference; the blank row receives none. The
[published CFR, printed page 287](https://www.govinfo.gov/content/pkg/CFR-2025-title47-vol5/pdf/CFR-2025-title47-vol5-sec90-35.pdf)
shows the blank class at 153.560 followed by a ditto at 153.5675. All 83 table tests passed, including complete
reconstruction with both tokenizers and rejection of changed headers or a nonnumeric intervening frequency.
Report: `artifacts/regulatory-backfills/frequency-version-recheck.json`; parser hash
`f6363c1f529032b0b104666b8fb4d869395a7cbfdb57e18ac0ca5176998bf95e`.
Four known versions remain: 40 CFR 152.175, 9 CFR 424.21, 38 CFR 3.261 and 21 CFR 177.1520.
Full-corpus requalification remains required; this is a single-version canonical check.

21 CFR 172.510 now qualifies with 62 passages per model, maximum 356 OpenAI / 384 Voyage tokens. The sparse
limitation column preserves the last printed limitation for a later explicit ditto, while leaving intervening blank
rows without a limitation reference. Exact flavoring-table headers and populated name columns are required.
The [published CFR](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-sec172-510.pdf)
corroborates this convention. All 82 table tests passed, including exact reconstruction, changed limitation sources
and the absence of fabricated blank-row context. Report: `artifacts/regulatory-backfills/flavoring-version-recheck.json`;
parser hash `602be5ffcf55f23d8c9efdbd371d14fc9b95bef7d9c90211cc388d0ae5d8b308`.
Five known versions remain blocked; a new full-corpus qualification is still required.

The canonical 40 CFR 52.2723 version now qualifies with both models: 30 passages each, maximum 407 / 484 tokens.
The explicit reserved-rule row preserves only the prior EPA approval-date reference, with no date assigned to the
reserved rule itself. Exact table headers, reserved syntax and empty unspanned cells are required. The
[published CFR table](https://www.govinfo.gov/content/pkg/CFR-2025-title40-vol5/pdf/CFR-2025-title40-vol5-part52-subpartBBB.pdf)
corroborates this reference boundary. All 81 table tests pass. Report:
`artifacts/regulatory-backfills/reserved-rule-version-recheck.json`, parser hash
`e4025abf5ecc47b6740270d1f29b6291352e95c5a93229618fd9e46a6286db79`.
Six of the original known blockers remain; they were not rerun during this one-version check.

The restored canonical database confirms the complete 21 CFR 176.170 version is eligible with both models:
79 OpenAI / 81 Voyage passages, maximum 798 / 832 tokens. This closes one of the prior eight known blockers;
the other seven have not been rerun during this check. Evidence:
`artifacts/regulatory-backfills/food-contact-version-recheck.json`, parser hash
`454f6a65578bfa902a37a655dca2b7481e9a00e10f43044447def9842744eda5`.
The pending-database status in the older entry below is superseded; full-title qualification remains open.

The 21 CFR 176.170 food-contact table now preserves the reviewed split substance name and earlier limitation
reference. [The official 2025 CFR PDF, printed page 231](https://www.govinfo.gov/content/pkg/CFR-2025-title21-vol3/pdf/CFR-2025-title21-vol3-sec176-170.pdf)
wraps `Titanium dioxide-magnesium silicate` in the substance column with a single ditto in the limitation column.
The retained eCFR XML instead has a second `silicate` row with an empty limitation. Recognition requires these
exact fragments and publisher layout; there is no generic lowercase-name or blank-cell inference. All 80 table
tests pass, including complete source reconstruction and both tokenizers. Whole-version qualification is pending
database availability, so the verified remaining count remains eight.

The latest canonical recheck leaves eight blocked versions after resolving 49 CFR 1152.32. The expense table's
exact headers, empty-account headings and contiguous populated child rows sharing an account-code family establish
bounded subgroup context despite varying heading indentation. At least two children are required; broken family
codes and incompatible headers remain unsupported. The full retained source is `fixtures/railroad-expense-table.json`.
All 77 table tests passed. The full version prepares 377 OpenAI / 380 Voyage passages. Parser hash:
`705e5a8607847a27a41f5bc18efdc5dd69e7da04da87e056042513d66e724c37`.

The latest canonical recheck leaves nine blocked versions after resolving 40 CFR 799.5025. Chemical group
recognition requires the exact mixture/test/citation headers, Arabic-numbered chemical headings with empty
sibling cells, and consecutive populated Roman-numbered members at equal indentation. Both outer and inner
heading context survive; ordinary blank cells and broken sequences still fail. The full source fixture is
`fixtures/chemical-substance-group-table.json`. All 73 table tests passed, including both pinned tokenizers;
the complete canonical version prepares 25 passages per model. Parser hash:
`486f26cc399ddec86bfdc338611333fcfa3252ef8f8f803ea158086556306bd4`.

The latest 17-version canonical recheck leaves 10 blocked versions after resolving the Title 25 trust-period
appendix. Its explicit `Mission Bands:` heading and `All of above Mission Bands` closing row bound the reservation
group. Same-width populated members and State/Reservation headers are required. State and period ditto references
retain their exact earlier source spans; the heading supplies context only through the closing row. Ordinary
blanks, missing/mismatched closing labels and incomplete members remain unsupported. The full retained fixture is
`fixtures/tribal-trust-period-table.json`; all 69 table tests passed, including both tokenizers. The complete canonical
version prepares 156 passages under each model. Full-title requalification and model comparison remain open.
Evidence: `artifacts/regulatory-backfills/ditto-version-recheck.json`, parser hash
`04bcde3f68c472b56a1b6d075d6e6ffe1433006f9978d254b63416666f9b030c`.

The entries below are earlier dated evidence, superseded by the latest counts above.

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
