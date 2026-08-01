# Stock template gaps

Comparison of Shopify's 52 stock templates under `src/templates/emails/` against the 53 React templates under
`src/emails/`, made on 2026-07-31. Every claim here was checked against the files rather than inferred from the
designs.

Read that set as the store's current templates, not as Shopify's defaults. Some were already customised before they
were captured: the header logo, for one, had its `{% if shop.email_logo_url %}` branch replaced with a hardcoded CDN
URL. Absence of a drop here is evidence that this store stopped using it, not that Shopify never offered it.

The stock set is 46 notifications and 6 marketing emails. We have ported 36 of the notifications one for one. Our 17
marketing templates include the 6 stock designs and 11 originals with no counterpart, so marketing is out of scope
below: there is nothing to be missing from.

Two companion pages carry the detail. [ported-template-gaps.md](ported-template-gaps.md) gives a verdict on each of the
36 ports, listing the stock conditionals behind it so the verdict can be rechecked.
[unported-templates.md](unported-templates.md) describes the 10 notifications we have not built, with the copy, the
branch conditions and the components they need.

## The finding

Almost every branch we do not handle sits in a template we have not ported.

The 46 stock notifications contain 629 conditional constructs between them. **Four hundred and seventy-six of those,
just over three quarters, are in the ten templates we have not built.** The same holds for loops: 74 of 109.

The stock set has two tiers. Thirty-six templates describe a single event with a handful of optional fields, and those
are the ones we ported; not one of them exceeds 16 conditionals. The other ten describe an order changing after the
fact, and they carry the whole of Shopify's commerce model: bundles, subscriptions, custom line properties, per-unit
pricing, duties, tips, deferred payment terms, purchase order numbers, order-level discount applications, refunded
quantities, and delivery split across shipping and pickup. `order-edited` alone has 134 conditionals, more than the
entire ported set combined.

Grepping all 46 stock notifications for each construct shows how cleanly the line falls:

| Construct                 | Stock templates that use it                                                   | Ported  |
| ------------------------- | ---------------------------------------------------------------------------- | ------- |
| `line.bundle_parent?`     | order-cancelled, refund-notification                                          | none    |
| `line.bundle_components`  | order-cancelled, refund-notification                                          | none    |
| `selling_plan_allocation` | order-cancelled, order-edited, refund-notification                            | none    |
| `line.properties`         | order-cancelled, order-edited, refund-notification                            | none    |
| `refunded_quantity`       | order-cancelled, refund-notification                                          | none    |
| `discount_applications`   | order-cancelled, order-edited, refund-notification                            | none    |
| `total_duties`            | order-cancelled, order-edited, refund-notification                            | none    |
| `total_tip`               | order-cancelled, order-edited, refund-notification                            | none    |
| `payment_terms`           | order-cancelled, order-edited, refund-notification                            | none    |
| `pickup_methods`          | order-cancelled, order-edited                                                 | none    |
| `unit_price_measurement`  | the 3 above, change-requested, and the 4 return templates                     | none    |
| `line_item.groups`        | order-cancelled, refund-notification, change-requested, the 4 returns         | none    |
| `po_number`               | the 8 above, pending-payment-failure, requested-edit-declined, return-label   | 1 of 11 |
| `company_location`        | order-edited, store-credit-issued                                             | 1 of 2  |

Every row is confined to the unported ten, except `po_number`, which pending-payment-failure also uses and our port
already reads, and `company_location`, which store-credit-issued uses and our port does not.

So the honest summary is not that our ports are thin. It is that we ported the easy half of the catalogue, and the
half we skipped is where the commerce model lives.

## What the ports themselves miss

Seven verified gaps across 36 templates, found by listing every conditional in each stock template and checking it
against its port. Five are quick.

Six of the seven are now closed in the React ports; `shipmentDelivered` is the deliberate exception. The designs still
carry the old states, which [design-changes.md](design-changes.md) records.

### `paymentReminder` collapses three messages into one

Stock branches on the payment schedule at line 107 of `payment-reminder.liquid` and writes one of three sentences: the
payment is due today, it is due on a stated future date, or it was due on a stated past date. It also formats the amount
with `money_with_currency` rather than `money`, because a B2B buyer may hold balances in more than one currency.

Our port writes a single sentence, "A friendly reminder that payment for order X is still due", and uses `money`. A
customer three weeks overdue reads the same words as one whose payment falls due tomorrow. `payment_schedule.overdue?`,
`payment_schedule.due_later?` and `payment_schedule.number_of_days_overdue` are never read.

This is the largest behavioural gap in the ported set and the only one that changes what a customer should do.

### `contactBuyer` breaks when the merchant writes nothing

Stock at line 243 of `contact-buyer.liquid` reads:

```liquid
{% if custom_message != blank %}{{ custom_message }}
{% else %}Hi {{ customer.first_name | default: 'there' }}, thanks for being part of the club…{% endif %}
```

Our port renders `Hi {first_name}, {custom_message}` unconditionally. Send it without a message and the customer
receives a greeting followed by nothing. Send it to a customer with no first name and it opens "Hi ,". Both are
one-line fixes and both are visible to the recipient.

### `storeCreditIssued` tells a company it is a person

Stock at line 129 of `store-credit-issued.liquid` branches on `company_location` and names the company and the
location: "This has been automatically added to Acme — Boston's account." Our port always says the credit went to
"your account".

A B2B buyer holding credit at several locations cannot tell which balance moved. This matters more than its size
suggests, because store credit is the one balance a buyer reconciles by hand.

### `customerAccountWelcome` can render a button to nowhere

Stock wraps the call to action in `{% if shop.url %}` at line 249. Ours renders `<EmailButton href={shop.url}>`
unconditionally, so an unconfigured store sends a button with an empty target.

### `shipmentDelivered` drops the delivery estimate

Five stock templates read `fulfillment.estimated_delivery_at`. We cover four and drop it from the delivered email,
where stock keeps it at line 305.

The port says why, in a comment: "No estimated delivery date here: it has arrived, so the date the carrier promised is
spent." That is probably the better email. It is listed because it is a deliberate divergence, and it should stay a
decision rather than becoming a surprise.

### Free lines print a zero amount instead of “Free”

`buy-online.liquid` and `pos-send-cart.liquid` both render
`{% if line.final_line_price > 0 %}{{ line.final_line_price | money }}{% else %}Free{% endif %}`. Our `ItemRow` always
prints money, so a free gift, a fully discounted line or a zero-priced sample shows a zero amount.

The same pattern appears in six of the ten unported templates, so fixing it in `ItemRow` pays twice.

### `presentment_title` is never read

The five shipping and local delivery templates render each line as
`{% if li.presentment_title %}{{ li.presentment_title }}{% elsif li.title %}{{ li.title }}{% endif %}`.
`presentment_title` appears nowhere in our source; `ItemRow` prints `line.title`.

It is the title as presented to the buyer, which differs from the base title when a store sells into more than one
market or language. A single-market store never sees the difference, which is why it went unnoticed.

## Checked and clear

Recorded so these are not reopened. Each was suspected during the audit and disproved against the source.

- **Line item discounts, variant titles and struck-through prices.** `ItemRow` already loops `discount_allocations`,
  already suppresses the variant line when it equals `Default Title`, and already shows the original price struck when
  it differs from the final price. Nothing is lost.
- **Totals on `ready-for-pickup`.** The stock template has no money rows at all. Our port matching it is correct.
- **Preheader text.** All 36 ports pass `preview` to `EmailDocument`, which renders react-email's `<Preview>`. Twelve
  stock templates carry one; we carry 53.
- **Unsubscribe links.** `MarketingFooter` takes `unsubscribeUrl` and every marketing template plus
  `customerMarketingConfirmation`, `buyOnline` and `posSendCart` passes one.
- **Translation keys.** No stock template uses the `t` filter. Both sets are English only, so there is no localisation
  gap to close, only a localisation feature neither side has.
- **`fulfillable_quantity`.** Appears in no stock template. It is a real Shopify drop but not one this catalogue uses.

One divergence to settle rather than fix: `localMissedDelivery` links to the contact page and offers to reschedule,
where stock links to the order. The copy is better and the link is worse. Carry both.

## Where stock is wrong and we are not

Found while checking the above, and worth recording so nobody “corrects” our version back.

- `customer-marketing-confirmation.liquid` guards the subscribe button with `{% if shop.url %}`, though the button's
  href is `{{ customer.subscribe_url }}`. A store with no URL would lose the button that confirms the subscription.
  Our port renders it unguarded with the right href.
- `gift-card-notification.liquid` resolves `recipient_name` through a nickname, name and email chain, then never
  renders it. Our port omits it.
- `buy-online.liquid` line 264 renders only `line.discount_allocations.first`, so a line carrying two promotions shows
  one. `ItemRow` loops the whole collection. Stock also joins the discount title to its amount with a middle dot,
  which our components do not.
- `{% if line.quantity < line.quantity %}` is always false, and appears six times across `order-cancelled`,
  `order-edited` and `refund-notification`. See [unported-templates.md](unported-templates.md) for what it was meant
  to say.

## Recommendations

Ordered by what a customer gains.

### 1. Port the returns family, which is cheaper than it looks

Six of the ten unported templates are one design. `return-requested`, `return-created`, `return-approved`,
`return-declined`, `requested-edit-declined` and `change-requested` share a shell: an order eyebrow with an optional PO
number, a headline, an optional lead, an optional note, an optional instruction list, up to two calls to action drawn
from `text_primary` / `url_primary` / `text_secondary` / `url_secondary`, one or more labelled item sections, and an
identical footer line. Each template captures its own button strings, so a React layout with a title and up to two
call-to-action props covers all six.

Between them they cover the whole of the customer's side of a return. A store that sends a carefully designed order
confirmation and then falls back to Shopify's default for the return is at its least convincing exactly when the
customer is least happy. `return-requested` builds the layout and `return-label-notification` is close to free once it
exists, so the first two ports deliver most of the value.

[unported-templates.md](unported-templates.md) carries the shell anatomy, the literal copy and the branch conditions
for all ten, in enough detail to design from without reopening the Liquid.

### 2. Fix the seven ported gaps

Five are minutes of work. `paymentReminder` needs a three-way branch and a data type that carries `overdue?`,
`due_later?` and `number_of_days_overdue`; the “Free” case and `presentment_title` are both single changes in
`ItemRow` that the unported templates need anyway.

### 3. Teach `ItemRow` the four line shapes it does not know

Bundles, subscriptions, custom properties and per-unit pricing are each a small addition, and together they unblock
every remaining unported template. Doing this before porting `order-cancelled`, `order-edited` or
`refund-notification` avoids writing the same conditionals three times. See
[unported-templates.md](unported-templates.md) for the shapes.

### 4. Teach `Totals` the rows it does not know

Order-level discount titles, duties, tips, the pickup-versus-shipping split, and negative amounts for refunds. Same
argument as above: shared work that three templates need.

### 5. Decide the branding question

Every one of our components hard-codes Fencing Club: the logo URL, the wordmark, the accent colour in `tokens.ts`, and
the footer navigation. Shopify's stock templates hard-code the same things, so this is not a gap against them. It is a
gap against the package ever serving a second store, and it is much cheaper to answer now than after the returns family
lands.

### 6. Show the delivery estimate where it helps

Five stock templates read `fulfillment.estimated_delivery_at` and we cover four. The interesting question is not parity
but whether an estimate belongs anywhere it is currently absent: an order confirmation that says when the parcel should
arrive is more useful than one that does not, and Shopify's design simply never asked.

## Method

Stock templates were read in full. Every `{% if %}`, `{% elsif %}` and `{% unless %}` in the 36 ported templates was
extracted and checked one at a time against its port, which is how the last two findings surfaced. Ports were also
checked against the compiled Liquid in `src/__snapshots__/`, which is the output that actually reaches Shopify.

The stock templates in this repository are the customised Fencing Club versions pulled from the admin, not Shopify's
factory defaults, so a construct absent here may still exist upstream.
