# Operator runbooks

## Provider timeout or rate limit

Find the ingestion run by correlation ID, confirm the provider and retryable category, and verify the checkpoint did not
advance past failed work. Wait for the provider recovery, then replay the same bounded range. Do not edit a checkpoint by
hand. A second overlapping workflow should be rejected by the leased database lock.

## Document extraction failure

Locate the document ID and official source URL in the run summary. `unsupported` means the format or image-only PDF needs
manual treatment; `failed` is retryable. Re-run `documents:process --document-id <id>`. The immutable artifact is reused
unless `--force` is supplied. Compare the new section hashes and confirm stale embeddings are regenerated.

## Embedding failure

Confirm the OpenRouter status, pinned model, batch count, and retry exhaustion without inspecting full text. Retry
`embeddings:run` after recovery. Input hashes make the replay idempotent. A model or dimension mismatch is a release
blocker, not a retryable transient error.

## Database outage

Readiness must fail while health remains live. Check Flexible Server availability, firewall or private networking, TLS,
connection limits, and pool saturation. Restore connectivity before replaying work. Jobs retain their previous durable
checkpoint and expired leases become recoverable after three hours.

## Authentication failures

Verify the client uses the environment's HTTPS MCP resource, issuer, audience, and `legislation:read` scope. Refresh an
expired token. Check WorkOS JWKS availability if all valid clients fail. Never paste a bearer token into logs or tickets.

## Failed deployment

Inspect Container Apps revision health and logs. Route traffic back to the preceding immutable image digest when the
schema remains compatible. Database migrations use a forward fix. Run authenticated health, readiness, tool-list, and
representative search smoke tests before restoring normal traffic.
