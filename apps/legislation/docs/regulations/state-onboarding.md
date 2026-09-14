# Future Vaquill state onboarding contract

Proposed future phase, September 14, 2026. Parent: [implementation](implementation.md).
Federal acquisition ships independently, but its canonical model and retrieval surfaces must accept a second provider.

## Provider boundary

Vaquill is the preferred licensed-state candidate, subject to coverage and terms. A paid feed has not been tested or
contracted. The public code audit found fewer collectors than paid coverage claims; it is not a complete continuity
plan. Preserve direct federal sources and current Open States legislative activity regardless of state code licensing.

Implement `src/ingestion/regulations/vaquill/` as an adapter into the same acquisition envelopes, staging, edition,
version, passage, outbox and coverage contracts. Do not put Vaquill IDs into canonical primary keys. Use the provider's
IDs as aliases and preserve publisher citations/source dates. Federal/state differences are capabilities and source
policy, not separate customer query engines or a second search index architecture.

## Required feed contract

Obtain a dated machine-readable manifest per jurisdiction and corpus with source inventory, file/section counts,
checksums, schema revision, extraction/parser revision if supplied, source collection/currency, last successful update,
known missing sections/titles, languages and permitted uses. Determine whether delivery is immutable full snapshots,
ordered deltas, or both. Vendor daily delivery is not proof of daily publisher collection.

Required delta behavior: stable event ID, scope, sequence/cursor, operation (`upsert`, `remove`, `correct`, `restrict`),
entity ID, prior/current revision, source/effective dates when known, snapshot baseline and retry/replay policy. Confirm
how to detect sequence gaps and whether a snapshot can bridge them. Do not implement imagined endpoint names or webhook
schemas: the adapter's transport contract is completed from actual licensed samples.

If only full snapshots are available, compute differences after validating the whole snapshot. Never infer deletion
from an incomplete download. If a delta chain has a gap, pause publication of that scope, retain the previous generation
with stale coverage, and request/resync the baseline. Duplicate and out-of-order events must converge under source
revision ordering. A correction to an older effective date cannot overwrite a newer valid observation accidentally.

Map provider statute/admin-code hierarchy to `legal_codes`, edition membership and provision versions. Parse only
structure required to preserve the licensed text; keep original structured files and hashes where rights allow. Local
text normalization must not erase tables, non-English text, footnotes or citation aliases. Unknown source dates remain
unknown. A vendor record without a publisher URL is labeled supplier-sourced, not given a guessed government link.

## Coverage and temporal boundaries

Onboard statutory and administrative codes separately. Assess all 50 states and DC; Puerto Rico is a separately declared
target with language/coverage validation. The model can hold any existing canonical jurisdiction, but a jurisdiction
appears supported only after its declared corpus passes. No one nationwide Boolean masks partial states.

For every state, assess independently: current code, history, proposed/adopted/emergency publications, agency attachments
and deadlines. An administrative-code delta is an observed text change, not a complete rulemaking event. If no publication
feed exists, regulatory-action/publication endpoints honestly remain unavailable for that state while code search works.
No state rulemaking parity claim follows from importing all code sections.

Historical asOf is enabled only if actual publisher editions or verified provider version history support it; snapshots
and amendment notes alone do not qualify. Current vendor marketing and older articles have differing historical-query
descriptions, so validate against the licensed feed and keep version capability per corpus. Do not hardcode a blanket
no-history or full-history assumption from an older article.

## Contract and serving rights

Before production import, resolve permission for local raw storage, normalized text, lexical/vector indexes, model
inputs, search snippets/full text, user-facing AI answers, reports, organization/customer sharing and Tabra API/MCP
delivery. Confirm attribution, white labeling, source exceptions, commercial limits, renewal, termination and deletion
obligations. Hosting an API is not automatically permission to redistribute bulk data through it.

Store rights-profile revision on each source edition. Synthetic fixtures test restrictions before a real license exists.
Restriction events update canonical visibility, indexes, cached results, downloads and pending deliveries promptly.
Do not keep serving old text simply because it remains in a search snapshot. Retained hashes/metadata versus retained
full text follow the contract. Export/continuity rights and post-termination serving must be written, not inferred.

## Pilot and promotion

1. Agree a sample that includes a large state, a PDF-derived state, a disclosed partial source and a changed provision.
   Include one statute and one regulation corpus; keep state rulemaking separate.
2. Validate provenance, schema, counts, citations, full text and tables against a fixed official-source sample. Resolve
   discrepancies before normalizing identity aliases. Preserve originals and a discrepancy ledger.
3. Import through the same Trigger manifest/unit pipeline with its own licensed-provider request budget and source
   rights, under the aggregate DB/embedding limits. Initial state import cannot starve federal current updates.
4. Replay duplicate, out-of-order, missing-delta and full-snapshot replacement cases. Prove no false deletions and no
   cross-state ID collisions. Demonstrate restriction propagation and broken-feed stale coverage.
5. Exercise citation lookup, lexical/semantic search, exact-version text, diff, API and MCP against the same state fixtures.
   Add source-specific relevance judgments; do not assume federal relevance benchmarks cover every state.
6. Complete a seven-day observed update/rights/coverage soak for each onboarding cohort. If no real changes occur, retain
   synthetic replay evidence and state that live change handling remains unobserved; source freshness still needs evidence.
7. Promote only validated jurisdiction/corpus scopes. Record licensed terms/manifest revision, release evidence and the
   rollback point. A vendor outage preserves permitted last-known content and visible stale dates.

Early federal contract tests must include synthetic state records with nonfederal citation formats, unknown effective
dates, no publication stream, non-English text, incomplete history and restrictive artifact rights. Those tests validate
the architecture boundary, not Vaquill's data. Actual feed parity cannot be closed without licensed delivery samples.
