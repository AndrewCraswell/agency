import { describe, expect, it } from "vitest"
import { compileRankedTextQuery } from "./ranked-text-query.js"

describe("ranked text query compiler", () => {
  it.each([
    ["health care", '(body:"health" AND body:"care")'],
    ['"health care"', '(body:"health care")'],
    ["health care OR education", '(body:"health" AND body:"care") OR (body:"education")'],
    ["health or education", '(body:"health") OR (body:"education")'],
    ["health -tax", '(body:"health" AND -body:"tax")'],
    ['-"tax credit" health', '(body:"health" AND -body:"tax credit")'],
    ['"OR" health', '(body:"OR" AND body:"health")'],
    ["health AND care", '(body:"health" AND body:"AND" AND body:"care")'],
    ["  health\n\tcare  ", '(body:"health" AND body:"care")'],
    ["title:tax bill* abc^4 x~2", '(body:"title:tax" AND body:"bill*" AND body:"abc^4" AND body:"x~2")'],
    ["NOT (tax) [2020 TO 2025]", '(body:"NOT" AND body:"(tax)" AND body:"[2020" AND body:"TO" AND body:"2025]")'],
    ['"tax \\"credit\\""', '(body:"tax \\"credit\\"")'],
    ["café 教育 2026", '(body:"café" AND body:"教育" AND body:"2026")'],
    ["tax\\credit", '(body:"tax\\\\credit")']
  ])("compiles %s without exposing parser syntax", (input, expected) => {
    expect(compileRankedTextQuery(input)).toBe(expected)
  })

  it("supports a trusted field without accepting a field expression", () => {
    expect(compileRankedTextQuery("health", "title")).toBe('(title:"health")')
    expect(() => compileRankedTextQuery("health", "body) OR *")).toThrow("trusted simple identifier")
  })

  it.each([
    "",
    " ",
    "*",
    "-",
    '""',
    '"unterminated',
    'tax"credit"',
    '"tax"credit',
    "OR tax",
    "tax OR",
    "tax OR OR health",
    "-tax",
    "tax OR -health",
    "- tax",
    "tax\u0000",
    "a".repeat(501)
  ])("rejects invalid or unbounded expression %s", (input) => {
    expect(() => compileRankedTextQuery(input)).toThrow(Error)
  })
})
