# Supporting-material processing

Committee reports, hearing and meeting documents, fiscal notes, analyses, testimony, and other supporting materials use
the same durable processing model as official bill versions. The source record remains independently queryable while its
downloaded artifact, extracted text, and searchable sections are retained separately.

## Processing contract

- `materials:process` selects pending or failed records in deterministic ID order and supports jurisdiction and material
  targeting.
- Downloads are stored in the configured document artifact container under content-addressed paths. A retained artifact
  is reused unless `--force` is supplied.
- Text extraction and legal-section fallback segmentation are shared with bill documents. Reprocessing replaces sections
  atomically and skips unchanged content by hash.
- Unsupported and image-only inputs become terminal `unsupported` records; retryable acquisition and extraction errors
  remain `failed`.
- Supporting-material sections have generated English lexical-search vectors and 1,536-dimensional embeddings. The
  standard `embeddings:run` job refreshes missing or stale material-section embeddings alongside bills and bill passages.

`search_supporting_materials` searches both titles and extracted section text. `get_supporting_material` returns the
material, its canonical links, and paginated sections with explicit truncation metadata.

## Current validation status

Migration 0016 creates the section index and its lexical-search trigger. Fresh-schema integration exercises acquisition,
artifact retention, extraction, sectioning, embedding idempotency, lexical retrieval, and paginated detail retrieval. A
Railway development smoke processed a real retained amendment material successfully under ingestion run
`bc52e886-856c-437d-ba31-f31458804c01`.

The first live OpenRouter material-embedding attempt reached the configured provider but returned an HTML response instead
of the API JSON contract. The pipeline remains covered with the pinned 1,536-dimensional test client; provider recovery is
tracked with the broader MVP embedding completion work rather than changing the material-processing contract.
