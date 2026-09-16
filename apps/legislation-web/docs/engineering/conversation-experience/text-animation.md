# Streaming text animation

Status: proposed tuning/integration work. Can begin on the existing renderer; final ordering depends on
[ordered streaming](ordered-streaming.md).

## Goal

Make incoming prose feel continuously typed, including when one network chunk contains 100 or more characters.
Optimize perceived responsiveness without artificially delaying already-available content or generating unsupported filler.
ChatGPT's exact current animation algorithm is not verified; do not describe an approximation as its implementation.

## Reuse first

Rostra's reviewed `MessageResponse` wraps Streamdown, and response rendering already enables animation. Verify current
installed behavior and CSS before adding another layer.

- [Streamdown animation](https://streamdown.ai/docs/animation) animates newly mounted words or characters. It smooths visual
  arrival but can animate all words in a burst simultaneously; this is not necessarily sequential typing.
- [AI SDK smoothStream](https://ai-sdk.dev/docs/reference/ai-sdk-core/smooth-stream) buffers provider output and emits paced
  chunks. Verify the API against the pinned SDK rather than copying examples from another release.
- Network/proxy batching can recombine server-paced output. Inspect actual browser arrivals before deciding a client-side
  adaptive presentation buffer is needed. Do not add two independent delays by default.

## Behavior

Use a short word-level fade as the starting point, with no re-animation of earlier text. If burst pacing is necessary,
keep received content separate from visible content and reveal small increments on animation frames. Reveal speed should
accelerate with backlog rather than trail the model by seconds. Use locale-aware segmentation and grapheme-safe slicing.
Partial Markdown links, tables, and code must not flicker into broken markup; rely on the streaming Markdown renderer.

Respect reduced motion by showing received text without decorative pacing. Background tabs must not accumulate minutes
of animation work. At completion, drain any remaining backlog promptly. Do not place a component ahead of unrevealed text
that precedes it. Stop/cancel policy must distinguish already received text from text that never arrived.

## Implementation tasks

- [ ] Measure provider, server, browser-arrival, and presentation timing separately.
- [ ] Verify Streamdown animation styles and tune duration/easing without changing the Rostra typography/layout.
- [ ] Evaluate the installed SDK smoothing option and inspect proxy batching.
- [ ] Add bounded client pacing only if the measured result still jumps; preserve canonical text unmodified.
- [ ] Coordinate animation completion, card insertion, scroll following, and accessibility announcements.

## Acceptance

Use 100-character bursts, irregular bursts, fast long answers, slow answers, CJK text, emoji, Markdown, reduced motion,
background-tab restoration, and cancellation. Earlier content never reanimates; final displayed text exactly matches
accepted content; cards preserve ordering. Record measured latency/backlog and choose a maximum presentation lag from
browser evidence rather than treating an illustrative characters-per-frame value as a fixed product requirement.