# Debugging signals and coverage

This is the active diagnostic scope, not a product-analytics event implementation checklist. See the
[specification](telemetry-spec.md), [conversation contract](conversation-telemetry.md) and
[tool contract](tool-execution-telemetry.md).

## Owners

| Boundary | Diagnostic owner and retained context |
| --- | --- |
| Authenticated API and `/chat` | [Request boundary](../../src/services/sentry/requestTelemetry.ts): canonical route, method, operation, status, outcome, duration and opaque references |
| Multiplexed `/chat` actions | [Route](../../src/app/chat/route.ts): research, reference search, record inspection, pagination and clarification are distinct fixed operations |
| Unexpected API failures | Existing Web/Node error response helpers capture unexpected 5xx failures; expected validation/auth/empty results are not exception spam |
| Database/network | Installed SDK PostgreSQL/native-fetch integrations and existing analytics spans; export filtering removes SQL, connection details, bodies and URLs |
| Research run | [Capture owner](../../src/modules/conversations/capture.ts): detached run lifetime, composed outcome, duration and known raw-model first-text timing |
| Research tools | [Wrapper](../../src/modules/conversations/research.ts) and [tool diagnostics](../../src/modules/conversations/toolTelemetry.ts): existing invocation spans and canonical measurements |
| Browser conversation | [Session](../../src/modules/conversations/components/ConversationSession.tsx) and [attempt diagnostics](../../src/modules/conversations/conversationDiagnostics.ts): opaque attempts, acknowledgement, observed content, terminal outcome and explicit retries |
| Browser guards/recovery | Existing workspace/session owners record observed blocked-send reasons, clarification confirmation outcomes and restore errors |
| Browser/render/suggestion failures | Existing audited Sentry handlers and explicit capture owners are retained |
| Health/readiness | Existing operational probe responses/logging remain separate from customer workflows |

Development representative routes have canonical templates but remain outside product-usage reporting.
Ordinary request success does not establish data completeness, research correctness or a completed streamed answer.

## Breadcrumbs, not analytics counters

The shared [breadcrumb helper](../../src/services/sentry/diagnosticBreadcrumb.ts) retains only a registered name and
privacy-projected metadata. It does not send draft text, keypresses, source labels, record IDs or raw provider IDs.
Up to 20 breadcrumbs accompany an error; they are not separately emitted logs or exact counts.

Active diagnostic names include `api.request_finished`, `composer.submit_blocked`, `conversation.submitted`,
`conversation.retry_requested`, `conversation.stop_requested`, `conversation.milestone`,
`conversation.clarification_finished`, `conversation.accepted`, `conversation.finished`,
`research.tool_started` and `research.tool_finished`.

Browser milestones distinguish request acknowledgement, content actually observed while streaming and a terminal
observation. `origin` distinguishes browser observation from server execution. Reused names do not activate the
broader optional event/metric emitters.

## Contracts and limits

The existing [typed foundation](telemetry-foundation.md) has a broader vocabulary than these active producers.
Unused catalog/coverage entries are not a requirement to implement canceled usage features or enable metrics/logs.
The current Linear issues, not earlier per-surface reporting proposals, define completion.

Keep route/tool/action names finite. Validated correlation IDs may be searchable error/trace metadata, never metric
dimensions. Missing counts, timing or retry evidence remains absent; do not derive exact counters from breadcrumbs
or sampled spans.
