# Frontend styling

## Purpose and scope

This page describes the frontend styling libraries and infrastructure we use, their responsibilities, and their
integration. Update it only when the stack, configuration, or infrastructure changes. It is not a visual specification,
product behavior reference, acceptance report, or style-change log. Component-level timing, spacing, sizing, colors,
copy, and layout adjustments belong in the owning implementation and stories, not here.

## Libraries

- **shadcn/ui and Radix UI:** shared component primitives live in `src/components/ui`. The shadcn configuration in
  `components.json` selects the `new-york` style, React Server Component support, TypeScript, and CSS-variable theming.
  Reuse these primitives rather than introducing a parallel component system.
- **Lucide React:** the icon library selected by the shadcn configuration.
- **Tailwind CSS:** utility styling for shadcn/ui and AI Elements components. The shared `cn` utility in
  `src/components/ui/utils.ts` composes classes.
- **vanilla-extract:** typed custom component styles in colocated `Component.css.ts` files, imported as generated
  class names. Responsive rules, pseudo-elements, state styles, keyframes, reduced-motion rules, and forced-color
  rules stay with the owning styles.

## Shared styling infrastructure

`src/app/styles.css` owns shared theme tokens, resets, accessibility defaults, and Tailwind integration. Components
consume the existing CSS custom properties rather than duplicating theme values or adding component-specific selectors
to the global stylesheet.

`components.json` defines the shadcn component, utility, and hook aliases and points its Tailwind integration at this
global stylesheet. Existing AI Elements primitives use the same Tailwind and theme infrastructure.

## Build and test integration

`next.config.ts` integrates vanilla-extract through `@vanilla-extract/next-plugin`, with experimental Turbopack support
enabled in `auto` mode for development and builds. `vitest.config.ts` uses `@vanilla-extract/vite-plugin` so component
tests compile actual style imports instead of mocked style modules.

App-relative imports are extensionless. Shared-core imports use the existing `@repo/legislation-core/...` package
exports so NodeNext consumers and Turbopack resolve the same TypeScript sources. Relative `.js` specifiers have no
emitted file here; Turbopack does not support Webpack's `.js` extension alias.

See [Storybook](storybook.md) for the component workshop infrastructure and
[testing](../operations/testing.md) for verification commands and ownership.
