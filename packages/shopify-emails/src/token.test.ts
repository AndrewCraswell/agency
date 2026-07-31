import { describe, expect, it } from "vitest"
import { encodeLiquid, replaceLiquidTokens, toLiquidSource } from "./token.ts"

describe("liquid tokens", () => {
  it("round-trips an expression", () => {
    expect(toLiquidSource(encodeLiquid("{{ order.name }}"))).toBe("{{ order.name }}")
  })

  it("round-trips the characters React would otherwise escape", () => {
    const source = `{% if total > 5 and name != 'a & b' %}`
    expect(toLiquidSource(encodeLiquid(source))).toBe(source)
  })

  it("round-trips non-ASCII source", () => {
    expect(toLiquidSource(encodeLiquid("{{ 'café — ünïcode' }}"))).toBe("{{ 'café — ünïcode' }}")
  })

  it("preserves the token kind", () => {
    const kinds: string[] = []
    replaceLiquidTokens(`${encodeLiquid("{{ a }}", "value")}${encodeLiquid("{% if a %}", "raw")}`, (token) => {
      kinds.push(token.kind)
      return ""
    })
    expect(kinds).toEqual(["value", "raw"])
  })

  it("separates adjacent tokens", () => {
    const markup = `${encodeLiquid("{{ a }}")}${encodeLiquid("{{ b }}")}`
    expect(toLiquidSource(markup)).toBe("{{ a }}{{ b }}")
  })

  it("leaves surrounding markup untouched", () => {
    const markup = `<td>Gloves &amp; Shoes ${encodeLiquid("{{ a }}")}</td>`
    expect(toLiquidSource(markup)).toBe("<td>Gloves &amp; Shoes {{ a }}</td>")
  })

  it("ignores text that merely resembles a token", () => {
    expect(toLiquidSource("__LQ_zz_LQ__")).toBe("__LQ_zz_LQ__")
  })
})
