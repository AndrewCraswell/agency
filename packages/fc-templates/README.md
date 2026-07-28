# @repo/fc-templates

Source, preview, and build tooling for Fencing Club's Shopify templates: Order Printer printouts, marketing emails, and
all 46 customer notifications.

## Layout

| Path                       | Contents                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- |
| `src/templates/`           | Templates grouped into `printouts/` and `emails/{marketing,notifications}/`. |
| `src/templates/variables/` | Shared sample contexts the per-template variables files build on.            |
| `src/images/`              | Brand artwork used by more than one template.                                |
| `src/styles/`              | The shared email stylesheet the preview serves.                              |
| `src/registry.ts`          | The typed list of every template, its group, and its variations.             |

`src/render.ts` renders a template against a variation, `src/liquid.ts` supplies the Shopify-only Liquid filters,
`src/server.ts` is the preview server, and `src/build.ts` writes the upload-ready Liquid. Node runs the TypeScript
directly, so there is no build step for the preview.

See [docs/authoring.md](docs/authoring.md) for how a template folder is put together and how to add one.

## Preview

```powershell
pnpm --filter @repo/fc-templates dev
```

Open `http://127.0.0.1:4180` for an index of all 53 templates, grouped into printouts, marketing emails, and customer
notifications. Select `/` to jump to the filter. Each template opens in a viewer that matches its kind: a printout is
framed as paper, and an email is framed as an inbox message with its rendered subject, From, and To. Templates with more
than one variation get tabs to switch between them. Reload to pick up edits.

Routes: `/`, `/render/<template-id>/<variation-id>`, `/raw/<template-id>/<variation-id>`, `/api/templates`, and
`/assets/notifications/styles.css`.

## Publishing to Shopify

```powershell
pnpm --filter @repo/fc-templates build
```

This writes `dist/<group>/<template-id>.liquid` and prints the admin links you need. Shopify's Asset API only reaches
theme files, so notification and Order Printer templates have no supported API. The last step is a paste into the admin:

- Customer notifications: **Settings** > **Notifications**
- Printouts: the **Order Printer** app
- Marketing emails: the Shopify Email app, as a custom-code section

## Tests

```powershell
pnpm --filter @repo/fc-templates test
```

The suite renders every template against every variation and fails on any Liquid error, checks that each email produces
a fully substituted subject, and asserts the content the invoice and packing slip are supposed to carry.
`src/liquid.test.ts` covers the Shopify filter stand-ins. Both run under `pnpm verify` at the repo root.

## Printout behavior

`src/templates/invoice/` is the invoice for the
[Shopify Order Printer app](https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/liquid-variables-and-filters-reference)
and `src/templates/packing-slip/` is the packing slip.

- One invoice template covers both states: an outstanding balance shows a `BALANCE DUE` tag, and a settled order shows
  `PAID IN FULL` with the amount paid in green.
- Line items show a unit price and a line amount, so the amount column visibly sums to the subtotal. A discounted item
  shows the original unit price struck through and names the discount underneath.
- The payments section lists only transactions that actually settled, meaning a `sale`, `capture`, or `refund` with a
  successful status. An unpaid order carries a card authorization, which is not a payment, so it renders no payments
  section at all.
- Tax is itemized one row per `order.tax_lines` entry, so state, county, and city tax each get a line with its rate.
- The packing slip carries no prices, and identifies each item by its variant options rather than by SKU.
- The page footer lives in a `<tfoot>`, which print engines repeat at the foot of every page. Order Printer exposes no
  page-number variable, so a `@page` margin box supplies `PAGE n OF m` on engines that support it.

The `multipage` variations exist to check the repeated header and footer across page breaks.

## Customer notifications

See [docs/customer-notifications.md](docs/customer-notifications.md) for how the Shopify source was captured, which
messages Shopify keeps to itself, and the two templates that need a preview-only parser shim.
