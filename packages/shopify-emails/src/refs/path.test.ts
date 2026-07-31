import { describe, expect, it } from "vitest"
import { binding, isPathRef, pathOf, rootRef } from "./path.ts"

type Variables = {
  name: string
  shop: { name: string; address: { city: string } }
  line_items: { title: string }[]
  note?: string | null
}

const v = rootRef<Variables>()

describe("path refs", () => {
  it("records a top-level property", () => {
    expect(pathOf(v.name)).toBe("name")
  })

  it("joins nested properties with dots", () => {
    expect(pathOf(v.shop.address.city)).toBe("shop.address.city")
  })

  it("refuses an optional property, which Liquid would print as nothing", () => {
    // @ts-expect-error an optional variable is not a readable drop
    expect(pathOf(v.note)).toBe("note")
  })

  it("roots a ref at a Liquid-introduced name", () => {
    expect(pathOf(binding<Variables["line_items"][number]>("line").title)).toBe("line.title")
  })

  it("addresses a bound name directly", () => {
    expect(pathOf(binding("greeting"))).toBe("greeting")
  })

  it("refuses the root itself, which names no drop", () => {
    expect(() => pathOf(v)).toThrow(/not the whole set/)
  })

  it("does not answer to well-known symbols", () => {
    expect((v.name as unknown as Record<symbol, unknown>)[Symbol.toPrimitive]).toBeUndefined()
  })

  it("recognises a ref and rejects a lookalike", () => {
    expect(isPathRef(v.name)).toBe(true)
    expect(isPathRef({ name: "name" })).toBe(false)
    expect(isPathRef(null)).toBe(false)
  })
})
