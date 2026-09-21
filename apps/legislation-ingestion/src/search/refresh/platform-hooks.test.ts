import { describe, expect, it } from "vitest"
import { railwayServiceScale } from "./platform-hooks.js"

describe("refresh platform hooks", () => {
  it("accepts explicit Railway restore topology", () => {
    expect(railwayServiceScale("us-west=2,eu-west=1")).toEqual(["us-west=2", "eu-west=1"])
  })

  it.each(["", "us-west=0", "us-west=1,us-west=2", "not a region=1"])(
    "rejects unsafe Railway restore topology %j",
    (value) => {
      expect(() => railwayServiceScale(value)).toThrow("Railway scale")
    }
  )
})
