# Document OCR

The document pipeline uses Azure Document Intelligence's prebuilt Read model
when a downloaded file has pages but the normal extractor cannot recover
usable text. OCR is a continuation of document processing, not a separate
document source.

## Detection and handoff

The ordinary bill-document or supporting-material worker downloads and retains
the source file first. If PDF.js reports an image-only PDF, or the retained
artifact is a supported image type, the row is classified as `unsupported`
with the `ocr-required` category. The calling Trigger task immediately submits
those document or material IDs to `ocr-document-worker` in batches of at most
100. A material continuation may find more than 100 image-only inputs, so it
submits multiple independently idempotent batches rather than truncating the
handoff.

This same handoff is used by normal synchronization, targeted reprocessing,
and future full archive replays. There is no permanent OCR polling schedule.
The database status is the durable recovery record if a Trigger invocation is
interrupted.

If the saved source artifact is missing, OCR cannot repair it by retrying the
recognition service. A typed local `ENOENT` or Azure Blob `BlobNotFound` result
returns the existing row to ordinary document processing: the stale Blob path,
content hash, extracted text, and OCR attempt state are cleared, while the
document ID, bill ID, and `source_url` remain unchanged. The document worker
then downloads the source again, stores a new artifact, and performs the same
direct OCR handoff.

## Persistence and identity

Azure returns recognized text and page metadata. The OCR worker updates the
existing `bill_documents` or `supporting_materials` row in place and replaces
its corresponding sections:

- `processing_status` becomes `processed`;
- recognized text is stored on the document and divided into sections;
- `processing_error`, `processing_error_category`, and `next_attempt_at` are
  cleared;
- the original document or material ID, canonical links, `source_url`, Blob
  path, content type, and source-byte content hash are preserved.

An OCR result therefore never creates a second source record. Embeddings of
the resulting sections retain `document_id` or `material_id`, which maps back
to the canonical bill, event, amendment, organization links, and original Blob
artifact.

## Historical backlog

The temporary `ocr-historical-backfill` controller drained the one-time corpus
created before automatic handoff existed. Its final twelve-shard sweep ran after
the last retry window opened on August 21. All 38 remaining low-text rows
reached attempt ten and became terminal `malformed-document`; no eligible,
deferred, processing, interrupted, or unowned bill-document OCR row remained.
The temporary controller was then removed. The reusable
`ocr-document-worker` remains the only OCR task and is invoked directly by
document and supporting-material workers. Any future accumulation of unowned
`ocr-required` rows is an operational leak to investigate, not work for a
permanent polling sweep.

The first production estimate found 31,994 OCR-required documents. A random
98-document sample averaged 3.79 pages, projecting roughly 121,000 pages. At
the observed Azure Read list price of about $1.50 per 1,000 pages, the initial
service charge is approximately $182. Actual billing is measured during the
bounded rollout.

## Operations

Azure authentication uses Microsoft Entra ID and the `Cognitive Services User`
role. Local API keys are disabled. The Trigger environment requires
`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` plus the existing Azure service
principal variables. The worker queue is capped at twelve concurrent runs and
each run performs one OCR request at a time. Azure currently permits fifteen
analysis submissions per second, leaving three requests per second of margin.

Retry HTTP 408, 429, and 5xx responses at most five times. OCR retries use
short delays of 15 seconds, 30 seconds, 60 seconds, and 120 seconds. A provider
`Retry-After` value is honored but capped at five minutes, so an OCR row never
waits for hours. Invalid files and completed analyses with no usable or too
little usable text are terminal on the first such result and are not retried.
Interrupted `processing` rows are reclaimed only after the worker's full
one-hour duration plus a ten-minute safety margin.

Production has verified all permanent paths: direct handoff from ordinary bill
documents, direct handoff from supporting materials, URL-remediation followed
by OCR, missing-Blob rerouting through ordinary download, and owner-scoped
recovery after an OOM. The detailed evidence and the retired historical sweep
are recorded under DRV-007 through DRV-010 in the
[ingestion remediation catalog](ingestion-remediation-catalog.md#derived-processing-and-orchestration-failures).
