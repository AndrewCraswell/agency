import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { engine, sanitizeForPreview } from "../../../liquid.ts"
import { paidOrder, paidVariables, unpaidVariables } from "./invoice.variables.ts"

const source = sanitizeForPreview(readFileSync(new URL("./invoice.liquid", import.meta.url), "utf8"))

describe("invoice item titles", () => {
  it.each([paidVariables, unpaidVariables])(
    "shows product names with variants only in the option details",
    (variables) => {
      const markup = engine.parseAndRenderSync(source, variables)

      expect(markup).toContain('<div class="fc-item__title">Standard Epee Body Cord</div>')
      expect(markup).not.toContain("Standard Epee Body Cord - 2-prong / 1.5 m")
      expect(markup).toContain('<span class="fc-item__option-name">Connector</span>2-prong')
      expect(markup).toContain('<span class="fc-item__option-name">Length</span>1.5 m')
      expect(markup).toContain('<div class="fc-item__title">Lens Protection Plan (2 Year)</div>')
      expect(markup).not.toContain("Default Title")
    }
  )

  it("keeps custom item titles when there is no product", () => {
    const markup = engine.parseAndRenderSync(source, {
      ...paidVariables,
      order: {
        ...paidOrder,
        line_items: [{ title: "Blade repair", quantity: 1, product: null, options_with_values: [] }]
      }
    })

    expect(markup).toContain('<div class="fc-item__title">Blade repair</div>')
  })
})
