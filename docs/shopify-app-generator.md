# Shopify app generator

Create an Agency-standard embedded Shopify app under `apps/`:

```sh
pnpm gen:shopify-app
```

The generator prompts for a kebab-case package name and a display name. For non-interactive use, pass both values to
Turbo:

```sh
pnpm turbo gen shopify-app --args inventory-tools "Inventory Tools"
```

The generated app includes React Router, React 19 with the React Compiler, Shopify authentication and webhooks,
Storybook, Vitest, and the monorepo quality scripts. It uses in-memory session storage and requests no Admin API scopes
by default. Choose persistent session storage and add only the scopes required by the app before deployment.

The generator refuses to overwrite an existing directory. After generation, install workspace dependencies and link the
app to a Shopify Partner configuration:

```sh
pnpm install
pnpm --filter inventory-tools config:link
pnpm --filter inventory-tools dev
```
