# Conversation export

Enter `/export` in an existing conversation to download a local JSON snapshot. Exporting does not call the model or
send another chat request, and it remains available when the research service is disconnected.

The snapshot includes:

- Browser-retained user and assistant messages, citations, presentation data, and tool parts.
- Public conversation and telemetry session IDs, run and trace metadata, the active replay ID when available, and
  clarification answers.
- Tool names, inputs, outputs, errors, and states that remain in the browser conversation.
- A format name, schema version, export time, conversation status, and capture limitations.

Reasoning parts and known credential fields are removed recursively before serialization. URL user information and
credential-like query or fragment parameters are removed, and recognized bearer, basic, OpenRouter, and Langfuse
credentials are redacted. The session access key is not exported.

An export is a diagnostic browser snapshot, not a complete server execution ledger. Replaced or regenerated messages,
provider retries, exact tool timings, and data outside the browser's retained conversation may be absent. Research text
can contain sensitive information even after credential redaction, so review the file before sharing it.
