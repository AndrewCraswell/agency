# Composed research conversations

Status: proposed implementation plan. Prepared September 16, 2026 from the conversation-design discussion.
These documents describe work to do, not implemented behavior or production acceptance. Keep this planning set local
and uncommitted until explicitly requested otherwise.

## Outcome

Rostra should compose an answer from streaming prose, grounded entity references, selected interactive views, and
claim-level citations. Research results should not automatically become a stack of cards and repeated sources beneath
the answer. Keep this effort focused on presenting grounded research within the active conversation.

## Independent workstreams

| Workstream | Owning document | Depends on |
| --- | --- | --- |
| Stable records, evidence, citations, and deduplication | [Evidence and identity](evidence-and-identity.md) | Existing retrieval and authorization contracts |
| Model-selected prose and visual blocks | [Answer composition](answer-composition.md) | Evidence and identity |
| Component catalog and schema-to-React rendering | [Generative UI rendering](generative-ui-rendering.md) | Answer composition |
| Ordered text and UI event delivery | [Ordered streaming](ordered-streaming.md) | Composition contract; renderer integration |
| Smooth typing and word reveals | [Text animation](text-animation.md) | Existing text stream; integrate with ordered streaming |

## Delivery order

1. Establish entity/evidence identity and the constrained composition contract together.
  Include shared citation numbering, URL-only tooltips, readable-source resolution with logged fallback, and a
  cited-sources-only list in this first milestone; unused retrievals remain diagnostic data.
2. Deliver one vertical slice: streamed prose, one inline entity reference, one selected card, and a valid citation.
3. Add comparisons, deduplication, cancellation, and ordered streaming behavior; tune typing animation using bursty input.

Animation tuning can be prototyped independently and integrated when ordered streaming is ready.

## Decisions and boundaries

- Greenfield demo: replace obsolete contracts directly; no compatibility aliases or dual render paths.
- Prefer `json-render` for the constrained component registry and inline streaming integration, subject to installed-version
  compatibility and dependency approval. Tambo is an alternative, not a second stack to install alongside it.
- MCP Apps, conversation persistence, and forking are excluded from this effort, not prerequisites or later delivery steps.
- Reuse the current conversation lifecycle and authorization boundaries; do not add durable storage or reload recovery.
- Preserve Rostra's existing components and visual language. This effort is not a redesign or a replacement retrieval engine.
- Existing result-size/pagination fixes are separate runtime work; this plan does not certify their final acceptance.

## Verification and tracking

Implement complete, coherent slices. Exercise representative conversations while developing; run one focused automated
verification pass after all fixes in the agreed slice are ready. Do not run the monorepo suite for this effort by default.
Do not create executable tests for these planning documents. Implementation tests must cover real contracts and behavior.
Use the integrated browser for desktop/mobile, keyboard, reduced-motion, scrolling, and interruption acceptance.
Track each workstream as proposed, in progress, blocked, or accepted; record concrete acceptance evidence in its owning page.
Keep new evaluation rules and scoring in Langfuse-native workflows rather than creating a separate local grading pipeline.

Entry points: [web documentation index](../../README.md) and
[public chat backlog](../../backlog/public-chat.md).