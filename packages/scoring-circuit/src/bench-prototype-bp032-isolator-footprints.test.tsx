import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp032IsolatorFootprintGeometries,
  BenchPrototypeBp032Iso7721Footprint,
  BenchPrototypeBp032Iso7762Footprint,
  validateBenchPrototypeBp032IsolatorFootprintGeometries
} from "./bench-prototype-bp032-isolator-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

function render(component: React.ReactElement) {
  return renderTestCircuit(component)
}

function artifactsFor(component: React.ReactElement, name: string) {
  const json = render(component)
  const source = json.find((element) => element.type === "source_component" && element.name === name)
  const pcb = json.find(
    (element) =>
      element.type === "pcb_component" &&
      source?.type === "source_component" &&
      element.source_component_id === source.source_component_id
  )
  const pads = json.filter(
    (element) =>
      element.type === "pcb_smtpad" &&
      pcb?.type === "pcb_component" &&
      element.pcb_component_id === pcb.pcb_component_id
  )
  const paste = json.filter(
    (element) =>
      element.type === "pcb_solder_paste" &&
      pcb?.type === "pcb_component" &&
      element.pcb_component_id === pcb.pcb_component_id
  )
  const courtyard = json.filter(
    (element) =>
      element.type === "pcb_courtyard_rect" &&
      pcb?.type === "pcb_component" &&
      element.pcb_component_id === pcb.pcb_component_id
  )
  return { courtyard, pads, paste, pcb, source }
}

describe("BP-032 isolated TI isolator candidate footprints", () => {
  it("binds exactly ISO7762FDWR DW and ISO7721FDR D source identities and denies fabrication", () => {
    expect(validateBenchPrototypeBp032IsolatorFootprintGeometries()).toBe(true)
    expect(Object.values(benchPrototypeBp032IsolatorFootprintGeometries)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accepted: false,
          exactIdentity: expect.objectContaining({
            manufacturer: "Texas Instruments",
            manufacturerPartNumber: "ISO7762FDWR",
            package: "DW (SOIC-16 wide)"
          }),
          fabricationAuthority: "deny",
          manufacturerCad: expect.objectContaining({ authority: "deny", state: "not-acquired" }),
          package: expect.objectContaining({ bodyNominalMm: { length: 10.3, width: 7.5 }, pinPitchMm: 1.27 }),
          source: expect.objectContaining({
            artifactPath: "docs/evidence/bp-032/ti-iso7762.pdf",
            sha256: "FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22"
          })
        }),
        expect.objectContaining({
          accepted: false,
          exactIdentity: expect.objectContaining({
            manufacturer: "Texas Instruments",
            manufacturerPartNumber: "ISO7721FDR",
            package: "D (SOIC-8)"
          }),
          fabricationAuthority: "deny",
          manufacturerCad: expect.objectContaining({ authority: "deny", state: "not-acquired" }),
          package: expect.objectContaining({ bodyNominalMm: { length: 4.9, width: 3.91 }, pinPitchMm: 1.27 }),
          source: expect.objectContaining({
            artifactPath: "docs/evidence/bp-032/ti-iso7721.pdf",
            sha256: "FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C"
          })
        })
      ])
    )
  })

  it("hashes the retained official TI PDFs and records package geometry without claiming creepage approval", () => {
    for (const candidate of Object.values(benchPrototypeBp032IsolatorFootprintGeometries)) {
      const bytes = readFileSync(new URL(`../${candidate.source.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(candidate.source.sha256)
      expect(candidate.source.authority).toBe("manufacturer-primary")
      expect(candidate.sourceApplicability.hvIsolationLandPattern.status).toBe("manufacturer-example-not-cad")
      expect(candidate.manufacturerCad.disposition).toBe("not-acquired-no-substitute")
      expect(candidate.orientation.state).toBe("pending-layout-review")
      expect(candidate.orientation.note).toContain("pin 1")
      expect(candidate.orientation.note).toContain("final assembly orientation")
      expect(candidate.exactIdentity.officialProductUrl).toMatch(/^https:\/\/www\.ti\.com\/product\//u)
    }
    expect(benchPrototypeBp032IsolatorFootprintGeometries.iso7721).toMatchObject({
      source: { reviewedPages: [1, 5, 34, 35, 36, 37, 38, 41, 43] },
      sourceApplicability: {
        exactOrderable: {
          sourcePages: [37, 38, 41, 43],
          status: "manufacturer-specified-exact-orderable"
        },
        package: { sourcePages: [34, 35, 36, 37], status: "manufacturer-specified-package" },
        pinOne: { sourcePage: 5 }
      }
    })
    expect(benchPrototypeBp032IsolatorFootprintGeometries.iso7762).toMatchObject({
      source: { reviewedPages: [1, 4, 38, 42, 44, 45, 46, 47, 48] },
      sourceApplicability: {
        exactOrderable: {
          sourcePages: [38, 42, 44],
          status: "manufacturer-specified-exact-orderable"
        },
        package: { sourcePages: [45, 46, 47, 48], status: "manufacturer-specified-package" },
        pinOne: { sourcePage: 4 }
      }
    })
  })

  it("renders the ISO7762FDWR HV/isolation land example with 16 pads, pitch, mask, paste, and courtyard", () => {
    const { courtyard, pads, paste, pcb, source } = artifactsFor(
      <BenchPrototypeBp032Iso7762Footprint />,
      "U_BP032_ISO7762FDWR"
    )
    expect(source).toMatchObject({ manufacturer_part_number: "ISO7762FDWR" })
    expect(pcb).toMatchObject({ do_not_place: false })
    expect(pads).toHaveLength(16)
    expect(paste).toHaveLength(16)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 0.6,
          soldermask_margin: -0.07,
          width: 1.65,
          x: -4.875,
          y: -4.445
        }),
        expect.objectContaining({
          height: 0.6,
          soldermask_margin: -0.07,
          width: 1.65,
          x: 4.875,
          y: 4.445
        })
      ])
    )
    expect(pads.filter((pad) => pad.type === "pcb_smtpad" && "y" in pad && pad.y === -4.445)).toHaveLength(2)
    expect(courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, height: 9.99, width: 11.9 })])
    )
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ height: 0.6, width: 1.65, x: -4.875, y: -4.445 }),
        expect.objectContaining({ height: 0.6, width: 1.65, x: 4.875, y: 4.445 })
      ])
    )
  })

  it("renders the ISO7721FDR HV/isolation land example with 8 pads, pitch, mask, paste, and courtyard", () => {
    const { courtyard, pads, paste, pcb, source } = artifactsFor(
      <BenchPrototypeBp032Iso7721Footprint />,
      "U_BP032_ISO7721FDR"
    )
    expect(source).toMatchObject({ manufacturer_part_number: "ISO7721FDR" })
    expect(pcb).toMatchObject({ do_not_place: false })
    expect(pads).toHaveLength(8)
    expect(paste).toHaveLength(8)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          height: 0.6,
          soldermask_margin: -0.07,
          width: 1.4,
          x: -2.75,
          y: -1.905
        }),
        expect.objectContaining({
          height: 0.6,
          soldermask_margin: -0.07,
          width: 1.4,
          x: 2.75,
          y: 1.905
        })
      ])
    )
    expect(courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, height: 4.91, width: 7.4 })])
    )
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ height: 0.6, width: 1.4, x: -2.75, y: -1.905 }),
        expect.objectContaining({ height: 0.6, width: 1.4, x: 2.75, y: 1.905 })
      ])
    )
  })

  it("rejects candidate identity, artwork authority, and orientation drift", () => {
    for (const mutate of [
      (candidate: any) => (candidate.iso7762.exactIdentity.manufacturerPartNumber = "ISO7721FDR"),
      (candidate: any) => (candidate.iso7762.exactIdentity.manufacturerPartNumber = "ISO7762FDWR-FORGED"),
      (candidate: any) => (candidate.iso7721.fabricationAuthority = "allow"),
      (candidate: any) => (candidate.iso7762.accepted = true),
      (candidate: any) => (candidate.iso7721.orientation.state = "approved"),
      (candidate: any) => (candidate.iso7721.sourceApplicability.exactOrderable.sourcePages = [37]),
      (candidate: any) => (candidate.iso7762.sourceApplicability.pinOne.sourcePage = 5),
      (candidate: any) => (candidate.iso7762.source.artifactPath = "docs/evidence/bp-032/ti-iso7721.pdf"),
      (candidate: any) => candidate.iso7762.terminals.pop()
    ]) {
      const candidate = structuredClone(benchPrototypeBp032IsolatorFootprintGeometries)
      mutate(candidate)
      expect(() => validateBenchPrototypeBp032IsolatorFootprintGeometries(candidate)).toThrow(RangeError)
    }
  })
})
