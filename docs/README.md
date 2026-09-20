# Documentation

Focused reference pages for this monorepo. Keep pages **small and single-purpose**, and **update them in the same PR**
as the change they describe.

## Index

Legislation workspace documentation: [web](../apps/legislation-web/docs/README.md),
[ingestion](../apps/legislation-ingestion/docs/README.md), [MCP](../apps/legislation-mcp/docs/README.md),
and [core](../packages/legislation-core/docs/README.md). See
[runtime setup](../apps/legislation-web/docs/operations/development.md) for local credentials after the move and
[verification](../apps/legislation-web/docs/operations/testing.md#full-verification) for `pnpm verify:legislation`.
The [prototype telemetry specification](../apps/legislation-web/docs/engineering/telemetry-spec.md) focuses on
debugging failures and slowness with safe Sentry/Langfuse diagnostics, not product analytics or replay.
The [legislation diffing package](../packages/legislation-diffing/README.md) owns deterministic full-text comparison;
its app consumers and Storybook prototypes do not perform legal interpretation or amendment application.

| Page                             | What it covers                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech-stack.md](tech-stack.md)   | The preferred tools we reach for first (by category). Deviating requires a discussion with a human.                                                         |
| [conventions.md](conventions.md) | General conventions — quality gates, tests, imports, file/component layout; links out to the pages below.                                                   |
| [react.md](react.md)             | React component conventions, product-level UI-system selection and styling, and the state/error/URL/routing/form libraries.                                 |
| [typescript.md](typescript.md)   | TypeScript/type conventions **and** the type-helper libraries (`ts-extras`, `ts-pattern`, `tiny-invariant`, `zod`) — read before writing a new type helper. |
| [hooks.md](hooks.md)             | React hook conventions **and** the full `@mantine/hooks` catalog — read before writing a new hook.                                                          |
| [shopify-app-generator.md](../packages/fc-theme-base/docs/shopify-app-generator.md) | Creating a neutral embedded Shopify app with the local Turbo generator.                                                               |
| [shopify-policy-pages.md](../packages/fc-theme-base/docs/shopify-policy-pages.md) | Policy page templates, store-managed content, responsive reading, and footer menu wiring. |
| [shopify-content-installation.md](../packages/fc-theme-base/docs/shopify-content-installation.md) | Fencing Club migration content, portable manifests, menu wiring, and safe reruns. |
| [shopify-catalog-rehearsal.md](../packages/fc-theme-base/docs/shopify-catalog-rehearsal.md) | Read-only source snapshots, Contoso imports, native bundles, chart assignments, and controlled stock. |
| [shopify-collection-filters.md](../packages/fc-theme-base/docs/shopify-collection-filters.md) | Shopify filter sources, curated classifications, protection attributes, and migration boundaries. |
| [shopify-size-charts.md](../packages/fc-theme-base/docs/shopify-size-charts.md) | Shared chart pages and drawers, editable category headings/order, dynamic membership, and sizing verification. |
| [shopify-drawers.md](../packages/fc-theme-base/docs/shopify-drawers.md) | Reusable drawer shell, motion, focus and scroll lifecycle, and consumer integration. |
| [shopify-cart.md](../packages/fc-theme-base/docs/shopify-cart.md) | Cart panel/page layout, native bundles, notes, discounts, request coordination, and acceptance. |
| [shopify-interaction-states.md](../packages/fc-theme-base/docs/shopify-interaction-states.md) | Interactive component inventory, state/motion contract, and local component lab. |
| [Printable measuring tape](../packages/fc-theme-base/printables/README.md) | Branded A4 and Letter PDFs, print calibration, font assets, and regeneration checks. |