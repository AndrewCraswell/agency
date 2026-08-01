# shopify-emails

Write Shopify notification emails as typed React components, and get back the Liquid you paste into the admin — plus a
preview that renders them against a real order.

## The problem

Shopify sends around 46 transactional notifications: order confirmations, shipping updates, refunds, gift cards, POS
receipts. Every one of them is a Liquid template you edit in a `<textarea>` in the admin, and working on them is worse
than it sounds.

- **There is no API.** The Admin API exposes theme files, but notification templates are not theme files.
  `emailTemplates`, `notificationTemplates`, and `shop.notificationSettings` do not exist in the schema. Publishing a
  change is a human copying text into a browser. Nothing can automate it, so nothing can review, diff, or roll it back
  either.
- **There is no schema.** Shopify's Liquid reference documents the _theme_ dialect. Notification templates get a
  different set of variables, and they are documented only by example. Nobody can tell you whether
  `order.customer.first_name` or `customer.first_name` is the right spelling for a given email until a test send
  arrives.
- **There is no preview worth the name.** The admin renders a fixed placeholder order. You cannot point it at a real
  one, so the layout you approve is not the layout customers get.
- **Mistakes are silent.** Liquid resolves an unknown drop to an empty string. A typo in `{{ order_status_uurl }}` does
  not fail — it ships a button with no link.

React Email solves the authoring half beautifully, but it emits HTML with the values already substituted. Shopify needs
a template with the `{{ … }}` still in it.

This package is the missing piece: one component tree that renders **two ways**.

| Mode    | Output               | Used for                        |
| ------- | -------------------- | ------------------------------- |
| Compile | Liquid, drops intact | the file you paste into Shopify |
| Value   | HTML, drops resolved | previewing against a real order |

Because both come from the same tree, the preview cannot drift from what you ship.

## Contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [React Email](#react-email)
- [Defining a template](#defining-a-template)
- [Template types](#template-types)
- [The variable reference](#the-variable-reference)
- [Outputting values](#outputting-values)
- [Escaping](#escaping)
- [Filters](#filters)
- [Conditions](#conditions)
- [Loops](#loops)
- [Case and when](#case-and-when)
- [Binding tags](#binding-tags)
- [Building the Liquid files](#building-the-liquid-files)
- [Previewing in the React Email dev server](#previewing-in-the-react-email-dev-server)
- [Previewing against real data](#previewing-against-real-data)
- [Connecting a store](#connecting-a-store)
- [Loading live orders and customers](#loading-live-orders-and-customers)
- [The CLI](#the-cli)
- [Limitations](#limitations)
- [Planned](#planned)
- [API reference](docs/api.md)

## Requirements

Node 20 or newer. The package publishes compiled ESM with type declarations, so no build-time TypeScript support is
required to consume it.

`react`, `react-dom`, and `react-email` are **peer dependencies**. That is deliberate: a template tree is your React
tree, and a second copy of React would give you two renderers disagreeing about the same elements. Your app owns those
three; this package borrows them. React 18 and 19 both work, as does any react-email 6.

`liquidjs` is a dependency, because the package ships Shopify's filter vocabulary and something has to run it.
`createShopifyEngine` builds the engine the previews use. You can still supply your own — value mode only asks for an
object with `evalValueSync`. See [Previewing against real data](#previewing-against-real-data).

## Quick start

```tsx
// src/emails/orderConfirmation.tsx
import { defineTemplate, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { Body, Container, Head, Heading, Html, Text } from "react-email"

export const orderConfirmation = defineTemplate({
  type: "order_confirmation",
  subject: (vars) => `Order ${liquidValue(vars.name)} confirmed`,
  render: (vars) => (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>
            Thanks, <Var path={vars.customer.first_name} />
          </Heading>
          <Text>
            Your total is <Var path={vars.total_price} filters={["money"]} />.
          </Text>
          <If test={isPresent(vars.order_status_url)}>
            <a href={liquidValue(vars.order_status_url)}>Track your order</a>
          </If>
        </Container>
      </Body>
    </Html>
  )
})
```

```bash
shopify-emails build --dir src/emails --out dist
```

`dist/order_confirmation.liquid` holds the body, `dist/order_confirmation.subject.txt` holds the subject. Paste each
into the matching field in **Settings → Notifications**.

The body contains real Liquid:

```liquid
<h1>Thanks, {{ customer.first_name | escape }}</h1>
<p>Your total is {{ total_price | money | escape }}.</p>
{% if order_status_url != blank %}<a href="{{ order_status_url | escape }}">Track your order</a>{% endif %}
```

The `| escape` is added for you — see [Escaping](#escaping).

## How it works

Four ideas carry the whole design.

**The type is the contract.** Since Shopify publishes no schema, the package carries one: `type` names a Shopify
notification, and `vars` is the variables that notification is sent with. So `vars.custmer.first_name` is a compile
error instead of an empty string in a sent email, and a drop that notification does not receive cannot be referenced by
accident.

**Refs, not strings.** `vars` is not data — it is a proxy that records the path you walked. `vars.customer.first_name`
evaluates to a reference carrying `"customer.first_name"`, which the tags turn into Liquid.

**Tokens survive React.** React escapes `&`, `<`, and `>` in text, and quotes inside attributes, which would corrupt
`{% if total > 5 %}` on the way through the renderer. Compiling emits placeholder tokens drawn from an alphabet React
never rewrites, then swaps them back afterwards. The Liquid source travels inside the token itself, so it is safe across
concurrent renders.

**The render mode is ambient.** One tree renders two ways: compile mode emits Liquid, value mode resolves against real
data. Which one is running is held in a module variable installed around a single synchronous render, not in a React
context, because the expressions that most need resolving sit in attributes — and an attribute is a plain function call
that cannot read context. Because value mode resolves in render order, a name bound part-way through the template is
visible to everything after it, exactly as in Liquid.

## React Email

Templates are React Email components. The tags in this package output Liquid; everything else in the tree comes from
`react-email`, which is why it is a peer dependency rather than something this package wraps:

```tsx
import { Body, Container, Head, Heading, Html, Section, Text } from "react-email"
import { defineTemplate, For, Var } from "@repo/shopify-emails"
```

`compileTemplate` renders the tree with react-email's own `render`, so tables, inline styles, and the client-safe markup
its components emit are what Shopify ends up with. `renderTemplateValues` renders with `react-dom/server` instead,
because value mode has to be synchronous and react-email's `render` is async. The two produce the same content and
differ only in incidental syntax — see [Previewing against real data](#previewing-against-real-data).

There is no CSS-inlining step. React Email ships no equivalent of juice, and its `Tailwind` component is the only thing
that turns classes into inline styles. Put the style on the element and keep the stylesheet for what an inline style
cannot express: media queries, `:visited`, and `prefers-color-scheme`.

React Email's `email dev` server **is** the preview surface — see
[Previewing in the React Email dev server](#previewing-in-the-react-email-dev-server).

## Defining a template

```ts
defineTemplate({
  type: TemplateType,
  subject: (vars: PathRef<VariablesFor<typeof type>>) => string,
  render: (vars: PathRef<VariablesFor<typeof type>>) => ReactElement
})
```

`type` is Shopify's own notification identifier, and it does two things: it picks the variables `vars` describes, and it
becomes the output file's base name.

It defaults to `campaign`, because Shopify names every notification and marketing mail is what is left over. A campaign
has no id of Shopify's, so it takes one of its own; a notification cannot, because its type already is one:

```ts
defineTemplate({ id: "marketing_welcome", subject, render })
```

`subject` returns a **plain string**, not JSX, because Shopify's subject field is a single line of Liquid. Use
`liquidValue` there — `<Var>` is a component and cannot appear in a string.

```ts
subject: (vars) => `Order ${liquidValue(vars.name)} confirmed`
```

One sample per type ships with the package, so a template previews without being handed anything:

```ts
import { sampleFor, templateSamples } from "@repo/shopify-emails"
```

Every drop in them is one that real notification templates read, so they double as documentation of the variables. Money
is integer cents, images are flat URL strings, and the order's own drops sit at the top level rather than under `order`.

## Template types

The 46 customer notifications Shopify sends, plus the two kinds of marketing mail it does not. A `†` marks a template
whose variables were read from Shopify's stock Liquid rather than probed, because the admin's preview renderer ignores a
supplied body for it — `inferredNotificationTemplateIds` names the same twelve in code.

### Orders

| Type                        | Sent when                                           | Variables               |
| --------------------------- | --------------------------------------------------- | ----------------------- |
| `order_confirmation`        | The order is placed.                                | `OrderVariables`        |
| `order_invoice`             | An invoice is sent for an order already placed.     | `OrderHistoryVariables` |
| `order_link`                | A buyer asks for the link to an order.              | `OrderVariables`        |
| `order_edited`              | An edit to the order is applied.                    | + `routes`              |
| `order_cancelled`           | The order is cancelled.                             | `OrderVariables`        |
| `draft_order_invoice`       | A draft is invoiced. The only order not yet placed. | + `invoice_url`, terms  |
| `contact_buyer`             | A merchant writes to the buyer about the order.     | `BuyerMessageVariables` |
| `store_receipt`             | A sale is rung up in store.                         | `OrderVariables`        |
| `pos_send_cart` †           | Staff email a cart from the POS to finish online.   | + `invoice_url`         |
| `pos_exchange_v2_receipt` † | An in-store exchange is completed.                  | + exchange totals       |

### Payment

| Type                          | Sent when                                            | Variables               |
| ----------------------------- | ---------------------------------------------------- | ----------------------- |
| `order_payment_receipt`       | A payment is captured. `transaction_id` names which. | + `transaction_id`      |
| `payment_reminder`            | A scheduled payment comes due, or is overdue.        | + `payment_schedule`    |
| `pending_payment_success`     | A delayed payment method finally clears.             | `OrderVariables`        |
| `pending_payment_failure`     | It does not clear.                                   | + `po_number`           |
| `failed_payment_processing` † | A scheduled charge fails and the buyer can retry.    | + `url`                 |
| `buy_online`                  | A B2B buyer is invited to pay for a draft online.    | + `invoice_url`         |
| `refund_notification`         | Money goes back to the buyer.                        | + `refund_line_items`   |
| `store_credit_issued`         | Store credit is added to the customer's balance.     | + `issued_store_credit` |

### Shipping and pickup

| Type                        | Sent when                                     | Variables           |
| --------------------------- | --------------------------------------------- | ------------------- |
| `shipping_confirmation`     | A fulfilment ships.                           | `ShipmentVariables` |
| `shipping_update`           | Its tracking details change.                  | `ShipmentVariables` |
| `shipment_out_for_delivery` | The carrier is out with it.                   | `ShipmentVariables` |
| `shipment_delivered`        | The carrier delivers it.                      | `ShipmentVariables` |
| `local_out_for_delivery`    | The same, for delivery the shop makes itself. | `ShipmentVariables` |
| `local_delivered`           | The same.                                     | `ShipmentVariables` |
| `local_missed_delivery`     | Nobody was in.                                | `ShipmentVariables` |
| `ready_for_pickup` †        | The order is waiting at a location.           | + `location_name`   |
| `pickup_receipt` †          | The buyer collects it.                        | `OrderVariables`    |

### Returns and edits

| Type                        | Sent when                                       | Variables              |
| --------------------------- | ----------------------------------------------- | ---------------------- |
| `return_requested` †        | The buyer asks to return something.             | `ReturnVariables`      |
| `return_created` †          | The merchant opens the return.                  | `ReturnVariables`      |
| `return_approved` †         | It is approved.                                 | `ReturnVariables`      |
| `return_declined` †         | It is not.                                      | `ReturnVariables`      |
| `return_label_notification` | A prepaid label is ready to print.              | `OrderVariables`       |
| `change_requested` †        | The merchant asks the buyer to approve an edit. | `EditRequestVariables` |
| `requested_edit_declined` † | The buyer refuses it.                           | `EditRequestVariables` |

### Accounts

| Type                                          | Sent when                                | Variables             |
| --------------------------------------------- | ---------------------------------------- | --------------------- |
| `customer_account_welcome`                    | An account is created.                   | `AccountVariables`    |
| `customer_account_activate`                   | An account needs activating.             | + activation URL      |
| `customer_account_reset`                      | A password reset is asked for.           | + reset URL           |
| `customer_email_address_changed_confirmation` | The address on the account changes.      | + old and new address |
| `customer_marketing_confirmation`             | Marketing consent needs confirming.      | + subscribe URL       |
| `customer_add_payment_method`                 | A card is added to the account.          | + confirmation URL    |
| `customer_update_payment_method`              | A card is updated.                       | + confirmation URL    |
| `customer_restore_payment_method`             | A card that stopped working is restored. | + confirmation URL    |

### Gift cards

| Type                     | Sent when                             | Variables           |
| ------------------------ | ------------------------------------- | ------------------- |
| `gift_card_notification` | A gift card is sent to its recipient. | `GiftCardVariables` |
| `gift_card_confirmation` | The buyer is told theirs went out.    | `GiftCardVariables` |

### B2B

| Type                                       | Sent when                                           | Variables         |
| ------------------------------------------ | --------------------------------------------------- | ----------------- |
| `company_contact_welcome_email`            | Someone is added to a company account.              | + `account_link`  |
| `company_location_update_payment_method` † | A company location's payment method needs updating. | + `location_name` |

### Marketing

Not notifications. Shopify sends these from an automation rather than from an order, so they carry no order at all and
must carry a way out. `campaign` is the default, and both take an `id` of their own since Shopify does not name them.

| Type          | Sent when                                                   | Variables           |
| ------------- | ----------------------------------------------------------- | ------------------- |
| `campaign`    | Any broadcast or automation: launches, restocks, win-backs. | `CampaignVariables` |
| `abandonment` | A cart or checkout is left behind.                          | + `abandoned_visit` |

## The variable reference

`PathRef<T>` mirrors the shape of the variables. Walk it like the data:

```tsx
vars.customer.first_name // → customer.first_name
vars.shipping_address.city // → shipping_address.city
vars.line_items // → line_items
```

You cannot pass the root itself (`vars`) to a tag — there is no such Liquid expression, and doing so throws with a
message saying as much.

A variable cannot be optional. Every read compiles to a drop, and Liquid prints a missing drop as nothing, so
`note?: string` would type as present and go blank in the mail with nothing reported anywhere. Reading one is a compile
error naming the field. A drop Shopify may leave empty is typed nullable instead, which reads fine and still says so.

## Outputting values

Two spellings, because JSX allows a component in one position and only a string in the other.

```tsx
// Element position — a component, so it can resolve itself in value mode.
<Text>Hello <Var path={vars.customer.first_name} /></Text>

// Attribute position — a plain function, because JSX attributes cannot hold components.
<a href={liquidValue(vars.order_status_url)}>Track</a>
<img src={liquidValue(vars.line_items_image)} />
```

Both accept the same optional filters. For output that no drop stands behind, there is a raw escape hatch:

```tsx
<Text>© {liquidExpression("'now' | date: '%Y'")} Fencing Club</Text>
```

`liquidExpression` takes hand-written Liquid and is not type-checked. It is the one place where a typo can reach
production silently, so prefer `Var` and `liquidValue` wherever a drop exists.

## Escaping

Liquid hands a drop through untouched; React escapes one. Left alone the two modes would disagree on the case that
matters most — a customer's own text, which the preview would show as inert while the delivered email treated it as
markup. So compiling appends `| escape`, asking Liquid for the behaviour React already has:

```liquid
{{ customer.first_name | escape }}
href="{{ order_status_url | escape }}"
{{ total_price | money | escape }}
```

Three positions opt out, and none of them needs anything from you:

- **`liquidExpression`** is output you wrote rather than data, so it stays raw. `{{ 'now' | date: '%Y' }}` has no
  attacker in it.
- **A captured name** holds rendered markup, so escaping it would print the tags instead of applying them. `<Capture>`
  binds through `markupBinding` rather than `binding`, and reading one of those refs skips the filter — see
  [Binding tags](#binding-tags).
- **The subject line** is not HTML, so an ampersand in a name belongs in the inbox as an ampersand. `compileSubject`
  emits plain drops.

Escaping does not make an email safe on its own, and it is not the whole of it: an attacker-controlled value reaching a
`href` still gets to choose the scheme. Validate anything you interpolate that a customer supplied.

## Filters

Filters are strings, applied left to right:

```tsx
<Var path={vars.total_price} filters={["money"]} />
<Var path={vars.created_at} filters={["date: '%B %e, %Y'"]} />
<Var path={vars.title} filters={["truncate: 15, '--'", "upcase"]} />
```

They are deliberately **not** a typed union. Shopify owns the filter vocabulary, adds to it without telling anyone, and
ships notification-only filters such as `attach_as_pdf` that appear in no public schema. Any closed list we shipped as a
type would be a stale copy that eventually rejects valid Liquid.

They are checked all the same. The package carries a catalog of all 154 filters Shopify documents, classified into the
ones a notification can use, the ones it cannot — theme-only colour and asset filters, cart links, storefront markup —
and a handful nobody has confirmed either way. `compileTemplate` and `compileSubject` read the filters out of their own
output and refuse anything the catalog rules out:

```
order_confirmation uses a filter it cannot: "color_lighten" operates on theme colour settings, which a notification
cannot read, so it cannot be used in a notification template
```

The preview enforces the same list, and additionally removes the 28 filters liquidjs has that Shopify has never had —
`slugify`, `jsonify`, `where_exp`, and friends. Those are the dangerous ones: they preview perfectly and fail on
Shopify. A conformance test holds the catalog against Shopify's own published filter data, so it cannot quietly go
stale.

## Conditions

Conditions are built, not written, so a renamed drop is a compile error:

```tsx
import { and, eq, gt, isBlank, isPresent, isTruthy, neq } from "@repo/shopify-emails"

<If test={isPresent(vars.order_status_url)}>…</If>
<If test={gt(vars.total_price, 5000)}>…</If>
<If test={eq(vars.financial_status, "paid")}>…</If>
<If test={and(isPresent(vars.customer.email), isTruthy(vars.requires_shipping))}>…</If>
```

Available builders: `isPresent`, `isBlank`, `isTruthy`, `eq`, `neq`, `gt`, `lt`, `and`, `or`.

`test` accepts only values these produce. A hand-written string is rejected:

```tsx
<If test="total_price > 5000">…</If>
// Type 'string' is not assignable to type 'LiquidCondition'.
```

Branches nest their own children:

```tsx
<If test={eq(vars.financial_status, "paid")}>
  <Text>Paid in full.</Text>
  <ElseIf test={eq(vars.financial_status, "partially_paid")}>
    <Text>Partially paid.</Text>
  </ElseIf>
  <Else>
    <Text>Payment pending.</Text>
  </Else>
</If>
```

`<Unless>` takes the same shape and inverts the first test.

> Liquid has no parentheses in conditions and evaluates them right to left. `and` and `or` are therefore flat by design
> — mixing them will not group the way you read it.

## Loops

`<For>` takes a render prop with the item and the loop state:

```tsx
<For each={vars.line_items}>
  {(line, loop) => (
    <Section>
      <Text>
        <Var path={line.title} /> × <Var path={line.quantity} />
      </Text>
      <Text>
        <Var path={line.final_line_price} filters={["money"]} />
      </Text>
      <Unless test={isTruthy(loop.last)}>
        <hr />
      </Unless>
    </Section>
  )}
</For>
```

Name the item whatever you like — it is an ordinary function parameter. The Liquid variable is derived from the
collection, so the loop above compiles to:

```liquid
{% for line_items_item in line_items %}…{% endfor %}
```

You do not name it yourself, because a name that collides with a drop would shadow it in the compiled template while the
preview kept resolving the drop, so the two would disagree only in the artifact you never look at. Deriving from the
path also keeps nested loops distinct, since an inner collection's path already contains the outer name.

`loop` is Liquid's `forloop`, typed: `first`, `last`, `index`, `index0`, `rindex`, `rindex0`, `length`. It is handed to
the body rather than read from the surrounding variables, so it resolves in both render modes and in both element and
attribute position.

`limit` is supported and compiles to `{% for line_items_item in line_items limit: 3 %}`.

## Case and when

```tsx
<Case on={vars.delivery_method_type}>
  <When value="shipping">
    <Text>On its way.</Text>
  </When>
  <When value="pickup">
    <Text>Ready for pickup.</Text>
  </When>
</Case>
```

## Binding tags

`<Assign>` and `<Capture>` bind a name that the rest of the template reads. Compile mode emits the Liquid tag and lets
Shopify do the binding; value mode writes into the ambient environment as the render passes through, so both agree.

Declare the name once with `binding`, then use that declaration on both sides:

```tsx
const greeting = binding("greeting")
const heading = markupBinding("heading")

<Assign to={greeting} value="customer.first_name | upcase" />
<Capture to={heading}>
  Thanks, <Var path={vars.customer.first_name} />
</Capture>

<Var path={greeting} />
<Var path={heading} />
```

`binding` returns the same kind of ref that `vars` hands you, so a bound name is read exactly like a drop. Because the
write and every read share one declaration, a misspelt read is a compile error instead of a blank in a sent email.

Liquid values are text unless you say otherwise, so `binding("greeting")` is `PathRef<string>` and needs no type
argument. Pass one — `binding<Money>("subtotal")` — only when you assign a drop rather than a piece of text.

A capture is rendered markup rather than data, so it gets its own declaration: `markupBinding` returns a `MarkupRef`,
`<Capture>` accepts nothing else, and reading one skips the `| escape` that every other drop gets. Keeping the two kinds
of name apart in the type means no read has to remember which it is holding.

Read the bound name through `<Var>`, not through a bare `liquidValue` call. A bare call is evaluated while the
surrounding JSX is built, which happens before any sibling component renders, so it would run ahead of the binding.
Value mode detects that case and throws with the offending expression rather than previewing a blank.

Rebinding works the way Liquid does: a second `<Assign>` to the same declaration changes what everything below it sees,
and nothing above it.

Prefer computing the value in TypeScript and passing it as a prop. Reach for these when the Liquid genuinely has to do
the work at send time, or when you are porting a template that already uses them.

`<Raw>` wraps content Shopify should not interpret, and passes its children through in value mode.

## Building the Liquid files

```bash
shopify-emails build --dir src/emails --out dist
```

Every `.ts`/`.tsx` module under `--dir` is loaded and any exported template definition is compiled. Test, spec, story,
and declaration files are skipped. Definitions load through `tsx`, which registers a Node loader rather than a registry
of its own, so a definition and the command share one copy of this package and consumers need no bundler configuration.
Duplicate `id`s are an error.

`tsx` takes its JSX settings from the nearest `tsconfig.json`, so run the command from a directory whose config sets
`"jsx": "react-jsx"` and covers your templates. That is the same config your editor and `tsc` already use.

The output directory is cleared first, so a renamed or deleted template cannot leave a stale file behind for someone to
paste.

Each template produces two files, because the admin has two fields:

```
dist/order_confirmation.liquid
dist/order_confirmation.subject.txt
```

You can also compile in process:

```ts
import { compileSubject, compileTemplate } from "@repo/shopify-emails"

const body = await compileTemplate(orderConfirmation, { pretty: true })
const subject = compileSubject(orderConfirmation)
```

## Previewing in the React Email dev server

`email dev` renders a module's default export, so a template needs one that is already in value mode. `definePreview`
builds it, and it can sit in the template's own file:

```tsx
// src/emails/notifications/orderLink.tsx
import { definePreview, defineTemplate } from "@repo/shopify-emails"

export const orderLink = defineTemplate({ … })

export default definePreview(orderLink)
```

Pass an engine as the second argument to render through your own; without one it builds a Shopify engine and shares it
across previews.

```bash
pnpm exec email dev --dir src/emails
```

The variables arrive as props, which makes the dev server's props panel an override for the drops: `PreviewProps` seeds
the panel with the sample for the template's type, and editing that JSON re-renders against the edit.

```ts
type PreviewProps = { values: TemplateValues; highlight?: boolean }
type PreviewOptions = { highlight?: boolean }
```

`highlight` marks each resolved drop so a reader can tell it from typed copy, in text and in attributes alike. It is on,
because that is what this view offers that Shopify's own admin preview does not: the admin shows the finished message
against real orders, while this shows which words came from data. Turn it off for one render in the props panel, or for
every render of a preview with `definePreview(orderLink, engine, { highlight: false })`.

Which way round to leave it is yours to decide, and the Send button is why. It posts the markup the viewer is showing
rather than rendering the template again, so whatever is decorated on the page is decorated in the inbox. A preview kept
for reading and a preview kept for test sends are the same setting held two ways. Nothing decorated ever reaches
Shopify: `build` compiles the template afresh, and highlighting is a value-mode concern that Liquid mode never sees.

Two things the harness does not give you:

- **No subject.** React Email's render keeps only the email document, so anything drawn beside it is discarded, and the
  viewer has no subject chrome of its own. The title in the Send dialog is inferred from the _filename_, not from your
  `subject`. Assert the subject in a test instead.
- **No custom toolbar.** React Email exposes no plugin API, and its toolbar tabs are a closed union, so linting,
  compatibility, and spam scoring are the ones it ships and nothing can be added beside them.

## Previewing against real data

Value mode resolves the same tree against actual values. It needs a Liquid engine, and the package builds one:

```ts
import { renderTemplateValues } from "@repo/shopify-emails"
import { createShopifyEngine } from "@repo/shopify-emails/liquid"

const engine = createShopifyEngine({ currency: "USD", locale: "en-US" })

const html = renderTemplateValues(orderConfirmation, engine, liveOrderValues)
```

That engine carries Shopify's filters, which liquidjs does not have, and refuses the ones a notification cannot reach.
Pass your own instead if you need different behaviour — it only has to satisfy:

```ts
type LiquidEvaluator = {
  evalValueSync: (expression: string, scope: object) => unknown
}
```

It is synchronous on purpose. The render mode is ambient for the duration of one render, so allowing an `await` inside
would let a second render overlap the first and read its bindings.

Omit the values to use the sample for the template's type. A read that names something neither the values nor Shopify
supplies throws, rather than rendering the blank Liquid would.

**Guard the two paths against each other.** The value that makes this design worth having is that compile and preview
come from one tree, so assert they agree:

```ts
const compiled = await engine.parseAndRender(await compileTemplate(tpl, { pretty: true }), values)
const resolved = renderTemplateValues(tpl, engine, values)
expect(normalise(resolved)).toBe(normalise(compiled))
```

The two paths use different renderers, so `normalise` has to absorb the incidental differences — attribute-name casing,
the doctype, react-email's marker comments, and whitespace the pretty-printer added.

## Connecting a store

Previewing against invented data only proves the template renders. To see what a customer will see, point it at the
store.

Authentication is a **custom app you create in your own admin**, not OAuth. There is no hosted app here to redirect to,
and a merchant-created custom app already carries the customer data access that a public app would have to apply for.

1. In the Shopify admin, go to **Settings → Apps and sales channels → Develop apps**.
2. **Create an app**, name it something like `Email previews`, and pick yourself as the developer.
3. Open **Configuration → Admin API integration** and grant `read_orders` and `read_customers`. Nothing else is used,
   and nothing is ever written.
4. **Install app**, then under **API credentials** reveal the **Admin API access token**. It starts `shpat_`, and
   Shopify shows it once.
5. Run the login command and paste it at the prompt:

```bash
shopify-emails login --store your-shop.myshopify.com
```

The token is read from a hidden prompt or from stdin, never from an argument, so it cannot be recovered from shell
history. It is written to a per-user config directory — `%APPDATA%\shopify-emails` on Windows,
`~/Library/Application Support/shopify-emails` on macOS, `$XDG_CONFIG_HOME/shopify-emails` otherwise — and never to the
repository. The command calls the API once before saving, so a bad token fails at login rather than the first time a
preview loads.

On macOS and Linux the file is created `0600`, owner-only. Windows has no equivalent mode bit, so the file inherits the
ACL of your profile directory; on a shared machine, confirm that directory is not readable by other accounts.

For CI, or anywhere you would rather not write a file, set `SHOPIFY_STORE` and `SHOPIFY_ADMIN_TOKEN` instead. The
environment wins over the saved file.

> Only the last 60 days of orders are readable unless Shopify has granted the store `read_all_orders`.

## Loading live orders and customers

`@repo/shopify-emails/store` is a separate entry point because it reads a token from disk and talks to the Admin API. It
is Node-only by design: keeping it out of the main entry point means the template DSL stays bundlable for a browser.

```ts
import { createStoreSource } from "@repo/shopify-emails/store"

const store = await createStoreSource() // or ("your-shop.myshopify.com") when several are logged in

const shop = await store.shop()
const orders = await store.searchOrders({ query: "financial_status:paid", first: 20 })
const customers = await store.searchCustomers("alex@")

const values = await store.loadOrderVariables(orders[0].id)
```

`searchOrders` and `searchCustomers` take Shopify's own search syntax and return summaries meant for a picker — id,
name, date, financial status, total for orders; name, email, order count for customers. `loadOrderVariables` returns the
notification variables themselves, shaped the way Shopify shapes them, so they drop straight into a preview:

```ts
const html = renderTemplateValues(orderConfirmation, engine, values)
```

Financial status arrives lower-cased, because that is how Liquid compares it — a picker showing `Paid` next to a
template testing `financial_status == "paid"` is a trap worth closing early.

Everything here is read-only. There is no write path, and the credentials are scoped so there could not be one.

## Probing the notification variables

Shopify publishes no schema for what a notification receives. Its Liquid reference explicitly excludes notification
templates, and the Admin API cannot read, write, or render one, so there is nothing to query. The only instrument that
works is a template that describes its own variables and a send that renders it.

```bash
shopify-emails probe > probe.liquid
```

That prints a throwaway notification body: one `<pre>` containing a JSON object with a key per candidate drop. Drops
that answer `json` with an error — `customer` and `shop` — are asked for property by property instead. Every value gets
`| escape` so the document survives whatever a drop contains, and `| default: "null"` so a drop that was never supplied
is distinguishable from one that was there and blank.

Then, once per surface:

1. In the admin, open **Settings → Notifications**, pick a notification that carries the data you care about, and **Edit
   code**.
2. Copy the existing body somewhere safe first. There is no API to restore it from, and **Revert to default** discards
   your customisations rather than restoring them.
3. Paste the probe, save, and **Preview**. Preview renders against Shopify's sample data, which populates far more
   variables than a typical real order does.
4. Save the rendered preview as HTML — right-click the preview, **View frame source**, save — and restore the original
   body.

Read the answer back rather than by eye:

```bash
shopify-emails probe --capture preview.html
```

That decodes the escaping, parses the object, and sorts every drop into present, blank for this order, absent, and
`absent, yet a stock template reads it` — the last being the interesting one, since it means either the drop only
appears for other notifications or a stock template reads something that is never there. The same two functions are
exported for use in a test:

```ts
import { notificationQuestions, parseProbe, summariseProbe } from "@repo/shopify-emails/probe"

const report = summariseProbe(parseProbe(html), notificationQuestions)
```

A full dump is large, and a mail client that clips the message would truncate the object. The probe ends with a closing
brace, so a capture that has none was clipped; narrow it and merge the runs:

```bash
shopify-emails probe --names line_items,shipping_address
```

`--for marketing` asks the same questions of a Shopify Email campaign instead. None of the notification evidence carries
over — it is a different product with a different dialect — so the marketing list is the drops our own campaign
templates read plus the ones worth testing an assumption about.

`--for asset` asks a different kind of question: not what a drop holds, but what the CDN filters resolve to. The
fingerprint in a path like `notifications/visa-e96781bb….png` is an artifact of Shopify's asset pipeline, and no Admin
API resource exposes it, so a live render is the only authority. Its capture prints the resolved URLs as JSON rather
than a present-or-absent report, because the values are the point of asking.

The committed output of both lives in `packages/fc-templates/src/__snapshots__`, so the probe can be pasted without
running anything first.

## The CLI

```
shopify-emails login --store <shop>.myshopify.com
shopify-emails build [--dir <src>] [--out <dir>]
shopify-emails pull [--store <shop>] [--order <name|gid>] [--out <file>]
shopify-emails probe [--for notification|marketing|asset] [--names a,b] [--out <file>]
shopify-emails probe --capture <file.html> [--for notification|marketing|asset] [--out <file>]
```

`login` stores an Admin API token for a store — see [Connecting a store](#connecting-a-store) for how to get one.
`build` compiles every template under `--dir` into paste-ready files — see
[Building the Liquid files](#building-the-liquid-files). `probe` prints the variable probe and reads its result back —
see [Probing the notification variables](#probing-the-notification-variables). `pull` writes what one live order hands a
template.

`pull` takes the most recent readable order, or the one named by `--order` — either as `#1001` or as a `gid://` — and
writes its variables as JSON. It is for reading, and for seeding a dev-time lookup. It is not for committing: a fixture
goes stale the moment the order does, so read live data through
[`@repo/shopify-emails/store`](#loading-live-orders-and-customers) when you want the current thing.

## Limitations

**Publishing is manual.** There is no API for notification templates. `build` gets you as far as paste-ready files; a
person has to paste them.

**A filter's arguments are unchecked.** The catalog knows which filters exist and which a notification may use, but not
what each one takes, so `date: '%Q'` compiles.

**Preview fidelity is not exact.** liquidjs is not Shopify's Liquid, and money and date formatting come from `Intl`
rather than from your store's settings.

**A bound name has to be read through a component.** `<Assign>` and `<Capture>` work in both modes, but a bare
`liquidValue` or `liquidExpression` call reading the bound name is evaluated before the binding runs. Value mode reports
this rather than rendering a blank — see [Binding tags](#binding-tags).

**A capture holding real tags diverges.** Compile mode reads a `MarkupRef` raw, but value mode returns it through React,
which escapes it. A capture of plain text — which is what they are for — agrees in both modes; one containing markup
would preview escaped and ship raw. Compose markup in React instead.

**`When value` is not checked against the drop.** `<Case on={vars.status}>` will accept a `<When>` whose value the drop
can never equal.

**Nested loops sharing a ref diverge.** Capturing an outer loop's `loop` and using it inside an inner `<For>` compiles
to `forloop.…`, which Liquid binds to the _innermost_ loop, while value mode uses the outer loop's values. Use
`forloop.parentloop` through `liquidExpression` if you need this.

**An array ref has no members.** `vars.line_items` can be iterated with `<For>` but not addressed further, so Liquid's
`line_items.size`, `.first`, and `.last` are unreachable through the typed path and need `liquidExpression`.

**Partials are React components, not `{% include %}` or `{% render %}`.** Shared layout is composed in React and inlined
at compile time.

**An image has to be hosted.** A `data:` URI previews correctly and then fails in Gmail, Outlook.com and Yahoo, all of
which refuse an inline image source. Point `src` at a URL the recipient's client can fetch. Publishing those files is
manual today — see [Planned](#planned).

## Planned

None of this is built yet. It is written down so the shape is agreed before anyone starts.

### `assets` — publish images and get the filter back

```
shopify-emails assets <dir> [--manifest <file>]
```

Uploads every image under `<dir>` to the connected store's Files, then writes a manifest mapping each local name to the
filter that renders it:

```json
{ "shield-check.png": "{{ 'shield-check.png' | file_url }}" }
```

The filter is the useful return value, not the CDN URL. A URL carries a version fingerprint that changes when the file
is replaced, so a template holding one goes stale on the next upload, while the filter keeps resolving. Uploads are
idempotent by filename so re-running the command replaces rather than duplicates.

This needs a write scope, which is the first the CLI would ask for — `login` is read-only today and
[Previewing against real data](#previewing-against-real-data) says so deliberately. Publishing assets should stay a
separate, explicitly granted permission.

### An asset shim so the filter previews

`file_url` and `file_img_url` are classified `unverified` in `catalog.ts`: they read the store's Files, and whether a
notification may reach them is unconfirmed. Confirm that first, because everything above depends on it.

The shims in `filters/shims.ts` currently guess a CDN path from the filename, which is right in shape and wrong in the
fingerprint, so a preview shows a broken image. Once `assets` writes a manifest, the engine should read it and resolve
these two filters against real uploaded URLs — the same trick `NOTIFICATION_ASSETS` already uses to resolve
`shopify_asset_url` for the three platform assets the stock templates reference.

### Publishing metadata

The package is private to this monorepo today, so `package.json` carries no `repository`, `homepage`, `bugs`, or
`license`. npm renders all four on the package page, and `repository` is what lets a consumer find the source from their
lockfile. Fill them in before the first publish, and add a `LICENSE` file to match — the field alone is not the grant.
