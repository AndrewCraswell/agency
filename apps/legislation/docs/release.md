# Release procedure

## Current release target

The active target is a development completion record, not a production launch. Complete steps 1 through 6 against the
development environment, then satisfy phase D5 in the
[development completion roadmap](mvp/development-completion.md). Production promotion in steps 7 and 8 is deferred and
is not scheduled in the current [legislative data expansion roadmap](roadmap.md).

## Procedure

1. Run the app verification suite, Bicep build and lint, Docker build, migration-from-zero test, and workflow JSON parse.
2. Produce state and federal coverage reports plus `corpus:validate`; explain every material upstream gap.
3. Run retrieval and MCP evaluation cases in two supported MCP clients and record evidence, latency, and failures.
4. Review Bicep what-if, least-privilege assignments, TLS, network exposure, managed identities, and Key Vault references.
5. Deploy an immutable image digest to staging, migrate, import a bounded corpus, process documents and embeddings, and
   run the authenticated deployment smoke test.
6. Validate alerts, Azure logs, Langfuse traces, checkpoint replay, provider throttling, shutdown, backup restore, and a
   revision rollback in staging.
7. Deploy production infrastructure and the same tested image digest, migrate, run historical bootstraps, enable approved
   schedules, and run all seven tools through authenticated smoke tests.
8. Record release version, image digest, migration journal, coverage, completion rates, evaluation baseline, known
   upstream limitations, owner, and rollback revision.

External release evidence is intentionally not fabricated. A phase is operationally complete only after the target
subscription, WorkOS tenant, OpenRouter account, provider credentials, n8n instance, Langfuse project, and two MCP clients
have produced the evidence above.

## Local performance baseline

The 2026-08-16 release audit ran 30 lexical `search_bills` MCP calls against local PostgreSQL with concurrency 5. The
empty-corpus mixed cheap, high-limit, and passage-query baseline was p50 51.4 ms, p95 188.8 ms, and p99 190.2 ms
against the 2,000 ms p95 gate. This is a transport and query-overhead baseline only; staging must repeat the benchmark against the representative corpus
and expected Container Apps concurrency before release.
