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
keyboard-focusable horizontal overflow region. They have a 560px minimum table width and no vertical height cap; do not
nest scroll wrappers or turn rows into cards. The shared Markdown response wrapper sets a 700px maximum table height;
shorter tables size naturally and taller tables scroll within that limit.
Comparison row links retain the inline-reference navigation and accessible descriptions below.

Answer composition supports prose, exact inline record links, selected cards, and bill metadata comparisons; retrieval
does not automatically render cards. The effective chat prompt combines the Langfuse-managed research prompt with
catalog-generated instructions shipped with the renderer, recording both prompt version and composition hash. Comparison
instructions call for introduction, comparison, then conclusion, without a duplicate Markdown table. Real-data examples
live in [ConversationResponse stories](../../src/modules/conversations/stories/ConversationResponse.stories.tsx): Inline
Mention, Selected Card, Metadata Comparison, and Prose Only. They cover repeated citations and unused retrieved records.
Source-selection reliability remains separate from correct component selection and placement.

`ComposedRecord` renders the constrained json-render catalog through the existing record cards and comparison table.
Pending content shows a compact loading state only while the response is running. Interrupted pending blocks, failed
resolution, and mismatched references use the unavailable state; they do not render guessed metadata. Inspectors retain
the existing result-store access checks and keyboard focus return. The
[ComposedRecord stories](../../src/modules/conversations/stories/ComposedRecord.stories.tsx) cover all eight record kinds,
plus Loading, Interrupted, Invalid Reference, and Unavailable states. Post-render evidence revocation is a separate policy
question, not a capability of this renderer.

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

Run focused component tests and `pnpm --filter legislation-web check:types`. Build integration changes also require
`pnpm --filter legislation-web build`. Verify user-facing styling changes in the browser at desktop and mobile sizes,
including supported themes, keyboard focus, reduced motion, and forced colors where applicable.
