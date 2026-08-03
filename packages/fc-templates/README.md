# @repo/fc-templates

Source, preview, and build tooling for Fencing Club's Shopify templates: Order Printer printouts, marketing emails, and
all 46 customer notifications.

## Layout

Every template is React. Nothing here is a hand-maintained Liquid file any more, apart from the two printouts, which
Order Printer renders rather than the notification system.

| Path                    | Contents                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| `src/emails/`           | React definitions, in `notifications/`, `marketing/` and `components/`. |
| `src/emails/printouts/` | The two Order Printer documents and the fixtures they preview against.  |
| `src/images/`           | Brand artwork used by more than one template.                           |
| `src/templates.ts`      | The roster of React definitions every whole-library check runs over.    |

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

Run `pnpm cli` first and pull an order, and the preview answers from that store instead: the pulled values are laid over
the samples, so the shop, customer and order are real and anything the order does not carry keeps its fixture. A newer
pull needs the preview restarted.

The two printouts under `src/emails/printouts/` preview here too, under **printouts** in the sidebar: the invoice paid,
unpaid and run over two sheets, and the packing slip on one sheet and over several. Those entries render the `.liquid`
file itself against the fixtures beside it, so what you read is what you paste. They are not emails, so the send button
and the client-width presets mean nothing for them; use the browser's own print preview to judge the page. They are also
the one preview without the drop highlighting, because Order Printer renders synchronously.

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

`src/emails/printouts/invoice/` is the invoice for the
[Shopify Order Printer app](https://help.shopify.com/en/manual/fulfillment/managing-orders/printing-orders/shopify-order-printer/liquid-variables-and-filters-reference)
and `src/emails/printouts/packingSlip/` is the packing slip. Both stay hand-written Liquid, because Order Printer
renders them rather than the notification system; the `.tsx` beside each one is only the preview.

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

The catalogue is 46 Shopify notifications, of which 36 are ported to React under `src/emails/notifications/`.

[docs/stock-template-gaps.md](docs/stock-template-gaps.md) compares every stock template against its port. The short
version: three quarters of the branching in the stock catalogue sits in the ten templates we have not built, and the 36
we have are close to complete against their counterparts. [docs/ported-template-gaps.md](docs/ported-template-gaps.md)
gives a verdict on each port, and [docs/unported-templates.md](docs/unported-templates.md) describes the ten that are
missing.

[docs/design-changes.md](docs/design-changes.md) records what the hand-authored designs owe the ports that have already
moved ahead of them, and what they still owe before the remaining ten can be built.

## Known gaps

[docs/template-backlog.md](docs/template-backlog.md) records the work between a design that previews correctly and a
library that survives a real inbox: message weight against Gmail's clip limit, the base64 icons, the Outlook rendering
gaps, and the test config that leaves every `.tsx` file unmeasured.
