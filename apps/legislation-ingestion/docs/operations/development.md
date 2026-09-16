# Ingestion development and runtime

I owns provider acquisition, canonical import persistence, document/OCR processing, embeddings, source coverage,
index replication, Trigger orchestration and the approved-source document relay. It does not host HTTP product APIs,
chat or MCP. Applications consume C, never another application's source.

Use Node 24, pnpm 11 and the Python runtime pinned by the scraper Dockerfiles. Commands from the repository root:

```powershell
pnpm --filter legislation-ingestion cli --help
pnpm --filter legislation-ingestion tool --list
pnpm --filter legislation-ingestion trigger:dev
pnpm --filter legislation-ingestion build
```

`trigger:deploy` validates W's deployed readiness/ingestion contract before deploying workers. It is a separate explicit
release action, not part of source development. `trigger:backfill` and `trigger:schedules` retain their preview/apply
boundaries. The [README](../../README.md) owns environment isolation, document-relay settings and retained local build
inputs. [Testing](testing.md) owns parser, Python and guarded database commands.

Before using the new workspace, follow [local environment setup](../../../legislation-web/docs/operations/development.md#local-environment-after-the-move).
The old ignored `.env` was not moved. Relocate only I's required settings locally without printing secrets or copying
the combined environment wholesale. CLI/relay/test commands need an already configured process environment; the tool
launcher explicitly loads I's `.env`. `build` checks TypeScript without emitting JavaScript.

Use [C's database procedure](../../../../packages/legislation-core/docs/operations/development.md). Migrations are
stored once in C and released explicitly through W; worker startup never applies them. Worker pool/concurrency budgets
belong to [worker capacity](worker-capacity.md), constrained by C's aggregate database allowance.

## Specialist tools

Run `pnpm --filter legislation-ingestion tool <area>/<name>`. The local tool manifest is authoritative; obsolete colon
aliases in dated evidence are not executable commands. Source/import/repair commands belong here, while W owns serving
latency and research diagnostics. Keep recovery and schedule tools; do not add a package alias per specialist tool.

## Local artifacts

When `AZURE_STORAGE_ACCOUNT` is unset, immutable source archives, normalized documents and reports use the filesystem
adapter rooted at `LEGISLATION_SOURCE_DIRECTORY` (default `.data/sources`). Content-addressed paths stay inside that
directory. An Azure account selects managed-identity Blob Storage. Ignored evidence was not blanket-moved by extraction;
resolve existing artifact paths before a replay and do not overwrite or silently regenerate historical inputs.
Retained `apps/legislation/data` and `apps/legislation/artifacts` remain local inputs, not I's new working directory.
Explicitly configure the intended source location or relocate only the required non-secret inputs locally. Check ignore
status for each destination: the old `data` directory is not itself covered by a blanket ignore rule.

## OCR publication

There is no standalone historical OCR polling sweep. Native document/material ingestion owns OCR handoff; accumulated
unowned OCR work is a defect. `bill_documents.ocr_status` uses `not-required`, `pending`, `processing`, `processed`,
`failed`, or `unsupported`. Provider, completion time and page count stay null for historical rows without a recorded
attempt. Document sections receive one-based inclusive page ranges only when complete, contiguous UTF-16 provider
spans equal canonical normalized text. Ambiguity leaves both page fields null; never infer pages from section order,
PDF page count or another version. See [OCR operations](document-ocr.md).

## Observability

Ingestion commands carry ingestion-run IDs; Trigger runs carry platform run IDs; traces carry OpenTelemetry IDs.
I initializes its own telemetry and imports C's logger/redaction primitives. Logs record operation, status, duration,
bounded error category and canonical identifiers, not credentials or full text. Trigger owns run status, retries,
schedule health and failed/delayed-sync notifications. Langfuse records embedding/model observations with pinned model,
usage and latency. Retain correlated recovery cause, replay range, checkpoint and coverage delta.

Validation failures are info, recoverable provider throttling warn, exhausted dependencies/internal failures error,
and high-volume detail debug. Retention requirements are 7 days development, 30 staging and 90 production unless
organization policy is stricter; never sample errors or ingestion summaries. These are operating requirements,
not verified live receiver, retention or on-call configuration.