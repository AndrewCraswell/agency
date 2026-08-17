# Operator runbooks

## Alert acknowledgement and evidence

The legislation on-call rotation owns every `leg-<environment>-*` rule. Acknowledge severity 1 pages immediately and
severity 2 ticket alerts during the next support window. Attach the alert rule ID, fired and resolved timestamps,
correlation ID or revision, diagnosis, recovery action, and the final healthy query. Do not close an alert from a single
green probe; retain the recovered checkpoint or coverage snapshot that cleared the condition.

| Alert suffix | First check | Recovery proof |
| --- | --- | --- |
| `mcp-failures` | Split the `Requests` metric by status code and revision, then use the time window in Langfuse and console logs. | The failing trace is classified and the same representative tool call succeeds without a 5xx response. |
| `readiness-failure` | Locate `readiness check failed` by correlation ID and inspect only the safe pool counters. | `/ready` returns 200 repeatedly and the dependency cause is resolved. |
| `scheduled-sync-failure` | Locate the Container Apps Job result by workflow execution ID; inspect `source`, `operation`, and terminal status. | The bounded replay succeeds and its durable checkpoint is recorded. |
| `stalled-checkpoint` | Open the latest operational snapshot and the `congress`/`bills` checkpoint. | A successful sync advances or safely reaffirms the checkpoint within 12 hours. |
| `document-failure-rate` | Review failed and unsupported document cohorts in the coverage report. | The affected bounded cohort is replayed or categorized and the latest rate is at most 5 percent. |
| `embedding-backlog` | Review the oldest missing-embedding timestamp and OpenRouter batch traces. | The backlog clears or its oldest age falls below 24 hours with the pinned model unchanged. |
| `infrastructure-health` | Inspect the active revision, replica count, probes, and Container Apps system logs. | At least one healthy MCP replica serves readiness and the authenticated smoke test. |

## Provider timeout or rate limit

Find the ingestion run by correlation ID, confirm the provider and retryable category, and verify the checkpoint did not
advance past failed work. Wait for the provider recovery, then replay the same bounded range. Do not edit a checkpoint by
hand. A second overlapping workflow should be rejected by the leased database lock.

## Document extraction failure

Locate the document ID and official source URL in the run summary. `unsupported` means the format or image-only PDF needs
manual treatment; `failed` is retryable. Re-run `documents:process --document-id <id>`. The immutable artifact is reused
unless `--force` is supplied. Compare the new section hashes and confirm stale embeddings are regenerated.

Supporting materials use the same recovery model. Re-run `materials:process --material-id <id>` for a single committee
report, hearing document, fiscal note, analysis, or other material. Use `materials:process --all` only for the bounded
pending queue; unsupported formats remain terminal until their extraction support changes.

## Embedding failure

Confirm the OpenRouter status, pinned model, batch count, and retry exhaustion without inspecting full text. Retry
`embeddings:run` after recovery. Input hashes make the replay idempotent. A model or dimension mismatch is a release
blocker, not a retryable transient error.

## Database outage

Readiness must fail while health remains live. Check Flexible Server availability, firewall or private networking, TLS,
connection limits, and pool saturation. Restore connectivity before replaying work. Jobs retain their previous durable
checkpoint and expired leases become recoverable after three hours.

## Authentication failures

Verify the client uses the environment's HTTPS MCP resource, issuer, and audience. Refresh an
expired token. Check WorkOS JWKS availability if all valid clients fail. Never paste a bearer token into logs or tickets.

## Failed deployment

Inspect Container Apps revision health and logs. Route traffic back to the preceding immutable image digest when the
schema remains compatible. Database migrations use a forward fix. Run authenticated health, readiness, tool-list, and
representative search smoke tests before restoring normal traffic.

In single-revision mode, recovery means redeploying the preceding immutable digest or a new forward-fix digest; do not
reuse a mutable tag. Record the failed revision and digest, the recovered revision and digest, the chosen strategy, and
at least 21 successful deployment-smoke tool calls. The failed and recovered revisions and images must be distinct.

## Controlled diagnostic proof

Run provider timeout, document extraction failure, OpenRouter failure, and database outage exercises only in a
disposable or staging target. Use one workflow execution ID and correlation ID per exercise. Retain an n8n execution
reference, the matching application run ID or dependency diagnostic, and the recovery evidence. Confirm the durable
checkpoint did not advance past failed work before marking the exercise recovered. Never store tokens, connection URLs,
provider payloads, or full legislative text in the evidence bundle.

For the database outage, health must remain live while readiness returns unavailable. Restore connectivity before any
replay. For provider and model exercises, exhaust only the bounded test request and then replay the same range. For an
extraction exercise, use a disposable fixture document and the targeted document replay command.

## PostgreSQL and n8n restore verification

Restore the selected PostgreSQL backup and n8n configuration into targets whose fingerprints differ from the active
environment. Do not change the active connection or n8n encryption configuration. Record the backup identifier,
migration state, pgvector version, restored workflow IDs, and both target fingerprints rather than database URLs.
Verify health, readiness, all restored workflow IDs, and at least 21 deployment-smoke tool calls. Confirm the active
target remained unchanged, then remove the disposable targets through the owning platform's approved cleanup process.

## Operational evidence gate

Assemble one JSON record with version `1`, environment, generation time, all seven fired-and-resolved alert records, all
four diagnostic exercises, the disposable database and n8n restore, and the failed-deployment recovery. Each alert needs
an action group and recovery reference. Run:

```powershell
pnpm operations:verify -- <operational-evidence.json>
```

The command returns `operational-evidence-valid` only when the complete matrix is present, targets are isolated, images
are immutable, and post-recovery smoke gates pass. Validator success proves the record is internally complete; D5.8 and
M14.49 still require an operator to confirm that referenced Azure, Langfuse, coverage, and runbook evidence is genuine.
