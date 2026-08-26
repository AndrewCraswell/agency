import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  P0EthernetMagJackFootprint,
  P0Hub75Ahct245Footprint,
  P0Hub75ConnectorFootprint,
  P0Hub75EnableFetFootprint,
  P0W5500CrystalFootprint,
  p0DigitalPeripheralFootprintEvidence,
  p0EthernetMagJackFootprintEvidence,
  p0Hub75Ahct245FootprintEvidence,
  p0Hub75ConnectorFootprintEvidence,
  p0Hub75EnableFetFootprintEvidence,
  p0W5500FootprintEvidence,
  p0W5500CrystalFootprintEvidence,
  validateP0DigitalPeripheralFootprintEvidence
} from "./p0-digital-peripheral-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

function renderFootprints() {
  return renderTestCircuit(
    <board width="120mm" height="80mm">
      <P0EthernetMagJackFootprint pcbX={-40} pcbY={0} />
      <P0W5500CrystalFootprint pcbX={-20} pcbY={0} />
      <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_A" pcbX={0} pcbY={0} />
      <P0Hub75Ahct245Footprint reference="U_DISPLAY_BUFFER_B" pcbX={0} pcbY={15} />
      <P0Hub75EnableFetFootprint pcbX={15} pcbY={0} />
      <P0Hub75ConnectorFootprint pcbX={30} pcbY={0} />
    </board>
  )
}

type CircuitElement = ReturnType<typeof renderFootprints>[number]

function componentArtifacts(json: readonly CircuitElement[], reference: string): readonly CircuitElement[] {
  const source = json.find((element) => element.type === "source_component" && element.name === reference)
  if (source?.type !== "source_component") throw new RangeError(`missing source ${reference}`)
  const component = json.find(
    (element) => element.type === "pcb_component" && element.source_component_id === source.source_component_id
  )
  if (component?.type !== "pcb_component") throw new RangeError(`missing PCB component ${reference}`)
  return json.filter(
    (element) => "pcb_component_id" in element && element.pcb_component_id === component.pcb_component_id
  )
}

function retainedEvidenceHash(artifactPath: string): string {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("P0 digital peripheral placeable footprints", () => {
  it("keeps the exact populated identities, review state, and evidence gaps", () => {
    expect(validateP0DigitalPeripheralFootprintEvidence()).toBe(true)
    expect(p0DigitalPeripheralFootprintEvidence.references).toEqual([
      "U_W5500",
      "J_ETH",
      "Y_W5500",
      "U_DISPLAY_BUFFER_A",
      "U_DISPLAY_BUFFER_B",
      "Q_DISPLAY_ENABLE",
      "J_HUB75"
    ])
    expect(p0EthernetMagJackFootprintEvidence.manufacturerPartNumber).toBe("7499011121A")
    expect(p0W5500FootprintEvidence.manufacturerPartNumber).toBe("W5500")
    expect(p0W5500CrystalFootprintEvidence.manufacturerPartNumber).toBe("ECS-250-18-33B-JGN-TR")
    expect(p0Hub75Ahct245FootprintEvidence.manufacturerPartNumber).toBe("SN74AHCT245PWR")
    expect(p0Hub75EnableFetFootprintEvidence.manufacturerPartNumber).toBe("BSS138AKA")
    expect(p0Hub75ConnectorFootprintEvidence.manufacturerPartNumber).toBe("TST-108-04-G-D-RA")
    expect(p0DigitalPeripheralFootprintEvidence.genuineEvidenceGaps).toHaveLength(3)
    expect(p0DigitalPeripheralFootprintEvidence.placementState).toBe("approved")
    expect(p0DigitalPeripheralFootprintEvidence.placementReviewer).toBe("root-final-reviewer")
    expect(p0DigitalPeripheralFootprintEvidence.fabricationAuthority).toBe("deny")
    expect(Object.values(p0DigitalPeripheralFootprintEvidence.records).every((record) => record.release.accepted)).toBe(
      true
    )
  })

  it("binds each placeable footprint to the retained official source bytes", () => {
    const sources: readonly { readonly artifactPath: string; readonly sourceSha256: string }[] = [
      {
        artifactPath: p0W5500FootprintEvidence.source.artifactPath,
        sourceSha256: p0W5500FootprintEvidence.source.sourceSha256
      },
      {
        artifactPath: p0EthernetMagJackFootprintEvidence.source.artifactPath,
        sourceSha256: p0EthernetMagJackFootprintEvidence.source.sourceSha256
      },
      {
        artifactPath: p0W5500CrystalFootprintEvidence.source.artifactPath,
        sourceSha256: p0W5500CrystalFootprintEvidence.source.sourceSha256
      },
      {
        artifactPath: p0Hub75Ahct245FootprintEvidence.source.artifactPath,
        sourceSha256: p0Hub75Ahct245FootprintEvidence.source.sourceSha256
      },
      {
        artifactPath: p0Hub75EnableFetFootprintEvidence.source.artifactPath,
        sourceSha256: p0Hub75EnableFetFootprintEvidence.source.sourceSha256
      },
      {
        artifactPath: p0Hub75ConnectorFootprintEvidence.source.seriesPrintArtifactPath,
        sourceSha256: p0Hub75ConnectorFootprintEvidence.source.seriesPrintSha256
      },
      {
        artifactPath: p0Hub75ConnectorFootprintEvidence.source.productPageArtifactPath,
        sourceSha256: p0Hub75ConnectorFootprintEvidence.source.productPageSha256
      },
      {
        artifactPath: p0Hub75ConnectorFootprintEvidence.source.footprintPrintArtifactPath,
        sourceSha256: p0Hub75ConnectorFootprintEvidence.source.footprintPrintSha256
      },
      {
        artifactPath: p0Hub75ConnectorFootprintEvidence.source.orientationOverlayArtifactPath,
        sourceSha256: p0Hub75ConnectorFootprintEvidence.source.orientationOverlaySha256
      }
    ]
    for (const source of sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sourceSha256)
    }
    expect(p0EthernetMagJackFootprintEvidence.padMap).toHaveLength(16)
    expect(p0EthernetMagJackFootprintEvidence.padMap.filter((pad) => pad.kind === "plated-hole")).toHaveLength(14)
    expect(p0EthernetMagJackFootprintEvidence.padMap.filter((pad) => pad.kind === "non-plated-hole")).toHaveLength(2)
    expect(p0W5500CrystalFootprintEvidence.padMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "1", pcbX: -1.15, pcbY: 0.95 }),
        expect.objectContaining({ name: "3", pcbX: 1.15, pcbY: -0.95 })
      ])
    )
    expect(p0Hub75Ahct245FootprintEvidence.padMap).toHaveLength(20)
    expect(p0Hub75Ahct245FootprintEvidence.padMap[0]).toMatchObject({ pin: 1, pcbX: -3, pcbY: 2.925, heightMm: 0.45 })
    expect(p0Hub75EnableFetFootprintEvidence.padMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin: 1, pcbX: -0.95, pcbY: -0.7 }),
        expect.objectContaining({ pin: 3, pcbX: 0, pcbY: 0.7 })
      ])
    )
    expect(p0Hub75ConnectorFootprintEvidence.padMap).toHaveLength(16)
    expect(p0Hub75ConnectorFootprintEvidence.padMap[0]).toMatchObject({ pin: 1, pcbX: 0, pcbY: 0 })
  })

  it("fails closed when identity, source digest, pad map, or orientation evidence changes", () => {
    for (const mutate of [
      (candidate: any) => (candidate.references[0] = "U_W5500_PROJECT"),
      (candidate: any) => (candidate.records.w5500.source.sourceSha256 = "0".repeat(64)),
      (candidate: any) => (candidate.records.magJack.padMap[0].xMm = 0.01),
      (candidate: any) => (candidate.records.crystal.source.landPattern = "project-review-input"),
      (candidate: any) => (candidate.records.ahct245.padMap[0].heightMm = 0.35),
      (candidate: any) => (candidate.records.enableFet.placement.pinOne = "upper-left"),
      (candidate: any) => (candidate.records.hub75Connector.source.orientationDatum = "unknown")
    ]) {
      const candidate = structuredClone(p0DigitalPeripheralFootprintEvidence)
      mutate(candidate)
      expect(() => validateP0DigitalPeripheralFootprintEvidence(candidate)).toThrow(RangeError)
    }
  })

  it("renders the exact MagJack hole inventory and pin-one datum", () => {
    const artifacts = componentArtifacts(renderFootprints(), "J_ETH")
    expect(artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(14)
    expect(artifacts.filter((element) => element.type === "pcb_hole")).toHaveLength(2)
    const pinOne = artifacts.find(
      (element) => element.type === "pcb_plated_hole" && element.port_hints?.includes("TD_P")
    )
    expect(pinOne).toMatchObject({ x: -40, y: 0, shape: "circular_hole_with_rect_pad", hole_diameter: 0.9 })
    expect(artifacts.some((element) => element.type.endsWith("_error"))).toBe(false)
  })

  it("renders crystal pads with XI upper-left and XO lower-right", () => {
    const artifacts = componentArtifacts(renderFootprints(), "Y_W5500")
    const xi = artifacts.find((element) => element.type === "pcb_smtpad" && element.port_hints?.includes("XI"))
    const xo = artifacts.find((element) => element.type === "pcb_smtpad" && element.port_hints?.includes("XO"))
    expect(xi).toMatchObject({ x: -21.15, y: 0.95, width: 1.3, height: 1.1 })
    expect(xo).toMatchObject({ x: -18.85, y: -0.95, width: 1.3, height: 1.1 })
  })

  it("renders both AHCT245 buffers with all twenty copper pads and pin-one orientation", () => {
    const json = renderFootprints()
    for (const reference of ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"]) {
      const artifacts = componentArtifacts(json, reference)
      expect(artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(20)
      const pinOne = artifacts.find((element) => element.type === "pcb_smtpad" && element.port_hints?.includes("DIR"))
      expect(pinOne).toMatchObject({ width: 1.5, height: 0.45 })
    }
  })

  it("renders the BSS138 enable FET and keyed HUB75 header as placeable copper", () => {
    const json = renderFootprints()
    const fet = componentArtifacts(json, "Q_DISPLAY_ENABLE")
    expect(fet.filter((element) => element.type === "pcb_smtpad")).toHaveLength(3)
    expect(fet.find((element) => element.type === "pcb_smtpad" && element.port_hints?.includes("GATE"))).toMatchObject({
      x: 14.05,
      y: -0.7
    })

    const header = componentArtifacts(json, "J_HUB75")
    expect(header.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(16)
    expect(
      header.find((element) => element.type === "pcb_plated_hole" && element.port_hints?.includes("R1"))
    ).toMatchObject({ x: 30, y: 0, shape: "circular_hole_with_rect_pad" })
    expect(header.some((element) => element.type.endsWith("_error"))).toBe(false)
  })
})
