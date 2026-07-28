import { describe, expect, it } from "vitest"
import { adminUrl, templates } from "./registry.ts"
import { findTemplate, findVariation, render, renderTemplate } from "./render.ts"
import type { Template } from "./types.ts"

const firstEmail = templates.find((template) => template.type === "email")
const firstPrintout = templates.find((template) => template.type === "printout")

function requireTemplate(id: string): Template {
  const template = findTemplate(id)
  if (!template) {
    throw new Error(`Fixture error: no template with id "${id}"`)
  }
  return template
}

describe("registry", () => {
  it("gives every template a unique id", () => {
    expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length)
  })

  it("gives every variation an id unique within its template", () => {
    for (const template of templates) {
      const ids = template.variations.map((variation) => variation.id)
      expect([template.id, new Set(ids).size]).toEqual([template.id, ids.length])
    }
  })

  it("covers the three groups we publish", () => {
    expect(new Set(templates.map((template) => template.group))).toEqual(
      new Set(["Printouts", "Marketing emails", "Customer notifications"])
    )
  })

  it("points printouts and emails at different admin screens", () => {
    expect(firstPrintout && adminUrl(firstPrintout)).toContain("apps/order-printer")
    expect(firstEmail && adminUrl(firstEmail)).toContain("settings/notifications")
  })
})

describe("lookups", () => {
  it("returns undefined for an unknown template", () => {
    expect(findTemplate("nope")).toBeUndefined()
  })

  it("falls back to the first variation when none is named", () => {
    const invoice = requireTemplate("invoice")
    expect(findVariation(invoice).id).toBe("unpaid")
    expect(findVariation(invoice, "nope").id).toBe("unpaid")
    expect(findVariation(invoice, "paid").id).toBe("paid")
  })

  it("throws for an unknown template id", async () => {
    await expect(render("nope")).rejects.toThrow('No template with id "nope"')
  })
})

const cases = templates.flatMap((template) =>
  template.variations.map((variation) => ({
    label: `${template.id} / ${variation.id}`,
    template,
    variation
  }))
)

describe.each(cases)("$label", ({ template, variation }) => {
  it("renders without a Liquid error", async () => {
    const rendered = await renderTemplate(template, variation)
    expect(rendered.html).not.toContain("Liquid error")
    expect(rendered.html.length).toBeGreaterThan(500)
  })
})

describe.each(cases.filter(({ template }) => template.type === "email"))(
  "$label subject",
  ({ template, variation }) => {
    it("renders to plain text", async () => {
      const { subject } = await renderTemplate(template, variation)
      expect(subject).not.toBe("")
      expect(subject).not.toContain("{{")
    })
  }
)

describe.each(cases.filter(({ template }) => template.type === "printout"))(
  "$label subject",
  ({ template, variation }) => {
    it("is empty, because a printout has none", async () => {
      const { subject } = await renderTemplate(template, variation)
      expect(subject).toBe("")
    })
  }
)

describe("emails", () => {
  it("produce a complete HTML document", async () => {
    const { html } = await render("order_confirmation")
    expect(html).toContain("<html")
  })

  it("substitute the shop into the subject", async () => {
    const { subject } = await render("contact_buyer")
    expect(subject).toBe("Message from Fencing Club")
  })
})

describe("invoice", () => {
  it("shows a balance due and no payments before capture", async () => {
    const { html } = await render("invoice", "unpaid")
    expect(html).toContain("BALANCE DUE")
    expect(html).not.toContain("PAYMENTS")
  })

  it("shows one captured payment once paid", async () => {
    const { html } = await render("invoice", "paid")
    expect(html).toContain("PAID IN FULL")
    expect(html).toContain("PAYMENTS")
    expect(html).toContain("Capture")
    expect(html).not.toContain("Authorization")
  })

  it("prices each line by unit and by amount", async () => {
    const { html } = await render("invoice", "paid")
    expect(html).toContain("UNIT PRICE")
    expect(html).toContain("AMOUNT")
  })

  it("repeats the items across pages in the multi-page variation", async () => {
    const { html } = await render("invoice", "multipage")
    expect(html.split("Standard Epee Body Cord").length - 1).toBe(8)
  })
})

describe("packing slip", () => {
  it("counts the items and units without pricing them", async () => {
    const { html } = await render("packing-slip")
    expect(html).toContain("6 line items")
    expect(html).toContain("10 units")
    expect(html).not.toContain("$")
  })

  it("carries the customer note", async () => {
    const { html } = await render("packing-slip")
    expect(html).toContain("CUSTOMER NOTE")
    expect(html).toContain("first tournament next week")
  })
})
