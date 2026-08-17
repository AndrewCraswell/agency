# Development evidence audit

## Purpose

The development evidence audit converts retained run receipts and immutable artifacts into a deterministic status for
18 non-human roadmap gates. It runs entirely from local files. It does not connect to PostgreSQL, Azure, n8n, WorkOS,
providers, or MCP clients, and it never changes a roadmap checkbox.

The audit is deliberately stricter than checking whether a report file exists. Every artifact must match its declared
SHA-256 digest, and a source coverage report must be paired with a successful terminal run receipt. Interim coverage,
incomplete checkpoints, a failed command, a missing artifact, and an unexplained material gap all keep the associated
gate open.

Run it from `apps/legislation`:

```powershell
pnpm development:evidence -- `
  --input work/development-evidence/manifest.json `
  --output work/development-evidence/audit.json
```

The command exits with code `0` only when every gate represented by this audit passes. A partial audit still writes the
full task-by-task result before returning code `1`, so it can be retained as a truthful blocker report.

## Gates evaluated

| Gate | Required evidence |
| --- | --- |
| D1.7 | Successful bounded orchestration receipt, all four bootstrap steps, successful application run IDs, and a verified orchestration artifact |
| D2.15 | Ready corpus evidence audit with D2.6, D2.10, D2.12, D2.14, and D2.15 passing |
| D5.7 | Clean package verification, Bicep build and lint, workflow validation, migration from zero, deployment smoke, and authenticated MCP smoke |
| D5.8 | Verified Azure logs and alerts, Langfuse traces, coverage retention, evidence retention, runbooks, and operational evidence |
| D5.9 | Verified completion record after D5.7 and D5.8 pass |
| E1.5 | Terminal Open States entity receipt with verified coverage and failure artifacts |
| E2.4 and E2.9 | Terminal Open States event receipt; E2.9 also requires explicitly final coverage |
| E2.5 | Terminal Congress.gov meetings and hearings receipt with verified coverage and failure artifacts |
| E3.5 | Terminal Congress.gov House vote receipt with verified coverage and failure artifacts |
| E4.3 | Terminal Congress.gov amendment receipt with verified coverage and failure artifacts |
| E4.6 | Terminal federal supporting-material receipt with verified coverage and failure artifacts |
| E4.7 | Terminal Open States supporting-material receipt with verified coverage and failure artifacts |
| M4.31 | Successful terminal Open States import plus verified manifest, coverage, and failure artifacts |
| M5.28 | Successful terminal GovInfo import plus verified manifest, coverage, and failure artifacts |
| M14.10 | M4.31 evidence whose coverage receipt is explicitly final |
| M14.11 | M5.28 evidence whose coverage receipt is explicitly final |
| M14.12 | Complete discovery-to-coverage reconciliation with zero unexplained material gaps |

The manifest is strict JSON with `version: 1` and `environment: "development"`. Artifact paths are relative to the
manifest, use forward slashes, and cannot escape its directory. Artifact IDs and paths must be unique. The audit output
contains every artifact verification and a sorted reason list for every open gate.

## Deliberate exclusions

This audit does not evaluate or close authenticated research quality, two-client compatibility, human source review,
manual extraction review, production release, or data-expansion backfills. In particular, the fixture-backed MCP
evaluation is useful contract evidence but cannot satisfy D4, E6.9, or M14.27 through M14.33. The corpus evidence audit
continues to own human sample and document-processing proof; this audit can consume its final passing result but cannot
replace it.

## Current retained evidence finding

The retained files in `work/` include source discovery manifests, progress coverage reports, execution definitions, and
a local fixture-backed MCP evaluation. The most recent reviewed coverage snapshot contains incomplete Open States
checkpoints and millions of pending documents, so it is interim evidence. The local MCP artifact explicitly records that
authentication, a second client, live corpus behavior, and human review are absent. No current unchecked final or human
gate should be closed from those files alone.

Once live runs finish, their sanitized receipts can be placed next to the manifest, hashed into its `artifacts` array,
and audited without reconnecting to the live environment. Secrets, tokens, connection strings, and raw environment
files must never be included in an evidence bundle.
