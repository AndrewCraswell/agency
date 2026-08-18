# Document failure remediation

## Purpose

Repair each observed document failure class independently before resuming the full development bootstrap. Aggregate
`processed`, `failed`, and `unsupported` counts are not sufficient evidence: a record is successful only when its stored
artifact and extracted text represent the legislative document rather than a publisher download page or site chrome.

OCR is deliberately deferred. Documents whose source host is no longer available remain catalogued but are marked not
accessible instead of being retried forever or fetched from a new, unapproved provider.

## Observed baseline

The 2026-08-18 development snapshot contained 414,282 records marked processed, 156,855 unsupported, and 58,897
failed. The main known classes were:

| Failure class | Observed impact | Required disposition |
| --- | ---: | --- |
| California JavaServer Faces PDF intermediary | 122,576 unsupported artifacts and at least 142,353 false successes | Fix resolver, invalidate false successes, then reprocess |
| Transient fetch failures | 42,946 classified plus legacy unclassified failures | Bounded retry after reason and host health are known |
| Alaska bare `pdf` content type | 22,634 valid PDF artifacts classified unsupported | Normalize by verified PDF signature, then reprocess |
| Image-only PDF or raster document | At least 5,380 records in the observed errors | Mark `ocr-required`; defer OCR |
| Retired or unavailable source host | Concentrated in legacy Alabama hosts, with other hosts possible | Mark `source-inaccessible`; do not retry continuously |
| Non-HTTPS source URL | 4,375 observed records | Use provider-supplied HTTPS URL when available; otherwise mark inaccessible |
| Unsupported GIF and office formats | GIF was the largest observed non-PDF group; office formats were lower volume | Track by exact format and prioritize by volume |
| Corrupt or truncated PDF | Mixed into the former malformed-document bucket | Re-download once when eligible, then retain terminal malformed reason |
| Processing exception after valid acquisition | 39 classified processing-transient records in the snapshot | Retry extraction from the stored artifact, then terminally classify deterministic parser failures |
| Legacy unclassified result | 15,914 failed and 50,685 unsupported rows | Classify deterministically before any retry |

Counts are a diagnostic snapshot, not completion evidence. The report must be regenerated after each bounded repair.

## Remediation progress

As of 2026-08-18, commit `bb23ce8` and development image
`sha256:b93cc7d1c0e09adcdd1735577e09ece836ea0422ec822160c8eb7ba124a0f21f` provide the corrected acquisition and
classification behavior. Live development evidence currently includes:

- California canaries: two current artifacts produced searchable PDFs and one publisher-missing historical artifact
  reached terminal `not-found`.
- Alaska canaries: the non-standard `pdf` label was accepted by artifact signature; three sampled image-only PDFs moved
  to `ocr-required`.
- 6,953 existing image-only or raster records moved to `ocr-required`.
- 13,346 records on the verified retired Alabama host moved to `source-inaccessible`.
- 46,525 legacy failed or unsupported rows received structured failure classifications.
- A repeat legacy-classification audit returned zero unclassified candidates.
- 262,075 California false-success or malformed intermediary records and 25,184 Alaska label records were prepared for
  corrected reprocessing.

Full California and Alaska reprocessing, the post-remediation report, and embeddings remain open. These counts are
progress evidence and do not satisfy the final corpus gate by themselves.

Sixteen non-overlapping development document shards were started on 2026-08-18 against the immutable remediation
image. D3.12 and D3.13 remain open until those shards finish and a database audit confirms terminal outcomes.

The 4,375 Arkansas FTP records were normalized to the legislature's official HTTPS download route. A live canary then
stored an `application/pdf` artifact and extracted 16,256 characters of searchable text, leaving no failure category.
The remaining unsafe-URL count is zero.

Bounded DOCX, PPTX, and XLSX extraction is deployed with archive-entry and expanded-size limits. Live canaries stored
artifacts and extracted 2,197, 1,770, and 75,870 searchable characters respectively. D3.20 remains open until the full
Office Open XML cohort finishes; legacy binary office and mail formats remain explicitly terminal.

All 39 records in the former `processing-transient` cohort were audited after the stored-artifact retry path was added.
The repeated failures were deterministic corrupt archive/root-reference errors, not transient worker failures, and are
now terminal `malformed-document`. The live `processing-transient` count is zero. This closes that failure class without
creating an unbounded retry loop; a later upstream document change can still make the record eligible again.

The Office Open XML replay exposed three additional invalid ZIP artifacts. They were also terminally classified as
`malformed-document`, bringing the audited deterministic parser-failure total to 42 while preserving a zero
`processing-transient` backlog.

## Required result contract

Every non-successful document has one actionable disposition:

- `retry-download`: a bounded transient network or upstream-service failure.
- `retry-processing`: a valid stored artifact whose extractor failed transiently.
- `malformed-document`: retrieved bytes are corrupt, truncated, or not the represented document.
- `not-found`: the source returned a stable 404 or 410 for this artifact.
- `source-inaccessible`: the recorded host or permitted URL cannot currently be accessed.
- `ocr-required`: the artifact is valid but requires OCR, which is deferred.
- `unsupported-format`: the artifact is valid but no approved extractor exists for its format.
- `oversized`: the artifact exceeds the configured safe processing limit.
- `unsafe-url`: the URL fails the acquisition security policy and no approved provider URL replaces it.

The disposition records the normalized reason, source host, attempt time, and bounded retry eligibility. This is
operational state, not a provenance system.

## Work queue and acceptance criteria

### California PDF acquisition

- Capture the browser download request generated by the publisher's JavaScript form and implement the minimum
  deterministic HTTP exchange required to retrieve the PDF.
- Require PDF signature and structure checks before assigning a PDF content type.
- Reject publisher chrome, including the known `Download Bill PDF` false-success text.
- Canary multiple sessions and bill versions before reprocessing the affected California rows.
- Reprocess the known false successes as well as failed and unsupported California `billPdf` rows.

Complete when sampled stored blobs are real PDFs, extracted text matches the official bill, no publisher chrome passes
the quality gate, and the reprocessing report accounts for every targeted row.

### Content-type normalization

- Treat source metadata as a hint, not proof of format.
- Recognize non-standard labels such as `pdf` only when PDF magic and structure checks pass.
- Reprocess the Alaska cohort after a mixed text-bearing and image-only canary.

Complete when valid text-bearing PDFs process successfully and image-only PDFs move to `ocr-required`.

### Transient acquisition failures

- Separate timeout, DNS, connection reset, rate-limit, and upstream 5xx outcomes.
- Retry with bounded attempts and backoff while preserving host-fair scheduling and circuit breaking.
- Do not translate every DNS failure into a transient result: a repeatedly unresolvable retired host becomes
  `source-inaccessible`.

Complete when each retryable failure has a next-attempt time, terminal failures stop retrying, and a host outage cannot
consume the worker pool.

### Inaccessible sources and URLs

- Add `source-inaccessible` as a terminal, reportable category.
- Verify host unavailability before applying it in bulk, then record the source URL and last access result.
- If the approved provider later changes the document URL, that source update makes the record eligible again.
- Keep SSRF and HTTPS restrictions intact. Do not introduce a publisher-specific fallback feed.

Complete when retired-host and unusable-URL records are visible in coverage reports but absent from the retry queue.

### OCR-required documents

- Identify image-only PDFs and raster-image artifacts without treating them as corrupt.
- Mark them `ocr-required` and retain the valid source artifact.
- Exclude them from ordinary extraction retry counts and worker scheduling.

OCR selection, implementation, accuracy evaluation, and reprocessing are deferred until the text-bearing corpus is
stable.

### Unsupported formats

- Report exact MIME type, extension, source, jurisdiction, and count.
- Prioritize format support by corpus value and volume.
- Add converters independently with size, timeout, and sandbox limits; do not add a broad conversion stack solely for a
  small bootstrap tail.

Complete for a format when fixtures, extraction quality checks, a bounded canary, and targeted reprocessing all pass.

### Malformed, missing, oversized, and processing failures

- Separate a publisher HTML/XML intermediary from a structurally invalid PDF.
- Re-download a malformed artifact only when its attempt policy permits; otherwise keep it terminal.
- Treat 404 and 410 as `not-found`, oversized artifacts as `oversized`, and valid-artifact parser exceptions as
  `retry-processing`.
- Reuse the stored artifact for processing retries and never hold a lease indefinitely.

Complete when each class has a deterministic terminal or retry policy and tests prove it cannot loop indefinitely.

### Legacy rows and final verification

- Classify legacy rows from their stored error, URL, host, content type, and artifact signature.
- Never bulk-requeue the entire failed or unsupported population.
- Run a small representative canary for each repaired class before increasing concurrency.
- Publish counts by jurisdiction, host, format, normalized failure reason, and final disposition.
- Manually compare a documented sample of extracted text with official documents before closing M7.32.

The remediation is complete when every targeted row is processed or has an explicit terminal disposition, retry queues
contain only eligible work, quality reports contain no known publisher-page false successes, and embeddings can resume
against a terminal document corpus.
