import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033MurataGrm188r71c104ka01dW5500BypassFootprint,
  Bp033MurataGrm188r71c104ka01dW5500BypassFootprint,
  validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint,
  validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry
} from "./bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function hashArtifact(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return createHash("sha256")
    .update(readFileSync(new URL(`../${packageRelativePath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function hashSource(sourcePath: string) {
  const packageRelativePath = sourcePath.replace("packages/scoring-circuit/", "")
  return createHash("sha256")
    .update(readFileSync(new URL(`../${packageRelativePath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)) {
    if (isRectSmtPad(element) || isRectSolderPaste(element)) {
      if (isRectSmtPad(element)) {
        geometry.push({
          type: element.type,
          layer: element.layer,
          shape: element.shape,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          portHints: element.port_hints,
          isCoveredWithSolderMask: element.is_covered_with_solder_mask,
          soldermaskMarginMm: element.soldermask_margin
        })
      } else {
        geometry.push({
          type: element.type,
          layer: element.layer,
          shape: element.shape,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        })
      }
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({
        type: element.type,
        layer: element.layer,
        shape: "rect",
        centerMm: element.center,
        width: element.width,
        height: element.height
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

type RenderedPathSegment = string | number

function collectPrimitivePaths(
  value: unknown,
  path: readonly RenderedPathSegment[] = [],
  active = new WeakSet<object>()
): readonly (readonly RenderedPathSegment[])[] {
  if (value === null || typeof value !== "object") return [path]
  if (active.has(value)) return []
  active.add(value)
  const paths: (readonly RenderedPathSegment[])[] = []
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || key === "length") continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor))
      throw new Error(`Unexpected accessor at ${path.join(".")}`)
    paths.push(...collectPrimitivePaths(descriptor.value, [...path, Array.isArray(value) ? Number(key) : key], active))
  }
  active.delete(value)
  return paths
}

function driftPrimitiveAtPath(root: unknown, path: readonly RenderedPathSegment[]): void {
  if (path.length === 0) throw new Error("Cannot drift the render root")
  let cursor: unknown = root
  for (const segment of path.slice(0, -1)) {
    if (cursor === null || typeof cursor !== "object") throw new Error(`Invalid render path ${path.join(".")}`)
    const descriptor = Object.getOwnPropertyDescriptor(cursor, String(segment))
    if (descriptor === undefined || !("value" in descriptor)) throw new Error(`Invalid render path ${path.join(".")}`)
    cursor = descriptor.value
  }
  if (cursor === null || typeof cursor !== "object") throw new Error(`Invalid render path ${path.join(".")}`)
  const key = String(path[path.length - 1])
  const descriptor = Object.getOwnPropertyDescriptor(cursor, key)
  if (descriptor === undefined || !("value" in descriptor)) throw new Error(`Invalid render path ${path.join(".")}`)
  const value = descriptor.value
  const drifted =
    value === null || value === undefined
      ? "drifted-nullish"
      : typeof value === "number"
        ? value + 1
        : typeof value === "boolean"
          ? !value
          : `${value}-drifted`
  Reflect.set(cursor, key, drifted)
}

describe("BP-033 Murata GRM188R71C104KA01D W5500 bypass review footprint", () => {
  it("binds all eight exact W5500 bypass references to the retained official source", () => {
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint()).toEqual([])
    expect(bp033MurataGrm188r71c104ka01dW5500BypassFootprint.sourceBinding.exactReferences).toEqual([
      "C_ETH_AVDD_FERRITE_INPUT",
      "C_W5500_VDD",
      "C_W5500_AVDD_1",
      "C_W5500_AVDD_2",
      "C_W5500_AVDD_3",
      "C_W5500_AVDD_4",
      "C_W5500_AVDD_5",
      "C_W5500_AVDD_6"
    ])
    const source = bp033MurataGrm188r71c104ka01dW5500BypassFootprint.sources[0]
    expect(hashArtifact(source.artifactPath)).toBe(source.sha256)
    expect(hashSource(bp033MurataGrm188r71c104ka01dW5500BypassFootprint.sourceBinding.canonicalSourcePath)).toBe(
      bp033MurataGrm188r71c104ka01dW5500BypassFootprint.sourceBinding.canonicalSourceSha256
    )
  })

  it("retains Murata 0603 package limits and keeps the chosen geometry within reflow guidance", () => {
    const { manufacturerLandPattern: guidance, projectSelection: selection } =
      bp033MurataGrm188r71c104ka01dW5500BypassFootprint
    expect(guidance).toMatchObject({
      reviewedPage: 26,
      innerGapMm: { minimum: 0.6, maximum: 0.8 },
      padLengthMm: { minimum: 0.6, maximum: 0.7 },
      padWidthMm: { minimum: 0.6, maximum: 0.8 }
    })
    expect(selection).toMatchObject({
      copperPad: { lengthMm: 0.65, widthMm: 0.7 },
      derivedCopperPadGapMm: 0.7,
      derivedCopperPadCenterXMm: 0.675,
      solderMask: { openingLengthMm: 0.75, openingWidthMm: 0.8, status: "project-review-input" },
      paste: { openingLengthMm: 0.55, openingWidthMm: 0.6, status: "project-review-input" },
      courtyard: { lengthMm: 2.5, widthMm: 1.3, minimumClearanceMm: 0.25, status: "project-review-input" }
    })
  })

  it("renders project review geometry only, with two non-polar pads and no errors", () => {
    const json = renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(json)).toEqual([])
    expect(json.filter(isRectSmtPad).map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: -0.675, y: 0, width: 0.65, height: 0.7 },
      { x: 0.675, y: 0, width: 0.65, height: 0.7 }
    ])
    expect(json.filter(isRectSolderPaste).map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: -0.675, y: 0, width: 0.55, height: 0.6 },
      { x: 0.675, y: 0, width: 0.55, height: 0.6 }
    ])
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, height: 1.3, type: "pcb_courtyard_rect", width: 2.5 })
    ])
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("pins the full rendered inventory and target metadata", () => {
    const json = renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)
    expect(json.map(({ type }) => type)).toEqual([
      "source_group",
      "source_port",
      "source_port",
      "source_component",
      "source_refdes_convention_warning",
      "source_component_internal_connection",
      "source_component_internal_connection",
      "pcb_component",
      "pcb_group",
      "pcb_smtpad",
      "pcb_solder_paste",
      "pcb_smtpad",
      "pcb_solder_paste",
      "pcb_courtyard_rect",
      "pcb_port",
      "pcb_port",
      "cad_component"
    ])
    expect(
      json.filter(isRectSmtPad).map((element) => ({
        type: element.type,
        layer: element.layer,
        shape: element.shape,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        portHints: element.port_hints,
        isCoveredWithSolderMask: element.is_covered_with_solder_mask,
        soldermaskMarginMm: element.soldermask_margin
      }))
    ).toEqual([
      {
        type: "pcb_smtpad",
        layer: "top",
        shape: "rect",
        x: -0.675,
        y: 0,
        width: 0.65,
        height: 0.7,
        portHints: ["1", "A", "non-polar", "terminal-a"],
        isCoveredWithSolderMask: false,
        soldermaskMarginMm: 0.05
      },
      {
        type: "pcb_smtpad",
        layer: "top",
        shape: "rect",
        x: 0.675,
        y: 0,
        width: 0.65,
        height: 0.7,
        portHints: ["2", "B", "non-polar", "terminal-b"],
        isCoveredWithSolderMask: false,
        soldermaskMarginMm: 0.05
      }
    ])
    expect(
      json.filter(isRectSolderPaste).map((element) => ({
        type: element.type,
        layer: element.layer,
        shape: element.shape,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      }))
    ).toEqual([
      { type: "pcb_solder_paste", layer: "top", shape: "rect", x: -0.675, y: 0, width: 0.55, height: 0.6 },
      { type: "pcb_solder_paste", layer: "top", shape: "rect", x: 0.675, y: 0, width: 0.55, height: 0.6 }
    ])
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([
      expect.objectContaining({
        type: "pcb_courtyard_rect",
        layer: "top",
        center: { x: 0, y: 0 },
        width: 2.5,
        height: 1.3
      })
    ])
  })

  it("rejects a full primitive mutation sweep across all 17 rendered elements", () => {
    const rendered = renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)
    const primitivePaths = rendered.flatMap((element, index) => collectPrimitivePaths(element, [index]))
    expect(primitivePaths.length).toBeGreaterThan(100)
    for (const path of primitivePaths) {
      const mutated = structuredClone(rendered)
      driftPrimitiveAtPath(mutated, path)
      expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(mutated)).not.toEqual([])
    }
  })

  it("binds the generated review geometry hash while denying CAD, board integration, fabrication, and release", () => {
    const expectedArtworkSha256 = "EEB50A5C36D394B767EAADC5256C8B837DA9AE455AE9F4BCB8BD008D846A1E0A"
    expect(renderedGeometryHash()).toBe(expectedArtworkSha256)
    expect(bp033MurataGrm188r71c104ka01dW5500BypassFootprint.artwork.sha256).toBe(expectedArtworkSha256)
    expect(bp033MurataGrm188r71c104ka01dW5500BypassFootprint).toMatchObject({
      manufacturerCad: { state: "not-acquired", authority: "deny", retainedArtifactPath: null, sha256: null },
      boardIntegration: false,
      fabricationAuthority: "deny",
      releaseState: "deny",
      accepted: false
    })
  })

  it("fails closed if source, artwork, geometry, CAD state, or release state drifts", () => {
    const referenceDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(referenceDrift.sourceBinding, "exactReferences", ["C_W5500_VDD"])
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(referenceDrift)).toContain(
      "canonical W5500 bypass reference binding drifted"
    )
    const geometryDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(geometryDrift.projectSelection.paste, "openingLengthMm", 0.56)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(geometryDrift)).toContain(
      "Murata reflow guidance or derived review geometry drifted"
    )
    const sourcePageDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourcePageDrift.sources[0], "reviewedPages", "1, 25")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourcePageDrift)).toContain(
      "exact retained Murata GRM188R71C104KA01 source is required"
    )
    const sourceHashDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourceHashDrift.sources[0], "sha256", "0".repeat(64))
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceHashDrift)).toContain(
      "exact retained Murata GRM188R71C104KA01 source is required"
    )
    const sourceRoleDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourceRoleDrift.sources[0], "role", "generic capacitor source")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceRoleDrift)).toContain(
      "exact retained Murata GRM188R71C104KA01 source is required"
    )
    const sourceUrlDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourceUrlDrift.sources[0], "url", "https://example.invalid/generic-0603.pdf")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceUrlDrift)).toContain(
      "exact retained Murata GRM188R71C104KA01 source is required"
    )
    const artworkDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(artworkDrift.artwork, "representation", "manufacturer-cad")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(artworkDrift)).toContain(
      "manufacturer CAD, board integration, fabrication, and release must remain fail-closed"
    )
    const artworkHashDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(artworkHashDrift.artwork, "sha256", "0".repeat(64))
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(artworkHashDrift)).toContain(
      "manufacturer CAD, board integration, fabrication, and release must remain fail-closed"
    )
    const renderedCoordinateDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(renderedCoordinateDrift.renderedGeometry.pads[0], "xMm", -0.67)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(renderedCoordinateDrift)).toContain(
      "Murata reflow guidance or derived review geometry drifted"
    )
    const cadDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(cadDrift.manufacturerCad, "state", "acquired")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(cadDrift)).toContain(
      "manufacturer CAD, board integration, fabrication, and release must remain fail-closed"
    )
    const releaseDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(releaseDrift, "accepted", true)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(releaseDrift)).toContain(
      "manufacturer CAD, board integration, fabrication, and release must remain fail-closed"
    )
  })

  it("rejects adversarial added, removed, coordinate, and shape render geometry", () => {
    const rendered = renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)
    const smtPad = rendered.find((element) => element.type === "pcb_smtpad")
    if (smtPad === undefined) throw new Error("canonical render must contain an SMT pad")

    const added = structuredClone(rendered)
    added.push(structuredClone(smtPad))
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(added)).toContain(
      "rendered W5500 bypass geometry has added or removed elements"
    )

    const removed = rendered.filter((element) => element.type !== "pcb_solder_paste")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(removed)).toContain(
      "rendered W5500 bypass geometry has added or removed elements"
    )

    const coordinateDrift = structuredClone(rendered)
    const firstPad = coordinateDrift.find((element) => element.type === "pcb_smtpad")
    if (firstPad === undefined) throw new Error("canonical render must contain an SMT pad")
    Reflect.set(firstPad, "x", -0.67)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(coordinateDrift)).toContain(
      "rendered W5500 bypass copper pad coordinates or shapes drifted"
    )

    const pasteShapeDrift = structuredClone(rendered)
    const firstPaste = pasteShapeDrift.find((element) => element.type === "pcb_solder_paste")
    if (firstPaste === undefined) throw new Error("canonical render must contain solder paste")
    Reflect.set(firstPaste, "shape", "circle")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(pasteShapeDrift)).toContain(
      "rendered W5500 bypass paste coordinates or shapes drifted"
    )

    const courtyardShapeDrift = structuredClone(rendered)
    const courtyard = courtyardShapeDrift.find((element) => element.type === "pcb_courtyard_rect")
    if (courtyard === undefined) throw new Error("canonical render must contain a courtyard")
    Reflect.set(courtyard, "type", "pcb_courtyard_circle")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(courtyardShapeDrift)).toContain(
      "rendered W5500 bypass courtyard coordinates or shape drifted"
    )
  })

  it("rejects noncanonical wrapper and render graphs without invoking getters", () => {
    const sourceExtra = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourceExtra.sources[0], "extra", "unexpected")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceExtra)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const sourceHidden = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Object.defineProperty(sourceHidden.sources[0], "hidden", { value: "unexpected", enumerable: false })
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceHidden)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const sourceSymbol = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.set(sourceSymbol.sources[0], Symbol("unexpected"), true)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceSymbol)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const sourcePrototype = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Object.setPrototypeOf(sourcePrototype.sources[0], null)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourcePrototype)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const sourceGetter = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    let sourceGetterRead = false
    Object.defineProperty(sourceGetter.sources[0], "url", {
      enumerable: true,
      get: () => {
        sourceGetterRead = true
        return "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R71C104KA01-01.pdf"
      }
    })
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(sourceGetter)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )
    expect(sourceGetterRead).toBe(false)

    const packageToleranceDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.deleteProperty(packageToleranceDrift.package.lengthMm, "plus")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(packageToleranceDrift)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const landNoteDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.deleteProperty(landNoteDrift.manufacturerLandPattern, "note")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(landNoteDrift)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const maskMarginDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.deleteProperty(maskMarginDrift.projectSelection.solderMask, "marginPerEdgeMm")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(maskMarginDrift)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const pasteReductionDrift = structuredClone(bp033MurataGrm188r71c104ka01dW5500BypassFootprint)
    Reflect.deleteProperty(pasteReductionDrift.projectSelection.paste, "reductionPerEdgeMm")
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(pasteReductionDrift)).toContain(
      "BP-033 Murata bypass record must remain an exact plain data graph"
    )

    const rendered = renderTestCircuit(<Bp033MurataGrm188r71c104ka01dW5500BypassFootprint />)
    const hiddenElement = structuredClone(rendered)
    Object.defineProperty(hiddenElement[9]!, "hidden", { value: "unexpected", enumerable: false })
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(hiddenElement)).not.toEqual([])

    const symbolElement = structuredClone(rendered)
    Reflect.set(symbolElement[9]!, Symbol("unexpected"), true)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(symbolElement)).not.toEqual([])

    const hiddenArrayField = structuredClone(rendered)
    Object.defineProperty(hiddenArrayField, "hidden", { value: "unexpected", enumerable: false })
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(hiddenArrayField)).not.toEqual([])

    const symbolArrayField = structuredClone(rendered)
    Reflect.set(symbolArrayField, Symbol("unexpected"), true)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(symbolArrayField)).not.toEqual([])

    const inventoryMetadataDrift = structuredClone(rendered)
    const inventoryMetadata = inventoryMetadataDrift as unknown as {
      _internal_store: { counts: Record<string, unknown> }
    }
    Reflect.set(inventoryMetadata._internal_store.counts, "pcb_smtpad", 2)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(inventoryMetadataDrift)).not.toEqual([])

    const unknownElement = structuredClone(rendered)
    Reflect.apply(Array.prototype.push, unknownElement, [{ type: "hidden", payload: "unexpected" }])
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(unknownElement)).toContain(
      "rendered W5500 bypass geometry has added or removed elements"
    )

    const renderedGetter = structuredClone(rendered)
    let renderedGetterRead = false
    Object.defineProperty(renderedGetter[9]!, "x", {
      enumerable: true,
      get: () => {
        renderedGetterRead = true
        return -0.675
      }
    })
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(renderedGetter)).not.toEqual([])
    expect(renderedGetterRead).toBe(false)

    const renderedPrototype = structuredClone(rendered)
    Object.setPrototypeOf(renderedPrototype[9]!, null)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(renderedPrototype)).not.toEqual([])

    const maskDrift = structuredClone(rendered)
    Reflect.set(maskDrift[9]!, "soldermask_margin", 0.04)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(maskDrift)).toContain(
      "rendered W5500 bypass copper pad coordinates or shapes drifted"
    )

    const courtyardMetadataDrift = structuredClone(rendered)
    Reflect.set(courtyardMetadataDrift[13]!, "ccw_rotation", 90)
    expect(validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(courtyardMetadataDrift)).toContain(
      "rendered W5500 bypass courtyard coordinates or shape drifted"
    )
  })
})
