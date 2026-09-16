# Ordered text and UI streaming

Status: proposed. Depends on [composition](answer-composition.md) and [rendering](generative-ui-rendering.md).

## Contract

Maintain one ordered response containing prose and selected UI blocks. Transport chunk boundaries do not define
paragraphs, cards, or visual placement. Stream prose immediately as it becomes available; do not buffer an entire
paragraph or full JSON answer before displaying text.

Conceptual sequence, not a prescribed wire protocol:

```text
Start prose A -> append text deltas -> finish prose A
Declare comparison B -> validate references/spec -> populate comparison B
Start prose C -> append text and citation references -> finish prose C
Finish response
```

Use the AI SDK's supported stream facilities and json-render's actual inline streaming integration. Do not introduce a
second patch language, incremental JSON parser, or event transport before inspecting existing library capabilities.

## State and rendering

- Separate received, validated, and presented content. A transport-complete event does not mean animation has caught up.
- Assign stable block IDs; updates modify the existing block rather than append duplicates.
- Text may appear progressively; a component mounts only after its required props and references validate.
- Reserve a stable position for a pending component. A later block must not jump ahead of preceding buffered prose.
- Citations become interactive only after evidence resolution. Never show a fabricated placeholder source.
- Keep tool progress independent from the composed answer. Failed retrieval activity is not a presentation block.

## Implementation tasks

- [ ] Replace the renderer's text/result/source buckets with ordered presentation state.
- [ ] Integrate incremental catalog specs while retaining immediate prose delivery.
- [ ] Define duplicate/out-of-order event handling using supported sequence or revision facilities.
- [ ] Preserve completed blocks on stop, timeout, model error, invalid component output, and disconnect.
- [ ] Connect [animation](text-animation.md) completion to block ordering and composing/running indicators.
- [ ] Keep validated answer state in the existing active conversation lifecycle; do not introduce a durable event store.

## Acceptance

Exercise prose-card-prose, multiple comparisons, citations arriving with text, bursty transport, stop mid-word,
stop mid-component, tool failure, and disconnect. Earlier text and cards remain stable in the active view; incomplete content is marked.
User-scrolled reading position is preserved. Auto-scroll follows only when the user is already following the latest output.
Screen readers must not announce every token, and keyboard focus must not move as blocks arrive.

## Non-promises

This work does not add reload recovery, durable run resumption, or replay after process loss. Preserve existing lifecycle
behavior and mark interruptions accurately rather than expanding the scope into conversation storage.