import { describe, expect, it } from "vitest"
import { formatTime, formatWeapon } from "./format"
import { formatEventSpan } from "./format"

describe("simulator formatting", () => {
  it("formats raw and millisecond evidence timestamps", () => {
    expect(formatTime(0)).toBe("0 us")
    expect(formatTime(1999)).toBe("1999 us")
    expect(formatTime(2000)).toBe("2 ms")
    expect(formatTime(10_250)).toBe("10.25 ms")
  })

  it("rounds event spans to the nearest whole millisecond", () => {
    expect(formatEventSpan(10)).toBe("0 ms")
    expect(formatEventSpan(13_010)).toBe("13 ms")
    expect(formatEventSpan(13_500)).toBe("14 ms")
    expect(formatEventSpan(170_100)).toBe("170 ms")
  })

  it("formats known weapons without inventing unknown labels", () => {
    expect(formatWeapon("epee")).toBe("Epee")
    expect(formatWeapon("foil")).toBe("Foil")
    expect(formatWeapon("sabre")).toBe("Sabre")
    expect(formatWeapon("training")).toBe("training")
  })
})
