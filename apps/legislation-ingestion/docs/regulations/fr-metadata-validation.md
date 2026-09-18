# Federal Register metadata and issue reconciliation

The local `audit:fr-inventory` command checks for missing issue XML before document reconciliation can run. Supply
`--manifest`, `--metadata` and a new `--output` path. Both inventories are replayed from retained evidence, including
the source listing's complete unit set; removing a listed issue and recomputing the manifest ID does not pass.
Seven tests cover missing XML/metadata, empty observations, excluded-only days, scope mismatch and evidence changes.
The audit does not certify acquired artifacts or enable release. Historical January 2000 findings are recorded in
[implementation progress](implementation-progress.md).

Implemented September 14, 2026. Local frozen backfill acquisition and reconciliation are complete for the pilot below.
The metadata collector itself makes no canonical database writes. Subsequent PDF retention and XML/HTML canonical
publication pilots are documented below and in [storage validation](storage-validation.md); hosted/public serving remains gated.

## Source and pagination contract

`fr-metadata-contract.ts` defines the selected metadata fields, explicit date scope, source page evidence and replayable
manifest. `fr-metadata.ts` implements the reader, durable page cache, bounded pagination and saturated partition splitting.
The existing retrying HTTP client supplies request timeouts, pacing, provider error semantics and a future shared-budget
hook. No new HTTP or parsing dependency was introduced.

The [official API documentation](https://www.federalregister.gov/developers/documentation/api/v1) describes the public API.
The actual pilot responses supplied `next_page_url` values containing `search_after_cursor` and a path without `.json`.
The collector follows those URLs verbatim after checking their host, path, query scope, requested fields, page size,
format and page sequence. It preserves the opaque cursor. It never substitutes a reconstructed page-number request.

| Bound or invariant | Behavior |
| --- | --- |
| Scope | Explicit start/end/cutoff, 2000+, at most 31 inclusive publication days |
| Page size | 1–1,000; default 200 |
| Request budget | Default 200; explicit maximum 1,000 |
| Evidence size | 8 MiB per response, 64 MiB across an inventory; 50,000 normalized records maximum |
| Local pacing | At least 500 ms between requests; not a claimed provider rate allowance |
| Saturation | At a conservative reported count of 10,000, split range into days, then each day into the four document types |
| Indivisible saturation | Fail the day/type partition; never claim a capped result as complete |
| Completeness | Stable totals, no duplicate document numbers, all expected pages, exact total record count |
| Scope integrity | Reject out-of-window dates, changed filters, unknown document types, unsafe links and unexpected pages |

The publisher may return `Uncategorized Document` even though the documented type filters expose only rules, proposed
rules, notices and presidential documents. Retain that exact source value as an explicit unsupported classification.
Do not infer a supported type from `action`, title, CFR references or semantic similarity. Downstream acquisition and
publication select only the three supported regulatory types; a matching XML publication remains blocked for source
review. When an untyped parent partition is saturated, the sum of all typed child partitions must equal the parent
count. A difference fails the inventory instead of dropping documents that no typed filter can retrieve.

The saturation threshold is a conservative collection rule, not a claim that the live API cannot paginate past 10,000.
Saturated parent pages remain evidence but do not contribute duplicate records to the completed child inventories.
The day/type splitting paths are fault-fixture tested; the live pilot was not saturated. Wider history runs must enumerate
separate frozen windows and validate their combined coverage rather than relaxing these bounds.

The 2020–2024 backfill retains 60 monthly manifests containing 181 source pages and 143,200 documents. Exact type counts
are 16,043 rules, 10,158 proposed rules, 115,378 notices, 1,620 presidential documents and one uncategorized document
(`2020-16416`, published August 19, 2020). No document number repeats across the 60 manifests. Cross-source replay against
the 1,248 GovInfo daily issue units reports zero inventory gaps: 1,248 issue days require document reconciliation and
579 calendar days have zero metadata records. These results establish source inventory agreement, not text joins,
rendition completeness or publication readiness.

Each response retains its original body, URL, observation timestamp, content type, byte count and SHA-256. A directory
writer lock protects collection. Completed pages are atomically cached under the full request URL hash; a retry can use
them after a later HTTP failure. The complete manifest is committed by an exclusive atomic link only after every leaf
partition passes. Existing manifests are not overwritten. A killed process can leave a stale lock; inspect its PID before
removing that exact lock. Invalid cached evidence fails closed; use a fresh observation directory for a new snapshot.

Offline replay reconstructs the request graph, partitions, normalized records and manifest ID from retained page bodies.
It requires no network, credentials, database or Trigger.dev. Observation times remain distinct from publication dates:
historical publication metadata fetched today is not proof of exactly what the API returned on the publication date.

## Text and metadata join

`fr-reconciliation.ts` reconciles the union of normalized GovInfo XML document numbers and metadata for the issue day.
Whitespace/case normalization preserves meaningful prefixes and leading zeroes: `C1-2023-27742`, `00-001` and `E9-123`
stay distinct identifiers. The join never uses document titles as identity.

- Missing metadata, missing text, ambiguous matches and publication-kind conflicts are separate gap dispositions.
- Presidential documents are explicit initial-scope exclusions. Their metadata count is checked against the parser's
  `PRESDOCU` source element count; their raw XML document identities are not parsed by this slice.
- Publication, effective and comment-close dates remain separate date-only values; source date wording is retained.
  `legalStatus` remains `unknown`. The pilot includes a rule whose stated effective date precedes publication.
- A publisher `correction_of` link becomes a source-backed relationship candidate. Its target can remain unresolved
  outside the selected issue; a correction document is not merged into the earlier document.
- A listed PDF URL must match the exact GovInfo issue and document number. Its state is `listed_not_acquired` until a
  separate rendition job retains and validates its bytes. Missing listings and untrusted destinations remain explicit.

`metadataComplete` means the selected text/metadata union reconciled. It does not set `artifactsComplete` or
`publicationReady`. PDF listings are not downloads, and this report does not unlock the existing canonical writer.

## Live pilot and commands

Run from `apps/legislation-ingestion`. Collection defaults to preview; `--apply` fetches metadata and writes only local evidence.
Reconciliation and replay read retained inputs and write exclusive output reports.
The dated artifact names below are historical. Existing inputs remain under `apps/legislation/artifacts`; explicitly
resolve their local paths before replay and choose fresh outputs rather than overwriting evidence.

```powershell
pnpm tool regulations/collect-fr-metadata --start 2024-01-02 --end 2024-01-02 --cutoff 2026-09-14 --page-size 20 --output artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14 --apply
pnpm tool regulations/collect-fr-metadata --replay artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14/manifest.json --output artifacts/regulatory-backfills/fr-metadata-replay-2026-09-14
pnpm tool regulations/reconcile-fr-issue --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --date 2024-01-02 --raw artifacts/regulatory-backfills/raw --normalized artifacts/regulatory-backfills/normalized --metadata artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14/manifest.json --output artifacts/regulatory-backfills/fr-issue-reconciliation-2026-09-14.json
pnpm exec vitest run src/ingestion/regulations/fr-metadata.test.ts src/ingestion/regulations/fr-reconciliation.test.ts
```

Pilot inventory: four live pages, 65 distinct documents. Manifest ID:
`a4d9f3df4b1f9999f4d09f7813f6837af4f8b38e51a058e8cb70355247c722a4`.
Offline replay produced the same ID. An independent 1,000-per-page source response produced identical normalized
metadata for all 65 documents. The issue join matched all 63 supported XML publications with zero gaps. Documents
`2023-28935` and `2023-28947` are the two presidential exclusions; the XML source count is also two.
All 63 matched publications have validated GovInfo PDF locations. A subsequent rendition run acquired all 63 originals;
see the acquisition command and status below. The earlier reconciliation report is retained unchanged.

Reports under local ignored `artifacts/regulatory-backfills/`:

- `fr-metadata-pilot-2026-09-14/manifest.json`: page bodies, cursor URLs, counts, fields and retrieval evidence.
- `fr-metadata-replay-2026-09-14/manifest.json`: offline reconstruction.
- `fr-metadata-independent-audit-2026-09-14.json`: comparison against the independently retained complete response.
- `fr-issue-reconciliation-2026-09-14.json`: every match, gap, exclusion, correction link and PDF disposition.
- `fr-metadata-implementation-2026-09-14.json`: implementation hashes, git base and verification outcomes.

The exact single-response fixture is `fixtures/fr-2024-01-02-metadata.json`, SHA-256
`8293405067402d1b94263d11d07743fd0fae71e68fc25a29467ff721a9fd8df2`; adjacent provenance records its URL and timestamp.
Formatting excludes this one raw-response file to preserve its checksum. Synthetic paging/failure fixtures are labelled
in test construction; the reconciliation tests use real XML excerpts and corresponding source metadata.

28 focused checks passed. They exercise real metadata fields, cursor traversal, splitting, duplicates, gaps, changed
totals, empty days, unsafe links, cache corruption, HTTP 429/503, failed-page resume, exclusive final manifests and
replay tampering. A combined rerun also passed all 16 parser/bridge checks, for 44 focused checks in total.
Service TypeScript and scoped lint passed. Root `pnpm verify` passed; counts and the retained log are recorded in the
[implementation progress page](implementation-progress.md).

## PDF rendition acquisition

```powershell
pnpm tool regulations/acquire-fr-pdfs --metadata artifacts/regulatory-backfills/fr-metadata-pilot-2026-09-14/manifest.json --date 2024-01-02 --directory artifacts/regulatory-backfills/fr-pdfs --output artifacts/regulatory-backfills/fr-pdfs-pilot-2026-09-14.json --limit 100
```

Replaying the same command with a fresh output filename verifies and reuses retained receipts. The metadata manifest
is replay-validated before selecting the issue's rules, proposed rules and notices. The default limit is 100 documents;
larger issues require an explicit larger limit. The default per-PDF ceiling is 32 MiB, with one serial worker, existing
source pacing/timeouts and no automatic source schedule. Future Trigger workers still require a shared provider budget.

The live pilot retained 63 PDFs (23,328,275 bytes); replay reused every receipt. `acquisitionComplete` means this selected
metadata inventory's required PDFs were downloaded and checksum/signature/end-marker checked. It does not establish
full PDF structural validity, XML/PDF text parity, canonical publication readiness or historical corpus completeness.
Those gates are separate from acquisition. Per-document failures are reported and retryable; corrupt retained evidence fails closed.

The subsequent `validate:fr-pdfs` pilot parsed all 266 pages of all 63 originals and confirmed each publisher document
number and page count. `fr-pdf-validation-2026-09-14.json` records artifact, parser-version, validator-code and extracted-text
hashes. The first page of the largest 51-page PDF was rendered with Poppler and visually inspected; this sample does not
claim full visual review. Canonical attachment and its local database validation are described in [storage validation](storage-validation.md).

The January 3, 2000 alternate-rendition smoke retained all 75 supported publications (14 rules, 11 proposals, 50 notices),
totaling 17,383,416 bytes. All 75 were reused on replay and validated across 258 pages, with matching publisher page
counts and document numbers. The metadata supplies no full-text XML link for any of these 75 records. No page produced
empty extracted text, but this is not an OCR eligibility or reading-order assessment. Validation retains text hashes
and counts, not a normalized searchable document. One presidential document remains outside the initial scope.

Evidence under `artifacts/regulatory-backfills/`: `fr-2000-early-pdf-acquisition.json`, `fr-2000-early-pdf-replay.json`,
`fr-2000-early-pdf-validation.json`, and immutable receipts/blobs in `fr-2000-early-pdfs/`. The validation report records
1,730,229 extracted text characters and a largest document of 30 pages. No canonical records were published, no index
or embedding jobs ran, and no full visual review was performed for this historical slice.

## PDF-derived text staging

`extract:fr-pdf-text` reuses the existing document extractor, including its digital/image-only/mixed-scan assessment,
in an isolated Node worker. Supply `--metadata`, `--date`, `--directory` (retained PDF root), `--output` (staging root),
`--report` (new report filename), and optionally `--limit` (default 100, maximum 1,000). Only the selected frozen day
is processed. No provider, database or OCR credentials are passed to the worker and no OCR service is invoked.

Each worker is bounded to 512 MiB V8 heap, 90 seconds and 64 MiB output. Source PDFs use the shared extractor's
25 MiB/750-page ceiling; normalized text is capped at 16 million UTF-16 units. It independently parses page content
and operators, confirms receipt hash/size and publisher page count, then extracts normalized text. Digital extraction
requires the document-number check. An OCR-required record may retain an unconfirmed identity and never clears
publication readiness. Oversized, malformed or mismatched evidence fails explicitly.

Atomic content-addressed staging binds metadata source identity, PDF hash, expected page count and an extractor
fingerprint covering the worker, extraction/identity/validation code and PDF.js/canvas package versions. Resume checks
raw hashes, the staged envelope and text hash. The normalized text is a separate rendition; it does not impersonate XML
blocks, overwrite canonical publications or enqueue indexing/embeddings. Sections from the shared extractor are not
published as legal provisions. The command reports partial limits, failures and OCR requirements with a nonzero exit.

Historical PDFs can contain neighboring publications on shared pages. The report's boundary audit finds publisher
FR Doc footers and flags foreign document numbers as `shared_page_text`. A sole expected footer still yields
`boundaries_unverified`; absence yields `expected_footer_not_found`. This is a conservative diagnostic, not a complete
segmentation algorithm. All staged records retain `textReconciliation: pending` and `publicationReady: false`.
Do not trim a shared page automatically or treat successful extraction as a clean legal-document body. Resolve the
publication boundary using official document-specific text or evidence-backed page/column segmentation before import.

## Document-specific GovInfo HTML

`acquire:fr-html` implements the preferred alternate text path for missing/ambiguous bulk XML. It derives an official
HTML candidate from the already validated PDF locator (`/pdf/{number}.pdf` to `/html/{number}.htm`), then independently
checks the downloaded content. A derived URL is not an availability claim; HTTP or content failures remain explicit.
The source guard permits only this exact GovInfo FR path shape, with no query, credentials or redirects.

The collector uses the shared paced client, an 8 MiB streaming ceiling, immutable SHA-256 HTML blobs and acquisition
receipts. Replay checks retained bytes and reparses the source against the current metadata; parsing failure does not
erase the acquired evidence. A report retains the metadata manifest/record hash, receipt, parser hash, text and text
hash. Each report filename is exclusive. The local collector is serial; distributed provider budgets remain pending.

The parser requires one PRE body, a matching FR Doc header, publication date/volume, page range, publication type and
the expected FR Doc footer without a foreign footer. It also requires the metadata title in the subject area before
AGENCY/ACTION/SUMMARY, or the leading 4,096 characters when those labels are absent. Comparison normalizes publisher
quotation marks, dash typography and hyphenated line wrapping; retained text is unchanged. A title mismatch blocks
publication even when the document number and header fields agree. It preserves source indentation and page markers instead of using
the generic HTML extractor that flattens layout. It does not render source HTML or assert that every textual detail has
been compared visually with the PDF. Publisher headers remain in the retained rendition. Canonical publication and
legal paragraph/section normalization remain separate gates.

January 18, 2000 demonstrates why the subject check is necessary. The metadata record for 00-113 combines the Minnesota
notice's title and page 2639 with type Rule. Its individual HTML contains the Hobbs airspace rule's body. The full issue
prints the same publisher number for both publications, at 65 FR 2537–2538 and 65 FR 2639. With typography normalized,
108 of 109 metadata-listed HTML renditions pass; 00-113 fails `fr_html_subject_mismatch`. All 109 PDFs (383 pages) passed
PDF validation, which does not resolve this identity conflict. The full issue contains 110 supported publications, so
109 successful downloads would still not establish complete coverage. The 75 January 3 renditions pass the new check.

`planFrIdentityResolution` retains source observations keyed by artifact hash and locator, proposes separate citation
keys, and records a duplicated publisher number as an ambiguous alias. It requires matching title, kind and page
intervals; repeated citations remain unresolved instead of receiving arbitrary suffixes. Both real 00-113 observations
remain unmatched against the mixed metadata. Citation-based canonical publication and full-issue reconciliation remain
to be implemented. The HTML loader now partitions this specific subject conflict into quarantine while retaining every
metadata-listed record in its accounting. The strict whole-issue parser continues to reject duplicated native numbers.
Do not remove a failed record to make a batch appear complete, or infer a corrected publisher number.

Quarantine entries retain the number, metadata hash, HTML/PDF hashes, source URL and reason. Raw artifacts and the exact
partition are persisted at import registration; the generation summary retains coverage and quarantine before any
publication. The publication transaction retains the same report in its reconciliation JSON. Quarantined records never
receive canonical documents or search outbox jobs. Replay is bound to the partition and normalizer hash. A changed
partition cannot be submitted under an existing generation. Retained acquisition evidence survives publication rollback.

Coverage reports `metadataExpected`, `verified`, `quarantined` and `issueInventoryVerified: false`. The partition must
account for each supported metadata record exactly once by metadata hash. This is metadata coverage, not a claim that
the full issue has been reconciled. For January 18 the partition is 109 expected, 108 verified, one quarantined; the two
bulk-issue publications sharing 00-113 remain unresolved. Missing/corrupt files, other identity failures and unexpected
exceptions still abort. Only the typed subject-mismatch error can enter this quarantine path. A fully quarantined set
can retain its report without producing canonical documents or outbox jobs.

Example verified source: [GovInfo document 99-33595](https://www.govinfo.gov/content/pkg/FR-2000-01-03/html/99-33595.htm).
Its document-specific text starts with the Labor wage-determination notice, while the PDF extraction begins with an
adjacent publication. For this source, prefer the verified HTML rendition over automatically trimming the PDF.

Run from `apps/legislation-ingestion` with a new output filename:

```powershell
pnpm tool regulations/acquire-fr-html --metadata artifacts/regulatory-backfills/fr-2000-early-metadata/manifest.json --date 2000-01-03 --directory artifacts/regulatory-backfills/fr-2000-early-html --output artifacts/regulatory-backfills/fr-2000-early-html-report.json --limit 100
```

The same command with a fresh report name validates and reuses retained source bytes. The limit bounds each invocation;
a truncated or failed selection exits nonzero. Recurring source ingestion, canonical writes and indexing stay disabled.

## Format-aware publication input

`normalize:fr-html-publications` prepares verified HTML and PDF sources for the alternate-rendition database writer.
It does not create an XML acquisition unit or reuse the XML parser contract. Text is labeled `html_preformatted`, with
source provenance and `css:pre`; PDF receipt/inspection remain separate. Legal effectiveness stays unknown and semantic
sections are not inferred. The current XML issue writer cannot yet publish these inputs.

The offline command requires a frozen metadata manifest, HTML/PDF roots and a complete PDF validation report matching
the day, metadata manifest and current validator code hash. It replays metadata, rechecks raw HTML/PDF bytes, reparses
HTML assertions, rejects duplicate/missing PDF proof and reconstructs verified text exactly from bounded reader blocks. The
reader's plain-text projection supplies UTF-16 offsets without fabricated XML tags or source element ordinals.
Publisher headers, indentation and page markers remain retained.

Text-version staging keys depend on text/format/contract. Metadata-only changes affect the observation key instead.
Observation provenance includes source namespace, native number, metadata manifest/record hash and both raw artifact
hashes. These staging keys are not canonical database UUIDs or public API IDs. Format-aware import-generation
registration, staging and canonical publication are implemented. HTML and XML adapters share canonical row persistence
while retaining different source text contracts. See [storage validation](storage-validation.md#canonical-html-publication).

```powershell
pnpm tool regulations/normalize-fr-html-publications --metadata artifacts/regulatory-backfills/fr-2000-early-metadata/manifest.json --date 2000-01-03 --html artifacts/regulatory-backfills/fr-2000-early-html --pdf artifacts/regulatory-backfills/fr-2000-early-pdfs --validation artifacts/regulatory-backfills/fr-2000-early-pdf-validation.json --output artifacts/regulatory-backfills/fr-2000-early-publication-inputs.json
```

Use a fresh output filename on replay. Each batch is capped at 1,000 publications and 64 MiB serialized input payload;
every selected record must be verified or explicitly quarantined to produce its exclusive final output. The normalizer
hash includes the input adapter, HTML parser, subject comparison and loader. The HTML cache reader has network fetching
disabled in this workflow. No database, search, embedding or OCR service is accessed.
