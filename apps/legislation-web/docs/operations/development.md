# Development, runtime and observability

## Requirements

- Node.js 24 or newer.
- pnpm 11.
- Docker Desktop or another Docker Compose-compatible runtime for PostgreSQL integration work.
- The monorepo dependencies installed from the repository root.

## Commands

From the repository root:

```text
pnpm install
pnpm --filter legislation-web dev
pnpm --filter legislation-web test
pnpm --filter legislation-web check:types
pnpm --filter legislation-web lint
pnpm --filter legislation-web build
```

`dev` starts W's Next.js runtime. M has its own standalone development command and I has its own worker/relay commands.
For the VPN-constrained AI SDK installation and its local archive checksum, see the
[vendor installation note](../../vendor/README.md). Use the root frozen-lockfile install with the configured Microsoft
feed; no public-registry switch or TLS bypass is required. `pnpm test` runs web-owned tests only. For a focused check,
change into W and run `pnpm exec vitest run <exact-test-file>`.
See [test ownership and execution](testing.md) for W-local profiles and the single coordinated legislation gate.

The public deployment boundary is the Next.js `src/app/api` Route Handlers. The deleted `legislation-api` Railway service
must not be started or redeployed. Both runtime checks expose:

- `GET /health` for process health.
- `GET /ready` for dependency readiness.

## Runtime configuration ownership

`loadConfig` validates application settings, including database connections, the public API URL and the request-body
limit. Next.js owns the listening host/port and process shutdown; use its CLI/runtime settings rather than the removed
`LEGISLATION_HOST`, `LEGISLATION_PORT` or `LEGISLATION_SHUTDOWN_TIMEOUT_MS` variables.
`LEGISLATION_PUBLIC_API_BASE_URL` identifies the public API origin; it does not configure the listener.

[Langfuse settings](../../src/services/langfuse/client.ts) owns W's credential validation and endpoint default
(`https://us.cloud.langfuse.com`), shared by its HTTP client and Node telemetry initialization. `loadConfig` does not
read or validate Langfuse variables. Telemetry startup still rejects incomplete key pairs, and enabled integrations
still require an HTTPS endpoint. Sentry initialization and database settings are unchanged.

## Local environment after the move

The rename moved tracked files, not local credentials or evidence. In this checkout, the existing `.env`, `data` and
`artifacts` remain under `apps/legislation`; the new workspace must not be assumed configured. Do not print or read
secret values into terminal output, chat, documentation or reports during this audit.

Before starting a runtime, manually relocate its required settings locally using a trusted editor or secret manager.
Use W's `.env.example` as the variable-name reference and an ignored `apps/legislation-web/.env` for Next.js. Put only
I-owned settings in an ignored `apps/legislation-ingestion/.env`. Do not copy the old combined environment wholesale,
move unrelated credentials, or change external credentials as part of this path repair. M must receive only its own
authentication and outbound API settings, never database, source-provider or model keys. Verify ignore status before
saving a local environment file; never stage it.

Next.js loads W's local environment files. I's `tool`, backfill, schedule and deploy-check launchers explicitly load
I's `.env`; do not assume every CLI, relay or test command does. For those commands, M, and C's database helpers,
supply the required process environment through the trusted local runner. W's `db:migrate` delegates to C, which reads
`DATABASE_URL` from that environment and does not load W's `.env`. Use the direct administration connection for that
explicit release action. No startup performs migration or credential relocation.

Leave retained local data and artifacts in place unless a specific operation requires an explicit local relocation or
configured path. Relative defaults now resolve from the owning workspace. Do not overwrite historical inputs, assume
that new data paths are ignored, or move credentials with Docker build inputs. See [local artifacts](#local-artifacts)
and [I setup](../../../legislation-ingestion/docs/operations/development.md#local-artifacts).

## Development chat research connection

The chat route supports a public production demo when the server-side model key and trusted HTTPS
`LEGISLATION_PUBLIC_API_BASE_URL` are configured. Production requests must match that exact origin; development
remains same-origin/loopback constrained. Origin checks are browser request protection, not authentication. The owner
approved anonymous demo access and retaining unmasked Replay for this release. It calls the existing query service
directly using `createLegislationResearchTools`, the same validated registry used by the public MCP handler. No internal
HTTP request, MCP URL or bearer token is needed. The old chat-specific MCP URL/token settings have been removed.

OpenRouter still requires its server-side model key, and the existing database configuration must be reachable.
Public `/api/**` and `/mcp` authentication has not been changed. Chat exposes the shared allowlisted read tools;
the organization-gated legal-text reader is not passed to the registry, and private account/mutation tools remain excluded.
Relationship analytics uses `describe_analytics` and `analyze_legislation` from the same registry. M forwards analytical
plans to authenticated `POST /api/analytics`; chat executes the identical compiler in the read-only runtime. See
[the query contract and acceptance procedure](../../../../packages/legislation-core/docs/engineering/relationship-analytics.md).
The [research runtime](../../src/modules/search/research-runtime.ts) owns process-cached pools that honor
`DATABASE_MAX_CONNECTIONS` and `PASSAGE_SEARCH_MAX_CONNECTIONS`, without a separate research clamp. A cancellable
FIFO queue waits for configured capacity before opening or checking out a connection. Connection establishment still
has its configured deadline; time waiting for capacity is not a connection failure.
The query service acquires a client only for SQL or an explicit transaction, not while embedding or reranking.
Reads use `BEGIN READ ONLY` and transaction-local `set_config`, not rejected PgBouncer startup fields.
Explicit transactions preserve their pinned connection and nested savepoints. Individual requests release their clients
but must not close the shared pools. The optional ranked passage store uses the same cancellation and transaction-local
approach without enabling any unapproved search cutover. Capacity remains finite and must be budgeted across replicas
and other workloads; this change does not resize PostgreSQL or PgBouncer.

Conversation answers use `openai/gpt-5.6-luna-20260709` with **high** reasoning by default, selected by
`researchReasoningEffort` in the conversation agent. Chat trace metadata uses the same setting. The September 18 upgrade
does not change the answer prompt, model ID, retry policy or budgets. Homepage suggestions, offline quality judges and
the analytics acceptance harness remain explicitly at low reasoning; configured evaluation candidates retain their
selected effort (low when omitted). Hosted Langfuse evaluators are unchanged. There is no automatic model routing or
Astra escalation in the application.

Each accepted chat request appends trusted server time and the current UTC calendar date to the model instructions
and records that date context in the research trace input. This context is refreshed per turn, including clarification
resumes; managed prompt versions remain unchanged. Date-only cutoffs default to UTC unless the user specifies a
timezone. The same context governs answer prose and clarification fields: past, today and future dates remain distinct,
and source freshness, legal effective dates and incomplete same-day coverage are separate qualifications. Fixed-clock
route tests verify the actual model input and unchanged user cutoffs across midnight and timezone offsets for prose and
clarification streams. These deterministic fixtures establish context delivery, not live-model semantic accuracy.

Chat and evaluation research turns have no application-wide elapsed-time deadline. Explicit cancellation still stops
the run. Dependency-owned deadlines remain in place: connection establishment, PostgreSQL statements, model-provider
requests and external web requests. Neither the research runtime nor the shared tool registry races an entire operation
against a second 30-second timer. Standalone MCP retains cancellation and its configured outbound HTTP API deadline.
Canonical SQL defaults to 15 seconds, optional ranked SQL to 10 seconds, and supporting-material lexical SQL to 5 seconds.
These defaults are unchanged: raise or optimize them from query-plan and latency evidence, not from time spent queued.
Research has no tool-call count or model-step cutoff. Tools remain available until the model finishes, requests
clarification, or the run is cancelled or fails. Failed calls do not consume a separate research allowance.
Each model-visible tool result remains bounded to 180,000 bytes. Research serialization omits
internal embedding and search-index fields. The shared chat/MCP bill discovery contract returns snippets, identifiers, sources, and child
metadata instead of full summaries and embedded document bodies. Research tools must retrieve relevant passages using
`search_bill_text` or read a selected version using `get_bill_text` before making substantive claims about provisions.
Version-text reads omit the duplicate full document body but retain document metadata and complete source sections.
The shared tool registry splits oversized bill search pages, bill batches, and passage/section pages before transport
validation; normal page, batch, and child limits remain unchanged. Opaque continuations
preserve upstream pagination and require the same tool, filters, IDs, and limits. Continuations re-run the original
read and advance within its result window; they work across stateless requests and replicas without retained data.
They do not promise snapshot isolation when the underlying records change. Model, UI, and MCP paging share this path.
Indivisible sections use lossless text windows; oversized metadata and records use snapshot-bound JSON fragments.
The app reconstructs fragments before publishing logical evidence or result cards, marks incomplete assembly explicitly,
and pages citation enrichment separately when necessary. It does not resend an unbounded reconstructed body.
Changed source snapshots invalidate a continuation rather than combining different records. See
[exact selections and payload handling](../engineering/conversation-research-selection.md).
The public MCP
transport limit is unchanged. These limits bound a request and do not impose a conversation count. No transcript is saved
server-side; follow-ups re-fetch evidence instead of trusting client-supplied tool output. Tavily/Firecrawl remain later work.
Cancellation removes queued research work, stops further SQL and discards the active client and late results.
PostgreSQL statement deadlines still bound server execution if a server or pooler has not yet observed the disconnect.

Optional Firecrawl tools retain the 1,000,000-byte response-body bound. `FIRECRAWL_SEARCH_TIMEOUT_MS` and
`FIRECRAWL_READ_TIMEOUT_MS` independently configure search and page-read deadlines (30,000 ms by default,
1,000-300,000 ms). Each deadline includes retries and response reading, and caller cancellation also stops retry waits.
Oversized web content fails explicitly with provider-specific narrowing guidance; it is never clipped or presented as
an empty successful result.

OpenRouter retrieval uses independent `OPENROUTER_EMBEDDING_TIMEOUT_MS`, `OPENROUTER_RERANK_TIMEOUT_MS` and
`OPENROUTER_GENERATION_TIMEOUT_MS` settings (30,000 ms per attempt by default, integer range 1-300,000 ms).
The generation setting applies to retrieval-client completions, not the entire conversation turn. Retrieval and web
requests retry only transient HTTP/network failures, with three attempts and cancellable backoff; invalid requests,
schema failures and oversized bodies are not retried. The conversation agent separately allows two SDK retries for
retryable provider failures and no longer overrides the provider's output-token allowance.

When `DATABASE_URL` uses transaction-mode PgBouncer, configure `DATABASE_DIRECT_URL` with the same database's direct
PostgreSQL endpoint for the public API and readiness pool. That pool sends a PostgreSQL startup statement timeout,
which PgBouncer can reject with `08P01: unsupported startup parameter: statement_timeout`. Research continues to use
`DATABASE_URL` with transaction-local deadlines. Without a direct override, the API uses `DATABASE_URL`, which must
support startup parameters. Direct API connections retain `DATABASE_MAX_CONNECTIONS`; budget these alongside pooled
research/worker backends. Restart Next.js after changing connection configuration because pools are process-cached.
The optional passage-search API pool likewise requires a startup-parameter-compatible endpoint.

Model-facing optional tool fields explicitly accept null, which is removed before the canonical input schema validates
the request. Empty strings and invented omission markers are not accepted as cursors. Chat only accepts continuation
tokens observed in successful results during the current turn; backend cursor/query binding remains authoritative.

The original AI-in-education question completed live search and bill-detail calls and returned sponsor names with
New Jersey A4352 and Massachusetts H614 source links. Two larger detail calls failed before narrower retrieval
succeeded; broader batch and cancellation acceptance remains open. No full unit suite was run for this repair.

## Homepage research suggestions

The root route `/` renders `HomepageLanding`, including the research composer, source-backed example and the
connections and coverage sections. Its tests live in `src/app/page.test.tsx`. There is no separate preview route.

`ChatWorkspace` requires a conversation ID and only renders conversation routes; it has no alternate homepage or
first-question navigation. `HomepageLanding` starts research and navigates, while the root layout's `ChatProviders`
retains the same session, references and active stream across that transition. The workspace integration suite starts
from this real homepage before checking follow-ups, interruption and export. Storybook's `Conversation/Inputs`
suggestion states also render `HomepageLanding`, including its loading and empty-result behavior.

The homepage uses Luna (`openai/gpt-5.6-luna-20260709`) and the Langfuse text prompt
`legislative-research-suggestions`, selected by its `production` label. Version 1 was created September 16, 2026;
the existing `legislative-research` prompt is unchanged. The server compiles `{{current_date}}` as a UTC calendar date
and validates exactly six distinct questions covering sponsor, action, comparison and hearing approaches.
Questions are limited to 110 characters and descriptions to 100. They are research invitations, not verified findings;
the prompt prohibits invented records, unsupported news claims and guaranteed coverage.

Suggestions stream through a local Suspense boundary without blocking the composer. Selection fills and focuses the
editable question without sending. All six ideas appear in a responsive cloud with matching loading skeletons.
Each request generates fresh ideas; neither completed results nor in-flight requests are shared or cached.
A generation has a 45-second deadline, 2,000 output-token limit and no automatic model retries. Failures produce
no hardcoded fallback, leave research usable, and are reported to Sentry without a cooldown. Disconnected research
does not generate suggestions. There is no public regeneration endpoint or per-visitor profiling.

Generation observations use `legislative-research-suggestions` with the exact prompt version, model, validated output
and token usage. They are separate from `legislative-research-conversation`, so the existing native conversation
evaluation rule is not applied to idea generation. Hosted prompt wording owns topical variety and neutral voice;
source-backed answers still depend on the ordinary research tools and citation checks.

## Conversation reload recovery

### Inline person and committee tags

Typing `@` opens the grouped name picker. Queries of at least two characters debounce for 300ms; a new query,
dismissal, blur, or unmount aborts the previous lookup and discards late results. The `search-references` action's
`mention` kind returns at most five people and five committees. PostgreSQL `pg_trgm` ranks published names with
`word_similarity`; nickname aliases are not inferred. Organization candidates must have classification `committee`.
The baseline migration enables `pg_trgm`; existing databases need that extension enabled explicitly before this code
runs. It was enabled on the configured development database during local acceptance. No application records were reset.

The shared Tiptap editor stores text and atomic mention segments, each carrying the selected `resultId`, `recordId`,
and display snapshot. Removal drops that inline reference; repeated tags deduplicate by record kind and ID. Ordinary
typed names do not become references. The separate `+` library remains independent. First messages and follow-ups
combine explicit references with remaining inline tags, capped at 12 distinct references, and send only reference IDs
alongside plain message text. The server resolves those IDs against the session-owned result store before adding them
as identity context, never as instructions, citations, or corpus restrictions. Expired or foreign references fail closed.

`composerSubmissionBlockedReason` is the shared submission policy: homepage and follow-up controls and defensive
submit handlers consume its explicit unavailable, restoring, busy, reference-limit, or empty reason. Running research
and clarification confirmation are busy states. `/export` eligibility remains a workspace concern, as do session and
navigation guards. `MAX_CONVERSATION_REFERENCES` in the request contract owns the limit across request validation,
checkpoints, and reference selection. Inline suggestions, the reference library, and profile Ask actions count the
distinct union of inline and staged identities; selecting an existing kind/record pair at the cap remains allowed.

History recall and development checkpoints retain structured draft segments rather than guessing identity from names.
Pasted markup cannot manufacture trusted mention nodes. The input stories use the production composer with isolated
fixture search, including loading, failure/retry, empty, keyboard, and selected states. Enter chooses an active suggestion
without sending; outside the picker desktop Enter sends, while Shift+Enter and mobile Enter retain multiline editing.

The conversation composer supports Up/Down history recall of previously sent, visible user messages. Up moves
from newest to oldest without wrapping; Down moves forward and restores the unsent draft. Recalled text is selected
for editing and is never submitted automatically. Editing starts a new recall cycle. For multiline drafts, recall
starts only at the beginning (Up) or end (Down); modifier keys, other selections, and IME composition retain normal
editing behavior. Hidden clarification-continuation messages are excluded. Browser checks cover history boundaries,
draft restoration, edited recalls, multiline caret movement, selected text, composition, and mobile-width keyboard use.

During `next dev`, the current conversation is checkpointed in this tab's `sessionStorage` under
`rostra.development.conversation`. Full development reloads restore the conversation ID, messages, retrieved evidence,
draft, and confirmed clarification answers. React Fast Refresh keeps live state rather than replaying an older checkpoint.
Only one conversation is retained per tab; starting another replaces the checkpoint. This is not server-side history.
Browser session restoration may also restore session storage, so do not treat closing the browser as guaranteed deletion.
Clear the entry or the site's storage to remove the checkpoint explicitly.

A full reload interrupts an active model request; it does not resume a running stream. Retained partial output is
marked incomplete and Retry starts a new response. Unanswered clarification forms restore as expired because their
server-side state may have disappeared; confirmed answers remain readable. Invalid checkpoints are discarded, and
unavailable or full browser storage produces a warning rather than crashing chat. Completed conversations and drafts,
pending-request reload, keyboard Retry, and a 390px mobile layout have been checked in the integrated browser.

Checkpointing is development-only. Production retains the existing in-memory, refresh-expires behavior. This exception
was requested to keep code edits and full development reloads from erasing demo conversations.

## Sentry error monitoring

External adapters live in `src/services/sentry`, `src/services/openrouter`, and `src/services/langfuse`. Framework
instrumentation stays under `src/`. Conversation and evaluation modules supply feature policy to the adapters;
moving code does not change credentials, provider/model selection, prompt labels, or hosted evaluator configuration.
Browser instrumentation imports the browser-safe Sentry options, never the Langfuse Node SDK initializer.

The Next.js app uses pinned `@sentry/nextjs` 10.73.0. Set `NEXT_PUBLIC_SENTRY_DSN` to the
`legislation/legislation` project DSN to enable it, then restart development or rebuild the browser bundle.
Without a DSN, monitoring is disabled. The DSN is public configuration, not an authentication credential.
Optional `SENTRY_AUTH_TOKEN` is build-only and enables source-map upload; never expose it through a public variable.
No Railway settings or deployment have been changed for this integration.

Browser exceptions, React error boundaries, Next request failures, and chat stream/tool failures are captured.
Caught API 5xx responses are reported in the shared `apiErrorResponse` boundary; expected 4xx validation responses
are not server errors. AI SDK client transport failures and failed clarification transport/response parsing are
explicitly reported because handled promise failures do not reach browser global handlers.

Every chat tool failure is observed through the SDK stream, including invalid arguments and unknown tool names
before execution, clarification-tool errors, and research execution failures. A per-run reporter deduplicates by
tool-call ID across the execution wrapper and stream. Invalid tool calls are captured before the SDK converts their
errors to strings. Events retain a run ID, tool-call ID, known tool name, failure category, and reference; available
duration/result-size metrics are allowlisted. Actual timeouts are reported; intentional user stops are not errors.
This is observability, not durable orchestration or a replacement for the existing AI SDK research loop.
By explicit demo-owner direction, no application-level `beforeSend` scrubber rewrites error messages, stack traces,
tags, contexts, or extra fields. Diagnostic payloads remain available in Sentry as captured. Automatic personal-data
collection remains disabled; this is not an invitation to send credentials or provider keys. Stop requests do not
produce research failure events. Citation issue grouping is set by its reporter, independently of Sentry filtering.
Error logs and performance tracing remain disabled. Sentry does not register another OpenTelemetry provider.
This error-event policy does not cover Replay recordings or the pre-existing logging and Langfuse pipelines.

Session Replay is enabled for the demo at 100% in development, 10% of sessions otherwise, and 100% on errors.
By explicit demo-owner direction, text/input masking and media blocking are disabled: visible questions, answers,
source content and ordinary form input can be recorded. Use non-sensitive demo data. Request/response body capture
remains off; custom console/network recording events are discarded. Error events retain replay correlation.
Review this deliberately unmasked policy before any public production rollout.

VS Code's `sentry` MCP entry uses hosted OAuth scoped to `legislation/legislation`. Start that server and complete
Sentry sign-in in VS Code when ready. It is an editor tool, not a public-chat research capability, and no access token
or model-provider key is stored in its configuration. OAuth and real event receipt have been verified through MCP
(`LEGISLATION-1`, environment `sentry-smoke-test`); the local DSN is configured. Browser Replay receipt has also
been verified. Source-map upload remains unverified. Citation failure receipt is confirmed in `LEGISLATION-J`.

Verification includes a real SDK/mock-model probe for execution, invalid-input and unknown-tool failures (three
events, no duplicates), browser transport-event delivery, and malformed citation links rendering without an error
boundary crash. These focused checks do not establish full ingestion/worker observability or production acceptance.

## Conversation telemetry

With both Langfuse keys configured, the Node server registers the official AI SDK 7 integration.
Each research run propagates the conversation's persisted `sessionKey` as the Langfuse `sessionId`.
Turns, retries, and clarification continuations therefore share a session, including after reload recovery;
new conversations receive a new UUID. Individual runs remain separate traces. Evaluation cases use their
own session UUID across follow-up turns.

Telemetry is flushed after the streaming response completes. The existing telemetry redaction and truncation
policy applies, and media uploads are disabled. Model inputs and outputs are recorded, so use non-sensitive
demo data. Without Langfuse keys, chat telemetry registration is skipped.

## Local PostgreSQL

Follow [C's database setup and reset procedure](../../../../packages/legislation-core/docs/operations/development.md).
W and I share its schema artifacts, not copies of infrastructure or migrations. W's explicit release command is
`pnpm --filter legislation-web db:migrate`; neither startup nor readiness applies migrations.

## Package scripts and specialist tools

Keep `package.json` scripts limited to package lifecycle, local infrastructure, release checks, and deployment
automation. Specialist maintenance and evaluation programs live under `tools`, grouped by ownership, and run through
`pnpm tool <area>/<name>`. Use `pnpm tool --list` to discover them. Do not add a package alias for an individual tool.

| Entry point | Purpose | Retention rule |
| --- | --- | --- |
| `scripts/smoke-local.mjs` | Start the real local service and verify health and readiness. | Permanent release check. |
| `scripts/smoke-deployment.mjs` | Verify W health, readiness, exact deployed commit and authenticated API behavior. | Dedicated WorkOS API M2M client ID/secret, issuer, explicit W origin and `LEGISLATION_DEPLOYMENT_COMMIT_SHA` or `GITHUB_SHA`; M owns its separate smoke. |

Source storage checks, backfills and Trigger schedule reconciliation belong to
[I's operator guide](../../../legislation-ingestion/docs/operations/development.md). Migration assets belong to C;
W owns their explicit release invocation. The retained Bicep tree is historical reference, not a deployment template for M.

## Container and Railway build

The recorded Railway service is named `legislation-web`. Its image uses the repository root as Docker context so pnpm
can resolve the root lockfile, catalog, core and shared TypeScript package. The Dockerfile installs W's dependency closure,
builds the Next.js application, and runs the standalone output as a non-root process.

From the repository root:

```text
docker build -f apps/legislation-web/Dockerfile -t legislation-web:local .
```

Railway config-as-code lives at `apps/legislation-web/railway.json`. Keep the service root
at the repository root and explicitly configure that path; nested config is not discovered automatically.
Before release, verify the effective service uses the Dockerfile builder, `apps/legislation-web/Dockerfile`, and `/ready`
health check. Railway injects `PORT`; the service binds it on `0.0.0.0`. Apply migrations as a separate, explicit
release operation with `pnpm --filter legislation-web db:migrate`; neither image build nor W/I/M startup runs migrations.
The target staging, preview, migration, CDN and production-promotion workflow is defined in
[environments and deployments](../../../../docs/environments-and-deployments.md). It remains a target contract until its
activation checklist passes.

Use the [API contract](../engineering/api/README.md) for current behavior
and [Next.js runtime](#nextjs-runtime) for the active runtime contract. Do not copy historical deployment IDs into a
new rollback command; identify and verify the immediately preceding successful `legislation-web` artifact. The old
`legislation-api` service is deleted. M owns API-backed MCP and separate authentication; extraction is not live acceptance.

After Railway allocates the public service domain, set `LEGISLATION_PUBLIC_API_BASE_URL` to that exact `https` URL.
This required production variable is the trusted base for canonical API URLs; it must not be derived from request headers.

## Local artifacts

W retains chat/evaluation evidence. Source archives, normalized documents, OCR publication and storage-adapter settings
belong to [I's runtime guide](../../../legislation-ingestion/docs/operations/development.md). Ignored historical artifacts
were not blanket-moved; documentation relocation does not change their physical paths.

## Workspace boundary

W owns product/API/query runtime, I owns workers, M owns MCP transport, and C owns shared contracts and database assets.
Apps import selected C subpaths, never sibling app source; C imports no app. M calls W over HTTPS, without database or
model credentials. Chat calls W's own query runtime directly. W lives at `apps/legislation-web`; ignored local state
remaining at `apps/legislation` is not another runtime workspace.

<a id="nextjs-runtime"></a>

<a id="nextjs-runtime--nextjs-runtime-and-smoke-boundary"></a>

## Next.js runtime and smoke boundary

<a id="nextjs-runtime--ownership"></a>

### Ownership

W is the product documentation home and owns Next.js, API route handlers and the web smoke harness. The historical
Railway service identity is `legislation-web`. See the separate [MCP runtime](../../../legislation-mcp/README.md),
[ingestion runtime](../../../legislation-ingestion/README.md) and [core](../../../../packages/legislation-core/README.md).

The deleted `legislation-api` Railway service is historical evidence only. It is neither a current service nor a
rollback target. Rollback uses the immediately preceding known-good `legislation-web` deployment.

<a id="nextjs-runtime--runtime-contract"></a>

### Runtime contract

Each documented public operation requires an explicit Next.js Route Handler. Root `GET /health` is liveness and root
`GET /ready` is database-backed readiness. Neither endpoint runs migrations. Browser code must never receive database
credentials, a machine-to-machine API secret, or a `NEXT_PUBLIC_*` copy of one.

The runtime is pinned to `next@16.3.1`, `react@19.2.7`, and `react-dom@19.2.7`. Next's build-only TypeScript API uses
the local `typescript@5.9.3` dependency; the repository's native TypeScript compiler remains the type-checking source
of truth. The deployment image is credential-free and uses a frozen install without copying workstation registry
credentials.

<a id="nextjs-runtime--current-release-boundary"></a>

### Current release boundary

The September 14 recorded baseline contains 81 HTTP operations and 25 advertised MCP tools.
Use the [API contract](../engineering/api/README.md) for current behavior and inspect the target environment for the
running deployment, accepted civic fixtures, and search readiness. Historical smoke does not establish current
full-corpus search acceptance.

The locally implemented [regulatory text pilot](../regulations/legal-text-serving.md) adds one organization-gated HTTP
operation and MCP tool beyond that deployed baseline. Its production credentials and deployment checks remain open.

The shared Next.js API boundary authenticates supported and catch-all `/api/**` requests in WorkOS mode, installs
verified user/organization context, and returns the canonical `401` challenge before endpoint handlers run.
Health/readiness stay public. M owns `/mcp` and its API-backed adapter with separate WorkOS API and MCP audiences;
see [API authentication](authentication.md) and [MCP authentication](../../../legislation-mcp/docs/operations/authentication.md).

Production requires `AUTH_MODE=workos`, the public WorkOS verifier configuration, and independent base64 or base64url
32-byte values for `LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET` and `LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY`.
These names are deployment configuration, never client-visible values. Endpoint acceptance and corpus completeness
remain separate gates.

<a id="nextjs-runtime--smoke-procedure"></a>

### Smoke procedure

Run the deployed Next.js smoke only with an audited production origin and audited fixtures. The unified harness lives
in W's `scripts/smoke-foundation.mjs`; use its documented `LEGISLATION_WEB_SMOKE_*` environment variables.
The profile is cumulative for every enabled route block.

```powershell
$env:LEGISLATION_WEB_SMOKE_BASE_URL = Read-Host 'Audited current HTTPS web origin'
$env:LEGISLATION_WEB_SMOKE_TOKEN = Read-Host 'API bearer token' -MaskInput
pnpm --filter legislation-web smoke:foundation
Remove-Item Env:LEGISLATION_WEB_SMOKE_TOKEN
```

`LEGISLATION_WEB_SMOKE_TOKEN` is optional for an isolated runtime with authentication disabled and required when the
target uses `AUTH_MODE=workos`. The harness sends it only as an in-memory `Authorization: Bearer` header for `/api/**`
requests. It does not send the token to `/health`, `/ready`, or the homepage and does not include it in reports or
diagnostics.

For search, document-difference, and research smoke, configure the audited query, expected-outcome, bill, document,
and research-fixture variables. Before repeating an expensive profile, verify no index build is active. The harness keeps fixture
identities, query text, coordinates, research prompts, tokens, and model errors out of its stable report.

Use the [API contract](../engineering/api/README.md) and search-specific contracts for release requirements. Identify
the currently running and preceding successful artifacts in Railway before an operational change.

<a id="observability"></a>

<a id="observability--observability-contract"></a>

## Observability contract

Every W HTTP request has a correlation ID, and OpenTelemetry supplies trace and span IDs. Logs use timestamp, level, service, environment, operation,
status, duration, error category, correlation ID, and targeted canonical identifiers where applicable.

Railway is the recorded W/database runtime; its service logs and metrics provide that runtime's operating surface.
I owns worker/run observability and M owns transport telemetry. Each process initializes its own telemetry using C's
shared redaction primitives. Langfuse owns W research/model observations,
including retrieval mode, sanitized filters, candidate counts, selected identifiers, provider, pinned model, usage, and
latency. Correlated observations share the request/run identifiers. Langfuse SDK v5 uses OpenTelemetry and masks credential-shaped fields,
bearer tokens, long payloads, and full bill text before export.

The `/ready` response includes only safe pool counters: active, idle, total, maximum, waiting, and saturation. It never
includes database URLs, SQL text, parameters, or credentials, so runtime probes and diagnostics can collect pool pressure.

Expected validation failures are `info`; recoverable provider throttling is `warn`; exhausted dependencies and internal
errors are `error`; high-volume diagnostic detail is `debug`. Development retains logs for 7 days, staging for 30 days,
and production for 90 days unless the organization policy is stricter. Production samples successful high-volume search
spans after a baseline is established but never samples errors or ingestion summaries.

W alert ownership belongs to the legislation on-call rotation for API 5xx, readiness failures and zero ready replicas.
Worker recovery/notifications belong to I; MCP transport alerts belong to M.

The retained Azure Bicep template defines three rules: MCP 5xx, readiness failure, and zero MCP replicas. Metric alerts use
Container Apps metrics; the readiness rule parses structured logs in `ContainerAppConsoleLogs_CL`. Rules can exist
without notification receivers, but each deployed environment should supply an on-call action group.

Configured retention periods and paging ownership above are operating requirements. This audit did not verify live
receiver wiring, retention configuration or a staffed on-call rotation. See [runtime ownership](#nextjs-runtime).
