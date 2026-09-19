# Conversation and composer debugging

LEG-46 answers why a question was blocked, a response was slow, or a conversation failed or stopped.
It does not track draft dwell time, history usage, picker funnels, engagement, animation performance or satisfaction.
The [shared privacy policy](telemetry-spec.md) and existing
[response-outcome semantics](../operations/conversation-export.md) remain authoritative.

## Browser ownership

[ConversationSession](../../src/modules/conversations/components/ConversationSession.tsx) owns the existing chat
transport. [Attempt diagnostics](../../src/modules/conversations/conversationDiagnostics.ts) create one opaque
browser request/operation ID per actual send, retaining the prior ID only for an explicit retry. No draft, thread
access key or permanent analytics identity is used.

The transport records acknowledgement and the server request ID without consuming the response stream.
Response metadata links the server run and independently read vendor trace IDs. A stale response must not relabel
a newer attempt. SDK completion is classified through the existing message outcome logic, not a second state machine.

`firstContentMs` is recorded once only when the React subscriber observes substantive content during streaming.
It is not first-network-token or browser-paint timing. Fast/unobserved responses can legitimately lack this value.
Overall browser duration ends at the terminal observation; content and private response payloads are not retained.

Explicit Stop records local cancellation, not confirmed server cancellation. A known completed answer survives
late Stop/disconnect. A lost connection without terminal evidence is not proof of successful or cancelled research.

## Useful failure context

- Workspace send guards record an observed blocked reason: unavailable, busy, restoring, navigating, empty,
  session mismatch or reference limit. Do not synthesize an event from an unclickable disabled button.
- Transport failures retain safe correlation alongside the existing error capture.
- Clarification confirmation success/failure is distinct from the subsequent research attempt.
- Failed development restore is tagged as such; production durable chat history is not implied.
- Existing stream, composition, citation and export error owners remain in place. There is no new engagement stream.

Composer behavior, IME handling, keyboard shortcuts, focus, reference selection and cancellation policy must not
change to make telemetry easier.

## Server ownership

[Capture](../../src/modules/conversations/capture.ts) starts a detached research trace with the existing request/run
references. The HTTP request span ends when its response is returned rather than waiting for research to finish.
The composed response outcome is authoritative when available; otherwise the existing classifier preserves known
failure, partial, clarification or unknown states.

Server duration covers the captured research/composition lifetime. `firstModelTextMs` is the existing raw model-text
observation, not the time a composed answer became visible. Tool measurements keep their existing owner.
Langfuse retains its separately approved observation content; Sentry receives only safe context and measurements.

## Verification

Reuse existing chat tests and focused diagnostic regressions for normal completion, rejection, retry, cancellation,
stale responses and absent observations. Exercise the changed desktop/mobile workflow and keyboard/focus behavior
in the integrated browser. Follow the [debugging guide](../operations/telemetry-debugging.md) and
[focused acceptance](../operations/telemetry-acceptance.md); no funnel or cohort report is required.
