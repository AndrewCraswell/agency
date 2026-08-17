# n8n orchestration

The checked-in workflows only schedule and start the TypeScript Container Apps Job. Parsing, checkpointing, retries,
idempotency, and partial-failure decisions remain in the application. Workflows are inactive on import so an operator
can verify environment variables and manually execute them before enabling schedules.

Required n8n environment variables are `AZURE_CLIENT_ID`, `AZURE_INGESTION_JOB_ID`, `LEGISLATION_IMAGE`, and the normal
job-specific application variables. Every job receives both `WORKFLOW_EXECUTION_ID` and a `CORRELATION_ID` composed from
the stable workflow ID and execution ID. The application stores both values with the ingestion run and terminal summary.
The managed identity needs Container Apps Job Executor on the ingestion job. n8n uses its own `n8n` PostgreSQL database
and Key Vault-held encryption key. Queue mode, Redis, and separate workers remain disabled for MVP.

The development deployment builds `Dockerfile.n8n`, creates the `leg-dev-n8n-bootstrap` Container Apps Job, and runs it
after n8n is available. The job imports all six stable workflow IDs in the inactive state; importing again updates those
same IDs instead of creating duplicates. The bootstrap explicitly deactivates every workflow after import because n8n
otherwise preserves the activation state of an existing workflow.

## Schedule activation and pause

Schedules must remain inactive until the D2 corpus-ingestion and D3 document-corpus gates pass. After both gates pass:

1. Open the development n8n instance and confirm that all six `Legislation -` workflows are inactive.
2. Manually run a bounded validation of Congress sync, coverage report, document processing, embedding refresh, and Open
   States refresh. Confirm each application run ID and terminal result before proceeding.
3. Activate those five scheduled workflows. Keep `Legislation - GovInfo bootstrap` inactive because it is a manual,
   bounded bootstrap operation.
4. Record the activation time, workflow IDs, application image digest, and validating run IDs in the development
   completion record.

To pause ingestion, deactivate the five scheduled workflows in n8n. Deactivation prevents new triggers but does not
cancel an already-started Container Apps Job execution. Inspect active executions with
`az containerapp job execution list --resource-group legislation-dev --name leg-dev-ingestion`; stop a specific run only
after recording its execution name and application run ID. Re-importing the checked-in workflows also pauses all six
workflows by design.

Replay a bounded range through the CLI options in a manual Container Apps Job execution; application checkpoints and
overlap windows remain authoritative. An exit code of `3` is a partial failure and must not be treated as success. Keep
n8n's workflow-level retry disabled because provider retries and checkpoint safety are owned by the TypeScript job.

## Bounded manual inputs

Manual executions change only the ingestion job's execution template; they do not edit the base job or activate a
schedule. Use the smallest applicable scope:

| Need                            | Command inputs                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| One state or state replay       | `openstates:bootstrap --manifest-blob <path> --jurisdiction <code>`; add `--force` only after recording the prior run and checkpoint       |
| State incremental window        | `openstates:sync --from <ISO date-time> --jurisdiction <code>`                                                                             |
| Current state entities          | `openstates:entities --jurisdiction <code>`; omit the jurisdiction only for an intentional all-jurisdiction snapshot                       |
| State event window              | `openstates:events --from <ISO date-time> --to <ISO date-time> --jurisdiction <code>`                                                      |
| Federal Congress and bill types | `govinfo:import --start-congress <number> --end-congress <number> --bill-types <csv>`; add `--force` only for an intentional full replay   |
| Congress.gov update window      | `congress:sync --from <ISO date-time> --to <ISO date-time>`; add `--dry-run` to measure without canonical writes or checkpoint advancement |
| Federal entity range            | `congress:entities --start-congress <number> --end-congress <number>`                                                                      |
| Failed document replay          | `documents:process --status failed --limit <number>` and optionally one `--bill-id`, `--document-id`, or `--jurisdiction-id`               |
| Forced document refresh         | `documents:process --document-id <id> --force --limit 1`                                                                                   |
| Bounded embeddings              | `embeddings:run --bill-id <id> --limit <number>` or `--document-id <id> --limit <number>`                                                  |
| Confirmed interrupted lease     | `jobs:recover --source <source> --operation <operation> --before <ISO date-time>` after proving the external execution is terminal         |

Every manual execution must set a unique `CORRELATION_ID`. Set `WORKFLOW_EXECUTION_ID` only when an n8n execution
started the job. Checkpoint replay is the default; failed-record and force options never bypass canonical idempotency.

## Development reconciliation snapshot

On 2026-08-17, the authorized `legislation-dev` resource group was reconciled with the checked-in deployment:

- n8n uses `leg-dev-n8n-id` and has `Container Apps Jobs Operator` on `leg-dev-ingestion`.
- `AZURE_INGESTION_JOB_ID` points to `leg-dev-ingestion`, and `LEGISLATION_IMAGE` uses immutable digest
  `sha256:9b57d86597b14b8537c2e074b141d97cbf78e558a76fc2bbbb213fe858d455c5`.
- The bootstrap import contained exactly the six stable `legislation-*` workflow IDs, with no duplicate IDs.
- All six imported workflows were confirmed inactive after the bootstrap run.
