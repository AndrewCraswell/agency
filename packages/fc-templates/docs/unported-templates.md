# Unported templates

The ten stock notifications we have not built, described in enough detail to design and build them without opening the
Liquid. Companion to [stock-template-gaps.md](stock-template-gaps.md).

Every heading, sentence and row label quoted here is the literal copy in the stock template. Where stock branches, the
branch condition is given, because the branch is usually the design decision.

Between them these ten hold 476 of the 629 conditionals in the stock catalogue. They are not ten more emails of the
kind we already have, and most of the work is shared.

## The shared shell

Six of the ten are one design: `return-requested`, `return-label-notification`, `return-declined`,
`requested-edit-declined`, `change-requested`, and with additions `return-created` and `return-approved`.

They render, top to bottom:

1. **`{{ email_title }}`** in the document title. Shopify supplies it; nothing in the template assigns it.
2. **`Order {{ order.name }}`** as an eyebrow, with **`PO number #{{ po_number }}`** beneath it when `po_number` is
   present.
3. A **headline** and an optional **lead** paragraph, both varying per template.
4. An optional **note** block: the merchant's reason, in the two decline templates.
5. An optional **instruction list**.
6. **Buttons**, rendered from four captured values: `url_primary` with `text_primary`, then the literal word "or",
   then `url_secondary` with `text_secondary`. Each is wrapped in a `!= blank` test, so a template supplies one, two
   or neither.
7. One or more **item sections**, each with its own label.
8. An optional **totals block**.
9. A footer line, identical in all six: **"If you have any questions, reply to this email or contact us at
   {{ shop.email }}"**.

As a component that is a title, an optional lead, an optional note, an optional ordered list, up to two calls to
action, and children. The four simplest templates vary only items 3 to 7.

The button strings are captured inside each template rather than supplied by Shopify, so a React port owns them and can
name them properly.

## The shared item row

All six use a line shape our `ItemRow` does not know. Building this once unblocks every template on this page.

| Stock                              | Meaning                                       | Our `ItemRow` today  |
| ---------------------------------- | --------------------------------------------- | -------------------- |
| `line_item.title_without_variant`  | title with the variant stripped out           | `line.title`         |
| `line_item.variant.title`          | shown unless it is `Default Title`            | `line.variant_title` |
| `line_display`                     | assigned from `line_item.quantity` in all six | `line.quantity`      |
| `line_item.groups`                 | the groups this line belongs to               | not supported        |
| `line_item.unit_price_measurement` | per-unit pricing                              | not supported        |

**Groups** print one line per group, and the wording turns on `group.deliverable?`:

- deliverable: `For: {{ group.display_title }}`
- otherwise: `Part of: {{ group.display_title }}`

This is how a bundle, a subscription or a gift with purchase names its parent on the child line.

**Discounts** are formatted differently from ours. Stock upcases the title and parenthesises the amount, and prints
only allocations where the amount is above zero:

```liquid
{{ discount_allocation.discount_application.title | upcase }} (-{{ discount_allocation.amount | money }})
```

**Free lines** read `{% if line_item.final_line_price > 0 %}{{ … | money }}{% else %}Free{% endif %}`. Our `ItemRow`
always prints money, so a free line shows a zero amount instead of the word.

**Per-unit pricing** appends
`{{ line_item.unit_price | unit_price_with_measurement: line_item.unit_price_measurement }}`, which prints something
like "£4.20 / 100 g". That filter is already in our catalogue, so this needs markup only.

`return-created` prints the return line's price negated, `-{{ line_item.final_line_price | money }}`, while
`return-approved` prints the same line positive. Pick one and be consistent.

## The shared returns totals

`return-created` and `return-approved` share a totals block our `Totals` cannot express.

| Row                     | Source                                                             | Condition                 |
| ----------------------- | ------------------------------------------------------------------ | ------------------------- |
| Subtotal                | `return.line_items_subtotal_price`                                  | always                    |
| one row per fee         | `fee.title` and `fee.subtotal \| money`                             | loop over `return.fees`   |
| Estimated taxes         | `return.total_tax_price`                                            | when present              |
| Outstanding balance     | `return.pre_return_order_total_outstanding \| money_with_currency`  | when present and not zero |
| Estimated amount to pay | `return.order_total_outstanding \| money_with_currency`             | when above zero           |
| Estimated refund        | `return.order_total_outstanding \| abs \| money_with_currency`      | otherwise                 |

The fees loop is how a restocking charge or a return shipping charge reaches the customer. It is the row most likely to
cause a support ticket if it is missing.

## The templates

### `return-requested` — 9 conditionals

The customer has asked to return items and is waiting.

- Headline: **"Your return request was sent"**
- Lead: **"Your return request was sent and is being reviewed. We'll email you once it's been completed."**
- Buttons: **"View your order"** to `order.order_status_url`, then **"Visit our store"** to `shop.url`
- One section, **"Return summary"**, over `return.line_items`
- No totals

The smallest of the six and the natural first port, because building it produces the shell and the item row the rest
reuse.

### `return-label-notification` — 2 conditionals

A shipping label is ready. No item list and no totals at all.

- Headline: **"Your return label is ready"**
- Buttons: **"Print return label"** to `return_label.public_file_url`, then **"Visit our store"** guarded by
  `{% if shop.url %}`
- Section **"Instructions"**, three steps:
  1. "Pack the items you're returning."
  2. "Print your return label and attach it to the package. Cover any existing shipping labels."
  3. "Give the package to the carrier identified on the label."

Nearly free once the shell exists, and it is the email a customer most needs to act on.

### `return-declined` — 10 conditionals

- Headline: **"Your return request was declined"**
- Note: `return.decline["note"]`, rendered only when not blank. Bracket access, because `decline` is a hash.
- Button: **"View your order"** only
- One section, **"Return summary"**, over `return.line_items`

### `requested-edit-declined` — 8 conditionals

Structurally identical, with different nouns.

- Headline: **"Your cancellation request was declined"**
- Note: `requested_edit.decline_note`
- Button: **"View your order"**
- One section, **"Cancellation request summary"**, over `requested_edit.affected_line_items`

This one has no groups and no per-unit pricing, so it renders the simpler item row.

### `change-requested` — 19 conditionals

Sent when a customer asks for a change. The headline is a three-way branch on which requests exist.

| Condition                   | Headline                             | Lead                                                                                                          |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `requested_edit and return` | "Your request was sent"              | "Your request was sent and is being reviewed. You'll get a separate email for each request as it's completed." |
| `requested_edit` alone      | "Your cancellation request was sent" | "Your cancellation request was sent and is being reviewed. We'll email you once it's been completed."          |
| otherwise                   | "Your return request was sent"       | "Your return request was sent and is being reviewed. We'll email you once it's been completed."                |

Buttons are **"View your order"** and **"Visit our store"**. It then renders up to two sections, either or both:
**"Cancellation request summary"** over `requested_edit.line_items`, and **"Return request summary"** over
`return.line_items`.

### `return-created` — 38 conditionals

The return is open and the customer must send items back. The whole top half switches on `return_delivery.type`, looped
over `return.deliveries`.

**When the type is `shopify_label`:**

- Headline: "Your return shipping label is ready"
- Lead: "Print your return shipping label and attach it to the package containing your return items"
- "Instructions": "Pack the items you're returning." then "Pay the outstanding balance." only when
  `return.checkout_payment_collection_url` is set, then "Print your return shipping label and attach it to the
  package. Cover or remove any old shipping labels.", then "Give the package to
  {{ return_delivery.carrier_name }}." falling back to "Give the package to the carrier identified on the label."
- Buttons: "Print return label" to `return_delivery.return_label.public_file_url`, then "Pay now" to
  `return.checkout_payment_collection_url`

**When the type is `manual`:**

- Headline: "Complete your return"
- Lead: "We've sent you a return shipping label, or you will receive one soon. Once you receive your return shipping
  label, get your returned items and follow the instructions to complete your return."
- Instructions: "Print your return shipping label. If you haven't received it yet, we'll send it to you soon." then
  "Attach the label to the package. Cover or remove any old shipping labels." then "Track your return using your
  tracking number to make sure we get it.", where "your tracking number" is a link to `return_delivery.tracking_url`
  when it is not blank
- Button: "Pay now" only

Below that, up to two item sections, **"Items to return"** over `return.line_items` and **"Items you'll receive"** over
`return.exchange_line_items`, each guarded on `size > 0`, then the returns totals block.

### `return-approved` — 41 conditionals

The return is accepted. Same sections and totals as `return-created`, with a lead that branches four ways.

| Condition                                                | Lead                                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a label is attached                                      | "Print your return shipping label and attach it to the package containing your return items."                                                                                   |
| no label, type is `shopify_label`, and a balance is due   | "Your return was approved and a balance is due. Pay the outstanding balance, and once you receive your return shipping label, follow the instructions to complete your return." |
| no label, otherwise                                      | "We sent you a return shipping label, or you will receive one soon. Once you receive your return shipping label, follow the instructions to complete your return."               |
| no delivery at all                                       | "We will send you additional information to complete the return."                                                                                                               |

Headline is **"Your return was approved"**. The instruction list appears only when a label or a tracking number exists,
and gains a final step, "Track your return to make sure we get it.", printing
`{{ return_delivery_first.carrier_name }} tracking number:` or the plain "Tracking number:".

`has_label_attached` is computed as `public_file_url != blank and public_file_url.size > 0`, which is worth copying:
Shopify emits an empty string rather than nil when no label exists, so a presence check alone is not enough.

### `refund-notification` — 83 conditionals

Money going back. Independent of the returns shell, built on the full order layout.

- Lead: **"Total amount refunded: {{ amount | money_with_currency }}. It may take up to 10 days for this refund to
  appear in your account."**
- Section **"Order summary"** over the order's lines, with a **"Refunded"** badge on affected lines
- The full order totals block described below
- A **"Refund"** row, and refund destinations: `transaction.gateway == 'shopify_store_credit'` for store credit, and
  gift card lines identified by `line.properties["__shopify_send_gift_card_to_recipient"]`

This is the template a customer reads most carefully, because it is the one with their money in it.

### `order-cancelled` — 132 conditionals

The order is off. Its most interesting feature is a headline matrix: five cancellation reasons crossed with three
payment outcomes, thirteen sentences in all. Each opens "Order {{ name }}".

| `cancel_reason` | Phrase                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| customer        | "was canceled at your request"                                            |
| inventory       | "was canceled because we did not have enough stock to fulfill your order" |
| other           | "was canceled because of unforeseen circumstances"                        |
| staff           | "was canceled because of staff error"                                     |
| declined        | "was canceled because your payment was declined"                          |

The first four each pair with one of "and your payment has been voided", "and your payment has been refunded" and "and
your payment has not yet been refunded". The declined case stands alone with no payment clause.

It also carries a **"Removed Items"** section, the full order totals block, and both `shipping_method` and
`pickup_methods`, since a cancelled order may have been going either way.

### `order-edited` — 134 conditionals

The busiest template in the catalogue, and more branching on its own than all 36 ported templates combined.

- Buttons: "View your order" and "Visit our store"
- Section **"Updated order"**
- The full order totals block
- A **"Customer information"** block with **"Shipping address"**, **"Billing address"**, **"Location"**,
  **"Payment"**, which prints "ending with {{ transaction.payment_details.credit_card_last_four_digits }}", and
  **"Shipping method"**
- `company_location` for business accounts
- A wallet notice: "You paid with {{ apc_wallet_name }} in CNY. Check your {{ apc_wallet_app_name }} app for the final
  amount."

## The full order totals block

`order-cancelled`, `order-edited` and `refund-notification` share one totals design. Our `Totals` covers the first
rows and none of the rest.

| Row                         | Notes                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| Subtotal                    | covered                                                          |
| Order discount              | singular, with `-{{ total_order_discount_amount \| money }}`     |
| Order discounts             | plural heading, then one line per `discount_applications` entry  |
| Shipping                    | covered                                                          |
| Pickup                      | the pickup counterpart of the shipping row                       |
| Duties                      | `total_duties`                                                   |
| Taxes                       | covered                                                          |
| Tip                         | `total_tip`                                                      |
| Total                       | covered                                                          |
| You saved                   | the sum of savings, called out on its own                        |
| Cash rounding               | for cash payments in currencies without small coins              |
| Total paid today            | payment terms                                                    |
| Total due on receipt        | payment terms                                                    |
| Total due on fulfillment    | payment terms                                                    |
| Total due {{ due_at_date }} | payment terms with a fixed date                                  |
| Paid                        | what has been settled so far                                     |
| Refund                      | a negative amount                                                |

The four "Total due" variants are `payment_terms` rendered as copy, and they are why a business order needs this block
rather than ours.

## Components to build

The work factors cleanly:

- **`ReturnNotice`** — the shared shell: title, optional lead, optional note, optional instruction list, up to two
  calls to action, children.
- **`InstructionList`** — an ordered list whose steps are individually conditional.
- **`ReturnTotals`** — subtotal, fee rows, estimated taxes, outstanding balance, and the pay-or-refund row.
- **`ItemRow` extensions** — `title_without_variant`, group labels, the upcased parenthesised discount format, the
  "Free" case, per-unit pricing, and a "Refunded" badge.
- **`Totals` extensions** — the seventeen rows above.
- **`CustomerInformation`** — the address, location, payment and shipping method block `order-edited` needs.

## Stock bugs not to copy

- `{% if line.quantity < line.quantity %}` at `order-cancelled.liquid` line 232, `order-edited.liquid` lines 187, 296
  and 401, and `refund-notification.liquid` lines 152 and 323. A value is never less than itself, so the block never
  renders. Inside it is `{{ line.quantity }} of {{ line.quantity }}`, so the intent was plainly to show "2 of 5" on a
  partly affected line, comparing the affected quantity against the ordered quantity. Write the comparison that was
  meant, and say why it differs.
- `{{ return_delivery_first.tracking_number) }}` in `return-approved.liquid` carries a stray closing parenthesis.

## Suggested order

1. `return-requested` — builds the shell and the item row.
2. `return-label-notification` — highest value for the least work once the shell exists.
3. `return-declined` and `requested-edit-declined` — the shell plus a note.
4. `change-requested` — the shell plus a branching headline.
5. `return-created`, then `return-approved` — the delivery variants and the returns totals land here.
6. `refund-notification`.
7. `order-cancelled`, then `order-edited` — last, and only after `Totals` knows the full order block.
