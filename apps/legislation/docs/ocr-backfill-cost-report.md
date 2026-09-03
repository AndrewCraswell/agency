# OCR historical backfill report

## Outcome

The approved historical OCR cohort completed in production on 2026-09-03.
All 319 retained PDFs were processed by Azure Document Intelligence, producing
1,485 billed page units, 1,233 nonempty document sections, and 1,233 current
section embeddings.

| Result | Value |
| --- | ---: |
| Documents selected | 319 |
| Documents OCR-processed | 319 |
| Terminal failures | 0 |
| Provider pages persisted | 1,485 |
| Nonempty sections | 1,233 |
| Current section embeddings | 1,233 |
| Missing or stale embeddings | 0 |
| Base OCR charge at the verified meter | $2.2275 |

One four-page document needed a second application attempt after the first
Azure operation timed out. If Azure billed both submissions, the OCR total is
at most $2.2335. Azure billing data, rather than the application estimate, is
authoritative for the final invoice.

OpenRouter embedding charges are excluded because they use a separate provider
account with its own spending limit. No daily OCR spend limit is required for
normal ingestion; the measured daily volume is expected to be negligible
relative to this one-time backfill.

## Production evidence

The implementation was committed as `8d1a6f0` and deployed as:

- Trigger version `20260903.2`; and
- Railway deployment `beb4920f-470a-423d-8fef-0e5a87062fa4`.

Production health and readiness both returned HTTP 200 before the backfill was
prepared. The exact cohort was selected by all of these conditions:

- processing status `unsupported`;
- processing error category `malformed-document`;
- exact error `Bad uncompressed block length in flate stream`;
- content type `application/pdf`;
- retained Blob path present;
- content hash absent; and
- no previous OCR provider, completion time, or page count.

Before mutation, the sorted 319 document IDs and 319 unique Blob paths were
saved to an operator manifest. Its canonical digest is:

`SHA-256(UTF-8(sorted IDs joined by LF, without a trailing LF)) = c5ef120c1bc53fda6c1fa52a660a68918ab50a26b69390f99f8b2a4b171b944c`

Preparation job `7dee3c28-9096-4803-ad38-bbc2e283a543` changed exactly 319
records to OCR pending while preserving their retained artifacts.

The first 25-document production batch, Trigger run
`run_06g6dvve2b3c35fbrge07asr01`, was held as the execution canary. It
completed 25 documents and 95 pages, produced nonempty text, and handed all 65
generated sections to current embeddings before the remaining batches were
released.

The remaining runs were:

- `run_06g6e30ljng203s4dbilkr1q01`
- `run_06g6e30m6ikm1gt3vfjfrud601`
- `run_06g6e30movte9engksnkgcvd01`
- `run_06g6e30nbbi55osc62agol8n01`
- `run_06g6e3lbfcj2bvt1rpk06guj01`
- `run_06g6e3lc3f2mdr751fbnosto01`
- `run_06g6e3lcmighqlo0k3l15csd01`
- `run_06g6e3ldac0rbfpffespk6nj01`
- `run_06g6e46g6hb6gg0quup1rofs01`
- `run_06g6e46gokur919ej9uj5cd701`
- `run_06g6e46hb0u7ail1nmkugf3b01`
- `run_06g6e46hsuen421arquh3v4701`

They ran in groups of at most four concurrent workers. Every run completed on
Trigger version `20260903.2`; all 319 saved IDs ended with provider
`azure-document-intelligence`, a completion time, a positive page count,
nonempty text, at least one section, and a current 1,536-dimension embedding for
every section. Recomputing every section embedding input hash found zero stale
rows.

The canary's one timeout was retried within the same run. Document
`bill:nh:2024:hb:1046:document:096f9c32e33d9aed51401c91` succeeded on its
second attempt with four pages. The other 318 documents required one attempt.

## Historical inventory

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

The retained artifacts totaled 39,270,487 bytes. Documents ranged from 2 to 85
pages, with a median of 4 pages and an average of 4.66 pages.

## Excluded populations

These unresolved records were not submitted because their evidence does not
justify OCR:

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

The verified standard-commercial S0 Read meter for West US 2 is $1.50 per
1,000 pages for the first 1,000,000 pages in a billing month and $0.60 per 1,000
pages above that tier.

`1,485 / 1,000 * $1.50 = $2.2275`

Authoritative references:

- [Azure Document Intelligence service limits and billing](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)
- [Azure Document Intelligence pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)

## Known limitation

The OCR text, sections, and embeddings are complete and searchable, but the
1,233 generated sections currently have null page-range metadata. Do not make
page-specific API claims from this cohort until provider page spans are mapped
and verified. Correcting page ranges is a separate fidelity improvement and
does not require repeating the OCR backfill unless the provider response must
be regenerated.
