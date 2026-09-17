# Conversation review in Storybook

Run `pnpm --filter legislation-web storybook`, then open
`http://127.0.0.1:6007/?path=/story/review-conversation--all`.
The isolated canvas is `http://127.0.0.1:6007/iframe.html?id=review-conversation--all&viewMode=story`.
Storybook is separate from the Next application; no development route is exposed by a production build.

## Review coverage

- All eight entity card kinds, with all 31 captured record variants in the main gallery. Turn off the variants checkbox
  for one representative per kind. The source record ID and originating tool appear above each sample.
- Each of the 25 registered research tools in eight execution states: awaiting input, receiving input, running,
  interrupted input, interrupted request, complete, failed, and denied (200 samples).
- Collapsed/expanded accordions, mixed outcomes, active/interrupted requests, no tools, a real empty result, and
  collapsed failure content. All eleven research error messages, plus unknown-tool and clarification labels.
- Component stories under `Conversation/ResearchActivity`, `Conversation/ConversationResponse`, and
  `Conversation/ComposedRecord`. Each research tool has its own story showing all eight activity states together,
  plus expanded failure and denial examples. `Failure Messages` shows all eleven errors expanded. Response stories isolate
  accordion scenarios, and record-kind stories render every captured variant together, not behind a selector.
  `Review/Conversation/All` retains the combined
  gallery for cross-component navigation and profile workflows. The existing theme control
  switches light/dark, and Storybook viewport controls support narrow-screen review.

Visual regression captures should wait for each story's play function to finish. Per-tool stories expose all states
and details in the canvas; the eight card-kind stories expose all captured records. Capture the full canvas at desktop
and mobile widths, use reduced motion for deterministic snapshots, and keep the checked-in dataset fixed between
baseline and comparison runs. Controls are optional inspection aids, not required to expose snapshot coverage.

`Version Comparisons` shows identical labels with different dates, one missing label, and side-by-side states before
and after metadata arrives. `Batch Reads` covers one bill, the 25-bill limit, long labels, and partial results. These
explicitly labeled simulations exercise UI edge cases without modifying captured records or claiming real outcomes.
`Mixed Outcomes Expanded` exposes successful activity and failure details together.

Drawer stories live under `VoteDetails`, `MeetingDetails`, and `EvidencePanel`. They open the actual drawer with captured
content, including three-digit vote counts, paginated positions, meeting titles, and source passages. Loading, failed,
expired, and unavailable-content examples are simulated story states. MSW overrides are reset after each story.
Capture the viewport for these portal-based drawers rather than only the story root. Each has a working close/reopen
control and focus return. Record profile pages and the reference-picker dialog are not drawers.

The actual `ResearchActivity`, `ConversationResponse`, and `ComposedRecord` components render the examples. Vote and
meeting drawers, and person/organization/material profiles, use the production inspector components. Storybook intercepts
their `/chat` reads with MSW and returns captured details. Unknown requests are rejected; stories do not call a model.
Publisher links remain real external links. A mocked execution failure is not a claim that the real source failed.

## Real-data capture

`pnpm --filter legislation-web storybook:capture` reads the configured database using read-only transactions and the
existing query service/tool contracts, then writes `src/modules/conversations/stories/captured.json`. It fetches records,
real query results, source metadata and inspector details; it does not fabricate record fields, dates, counts, statuses,
or source URLs. It makes no model calls. Database credentials are only loaded by the capture command and are never
bundled into Storybook. Credentials in retained results are redacted with the existing capture utility.

The dataset records the start of its capture batch. `storybook:capture --details-only` fetches missing inspector data
without repeating completed discovery calls. The gallery validates that all tool labels and card kinds are represented;
fixture tests also check all interactive variants have matching captured details. A failed or missing capture must be
resolved, not replaced with a fake successful record. Empty real results remain empty.

Use `pnpm --filter legislation-web storybook:build` for a standalone static review build. Storybook uses MSW's exported
experimental `defineNetwork`/`InterceptorSource` API with Fetch and XMLHttpRequest interceptors inside the preview.
It does not register a service worker: the integrated browser can stall during worker registration and block every
story's startup. Handlers and per-story overrides remain MSW-native. The constructor has a narrow type suppression
for MSW's invariant HTTP/WebSocket event-union declaration; type-checking detects when that suppression is obsolete.
Production networking is unchanged. Shared Storybook configuration is inherited from
`@repo/storybook-config`, with the Next.js/Vite adapter supplying navigation and image behavior.

## Verification

The September 17, 2026 capture contains 42 successful live tool calls and 31 distinct records with no capture failures.
Four fixture tests verify tool/card coverage, lifecycle payloads, and inspector snapshots for every interactive variant.
Web type checking, scoped lint, and the static Storybook build passed. Browser review covered the All story and its play
function, real vote positions, meeting materials, profile navigation and focus return, 390px layout without page overflow,
and light/dark themes with loaded Rostra fonts. Full animation timing in an inactive integrated-browser tab is not a valid
acceptance signal; drawer focus checks used reduced motion. No production route or deployment was added.