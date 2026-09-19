# Follow-up research context

Chat keeps text history in the browser, but does not accept browser tool results as evidence. Assistant messages
send only their server-generated run IDs alongside text. Before a follow-up, `/chat` reads those runs from the
existing research snapshot store and checks both the session access key and public conversation ID.

Each server-owned turn snapshot retains the question as an unresolved-goal reference, successful tool inputs and
bounded result data, immutable evidence identity and version/provision provenance, partial-read warnings, and failed
tool categories. Stream completion does not prove that the research goal was satisfied. Interrupted turns retain
that qualification. Proposed statutory text must remain distinct from uncertain judicial interpretation.

Each response permits eight tool-capable research steps and reserves a ninth model step for synthesis without tools.
The separate 24-call budget remains a hard safety bound across those research steps; reaching it disables tools on
the next step so the model can synthesize without repeatedly making rejected calls. If a non-error response still
finishes without prose, a completed presentation, or a clarification request, the stream emits an explicit incomplete
outcome instead of settling as an empty answer. This outcome is reported to composition telemetry and marks the saved
turn interrupted. The raw model finish reason remains in the server capture; an empty answer alone does not establish
whether a step limit, call limit, or another condition caused it. Valid clarification and presentation-only responses
remain distinct from incomplete research.

## Bounds and lifetime

- Each turn retains at most 24 observations and 96,000 serialized UTF-8 bytes for 24 hours.
- Follow-ups consider the eight most recent distinct run IDs and inject at most 192,000 serialized bytes of research
  context, with at most 320 evidence snapshots.
- Large result bodies are omitted before evidence; older observations or sources are removed if necessary.
  Omission counts, missing/expired turns, partial pages and truncated questions are explicit in model context.
- Missing history requires fresh retrieval, not an inference that the underlying record or provision does not exist.
  Storage errors fail explicitly rather than silently degrading to text-only history.

## Citations and handles

Old `eN` citation markers are turn-local and may collide. Restored evidence is deduplicated by its immutable identity,
assigned fresh references, and registered in both the model context and the response's `data-research-context` part.
Fresh tool reads reuse that registration for the same evidence identity. Citation rendering, telemetry and development
reload recovery understand the retained evidence even when the follow-up makes no new tool calls.

Result handles, presentation IDs and page cursors are not restored. Evidence-based presentation options receive fresh
IDs; other views require new retrieval. A removed continuation cursor leaves `hasMore: true`, so the model must restart
the appropriate tool without that cursor to continue. Historical evidence is not a substitute for a fresh status query.

Snapshots are written before the response stream closes. The JSON snapshot envelope is distinguished from result-card
snapshots by `kind: "research-turn"`; both use the existing owner-scoped research snapshot table and expiration cleanup.
This does not create account-level conversation storage or restore evidence from old browser-only conversations.

## Regression coverage

The chat route regression exercises two POST requests with the real SDK and tool adapter, records actual model input,
and checks that the second request sees prior operative text without another database read. Memory tests cover owner
and conversation isolation, expiration, colliding markers, byte limits, failures and reload. Citation tests cover
keyboard activation and retained-source telemetry. Deterministic fixtures establish wiring, evidence availability,
final-step synthesis, and explicit empty-answer handling, not live-model legal accuracy or a resumed evaluation campaign.
