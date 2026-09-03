# OCR canary and historical backfill cost report

## Decision summary

The production inventory does not support OCRing the full document corpus or
the full unresolved-document population. The defensible historical backfill is
319 retained PDFs totaling exactly 1,485 pages. At the current Azure Document
Intelligence S0 Read price for West US 2, the projected OCR charge is $2.2275.

No historical backfill was started as part of this report. The recommended
approval boundary is exactly 319 canonical document IDs and no more than 1,485
submitted pages. OpenRouter embedding charges are excluded because they use a
separate provider account with its own spending limit.

## Paid production canary

The successful canary used this retained, image-only legislative amendment:

- canonical document ID:
  `bill:ak:33:hb:145:document:45af061c2ce5e4bd5887c481`;
- source title: `HB 145 Amendment 1 Coulombe 042924`;
- artifact: 41,674-byte, two-page PDF;
- detector result: two of two pages required OCR;
- OCR result: `processed` using `azure-document-intelligence`;
- provider pages: 2;
- persisted text: 993 characters;
- persisted sections: 1;
- current section embeddings: 1; and
- projected OCR charge: $0.003 at $1.50 per 1,000 pages.

Production job evidence:

- detector run `1e93607d-f64d-401f-bbee-40f314393d6f`;
- OCR run `3d90f918-096f-4bbf-b6c5-c1a0d6a5b5da`; and
- embedding run `e47b4070-d280-4f38-a513-e1c9e0b8a447`.

The canary also exposed two operational facts:

1. The Azure identity configured for the Railway web service lacks the
   `Microsoft.CognitiveServices/accounts/FormRecognizer/documentmodels:analyze/action`
   data action. Trigger's production Azure identity is distinct and completed
   the same OCR request successfully. OCR must continue to run with the Trigger
   identity unless Railway is intentionally granted the narrower data-plane
   permission.
2. Trigger run `run_06g6dfsu6qv5gdl10gdru5kc01` remained queued and expired
   after its ten-minute TTL with zero attempts and zero task cost while Trigger
   reported stale control-plane telemetry. The canary was completed through the
   same production processor locally, using Trigger's production Azure identity
   and the production database. Durable state prevented a duplicate OCR call.

The OCR output is usable and embedded, but its single generated section has no
page range. Page-span preservation should be corrected before page-specific API
claims are made; it does not change the measured provider-page count or this
backfill price.

## Historical inventory

The candidate cohort is defined by all of the following evidence:

- terminal processing error `Bad uncompressed block length in flate stream`;
- a retained, nonempty PDF artifact;
- readable PDF page metadata; and
- no previous successful or exhausted Azure OCR result.

All 319 candidates have an OpenStates upstream identifier and an official state
document URL. There are no unresolved federal or GovInfo bill documents.

| Jurisdiction and session | Documents | Pages | Estimated OCR charge |
| --- | ---: | ---: | ---: |
| New Hampshire 2024 | 159 | 694 | $1.0410 |
| New Hampshire 2026 | 142 | 633 | $0.9495 |
| New Hampshire 2022 | 12 | 52 | $0.0780 |
| Missouri 2020 | 2 | 6 | $0.0090 |
| Missouri 2022 | 1 | 2 | $0.0030 |
| Missouri 2024 | 1 | 3 | $0.0045 |
| Vermont 2017-2018 | 1 | 10 | $0.0150 |
| Vermont 2025-2026 | 1 | 85 | $0.1275 |
| **Total** | **319** | **1,485** | **$2.2275** |

Artifact and page-count characteristics:

- total retained bytes: 39,270,487;
- minimum pages per document: 2;
- median pages per document: 4;
- average pages per document: 4.66; and
- maximum pages in one document: 85.

The inventory downloaded and inspected retained artifacts without submitting
them to Azure. Azure analyzes every PDF page because the current client does not
send a page range.

## Excluded populations

These records should not be submitted merely because they are unresolved:

| Population | Records | Reason excluded |
| --- | ---: | --- |
| Identical 42-byte GIF artifacts | 1,530 | Corrupt placeholders already rejected by Azure. |
| Zero-byte PDFs | 32 | No content to analyze. |
| PDFs and images with prior unusable OCR | 26 | Azure already returned no usable text. |
| Structurally invalid PDFs | 20 | Page metadata cannot be read. |
| Previously exhausted low-text PDFs | 38 | A repeat charge is not justified without new evidence. |
| Processing-transient PDFs | 3 | Persistence failures, not OCR failures. |
| Oversized records without retained artifacts | 481 | Size alone does not establish OCR need. |
| Source-unavailable records | 196,306 | Acquisition problem, not OCR work. |
| Unsupported Word and RTF formats | 58,404 | Format remediation, not OCR work. |

## Price calculation

The current standard-commercial S0 Read meter is:

- first 1,000,000 pages in a billing month: $1.50 per 1,000 pages; and
- pages over 1,000,000 in the same month: $0.60 per 1,000 pages.

For `P` pages:

`cost(P) = 1.50 * min(P, 1,000,000) / 1,000 + 0.60 * max(P - 1,000,000, 0) / 1,000`

The candidate cohort remains in the first tier:

`1,485 / 1,000 * $1.50 = $2.2275`

The estimate excludes compute, storage, transfer, and embedding charges. It
also excludes retry charges; the backfill controller must not resubmit a content
hash whose OCR result is already durable.

Authoritative references:

- [Azure Document Intelligence service limits and billing](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)
- [Azure Document Intelligence pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)

## Recommended approval gate

Before starting the historical run, approve or revise this exact boundary:

- candidate documents: 319;
- maximum submitted pages: 1,485;
- expected OCR charge: $2.2275 at the verified meter;
- suggested hard spend ceiling: $3.00 to cover price rounding without allowing
  scope expansion; and
- no automatic addition of newly classified records to this historical wave.

The production worker should process these IDs in bounded batches, skip any
content hash that has become complete, persist actual pages after every batch,
and stop when the approved document, page, or spend ceiling is reached.
