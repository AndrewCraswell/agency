# Milestone 7: Legislative document processing

## Goal

Turn source-independent bill documents into normalized, versioned, searchable legal text.

## Tasks

### Processing state and acquisition

- [ ] **M7.1** Define document processing states, failure categories, attempt counts, and retry eligibility.
- [ ] **M7.2** Define the content-hash contract for source artifacts and normalized text.
- [ ] **M7.3** Select the preferred source representation in the order XML, HTML, plain text, then PDF.
- [ ] **M7.4** Implement secure document download with size limits, content-type validation, timeouts, and redirects.
- [ ] **M7.5** Store source artifacts in Blob Storage using deterministic paths.
- [ ] **M7.6** Reuse an unchanged stored artifact rather than downloading it again.
- [ ] **M7.7** Prevent one oversized or malformed artifact from exhausting worker resources.

### Extraction

- [ ] **M7.8** Implement XML text extraction while preserving headings and structural identifiers.
- [ ] **M7.9** Implement HTML extraction that excludes navigation, scripts, and repeated site chrome.
- [ ] **M7.10** Implement plain-text decoding with charset detection and newline normalization.
- [ ] **M7.11** Implement PDF text extraction for text-bearing PDFs.
- [ ] **M7.12** Detect image-only or unusable PDFs and report them as unsupported rather than silently producing empty text.
- [ ] **M7.13** Normalize Unicode, whitespace, page artifacts, and line wrapping without altering legal meaning.
- [ ] **M7.14** Retain the raw extracted text separately from derived sections when useful for diagnosis.

### Legal-aware segmentation

- [ ] **M7.15** Define a normalized section contract with ordinal, identifier, heading, text, and source offsets.
- [ ] **M7.16** Recognize common federal section and subsection patterns.
- [ ] **M7.17** Recognize representative state section patterns from the fixture corpus.
- [ ] **M7.18** Preserve definitions, amendments, effective-date provisions, and repealers as identifiable sections.
- [ ] **M7.19** Use deterministic fallback chunking when legal structure cannot be recovered.
- [ ] **M7.20** Ensure fallback chunks overlap enough for retrieval without duplicating entire passages.
- [ ] **M7.21** Keep stable section ordering and identifiers across unchanged reprocessing.

### Versioning and persistence

- [ ] **M7.22** Process every bill version independently without overwriting earlier text.
- [ ] **M7.23** Retain supplemental documents even when they are not bill versions.
- [ ] **M7.24** Replace derived sections atomically only after a full new processing result succeeds.
- [ ] **M7.25** Mark changed searchable content for embedding refresh.
- [ ] **M7.26** Skip acquisition, extraction, segmentation, and embedding invalidation when hashes are unchanged.
- [ ] **M7.27** Add a targeted reprocess command by document, bill, jurisdiction, and failed status.

### Validation

- [ ] **M7.28** Create a representative format matrix across state and federal documents.
- [ ] **M7.29** Add golden tests for normalized text and section boundaries.
- [ ] **M7.30** Test repeated processing, changed content, failed replacement, and targeted retry.
- [ ] **M7.31** Measure empty-text, low-text, extraction-failure, and fallback-segmentation rates.
- [ ] **M7.32** Manually review a documented sample of extracted sections against official documents.

## Exit criteria

- Representative XML, HTML, text, and text-bearing PDF documents produce accurate normalized text.
- Bill versions and supplemental documents remain distinct.
- Sections are legally sensible when structure exists and deterministic when it does not.
- Unchanged documents are not downloaded, parsed, sectioned, or re-embedded again.

