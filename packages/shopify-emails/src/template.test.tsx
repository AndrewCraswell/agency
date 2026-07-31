import { describe, expect, it } from "vitest"
import { For, liquidValue, Var } from "./liquid/tags.tsx"
import { templateSamples } from "./samples/templates.ts"
import { compileSubject, compileTemplate, defineTemplate } from "./template.ts"

const orderConfirmation = defineTemplate({
  type: "order_confirmation",
  subject: (v) => `Order ${liquidValue(v.name)} confirmed`,
  render: (v) => (
    <table>
      <tbody>
        <tr>
          <td>
            <a href={liquidValue(v.order_status_url)}>
              <Var path={v.name} />
            </a>
            <For each={v.line_items}>
              {(line) => (
                <span>
                  <Var path={line.title} />
                  <Var path={line.final_line_price} filters={["money"]} />
                </span>
              )}
            </For>
            <Var path={v.total_price} filters={["money"]} />
          </td>
        </tr>
      </tbody>
    </table>
  )
})

describe("defineTemplate", () => {
  it("compiles the body against the contract", async () => {
    const liquid = await compileTemplate(orderConfirmation)
    expect(liquid).toContain(`href="{{ order_status_url | escape }}"`)
    expect(liquid).toContain("{% for line_items_item in line_items %}")
    expect(liquid).toContain("{{ line_items_item.final_line_price | money | escape }}")
    expect(liquid).toContain("{{ total_price | money | escape }}")
    expect(liquid).not.toContain("__LQ_")
  })

  it("compiles the subject, which Shopify stores apart from the body", () => {
    expect(compileSubject(orderConfirmation)).toBe("Order {{ name }} confirmed")
  })

  it("names the file Shopify receives after the template's type", () => {
    expect(orderConfirmation.id).toBe("order_confirmation")
  })

  it("treats a template that names no type as a campaign", () => {
    const welcome = defineTemplate({
      id: "marketing_welcome",
      subject: () => "Welcome",
      render: (v) => <Var path={v.customer.first_name} />
    })

    expect(welcome.type).toBe("campaign")
    expect(welcome.id).toBe("marketing_welcome")
  })

  it("ships a sample carrying every drop the body reads", () => {
    const sample = templateSamples.order_confirmation
    expect(sample.total_price).toBe(24_484)
    expect(sample.line_items[0]?.title).toBe("Ridgeline Backpack")
  })
})
