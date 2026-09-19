# Conversation and composer telemetry

Proposed September 18, 2026. This extends the [web telemetry specification](telemetry-spec.md) and
[event catalog](telemetry-events.md) with a detailed contract for Rostra's primary workflow. All parent privacy,
consent, sampling, payload and retention rules apply. This is instrumentation design, not enabled collection or a
request to record conversations in Sentry.
The [tool execution contract](tool-execution-telemetry.md) specifies per-call instrumentation, stage timing,
parallel critical paths, retries, output budgets and model/dependency attribution.

## Questions we must answer

- Can people get from a usable composer to an accepted question? Where do reference selection, unavailable service,
  send guards or navigation prevent that?
- Do suggestions, inline mentions, reference picking and history recall help people submit useful research?
- Is the delay before an answer in the browser, request acceptance, retrieval/tools, model generation or presentation?
- What happens after partial answers, clarification requests, cancellation, exhausted responses or disconnection?
- Do people inspect sources, expand research activity, copy answers and continue with follow-up questions?
- Does long conversation history, many results or accumulated presentation blocks make the UI slower?

Clicks, copying, repeat questions and dwell time do not establish answer quality or satisfaction. Correlate safe
execution summaries with Langfuse evaluations when available, without merging operational and evaluation denominators.

## Current implementation boundaries

| Owner | Existing behavior the instrumentation must respect |
| --- | --- |
| [ChatComposer](../../src/modules/conversations/components/ChatComposer.tsx) | Nonempty draft, availability/running state and at most 12 distinct references gate Send; the reference library and Stop have separate controls |
| [ComposerInput](../../src/modules/conversations/components/ComposerInput.tsx) | Tiptap editor; desktop Enter sends, mobile Enter/Shift+Enter can insert a newline; IME composition must not submit; arrow keys recall history; mentions debounce 300 ms with a two-character minimum and a 200-character query guard |
| [ReferencePicker](../../src/modules/conversations/components/ReferencePicker.tsx) | Staged selection, local filtering, debounced remote search, retry, Apply and dismiss; choosing a candidate is not yet a committed composer reference |
| [ChatWorkspace](../../src/modules/conversations/components/ChatWorkspace.tsx) | Home-to-thread handoff, follow-up send, busy/session/navigation guards, Stop, incomplete-answer retry, evidence panel, jump-to-latest and local `/export` |
| [ConversationSession](../../src/modules/conversations/components/ConversationSession.tsx) | One shared chat/transport, acceptance acknowledgement, terminal observations, explicit cancellation, reference requests and clarification confirmation followed by continuation |
| [ClarificationQuestion](../../src/modules/conversations/components/ClarificationQuestion.tsx) | Pending, answered/skipped, expired/superseded, validation and confirmation failures; an accepted clarification is not yet a completed continuation |
| [ConversationResponse](../../src/modules/conversations/components/ConversationResponse.tsx) | Text, research activity, composed records, citations, missing/pending sources and clarification; source-open and copy actions are distinct |
| [OrderedAnswerContent](../../src/modules/conversations/components/OrderedAnswerContent.tsx) | Ordered text/presentation release with a 500 ms animation deadline; hidden documents and reduced-motion/terminal rendering bypass animation gates |
| [MessageActions](../../src/modules/conversations/components/MessageActions.tsx) | User-message/assistant-answer copy with clipboard feedback, not edit, rating or share controls |

Reload checkpoint/restore in the current session implementation is development-only. The production thread can be
unavailable outside its original visit; do not describe it as durable history restoration. Editing a sent message,
attachments, voice input, ratings and public sharing are not implied by this specification. Add instrumentation for
those only if the corresponding product feature is separately approved and shipped.

## Correlation and state model

Keep four identities distinct: telemetry session (visitation), conversation (thread), logical research turn (user goal)
and execution attempt (retry/continuation). Add an ephemeral `draft_id` for composing and opaque `message_id` /
`interaction_id` only where needed for diagnostics. These are log/trace fields, never metric dimensions. Never use the
conversation `sessionKey` as any telemetry identifier.

Create a turn/operation ID at accepted local send and preserve it through the home-to-thread navigation, transport,
server run, streamed acknowledgement and rendering. A user-initiated follow-up is a new turn. An incomplete-answer
retry gets a new attempt linked to the previous attempt; it is not an additional first-time submission.
Clarification has its own confirmation operation and a linked continuation attempt for the original research goal.
Tool invocations have child attempt identities. Telemetry does not change product operation IDs or retry behavior.

Use orthogonal states rather than one giant `chat.status`:

| State axis | Required distinctions |
| --- | --- |
| Composer | Unavailable, empty, drafting, reference selection, locally eligible, blocked by busy/restoring/session/navigation/limit |
| Transport | Not sent, request in flight, acknowledgement received, stream receiving, disconnected, closed |
| Research | Accepted, executing, awaiting clarification, completed, partial, cancelled, exhausted, failed, unknown |
| Presentation | Waiting, progress visible, substantive content rendered, presentation pending, terminal UI rendered, render failed |

Record meaningful transitions, not React renders or repeated SDK status callbacks. Hydration, route remount, history
replay and dev Strict Mode must not re-emit accepted sends or completed turns. Browser and server terminal outcomes
remain separate; a late disconnect cannot replace a known completed answer. Existing
[response-outcome semantics](../operations/conversation-export.md) remain authoritative.

## Composer event contract

These are additional static events. Reuse existing `conversation.submitted`, `research.reference_changed`,
`search.*`, `suggestion.*` and `output.*` events instead of introducing competing counters.

| Event | Exact trigger | Safe fields and interpretation |
| --- | --- | --- |
| `composer.ready` | Editor first usable for a visible mount | Surface home/thread, availability state, init duration; once per mount, not a user action or draft |
| `composer.draft_started` | Empty -> substantive draft from user input, suggestion selection or history recall | Draft ID, origin enum; programmatic restore uses `composer.draft_restored`, not a new authored draft |
| `composer.draft_restored` | A supported retained draft is restored into the editor | Restore source/state, character-count bucket, reference count; no claim of production persistence |
| `composer.history_recalled` | History navigation actually replaces the draft | Back/forward/original-draft direction and history-depth bucket; not every arrow key |
| `composer.submit_blocked` | An observed submit intent reaches a guard and is rejected | Reason: empty, unavailable, busy, restoring, session_mismatch, navigating or reference_limit; no event inferred from an unclickable disabled button |
| `composer.draft_ended` | Accepted send, explicit clear/replacement or observed composer lifecycle end | Reason, elapsed/visible-focused duration, final size bucket, reference count and bounded feature-use summaries |
| `composer.mention_opened` | Mention menu actually becomes visible for a mention interaction | Interaction ID and available/loading state; no typed mention prefix or query |
| `composer.mention_closed` | Same menu interaction ends | Selected/dismissed/blurred/interrupted, displayed-result count, request/retry counts and menu-open duration |
| `composer.reference_picker_opened` | Reference picker becomes visible | Initial staged count and entry source |
| `composer.reference_picker_closed` | Apply or dismiss actually closes it | Applied/dismissed, added/removed counts and open duration; only Apply feeds committed `research.reference_changed` events |

`conversation.submitted` emits only after local guards pass; include `submit_method=keyboard|button`,
`turn_kind=new|follow_up`, `draft_origin=typed|suggestion|history|restored|mixed`, character-count bucket and reference
count. `/export` emits output events and a draft-ended command reason, not a research submission or AI token count.
Native form and keyboard handlers must converge on one send owner; Enter selecting a mention is not send intent.
IME composition, newline insertion, programmatic focus and disabled controls must not generate artificial sends.

For mention/picker queries, reuse `search.submitted/finished/results_rendered` with
`search_kind=mention|reference_picker`. Measure scheduled debounce, request latency and rendered current results
separately. No request for a too-short/too-long mention query; record only a bounded menu-summary guard count.
Superseded requests are cancelled diagnostics, not empty results or dependency errors. Distinguish a failed lookup
from a genuine empty result even where UI code currently returns an empty array after handling the exception.
Track explicit retry, selected rank bucket, entity kind, reference-limit rejection and duplicate selection without
sending query text, names or record IDs. The 12-reference rule counts distinct composed/staged references, not chips.

Draft statistics are computed locally and emitted once at draft end: character bucket (0, 1-80, 81-280, 281-1000,
1001+), reference count, suggestion/history/mention-use booleans, pasted-content-present boolean if approved, and
coarsely bucketed elapsed/visible-focused duration. Do not transmit drafts, clipboard contents, edit diffs, key codes,
keystroke timestamps, inter-key timing, typing-speed profiles or a stream of draft lengths.

One draft can survive blur, evidence inspection and tab hiding. Pause visible-focused duration on blur/hide; do not call
it active typing time. Clear after a successful send is not a second user-clear event. Stop optional draft measurement
on consent withdrawal and rotate its identifiers. An inactive/unloaded tab may never report its draft end; reports
mark that draft right-censored after 30 minutes without a send, not "the user abandoned it".

## Conversation lifecycle and engagement events

| Event or existing owner | Required detail |
| --- | --- |
| `conversation.opened` | Thread visible, entry source, new/existing-in-memory/development-restored/unavailable, message-count bucket; separate from page views and do not increment turn counts |
| `conversation.milestone` | Emit each available stage once per attempt/origin: request_dispatched, acknowledgement_received, progress_rendered, first_chunk_received, first_content_rendered, terminal_received, terminal_rendered; no per-token logs |
| `conversation.accepted` / `conversation.finished` | Server execution start/terminal observation, fixed model/provider route, tool/step counts, observed finish category, safe usage totals; preserve unknown fields |
| `conversation.rendered` | Terminal browser presentation ready, outcome, rendered text/block/citation counts, unresolved citations and pending/failed blocks; exclude status-only notices from substantive answer counts |
| `conversation.stream_summary` | One summary per browser attempt: chunk count, total bytes if known, maximum/total stalled-gap time, stall count, visibility-at-stall and receive-to-render lag; no raw chunks |
| `conversation.stop_requested` | Explicit stop with observed phase and partial-content-present flag; distinguish pre-ack, researching, clarification confirmation and answer streaming |
| `conversation.retry_requested` | Explicit retry/regenerate with original outcome and phase; record whether the linked attempt is accepted and completes rather than calling the click recovery |
| `conversation.clarification_shown` | Pending clarification visibly rendered once per request revision; kind and option count only |
| `conversation.clarification_submitted` | Valid answer/skip sent for confirmation; kind, answer/skip and selection count, never selected option IDs/labels or free text |
| `conversation.clarification_finished` | Confirmation accepted/rejected/cancelled/unknown, revision-match status, expiry/supersession and duration; continuation acceptance is separately measured |
| `conversation.activity_toggled` | User opens/closes the research-activity disclosure; fixed tool/state class, no displayed input/output text |
| `conversation.follow_mode_changed` | Observed transition into/out of following latest content while running; reason user_scroll/jump_to_latest/layout/unknown, no scroll-coordinate stream |
| `evidence.opened/loaded` and `output.requested/finished` | Citation/source/profile navigation, panel readiness and copy/export result; identify user-message versus assistant-answer copy using a fixed enum |
| `conversation.recovery_observed` | Known recovery boundary: retry completes, development restore succeeds/fails, expired result refresh settles or unavailable thread shown; never invent a successful restoration |

Validation failures on clarification are classified blocked actions, not submitted answers; aggregate once per explicit
submit attempt. Confirmation can succeed while continuation dispatch fails: show both outcomes. An expired/superseded
question is not automatically an unanswered abandonment. Copy/export handoff is not proof that the output was read,
verified or saved. A follow-up after success and a retry after failure have different denominators.

Some answer blocks can be visible before the terminal event; milestone telemetry must reflect actual rendered
content, not just parsing. Record unresolved-citation and failed-presentation counts at terminal state, not every
temporary unresolved reference during streaming. Report evidence/version identity mismatch as a correctness signal
using a fixed reason only. No private reasoning, tool arguments or model-generated labels enter Sentry.

## Timing and metrics

Measure durations within one runtime using a monotonic clock. Distributed spans explain cross-runtime work; never
subtract a browser timestamp from a server timestamp. End-to-end browser milestones share the accepted-send start,
but local response/render latency is distinct from network, provider and total turn latency.

| Metric | Definition and initial acceptance |
| --- | --- |
| `rostra.composer.ready` | Mount -> usable editor, distribution in ms; initial p95 <=500 ms after the mount begins, separate from full page load |
| `rostra.composer.input_latency` | Sampled local editor update -> next rendered frame, aggregated once per draft in ms with sample count; initial p95 <=100 ms in the controlled workload; no per-edit export |
| `rostra.composer.draft_duration` | Draft start -> end, distribution in ms, with elapsed versus visible-focused kind; no speed/productivity target |
| `rostra.composer.submit_blocked` | Counter by fixed blocking reason; only observed attempted submissions |
| `rostra.reference.lookup_duration` | Query becomes eligible -> current results visible, including debounce, distribution in ms; initial p95 <=1 s, with request-only duration separate |
| `rostra.chat.acknowledgement` | Client accepted send -> streamed acceptance acknowledgement observed, distribution in ms; graph missing acknowledgement separately |
| Existing `rostra.chat.first_content` / `rostra.chat.duration` | First substantive rendered answer and terminal rendered answer; server variants use their own clock and origin dimension |
| `rostra.chat.render_lag` | Browser receipt of a renderable part -> its rendered availability, distribution in ms; separate text from presentation/animation wait |
| `rostra.chat.presentation_wait` | Ordered presentation arrival -> release, distribution in ms; annotate animation completion/deadline/bypass and delayed main thread, no model-content identifiers |
| `rostra.chat.stop_latency` | Stop intent -> local stream stops and composer becomes usable, distribution in ms; initial p95 <=500 ms; separately report confirmed server cancellation if available |
| `rostra.chat.clarification_confirmation` | Valid submit -> confirmation result, distribution in ms; excludes user deliberation and subsequent generation |

Metric names are static. Dimensions are limited to approved surface, device class, origin, outcome and the relevant
fixed reason/kind; draft, turn, message, run and interaction IDs remain log/trace-only. Collect summaries with bounded
counters/histograms, not arrays of every edit or chunk. Foreground and hidden-tab timings are separate populations.
The parent initial bundle/egress/overhead budgets still apply; reduce diagnostic sampling rather than dropping core
turn outcomes or logging every delta to approximate them.

Profile browser preparation, server validation/session resolution, prompt acquisition, research-memory lookup,
retrieval/tool execution, model generation, composition validation, stream serialization and browser rendering as
separate spans where those stages actually exist. Expose critical-path timing, not the sum of overlapping parallel
tool spans. Token throughput uses reported token counts; character/chunk rate must not be labeled tokens/second.

## Conversation dashboard and acceptance

The conversation dashboard must provide:

- **Composer funnel:** ready -> draft started -> eligible submission -> server accepted -> first content ->
  terminal rendered. Join by approved opaque IDs, exclude demo/development traffic and report missing stages.
- **Draft-to-send:** drafts submitted within 30 minutes / drafts started with a fully elapsed observation window;
  report censored/unknown ends and typed/suggestion/history origins separately. No inferred dissatisfaction.
- **Reference usefulness:** menu/picker interactions that commit a reference, lookup failures/empty results,
  reference-limit rejections and sends with references. Staged checkbox changes alone do not count as use.
- **Latency waterfall:** acceptance, first progress, first answer, tool/model execution, stream stalls and render lag,
  with p50/p95, sample counts, missing-measurement rates and long-thread/message-count buckets.
- **Tool execution:** per-tool call/outcome volume, dispatch/dependency/processing time, result sizes, retries,
  concurrency, pending calls and observed critical-path contribution; link to the execution graph, not raw arguments.
- **Recovery:** explicit Stops by phase; retries after each incomplete outcome that complete within five minutes;
  clarification confirmation and continuation success as distinct stages. Exclude unresolved windows from success rates.
- **Engagement:** source opens, activity expansion, copy/export handoff, return-to-latest and follow-up submissions;
  these are behavioral signals, not answer-quality scores.

Acceptance extends the [shared rollout gates](../operations/telemetry-acceptance.md):

1. Script typed send, suggestion edit/send, history recall, mention selection by keyboard/pointer and reference
   Apply/dismiss. Prove one submission across form handling, route handoff, rerenders and transport callbacks.
2. Exercise desktop/mobile Enter, Shift+Enter and IME composition, empty/unavailable/busy/session/navigation guards,
   12-reference limit, duplicate references, failed/empty lookup, superseded request and explicit retry. Preserve UX.
3. Exercise acknowledgement missing/late, progress-only stream, first substantive content, clarification answer/skip,
   confirmation success with continuation failure, partial/exhausted/unknown, Stop and retry. Validate exact outcomes.
4. Inspect long threads, composed blocks, streaming citation resolution, activity disclosures, evidence/source opening,
   copy/export, jump-to-latest, tab hide/show and reduced motion. Measure render lag rather than assuming receipt means
   display. Verify the existing 500 ms presentation deadline and bypass behavior without changing them for telemetry.
5. Verify development-only restore and production unavailable-thread behavior separately; no production-persistence
   claims. A completed response survives a late disconnect and restored messages do not regenerate historical events.
6. Inspect captured payloads with seeded sensitive drafts, references, clarification text, clipboard contents and tool
   arguments. None may leave through Sentry, replay or SDK-added metadata; optional measurement stops on withdrawal.

Use a controlled workload of a 1,000-character draft with 12 distinct references and a 50-message thread with mixed
text/record blocks, at desktop/mobile sizes. Measure over repeated runs with and without telemetry and keep the parent
<=5% overhead budget. This is a performance fixture, not a new supported product limit. Implement executable emitter
tests and integrated-browser acceptance with the feature; do not build validators for this document.
