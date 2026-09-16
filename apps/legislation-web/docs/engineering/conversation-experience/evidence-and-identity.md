# Evidence and identity

Status: proposed. Foundation for [composition](answer-composition.md) and [rendering](generative-ui-rendering.md)
within the active conversation.

## Problem

Search and detail calls can return the same entity as separate result sets. Evidence previously received fresh IDs per
tool call, so response-level deduplication by ID did not consolidate repeated sources. Entity cards, citations, and
retrieval activity represent different things and must not be merged indiscriminately.

## Contract

- Entity identity: canonical record type plus canonical record ID. Preserve selected version identity for versioned records.
- Evidence identity: source/document identity, explicit version or observation, passage locator, and exact content hash.
  A source URL alone is insufficient: different sections or revisions can share it.
- Retrieval occurrence: the tool call, query, retrieval timestamp, and coverage/availability state that produced evidence.
  Multiple occurrences may reference the same evidence snapshot without duplicating it in the answer.
- Presentation identity: a stable block ID, separate from both record identity and tool-call ID.
- Keep source snapshots immutable. A changed passage creates a new evidence identity; never rewrite earlier citations.

The server-owned registry resolves model-selected record/evidence references. Validate that each reference belongs to
the authorized run or conversation. Browser snapshots, model-generated labels, and opaque IDs are not proof of access
or truth. Recheck authorization when resolving evidence; redaction or revoked access must be represented explicitly.

## Citation UX decisions

Confirmed September 16, 2026:

- Keep the badge preview simple: a tooltip containing only the resolved external source URL, on hover and keyboard focus.
  Use the same URL for the evidence panel's external action. Badge activation still opens the evidence panel; no rich
  preview or interactive tooltip is required. If no safe URL exists, do not invent a link.
- Separate the original provenance URL from a verified readable-source URL. Prefer readable publisher HTML or PDF
  for the cited version; a readable record-information page can support metadata claims. Preserve the underlying
  evidence identity and exact passage even when the readable rendition uses a different URL.
- Readable sources are the expected path. If none can be resolved, keep citation inspection working and fall back to
  the original safe provenance URL, including XML/API data when necessary. Never rewrite extensions blindly, substitute
  another version, or label raw data as a PDF. If neither URL is available, show the unavailable state.
- Log readable-source fallback server-side with a structured reason, evidence/document ID, run correlation, and safe
  source host/format. Deduplicate per evidence per run; do not log on every hover or rerender. Track fallback frequency
  so missing renditions are repaired rather than normalized as expected behavior. Keep credentials, signed URL queries,
  full source text, and user questions out of these events; do not add a new grading pipeline.
- Assign citation numbers in first-citation order within the answer, keyed by stable evidence identity. Repeated use
  retains the same number. Badges, the evidence-panel heading, and source-list rows share that mapping and do not
  renumber as more text streams in. The model supplies evidence references, not authoritative display numbers.
- The sources list contains only evidence cited in the answer, ordered by citation number. Do not expose unused
  retrievals as another list or a collection of cards, including inside Research activity. Keep their provenance in
  existing diagnostic traces. Concise research progress, meaningful failures, and coverage warnings remain separate.

## Implementation tasks

- [ ] Locate the canonical record and citation projections after the workspace split; reuse them instead of duplicating data models.
- [ ] Consolidate repeated entity retrievals without replacing version-specific historical evidence.
- [ ] Assign stable evidence IDs and retain the mapping from every claim citation to its supporting snapshot.
- [ ] Separate inline record navigation from citation inspection: record overview versus supporting source passage.
- [ ] Connect badges, the panel, and cited-source rows to one stable answer-local numbering map.
- [ ] Add URL-only tooltips and resolve a verified readable rendition without losing provenance or version identity.
- [ ] Implement safe provenance fallback and deduplicated structured logging when the readable source is missing.
- [ ] Show only cited evidence in the sources list; keep unused retrievals in diagnostics, not the customer-facing UX.
- [ ] Enrich an existing displayed entity with compatible additional metadata without creating another automatic card.
- [ ] Preserve unavailable, not-collected, failed, and incomplete-coverage states. Do not imply snippets prove full provisions.

## Acceptance

- Searching and then reading the same bill does not create duplicate source entries for identical evidence.
- Two different sections or versions at one URL remain independently inspectable.
- Unknown, foreign-session, unauthorized, and fabricated evidence references never become active citations.
- A displayed claim opens the exact cited passage and version, not merely the latest bill page.
- Deduplication does not discard retrieval provenance or merge contradictory historical observations.
- Hovering or focusing a badge shows the same URL used by the panel's external link; the panel remains usable on touch.
- Every citation number matches its source row and panel heading, including repeated citations and streamed additions.
- A known readable rendition is selected for the correct version. Missing renditions use a safe fallback and emit one
  diagnostic event per evidence per run; no safe destination leaves the external action unavailable.
- Unused returned evidence creates no source rows or cards. An answer without citations has no empty sources accordion.

## Decisions to close

Reuse run/conversation-scoped evidence handling and define its bounds and expiry behavior without adding durable storage.
Define identity using the actual canonical schema; examples here are semantic requirements, not invented database IDs.