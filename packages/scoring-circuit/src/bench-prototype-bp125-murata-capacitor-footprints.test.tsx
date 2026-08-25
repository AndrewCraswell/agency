import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp125MurataCapacitorFootprintGeometries,
  benchPrototypeBp125MurataCapacitorReviewBindings,
  benchPrototypeBp125MurataCapacitorFootprintNotes,
  BenchPrototypeBp125Murata0603CandidateFootprint,
  BenchPrototypeBp125Murata0805CandidateFootprint,
  BenchPrototypeBp125Murata1210CandidateFootprint,
  bp125MurataCapacitorFootprintIntegrityErrors
} from "./bench-prototype-bp125-murata-capacitor-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

type CandidateComponent = () => ReactElement
type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RectSmtPad = Extract<CircuitElement, { readonly type: "pcb_smtpad" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly soldermask_margin: number
}
type RectSolderPaste = Extract<CircuitElement, { readonly type: "pcb_solder_paste" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function renderedFootprint(Component: CandidateComponent) {
  return renderTestCircuit(<Component />)
}

function isRectSmtPad(element: CircuitElement): element is RectSmtPad {
  return (
    element.type === "pcb_smtpad" &&
    element.shape === "rect" &&
    "x" in element &&
    "y" in element &&
    "width" in element &&
    "height" in element &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number" &&
    typeof element.soldermask_margin === "number"
  )
}

function isRectSolderPaste(element: CircuitElement): element is RectSolderPaste {
  return (
    element.type === "pcb_solder_paste" &&
    element.shape === "rect" &&
    "x" in element &&
    "y" in element &&
    "width" in element &&
    "height" in element &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number"
  )
}

function smtPads(elements: readonly CircuitElement[]) {
  return elements.filter(isRectSmtPad)
}

function solderPastes(elements: readonly CircuitElement[]) {
  return elements.filter(isRectSolderPaste)
}

function courtyard(elements: readonly CircuitElement[]) {
  return elements.find(
    (element): element is Extract<CircuitElement, { readonly type: "pcb_courtyard_rect" }> =>
      element.type === "pcb_courtyard_rect"
  )
}

function renderedGeometryHash(Component: CandidateComponent) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderedFootprint(Component)) {
    if (element.type === "pcb_smtpad" && element.shape === "rect") {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_solder_paste" && element.shape === "rect") {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

function evidenceHash(artifactPath: string) {
  const relativeEvidencePath = artifactPath.replace("packages/scoring-circuit/", "../")
  return createHash("sha256")
    .update(readFileSync(new URL(relativeEvidencePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function upstreamSelectionHash() {
  return createHash("sha256")
    .update(readFileSync(new URL("./bench-prototype-processor-support.ts", import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function mutableGeometryGraph() {
  return structuredClone(benchPrototypeBp125MurataCapacitorFootprintGeometries)
}

function graphObjects(value: unknown, seen = new Set<object>()): Set<object> {
  if (typeof value !== "object" || value === null || seen.has(value)) return seen
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) graphObjects(descriptor.value, seen)
  }
  return seen
}

describe("BP-125 Murata MLCC candidate footprints", () => {
  it("binds every selected BP-125 Murata capacitor to exactly one package candidate without accepting it", () => {
    expect(benchPrototypeBp125MurataCapacitorFootprintGeometries).toMatchObject({
      "0603-1608m": {
        package: "0603 (1608M)",
        appliesTo: [
          { manufacturerPartNumber: "GCM188R71H103KA37D", references: ["C_STM_VDDA_HF"] },
          {
            manufacturerPartNumber: "GCM188R71H104KA57D",
            references: [
              "C_STM_VDD16",
              "C_STM_VDD32",
              "C_STM_VDD48",
              "C_STM_VDD64",
              "C_STM_VREF_HF",
              "C_STM_VBAT",
              "C_ESP_3V3_HF"
            ]
          }
        ]
      },
      "0805-2012m": {
        package: "0805 (2012M)",
        appliesTo: [
          { manufacturerPartNumber: "GCM21BR71E225KA73L", references: ["C_STM_VDDA_BULK", "C_STM_VREF_BULK"] }
        ]
      },
      "1210-3225m": {
        package: "1210 (3225M)",
        appliesTo: [
          { manufacturerPartNumber: "GCM32ER71E106KA57L", references: ["C_STM_3V3_BULK"] },
          { manufacturerPartNumber: "GCM32EC71A476KE02L", references: ["C_ESP_3V3_BULK"] }
        ]
      }
    })
    for (const geometry of Object.values(benchPrototypeBp125MurataCapacitorFootprintGeometries)) {
      expect(geometry.artifactKind).toBe("bp125-murata-mlcc-candidate-footprint")
      expect(geometry.workUnit).toBe("BP-125")
      expect(geometry.manufacturerCad).toEqual({ state: "not-acquired", authority: "deny" })
      expect(geometry.sourceApplicability).toMatchObject({
        selectedMpnMapping: {
          sourcePath: "packages/scoring-circuit/src/bench-prototype-processor-support.ts",
          baselineCommit: "7a3566b",
          currentSourceSha256: "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20",
          disposition: "fixed-upstream-selection"
        },
        reflowLandPattern: {
          sourceId: "murata-gcm-series-land-dimensions",
          reviewedPage: 25,
          sourceTable: "Table 2 Reflow Soldering Method",
          appliesTo: "all-selected-mpns-in-package-code",
          disposition: "project-review-input-not-manufacturer-cad"
        }
      })
      expect(upstreamSelectionHash()).toBe(geometry.sourceApplicability.selectedMpnMapping.currentSourceSha256)
      expect(geometry.fabricationAuthority).toBe("deny")
      expect(geometry.accepted).toBe(false)
      expect(geometry.exactMpnEvidence.map((evidence) => evidence.manufacturerPartNumber)).toEqual(
        geometry.appliesTo.map((selection) => selection.manufacturerPartNumber)
      )
      expect(geometry.sources[0]).toMatchObject({
        documentNumber: "JEMCGC-2702S",
        reviewedPage: 25,
        sha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19"
      })
      for (const evidence of geometry.exactMpnEvidence) {
        expect(evidence.status).toBe("retained")
        expect(evidence.officialProductDetailUrl).toContain(evidence.manufacturerPartNumber)
        expect(evidence.cadAudit).toMatchObject({
          auditedAt: "2026-08-24",
          officialCadDataUrl: "https://www.murata.com/en-global/tool/data/caddata",
          availability: "not-confirmed",
          disposition: "not-acquired-no-substitute"
        })
        expect(evidence.sha256).toMatch(/^[0-9A-F]{64}$/u)
        expect(evidenceHash(evidence.artifactPath)).toBe(evidence.sha256)
      }
    }
    expect(
      Object.values(benchPrototypeBp125MurataCapacitorFootprintGeometries).flatMap((geometry) =>
        geometry.exactMpnEvidence.map((evidence) => evidence.manufacturerPartNumber)
      )
    ).toEqual([
      "GCM188R71H103KA37D",
      "GCM188R71H104KA57D",
      "GCM21BR71E225KA73L",
      "GCM32ER71E106KA57L",
      "GCM32EC71A476KE02L"
    ])
    expect(benchPrototypeBp125MurataCapacitorReviewBindings).toHaveLength(12)
    expect(
      benchPrototypeBp125MurataCapacitorReviewBindings.map(({ manufacturerPartNumber, reference }) => [
        manufacturerPartNumber,
        reference
      ])
    ).toEqual([
      ["GCM188R71H103KA37D", "C_STM_VDDA_HF"],
      ["GCM188R71H104KA57D", "C_STM_VDD16"],
      ["GCM188R71H104KA57D", "C_STM_VDD32"],
      ["GCM188R71H104KA57D", "C_STM_VDD48"],
      ["GCM188R71H104KA57D", "C_STM_VDD64"],
      ["GCM188R71H104KA57D", "C_STM_VREF_HF"],
      ["GCM188R71H104KA57D", "C_STM_VBAT"],
      ["GCM188R71H104KA57D", "C_ESP_3V3_HF"],
      ["GCM21BR71E225KA73L", "C_STM_VDDA_BULK"],
      ["GCM21BR71E225KA73L", "C_STM_VREF_BULK"],
      ["GCM32ER71E106KA57L", "C_STM_3V3_BULK"],
      ["GCM32EC71A476KE02L", "C_ESP_3V3_BULK"]
    ])
    expect(
      benchPrototypeBp125MurataCapacitorReviewBindings.every(
        (binding) => binding.footprintEvidenceState === "not-started"
      )
    ).toBe(true)
    expect(
      benchPrototypeBp125MurataCapacitorReviewBindings.every(
        (binding) => binding.landGuidanceScope === "common-gc-family-package-code"
      )
    ).toBe(true)
    expect(benchPrototypeBp125MurataCapacitorFootprintNotes.candidateSourceNote).toContain("no entry asserts exact-MPN")
    expect(benchPrototypeBp125MurataCapacitorFootprintNotes.candidateSourceNote).toContain(
      "exactly 12 BP-032 references"
    )
  })

  it.each([
    ["0603-1608m", BenchPrototypeBp125Murata0603CandidateFootprint],
    ["0805-2012m", BenchPrototypeBp125Murata0805CandidateFootprint],
    ["1210-3225m", BenchPrototypeBp125Murata1210CandidateFootprint]
  ] as const)(
    "derives copper, mask, paste, and courtyard geometry within Murata's %s reflow range",
    (key, Component) => {
      const geometry = benchPrototypeBp125MurataCapacitorFootprintGeometries[key]
      const { manufacturerLandPattern, projectSelection } = geometry
      const elements = renderedFootprint(Component)
      const pads = smtPads(elements).toSorted((left, right) => left.x - right.x)
      const paste = solderPastes(elements).toSorted((left, right) => left.x - right.x)
      const renderedCourtyard = courtyard(elements)

      expect(pads).toHaveLength(2)
      expect(paste).toHaveLength(2)
      expect(renderedCourtyard).toBeDefined()
      if (pads.length !== 2 || paste.length !== 2 || renderedCourtyard === undefined) return

      const copperXMinimumMm = pads[0].x - pads[0].width / 2
      const copperXMaximumMm = pads[1].x + pads[1].width / 2
      const copperInnerGapMm = pads[1].x - pads[1].width / 2 - (pads[0].x + pads[0].width / 2)
      const copperOverallSpanMm = copperXMaximumMm - copperXMinimumMm
      const copperYExtentMm = Math.max(...pads.map((pad) => pad.height))
      const courtyardCopperXClearanceMm = (renderedCourtyard.width - copperOverallSpanMm) / 2
      const courtyardCopperYClearanceMm = (renderedCourtyard.height - copperYExtentMm) / 2
      const courtyardBodyXClearanceMm =
        (renderedCourtyard.width - geometry.sourceApplicability.packageBody.lengthMm) / 2
      const courtyardBodyYClearanceMm =
        (renderedCourtyard.height - geometry.sourceApplicability.packageBody.widthMm) / 2

      expect(projectSelection.copperPad.lengthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.padLengthMm.minimum)
      expect(projectSelection.copperPad.lengthMm).toBeLessThanOrEqual(manufacturerLandPattern.padLengthMm.maximum)
      expect(projectSelection.copperPad.widthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.padWidthMm.minimum)
      expect(projectSelection.copperPad.widthMm).toBeLessThanOrEqual(manufacturerLandPattern.padWidthMm.maximum)
      expect(projectSelection.innerGapMm).toBeGreaterThanOrEqual(manufacturerLandPattern.innerGapMm.minimum)
      expect(projectSelection.innerGapMm).toBeLessThanOrEqual(manufacturerLandPattern.innerGapMm.maximum)
      expect(projectSelection.overallCopperSpanMm).toBeCloseTo(
        projectSelection.innerGapMm + 2 * projectSelection.copperPad.lengthMm,
        10
      )
      expect(projectSelection.copperPadCenterXMm).toBeCloseTo(
        (projectSelection.innerGapMm + projectSelection.copperPad.lengthMm) / 2,
        10
      )
      expect(projectSelection.solderMask.openingLengthMm).toBeCloseTo(
        projectSelection.copperPad.lengthMm + 2 * projectSelection.solderMask.marginMm,
        10
      )
      expect(projectSelection.paste.openingWidthMm).toBeCloseTo(
        projectSelection.copperPad.widthMm - 2 * projectSelection.paste.reductionPerEdgeMm,
        10
      )
      expect(projectSelection.courtyard.lengthMm).toBeGreaterThanOrEqual(
        Math.max(projectSelection.overallCopperSpanMm, geometry.sourceApplicability.packageBody.lengthMm) +
          2 * projectSelection.courtyard.minimumClearanceMm
      )
      expect(projectSelection.courtyard.widthMm).toBeGreaterThanOrEqual(
        Math.max(projectSelection.copperPad.widthMm, geometry.sourceApplicability.packageBody.widthMm) +
          2 * projectSelection.courtyard.minimumClearanceMm
      )

      expect(pads.map((pad) => pad.x)).toEqual([
        -projectSelection.copperPadCenterXMm,
        projectSelection.copperPadCenterXMm
      ])
      expect(pads.map((pad) => pad.width)).toEqual([
        projectSelection.copperPad.lengthMm,
        projectSelection.copperPad.lengthMm
      ])
      expect(pads.map((pad) => pad.height)).toEqual([
        projectSelection.copperPad.widthMm,
        projectSelection.copperPad.widthMm
      ])
      expect(pads.map((pad) => pad.soldermask_margin)).toEqual([
        projectSelection.solderMask.marginMm,
        projectSelection.solderMask.marginMm
      ])
      expect(copperXMinimumMm).toBeCloseTo(-projectSelection.overallCopperSpanMm / 2, 10)
      expect(copperXMaximumMm).toBeCloseTo(projectSelection.overallCopperSpanMm / 2, 10)
      expect(copperInnerGapMm).toBeCloseTo(projectSelection.innerGapMm, 10)
      expect(copperOverallSpanMm).toBeCloseTo(projectSelection.overallCopperSpanMm, 10)
      expect(copperYExtentMm).toBeCloseTo(projectSelection.copperPad.widthMm, 10)
      for (const pad of pads) {
        expect(pad.width + 2 * pad.soldermask_margin).toBeCloseTo(projectSelection.solderMask.openingLengthMm)
        expect(pad.height + 2 * pad.soldermask_margin).toBeCloseTo(projectSelection.solderMask.openingWidthMm)
      }
      expect(paste.map((aperture) => aperture.x)).toEqual(pads.map((pad) => pad.x))
      expect(paste.map((aperture) => aperture.y)).toEqual(pads.map((pad) => pad.y))
      for (const aperture of paste) {
        expect(aperture.width).toBeCloseTo(projectSelection.paste.openingLengthMm)
        expect(aperture.height).toBeCloseTo(projectSelection.paste.openingWidthMm)
      }
      expect(renderedCourtyard).toMatchObject({
        center: { x: 0, y: 0 },
        width: projectSelection.courtyard.lengthMm,
        height: projectSelection.courtyard.widthMm
      })
      expect(courtyardCopperXClearanceMm).toBeGreaterThanOrEqual(projectSelection.courtyard.minimumClearanceMm)
      expect(courtyardCopperYClearanceMm).toBeGreaterThanOrEqual(projectSelection.courtyard.minimumClearanceMm)
      expect(courtyardBodyXClearanceMm).toBeGreaterThanOrEqual(projectSelection.courtyard.minimumClearanceMm)
      expect(courtyardBodyYClearanceMm).toBeGreaterThanOrEqual(projectSelection.courtyard.minimumClearanceMm)
    }
  )

  it("keeps terminal orientation and capacitor stress review open", () => {
    for (const geometry of Object.values(benchPrototypeBp125MurataCapacitorFootprintGeometries)) {
      expect(geometry.terminals).toEqual([
        expect.objectContaining({
          pad: "1",
          terminal: "A",
          polarity: "non-polar",
          xMm: -geometry.projectSelection.copperPadCenterXMm
        }),
        expect.objectContaining({
          pad: "2",
          terminal: "B",
          polarity: "non-polar",
          xMm: geometry.projectSelection.copperPadCenterXMm
        })
      ])
      expect(geometry.orientation.state).toBe("pending-layout-review")
      expect(geometry.stressReview.state).toBe("pending-layout-and-assembly-review")
      expect(geometry.stressReview.note).toContain("board-flex")
    }
  })

  it("keeps the public geometry and binding graphs recursively frozen and independent", () => {
    const geometryObjects = graphObjects(benchPrototypeBp125MurataCapacitorFootprintGeometries)
    const bindingObjects = graphObjects(benchPrototypeBp125MurataCapacitorReviewBindings)

    for (const value of [...geometryObjects, ...bindingObjects]) expect(Object.isFrozen(value)).toBe(true)
    for (const value of bindingObjects) expect(geometryObjects.has(value)).toBe(false)
    expect(benchPrototypeBp125MurataCapacitorReviewBindings).not.toBe(
      benchPrototypeBp125MurataCapacitorFootprintGeometries
    )
    expect(() =>
      Object.defineProperty(benchPrototypeBp125MurataCapacitorFootprintGeometries, "unexpected", {
        value: true
      })
    ).toThrow()
    expect(() =>
      Object.defineProperty(benchPrototypeBp125MurataCapacitorReviewBindings[0], "unexpected", {
        value: true
      })
    ).toThrow()
    expect(bp125MurataCapacitorFootprintIntegrityErrors()).toEqual([])
  })

  it.each([
    [
      "accessors",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Object.defineProperty(graph["0603-1608m"], "package", {
          configurable: true,
          enumerable: true,
          get: () => "0603 (1608M)"
        })
      },
      "accessors are not permitted"
    ],
    [
      "symbols and hidden fields",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Object.defineProperty(graph["0603-1608m"], Symbol("hidden"), { value: true })
      },
      "unexpected or hidden field"
    ],
    [
      "sparse arrays",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Reflect.deleteProperty(graph["0603-1608m"].appliesTo, "0")
      },
      "missing field or sparse array entry"
    ],
    [
      "prototypes",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Object.setPrototypeOf(graph["0603-1608m"], { unexpected: true })
      },
      "prototype drifted"
    ],
    [
      "aliases",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Reflect.set(graph, "0805-2012m", graph["0603-1608m"])
      },
      "actual graph aliases or cycles"
    ],
    [
      "cycles",
      (graph: ReturnType<typeof mutableGeometryGraph>) => {
        Reflect.set(graph["0603-1608m"].appliesTo[0], "references", graph)
      },
      "actual graph aliases or cycles"
    ]
  ] as const)("fails closed on %s in the candidate graph", (_name, mutate, expectedError) => {
    const graph = mutableGeometryGraph()
    mutate(graph)
    const errors = bp125MurataCapacitorFootprintIntegrityErrors(graph)
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining(expectedError)]))
  })

  it("fails closed when a candidate graph proxy traps inspection", () => {
    const proxy = new Proxy(mutableGeometryGraph(), {
      ownKeys: () => {
        throw new Error("inspection trap")
      }
    })
    const errors = bp125MurataCapacitorFootprintIntegrityErrors(
      proxy as unknown as typeof benchPrototypeBp125MurataCapacitorFootprintGeometries
    )
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("proxies are not permitted")]))
  })

  it("rejects selection, source, gate, and courtyard drift before an artifact could be reused", () => {
    expect(bp125MurataCapacitorFootprintIntegrityErrors()).toEqual([])

    const packageDrift = {
      ...benchPrototypeBp125MurataCapacitorFootprintGeometries,
      "1210-3225m": {
        ...benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"],
        package: benchPrototypeBp125MurataCapacitorFootprintGeometries["0805-2012m"].package,
        packageCode: benchPrototypeBp125MurataCapacitorFootprintGeometries["0805-2012m"].packageCode
      }
    }
    expect(bp125MurataCapacitorFootprintIntegrityErrors(packageDrift)).toContain(
      "1210-3225m package identity does not match its expected candidate geometry"
    )

    const selectionDrift = {
      ...benchPrototypeBp125MurataCapacitorFootprintGeometries,
      "0603-1608m": {
        ...benchPrototypeBp125MurataCapacitorFootprintGeometries["0603-1608m"],
        appliesTo: benchPrototypeBp125MurataCapacitorFootprintGeometries["0805-2012m"].appliesTo
      }
    }
    expect(bp125MurataCapacitorFootprintIntegrityErrors(selectionDrift)).toEqual(
      expect.arrayContaining([
        "GCM21BR71E225KA73L maps to 0603-1608m, not 0805-2012m",
        "GCM188R71H103KA37D must map exactly once to 0603-1608m",
        "GCM188R71H104KA57D must map exactly once to 0603-1608m"
      ])
    )

    const courtyardDrift = {
      ...benchPrototypeBp125MurataCapacitorFootprintGeometries,
      "1210-3225m": {
        ...benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"],
        projectSelection: {
          ...benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"].projectSelection,
          courtyard: {
            ...benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"].projectSelection.courtyard,
            widthMm: 2.99
          }
        }
      }
    }
    expect(bp125MurataCapacitorFootprintIntegrityErrors(courtyardDrift)).toContain(
      "1210-3225m courtyard width does not enclose copper/body plus its stated clearance"
    )

    const referenceDrift = {
      ...benchPrototypeBp125MurataCapacitorFootprintGeometries,
      "0603-1608m": {
        ...benchPrototypeBp125MurataCapacitorFootprintGeometries["0603-1608m"],
        appliesTo: benchPrototypeBp125MurataCapacitorFootprintGeometries["0603-1608m"].appliesTo.map((selection) =>
          selection.manufacturerPartNumber === "GCM188R71H104KA57D"
            ? { ...selection, references: [...selection.references, "C_STM_VDDA_HF"] }
            : selection
        )
      }
    }
    expect(bp125MurataCapacitorFootprintIntegrityErrors(referenceDrift)).toEqual(
      expect.arrayContaining([
        "GCM188R71H104KA57D reference binding does not match the frozen BP-125 rows",
        "C_STM_VDDA_HF must map exactly once to GCM188R71H103KA37D"
      ])
    )

    const evidenceDrift = {
      ...benchPrototypeBp125MurataCapacitorFootprintGeometries,
      "1210-3225m": {
        ...benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"],
        exactMpnEvidence: benchPrototypeBp125MurataCapacitorFootprintGeometries["1210-3225m"].exactMpnEvidence.map(
          (evidence) =>
            evidence.manufacturerPartNumber === "GCM32ER71E106KA57L"
              ? { ...evidence, evidenceKind: "exact-mpn-reference-sheet" as const }
              : evidence
        )
      }
    }
    expect(bp125MurataCapacitorFootprintIntegrityErrors(evidenceDrift)).toContain(
      "GCM32ER71E106KA57L exact retained evidence binding drifted"
    )

    const releaseBoundaryDrift = mutableGeometryGraph()
    Reflect.set(
      releaseBoundaryDrift["0603-1608m"].sourceApplicability.selectedMpnMapping,
      "currentSourceSha256",
      "stale-source-hash"
    )
    Reflect.set(releaseBoundaryDrift["0603-1608m"].manufacturerCad, "authority", "allow")
    Reflect.set(releaseBoundaryDrift["0603-1608m"], "fabricationAuthority", "allow")
    Reflect.set(releaseBoundaryDrift["0603-1608m"], "accepted", true)
    Reflect.set(releaseBoundaryDrift["0603-1608m"].projectSelection.copperPad, "lengthMm", 0.2)
    expect(bp125MurataCapacitorFootprintIntegrityErrors(releaseBoundaryDrift)).toEqual(
      expect.arrayContaining([
        "0603-1608m source applicability does not bind the retained Murata reflow guide",
        "0603-1608m must remain review-only and denied for fabrication",
        expect.stringContaining("value drifted")
      ])
    )
  })

  it("hashes the canonical rendered candidate geometry", () => {
    expect(renderedGeometryHash(BenchPrototypeBp125Murata0603CandidateFootprint)).toBe(
      "55347ac3a5ff2c12ad1b1cf6ec2c090225af534fd9d5099ec54befa89c2fab30"
    )
    expect(renderedGeometryHash(BenchPrototypeBp125Murata0805CandidateFootprint)).toBe(
      "c4ff81b661aef3d2c68983c17c4e4a3a38a34e9e591fc1566da468eabc5150f2"
    )
    expect(renderedGeometryHash(BenchPrototypeBp125Murata1210CandidateFootprint)).toBe(
      "dff63020fb2b558bdd344fea06f424247c7f2abef648820718541acc62bd570c"
    )
  })
})
