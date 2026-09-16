# Azure MCP infrastructure

This historical combined-runtime template describes an Azure MCP runtime and supporting network, registry, Blob storage,
Key Vault, logging and alerts. It stays with W, but is not the separated MCP deployment contract or evidence of a live
cutover. See [runtime ownership](../../docs/operations/development.md#nextjs-runtime) and the
[standalone MCP runtime](../../../legislation-mcp/README.md). Storage/OCR and Trigger orchestration belong to I; this
retained template does not establish their deployed configuration.

The historical design uses a resource group per environment, with development `legislation-dev` in `westus2`. Its MCP
identity has image, Key Vault and Blob permissions; those combined-runtime permissions are not M's current contract. M
does not require the database or model credentials referenced by this template.

For an explicitly authorized historical-template validation or preview, run from `apps/legislation-web`:

```powershell
pnpm infra:build
pnpm infra:what-if development
```

Required preview variables are `DATABASE_URL`, `OPENROUTER_API_KEY`, `LANGFUSE_PUBLIC_KEY`, and `LANGFUSE_SECRET_KEY`.
Bicep creates alerts for MCP server errors, readiness failures, and zero ready replicas. Data-sync monitoring belongs in
Trigger.dev.
