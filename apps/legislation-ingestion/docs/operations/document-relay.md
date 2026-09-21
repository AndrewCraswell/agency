# Document fetch relay

The document fetch relay is an ingestion-owned, stateless Railway process for official publisher URLs that Trigger
Cloud cannot reach reliably. It is not an MCP server, product API, crawler or general-purpose proxy.

The process runs `src/cli/document-relay.ts` from `Dockerfile.relay`. It exposes public `GET /health` and `GET /ready`
endpoints plus authenticated `POST /internal/document-fetch`. The existing source allowlist, request-size limit,
redirect policy, timeout and constant-time bearer-token comparison remain mandatory. Do not add arbitrary hosts or
forward caller-controlled headers.

Railway service configuration:

- Service: `legislation-document-relay`
- Service ID: `86e9969d-ab29-4954-9d0a-784857e2a7e4`
- Public origin: `https://legislation-document-relay-production.up.railway.app`
- Route: `https://legislation-document-relay-production.up.railway.app/internal/document-fetch`
- Reference manifest: `apps/legislation-ingestion/railway.relay.json`
- Required variable: `DOCUMENT_FETCH_RELAY_TOKEN`
- Runtime-owned variables: `PORT` and `RAILWAY_GIT_COMMIT_SHA`
- Static outbound IPs: enabled with high availability

Railway no longer attaches a new service to the legacy `railway.json` config-as-code format. The reference manifest
records the intended Dockerfile, watch paths, health check and restart policy, while the equivalent settings are applied
directly to the service. The public domain must target Railway's injected `PORT`, currently `8080`, rather than the
Dockerfile's local fallback port.

Static outbound IPs are required. Pennsylvania accepted one temporary Railway egress address but timed out after a
credential-triggered deployment assigned another. After enabling high-availability static egress and redeploying, six
consecutive production-path fixture requests succeeded.

Trigger production owns the matching `DOCUMENT_FETCH_RELAY_URL` and `DOCUMENT_FETCH_RELAY_TOKEN`. Rotate the shared
credential if either runtime may have exposed it. A cutover is complete only after health checks pass, an approved
Pennsylvania document returns bytes with `x-legislation-relayed-source`, and Trigger production points at the Railway
URL. Keep the prior relay available until that acceptance passes.

Production cutover completed on 2026-09-21. The accepted Pennsylvania fixture returned `74,374` bytes with SHA-256
`9606F3C41ECD145124AA0B5A2F479D61458D7FCC4D52199E451685859C69651B`, matching the legacy Azure relay byte for byte.
The shared credential was rotated, Trigger production was updated to the Railway route, the rotated credential was
accepted by Railway, and Azure rejected it with HTTP `401`.

The relay does not need database, Azure Storage, WorkOS, model-provider or telemetry credentials. Azure Blob Storage,
Document Intelligence and Open States Container Apps jobs have separate lifecycles and are not part of relay removal.
