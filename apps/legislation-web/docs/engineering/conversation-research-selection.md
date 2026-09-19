# Exact research selections

Conversation tools retain the canonical document and pagination contracts. There is no alias protocol and no
requirement to discover a document before a valid first-call explicit-ID read. Inputs are schema-validated and passed
unchanged to the shared research tools; failures never trigger hidden requests or automatic ID substitutions.

## Turn-owned validation

The research-tool instance retains exact returned continuations and structured bill-document metadata. Cursors must
have been returned in this response for the same cursor field. The shared core continuation validator additionally
binds the tool and every non-cursor input, including source, document, version, collection, filters and limits.
Previous-turn cursors are not restored from research memory.

A known document cannot be reused against a conflicting bill or known version. Unknown document IDs still reach the
normal backend validation, including valid IDs supplied directly by the user. An unknown ID's similarity to a returned
ID is not proof of a typo. This deliberately permits one failed backend read for a syntactically valid mutated ID
rather than rejecting legitimate undiscovered documents.

The index accepts structured metadata, not IDs embedded in prose. It is bounded to 1,600 entries and 180,000 serialized
bytes; exceeding either limit produces a reported `result_limit` failure instead of silently dropping selections.
Evidence, result-store records and successful research-memory observations keep canonical IDs.

## Bounded recovery

Selection failures remain failures with their original category and reference. Their model-visible error may include
`Selection recovery` JSON. The first selection failure in a response offers:

- One exact continuation only when it uniquely matches the unchanged request. Otherwise restart without cursors,
  retaining all other inputs.
- Up to three exact returned document choices for a failed, unknown bill-text document, restricted to the requested
  bill and any version filter. Choices are not automatic corrections; an ambiguous intended source requires resolution.
- A scoped document-resolution or bill-document metadata read when no safe choice is available.

Further selection failures direct the model to finish with supported findings and an explicit limitation. Recovery
does not execute another request automatically. Every model-issued attempt, including rejected selections, consumes
the existing research-call budget. The answer-only final step remains unchanged. Empty or heading-only text is not
evidence that legal duties are absent.

## Payload limits and measurements

The chat boundary enforces 180,000 UTF-8 bytes for the prepared core `structuredContent`, then separately for the
actual model-visible tool text after evidence, presentation choices, result snapshots and record links are added.
The final serialization is also guarded. Rejected enrichment is not turned into a successful empty result, stripped
of provenance, or retried automatically. No successful memory observation or presentation content is published for
an oversized projection. A `result_limit` error offers an explicit `narrow` recovery: restart without a cursor at
`limit: 1`, use a known bill/document scope for text discovery, or read selected sections if a single result remains
too large. The response must identify unread coverage. A cursor from a rejected projection is not an accepted read.

Each attempted tool call can publish one scalar-only measurement tied to its run and tool-call IDs, including
start/end ISO timestamps and whole-tool `durationMs`. The browser-safe `researchMeasurement.ts` schema is shared by
the producer, persistence and export boundaries; it rejects invalid numeric values and strips unknown fields.
`dependencyDurationMs` measures the invoked research-tool
boundary, including runtime setup, pool admission, shared tool execution and serialization; it is **not** pure SQL
time or whole-turn time. `rawResultBytes` measures the prepared core JSON wrapper, not unprojected database rows.
`enrichedResultBytes` measures returned JSON; `modelResultBytes` measures the exact serialized model text. On an
oversized failure these byte counts describe the attempted projection, not successfully delivered evidence.
`resultCount` counts a recognized top-level `items`, `events`, `sections` or `rows` collection; otherwise it is null.
`hasNextPage` records a known continuation or explicit terminal page; incomplete results without a continuation remain
unknown. Measurements are null when execution did not reach their boundary. Dependency-internal retries and retry
relationships remain unknown, not inferred from repeated inputs. No query text, result content, raw exception,
credentials, reasoning, guessed token usage or estimated billing belongs in this record.

`describe_analytics` uses the service's static catalog through the same shared schema and analytics telemetry wrapper,
without opening a read-only research database transaction. It retains conversation admission and cancellation checks;
catalog field descriptions and examples remain model-visible schema data, not evidence, presentation content, selection
registrations or research-memory observations. `analyze_legislation` retains actual rows and receipts and still executes
through the read-only runtime. Runtime deadline and recognized database failures
retain explicit timeout/unavailability categories. An unknown historical failure remains `internal`, not an inferred
SQLSTATE or a claim that records do not exist.

## Regression boundaries

Deterministic fixtures use the public document IDs from campaign case 091 and recreate the cursor mutation from
case 028 using freshly generated core-bound continuations. Tests cover exact bytes at the tool boundary, first-call
IDs, scope mismatches, stale turns, bounded recovery, reporting and model-visible failures.
Campaign LEG-9/LEG-10 fixtures additionally cover broad PBM discovery overflow after enrichment, timeline date/null
preservation, static catalog operation without a database connection, grounded aggregate receipts and scoped supporting
material failures. The timeline service already normalizes timestamp and date branches to text before `COALESCE`;
its existing integration fixture covers UTC ordering and multi-page/null cases. No new timeline implementation fix or
historical production root cause is claimed.

Mocked fixtures do not establish live-model compliance, provider availability, browser accessibility or substantive
legal conclusions. Manager review, centralized execution of behavioral tests and applicable browser acceptance remain
separate acceptance requirements.
