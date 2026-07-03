# Agency Monorepo — Project Guidelines

A Turborepo + pnpm monorepo. The `web` app is a React 19 + TypeScript SPA built with Vite, the
[React Compiler](https://react.dev/learn/react-compiler) (with `<StrictMode>`), and Fluent UI v9. Shared config lives in
`@repo/*` packages under `packages/`. See [README.md](../README.md) for setup and the [docs index](../docs/README.md)
for conventions.

## Tooling (differs from common defaults)

- **Lint:** `oxlint` (not eslint) · **Format:** `oxfmt` (not prettier).
- **Type-check:** `tsc` from a pinned native TypeScript — keep the version aligned across packages.
- **Test:** Vitest (jsdom unit + Storybook browser tests) · **Bundler/dev server:** Vite · **Workshop:** Storybook.
- **Package manager:** pnpm (`>=11`) on Node `>=24`, enforced via root `engines` + `engine-strict`.
- **Task runner:** Turborepo.

## Build / verify loop

Run `pnpm verify` before declaring work done — it must be clean. It runs `check` (oxfmt format + `oxlint` lint and `tsc`
type-check deferred per-package via Turbo + `knip` once over the whole graph) then `test:coverage`. Formatting is
global; lint and type-check are per-package; knip is root-only.

Git hooks (lefthook): **pre-commit** runs `oxlint --fix` + `oxfmt` on staged files; **pre-push** runs
`pnpm check:types`. Don't bypass them with `--no-verify`.

## Workspace layout

- `apps/web/` — the React + Vite application.
- `packages/ui/` — shared component library (`@repo/ui`).
- **Reusable shared config** (extend these; don't redefine per package): `@repo/oxlint-config`,
  `@repo/storybook-config`, `@repo/typescript-config`.

## Conventions

Coding conventions live in the [`docs/`](../docs/README.md) folder — start at the index and read the relevant page
before writing code. Two points worth stating up front: the **React Compiler is on** (don't hand-write
`useMemo`/`useCallback`/`memo`), and **reuse before building** — check the [hooks](../docs/hooks.md) and
[type-helper](../docs/typescript.md) catalogs before writing your own.

Prefer the tools in the [preferred tech stack](../docs/tech-stack.md); **introducing a library that isn't already used
needs a human discussion**, not a silent add.

## Documentation

- **Keep this file brief** — it's the entry point; link to `docs/` articles rather than duplicating detail.
- **Prefer small, focused `docs/` pages**, and update them (and the [index](../docs/README.md)) in the same change as
  the behavior they describe.

## Gotchas

- Hosted on **GitHub** — use GitHub for PRs and issues.
- oxlint rules live in the shared `@repo/oxlint-config` base; add new rules there so every package benefits.
