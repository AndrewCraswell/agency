# Observability contract

Every HTTP request has a correlation ID, every ingestion command has an ingestion-run ID, every Trigger.dev run has its
run ID, and OpenTelemetry supplies trace and span IDs. Logs use timestamp, level, service, environment, operation,
status, duration, error category, correlation ID, and targeted canonical identifiers where applicable.

Azure Monitor owns MCP runtime availability, HTTP status and duration, replica count, CPU, memory, restarts,
PostgreSQL availability, and pool pressure. Trigger.dev owns synchronization run status, retries, and schedule health.
Langfuse owns MCP tool and embedding observations,
including retrieval mode, sanitized filters, candidate counts, selected identifiers, provider, pinned model, usage, and
latency. The two systems share the correlation ID. Langfuse SDK v5 uses OpenTelemetry and masks credential-shaped fields,
bearer tokens, long payloads, and full bill text before export.

The `/ready` response includes only safe pool counters: active, idle, total, maximum, waiting, and saturation. It never
includes database URLs, SQL text, parameters, or credentials, so Azure probes and diagnostics can collect pool pressure.

Expected validation failures are `info`; recoverable provider throttling is `warn`; exhausted dependencies and internal
errors are `error`; high-volume diagnostic detail is `debug`. Development retains logs for 7 days, staging for 30 days,
and production for 90 days unless the organization policy is stricter. Production samples successful high-volume search
spans after a baseline is established but never samples errors or ingestion summaries.

Alert ownership belongs to the legislation on-call rotation. Page for sustained MCP 5xx rates, readiness failures, or
zero ready replicas. Trigger.dev notifications cover failed or delayed synchronization. Recovery evidence includes the
correlated run, cause, replay range, resulting checkpoint, coverage delta, and healthy query.

The Bicep alert module creates three rules: MCP 5xx, readiness failure, and zero MCP replicas. Metric alerts use
Container Apps metrics; the readiness rule parses structured logs in `ContainerAppConsoleLogs_CL`. Rules can exist
without notification receivers, but each deployed environment should supply an on-call action group.
