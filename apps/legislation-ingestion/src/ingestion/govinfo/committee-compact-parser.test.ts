import { describe, expect, it } from "vitest"
import { parseGovInfoCompactCommitteeDirectory } from "./committee-compact-parser.js"

function fixture() {
  return (
    ["SENATE", "HOUSE"]
      .map(
        (chamber) =>
          `STANDING COMMITTEES OF THE ${chamber}\n\n` +
          Array.from(
            { length: 10 },
            (_, index) => `Committee ${index}\n\nJane Person (WA) CHAIRMAN John Person (OR)\n\n`
          ).join("")
      )
      .join("\n") + "JOINT COMMITTEES"
  )
}
describe("compact GovInfo committee text", () => {
  it("extracts complete single-line annotated rosters", () => {
    const result = parseGovInfoCompactCommitteeDirectory(fixture())
    expect(result).toHaveLength(20)
    expect(result[0]?.members).toEqual([
      { chamber: "upper", name: "Jane Person", state: "WA", role: "chair" },
      { chamber: "upper", name: "John Person", state: "OR" }
    ])
  })
  it("rejects the observed 118th reading-order ambiguity rather than using a member line as a heading", () => {
    expect(() =>
      parseGovInfoCompactCommitteeDirectory(fixture().replace("Committee 1", "Other Person (CA) CHAIRMAN\nDEFENSE"))
    ).toThrow("reading order")
  })
})
