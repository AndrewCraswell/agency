# MCP diagnostic telemetry

The standalone MCP entry point initializes the official Sentry Node SDK before importing the application/server.
Set `SENTRY_DSN` on the MCP runtime, with `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` identifying the deployment.
No credential values belong in source control. A missing DSN disables export; successful tests do not establish
production configuration. Startup failures and graceful shutdown flush queued events.

Tool spans carry the operation and request correlation ID. Failure events cover registry validation, tool execution,
handled batch-item errors, response serialization, SDK protocol errors, application request failures and startup.
Events include tool, category, stage, duration when available, sanitized selection inputs, upstream error details,
stack/cause information and SQLSTATE when retained by an upstream cause. HTTP responses keep `x-correlation-id` so
operators can search that value in Sentry. API-level diagnostics must retain their own correlation IDs; MCP cannot
recover SQL details already discarded by the remote API.

Headers, credentials, cookies, source text and response bodies are excluded. Strings and collections are bounded,
cyclic objects are handled, URL credentials are removed, and automatic event request/user payloads are removed.
Do not enable unrestricted request-body logging to investigate retrieval failures.

The unit acceptance test uses the actual SDK with an in-memory transport and asserts correlation, stack, duration,
tool and SQLSTATE retention plus redaction. A development export on 2026-09-17 produced Sentry issue
`LEGISLATION-10`, correlation `0b5328c2-82d9-4bb3-a17d-9a6adfa2dd84`, marked as a controlled acceptance probe.
This confirms local SDK delivery, not a production MCP deployment. Production acceptance must check the deployed
release/source maps and one controlled failed tool call through authenticated MCP transport.