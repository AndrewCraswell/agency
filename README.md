# `Turborepo` Vite starter

This is a community-maintained example. If you experience a problem, please submit a pull request with a fix. GitHub
Issues will be closed.

## Using this example

Run the following command:

```sh
npx create-turbo@latest -e with-vite-react
```

## What's inside?

This Turborepo includes the following packages and apps:

### Apps and Packages

- `web`: React ([Vite](https://vitejs.dev)) app with the [React Compiler](https://react.dev/learn/react-compiler),
  [Fluent UI v9](https://react.fluentui.dev), [Vitest](https://vitest.dev), and [Storybook](https://storybook.js.org)
- `@repo/ui`: a stub component library shared by the `web` application
- `@repo/oxlint-config`: shared [oxlint](https://oxc.rs) configuration
- `@repo/storybook-config`: shared [Storybook](https://storybook.js.org) configuration
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package and app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [oxlint](https://oxc.rs) for code linting
- [oxfmt](https://oxc.rs) for code formatting
- [Vitest](https://vitest.dev) for testing
- [Lefthook](https://lefthook.dev) for Git hooks
