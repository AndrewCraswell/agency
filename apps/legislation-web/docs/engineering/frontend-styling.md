# Frontend styling

Rostra uses shadcn/ui, Tailwind CSS, and vanilla-extract. Reuse the existing design tokens and component patterns rather
than introducing parallel styling infrastructure.

## Component primitives

Use the existing components in `src/components/ui` when an appropriate primitive exists. Add missing shadcn/ui
components from the configured registry instead of rebuilding equivalent Radix or native controls. Domain-specific
components may compose these primitives and apply Rostra's design tokens.

Use the existing `cn` utility to compose Tailwind classes. Tailwind remains appropriate for shadcn/ui and AI Elements
primitives that already use it.

## Custom styles

Use vanilla-extract for custom component styling. Keep typed styles in colocated `Component.css.ts` files and import
their generated class names into components. Keep responsive rules, pseudo-elements, states, keyframes, reduced-motion
behavior, and forced-color behavior with the styles that own them.

`src/app/styles.css` is reserved for shared theme tokens, resets, accessibility defaults, and Tailwind integration.
Prefer existing CSS custom properties for colors, typography, and other shared values rather than duplicating theme
definitions in component styles.

## Build integration

`next.config.ts` uses `@vanilla-extract/next-plugin` with its experimental Turbopack integration enabled in `auto`
mode for the default Turbopack development and build commands.
`vitest.config.ts` uses `@vanilla-extract/vite-plugin` so component tests compile the actual style imports.
Keep relative imports extensionless in the app. Shared-core internal dependencies use existing
`@repo/legislation-core/...` exports so both NodeNext consumers and Turbopack resolve their TypeScript sources.
Relative `.js` specifiers have no emitted file here; Turbopack does not support Webpack's `.js` extension alias.
Do not mock style modules or put custom component selectors back into the global stylesheet.

## Verification

Routine response progress stays in the conversation, not below the composer. Waiting, writing, clarification, and stop
states must not add a composer status row or change the dock height. Disconnected-research and reload-recovery warnings
remain visible because they explain unavailable functionality or data-loss risk.

The response-level Researching indicator appears only before answer text arrives. Once prose starts streaming, it
disappears without a replacement writing spinner; Stop remains available in the composer.

Research activity uses a shared caption preset: 12px type with a 16px line height for the toggle, step names, counts,
details, failure states, and working indicator. Toggle and failure controls retain 44px minimum hit targets. Answer
prose remains 16px. Comparison tables omit the bottom border on their final row so the Sources divider is not doubled;
column headers and intermediate row dividers remain visible.

Activity icons use neutral pending and running, green complete, and red failed and interrupted states; labels remain neutral.
Running activity uses the shared shadcn Spinner with a one-second rotation that stops under reduced motion. The row's
accessible name supplies the state, so its spinner is decorative.

Vote drawer counts stay on one line in a content-sized column with a 48px minimum, with or without proportion bars.
The bar absorbs available width; three-digit tallies must not inherit the drawer's arbitrary text wrapping.

Research activity includes every request in its original order and step count, including failed and denied requests.
Failed and denied rows show a red error icon and persistent "Failed" or "Denied" status respectively inside the activity
list, not a separate card. "Interrupted" is reserved for unfinished requests after execution stops.
Their error details start collapsed and can be expanded from the row using pointer or keyboard controls.
Query, filter, session, and version summaries remain visible while only the error explanation collapses. The error
trigger contains both its header and summary, keeping the normal 6px visual gap within a minimum 44px hit target.

Bill comparisons use the shared shadcn table primitives with a caption above column headers, wrapped cells, and a single
keyboard-focusable horizontal overflow region. They support two to ten distinct retrieved bills, with a 130px field
column and 240px bill columns inside the existing 640px maximum-width region. Wider comparisons scroll horizontally
without shrinking bill columns or overflowing the page. There is no vertical height cap; do not nest scroll wrappers
or turn rows into cards. The shared Markdown response wrapper sets a 700px maximum table height;
shorter tables size naturally and taller tables scroll within that limit.
Comparison row links retain the inline-reference navigation and accessible descriptions below.

The model catalog, reference validation and resolved snapshot bound all use the same ten-bill limit. Presentation
patches have a 32 KiB cumulative UTF-8 budget; the line inspector uses that bound in characters before byte validation.
The 16-patch, three-block and total-input limits remain unchanged. Over-limit input is rejected as a complete block,
never silently truncated; prompts direct larger selections into separate nonoverlapping comparisons or cited prose.

Answer composition supports prose, exact inline record links, selected full/compact cards, source-backed inline views,
and bill metadata comparisons; retrieval
does not automatically render cards. The effective chat prompt combines the Langfuse-managed research prompt with
catalog-generated instructions shipped with the renderer, recording both prompt version and composition hash. Comparison
instructions call for introduction, comparison, then conclusion, without a duplicate Markdown table. Real-data examples
live in [ConversationResponse stories](../../src/modules/conversations/stories/ConversationResponse.stories.tsx): Inline
Mention, Selected Card, Metadata Comparison, and Prose Only. They cover repeated citations and unused retrieved records.
Source-selection reliability remains separate from correct component selection and placement.

`ComposedRecord` renders the constrained json-render catalog through the existing record cards and comparison table.
Pending content shows a compact loading state only while the response is running. Error blocks carry a bounded reason
(`presentation`, `records`, or `interrupted`) and the component type when known. Invalid comparison output says
"Comparison could not be displayed"; unknown visual formats say "Content could not be displayed". Only failed record
resolution uses "Record unavailable", or explains that a selected record could not be loaded within a comparison.
Interrupted blocks say "Content incomplete" or "Comparison incomplete". These states have no nonfunctional Retry action
and do not remove surrounding prose or citations. Earlier failed snapshots are not regenerated or rewritten. Inspectors retain
the existing result-store access checks and keyboard focus return. The
[ComposedRecord stories](../../src/modules/conversations/stories/ComposedRecord.stories.tsx) cover all eight record kinds,
plus Loading, Interrupted, Invalid Reference, Unavailable, Invalid Comparison and Five Bill Comparison states. The
five-bill fixture retains exact result projections from Langfuse observation `0b20ee661c71ef46`, capture
`9afb10ac-63ec-4265-bb57-16c6ce83cb7c`. Replay preserves the records and surrounding prose; this is rendering acceptance,
not an endorsement of source-data consistency or the generated policy conclusions. Post-render evidence revocation is a separate policy
question, not a capability of this renderer.

## Inline records and evidence

The AI catalog includes `CompactRecordCard`, `CitationCard`, `PassageQuote`, `ResultList`, `ProgressPath`,
`RecordTimeline`, `RollCall` and `RecordStatus` alongside full record cards and bill comparisons. The version pin is
explicitly excluded. Existing prototype account actions are not expanded by this work.

Full and compact record cards use exact current-response `resultId`/`recordId` references. All other new views use an
opaque `contentId` copied from the successful tool result's `presentationOptions`. Each option lists its permitted
components; evidence options also identify the exact evidence reference, locator and content state. The server owns
the bounded snapshot registry for that response and resolves only those IDs. Model-authored quotes, dates, rows, source
URLs or availability labels are not accepted. Component/content mismatches fail closed. Duplicate evidence blocks do
not silently repeat a passage. The existing three-block and stream-size limits remain in force.

- Compact cards follow design `CBdbG`/`eeJmn`: desktop title/status row, mobile title/metadata with navigation affordance,
	no body or account actions. Titles use existing profile/source routes or vote/meeting inspectors.
- Citation cards and passage quotes follow `cbBs4`/`TjAME`, using the exact retrieved text, source, version and locator.
	Quotes over 600 characters show a labeled prefix with a working full-passage expansion; the full snapshot remains
	unchanged. Copy citation and safe publisher links work. Missing, failed and not-collected passages are explicit.
	Numbering is shared with prose citations and the cited-only Sources list; quote selection is included in composed
	telemetry. These are inline views, not a reversal of the URL-only citation-tooltip decision.
- Progress paths show only returned action events in a keyboard-scrollable horizontal track. Timelines preserve returned
	action/vote ordering and dates. No future stages, passed-law outcome or complete coverage is inferred. Continuation
	metadata produces a partial-view notice.
- Selected result lists reuse the existing compact rows, session-owned pagination and error/expiry recovery. They are
	inserted only when selected by the AI, never automatically for every retrieval.
- Roll calls show supplied tallies and the first six retrieved member positions with an explicit count. The full-roll-call
	action opens the existing inspector and restores focus; missing positions or incomplete tallies stay explicit.
- Not-found cards require an explicit per-record `not_found` batch-lookup result. Not-collected cards describe an
	unreturned passage, not an unsupported claim that a jurisdiction is outside coverage. A retrieved passage for the
	same document suppresses the contradictory not-collected option. Neither state adds fake account/recovery actions.

[Inline presentation stories](../../src/modules/conversations/stories/InlinePresentation.stories.tsx) use captured
document, timeline, vote and result data, with separately simulated absence/failure/loading states.
[Composed record stories](../../src/modules/conversations/stories/ComposedRecord.stories.tsx) include compact cards,
ten-bill comparisons and comparison interruption/resolution errors.
[Input stories](../../src/modules/conversations/stories/ConversationInputs.stories.tsx) cover composer, reference-picker
and captured AI-suggestion states; [clarification stories](../../src/modules/conversations/stories/ClarificationQuestion.stories.tsx)
cover single/multiple/free-text questions, receipts, expiry and failed confirmation. No model calls run inside Storybook.

September 17 acceptance: a live Luna answer selected a compact bill card, citation card and recorded progress view in
conversation `x6g3eywJejYuIa0x`; all three blocks resolved. Desktop/mobile inspection confirmed exact quote expansion,
shared source numbering, version-specific source links, focus return and keyboard progress scrolling. Inline-view
stories cover desktop/mobile layouts; compact vote/meeting inspectors and reference-search states were exercised.
The ten-bill boundary story supplements the earlier five-bill capture with S 1132 from the same retained observation
and HR 1 from a September 17 read-only canonical lookup. It is a layout boundary example, not an insulin-policy comparison.
The focused seven-file suite passed 264 tests; three additional copy/pagination/inspector regressions subsequently
passed in the eleven-test inline-view file. Conversation lint and web types passed. The repository gate reached the
existing unrelated Knip findings before coverage; this is not a clean full-repository verification claim.

## Record labels

Session display prefers the published session name carried by bill results. The comparison Session column is separate
from chamber metadata. Without a published name, use conservative labels such as `2023-2024` and `118th Congress`;
preserve special-session identifiers without guessing a classification. Apply the same labels to research-activity
session filters and references. Internal session IDs remain unchanged for queries and identity.

Single and batch bill reads keep the compact bill number, jurisdiction code, and readable session (for example,
`AB 2652, CA, 2023-2024`) across states, rather than switching to full bill titles. Bill-text reads retain their
title-focused display. Incomplete IDs and other record IDs are not guessed; request identity remains unchanged.

Record reads reuse titles from earlier successful result sets in the same response, matched by exact record ID, before
their own result arrives. This keeps known person and organization names visible through pending, running, interrupted,
and expanded error states. The current matching result takes precedence; unknown records keep their identifier label.

Activity summaries retain supplied queries alongside scope filters, named record targets, dates, and request limits.
Transport cursors and anchors are not displayed. Bill searches use `AB 2652, CA, 2023-2024; Up to 5 results` with no
mode suffix. Bill-text searches omit mode and document-selection details; bill-text reads show only the bill title or
compact bill label. Mode is hidden for every tool. Technical filter values use readable names such as `Reports`,
`Committees`, and `Regulations`; structural enumeration uses `All provisions` or `Direct children`. Other meaningful
filters stay visible rather than disappearing when a query is present.

Activity titles use `Search` when substantive filters are supplied and `List` for unfiltered requests. Limits, modes,
and cursors do not count as scope; explicit false boolean filters do. Before input arrives, do not assume list scope.
Organization operations use `Search organizations`/`List organizations` and `Read organization`; amendment lookup by
bill uses `Find amendments for bills`. Tool API names do not change.

Every explicit limit uses `Up to 5 results` (or `Up to 1 result`), independently of the actual `5 returned` count.
Date labels omit colons: `From Sep 1, 2026`, `To Sep 16, 2026`, and paired bounds use `Between` with an em dash.
Unfiltered recorded-change requests show `All records, all jurisdictions`. Scope refers to stored data, not guaranteed
global coverage. Repeated unnamed batch records are grouped, such as `2 selected votes`, while known names are retained.

Supporting-material searches hide mode, retain queries and scope filters, and use short bill labels such as `HR 152`.
Unfiltered requests show `All supporting materials; Up to 5 results`; actual returned counts stay separate. Material
reads prefer the matching published title from current or earlier results, otherwise `Selected supporting material`,
without exposing an opaque record ID. Single and batch amendment reads use `HR 152: HAMDT 10` when the related bill is
known, otherwise the amendment identifier alone. Find amendments for bills uses short bill labels and the requested limit.

The meeting tool accepts jurisdiction, organization, and date filters. With none supplied, the activity is `List meetings`
and shows `All jurisdictions; Up to 5 results`. Ordering is not narrated; the database still uses ascending start-time
order over non-deleted records, not an upcoming-only or latest-first search. Filtered requests retain `Search meetings` and
their actual filters. The limit is the requested maximum, not a returned count. No limit is invented when input is absent.
Recorded-change and vote searches similarly show their supplied scope, dates, and limits. Storybook includes a simulated
filtered meeting request beside the captured unfiltered states.

Batch reads display the requested `ids` in input order, separated by semicolons. Batch bill reads keep their compact
bill labels in every state, including completion; returned full titles do not replace them. The returned count remains
separate from the requested bill list. Other batch reads can use matching published titles when available.

Version comparisons display the compact bill label from `billId` as soon as it arrives and retain it on completion.
The next line shows document version codes or titles in requested order, separated by `vs.`. Before completion it
resolves metadata from preceding bill, batch, and text tool results in the same response, matched by bill and document
ID. Completion uses the comparison result metadata. Identical labels include available document dates. Missing labels
explicitly say `Version 1 (label unavailable)` or `Version 2 (label unavailable)`; they are input positions, not inferred
chronology. Opaque `documentIds` are not shown as version names.

Inline record mentions are ordinary underlined links or text buttons, not superscript citations or pills. Use the
existing primary/link color, visible focus outline, and external-link icon for publisher destinations. Preserve the
visible short name as the accessible name; the full retrieved record title is an accessible description. Vote/meeting
mentions open existing drawers and return focus to the activated mention. Unresolved references remain plain text.

User override for inline citations: use 16px minimum width, 14px height, 10px monospace numerals, a subtle theme-colored
outline, no brackets, and a relative upward offset of 0.8em without increasing paragraph line height. Source-list numbers
retain the filled badge and subtle outline at 16px height and minimum width with 10px numerals. Evidence-panel
numbers retain their normal size. Inline buttons keep keyboard focus, URL-only tooltips, and evidence
inspection on activation. The cited-only sources list remains a collapsed accordion by default.

Sent questions render stored mention segments as light inline tags with a person or committee icon and green published
name, without the typed `@` trigger. Tagged identities are not repeated
in the submitted-reference row; that row is reserved for separately attached records. Plain typed names never become
tags by text matching. The existing message text must match its stored draft before that draft is rendered.

Mention suggestions use a stable 420px desktop width, capped to the viewport with 16px gutters. The positioning library
must not replace that width with `max-content`. Initial and one-character queries show static skeleton rows and the
typing prompt without claiming a network request; pending searches animate the same three rows and mark the list busy.
People and committees are grouped; mobile omits the redundant trailing type labels. Errors retain retry and raw text.
[Mention suggestion stories](../../src/modules/conversations/stories/ComposerSuggestions.stories.tsx) cover initial,
loading, matching, ambiguity, scrolling, failure/retry, keyboard, limits and mobile states.
[Sent tag stories](../../src/modules/conversations/stories/MessageQuestion.stories.tsx) cover identity types, repetition,
long names, narrow wrapping, raw typed names and separate reference attachments.

Run focused component tests and `pnpm --filter legislation-web check:types`. Build integration changes also require
`pnpm --filter legislation-web build`. Verify user-facing styling changes in the browser at desktop and mobile sizes,
including supported themes, keyboard focus, reduced motion, and forced colors where applicable.
