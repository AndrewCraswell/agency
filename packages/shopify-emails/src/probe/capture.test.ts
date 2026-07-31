import { describe, expect, it } from "vitest"
import { notificationQuestions } from "./build.ts"
import { parseProbe, summariseProbe } from "./capture.ts"

const captured = (json: string) => `<html><body><pre style="font: 12px/1.5 monospace">${json}</pre></body></html>`

describe("probe capture", () => {
  it("reads a result back through the escaping the probe applied", () => {
    const answered = parseProbe(
      captured(`{&quot;shop_name&quot;: &quot;Fencing &amp; Co&quot;, &quot;note&quot;: null}`)
    )

    expect(answered).toEqual({ note: null, shop_name: "Fencing & Co" })
  })

  it("survives a value that contains the closing tag", () => {
    const answered = parseProbe(captured(`{&quot;note&quot;: &quot;&lt;/pre&gt; nice try&quot;}`))

    expect(answered).toEqual({ note: "</pre> nice try" })
  })

  it("names clipping as the cause when the object stops early", () => {
    expect(() => parseProbe(`<pre>{&quot;line_items&quot;: [{&quot;title&quot;`)).toThrow(/clipp/i)
  })

  it("refuses a capture with no probe in it", () => {
    expect(() => parseProbe("<p>Order confirmed</p>")).toThrow(/<pre>/)
  })

  it("sorts each answer into what a template can rely on", () => {
    const report = summariseProbe(
      { customer: { email: "a@b.co" }, line_items: [], note: null, shop: null },
      { ...notificationQuestions, names: ["customer", "line_items", "note", "shop", "return_label"] }
    )

    expect(report.present).toEqual(["customer"])
    expect(report.empty).toEqual(["line_items"])
    expect(report.absent).toEqual(["note", "shop"])
    expect(report.unanswered).toEqual(["return_label"])
  })

  it("flags an absent drop that a stock template still reads", () => {
    const report = summariseProbe(
      { po_number: null, reserve_inventory_until: null },
      { ...notificationQuestions, names: ["po_number", "reserve_inventory_until"] }
    )

    expect(report.absentButRead).toEqual(["po_number"])
  })
})
