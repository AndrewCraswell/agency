# Follow-up research context

Chat keeps text history in the browser, but does not accept browser tool results as evidence. Assistant messages
send only their server-generated run IDs alongside text. Before a follow-up, `/chat` reads those runs from the
existing research snapshot store and checks both the session access key and public conversation ID.

Each server-owned turn snapshot retains the question as an unresolved-goal reference, successful tool inputs and
bounded result data, immutable evidence identity and version/provision provenance, partial-read warnings, and failed
tool categories. Stream completion does not prove that the research goal was satisfied. Interrupted turns retain
that qualification. Proposed statutory text must remain distinct from uncertain judicial interpretation.

Research has no tool-call count or model-step cutoff. The model can continue gathering evidence until it finishes
or requests clarification; cancellation and execution failures still stop the run. Tools are not disabled to force
an answer after a fixed number of steps, and failed calls do not consume a separate research allowance.
The agent does not override the provider's output-token allowance. Provider and context-window limits still apply;
a length termination remains an incomplete outcome, not proof that all requested findings were delivered.
If a non-error response still
finishes without prose, a completed presentation, or a clarification request, the stream emits an explicit incomplete
outcome instead of settling as an empty answer. This outcome is reported to composition telemetry and marks the saved
turn interrupted. The raw model finish reason remains in the server capture; an empty answer alone does not establish
why research ended. Valid clarification and presentation-only responses
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

Model-facing evidence and presentation options use immutable evidence-snapshot IDs and copy-ready citation links,
not ordinal `eN` targets that can be confused with a result position. Fresh tools and retained context share the same
projection. The renderer still assigns visible citation numbers by first appearance; labels are not source identities.
Restored evidence is deduplicated and registered in the response's `data-research-context` part before it can resolve.
Server-owned short references remain internal registration metadata. Earlier markers never make an unregistered
source available. Citation rendering, telemetry and development reload recovery understand retained evidence even
when the follow-up makes no new tool calls.

Fresh projection and memory restoration share the pure citation-reference schema, BigInt ordinal calculation and
formatting rules. Internal markers retain the `e` prefix and one to 31 decimal digits with no leading zero.
Malformed historical markers do not reserve ordinals; formatting fails if the next ordinal exceeds that bound.
Allocation state and evidence-to-reference mappings remain response-local. Restored sources receive fresh references
above both historical markers and retained sources; fresh projection reuses those registrations, and previews do not
consume ordinals or mutate retained evidence.

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
research beyond the former step/call cutoffs, clarification and cancellation stops, and explicit empty-answer handling,
not live-model legal accuracy or a resumed evaluation campaign.

## Claim fidelity

The synthesis contract preserves safe-harbor prerequisites, opportunity-versus-completed-hearing language,
proposed-versus-final authority, fiscal component-versus-net effects, and selected-sample-versus-population scope.
It requires the relevant version, dates, denominator or explicit missingness rather than inventing completeness.
Retained-context regressions preserve qualifications alongside the favorable clause and keep narrow query filters,
failed reads and pagination gaps visible across turns.

These are safeguards, not a legal-claim validator. Deterministic transport tests cannot establish that a live model
will interpret every provision correctly. Historical campaign scores are not rewritten; live semantic acceptance
requires a separately authorized, source-reviewed evaluation.

## Citation and passage presentation

The renderer recognizes the observed wrong closing delimiter for numeric references and opaque UUID citation targets
only in Markdown prose. Exact,
answer-owned IDs resolve normally; missing or conflicting IDs use the existing unavailable-citation control.
It does not infer sources from label numbers, similar IDs, previous turns, code literals, images, or link labels.
Missing UUID separators resolve only when all 32 hexadecimal digits exactly match one registered source in the
current answer. Changed digits, unavailable sources and conflicting UUID representations remain unresolved.
Rendering repairs do not rewrite saved model output or establish support for a claim.

Evidence panels and passage cards render retained Markdown headings, tables and links without executing source HTML.
A bare source `<br>` becomes a line break; code literals remain literal. Long card previews scroll and expand the
complete saved excerpt instead of cutting Markdown syntax at a character boundary. Partial-read labels and publisher
links remain visible after expansion. Text absent from the saved evidence is not reconstructed or fetched by the renderer.

Deterministic Storybook fixtures are `ConversationResponse/MalformedCitations`,
`InlinePresentation/MarkdownTablePassage`, `InlinePresentation/QualifiedStudyPassage`, and
`EvidencePanel/MarkdownTable` and `/QualifiedStudy`. They are explicitly synthetic, not historical claim evidence.
At desktop and mobile sizes, activate each `Read source 1: ...` button within its named answer region, verify the
matching source heading and link, close the drawer and check focus return. The later answer deliberately reuses `e549`
with a different source. `Citation 2 unavailable` must never open a source. For previews, keyboard-scroll the
`Retrieved passage` region, then activate `Show retrieved excerpt` with Enter or Space and inspect the net table row
and final qualification. The expanded control is `Show less`; truncation disclosure must remain. These fixtures do
not replace separately authorized historical-source or live-research acceptance.
