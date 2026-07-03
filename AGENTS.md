# AGENTS.md

Agent guidance for this repository lives in [.github/copilot-instructions.md](.github/copilot-instructions.md). Read it
before making changes.

Quick reference:

- **Lint:** `oxlint` (not eslint) · **Format:** `oxfmt` (not prettier)
- **Type-check:** TypeScript 7 RC native compiler via `pnpm check:types`
- **Test:** Vitest via `pnpm test` · **Build:** Vite via `pnpm build`
- **Package manager:** pnpm `>=11` on Node `>=24` · **Tasks:** Turborepo
- **Git hooks:** lefthook (pre-commit: `oxlint --fix` + `oxfmt`; pre-push: `check:types`). Don't use `--no-verify`.
- **Reuse first:** prefer `@mantine/hooks`, `ts-extras`, `ts-pattern`, and `tiny-invariant` over hand-rolled hooks /
  type helpers; narrow with type guards, not `as`.

Verify loop (must be clean before finishing): run **`pnpm verify`** (format, lint, types, knip, tests with coverage).
