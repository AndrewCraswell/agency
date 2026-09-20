# Conversation export

Enter `/export` in an existing conversation to render a local JSON snapshot in a scrollable code block inside the chat.
Use **Copy JSON** to copy the exact JSON, or select the text manually if clipboard access fails. Focus stays in the
composer. No dialog or browser download is triggered. Exporting does not call the model or send another chat request,
and it remains available when the research service is disconnected or a response is streaming.

The inline component holds a point-in-time snapshot, separate from chat messages and subsequent model context.
Run `/export` again to replace it with updated content. JSON is rendered as literal code, not interpreted as HTML
or Markdown from research content. Long exports scroll without truncation or syntax-highlighting work over the payload.
Browser automation can read the region named `Conversation export` and code block labeled `Conversation export JSON`;
no clipboard permission or download interception is required to capture evidence. The adaptive driver excludes this
diagnostic region from its conversation input.

The snapshot includes:

- Browser-retained user and assistant messages, citations, presentation data, and tool parts.
- Public conversation and telemetry session IDs, run and trace metadata, the active replay ID when available, and
  clarification answers.
  New response metadata stores a structured `correlation` object with separate server/browser request IDs, run ID,
  Sentry/Langfuse trace IDs and the parent request trace when observed. These IDs do not establish vendor ingestion.
- Tool names, inputs, outputs, errors, and states that remain in the browser conversation.
- Tool measurements when delivered by the server, matched by message/run and tool-call identity. `durationMs` measures
  the whole wrapper; `dependencyDurationMs` measures the dependency invocation, not pure database time. `resultBytes`
  is the enriched JSON projection size. Raw bytes measure prepared structured content, not full database rows;
  model-facing bytes measure serialized tool text, including record links. Rejected projections can retain attempted
  byte counts, not proof of successful delivery. The measurement also records result count, continuation availability,
  timestamps, success/error and failure code. Attempt count covers wrapper attempts only;
  hidden dependency retries, model usage and cost are not inferred. Missing measurements remain null.
- A format name, schema version, export time, conversation status, and capture limitations.
- `interactionStatus` describes whether the composer can accept input; `ready` does not assert a completed answer.
  `responseOutcomes` separately records each assistant message as completed, clarification, partial, cancelled,
  exhausted, failed, or unknown, with the observed finish reason, substantive-answer presence, and pending/failed tool
  IDs. The server's incomplete-answer notice and failed/pending presentation blocks are not substantive answers.
  Explicit Stop is cancellation; an abort or missing terminal event alone does not establish who cancelled a request
  or prove a timeout. A completed terminal answer survives a late transport failure, with the raw browser observation
  retained in message metadata. Partial text remains available and the composer stays usable.
  Exhaustion requires an observed output-length finish. Research has no tool-call count or model-step cutoff.
  Payload-size rejection (`result_limit`), dependency timeout, and tool interruption are not proof of exhaustion.

Reasoning parts and known credential fields are removed recursively before serialization. URL user information and
credential-like query or fragment parameters are removed, and recognized bearer, basic, OpenRouter, and Langfuse
credentials are redacted. The session access key is not exported.

Redaction covers standalone URLs and URLs embedded in prose or Markdown, including parenthesized URL paths and
values, IPv6 hosts, and query parameters inside fragments. Removing credentials preserves surrounding text and the
original spelling, encoding, and order of retained public URL components. The same redactor masks conversation
observations; provider reasoning metadata is removed recursively. AI SDK child spans retain model/usage metadata but
do not record raw inputs or outputs, which bypass Langfuse's observation mask. Redacted research content remains on
the parent conversation observation.

An export is a diagnostic browser snapshot, not a complete server execution ledger. Replaced or regenerated messages,
provider retries, exact tool timings, and data outside the browser's retained conversation may be absent. Research text
can contain sensitive information even after credential redaction, so review the JSON before sharing it.
