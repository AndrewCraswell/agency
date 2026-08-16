# n8n orchestration

The checked-in workflows only schedule and start the TypeScript Container Apps Job. Parsing, checkpointing, retries,
idempotency, and partial-failure decisions remain in the application. Workflows are inactive on import so an operator
can verify environment variables and manually execute them before enabling schedules.

Required n8n environment variables are `AZURE_CLIENT_ID`, `AZURE_INGESTION_JOB_ID`, `LEGISLATION_IMAGE`, and the normal
job-specific application variables. The managed identity needs Container Apps Job Executor on the ingestion job. n8n
uses its own `n8n` PostgreSQL database and Key Vault-held encryption key. Queue mode, Redis, and separate workers remain
disabled for MVP.

Import each JSON through the n8n workflow import UI or CLI. Pause schedules by deactivating the workflow. Replay a
bounded range through the CLI options in a manual Container Apps Job execution; application checkpoints and overlap
windows remain authoritative. An exit code of `3` is a partial failure and must not be treated as success. Keep n8n's
workflow-level retry disabled because provider retries and checkpoint safety are owned by the TypeScript job.
