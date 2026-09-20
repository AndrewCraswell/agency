# Federal XML parser and local pilot validation

September 14, 2026 parser evidence, with later regression notes. Local normalization and canonical pilot import now
exist; current storage scope is in [storage validation](storage-validation.md), and production delivery remains gated.
Parent: [implementation contract](implementation.md).

## Implemented contract

Historical FRDOC normalization now accepts publisher casing, an omitted opening bracket and no space between
`Filed` and the filing date. It still requires one direct FRDOC element, an anchored document-number assertion and
unique identities. January 18, 2000 demonstrates why the latter gate remains necessary: the official XML assigns
`00-113` to both a Hobbs airspace rule and a Minnesota land notice. After the formatting fix the complete issue fails
`duplicate_identity`; no normalized generation is published and no document identity is guessed from its title.
The retained raw SHA-256 is `5c8fa553adc3c2c5b041ac8b1b1cc6cac1edd4945111037bd4f4fbf574566201`.

The parser code hash after this change is `b2a3a6d639ac307a82e8e6b12fc8a84a12d9b9faef9efb66ffec919541b11d9d`.
New generations live in `artifacts/regulatory-backfills/historical-parser-regression/`; the earlier pilot generations
and canonical database evidence remain retained under their original parser hash. These new generations have not been
republished to the database. All five pilot source units reparse successfully (40,872 records); annual source-date
warnings remain unchanged. Historical formatting and rejection cases are covered by actual parser subprocess tests.

`python/regulations/parse_xml.py` streams source XML using Python's Expat parser. It writes provision/hierarchy records
for eCFR and annual CFR, and separate Federal Register publications for RULE, PRORULE and NOTICE. Native document
numbers preserve correction prefixes such as `C1-2023-27742`. The source classification does not assert that a rule is
legally effective: every record keeps `legalStatus: unknown`.

Records retain the source XML location, parent record, order, heading, owned text, its SHA-256, structured XML blocks,
source attributes and acquisition provenance. Tables, inline formatting, footnotes, page markers and amendatory text
remain in the blocks. Child provisions have their own records instead of repeating their bodies in parent titles.
Raw XML is evidence, not trusted renderable HTML. These are source/staging identities, not public canonical IDs.
Unnumbered annual structural nodes and explicitly empty eCFR subject groups use source-locator identities until canonical
alias resolution. Known section citations and FR document numbers remain distinct identity types.

The bridge validates the input hash, script hash, every shard's hash/size/count, strict record schemas, provenance,
native-ID uniqueness, ordered blocks, ordinal bounds and the parent graph. It atomically renames a staged generation
only after all checks pass. Generation identity includes the source unit, artifact hash, parser code hash and limits.
Reuse rechecks both input bytes and normalized outputs. A failed process, missing shard or corrupt checkpoint cannot
publish a partial generation. This is local generation publication, not canonical or searchable product publication.

Python gets only a small environment allowlist for locating the interpreter and temporary files; provider and DB
credentials are not inherited. The process has a five-minute default deadline, a bounded diagnostic channel and
sanitized error codes. Scripts cannot fetch source data or write to the database. Only the parser script is added to the
existing Trigger Python packaging; no task or source schedule is activated.

| Bound | Implemented value |
| --- | ---: |
| Source XML file | 512 MiB |
| XML nesting | 64 levels |
| Retained logical XML node | 32 MiB / 250,000 elements |
| Normalized record | 64 MiB |
| Normalized unit output | 2 GiB / 1,000,000 records |
| Normal shard target | 16 MiB or 5,000 records |

An oversized record receives a dedicated shard only within the record ceiling. Exceeding a limit fails explicitly.
DTD and entity declarations are rejected, and external entity handling is disabled. Expat >=2.6 is required; the local
run used `expat_2.7.1`. This follows the documented parser/security interfaces, not a new XML dependency.
[Python Expat documentation](https://docs.python.org/3/library/pyexpat.html),
[Python XML security guidance](https://docs.python.org/3/library/xml.html#xml-vulnerabilities).

The federal source patterns from the audited Vaquill project informed acquisition. This parser is original Rostra code
against retained official XML, rather than a copied upstream parser; no upstream code/license header was removed.

## Full pilot results

Source manifest: `be0024b71aedb90b20e34ec70358d2225d4d8f9d2b7236b4b4a93f1ee6ff9c8a`.
Parser SHA-256: `4412502e23cf7fcc3c793fba707e1e6fa1e4f0478d016df8d3cb7b6ea95bd7e9`.
Results: `artifacts/regulatory-backfills/normalized/parse-report-1789422974289.json`.
Source-text audit: `artifacts/regulatory-backfills/federal-pilot-normalized-text-audit-2026-09-14.json`.
All artifact paths are local ignored outputs; Azure retention is still pending.

| Source | Records | Shards | Parser time | Source review |
| --- | ---: | ---: | ---: | --- |
| eCFR title 1 | 368 | 1 | 0.079 s | 288 sections plus hierarchy |
| eCFR title 21 | 9,763 | 5 | 3.747 s | 8,416 sections plus hierarchy/appendices |
| eCFR title 40 | 30,310 | 27 | 61.147 s | 24,650 sections plus hierarchy/appendices |
| Annual CFR 2024 title 1 volume 1 | 368 | 1 | 0.236 s | 288 sections; printed date mismatch |
| FR January 2, 2024 | 63 | 1 | 0.258 s | 11 rules, 5 proposals, 47 notices |

Total: 40,872 records in 35 shards, 522,127,314 uncompressed output bytes. Counts include hierarchy and separate source
editions; they are not counts of distinct regulations or nationwide coverage. Timings are local parser measurements,
excluding acquisition, bridge validation and database work. A bridge process sample showed about 290 MB peak working
set during validation; Python peak memory was not captured, so worker sizing and fan-out remain unvalidated.

An independent ElementTree audit compared every normalized record's text to its source XML location, removing whitespace
only and excluding child records stored separately. All 40,872 comparisons passed with zero mismatches. It also checked
source element counts against the earlier acquisition-only inspection: all five matched. This checks preserved text
content/order, not layout fidelity, legal interpretation, API routing or production index completeness.

Two real source cases changed the implementation:

- Title 40 contains three `SUBJGRP` nodes with `N=""` and `EMPTY="true"`. They are preserved as explicit empty structure;
  missing identifiers on actual sections remain errors. The full title passed after adding this narrow case.
- GovInfo's 2024 title-1 volume contains `Revised as of January 1, 2023`. The advertised edition and printed revision
  stay separate. `source_date_mismatch` is retained for review; the parser never fabricates a 2024 issue date.
  The date assessor now classifies exact later-package copies as `retain_duplicate_revision_observation` only when
  one consistent earlier observation has the same title, volume, raw hash and printed revision date. It retains that
  observation's unit key as the anchor. Cross-title matches and ambiguous anchors remain quarantined. This is a source
  disposition, not permission to create a later-year edition or a complete annual title. September 15 reparse/audit of
  title 1 volume 1 for 2023–2025 identified the latter two packages as copies of the 2023 revision. Both later package
  years still fail the date-review gate; legal currency remains unset. Evidence: `annual-title1-reviewed-normalized/`
  and `annual-title1-revision-dispositions.json` under `artifacts/regulatory-backfills/`.

## Executable checks and remaining gates

The parser/bridge tests execute real Python and official-source excerpts with retained provenance. They cover inline
text/footnotes/table evidence, document-number corrections, date mismatch, empty groups, duplicate/missing identities,
DTD/entities, deep/truncated XML, wrong title, timeouts, corrupted input/output, parent validation and independent
deterministic re-parsing across the 5,000-record shard boundary. Together with acquisition and Trigger configuration,
38 focused tests passed. Service type-check, scoped lint and root `pnpm verify` passed. The coverage run passed 2,742
legislation tests, with 83 skipped. Full verification evidence is recorded in the [progress page](implementation.md).

Source/parser qualification remains partial. Newer metadata pagination/join, canonical storage, required-PDF pilots,
alternate HTML publication and diagnostic embedding comparisons are recorded in their owning validation/progress pages;
do not repeat them as unstarted work. Full source/date reconciliation, deployed runtime, Azure retention and public
search/API/MCP acceptance remain gated. Diagnostic comparisons do not select a production route or authorize bulk vectors.
