# Observability contract

Every HTTP request has a correlation ID, every ingestion command has an ingestion-run ID, every n8n execution has its
workflow execution ID, and OpenTelemetry supplies trace and span IDs. Logs use timestamp, level, service, environment,
operation, status, duration, error category, correlation ID, and targeted canonical identifiers where applicable.

Azure Monitor owns runtime availability, HTTP status and duration, replica count, CPU, memory, restarts, job exit status,
PostgreSQL availability, pool pressure, and workflow failures. Langfuse owns MCP tool and embedding observations,
including retrieval mode, sanitized filters, candidate counts, selected identifiers, provider, pinned model, usage, and
latency. The two systems share the correlation ID. Langfuse SDK v5 uses OpenTelemetry and masks credential-shaped fields,
bearer tokens, long payloads, and full bill text before export.

The `/ready` response includes only safe pool counters: active, idle, total, maximum, waiting, and saturation. It never
includes database URLs, SQL text, parameters, or credentials, so Azure probes and diagnostics can collect pool pressure.

Expected validation failures are `info`; recoverable provider throttling is `warn`; exhausted dependencies and internal
errors are `error`; high-volume diagnostic detail is `debug`. Development retains logs for 7 days, staging for 30 days,
and production for 90 days unless the organization policy is stricter. Production samples successful high-volume search
spans after a baseline is established but never samples errors or ingestion summaries.

Alert ownership belongs to the legislation on-call rotation. Page for sustained MCP 5xx rates, readiness failures, or a
missed Congress checkpoint beyond 12 hours. Create a ticket for a partial historical import, document extraction failure
rate above 5 percent, embedding backlog above one day, or coverage regression. Recovery evidence includes the correlated
run, cause, replay range, resulting checkpoint, coverage delta, and healthy query.

The Bicep alert module creates seven rules: MCP 5xx, readiness failure, failed scheduled sync, stalled Congress
checkpoint, document failure rate, embedding backlog age, and zero MCP replicas. Metric alerts use Container Apps
metrics. Log alerts parse the structured readiness, ingestion-result, and daily operational-snapshot records in
`ContainerAppConsoleLogs_CL`. Scheduled-sync and checkpoint rules stay disabled until the corresponding n8n schedules
are deliberately activated. Alert rules can fire without notification receivers, but every release environment must
pass at least one existing legislation on-call action group ID and prove each rule fires and resolves before D5.8 or
M14.49 can close.
