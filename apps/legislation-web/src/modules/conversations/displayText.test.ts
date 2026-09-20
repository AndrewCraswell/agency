import { expect, it } from "vitest"
import { displayText } from "./displayText"

it("only shortens display values and never cuts an astral character in half", () => {
  expect(displayText("Original")).toBe("Original")
  const value = displayText("123🏛️long", 5)
  expect(value).toBe("123…")
  expect(value.isWellFormed()).toBe(true)
  expect(displayText("abcdef", 5)).toBe("abcd…")
})
