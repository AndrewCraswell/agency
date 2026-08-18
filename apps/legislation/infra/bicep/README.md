# Azure MCP infrastructure

Azure hosts only the public MCP runtime and its supporting network, registry, Blob storage, Key Vault, logging, and
alerts. Trigger.dev owns all recurring and historical synchronization; ingestion runtimes are intentionally absent from
this template.

Each environment uses its own resource group. Development is `legislation-dev` in `westus2`. The MCP managed identity
can pull its image, read its four Key Vault secrets, and access legislation Blob containers. Provider credentials and
Trigger.dev secrets are configured in Trigger.dev, not Azure.

Validate and preview from `apps/legislation`:

```powershell
pnpm infra:build
pnpm infra:what-if development
```

Required preview variables are `DATABASE_URL`, `OPENROUTER_API_KEY`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY`.
Bicep creates alerts for MCP server errors, readiness failures, and zero ready replicas. Data-sync monitoring belongs in
Trigger.dev.
