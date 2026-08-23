import { describe, expect, it } from "vitest"
import { classifyFoilScenarioInputs, type FoilClassificationInput } from "./foil-scenario-evidence.js"
import { loadTimingTable } from "./timing-table.js"

const timingTable = loadTimingTable("timing-1")

function input(line: string): FoilClassificationInput {
  return {
    atUs: 0,
    id: "logical-evidence",
    lines: [
      {
        line,
        resistanceMilliOhms: null,
        resistanceUncertaintyMilliOhms: null,
        state: "grounded"
      }
    ]
  }
}

describe("foil golden-scenario evidence boundary", () => {
  it.each(["left.other.guard-or-piste", "left.standard.unsupported-context"])(
    "rejects a declared but unsupported logical line %s",
    (line) => {
      expect(() => classifyFoilScenarioInputs([input(line)], [line], timingTable)).toThrow(
        new TypeError(`Unsupported foil classification line ${line}`)
      )
    }
  )

  it("rejects a logical line that is absent from the declared line model", () => {
    const evidence = input("left.standard.guard-or-piste")

    expect(() => classifyFoilScenarioInputs([evidence], [], timingTable)).toThrow(
      new TypeError("Foil classification input logical-evidence uses an undeclared line")
    )
  })
})
