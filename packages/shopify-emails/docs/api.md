# API reference

Every export, in one place. The [README](../README.md) explains why each exists; this is the lookup table.

Three entry points:

| Specifier                       | Holds                                                    |
| ------------------------------- | -------------------------------------------------------- |
| `@repo/shopify-emails`          | defining, compiling, previewing, and the tags             |
| `@repo/shopify-emails/liquid`   | the Shopify filter registry and the engine it builds      |
| `@repo/shopify-emails/store`    | live orders and customers from a store's Admin API        |

## Defining and compiling

| Export               | Signature                                                             | Notes                                                    |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| `defineTemplate`     | `(definition: { subject, render, type?, id? }) => TemplateDefinition`   | Identity at runtime; `type` chooses the variables.       |
| `TemplateDefinition` | `{ id, type, subject, render }`                                        | `type` defaults to `campaign`, and `id` defaults to it.  |
| `TemplateType`       | a notification id, `"campaign"`, or `"abandonment"`                     | What a template declares. Only a campaign may set `id`.  |
| `VariablesFor<T>`    | type                                                                   | What that type is rendered with.                         |
| `compileTemplate`    | `(template, options?) => Promise<string>`                              | The Liquid you paste into the admin. Async.              |
| `compileSubject`     | `(template) => string`                                                 | Plain text, so drops are not escaped.                    |

`compileTemplate` takes `{ pretty?: boolean }`. Both entry points refuse a template that uses a filter Shopify does not
provide — see [Filters](#filters).

## Referencing variables

| Export          | Signature                                | Notes                                                              |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `PathRef<T>`    | type                                     | Mirrors the variables. Property access records a path segment.      |
| `binding<T>`    | `(name: string) => PathRef<T>`           | A name Liquid introduces: `Assign`, or a drop Shopify injects.      |
| `markupBinding` | `(name: string) => MarkupRef`            | A name `Capture` binds to rendered markup. Read raw, never escaped. |
| `MarkupRef`     | type                                     | A `PathRef<string>` that cannot be passed where data is expected.   |
| `pathOf`        | `(ref: PathRef<unknown>) => string`      | The recorded path. Throws on the root, which names no drop.         |

A collection ref publishes only `size`, `first`, and `last`, because that is all Liquid offers without a `for`.

**Optional variables are rejected.** A ref has no way to say "this might not be here": every read compiles to a drop,
and Liquid prints a missing drop as nothing. So `note?: string` would type as present and go blank in the mail with no
error anywhere. Reading one is a compile error naming the field. A drop Shopify may leave empty is typed nullable, which
reads fine and still says so.

## Outputting values

| Export             | Position  | Signature                                                     |
| ------------------ | --------- | ------------------------------------------------------------- |
| `Var`              | element   | `{ path: PathRef<unknown>; filters?: readonly string[] }`      |
| `liquidValue`      | attribute | `(ref: PathRef<unknown>, filters?: readonly string[]) => string` |
| `liquidExpression` | either    | `(expression: string) => string`                              |

`liquidExpression` is hand-written Liquid and is not type-checked against the variables. Its filters still are.

## Conditions

`isPresent`, `isBlank`, `isTruthy`, `eq`, `neq`, `gt`, `lt`, `and`, `or` — all return `LiquidCondition`, the only thing
`test` accepts. `Operand` is a `PathRef`, string, number, or boolean.

Liquid has no parentheses in conditions and evaluates them right to left, so `and` and `or` are flat by design.

## Tags

| Export     | Props                                                           | Compiles to                       |
| ---------- | --------------------------------------------------------------- | --------------------------------- |
| `If`       | `{ test: LiquidCondition; children }`                           | `{% if %}`                        |
| `ElseIf`   | `{ test: LiquidCondition; children }`                           | `{% elsif %}`                     |
| `Else`     | `{ children }`                                                  | `{% else %}`                      |
| `Unless`   | `{ test: LiquidCondition; children }`                           | `{% unless %}`                    |
| `Case`     | `{ on: PathRef<unknown>; children }`                            | `{% case %}`                      |
| `When`     | `{ value: string; children }`                                   | `{% when %}`                      |
| `For`      | `{ each: PathRef<readonly T[]>; limit?: number; children }`      | `{% for %}`                       |
| `Find`     | `{ each; match: (item) => LiquidCondition; children }`           | a loop that keeps the last match  |
| `Assign`   | `{ to: PathRef<T>; value: string }`                             | `{% assign %}`                    |
| `Capture`  | `{ to: MarkupRef; children }`                                   | `{% capture %}`                   |
| `Raw`      | `{ children }`                                                  | `{% raw %}`                       |

`ElseIf` and `Else` are children of `If` or `Unless`; `When` is a child of `Case`. `For` and `Find` take a render
function, not elements: `children` receives the item ref, and `For` also receives a `PathRef<ForLoop>` carrying
`first`, `last`, `index`, `index0`, `rindex`, `rindex0`, and `length`.

`Find` compiles to a loop rather than a filter, because `where` and `find` belong to the theme dialect that
notifications do not have.

## Previewing

| Export                 | Signature                                                                 |
| ---------------------- | ------------------------------------------------------------------------- |
| `definePreview`        | `(template, engine?, { highlight? }?) => PreviewComponent`                |
| `renderTemplateValues` | `(template, engine, values?, highlight?) => string`                       |
| `LiquidEvaluator`      | `{ evalValueSync: (expression: string, scope: object) => unknown }`        |
| `TemplateValues`       | `Record<string, unknown>`                                                 |

`definePreview` builds its own engine when you do not pass one, and shares it across previews. Export the result as a
module's default and React Email's dev server renders it, seeded with the sample for the template's type.

Value rendering is synchronous on purpose: the render mode is ambient for one render, and an `await` inside would let a
second render overlap the first and read its bindings.

It throws rather than rendering a blank in two cases — a name read before the `Assign` that binds it, and a drop the
template was not given and Shopify is not known to supply.

## Filters

`@repo/shopify-emails/liquid`:

| Export                     | Signature                                                        |
| -------------------------- | ---------------------------------------------------------------- |
| `createShopifyEngine`      | `({ currency?, locale?, timeZone? }?) => Liquid`                  |
| `filterCatalog`            | `ReadonlyMap<string, FilterEntry>`                                |
| `filterNames`              | `(status: FilterStatus) => readonly string[]`                     |
| `filterRefusal`            | `(name: string) => string \| undefined`                           |
| `filterNamesIn`            | `(source: string) => readonly string[]`                           |
| `assertFiltersAreAvailable`| `(source: string, templateId: string) => void`                    |

`FilterStatus` is `"supported"`, `"unavailable"`, or `"unverified"`. The catalog classifies all 154 filters Shopify
documents plus the four that only notifications have, and a test conforms it against Shopify's own published data.

`createShopifyEngine` registers the supported ones, and replaces both the unavailable ones and the 28 filters liquidjs
has that Shopify does not with throwers. That is why a preview cannot succeed on Liquid Shopify would reject.
`compileTemplate` and `compileSubject` run the same check over their output.

Filters are still passed as strings rather than a typed union: Shopify owns the vocabulary and adds to it without
telling anyone. The catalog is the check, not the type.

## Samples

| Export                 | Notes                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| `templateSamples`      | One sample per template type, keyed the same way `TemplateVariables` is. |
| `sampleFor`            | `<T extends TemplateType>(type: T) => VariablesFor<T>`                  |
| `placedOrderSample`, … | The pieces those are built from, for composing a sample of your own.     |

## Probing a live store

`@repo/shopify-emails/probe`. None of this is needed to write a template: it is how the variable types above were
derived, and what you reach for to check a drop the package has not seen — see
[Probing the notification variables](../README.md#probing-the-notification-variables).

| Export                        | Signature or notes                                                      |
| ----------------------------- | ----------------------------------------------------------------------- |
| `buildProbe`                  | `(questions: ProbeQuestions) => string`                                 |
| `notificationQuestions`       | What to ask a notification.                                             |
| `marketingQuestions`          | What to ask a Shopify Email campaign.                                   |
| `ProbeQuestions`              | type                                                                    |
| `parseProbe`                  | `(html: string) => CapturedValues`                                       |
| `summariseProbe`              | `(captured: CapturedValues, questions: ProbeQuestions) => ProbeReport`   |
| `CapturedValues`, `ProbeReport` | types                                                                 |
| `observedNotificationDrops`   | Every drop the 46 stock notification templates read without binding it.  |
| `documentedNotificationDrops` | Every drop Shopify's notification-variables page lists.                  |
| `deprecatedNotificationDrops` | The ones that page marks deprecated, still worth probing for.            |
| `candidateNotificationDrops`  | Those three, deduplicated and sorted.                                   |
| `candidateMarketingDrops`     | The same list for campaigns.                                            |

## Notification variables

What each customer notification is rendered with, probed template by template. Three layers: shared
value shapes, one type per set of templates that share their variables, and one type per template
named after the id Shopify uses in the admin URL and in `gid://shopify/EmailTemplate/<id>`.

| Export                                    | Notes                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `OrderConfirmationVariables` and 45 more  | One per template. Most alias a shared set until they diverge.          |
| `NotificationVariables`                   | Every one of them keyed by template id.                                |
| `NotificationTemplateId`                  | `keyof NotificationVariables`.                                         |
| `inferredNotificationTemplateIds`         | The 12 the admin's preview refuses to probe, read from stock Liquid.   |
| `OrderVariables`, `ShipmentVariables`, …  | One per set two or more templates share.                               |
| `PlacedOrderVariables`                    | What a placed order carries, shared by most of those sets.             |
| `OrderSummaryVariables`                   | The part a draft order shares with a placed one.                       |
| `CustomerVariables`, `ShopVariables`      | The two floors. `shop` is the only variable every notification has.    |
| `Customer`, `Shop`, `LineItem`, …         | The value shapes they are built from.                                  |
| `CampaignVariables`                       | What a marketing automation carries. No order, and an unsubscribe URL. |
| `AbandonmentVariables`                    | A campaign plus the visit that was abandoned.                          |
| `TemplateVariables`                       | Those two and every notification, keyed by `TemplateType`.             |

## Store access

`@repo/shopify-emails/store`:

| Export              | Signature                                              |
| ------------------- | ------------------------------------------------------ |
| `createStoreSource` | `(store?: string) => Promise<StoreSource>`             |
| `StoreSource`       | orders and customers, searchable                       |
| `OrderSummary`      | type                                                   |
| `CustomerSummary`   | type                                                   |
| `ShopSummary`       | type                                                   |
| `OrderSearch`       | type                                                   |

Access comes from `shopify-emails login`, which delegates to the Shopify CLI, or from `SHOPIFY_STORE` and
`SHOPIFY_ADMIN_TOKEN`. `shopify-emails pull` writes one order's variables out as JSON for reading; render through this
API when you want data that has not gone stale.
