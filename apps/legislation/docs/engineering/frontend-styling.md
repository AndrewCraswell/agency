# Frontend styling

## Design fidelity

Every new or changed conversation component must be backed by an actual component or screen in
`legislation.pen`, inspected through Pencil MCP before implementation. The design is the specification, not loose
inspiration. Record the source node IDs with the owning backlog item.

- Inspect the reusable component and relevant desktop/mobile instances, including enabled children, counts, icons,
  typography, spacing, border, radius, colors, and interaction/state notes. Do not stop at its name or a thumbnail.
- Match the complete applicable component. Do not substitute library defaults or silently omit details such as counts,
  disabled states, feedback, or responsive variants. Example data must become real state, never a hard-coded fixture.
- Compare browser screenshots and computed dimensions against the design, alongside keyboard and state checks.
  Passing types or behavioral probes does not establish visual fidelity.
- Explicit user overrides take precedence (for example, icon-only Copy). Record any other necessary deviation and
  unresolved design inconsistency before claiming completion. Deferred features remain visibly tracked as incomplete.

## Implementation

`AppShell` and `AppHeader` in `app/components/shell` own the shared product frame. Both conversation and record pages
must use them. The header follows `fSLz1` geometry (56px high, 22px mark, 18px Fraunces wordmark, 16px horizontal
padding); the implemented utilities are Open conversation and the approved theme control. Canonical search,
sidebar/directory navigation, account and notification surfaces are still incomplete, not design-equivalent omissions.
Before accepting a page, compare its complete shell, navigation, identity/actions, section hierarchy, typography,
spacing, populated/empty/error states and mobile composition against the current design. Component geometry alone
does not establish page fidelity. Do not duplicate a header or replace missing functionality with a decorative control.

Use shadcn/ui components wherever an appropriate component exists. Check the existing `app/components/ui` catalog
first; add missing components from the configured shadcn registry rather than rebuilding them directly from Radix
or native elements. Keep domain-specific composition and Rostra's design tokens in the owning component styles.
Sheet is the standard side-panel structure; use its header, title, close and footer parts. Badge, Table and Progress
provide the corresponding record-detail primitives. This does not authorize switching to stock shadcn styling.

User override for conversation metadata: timestamps and icon-only Copy actions belong in a footer below each
message, not in its author header. User footers align right; Rostra footers align left. On hover-capable devices,
footers fade/slide in on message hover, with space reserved to avoid layout shifts. Only `:focus-visible` within the
footer also reveals its controls for keyboard access; ordinary focus after a mouse click must not pin them open.
Touch devices keep them visible. Reduced motion removes the transition. Full timestamp tooltips
use the abbreviated timezone. This supersedes the earlier always-visible timestamp design for message headers.
Both authors use an 8px gap between the final content block and the action footer. Strip the final Markdown block's
bottom margin so it does not add hidden spacing; retain the response's normal spacing between content sections.

Result pagination appears only when `hasPrevious` or `hasNext` is true. Single-page results have no pagination
controls or range-count row, regardless of the number of records. Last pages retain Previous and a disabled Next.

Vote tally color override: Yes/Aye values use `--state-success` (green), and No/Nay values use `--state-danger`
(red), including zero counts. Other categories remain neutral. Keep explicit labels; color is supplementary.

Vote cards show only Yes and No, plus Total when all canonical tally categories are present. Total includes all
reported categories, not just Yes and No. The drawer retains the full breakdown and published member positions.
Result badges use the shared shadcn-based `ResultBadge`: green/check for recognized successful outcomes, red/X for
unsuccessful outcomes, amber/clock for explicitly pending outcomes, and gray/minus for other outcomes. Preserve
the exact source label; never infer the result from counts or substring matches.

Document card footers keep the compact design's 8px vertical padding on desktop, without a 44px minimum on the
text link. On no-hover or coarse-pointer devices, use a 44px link target and remove the footer's vertical padding
instead of adding the two heights together.

Rostra uses vanilla-extract for custom component styles. Author typed style objects in colocated `Component.css.ts`
files and import their class names into the component. Next.js extracts static CSS at build time; no runtime styling
provider is needed. Keep related responsive rules, pseudo-elements, states, and keyframes with their owner.

- `app/components/chat/ChatWorkspace.css.ts` owns the chat layout, headings, and suggestions.
- `app/components/chat/ChatComposer.css.ts` owns the question field, send controls, and animated halo.
- `app/styles.css` is limited to shared theme tokens, resets, accessibility defaults, and Tailwind integration.
- Existing shadcn and AI Elements primitives retain Tailwind utilities. Compose their classes with the existing `cn`
  utility. Custom vanilla-extract rules are unlayered, preserving their precedence over Tailwind's layered defaults.
- Reuse the shared CSS-variable tokens for colors and fonts. Do not duplicate light/dark palettes in component files.
- Keep reduced-motion and forced-color behavior beside animations. The demo halo remains static under reduced motion
  and is hidden in forced colors; the input focus outline remains available.

`next.config.ts` uses `@vanilla-extract/next-plugin` with the existing Webpack development/build commands.
`vitest.config.ts` uses `@vanilla-extract/vite-plugin` so component tests compile the actual style imports.
Do not mock style modules or put custom component selectors back into the global stylesheet.

Validate changes with focused component tests and `pnpm --filter legislation check:types:web`, then the required
`pnpm verify`. Build integration changes also need `pnpm --filter legislation build:web`. Inspect desktop/mobile,
light/dark themes, keyboard focus, and reduced motion in the browser; DOM tests cannot establish visual equivalence.