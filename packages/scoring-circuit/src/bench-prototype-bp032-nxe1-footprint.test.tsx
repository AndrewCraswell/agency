import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp032Nxe1FootprintGeometry,
  BenchPrototypeBp032Nxe1Footprint,
  validateBenchPrototypeBp032Nxe1FootprintGeometry
} from "./bench-prototype-bp032-nxe1-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const repoRoot = new URL("../../../", import.meta.url)

function inflatePdfStreams(bytes: Buffer) {
  let decoded = ""
  let cursor = 0
  while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
    const streamStart =
      bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
        ? cursor + 8
        : bytes[cursor + 6] === 10
          ? cursor + 7
          : cursor + 6
    const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
    if (streamEnd < 0) break
    try {
      decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
    } catch {
      // Non-content or uncompressed streams do not contribute to marker checks.
    }
    cursor = streamEnd + "endstream".length
  }
  return decoded
}

function render(component: React.ReactElement) {
  return renderTestCircuit(component)
}

function artifactsFor(component: React.ReactElement) {
  const json = render(component)
  const source = json.find((element) => element.type === "source_component" && element.name === "U_BP032_NXE1S0505MC")
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
  const ports = json.filter(
    (element) =>
      element.type === "source_port" &&
      source?.type === "source_component" &&
      element.source_component_id === source.source_component_id
  )
  return { courtyard, pads, paste, pcb, ports, source }
}

describe("BP-032 isolated Murata NXE1S0505MC footprint candidate", () => {
  it("binds the exact orderable, five source lands, package identity, and denied authority", () => {
    expect(validateBenchPrototypeBp032Nxe1FootprintGeometry()).toBe(true)
    expect(benchPrototypeBp032Nxe1FootprintGeometry).toMatchObject({
      accepted: false,
      exactIdentity: {
        manufacturer: "Murata Power Solutions",
        manufacturerPartNumber: "NXE1S0505MC"
      },
      fabricationAuthority: "deny",
      manufacturerCad: {
        authority: "deny",
        disposition: "not-acquired-no-substitute",
        state: "not-acquired"
      },
      package: {
        bodyMaximumMm: { length: 12.95, width: 10.66 },
        bodyNominalMm: { length: 12.7, width: 10.41 },
        heightMaximumMm: 4.8,
        pinCount: 14,
        pinPitchMm: 2.54
      },
      recommendedLandPattern: {
        outerColumnCenterSpanMm: 7.62,
        padLengthMm: 2.3,
        padWidthMm: 1,
        rowCenterSpanMm: 9.4,
        sourcePage: 6,
        status: "manufacturer-recommended-guidance-not-cad"
      },
      source: {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf",
        documentNumber: "KDC_NXE1.A01",
        reviewedPage: 6,
        sha256: "53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40"
      }
    })
    expect(benchPrototypeBp032Nxe1FootprintGeometry.terminals).toEqual([
      { function: "-Vin", pin: 1, portHint: "-Vin", role: "input-negative", xMm: -3.81, yMm: -4.7 },
      { function: "+Vin", pin: 3, portHint: "+Vin", role: "input-positive", xMm: -1.27, yMm: -4.7 },
      { function: "-Vout", pin: 7, portHint: "-Vout", role: "output-negative", xMm: 3.81, yMm: -4.7 },
      { function: "+Vout", pin: 8, portHint: "+Vout", role: "output-positive", xMm: 3.81, yMm: 4.7 },
      { function: "NA", pin: 14, portHint: "NA", role: "no-connect", xMm: -3.81, yMm: 4.7 }
    ])
  })

  it("hashes the retained M4-04 Murata PDF and preserves its source applicability", () => {
    const source = benchPrototypeBp032Nxe1FootprintGeometry.source
    const bytes = readFileSync(new URL(source.artifactPath, repoRoot))
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
    for (const marker of ["NXE1S0505MC", "KDC_NXE1.A01", "Mechanical Dimensions", "7.62", "12.70"]) {
      expect(pdfContent).toContain(marker)
    }
    expect(source.authority).toBe("manufacturer-primary")
    expect(benchPrototypeBp032Nxe1FootprintGeometry.sourceApplicability.recommendedFootprint).toEqual({
      sourcePage: 6,
      status: "manufacturer-recommended-guidance-not-cad"
    })
    expect(benchPrototypeBp032Nxe1FootprintGeometry.manufacturerCad.state).toBe("not-acquired")
    expect(benchPrototypeBp032Nxe1FootprintGeometry.orientation.state).toBe("pending-layout-review")
  })

  it("renders exactly five copper lands and five project-review mask, paste, and courtyard artifacts", () => {
    const { courtyard, pads, paste, pcb, ports, source } = artifactsFor(<BenchPrototypeBp032Nxe1Footprint />)
    expect(source).toMatchObject({ manufacturer_part_number: "NXE1S0505MC" })
    expect(pcb).toMatchObject({ do_not_place: false })
    expect(ports).toHaveLength(5)
    expect(pads).toHaveLength(5)
    expect(paste).toHaveLength(5)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ height: 2.3, soldermask_margin: 0.05, width: 1, x: -3.81, y: -4.7 }),
        expect.objectContaining({ height: 2.3, soldermask_margin: 0.05, width: 1, x: -1.27, y: -4.7 }),
        expect.objectContaining({ height: 2.3, soldermask_margin: 0.05, width: 1, x: 3.81, y: -4.7 }),
        expect.objectContaining({ height: 2.3, soldermask_margin: 0.05, width: 1, x: -3.81, y: 4.7 }),
        expect.objectContaining({ height: 2.3, soldermask_margin: 0.05, width: 1, x: 3.81, y: 4.7 })
      ])
    )
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 0.9, x: -3.81, y: -4.7 }),
        expect.objectContaining({ width: 0.9, x: -1.27, y: -4.7 }),
        expect.objectContaining({ width: 0.9, x: 3.81, y: -4.7 }),
        expect.objectContaining({ width: 0.9, x: -3.81, y: 4.7 }),
        expect.objectContaining({ width: 0.9, x: 3.81, y: 4.7 })
      ])
    )
    for (const pasteArtifact of paste) {
      if (!("height" in pasteArtifact)) throw new Error("Expected rectangular solder-paste artifacts")
      expect(pasteArtifact.height).toBeCloseTo(2.2, 10)
    }
    expect(courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, height: 12.2, width: 13.45 })])
    )
  })

  it("keeps the source-backed pin-one transform and all package gates visibly pending", () => {
    expect(benchPrototypeBp032Nxe1FootprintGeometry.orientation).toMatchObject({
      convention: "top-view-pin-one-upper-left",
      state: "pending-layout-review"
    })
    expect(benchPrototypeBp032Nxe1FootprintGeometry.orientation.note).toContain("180-degree review transform")
    expect(benchPrototypeBp032Nxe1FootprintGeometry.orientation.note).toContain("final PCB assembly orientation")
    expect(benchPrototypeBp032Nxe1FootprintGeometry.projectSelection.solderMask.status).toBe(
      "project-review-input-not-specified-by-murata"
    )
    expect(benchPrototypeBp032Nxe1FootprintGeometry.projectSelection.paste.status).toBe(
      "project-review-input-not-specified-by-murata"
    )
    expect(benchPrototypeBp032Nxe1FootprintGeometry.fabricationAuthority).toBe("deny")
  })

  it("rejects exact identity, pin-map, and fabrication-authority drift", () => {
    for (const mutate of [
      (candidate: any) => (candidate.exactIdentity.manufacturerPartNumber = "NXE1S0505MC-FORGED"),
      (candidate: any) => (candidate.fabricationAuthority = "allow"),
      (candidate: any) => (candidate.accepted = true),
      (candidate: any) => (candidate.terminals[4].function = "+Vout"),
      (candidate: any) => candidate.terminals.pop()
    ]) {
      const candidate = structuredClone(benchPrototypeBp032Nxe1FootprintGeometry)
      mutate(candidate)
      expect(() => validateBenchPrototypeBp032Nxe1FootprintGeometry(candidate)).toThrow(RangeError)
    }
  })
})
