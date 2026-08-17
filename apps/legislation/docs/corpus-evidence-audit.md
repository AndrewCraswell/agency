# Development corpus evidence audit

## Purpose

The corpus evidence audit turns already-collected development evidence into one deterministic D2 and D3 gate report.
It reads a local JSON manifest plus local evidence files, verifies every declared SHA-256 digest, calculates processing
rates, and reports each roadmap task independently. It does not connect to Railway, providers, Blob Storage, or an
embedding service, and it does not mutate the corpus.

The audit is fail-closed. Missing samples, missing artifact files, hash mismatches, unexplained material gaps, incomplete
inventories, repeated unchanged-content work, or rates below a gate produce a nonzero exit code.

## Run the audit

From `apps/legislation`, run:

```powershell
pnpm exec tsx scripts/audit-corpus-evidence.ts `
  --input work/corpus-evidence/manifest.json `
  --output work/corpus-evidence/audit.json
```

Paths in the manifest are relative to the manifest directory and must use forward slashes. The command prints a compact
result containing the output path and `ready` state. Omit `--output` to write the full report to standard output. Exit
code `0` means every audited gate passed; exit code `1` means the manifest is invalid or at least one gate failed.

The report uses the manifest's `generatedAt` value and does not read the current clock. Identical input bytes and
evidence files therefore produce identical report content.

## Manifest sections

The top-level manifest is strict and uses `version: 1` and `environment: "development"`. It contains:

- `stateSamples`: Human comparisons with original Open States records. At least four unique records must collectively
  cover large, small, recent, older, dense, and sparse strata. Each record checks identifier, title, actions, sponsors,
  votes, and documents.
- `federalSamples`: Human comparisons with GovInfo metadata and official text. At least four unique records must cover
  at least two Congresses and two bill types.
- `convergenceSamples`: GovInfo and Congress.gov bill and version identifiers. At least two bills must converge on the
  same canonical bill IDs and version IDs.
- `upstreamArtifacts`: Discovery-to-database reconciliation. Every in-policy count mismatch or unavailable count needs
  a category, specific explanation, and next action. Excluded artifacts need a policy explanation.
  `upstreamArtifactExpectedCount` must equal the number discovered across the retained manifests.
- `documentInventory`: Per-document source, format, version status, acquisition state, extraction state, section count,
  and embedding state captured no later than `processingStartedAt`. `documentInventoryExpectedCount` must equal the
  number of unique inventory records.
- `extractionSamples`: Human review of XML, HTML, text, and PDF output against official artifacts, including text and
  legal section-boundary outcomes.
- `processingCohorts`: Final source-and-format totals for attempts, acquisition, extraction quality, fallback
  segmentation, searchable text, failures, sections, and embeddings.
- `idempotencyRuns`: A baseline and replay run for unchanged documents. Content-set hashes must match and download,
  extraction, section-write, embedding-request, and canonical-mutation counts must all be zero.
- `investigations`: One resolution for every source-and-format cohort below a gate. Implementation defects require a
  targeted rerun ID; any remaining release blocker fails the audit.
- `embedding`: The model identifier and dimensions retained with the evidence.
- `evidenceArtifacts`: Relative path, SHA-256 digest, timestamp, run IDs, and category for every retained file.

Timestamps use ISO 8601 UTC values. Hashes are lowercase 64-character SHA-256 values. Run IDs are UUIDs. Unknown fields
are rejected so a misspelled evidence property cannot silently disappear.

## Calculated development gates

The audit maps its results directly to the remaining roadmap tasks:

| Task | Deterministic proof |
| --- | --- |
| D2.6 | Complete Open States strata and required field comparisons with no unresolved defect |
| D2.10 | GovInfo metadata and official-text comparisons across Congress and bill-type strata |
| D2.12 | GovInfo and Congress.gov convergence for canonical bill and version IDs |
| D2.14 | Every material discovery-to-database gap has a specific category, explanation, and action |
| D2.15 | Every required D2 artifact exists and matches its declared digest |
| D3.1 | The pre-processing per-document inventory is complete, unique, timely, and hash-verified |
| D3.4 | XML, HTML, text, and PDF samples have human-reviewed text and section boundaries |
| D3.6 | Unchanged-content replay performs no redundant processing or canonical mutation |
| D3.7 | Every inventoried source-and-format cohort has internally consistent processing metrics |
| D3.8 | 100% attempted, 100% categorized failures, at least 95% searchable text, at least 99% embedded sections |
| D3.9 | Every below-gate cohort has a non-blocking resolution and targeted rerun when it was an implementation defect |
| D3.10 | Every required D3 artifact is hash-verified and the recorded embedding contract is correct |

The D3.8 denominators are explicit: available documents for the attempt rate, acquisition plus extraction failures for
failure categorization, acquired supported documents for searchable text, and successfully extracted sections for
embedding completion. A zero denominator cannot establish the attempt, searchable-text, or embedding gate.

## Required artifact categories

D2.15 requires `openstates-discovery-manifest`, `govinfo-discovery-manifest`, `congress-sync-checkpoint`,
`coverage-report`, `failure-report`, `corpus-validation`, `sample-records`, `command-parameters`, and `run-records`.

D3.10 requires `document-inventory`, `processing-report`, `embedding-report`, `extraction-sampled-review`,
`document-exceptions`, `embedding-model`, `content-hashes`, and `idempotency-report`.

Each category may contain more than one artifact, but at least one file in every required category must pass digest
verification. Artifact paths must remain inside the manifest directory.

## Evidence boundary

The tool validates the completeness, consistency, rates, and integrity of recorded evidence. It cannot perform the human
source comparisons required by D2.6, D2.10, or D3.4, and it does not prove that a declared official URL was reviewed.
Those records must be produced by a reviewer during the live corpus run. Likewise, the tool cannot complete D2.11,
D3.2, D3.3, or D3.5 because those tasks require authenticated provider access and live corpus processing. A passing
audit is release evidence only when its input artifacts came from those completed live activities.
