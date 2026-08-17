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
after n8n is available. The job imports all eleven stable workflow IDs in the inactive state; importing again updates
those same IDs instead of creating duplicates. The bootstrap explicitly deactivates every workflow after import because
n8n otherwise preserves the activation state of an existing workflow.

`Legislation - Bootstrap orchestration` is a manual workflow that starts Open States historical ingestion, GovInfo
ingestion, pending-document processing, missing-or-stale embedding refresh, and the final coverage report in that order.
After every start request, it polls the exact Container Apps Job execution ID until Azure reports success. A failed,
stopped, or otherwise non-running execution stops the workflow before any downstream phase starts. The final n8n item
retains the workflow execution ID, shared correlation ID, five Azure execution IDs, and the immutable coverage-report
blob path. Successful and failed n8n execution data is retained for this workflow.

## Schedule activation and pause

Schedules must remain inactive until the D2 corpus-ingestion and D3 document-corpus gates pass. After both gates pass:

1. Open the development n8n instance and confirm that all eleven `Legislation -` workflows are inactive.
2. Manually run a bounded validation of Congress sync, Congress events, House votes, amendments, committee reports,
   coverage report, document processing, embedding refresh, and Open States refresh. Confirm each application run ID and
   terminal result.
3. Activate those nine scheduled workflows. Keep `Legislation - GovInfo bootstrap` inactive because it is a manual,
   bounded bootstrap operation.
4. Record the activation time, workflow IDs, application image digest, and validating run IDs in the development
   completion record.

To pause ingestion, deactivate the nine scheduled workflows in n8n. Deactivation prevents new triggers but does not
cancel an already-started Container Apps Job execution. Inspect active executions with
`az containerapp job execution list --resource-group legislation-dev --name leg-dev-ingestion`; stop a specific run only
after recording its execution name and application run ID. Re-importing the checked-in workflows also pauses all eleven
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
| Federal meetings and hearings   | `congress:events --start-congress <number> --end-congress <number> --domain both`; add `--restart` for a correction refresh                |
| Federal House roll calls        | `congress:house-votes --start-congress <number> --end-congress <number>`; optionally select `--session 1` or `--session 2`                 |
| Federal amendments              | `congress:amendments --start-congress <number> --end-congress <number>`; add `--restart` for a correction refresh                          |
| Failed document replay          | `documents:process --status failed --limit <number>` and optionally one `--bill-id`, `--document-id`, or `--jurisdiction-id`               |
| Forced document refresh         | `documents:process --document-id <id> --force --limit 1`                                                                                   |
| Bounded embeddings              | `embeddings:run --bill-id <id> --limit <number>` or `--document-id <id> --limit <number>`                                                  |
| Confirmed interrupted lease     | `jobs:recover --source <source> --operation <operation> --before <ISO date-time>` after proving the external execution is terminal         |

Every manual execution must set a unique `CORRELATION_ID`. Set `WORKFLOW_EXECUTION_ID` only when an n8n execution
started the job. Checkpoint replay is the default; failed-record and force options never bypass canonical idempotency.

## Bootstrap orchestration

Keep `Legislation - Bootstrap orchestration` inactive and run it manually. Before a bounded validation, open the
`Bootstrap inputs` node and set the smallest suitable Open States manifest plus an inclusive Congress range. The
checked-in defaults reference the retained 2017-onward development manifest and the configured federal range. A D1
validation should instead use a disposable, single-jurisdiction manifest and a single Congress so it cannot compete with
corpus-loading work.

The workflow intentionally has no n8n Code node and no workflow retry. TypeScript owns checkpoints, renewable leases,
provider retries, partial-failure exit status, and canonical idempotency. If an overlapping phase hits an application
lease, its Container Apps execution fails and orchestration stops. After proving that an interrupted external execution
is terminal, use the bounded `jobs:recover` command from the table above before replaying the workflow. Do not edit a
checkpoint or canonical record by hand.

For evidence, retain the n8n execution URL and final item, each linked Container Apps execution, the application run
rows with the shared correlation ID, and the versioned coverage blob under `coverage/orchestration/<execution-id>.json`.
The workflow implementation and local topology validation do not satisfy D1.6 or D1.7 by themselves; those tasks still
require execution against disposable development data.

## Development reconciliation snapshot

On 2026-08-17, the authorized `legislation-dev` resource group was reconciled with the checked-in deployment:

- n8n uses `leg-dev-n8n-id` and has `Container Apps Jobs Operator` on `leg-dev-ingestion`.
- `AZURE_INGESTION_JOB_ID` points to `leg-dev-ingestion`, and `LEGISLATION_IMAGE` uses immutable digest
  `sha256:489fbf1acba532519669a8a8040d48fb6b41a1da577d98eaecc9228320308374`.
- The last recorded live bootstrap imported nine stable `legislation-*` workflow IDs. The checked-in bootstrap now
  contains eleven IDs; its next authorized run will add the committee-report and bootstrap-orchestration workflows
  without duplicating the existing IDs.
- All nine previously imported workflows were confirmed inactive after bootstrap execution
  `leg-dev-n8n-bootstrap-5744k9a`; the new committee-report and bootstrap-orchestration workflows remain inactive by
  definition until validation.
