# Design changes

The gap analysis in [stock-template-gaps.md](stock-template-gaps.md) found seven places where a port dropped a branch
its design carries, and a much larger body of structure that only the ten unported templates exercise.

Almost all of that turned out to be the port owing the design rather than the reverse. Six of the seven are now closed
by copying what the design already spells out, wording included. What the designs themselves still owe is the collapsed
state of anything that can disappear, and everything the ten unported templates need.

## Ports brought back in line with their design

`payment-reminder` wrote one sentence for all three payment states. The design branches on the schedule and writes
three, each opening "This is a reminder that your payment of {amount} for order {name}" and closing with "is due
today", "is due on {date}", or "was due on {date}". The amount carries its currency code, because a business buyer's
schedule can be denominated in a currency the shop does not otherwise use. The port now writes the designed sentences
verbatim.

`store-credit-issued` said "You now have $110.00 in store credit" in every case. The design branches on
`company_location` and writes "This has been automatically added to {company} — {location}'s account. The store credit
balance is now {amount}." for a business buyer and "This has been automatically added to your account. Your store credit
balance is now {amount}." otherwise, both with the currency code. The port now writes both.

`contact-buyer` drew "Hi Alex, {{ custom_message }}", which reads as an empty greeting when the merchant sends nothing
and as a doubled greeting when the merchant writes their own. The design treats the message as a replacement for the
whole paragraph and falls back to a standard note greeting `customer.first_name | default: 'there'`. The port now does
the same.

`customer-account-welcome` drew the Visit our store button unconditionally. The design guards it on `shop.url`, because
a shop with no published online store has no URL to send anyone to. The port now guards it.

`local-missed-delivery` pointed its single button at a hard-coded contact page. The design points the same button at
`order_status_url`, falling back to `shop.url`. The port now follows it.

`buy-online` and `pos-send-cart` write Free where a line costs nothing. The other eleven designs that list goods print
`$0.00`. `ItemRow` now takes a `free` flag and only those two set it.

The four shipping designs and `local-out-for-delivery` print `presentment_title` with `title` as the fallback, which is
what a translated storefront depends on. The other designs print `title` alone. `ItemRow` exports a `presentedTitle`
helper and only those five call it.

## What the designs still owe

### The collapsed state of anything that can disappear

Three of the changes above make an element conditional: the store button on `customer-account-welcome`, and the two
branch sentences on `payment-reminder` and `store-credit-issued`. Every design draws only the present state. The
collapsed version is what a share of buyers will actually get, and on `customer-account-welcome` it changes the spacing
between the lead and the quick links below it, so it needs drawing rather than inferring.

### Two inconsistencies worth a decision

Twelve designs write Free for a nil line price and twelve print `$0.00`. Six read `presentment_title` and eighteen do
not. Five strike a compare-at price on `original > final` and eighteen on `original != final`, which differ only after
an edit that raised a price, where the majority spelling draws a strikethrough that reads as a discount. Each split
looks accidental rather than intended. Settling them one way would let `ItemRow` drop the flags it now carries.

### Bundles and per-measure prices, which are not built

A bundled line belongs to a group, which Shopify labels `For: {name}` when the group ships on its own and
`Part of: {name}` when it does not. A line in a shop that prices by weight or volume carries a unit price that has to be
shown beside the line price. Neither is drawn in any design and neither is built, because both add furniture to the item
card that nothing covers. The drops are typed and the `unit_price_with_measurement` filter is available, so both are a
design away. The design needs a line item drawn in all four states: plain, grouped, per-measure, and both at once.

### The delivery estimate on a delivered shipment

`shipment-delivered` shows an estimated delivery date. The port omits it: the date the carrier promised is spent once
the parcel has arrived, and repeating it invites a comparison the buyer cannot act on. This is the one place the port
deliberately disagrees with its design, and one of the two should give way.

## What the ten unported templates still need

The detail is in [unported-templates.md](unported-templates.md), template by template. What the designs owe, in the
order the templates should be built:

**A shared shell.** Six of the ten are the same page: an eyebrow carrying the order name and an optional PO number, a
headline, an optional lead, an optional note, an optional numbered instruction list, one or two buttons whose labels
come from the data rather than from the design, one or more labelled item sections, and an optional totals block. Draw
it once with every optional part visible, and once with all of them absent, because the collapsed version is what most
buyers will get.

**A numbered instruction list.** Return notifications tell the buyer what to do in three or four steps. Nothing in the
component set draws a numbered list. It needs a design that survives a step whose text wraps to three lines and a step
that contains a link.

**A returns ledger.** Subtotal, a row per return fee, estimated taxes, an outstanding balance, and then either an amount
to pay or an estimated refund. The last row is the one that matters and it is the one that changes label, so it needs to
be drawn both ways.

**A refunded badge.** `refund-notification` marks the order refunded. The status components draw paid and pending but
nothing for money going the other way.

**A full order ledger.** `order-cancelled`, `order-edited`, and `refund-notification` share a seventeen-row totals block
covering duties, tips, cash rounding, and four different flavours of amount due. The current `Totals` component composes
arbitrary rows so no component change is needed, but the design has never shown more than six rows at once and the
column widths were chosen for short labels.

**A customer information block.** `order-edited` closes with shipping address, billing address, location, payment
method, and shipping method. Nothing similar exists.

**A thirteen-sentence cancellation headline.** `order-cancelled` picks its headline from a cancellation reason crossed
with a refund state. The design needs the longest of the thirteen drawn, because it is what sets the block's height.

## What is deliberately not changing

Three places where a design is wrong and the port is right are listed in
[stock-template-gaps.md](stock-template-gaps.md#where-stock-is-wrong-and-we-are-not). None of them should be copied back
into a port.
