# Regulatory data and version contract

Implementation specification, September 14, 2026. Proposed tables and fields, not existing schema.
Parent: [implementation plan](implementation.md). Applies to direct federal and later licensed state ingestion.

## Identity and source boundaries

Use existing canonical jurisdiction IDs and organization identities where an agency match is established. Preserve the
publisher's agency identifier/name separately when a match is unresolved. Do not create a legislative committee to
represent an agency, or a bill/session to store a regulation. A code section, publication and regulatory action have
different identities. One publication can amend many sections; many publications can belong to one action.

Public IDs are opaque, stable, at most 256 characters, with one canonical retrieval route. Allocate IDs from natural-key
uniqueness constraints, not from titles, mutable text, vendor IDs alone or the current edition date. SHA-256 hashes
identify artifact bytes, parser inputs and normalized content; they are not substitutes for a stable provision ID.

Source adapters emit a discriminated envelope: `codeEdition`, `provision`, `publication`, `publicationRevision`,
`relationship`, `event`, `removalObservation`, or `coverageObservation`. Every envelope includes `sourceId`,
`jurisdictionId`, native identity, acquisition-unit ID, source URLs, source timestamps with precision, artifact hash,
parser revision, schema revision and rights-profile ID. Reject unknown variants and invalid parent references into
quarantine. Keep provider-specific metadata in a validated extension object; core queries use normalized columns.

## Canonical records

Add to `src/db/schema/schema.ts` using the repository's normal schema/migration workflow. Table names below are proposed.
Do not renumber or rewrite existing deployed migrations. Place the new feature's initial schema in its initial migration;
do not produce a chain of compatibility patches for an unshipped design.

| Table | Key and required content |
| --- | --- |
| `legal_sources` | ID; adapter/provider; publisher; permitted hosts; source authority; credential reference name; rights profile; enabled corpora |
| `legal_codes` | Unique jurisdiction + canonical code key; name; `statute` or `regulation`; citation scheme; original language; preferred source policy |
| `legal_editions` | Code, source and native edition key + source revision; publisher edition/issue date; currency date; observation time; completeness manifest; generation; state |
| `legal_provisions` | Code + source-independent structural identity; display citation; hierarchy/node kind; aliases; stable ID |
| `legal_provision_versions` | Provision + normalized content hash + parser/input contract; complete text; structured blocks; text status; original language |
| `legal_edition_provisions` | Unique edition + provision; version; parent node; sibling order; section/appendix/table locator; publisher status and date assertions |
| `regulatory_actions` | Jurisdiction; action ID; agency aliases; native grouping evidence; title; derived stage with provenance |
| `regulatory_documents` | Stable publication ID; native document number and source aliases; publication kind; jurisdiction; agency references |
| `regulatory_document_versions` | Document + source revision/artifact hash + parser revision; title/body/structured blocks; publisher metadata; parse completeness |
| `regulatory_document_actions` | Document/action links with evidence; allow many-to-many, not a required singleton parent |
| `legal_artifacts` | Source URL; configured Azure container/key; SHA-256; format; byte count; ETag/Last-Modified; fetched time; validation/extraction status |
| `legal_source_observations` | Artifact/version/edition mapping; native source ID; observedAt; sourceModifiedAt; source currency; acquisition lineage |
| `legal_passages` | Exactly one provision-version or document-version owner; ordinal; text/hash; heading context; source locator; chunk contract |
| `legal_passage_embeddings` | Passage + model + dimensions + input contract + input hash; vector; generation; token/cost metrics; completion time |
| `legal_relationships` | Typed source/target identities or unresolved citations; evidence locator; relationship type; confidence basis |
| `legal_events` | Stable source event key; entity/version; event kind; date/time/precision; discovery time; historical flag; evidence |
| `legal_deadlines` | Event/document version; deadline type; publisher value/text; timezone/precision; supersession link; evidence locator |

Raw source identity aliases use a unique `(sourceId, corpus, jurisdictionId, nativeId)` mapping and reference a canonical
record through an explicit entity-kind discriminator. Source IDs may be reused across corpora, so the namespace matters.
Never merge Vaquill and direct records solely because text hashes match. Resolve source aliases against canonical
citation/structural identity and quarantine collisions; retain both observations when the same text is independently supplied.

Store XML hierarchy as nodes, including heading-only, reserved, appendix and table nodes. Heading-only nodes are
browseable but not embedding candidates. Keep parent references edition-scoped: a provision may move between chapters
without becoming a new provision. Renumbering creates explicit predecessor/successor evidence rather than silently
reusing an old citation for a different provision. Reused citations require a new canonical identity when the publisher
establishes a different provision; retain dated aliases for resolution.

## Temporal semantics

Keep these distinct: publisher issue date, source currency date, source modification time, collection time, commit time,
searchable time, publication date, adoption date and legal effective date. Dates without times remain dates; do not invent
midnight UTC timestamps for legal deadlines. Preserve the original date wording and explicit source timezone when supplied.

An eCFR issue date is a publisher version selector; `up_to_date_as_of` can advance without a new text issue. The live
[title inventory](https://www.ecfr.gov/api/versioner/v1/titles.json) exposes these as separate fields and identifies
reserved titles. Preserve the title-level currency; a database assembled from multiple title dates is not a single
uniformly current edition. Annual CFR volumes also have title-specific revision dates.

`latest` means the latest validated publisher edition selected by policy. It does not mean legally enforceable now.
Return `legalStatus: unknown` unless a scoped publisher assertion supports a narrower status. A final rule may not yet
be effective, and a later stay may exist outside our coverage. A source's missing record is not proof of repeal.

Version lookup supports exactly one of: `versionId`, `editionId`, or `asOf`; omission selects latest validated.
`asOf` is a publisher-date lookup only where the declared coverage supports it. Return `basis` as
`publisher_point_in_time`, `published_edition`, or `observed_snapshot`, with actual selected date and source currency.
Never silently choose the closest earlier annual edition for an arbitrary date. Return `409 conflict` with
`reason: historical_coverage_unavailable` and available edition bounds when the entity exists but that date is unsupported.
For observations-only state feeds, dated snapshots are selectable by edition ID; arbitrary `asOf` remains unsupported.

One unchanged text version can appear in multiple editions. Preserve each edition membership and provenance without
re-embedding identical input. A correction to a previously published edition creates a new source revision/observation;
retain the superseded revision for citations and expose which revision is currently preferred. ObservedAt permits an
audit of what Tabra knew at a time; the initial API does not promise full bitemporal legal reconstruction.

## Publication and relationship semantics

Federal Register document number is the publication natural key; corrections published under a new number remain
separate linked documents. A replacement rendition under the same number creates a new document version. Metadata-only
changes create observations/events without inventing text changes. GovInfo package/granule IDs and FederalRegister.gov
IDs remain aliases and are reconciled with the document number.

Publication kinds initially include `proposed_rule`, `final_rule`, `notice` and `other`; preserve native type/action text.
An emergency rule is a separate native classification/flag where supplied, not a synonym for every final rule. Store
amendatory instructions alongside preamble text; do not treat them as a consolidated replacement code section.

Relationship kinds: `cites`, `authority`, `amends`, `corrects`, `supersedes`, `implements_enacted_law`, `related_action`.
Evidence basis is `publisher_link`, `parsed_citation`, or `reviewed_match`. Semantic suggestions remain unpromoted
candidates. Store RINs and docket IDs as namespaced aliases, not globally unique action IDs. A shared RIN permits a
candidate grouping but does not by itself justify merging distinct proceedings. Unresolved U.S. Code/Public Law
citations are valid references even before the associated statutory corpus arrives.

## Acquisition and generation records

Reuse existing ingestion-run/checkpoint/lease mechanisms where compatible; add regulatory-specific contracts rather
than another scheduler. Required logical records are:

- Manifest: scope, source, cutoff, inclusive history bounds, selected kinds, adapter/parser revisions, expected units,
  excluded units with reasons, rights profile, configuration hash and parent import ID.
- Unit: immutable natural key + desired source revision; stage; dispatch generation; attempts; lease token/expiry;
  retryAt; artifact/checkpoint pointers; counts; errors; start/finish time.
- Unit page/chunk progress: source cursor, persisted work IDs, input hash and parser shard boundary.
- Outbox: unique aggregate + target generation + operation; target `lexical`, `embedding`, or `event`; retry state and
  acknowledgement. Persist with the canonical transaction; do not perform network dispatch inside that transaction.
- Coverage: per jurisdiction/code/corpus/time range and stage, denominator origin, expected/acquired/parsed/published/
  indexed/embedded counts, source currency, pending age, exclusions and unresolved gaps.

Unit state: `planned -> dispatched -> running -> acquired -> parsed -> validated -> published`; retryable failures
carry a retry stage and resume pointer, while `quarantined`, `excluded` and `cancelled` are explicit terminal dispositions.
Publishing the data and completing derived search work are independent. Manifest status cannot say searchable until
the requested lexical and embedding generations have passed their own gates. `excluded` is never counted as successful
acquisition; report both available scope and total requested scope.

## Transactions and publication

1. Acquire source data into immutable artifact storage. Parse into generation-scoped staging rows in bounded commits.
2. Compare staging against the authoritative source unit: XML counts/hierarchy, all requested volumes/parts, distinct
   native IDs and required renditions. A failed child blocks the containing edition's promotion.
3. Materialize immutable versions and edition membership before changing the edition pointer. Use `INSERT ... ON
   CONFLICT` under unique constraints; repeated work converges to the same identity. Avoid one title-sized transaction.
4. In a short transaction, compare-and-swap the expected current generation, publish the validated generation, and
   write outbox work. A slower old backfill cannot replace a newer publisher version; same-date corrections require
   source revision precedence, not worker completion order.
5. Search workers build a generation then mark it ready. Until ready, keep the previous searchable generation with
   explicit freshness fields. A first-ever unindexed edition has no searchable claim. Detail can expose newer validated
   text while search reports its older generation; exact version citations never silently move.
6. Removed items are absent only in the new fully validated edition membership. Preserve earlier text and its citations.
   Withdrawals from a license are governed separately by rights policy, never treated as legal repeal.

Lease renewal and fencing: workers check their token before every publish/checkpoint transaction. An expired/replaced
lease may finish an immutable artifact write but cannot advance source state. No external HTTP/model request is made
inside a database transaction. Crash after outbox insertion and before Trigger dispatch must remain recoverable.

## Indexes and constraints

Create B-tree indexes for code/jurisdiction lookup, provision natural key, edition membership `(edition_id, sort_key,
provision_id)`, document `(publication_date, id)`, versions `(owner_id, source_date, id)`, relationships by each end,
source aliases and event `(observed_at, id)`. Unique passage identity is `(owner_version_id, chunk_contract, ordinal)`.
Enforce exactly one passage owner, nonnegative ordinals, consistent jurisdiction/code references, and no dangling edition
membership. Store foreign keys/indexes supporting deletion/restriction fan-out deliberately.

Index runnable units/outbox rows by stage and retryAt; queue claiming uses short transactions with row locks/skip-locked
where appropriate. Do not hold row locks for provider waits. Canonical FTS and vector details live in
[search and embeddings](search-indexing.md); projection indexes must not alter the canonical database image.

## Rights contract shared with Vaquill

Attach a rights profile at source/edition scope: display text, cache/raw retention, local search, embeddings, generated
answers, exports, customer sharing, API/MCP delivery, attribution, territories and termination behavior. Profiles are
versioned and recorded with the imported data. Government and licensed sources use the same schema; permissive rights
are not inferred from a vendor field being absent. Query filtering and artifact delivery enforce the applicable profile.
Restricted content must be filtered before ranking/counting/snippet generation. See [state onboarding](state-onboarding.md).
