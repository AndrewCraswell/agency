import { describe, expect, it } from "vitest"
import { orderConfirmation } from "./emails/notifications/orderConfirmation.tsx"
import { renderDefinition } from "./reactEmail.ts"

/*
 * What the compiled Liquid says and what it renders to are covered for every template by
 * compiledOutput.test.ts and valueMode.test.ts. Only the highlight option is left here: it is the
 * one path through this module that no whole-library check exercises.
 */

describe("renderDefinition", () => {
  it("highlights every drop when the viewer asks for it", async () => {
    const { html } = await renderDefinition(orderConfirmation, undefined, { highlightVariables: true })

    expect(html).toContain("data-fc-var")
  })
})
