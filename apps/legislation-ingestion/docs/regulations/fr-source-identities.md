# Federal Register source identities and disputed numbers

Owner: ING-05 in the [production backlog](ingestion-production-tasks.md). Source identity registration is distinct
from publication of text and metadata. The source-record denominator must include every supported XML publication,
including multiple publications sharing one printed document number.

## Reviewed January 18, 2000 collision

The [official issue XML](https://www.govinfo.gov/bulkdata/FR/2000/01/FR-2000-01-18.xml) has 2,800,863 bytes,
SHA-256 `5c8fa553adc3c2c5b041ac8b1b1cc6cac1edd4945111037bd4f4fbf574566201`. It contains 110 supported RULE,
PRORULE and NOTICE records, but only 109 distinct printed document numbers. Two distinct publications print `00-113`.

The [official issue PDF](https://www.govinfo.gov/content/pkg/FR-2000-01-18/pdf/FR-2000-01-18.pdf) independently confirms
the following boundaries. Printed pages 2537, 2538 and 2639 were rendered and visually inspected. The PDF has shared
pages: page 2537 begins with the previous document and page 2639 contains multiple similarly titled island notices.
The Hobbs footer is on page 2538; the disputed Minnesota notice starts near the bottom of the left column on page
2639 and ends at the top of the right column with its own `00-113` footer. Retained PDF and inspected page images
are under `artifacts/regulatory-backfills/fr-jan18-source-review/`.

| Source locator | Printed evidence | Citation identity |
| --- | --- | --- |
| `/FEDREG[1]/RULES[1]/RULE[5]` | Hobbs airspace rule, 65 FR 2537–2538 | `fr:2000-01-18:65:2537:rule` |
| `/FEDREG[1]/NOTICES[1]/NOTICE[62]` | Minnesota island plat notice, 65 FR 2639 | `fr:2000-01-18:65:2639:notice` |

The exact-artifact parser rule retains each complete source record and original locator, including its printed
FRDOC footer, while assigning the two reviewed citation identities. It changes neither body nor publication type.
Any changed artifact still hits the ordinary duplicate-identity gate; unreviewed collisions cannot receive arbitrary
suffixes. The full compressed original issue is a regression fixture. Other records retain document-number identity.

The API metadata for `00-113` mixes the Minnesota title/pages with type Rule; its individual HTML contains the Hobbs
body with the notice's page header. Neither record is permitted to inherit that mixed metadata as verified facts.
Source inventory retains the conflicting candidate as evidence for both observations, explicitly marked `conflict`.

## Reviewed 2020–2024 bulk-source defects

The complete 2020–2024 GovInfo XML parse found eight issues that correctly failed the ordinary identity rules. Five
contained an unambiguous document number in a malformed `FRDOC` footer: an omitted period after `Doc`, omitted spacing
after the period, or an omitted `Filed` label followed directly by the filing date and time. The parser now accepts only
those structural variants when the number is followed by a numeric filing date and time. Prefix text, malformed filing
labels, multiple footers and footers without that boundary still fail.

Five other footers retain the exact `Filed` boundary but corrupt the filing date itself: a missing year, an HTML entity,
publisher insertion text, or an extra digit. Those date strings remain unchanged as source evidence and are never used
as publication dates. They do not make the preceding document number ambiguous, so the parser accepts the number while
the independently reconciled issue date and FederalRegister.gov metadata continue to govern publication dating.

The November 19, 2021 Part II rule at `/FEDREG[1]/NEWPART[1]/RULES[1]/RULE[1]` has no closing `FRDOC` element. Its exact
7,631,810-byte issue artifact, SHA-256 `2b7290a3508d8d04859fb949a60323b58707f9c9429aeaa4fedd235da0abaa28`,
identifies the rule as `2021-23972` in the issue contents at pages 64996–66030. The retained November metadata manifest
independently matches the complete title, docket `CMS-1751-F`, RIN `0938-AU42`, start page 64996 and document number.
Only that artifact and locator receive the reviewed identity; changed bytes or another locator still fail.

Three official issue artifacts repeat one publication as adjacent XML records. These are redundant source nodes rather
than distinct publications sharing a printed number: their title, agency, action, filing footer and substantive text
identify the same publication, one copy lacks printed-page markup, and FederalRegister.gov lists one document. The
parser suppresses only the reviewed redundant locator while retaining the copy with printed-page evidence. Source tag
counts continue to expose the extra publisher node.

| Issue artifact | Printed number | Retained locator | Suppressed redundant locator |
| --- | --- | --- | --- |
| `FR-2020-07-24`, `d4decec3457dda3b235e7ddfe606422e58d184bb46732ee6ebab32bfe9d1e849` | `2020-16104` | `/FEDREG[1]/NOTICES[1]/NOTICE[76]` | `/FEDREG[1]/NOTICES[1]/NOTICE[75]` |
| `FR-2022-11-22`, `33cbc83a1e4f42f5deeb56b94560c3c256701e8344d0d41c6b9df1a175b794b6` | `2022-25384` | `/FEDREG[1]/NOTICES[1]/NOTICE[50]` | `/FEDREG[1]/NOTICES[1]/NOTICE[51]` |
| `FR-2023-01-09`, `be4bf01bd8e7b975c32cf75ff97cfe0730ec58197640ab6d8b61957f6414b922` | `2023-00285` | `/FEDREG[1]/NOTICES[1]/NOTICE[11]` | `/FEDREG[1]/NOTICES[1]/NOTICE[12]` |

Every exception is bound to the exact issue hash and XML locator. The parser verifies that each configured suppression
was encountered, and changed artifacts return to the general missing/duplicate identity gates. An eight-issue replay
through the Python parser and TypeScript shard validator produced 938 publications with no warnings or failures.

## Persistent accounting and boundaries

`register:fr-source-inventory` operates on an already staged XML generation under a fenced lease and active source
rights. It replays the original metadata manifest and checks source counts against all supported XML tag counts,
strict normalized records, provenance, stored hashes, unique locators and identities. The initial whole-issue worker
is bounded to 1,000 records and 64 MiB of staged payloads; larger issues require the partitioned worker backlog.

`regulatory_source_inventories` retains the metadata snapshot, source denominator and reconciliation hash.
`regulatory_source_documents` retains each artifact/locator observation, canonical identity, printed number, citation
and candidate metadata disposition. Citation identities use the `federal-register-citation` namespace; ordinary
identities reuse `federal-register` documents. Registration creates no versions, publication observations or derived
outbox events. The generation remains subject to its publication gates. A metadata `candidate` is not validated
rendition coverage, even when its number, subject and kind agree.

Replay checks the full stored evidence and canonical identity mapping, not counts alone. The source-number resolver
returns all distinct candidate identities, explicitly `ambiguous` when there is more than one; inactive rights hide
those observations. The existing document-number publication writer rejects an ambiguous source alias. It cannot
merge both source records into a single document or choose the first candidate.

The canonical publication path below now consumes the corrected metadata/rendition associations and accounts for
110 published source records. Identity registration alone still does not establish published or searchable coverage.
Release-wide rendition reconciliation and missing-XML/OCR fallback remain separate ING-06 gates.
Current eCFR, annual pilots and earlier verified FR publications are not replayed or reset by this implementation.

## Reviewed fields and rendition boundaries

`register:fr-source-reviews --generation <id> --metadata <manifest> --pdf <issue.pdf> --output <report> --apply`
adds field-level reviews separately in `regulatory_source_reviews`. It verifies the complete retained PDF bytes
against the reviewed 5,862,981-byte artifact above, replays source inventory evidence, and binds each correction to
the exact staged record hash and XML locator under an active fenced lease. Replay compares the complete review
payload and hash; a conflicting later review rolls back all new review rows. Original candidate metadata, bodies,
footers, identities and inventory dispositions are preserved. No publication versions or derived events are created.

The reviewed fields are title, publication kind, publication date and printed page interval. API agency, dates,
citations, attachments and other fields are not copied into corrected metadata without their own evidence.

| Record | Reviewed fields | PDF pages, one-based | Individual HTML |
| --- | --- | --- | --- |
| Hobbs `00-113` | Hobbs title, rule, January 18, 2000, pp. 2537–2538 | 24–25 | Rejected mixed identity |
| Minnesota `00-113` | Minnesota title, notice, January 18, 2000, p. 2639 | 126 | Rejected mixed identity |
| `00-1083` | SO2 title, notice, January 18, 2000, pp. 2610–2611 | 97–98 | Unreviewed |

The SO2 heading was visually checked on printed page 2610, with the matching footer on page 2611. XML has
`<E T="52">2</E>` separated by source whitespace; the reviewed title joins the formula without altering canonical
XML text or broadening general subject comparison. `FRL-6524-6` and `EQSA-0100-133` identify this specific notice.
The Minnesota review also requires `ES-50581` and `Seretha Lake`, distinguishing its similarly titled neighbors.

These are shared-page visual checks, not complete PDF validity or isolated document-text approval. The retained
issue emitted two decompression warnings during a MuPDF text scan; the later PDF.js checks below qualify that
earlier diagnostic. Individual PDFs
remain unreviewed. Citation-based publication must still validate required renditions and exclude adjacent text.
The complete original PDF is retained as `fixtures/fr-2000-01-18.pdf` to regression-test artifact binding; it is
unmodified, from the official PDF URL above, and its SHA-256 is the reviewed PDF hash above.

## Offline extraction from reviewed page regions

`stage:fr-pdf-regions --pdf <issue.pdf> --output <directory>` runs the existing full-issue PDF.js parser checks
and extracts only the reviewed column regions for the three disputed records. Inputs are restricted to the exact
reviewed artifact. Region coordinates use points on its original unrotated 612-by-792 pages; cuts fall in gutters
or gaps between documents. Any text item crossing a region edge is rejected instead of partially copied.

Each result preserves its ordered regions, source text and hash. Distinguishing anchors, excluded neighboring
document anchors and exactly one matching FR Doc footer are required. This is independent supporting evidence;
canonical text continues to come from XML. It does not authorize publication or certify OCR fallback accuracy.
The bounded worker has a 512 MiB heap, 90-second deadline and 8 MiB output ceiling. Output is content-addressed by
source and implementation hashes, atomically created and replay-validated; concurrent writers must agree exactly.

The existing PDF.js validator successfully parsed text and operators on all 321 pages of the retained issue in
4.8 seconds. It found 2,022,967 characters and one empty-text page, page 300. That page was rendered and visually
confirmed blank. Thus the prior MuPDF warnings do not represent a failure of the required PDF.js validation gate;
they are retained as tool-specific diagnostics. Whole-issue structural validation alone does not resolve individual
document identity or authorize copying shared-page text.

## Local execution evidence

### Canonical publication contract

`publish:fr-source-issue` is a local-only, offline issue publisher. It loads retained HTML, individual PDFs and their
inspection report using the existing strict validators, replays the reviewed whole-issue regions, and revalidates
source inventory and field reviews under the import lease. Publication requires a disposition for every source
record: ordinary records use matched metadata and validated individual renditions; the three reviewed records use
their corrected fields and reviewed issue-PDF regions. Rejected mixed HTML is retained as a rejected disposition.

The writer resolves each document through its registered `(generation, record key)` source identity, retaining
separate citation identities for the duplicate number. Canonical text and blocks come unchanged from staged XML.
Reviewed metadata stores only the evidenced fields and a link to the review, alongside original candidates; it does
not copy unreviewed agency, effective-date or attachment fields from the mixed API row.

All text versions, observations, per-record `regulatory_source_renditions`, lexical outbox events and the published
generation transition commit atomically. A missing rendition or failure creating derived work prevents publication.
Replay checks exact canonical text, blocks, metadata, PDF receipts/inspections, rendition evidence and outbox presence,
as well as the snapshot. A corrupted canonical row is rejected rather than accepted on matching counts alone.
The issue-PDF receipt records local file creation as retention time, explicitly distinct from publisher currency or
an assertion about the original remote download time. This bounded reviewed-issue path does not qualify OCR fallback.

The fresh publication pilot on port 55452 verified 110 canonical documents, versions, observations, rendition
dispositions and lexical outbox events. Replay retained those counts; independent SQL comparison found zero
differences from all staged XML bodies, headings, blocks, kinds and locators. Coverage is 107 ordinary document PDFs
and three reviewed issue-PDF extracts. `fr-jan18-source-publication.json`, its replay and audit report record this
execution. Indexing and embeddings have not run for this pilot. Earlier pilot evidence below describes earlier states.

The retained issue parsed to 110 records with no warnings: 12 rules, six proposals and 92 notices. Current parser
SHA-256: `cd4606108bf078faede4883f835055a57604b3871782de4fe7d3c793b0f53671`. The inspected issue PDF checksum is
`2becceee78ccdac5369e37fa877be85a564ff01b103952082d545a748d97439a`.

Fresh pilot port 55448 staged generation `ae822c65f12906a0732c06b6a8d6aecaa70a7eea1173949ae3179c2e298bf0fa`.
Initial registration and replay retain 110 canonical identities, 110 source observations and 110 staged records.
There are zero text versions, publication observations and outbox events. The rule document is
`27dc53b6-9cfb-42e0-965f-712a1d8b0d04`; the notice is `a30f2341-b258-4856-879f-c99dac2fcc34`.
Both retain their distinct original locators and cite the shared printed number as ambiguous.

Of 109 supported metadata records, 107 source records have candidate metadata and three require review: both
`00-113` records plus `00-1083`, whose XML heading renders the subscripted chemical formula as `SO` followed by a
line break and `2`, while metadata spells `SO2`. No metadata row is missing a source-number observation. Candidate
status does not certify pages, attachments or publication eligibility; the extra typography conflict is retained.

Evidence under `artifacts/regulatory-backfills/`: `fr-jan18-identity-normalized/`, `fr-jan18-identity-import.json`,
`fr-jan18-source-inventory.json`, `fr-jan18-source-inventory-replay.json` and
`fr-jan18-source-inventory-audit.json`. Test and pilot databases were created fresh on ports 55447 and 55448;
earlier eCFR, annual and FR pilots remain intact. The migration change is to the unreleased baseline, not an
in-place upgrade of those retained pilots.

The subsequent field-review pilot uses fresh port 55450 and the same retained normalized generation. It holds 110
source identities, three separate reviews and all three original metadata conflicts. Exact database/readback audit
matched initial and replay review payloads; zero text versions, publication observations or outbox events exist.
Evidence: `fr-jan18-source-reviews.json`, `fr-jan18-source-reviews-replay.json` and
`fr-jan18-source-reviews-audit.json`. Fresh disposable tests on port 55449 passed 59 checks with four optional
search-copy checks skipped. The complete PDF fixture exercises rejection of altered bytes of the same length.
