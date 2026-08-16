# Milestone 2: Azure infrastructure baseline

## Goal

Create a minimal, secure, reproducible Azure environment for every MVP runtime.

## Tasks

### Environment design

- [x] **M2.1** Define development, staging, and production environment naming and isolation rules.
- [x] **M2.2** Define Azure regions and document any service-availability constraints.
- [x] **M2.3** Define resource naming, tagging, ownership, and cost-allocation conventions.
- [x] **M2.4** Define configuration values that differ by environment and parameters that must remain consistent.

### Bicep foundation

- [x] **M2.5** Create the Bicep entry point and environment parameter files under `apps/legislation/infra/bicep`.
- [x] **M2.6** Split reusable Bicep modules by Azure resource while keeping them inside the application.
- [x] **M2.7** Add deterministic deployment outputs for endpoints, resource IDs, and identity IDs.
- [x] **M2.8** Add Bicep validation and what-if checks to the infrastructure workflow.
- [x] **M2.9** Document bootstrap permissions required to deploy the stack.

### Core resources

- [x] **M2.10** Provision an Azure Container Registry.
- [x] **M2.11** Provision a Log Analytics workspace and Container Apps environment.
- [x] **M2.12** Provision the MCP Container App with a health probe and minimum scaling policy.
- [x] **M2.13** Provision the ingestion runtime as a Container App or Container Apps Jobs, according to command behavior.
- [x] **M2.14** Reserve the n8n Container App configuration without enabling production schedules yet.
- [x] **M2.15** Provision PostgreSQL Flexible Server with SSL, backups, connection limits, and supported maintenance settings.
- [x] **M2.16** Provision separate `policy` and `n8n` databases.
- [x] **M2.17** Enable pgvector through a repeatable database-bootstrap operation.
- [x] **M2.18** Provision Blob Storage containers for state sources, federal sources, and normalized documents.
- [x] **M2.19** Provision Key Vault and configure soft-delete and access controls.

### Identity and networking

- [x] **M2.20** Create managed identities for the MCP, ingestion, and n8n runtimes.
- [x] **M2.21** Grant least-privilege access to Blob Storage, Key Vault, registry, and monitoring resources.
- [x] **M2.22** Decide and document PostgreSQL network exposure for each environment.
- [x] **M2.23** Configure application ingress, TLS, and allowed origins or clients where applicable.
- [x] **M2.24** Verify that no Azure service credential must be embedded in an image or source-controlled configuration.

### Deployment proof

- [ ] **M2.25** Build and publish a minimal legislation image.
- [ ] **M2.26** Deploy it to the development environment through the documented workflow.
- [ ] **M2.27** Verify the runtime can read one Key Vault secret through managed identity.
- [ ] **M2.28** Verify the runtime can read and write a test Blob Storage object.
- [ ] **M2.29** Verify the runtime can connect securely to PostgreSQL and confirm pgvector availability.
- [ ] **M2.30** Verify application logs and health status appear in Azure Monitor.
- [ ] **M2.31** Delete the test data created by the deployment proof without deleting shared resources.

## Exit criteria

- A fresh Azure environment can be created from Bicep without manual resource configuration.
- A minimal application reaches PostgreSQL, Blob Storage, Key Vault, and Azure logging through intended identities.
- Deployment validation and rollback instructions are documented.
