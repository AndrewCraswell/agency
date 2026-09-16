# Agency monorepo

A Turborepo and pnpm monorepo for the agency's applications and shared packages.

## What's inside?

This Turborepo includes the following packages and apps:

### Apps and Packages

- `blog-writer`: Shopify blog-writing application
- `legislation`: legislation research application
- `scoring`: fencing scoring application and supporting tools
- `@repo/oxlint-config`: shared [oxlint](https://oxc.rs) configuration
- `@repo/storybook-config`: shared [Storybook](https://storybook.js.org) configuration
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package and app is 100% [TypeScript](https://www.typescriptlang.org/).

### Install dependencies

Some workspaces use `@1js` packages from the Office Azure Artifacts feed. Install dependencies normally:

```sh
pnpm install
```

If installation fails because the feed credentials have expired, refresh them and retry:

```sh
pnpm auth
pnpm install
```

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [oxlint](https://oxc.rs) for code linting
- [oxfmt](https://oxc.rs) for code formatting
- [Vitest](https://vitest.dev) for testing
- [Lefthook](https://lefthook.dev) for Git hooks
