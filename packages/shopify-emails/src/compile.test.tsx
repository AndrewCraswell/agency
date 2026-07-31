import { Button } from "react-email"
import { describe, expect, it } from "vitest"
import { compileToLiquid } from "./compile.ts"
import {
  Assign,
  Capture,
  Case,
  Else,
  ElseIf,
  Find,
  For,
  If,
  liquidExpression,
  liquidValue,
  Raw,
  Unless,
  Var,
  When
} from "./liquid/tags.tsx"
import { eq, gt, isTruthy } from "./refs/expression.ts"
import { pathOf, binding, markupBinding, rootRef } from "./refs/path.ts"
import { compileTemplate, defineTemplate } from "./template.ts"
import type { OrderVariables } from "./variables/shared.ts"

const v = rootRef<OrderVariables>()

describe("compileToLiquid", () => {
  it("emits an output tag for a variable", async () => {
    expect(
      await compileToLiquid(
        <span>
          <Var path={v.name} />
        </span>
      )
    ).toContain("{{ name | escape }}")
  })

  it("chains filters in declaration order", async () => {
    const liquid = await compileToLiquid(
      <span>
        <Var path={v.total_price} filters={["money", "upcase"]} />
      </span>
    )
    expect(liquid).toContain("{{ total_price | money | upcase | escape }}")
  })

  it("keeps comparison operators out of entity form", async () => {
    const liquid = await compileToLiquid(
      <If test={gt(v.total_price, 5000)}>
        <span>Free shipping</span>
      </If>
    )
    expect(liquid).toContain("{% if total_price > 5000 %}")
    expect(liquid).not.toContain("&gt;")
  })

  it("keeps single quotes in a filter argument inside an attribute", async () => {
    const liquid = await compileToLiquid(<a href={liquidExpression("'now' | date: '%Y'")}>year</a>)
    expect(liquid).toContain(`href="{{ 'now' | date: '%Y' }}"`)
    expect(liquid).not.toContain("&#x27;")
  })

  it("leaves a literal ampersand escaped in the surrounding copy", async () => {
    const liquid = await compileToLiquid(
      <span>
        Gloves & Shoes <Var path={v.name} />
      </span>
    )
    expect(liquid).toContain("Gloves &amp; Shoes")
    expect(liquid).toContain("{{ name | escape }}")
  })

  it("preserves the MSO conditional and attribute Liquid in a React Email button", async () => {
    const liquid = await compileToLiquid(
      <Button href={liquidValue(v.order_status_url)}>
        <Var path={v.shop.name} />
      </Button>
    )
    expect(liquid).toContain("<!--[if mso]>")
    /* The spacer entity must survive undecoded; decoding it collapses the Outlook padding hack. */
    expect(liquid).toContain("&#8203;")
    expect(liquid).toContain(`href="{{ order_status_url | escape }}"`)
  })

  it("binds the loop alias so the body reads from the item", async () => {
    const liquid = await compileToLiquid(
      <For each={v.line_items}>
        {(line) => (
          <span>
            <Var path={line.title} />
            <Var path={line.product.featured_image} />
          </span>
        )}
      </For>
    )
    expect(liquid).toContain("{% for line_items_item in line_items %}")
    expect(liquid).toContain("{{ line_items_item.title | escape }}")
    expect(liquid).toContain("{{ line_items_item.product.featured_image | escape }}")
    expect(liquid).toContain("{% endfor %}")
  })

  it("nests a loop inside a loop without the aliases colliding", async () => {
    const liquid = await compileToLiquid(
      <For each={v.line_items}>
        {(line) => (
          <For each={line.discount_allocations}>
            {(da) => <Var path={da.discount_application.title} filters={["upcase"]} />}
          </For>
        )}
      </For>
    )
    expect(liquid).toContain(
      "{% for line_items_item_discount_allocations_item in line_items_item.discount_allocations %}"
    )
    expect(liquid).toContain(
      "{{ line_items_item_discount_allocations_item.discount_application.title | upcase | escape }}"
    )
  })

  it("finds one item by walking the collection, since the notification dialect has no lookup filter", async () => {
    const liquid = await compileToLiquid(
      <Find each={v.line_items} match={(line) => eq(line.title, "Blade")}>
        {(line) => <Var path={line.final_line_price} filters={["money"]} />}
      </Find>
    )
    expect(liquid).toContain("{% assign line_items_found = nil %}")
    expect(liquid).toContain("{% for line_items_item in line_items %}")
    expect(liquid).toContain("{% if line_items_item.title == 'Blade' %}")
    expect(liquid).toContain("{% assign line_items_found = line_items_item %}")
    expect(liquid).toContain("{% if line_items_found %}")
    expect(liquid).toContain("{{ line_items_found.final_line_price | money | escape }}")
    expect(liquid).not.toContain("break")
  })

  it("spells the else-if branch the way Liquid does", async () => {
    const liquid = await compileToLiquid(
      <If test={isTruthy(v.requires_shipping)}>
        <span>a</span>
        <ElseIf test={isTruthy(v.item_count)}>
          <span>b</span>
        </ElseIf>
        <Else>
          <span>c</span>
        </Else>
      </If>
    )
    expect(liquid).toContain("{% elsif item_count %}")
    expect(liquid).not.toContain("elseif")
  })

  it("nests branch children into the flat token stream Liquid expects", async () => {
    const liquid = await compileToLiquid(
      <If test={isTruthy(v.requires_shipping)}>
        <span>a</span>
        <Else>
          <span>c</span>
        </Else>
      </If>
    )
    expect(liquid.indexOf("{% if")).toBeLessThan(liquid.indexOf(">a<"))
    expect(liquid.indexOf(">a<")).toBeLessThan(liquid.indexOf("{% else %}"))
    expect(liquid.indexOf("{% else %}")).toBeLessThan(liquid.indexOf(">c<"))
    expect(liquid.indexOf(">c<")).toBeLessThan(liquid.indexOf("{% endif %}"))
  })

  it("leaves no tokens behind", async () => {
    const liquid = await compileToLiquid(
      <If test={isTruthy(v.name)}>
        <span>
          <Var path={v.name} />
        </span>
      </If>
    )
    expect(liquid).not.toContain("__LQ_")
  })

  it("emits an unless block", async () => {
    const liquid = await compileToLiquid(
      <Unless test={isTruthy(v.requires_shipping)}>
        <span>Digital order</span>
      </Unless>
    )
    expect(liquid).toContain("{% unless requires_shipping %}")
    expect(liquid).toContain("{% endunless %}")
  })

  it("emits a case block with its branches", async () => {
    const liquid = await compileToLiquid(
      <Case on={v.financial_status}>
        <When value="paid">
          <span>Paid</span>
        </When>
        <When value="refunded">
          <span>Refunded</span>
        </When>
      </Case>
    )
    expect(liquid).toContain("{% case financial_status %}")
    expect(liquid).toContain("{% when 'paid' %}")
    expect(liquid).toContain("{% when 'refunded' %}")
    expect(liquid).toContain("{% endcase %}")
  })

  it("emits assign and capture", async () => {
    const liquid = await compileToLiquid(
      <span>
        <Assign to={binding("total")} value={pathOf(v.total_price)} />
        <Capture to={markupBinding("greeting")}>
          <Var path={v.customer.first_name} />
        </Capture>
      </span>
    )
    expect(liquid).toContain("{% assign total = total_price %}")
    expect(liquid).toContain("{% capture greeting %}")
    expect(liquid).toContain("{% endcapture %}")
  })

  it("emits a raw block so its contents reach Shopify uninterpreted", async () => {
    const liquid = await compileToLiquid(
      <Raw>
        <span>{"{{ not_a_variable }}"}</span>
      </Raw>
    )
    expect(liquid).toContain("{% raw %}")
    expect(liquid).toContain("{% endraw %}")
  })

  it("applies a loop limit", async () => {
    const liquid = await compileToLiquid(
      <For each={v.line_items} limit={3}>
        {(line) => (
          <span>
            <Var path={line.title} />
          </span>
        )}
      </For>
    )
    expect(liquid).toContain("{% for line_items_item in line_items limit: 3 %}")
  })
})

describe("guards against Liquid that would be wrong rather than invalid", () => {
  it("refuses markup in an attribute, which would ship escaped", () => {
    expect(() => liquidValue(markupBinding("greeting"))).toThrow(/attribute cannot carry/)
  })

  it("escapes a backslash in an operand before the quote that would undo it", async () => {
    const liquid = await compileToLiquid(
      <If test={eq(v.name, "back\\slash and 'quote'")}>
        <span>hi</span>
      </If>
    )
    expect(liquid).toContain(`{% if name == 'back\\\\slash and \\'quote\\'' %}`)
  })

  it("names the drop when a filter a notification lacks is applied to it", () => {
    expect(() => liquidValue(v.name, ["color_darken"])).toThrow(/`name` uses a filter it cannot/)
    expect(() => liquidExpression("'now' | color_darken")).toThrow("`'now' | color_darken` uses a filter it cannot")
  })

  it("refuses the filter as the tree is built, before anything is compiled", async () => {
    await expect(compileToLiquid(<Var path={v.total_price} filters={["slugify"]} />)).rejects.toThrow(
      /`total_price` uses a filter it cannot/
    )
  })

  it("still catches a filter that reached the source through `Raw`, which no ref saw", async () => {
    const template = defineTemplate({
      id: "raw_filter",
      subject: () => "Hello",
      render: () => <Raw>{`{{ shop.name | slugify }}`}</Raw>
    })
    await expect(compileTemplate(template)).rejects.toThrow(/raw_filter uses a filter it cannot/)
  })
})
