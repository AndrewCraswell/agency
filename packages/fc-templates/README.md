# @repo/fc-templates

Source, preview, and build tooling for Fencing Club's Shopify templates: Order Printer printouts, marketing emails, and
all 46 customer notifications.

## Layout

Templates exist in two forms while the React migration runs.

| Path               | Contents                                                                       |
| ------------------ | ------------------------------------------------------------------------------ |
| `src/emails/`      | React definitions, in `notifications/` and `components/`. The target form.     |
| `src/templates/`   | Shopify's verbatim Liquid, kept as the source for everything not yet migrated. |
| `src/images/`      | Brand artwork used by more than one template.                                  |
| `src/templates.ts` | The roster of React definitions every whole-library check runs over.           |

`src/liquid.ts` builds the Liquid engine the previews and tests render through, and `src/reactEmail.ts` is the harness
the tests use to drive a definition down both the compiled and the resolved path.

Each React notification is one file, `src/emails/notifications/<name>.tsx`, holding its definition and the default
export the dev server renders. Its `type` names the Shopify notification, which is what decides the variables it can
read and the sample it previews against. Add it to `src/templates.ts` and it joins every whole-library check.

`pnpm build` compiles the React definitions in `src/emails/` into paste-ready Liquid under `dist/`, using the
`shopify-emails` command from `@repo/shopify-emails`.

## Preview

```powershell
pnpm --filter @repo/fc-templates dev
```

Every notification appears in the sidebar, already resolved against the sample for its type, with each drop highlighted.
The props panel edits the variables live. The viewer supplies the viewport presets, the linter, and the compatibility
and spam reports.

The Liquid under `src/templates/` has no preview of its own. It is reference material: read it while porting a template
into `src/emails/`, then delete it.

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

`src/valueMode.test.ts` asserts that the compiled Liquid and the resolved preview produce the same markup for every
template, and `src/compiledOutput.test.ts` snapshots the Liquid and subject each one compiles to. Fifty templates hang
off a handful of shared components, so a one-line change to a component rewrites most of the library at once; the
snapshots turn that into a diff somebody reads. A failure there is not a defect on its own — read the diff, and if the
change is the one you meant, run `pnpm --filter @repo/fc-templates test -- -u`.

`src/liquid.test.ts` covers the Shopify filter stand-ins, and `src/escaping.test.ts`, `src/assign.test.ts`, and
`src/forloop.test.ts` pin the Liquid the compiler emits for the constructs that are easiest to get wrong.

## Printout behavior

`src/templates/printouts/invoice/` is the invoice for the
[Shopify Order Printer app](https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/liquid-variables-and-filters-reference)
and `src/templates/printouts/packing-slip/` is the packing slip. Neither has been ported to React yet.

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

## Customer notifications

See [docs/customer-notifications.md](docs/customer-notifications.md) for how the Shopify source was captured, which
messages Shopify keeps to itself, and the two templates that need a preview-only parser shim.

## Known gaps

[docs/template-backlog.md](docs/template-backlog.md) records the work between a design that previews correctly and a
library that survives a real inbox: message weight against Gmail's clip limit, the base64 icons, the Outlook rendering
gaps, and the test config that leaves every `.tsx` file unmeasured.
