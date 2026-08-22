# Document-processing operations

## Purpose

This page describes the reusable operating rules for bill documents,
supporting materials, and OCR. It intentionally excludes rollout timestamps
and one-off production counts. Incident history and proof for individual
publisher fixes live in the
[ingestion remediation catalog](ingestion-remediation-catalog.md).

## Pipeline

1. A synchronization worker creates or updates a canonical bill document or
   supporting-material row. The stored `source_url` remains the provider's
   original identity.
2. A derived controller drains one deterministic shard through bounded child
   runs.
3. The child acquires a database ingestion lease, claims eligible rows,
   downloads through the shared publisher limiter, stores source bytes, and
   extracts text.
4. Image-only files are handed directly to `ocr-document-worker`. OCR updates
   the same row and sections; it never creates a second document identity.
5. Retryable failures retain their attempt and backoff timestamps. Proven
   permanent outcomes become `unsupported` with a specific error category.
6. Embeddings remain a separate, explicitly approved phase after document,
   material, and OCR gates are clean.

## Parallelism

| Work | Partitioning | Child bound | Database connections | Queue ceiling |
| --- | --- | ---: | ---: | ---: |
| Bill documents | 64 deterministic jurisdiction lanes; a large jurisdiction may replace its lane with 2-8 ID partitions | 100 rows | 1 | 64 |
| Supporting materials | 24 deterministic material-ID shards | 25 rows | 2 | 64 |
| OCR | Explicit IDs handed off by document or material workers | 100 IDs | 1 | 12 |
| Embeddings | 4 deterministic shards | Provider-bounded | 1 | 64 shared derived queue |

A document partition is not a publisher allowance. Every partition and every
Trigger deployment shares the durable host slots in PostgreSQL. Adding workers
can improve extraction and persistence throughput, but cannot bypass a
publisher's configured concurrency or request-start interval.

PDF extraction is serialized inside each document or material worker to bound
heap growth. Large or image-only PDFs are sent to managed OCR rather than held
inside a long local extraction run.

## Starting or replacing a lane

Never run a whole-jurisdiction lane beside partitions for that jurisdiction;
their selectors overlap even though their lease names differ.

1. Inspect the existing controller, child, ingestion run, row claims, and
   publisher leases.
2. Stop only the controller being replaced and wait until every descendant is
   terminal.
3. Confirm the old ingestion lease is absent or expired.
4. Recover only rows provably owned by the interrupted run, using its exact
   scope and claim-time window. Do not reset a jurisdiction-wide failure set.
5. Launch disjoint controllers on the current Trigger deployment with a new
   rebuild ID and unique idempotency keys.
6. Confirm every replacement owns a distinct scope before recovering any old
   claims.
7. Inspect the first bounded children, then a 30-minute aggregate before
   changing publisher limits.

Trigger versions apply to the entire project. A controller that started on an
older deployment continues to create children from that deployment until it is
retired. Deploying code alone does not upgrade a waiting controller.

## Retry and recovery rules

- A normal publisher wait returns the next eligible time to the controller;
  it is not a task failure.
- HTTP 408, 429, and 5xx responses, timeouts, and evidenced transport faults
  use bounded retry with persisted backoff.
- HTTP 403/404 and malformed responses are terminal only when the resolver or
  classifier has publisher-specific evidence.
- If Trigger retries the same run after an abrupt interruption, the worker may
  recover only its own matching ingestion run, lease, shard, and claim window.
- A genuinely different lease owner must finish or expire; another worker may
  not steal its claims.
- OCR missing-artifact recovery clears only the stale artifact state and
  returns the same row to ordinary document processing for download.

Publisher-specific URL resolvers, trust-chain additions, cooldowns, and exact
remediation cohorts are documented in the
[remediation catalog](ingestion-remediation-catalog.md#document-source-and-format-failures).

## Safety and completion gates

Keep a canary only while all of these are true:

- database sessions remain below the operational alert threshold of 80;
- no overlapping lane and partition selectors are active;
- no current-version OOM, system failure, or unbounded continuation loop is
  present;
- publisher 429, 5xx, timeout, and fetch-failure rates do not materially rise;
- old `processing` claims are recovered only after ownership is disproven;
- unsupported outcomes have an evidence-based category rather than a generic
  transport error.

Bill-document completion requires zero pending rows, active claims, due
retryable failures, deferred retryable failures, and eligible bill-document
OCR rows for the relevant scope. Federal supporting materials may begin once
that gate is clean for `jurisdiction:us`; unrelated state tails do not block
the federal material phase.

Supporting-material completion requires zero pending rows, active claims, due
or deferred retryable failures, interrupted claims, and eligible material OCR
rows. The material controller waits for OCR children before declaring its shard
complete.

Embeddings stay paused until both gates are clean, validation passes, and an
explicit cost-controlled rollout is approved.

## Observing progress

Do not estimate completion from `pending` alone. A useful checkpoint records:

- pending, processing, processed, failed, and unsupported counts;
- due and deferred retryable counts under the configured attempt policy;
- eligible OCR counts;
- terminal child throughput over at least 30 minutes;
- current Trigger task versions and queue pressure;
- ingestion and publisher leases;
- database sessions, active sessions, and idle-in-transaction sessions;
- provider errors grouped by hostname and category.

When the remaining corpus is publisher-limited, divide only eligible work by
the measured terminal rate for that publisher. Historical aggregate rates are
not a reliable estimate for the final tail.
