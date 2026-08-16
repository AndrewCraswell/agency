# Milestone 0: Freeze the MVP contract

## Goal

Remove architectural and product ambiguity before implementation begins.

## Tasks

### Product contract

- [ ] **M0.1** Write the primary user profile and the legislative research jobs the MVP must support.
- [ ] **M0.2** Write five representative research scenarios spanning known-bill lookup, topical discovery, timeline review,
      passage search, and version comparison.
- [ ] **M0.3** Define measurable success criteria for each representative scenario.
- [ ] **M0.4** Record the MVP definition of done in the product specification.
- [ ] **M0.5** Record the explicit exclusions and the conditions that would justify reconsidering each one.

### Data coverage contract

- [ ] **M0.6** Confirm Open States bulk data as the state historical source.
- [ ] **M0.7** Confirm GovInfo as the federal historical source.
- [ ] **M0.8** Confirm Congress.gov as the federal incremental source.
- [ ] **M0.9** Choose and document the initial Open States historical-session policy.
- [ ] **M0.10** Choose and document `FEDERAL_START_CONGRESS` and `FEDERAL_END_CONGRESS` defaults.
- [ ] **M0.11** Define supported jurisdictions, including the treatment of DC, Puerto Rico, and unavailable sessions.
- [ ] **M0.12** Define the minimum fields required for a bill to be considered successfully ingested.
- [ ] **M0.13** Define how missing upstream fields are represented without fabricating values.
- [ ] **M0.14** Define the machine-readable coverage report contract by jurisdiction and session or Congress.

### Interface contract

- [ ] **M0.15** Freeze the seven MCP tool names.
- [ ] **M0.16** Draft the input and output schema for each tool.
- [ ] **M0.17** Define pagination, result limits, text-size limits, and truncation signaling.
- [ ] **M0.18** Define stable error categories shared by the query service and MCP transport.
- [ ] **M0.19** Decide which identifiers each lookup accepts and require canonical IDs in returned records.
- [ ] **M0.20** Define source-link and source-attribution requirements for every result type.

### Architecture decisions

- [ ] **M0.21** Record the single-package `apps/legislation` application boundary.
- [ ] **M0.22** Record PostgreSQL FTS and pgvector as the only MVP search stores.
- [ ] **M0.23** Record OpenRouter and the pinned 1,536-dimensional embedding model.
- [ ] **M0.24** Record WorkOS as the identity provider and organization authority.
- [ ] **M0.25** Record n8n as orchestration only, with all business logic in TypeScript.
- [ ] **M0.26** Record Azure Container Apps, PostgreSQL Flexible Server, Blob Storage, Key Vault, and Bicep choices.
- [ ] **M0.27** Record Langfuse and Azure Monitor ownership boundaries.
- [ ] **M0.28** Create an architecture decision log and resolve every decision marked as blocking.

## Exit criteria

- The MVP specification, data coverage policy, tool contracts, and architecture decisions are approved.
- No unresolved decision blocks schema, ingestion, retrieval, authentication, or deployment work.
- Deferred features cannot silently enter the MVP without an explicit scope decision.

