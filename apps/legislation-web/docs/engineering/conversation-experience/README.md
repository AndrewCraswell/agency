# Composed research conversations

Status: implementation in progress. Prepared September 16, 2026 from the conversation-design discussion.
Owning pages distinguish implemented behavior and verification from remaining acceptance. This documentation-only
closeout records the user's requested spec cleanup separately from implementation commits.

## Document closeout

Close these records one at a time against agreed scope and recorded evidence. An unchecked planning box is not proof of
missing implementation, and an agent-suggested extension is not an agreed requirement. Completion here means local
implementation, not deployment or a clean full-repository verification run.

Delete completed specs after closeout. Text animation, generative UI rendering, answer composition, and ordered streaming are complete for the agreed local
implementation scope; their specs have been removed. The [answer catalog](../../../src/modules/conversations/composition.ts),
[record renderer](../../../src/modules/conversations/components/ComposedRecord.tsx),
[stream adapter](../../../src/modules/conversations/compositionStream.ts), and
[ordered response renderer](../../../src/modules/conversations/components/OrderedAnswerContent.tsx) remain the implementation references.

| Document | Closeout status | Next action |
| --- | --- | --- |
| [Evidence and identity](evidence-and-identity.md) | Foundation implemented; review pending | Separate completed citation UI from semantic source-quality gaps and unconfirmed enrichment/access requirements. |
| This index | Open until the workstreams are reviewed | Keep statuses and scope decisions aligned with the owning pages. |

## Outcome

Rostra should compose an answer from streaming prose, grounded entity references, selected interactive views, and
claim-level citations. Research results should not automatically become a stack of cards and repeated sources beneath
the answer. Keep this effort focused on presenting grounded research within the active conversation.

## Independent workstreams

| Workstream | Owning document | Depends on |
| --- | --- | --- |
| Stable records, evidence, citations, and deduplication | [Evidence and identity](evidence-and-identity.md) | Existing retrieval and authorization contracts |

## Delivery order

1. Establish entity/evidence identity and the constrained composition contract together.
  Include shared citation numbering, URL-only tooltips, readable-source resolution with logged fallback, and a
  cited-sources-only list in this first milestone; unused retrievals remain diagnostic data.
2. Deliver one vertical slice: streamed prose, one inline entity reference, one selected card, and a valid citation.
3. Add comparisons, deduplication, cancellation, and ordered streaming behavior; tune typing animation using bursty input.

Text animation, generative UI rendering, answer composition, and ordered streaming are implemented; evidence and identity is the remaining workstream.

Current work: [citation foundation progress](evidence-and-identity.md#implementation-progress). Text animation was closed
against the recorded desktop/mobile measurements and the user's acceptance of the improved streaming behavior.
The implemented answer catalog uses json-render 0.20.0. Installed Streamdown already
provides word staggering and a bounded animation backlog, so no additional typing buffer has been added.
Grounded inline record mentions reuse the existing profile, publisher-link, and inspector behavior. The
bill metadata comparison uses the same constrained json-render stream.
The [ordered response renderer](../../../src/modules/conversations/components/OrderedAnswerContent.tsx) coordinates prose and block visibility with
a bounded drain policy. Malformed-fence diagnostics and exact model-facing citation links are implemented. Semantic
citation-selection reliability remains a known quality gap. Richer policy-comparison components and cross-segment
footnotes are suggestions/limitations recorded during implementation, not additional agreed scope.

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