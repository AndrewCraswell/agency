# React

Conventions for authoring React components in this monorepo. Hooks have their own page — see [hooks.md](hooks.md).

## Components

- **Define components as function declarations**, not arrow consts (use an arrow only for `forwardRef` wrappers).
  **Never use `React.FC`.**
- **Prop types are named `{ComponentName}Props`** and live in the component's `.tsx` file.
- **Omit explicit return types** — let inference handle the render type.
- **The React Compiler is on** — do **not** hand-write `useMemo`/`useCallback`/`React.memo` for performance. Follow the
  Rules of React so the compiler can memoize safely.
- **Name event handlers** with an `on` prefix (`onClick`) or a `handle` prefix (`handleClick`).
- **The app is wrapped in `<StrictMode>` and an app shell** (`FluentProvider` + a top-level `react-error-boundary`).
  Wrap stories and tests with the same shell so every surface shares context.

## Styling

- **Style with Fluent UI v9 griffel `makeStyles()`** and Fluent design tokens (`tokens.*`) — never hardcode colors or
  spacing. A global CSS reset + base is applied once at the app root; component styling stays in griffel.
- **Put styles in `{ComponentName}.styles.ts`** and export a hook named `use{ComponentName}Styles()`; name the result
  `classes` at the call site.

## State, errors & URL

- **Wrap error-prone subtrees in [`react-error-boundary`](https://github.com/bvaughn/react-error-boundary).**
- **Read/write URL state with [`nuqs`](https://nuqs.dev)** rather than hand-parsing `location.search`.
- **Routing is type-safe via [TanStack Router](https://tanstack.com/router)** — register the router type and prefer the
  router's `<Link>` (it validates `to` and preloads on intent).
- **Forms use [TanStack Form](https://tanstack.com/form)** with a `zod` schema validator.

For component file layout (`{ComponentName}.tsx` / `.styles.ts` / `.utils.ts` / `.test.tsx` / `.stories.tsx`), see
[conventions.md](conventions.md#files--component-layout).
