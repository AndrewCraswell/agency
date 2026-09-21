# Request, run and vendor correlation

LEG-37 links browser HTTP attempts, server request scopes and asynchronous research runs without exporting arbitrary
request headers or provider identifiers. [Trace/header validation](../../src/services/sentry/telemetryCorrelation.ts)
is shared by the runtime boundaries and the Node [safe propagator](../../src/services/sentry/safeTracePropagator.ts).

## Trace input and propagation

Only validated Sentry trace headers and W3C version-00 traceparents are accepted. IDs must have their exact protocol
length, lowercase hexadecimal representation and nonzero value. Duplicate, malformed, oversized or conflicting
headers reset inbound trace continuation with a bounded diagnostic that contains no header value.

Inbound sampled flags are not an instruction to spend the local tracing budget: the boundary clears that request,
and the local runtime sampler still decides whether to record/export. Outbound propagation preserves the locally
chosen sampling decision. Arbitrary inbound baggage and tracestate are deliberately not supported and are removed.
Native SDK fetch instrumentation may generate its own bounded Sentry sampling metadata on an approved origin;
this is distinct from forwarding caller baggage. No application identity or ad hoc context is serialized into baggage.

Existing SDK origin restrictions remain in force. The chat fetch wrapper also removes all telemetry headers on a
different origin, including protocol-relative and slash/backslash URL forms. Credentials and ordinary application
headers are not rewritten by telemetry. Webhooks, model services and source links outside the approved origin do not
receive injected correlation context.
Correlated same-origin API calls reject redirects rather than forwarding their headers to a new destination.
These JSON/stream endpoints must respond directly; a redirect is surfaced as a fetch failure, not followed.

## Request identity and application contracts

The [browser wrapper](../../src/services/sentry/correlatedFetch.ts) creates `x-rostra-request-id` as a UUID for each
physical HTTP request, or retains an existing valid UUID when retrying that same request. The chat transport,
reference lookup, record inspection, pagination and clarification requests use that wrapper.

The [request boundary](../../src/services/sentry/requestTelemetry.ts) creates a distinct server-owned request UUID,
retains the validated browser request UUID as a separate field, and returns the server UUID in `x-rostra-request-id`.
Authenticated API requests and chat run inside an isolated scope. Nested wrappers reuse the current request identity;
response streams are passed through without being consumed.
The boundary reconstructs native requests from their public fetch fields rather than using a copy constructor,
which cannot read private fields through Next.js request proxies. Body streams, abort signals and fetch options
are preserved.

The existing public `x-correlation-id` response/body contract is unchanged. Its arbitrary caller-provided value is
not copied into the new telemetry correlation context. Neither the access `sessionKey` nor a raw user/workspace ID is
used to generate or label these IDs.
The route registry treats the public representative page as a product surface and its same-origin API as an operational
API route. Coordinates and addresses remain excluded from route templates and telemetry fields.

## Research runs and cross-vendor links

The server's existing generated run UUID is associated with the current request. A research observation starts a new
trace with its own lifetime and retains `request_id` plus `parent_request_trace_id` as explicit causal references.
Returning response headers does not keep the HTTP span open until research finishes.

`sentry_trace_id` and `langfuse_trace_id` are read separately from their actual active contexts. They may coincide with
the shared provider, but consumers must not assume that. Missing IDs remain absent. A generated trace ID is not proof
that a sampled span reached either vendor.
Validated correlation fields survive the error, span and structured-log privacy projections, but are never
metric dimensions.

Assistant-message metadata now carries the structured `correlation` object instead of the ambiguous `traceId` field.
The diagnostic export retains this object with the browser's message snapshot. Prototype history is not migrated.

Provider tool-call identifiers that are not UUIDs receive a random, stable-within-run UUID mapping before error
telemetry. The mapping never truncates or hashes the input into an identity, retains at most 512 inputs of at most
4,096 characters, and emits a bounded diagnostic when it cannot allocate an ID. Raw provider IDs still belong to the
application's tool protocol/local diagnostic export, not Sentry tags.

## Verification boundary

Tests cover malformed/zero/conflicting headers, ignored baggage, bounded mappings, nested/concurrent requests,
unchanged application headers and body/abort semantics, stream pass-through, and asynchronous request-to-run links.
Actual native fetch and edge-SDK fixtures check two loopback origins and ensure untrusted targets receive no injected
context. These tests use local/in-memory transports only; deployed cross-service canary evidence remains separate.
