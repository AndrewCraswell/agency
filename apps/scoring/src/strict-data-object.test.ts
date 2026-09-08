import { describe, expect, it } from "vitest"
import { strictDataObject, strictExactDataObject } from "./strict-data-object.js"

describe("strict data object boundaries", () => {
  it.each([null, undefined, 1, "x", true, [], new Date(), Object.create(null)])(
    "rejects non-plain input %s",
    (value) => {
      expect(() => strictDataObject(value, "record")).toThrow("record must be a plain object")
    }
  )

  it("rejects accessors without invoking them and rejects hidden properties", () => {
    let reads = 0
    const accessor = {
      get field() {
        reads += 1
        return 1
      }
    }
    expect(() => strictDataObject(accessor, "record")).toThrow("enumerable data values")
    expect(reads).toBe(0)
    expect(() => strictDataObject(Object.defineProperty({}, "field", { value: 1 }), "record")).toThrow(
      "enumerable data values"
    )
  })

  it("rejects symbols using the caller's diagnostic", () => {
    expect(() => strictDataObject({ [Symbol("field")]: 1 }, "record", "symbols denied")).toThrow("symbols denied")
  })

  it("rejects a proxy whose descriptor disappears", () => {
    const value = new Proxy({ field: 1 }, { getOwnPropertyDescriptor: () => undefined })
    expect(() => strictDataObject(value, "record")).toThrow("enumerable data values")
  })

  it("returns valid objects unchanged and rejects missing or unexpected keys", () => {
    const value = { field: 1 }
    expect(strictExactDataObject(value, ["field"], "record")).toBe(value)
    expect(() => strictExactDataObject(value, [], "record")).toThrow("missing or unrecognized fields")
    expect(() => strictExactDataObject(value, ["other"], "record")).toThrow("missing or unrecognized fields")
  })

  it("rejects keys changed by a proxy between structural and exact checks", () => {
    let calls = 0
    const value = new Proxy(
      { field: 1 },
      {
        ownKeys: () => (++calls === 1 ? ["field"] : [Symbol("field")])
      }
    )
    expect(() => strictExactDataObject(value, ["field"], "record")).toThrow("missing or unrecognized fields")
  })

  it("checks required ownership after enumerating keys", () => {
    let calls = 0
    const value = new Proxy(
      { field: 1 },
      {
        getOwnPropertyDescriptor: (target, key) =>
          ++calls === 1 ? Object.getOwnPropertyDescriptor(target, key) : undefined
      }
    )
    expect(() => strictExactDataObject(value, ["field"], "record")).toThrow("missing or unrecognized fields")
  })
})
