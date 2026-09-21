# Document fetch relay

The document fetch relay is an ingestion-owned, stateless Railway process for official publisher URLs that Trigger
Cloud cannot reach reliably. It is not an MCP server, product API, crawler or general-purpose proxy.

The process runs `src/cli/document-relay.ts` from `Dockerfile.relay`. It exposes public `GET /health` and `GET /ready`
endpoints plus authenticated `POST /internal/document-fetch`. The existing source allowlist, request-size limit,
redirect policy, timeout and constant-time bearer-token comparison remain mandatory. Do not add arbitrary hosts or
forward caller-controlled headers.

Railway service configuration:

- Service: `legislation-document-relay`
- Config file: `apps/legislation-ingestion/railway.relay.json`
- Required variable: `DOCUMENT_FETCH_RELAY_TOKEN`
- Runtime-owned variables: `PORT` and `RAILWAY_GIT_COMMIT_SHA`

Trigger production owns the matching `DOCUMENT_FETCH_RELAY_URL` and `DOCUMENT_FETCH_RELAY_TOKEN`. Rotate the shared
credential if either runtime may have exposed it. A cutover is complete only after health checks pass, an approved
Pennsylvania document returns bytes with `x-legislation-relayed-source`, and Trigger production points at the Railway
URL. Keep the prior relay available until that acceptance passes.

The relay does not need database, Azure Storage, WorkOS, model-provider or telemetry credentials. Azure Blob Storage,
Document Intelligence and Open States Container Apps jobs have separate lifecycles and are not part of relay removal.
