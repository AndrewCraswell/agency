# Federal collector baseline and reuse decision

Agreed direction, September 14, 2026: license state statutory/regulatory coverage, subject to validation and terms;
collect federal material directly, using Vaquill's open collectors as starting implementations. Existing bill ingestion
stays in place. This is a future design, not a validated importer or deployment.

## What improves our earlier plan

The earlier GovInfo-first plan already favored bulk XML, local storage and optional structured enrichment. Vaquill
provides concrete implementations of those ideas. Adopt its Federal Register metadata/text split and eCFR title-based
acquisition as the default implementation direction, replacing the earlier treatment of both APIs as merely optional.

| Area | Earlier plan | Combined decision |
| --- | --- | --- |
| Published rules | GovInfo bulk; optional metadata enrichment | FederalRegister.gov metadata + GovInfo daily XML, joined by document number |
| Current regulatory code | GovInfo current eCFR XML; optional eCFR API | eCFR title inventory + dated full-title XML; GovInfo bulk remains an alternative |
| Initial scope | Broad source catalog with staged additions | Three pipelines: U.S. Code, eCFR, Federal Register |
| Historical code | GovInfo annual CFR editions | Retain as a separate historical import |
| Dockets and planning | Regulations.gov and RegInfo later | Retain as separate expansions, not initial dependencies |

The useful Federal Register improvement is fewer full-text requests while retaining structured agency information,
RINs, docket IDs and CFR references. Vaquill partitions metadata discovery by month, fetches daily publication XML,
and joins on document number. These identifiers support later statute/regulation links, but do not themselves prove
which pending bill a rule implements. Paginate every partition fully; a month is not necessarily one API request.

For eCFR, reuse the title inventory, reserved-title handling, publisher issue/currency dates, full-title XML retrieval,
dated raw storage and structural parsing. This is a clearer implementation recipe than designing section-level fetches.
Our earlier bulk design already avoided section-by-section acquisition; the gain is implementation reuse and explicit
version selection, not a demonstrated new performance advantage.

## Initial acquisition and updates

1. **U.S. Code:** reuse download/parsing patterns; discover current editions or releases instead of copying fixed year
   constants. This supplies the statutory baseline and is distinct from existing federal bill collection.
2. **eCFR:** fetch title metadata and XML for the selected publisher issue date. Key completion by title and version,
   preserve source currency, validate the full title, and publish it only after successful parsing/reconciliation.
3. **Federal Register:** store GovInfo source text and official renditions; attach separately attributed metadata from
   FederalRegister.gov. Record unmatched documents as acquisition/enrichment gaps. An enrichment outage must not discard
   successfully acquired source text. Reconcile against GovInfo inventories so the metadata join is not the only coverage gate.

Continue detecting corrections to older publications through supported source modification discovery and periodic
inventory reconciliation. Cache with hashes and source version/HTTP metadata; a local file alone is not proof that a
source has not changed. Keep acquisition, parsing and indexing completion separate. Use the existing Tabra orchestration
and persistence requirements in [implementation](implementation.md), rather than adopting a vendor-specific search stack.

## What we must change or retain

- **eCFR resume behavior:** the inspected downloader skips a title already present in its output by title number alone.
  That can miss a newer issue and can mistake a partially written title for a completed one. Replace this with a validated
  title/version checkpoint; do not use resume mode as recurring synchronization unchanged.
- **U.S. Code years:** both inspected downloaders use `TARGET_YEARS = [2024, 2023]`. Correct release discovery before reuse.
- **Federal Register scope:** the inspected CLI accepts RULE and PRORULE. Our planned notice coverage requires additional
  explicit collection; comments mentioning NOTICE XML do not establish notice output support.
- **Historical range:** the script describes a 1994-onward bulk backfill, but GovInfo documents Federal Register bulk XML
  from 2000. Validate another rendition/acquisition route for 1994–1999 before claiming that range. A missing bulk file
  is not an empty publication. Annual CFR editions and exact historical eCFR states are separate requirements.
- **Reliability:** retain bounded retries, source budgets, durable manifests, failure quarantine, correction/removal
  handling, version history and completeness checks. Do not carry over claims of no rate-limit risk or unmeasured backfill times.

Regulations.gov supplies docket materials/comments; RegInfo supplies planning/review information. Their absence from
the initial code explains some apparent simplicity. Neither is replaced by the Federal Register/eCFR pair. Likewise,
do not describe codified state coverage from a license as timely nationwide state rulemaking coverage.

## Evidence and implementation acceptance

Source inspected at commit `2f7aeb85a434a54a351ac44e3c188fec318f78ba`; no nationwide crawl, throughput benchmark or paid
database comparison was performed. Public code is a starting point, not measured parity with Vaquill's paid service.
Preserve Apache-2.0 notices when reusing code and record modifications; the open dataset has a separate compilation license.

- [Federal Register collector](https://github.com/Vaquill-AI/open-us-law/blob/2f7aeb85a434a54a351ac44e3c188fec318f78ba/scripts/federal/ingest_federal_register_bulk.py)
- [eCFR downloader](https://github.com/Vaquill-AI/open-us-law/blob/2f7aeb85a434a54a351ac44e3c188fec318f78ba/scripts/federal/download_ecfr.py)
- [Federal source code](https://github.com/Vaquill-AI/open-us-law/tree/2f7aeb85a434a54a351ac44e3c188fec318f78ba/scripts/federal)
- [GovInfo bulk availability and discovery](https://www.govinfo.gov/developers)
- [eCFR API documentation](https://www.ecfr.gov/developers/documentation/api/v1)

Before operational adoption, demonstrate a bounded import with matched metadata/text, a changed eCFR title, an interrupted
title import, an old-publication correction, missing enrichment and replay without duplicates. Compare tables, appendices
and source text, and measure actual request/transfer costs. These are future implementation acceptance cases, not tests
claimed by this documentation update.
