import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { benchPrototypeContract } from "./bench-prototype-contract.js"

const drawingPath = fileURLToPath(new URL("../docs/bench-prototype-zone-drawing.svg", import.meta.url))

async function drawing() {
  return readFile(drawingPath, "utf8")
}

describe("BP-010 dimensioned zone drawing", () => {
  it("binds the provisional, denied SVG envelope and each zone to the executable contract", async () => {
    const svg = await drawing()
    const { envelope, zones } = benchPrototypeContract.planningDrawing

    expect(svg).toContain('data-contract="benchPrototypeContract.planningDrawing"')
    expect(svg).toContain(`data-artifact-status="${benchPrototypeContract.planningDrawing.artifactStatus}"`)
    expect(svg).toContain('data-datum="lower-left planning datum"')
    expect(svg).toContain('data-release-state="deny"')
    expect(svg).toContain(`data-width-mm="${envelope.width}"`)
    expect(svg).toContain(`data-height-mm="${envelope.height}"`)
    expect(svg).toContain('data-dimension="300 mm"')
    expect(svg).toContain('data-dimension="160 mm"')

    for (const zone of zones) {
      expect(svg).toContain(
        `data-zone-id="${zone.id}" data-x-min="${zone.xMin}" data-x-max="${zone.xMax}" data-y-min="${zone.yMin}" data-y-max="${zone.yMax}"`
      )
    }
    expect(svg).toContain('data-zone-id="isolation-corridor" data-x-min="145" data-x-max="165"')
  })

  it("retains every contract connector coordinate and declares the drawing non-fabrication planning evidence", async () => {
    const svg = await drawing()

    for (const connector of benchPrototypeContract.planningDrawing.connectorCoordinates) {
      expect(svg).toContain(
        `data-connector-id="${connector.id}" data-edge="${connector.edge}" data-x="${connector.x}" data-y="${connector.y}"`
      )
    }
    expect(svg).toContain("not a fabrication outline")
    expect(svg).toContain("no copper, plane, mounting, clearance, or fabrication credit")
  })
})
