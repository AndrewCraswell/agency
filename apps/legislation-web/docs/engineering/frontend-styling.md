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
Keep relative imports extensionless in the app and transpiled `@repo/legislation-core` source. Turbopack resolves the
TypeScript source directly and does not support Webpack's `.js` extension alias.
Do not mock style modules or put custom component selectors back into the global stylesheet.

## Verification

Run focused component tests and `pnpm --filter legislation-web check:types`. Build integration changes also require
`pnpm --filter legislation-web build`. Verify user-facing styling changes in the browser at desktop and mobile sizes,
including supported themes, keyboard focus, reduced motion, and forced colors where applicable.
