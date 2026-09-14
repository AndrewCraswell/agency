# Reviewed committee mappings

These JSON files are trusted, version-controlled ingestion data, not general name-normalization rules. Congress numbers
in filenames identify the historical source period. Membership evidence remains GovInfo.

- `editions`: exact reviewed package IDs, Congress, complete parsed-roster SHA-256 fingerprints and expected counts.
- `identities`: printed name/state/chamber, expected canonical identity and district, exact committee contexts and
  optional corroborating source cells.
- `reviewNotes`: preserved research notes. Detailed evidence links are in the [source decisions](source-decisions.md).
- `historicalAtFirstObservation`: only for explicitly retained historical assignments with unknown boundaries.
- `annotation`: reviewed source label and role, applied only after the identity and full edition fingerprint pass. A
  leave-of-absence annotation does not create a departure date or end a tenure.

One dataset shares mappings across explicitly listed editions; no rule applies implicitly to another edition. Add
reviewed corrections to the applicable dataset, retaining independent person/assignment evidence. A new dataset must be
registered as a static import in `committee-review-data.ts` so service and Trigger bundles include it. Do not load
overrides from a request, source document, network URL or mutable database configuration.

The generic loader validates strict schemas and rejects duplicate editions and source contexts. The matcher still
requires the full source fingerprint, canonical identity/term and exact context checks. Unknown editions receive no
overrides; changed evidence in a reviewed edition fails closed. Schema validation alone does not certify a mapping.

Data-only edits require the normal review, tests and deployment. They do not directly rewrite existing database rows.
