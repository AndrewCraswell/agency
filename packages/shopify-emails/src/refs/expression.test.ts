import { describe, expect, it } from "vitest"
import { and, eq, gt, isBlank, isPresent, isTruthy, lt, neq, or } from "./expression.ts"
import { rootRef } from "./path.ts"

const v = rootRef<{ total_price: number; note: string; address2: string; paid: boolean }>()

describe("conditions", () => {
  it("compares a drop against blank", () => {
    expect(isPresent(v.address2)).toBe("address2 != blank")
    expect(isBlank(v.address2)).toBe("address2 == blank")
  })

  it("emits a bare drop for truthiness", () => {
    expect(isTruthy(v.paid)).toBe("paid")
  })

  it("quotes string operands and leaves numbers alone", () => {
    expect(eq(v.note, "gift")).toBe("note == 'gift'")
    expect(gt(v.total_price, 5000)).toBe("total_price > 5000")
    expect(lt(v.total_price, 5000)).toBe("total_price < 5000")
    expect(neq(v.paid, false)).toBe("paid != false")
  })

  it("compares two drops without quoting either", () => {
    expect(eq(v.note, v.address2)).toBe("note == address2")
  })

  it("escapes a quote inside a string operand", () => {
    expect(eq(v.note, "alex's")).toBe("note == 'alex\\'s'")
  })

  it("joins tests flatly, since Liquid has no parentheses", () => {
    expect(and(isPresent(v.note), gt(v.total_price, 0))).toBe("note != blank and total_price > 0")
    expect(or(isBlank(v.note), isTruthy(v.paid))).toBe("note == blank or paid")
  })
})
