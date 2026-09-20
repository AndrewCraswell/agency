# Shared search projection contracts

Canonical PostgreSQL is authoritative. Isolated search stores contain reconstructible text and indexed filters,
not vectors or permission authority. C owns migration/schema artifacts; W releases migrations explicitly, never on startup.
I owns [maintenance](../../../../apps/legislation-ingestion/docs/operations/search-maintenance.md), and W owns serving.

## Amendment projection

`amendment_section_search` stores section/document keys, an exact copy of the canonical weighted section vector and
a precomputed document-title vector, covered by two GIN indexes. It includes amendment sections regardless of processing
status; status, bill, jurisdiction, session and dates remain canonical parent predicates.

Synchronous database triggers copy the actual stored section vector after the heading/text vector trigger. Insertion,
replacement, section moves, title/classification changes and cascading deletes maintain the projection in the same
transaction. Section maintenance takes parent share locks; parent writers hold write locks. Deadlocks abort for normal
transaction retry, never silently skip maintenance.
[W query behavior](../../../../apps/legislation-web/docs/engineering/api/search-and-diffs.md)
defines matching/ranking; the schema does not impose an arbitrary candidate cap.

## Legal lexical and vector identity

Canonical immutable passage generations bind provision/publication version, preparation input hashes and exact reader/
context spans. English FTS has a generated column and GIN index; exact citation uses B-tree indexes. Measured filtered
indexes support edition membership/publication date, not every filter combination.

The isolated legal-passage projection stores immutable generation and passage text separately from one filter projection
per acknowledged edition or publication scope. The filter record binds the exact scope to corpus, jurisdiction, source,
rights profile, code or publication version, relevant dates, publication kind and agency IDs. Agency IDs remain empty
until canonical Federal Register agency resolution is promoted; callers must not infer an agency from publisher text.
`legal.sql` provisions this shape for a new database, while `scope-projections.sql` is the explicit upgrade for an
existing isolated search database. Corpus namespaces cannot collide. Unique passage identity and rights semantics come
from [the regulatory data contract](../regulations/data-contract.md).

Canonical `legal_passage_embeddings` uses dimension-constrained model/input checks, unique input identity and passage-ID
lookup. Hashes bind normalized input, model, dimensions, input and chunk contracts. Every vector stores those fields.
Changing dimension requires an isolated generation/storage target and accepted routing; never compare 1,024- with
1,536-dimensional vectors. Model selection is not approved merely by this schema. I builds/reconciles indexes;
W gates query quality, latency, rights and promotion.
