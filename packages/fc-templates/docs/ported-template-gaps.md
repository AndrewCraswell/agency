# Ported template gaps

A verdict on each of the 36 stock notifications we have ported. Companion to
[stock-template-gaps.md](stock-template-gaps.md).

Each entry lists the conditionals in the stock template and says where the port satisfies them, so every verdict can be
rechecked without rereading the Liquid. The count after each name is the number of conditional constructs in stock; the
busiest template here has 16, against 134 in `order-edited`.

Seven templates have a finding. The rest reproduce every branch their counterpart contains.

## Order lifecycle

### `orderConfirmation` — 8 conditionals

Stock branches on: variant title present and not blank, original price against final price, discounts above zero,
shipping above zero, tax above zero, `shipping_address.address2`, `billing_address.address2`, and a transaction with
`payment_details`.

The port covers all eight. `ItemRow` handles the first two, `Totals` the next three, `AddressBlock` the two address
lines, and a `Find` over `vars.transactions` matching `isPresent(transaction.payment_details)` renders the card brand
and last four digits.

This template has no bundles, no selling plans and no line properties, so it is a poor guide to what a line item can
actually contain. Those appear only when an order is cancelled, edited or refunded.

### `orderLink` — 1 conditional

Stock guards `order_status_url`. The port renders one `EmailButton` to it.

### `orderInvoice` — 5 conditionals

Variant title, price comparison, and the three totals guards. All covered.

### `draftOrderInvoice` — 5 conditionals

The same five, against a draft. All covered.

### `orderPaymentReceipt` — 8 conditionals

Stock branches on: `transaction.id == transaction_id`, line image, variant title, price comparison, shipping above
zero, `paid_transaction.payment_details.credit_card_company`, and `order_status_url` falling back to `shop.url`.

The port covers all of them, including the transaction selection, which it performs with a `Find` over
`vars.transactions` matching on `transaction_id` rather than assuming the first entry. A comment in the file explains
why.

## Shipping and delivery

All five templates in this family share one item list and one tracking block, so the two findings below apply across
the family rather than to a single file.

### `shippingConfirmation` — 16 conditionals

Stock branches on: `fulfillment.item_count == item_count` then `> 1` for the partial shipment wording,
`fulfillment_status == 'fulfilled'` twice, `fulfillment.estimated_delivery_at`, `order_status_url`,
`tracking_numbers.size > 0`, `tracking_company`, `tracking_numbers.size == 1` against a loop, `tracking_url`,
`li.presentment_title` falling back to `li.title`, `li.image`, variant title, and
`li.original_line_price > li.final_line_price`.

The port covers all but the title fallback. `FulfillmentCopy` takes `fulfillmentStatus`, `orderItems` and
`shipmentItems` and derives the partial wording from them; `Tracking` guards on `tracking_numbers.size > 0`,
`tracking_company` and `tracking_url`.

Stock prints tracking numbers by branching on whether there is one or many and joining the rest with a separator; the
port uses `join: ', '`, which produces the same string. Equivalent, not a gap.

### `shipmentOutForDelivery` — 16 conditionals

The same set. Same coverage.

### `shipmentDelivered` — 16 conditionals — **finding**

The same set, and the port drops one of them: `{% if fulfillment.estimated_delivery_at %}` at line 305 of the stock
file.

This is deliberate. The port carries a comment reading "No estimated delivery date here: it has arrived, so the date
the carrier promised is spent." That is probably the better email; it is recorded so it stays a decision rather than
becoming a surprise.

### `shippingUpdate` — 12 conditionals

The tracking and item branches, without the partial shipment wording. The port also drops that wording deliberately,
with a comment: "The headline does not branch on how much shipped: the news is the tracking, not the contents."

### `localOutForDelivery` — 7 conditionals

Estimated delivery, `order_status_url`, the title fallback, image, variant title and the price comparison. Covered
apart from the title fallback below.

### `localDelivered` — 1 conditional

Stock guards `order_status_url` and falls back to `shop.url`; the port does the same with
`liquidValue(vars.order_status_url, ["default: shop.url"])`.

One divergence: stock's help line reads "…question about your order? <a href="mailto:{{ shop.email }}">Let us
know</a>", while the port links to the contact page in `shopLinks`. The page is the better destination for a store
that has one.

### `localMissedDelivery` — 1 conditional — **divergence**

Stock guards `order_status_url` and renders a link to the order. The port renders "Contact us to reschedule" pointing
at `shopLinks.contact` and never references `order_status_url`.

Rescheduling is the right next action, so the copy is an improvement, but the customer loses the link to the order.
Worth carrying both.

### Family finding: `presentment_title` is never read

Stock renders each line as `{% if li.presentment_title %}{{ li.presentment_title }}{% elsif li.title %}{{ li.title }}
{% endif %}` in all five templates above. `presentment_title` appears nowhere in our source, and `ItemRow` prints
`line.title`.

`presentment_title` is the title as presented to the buyer, which differs from the base title when a store sells in
more than one market or language. A single-market store never sees the difference, which is why it went unnoticed.

### Family note: `>` against `!=`

The shipping templates strike the original price only when `li.original_line_price > li.final_line_price`. The order
templates use `!=`, and `ItemRow` uses `neq` throughout. After an order edit that raises a price, stock hides the
strike and we would show it, comparing a lower original against a higher final. A narrow case, and an argument for
`gt` in `ItemRow`.

## Pickup, point of sale and receipts

### `readyForPickup` — 2 conditionals

Variant title and the price comparison. Nothing else: the stock template has no money rows at all, so the absence of a
totals block in the port is correct. `subtotal_price`, `total_price`, `shipping_price`, `tax_price` and
`total_discounts` appear nowhere in the file.

### `pickupReceipt` — 5 conditionals

Variant title, price comparison, and the three totals guards. All covered.

### `storeReceipt` — 6 conditionals

The same five plus a transaction with `payment_details`. All covered, the last with a `Find` over `vars.transactions`.

### `posExchangeV2Receipt` — 4 conditionals

Image and variant title, twice, because the template has two loops: `return_line_items` and `added_line_items`. The
port renders both, as `ItemList` sections labelled "RETURNED" and "NEW ITEMS".

### `posSendCart` — 7 conditionals — **finding**

Image, variant title, discount allocations, price comparison, `line.final_line_price > 0`, discounts above zero and
shipping above zero.

Six of the seven are covered. The exception is shared with `buyOnline` and described below.

### `buyOnline` — 8 conditionals — **finding**

The same seven plus `custom_message != blank`, which the port guards with `isPresent`.

**Both templates print the word "Free" where a line costs nothing:**

```liquid
{% if line.final_line_price > 0 %}{{ line.final_line_price | money }}{% else %}Free{% endif %}
```

`ItemRow` always prints money, so a free gift, a hundred percent discounted line or a zero-priced sample shows a zero
amount instead. The same pattern appears in six of the ten unported templates, so fixing it in `ItemRow` pays twice.

The port also improves on stock here. Line 264 of `buy-online.liquid` renders only
`line.discount_allocations.first`, so a line carrying two promotions displays one; `ItemRow` loops the whole
collection. Stock also joins the discount title to its amount with a middle dot, which our components do not.

## Payments and store credit

### `paymentReminder` — 4 conditionals — **finding**

The largest behavioural gap in the ported set.

Stock branches at line 107 of `payment-reminder.liquid`:

```liquid
{% if payment_schedule.overdue? and payment_schedule.number_of_days_overdue == 0 %}
  … is due today.
{% elsif payment_schedule.due_later? %}
  … is due on {{ payment_schedule.due_at | date: '%B %e, %Y' }}.
{% else %}
  … was due on {{ payment_schedule.due_at | date: '%B %e, %Y' }}.
{% endif %}
```

wrapped in a `custom_message != blank` override, and formats the amount with `money_with_currency`, because a business
buyer may hold balances in more than one currency.

The port handles the custom message and the `checkout_payment_collection_url` guard, but writes one sentence for every
schedule: "A friendly reminder that payment for order X is still due. Complete your payment to keep your order on
track", formatted with `money`. A buyer three weeks overdue and a buyer whose payment falls due next month read the
same email.

Fixing it needs the three-way branch, the date format, the currency-qualified amount, and a variables type carrying
`overdue?`, `due_later?`, `number_of_days_overdue` and `due_at`.

### `storeCreditIssued` — 2 conditionals — **finding**

Stock branches on `issued_store_credit.expires_at`, which the port covers, and on `company_location`, which it does
not. Line 129 reads "This has been automatically added to {{ company_location.company.name }} —
{{ company_location.name }}'s account. The store credit balance is now …".

The port renders an unconditional balance card saying "your account". A business buyer holding credit at several
locations cannot tell which balance moved, and store credit is the one balance a buyer reconciles by hand.

### `pendingPaymentFailure` — 2 conditionals

`po_number` and `checkout_payment_collection_url`, both guarded with `isPresent` in the port. This is the only ported
template that touches the purchase order field; the other ten uses are all in unported templates.

### `pendingPaymentSuccess` — 0 conditionals

No branching to reproduce.

### `failedPaymentProcessing` — 1 conditional

Stock guards `url`. The port guards `vars.url` and renders a "Return to cart" button inside it.

### `customerAddPaymentMethod`, `customerUpdatePaymentMethod`, `customerRestorePaymentMethod` — 0 conditionals each

Straight-line templates carrying a single link.

### `companyLocationUpdatePaymentMethod` — 0 conditionals

Nothing to reproduce.

## Account, company and contact

### `customerAccountWelcome` — 1 conditional — **finding**

Stock's only conditional is `{% if shop.url %}` at line 249, and it wraps the "Visit our store" button, whose href is
`{{ shop.url }}`. The port renders `<EmailButton href={liquidValue(vars.shop.url)}>` unconditionally, so a store
without a configured URL sends a button that goes nowhere. One `If` fixes it.

### `contactBuyer` — 1 conditional — **finding**

Stock's only conditional, at line 243:

```liquid
{% if custom_message != blank %}{{ custom_message }}
{% else %}Hi {{ customer.first_name | default: 'there' }}, thanks for being part of the club…{% endif %}
```

The port renders `Hi <Var path={vars.customer.first_name} />, <Var path={vars.custom_message} />` with no guard on
either side. Sent without a message it delivers a greeting followed by nothing; sent to a customer with no recorded
first name it opens "Hi ,". Both are visible to the recipient and both are one-line fixes.

Every other template that carries `custom_message` guards it: `buyOnline`, `customerAccountActivate` and
`paymentReminder` all use `isPresent`. This one was missed.

### `customerAccountActivate` — 1 conditional

`custom_message != blank`, guarded with `isPresent`.

### `customerAccountReset` — 0 conditionals

Nothing to reproduce.

### `customerEmailAddressChangedConfirmation` — 0 conditionals

Nothing to reproduce.

### `customerMarketingConfirmation` — 1 conditional

Stock guards the subscribe button with `{% if shop.url %}` although the button's href is `{{ customer.subscribe_url }}`
— a store with no URL would lose the button that confirms the subscription. The port renders the button unguarded with
the correct href, which is the right behaviour. Recorded so the difference is not later "fixed" back.

### `companyContactWelcomeEmail` — 0 conditionals

Nothing to reproduce.

## Gift cards

### `giftCardNotification` — 8 conditionals

Stock resolves a sender name from `gift_card.customer.name`, then `.email`, then `.phone`, falling back to
`shop.name`, and uses it in the headline "{{ sender_name }} sent you a gift card" and in the message attribution. The
port reproduces the whole chain with a `Capture` and renders both. It also covers `gift_card.message` and
`gift_card.expires_on`.

Stock additionally resolves `recipient_name` from `gift_card.recipient.nickname`, then `.name`, then `.email` — and
then never renders it. The port is right to omit it.

### `giftCardConfirmation` — 4 conditionals

`gift_card.recipient` and the nickname-or-name chain, and `gift_card.expires_on`. The port covers the expiry and
deliberately omits the recipient, with a comment explaining that a confirmation goes to the buyer and the recipient
branch only fires on the notification the buyer sends onward.

## Cross-cutting checks

Run across all 36 ports rather than template by template.

- **Preheader.** Every port passes `preview` to `EmailDocument`, which renders react-email's `<Preview>`. Twelve stock
  templates carry one, so we are ahead.
- **Variant titles.** `ItemRow` suppresses the variant line when it equals `Default Title`, which is the check 18 stock
  templates make.
- **Line discounts.** `ItemRow` loops `discount_allocations` and renders each title and amount.
- **Struck-through prices.** `ItemRow` shows `original_line_price` struck when it differs from `final_line_price`.
- **Addresses.** `AddressBlock` assembles the lines from their parts. Exactly one stock template uses the
  `format_address` filter, so this is a near-complete match.
- **Localisation.** No stock template uses the `t` filter. Both sets are English only.
- **Branding.** Our components hard-code the Fencing Club logo, wordmark, accent colour and footer links. Shopify's
  stock templates hard-code the same things, so this is not a gap against them, only against serving a second store.
