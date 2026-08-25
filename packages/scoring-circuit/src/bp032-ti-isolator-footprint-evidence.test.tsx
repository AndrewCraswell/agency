import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp032Iso7721FdrFootprint,
  Bp032Iso7762FdwrFootprint,
  bp032TiIsolatorFootprintEvidence,
  validateBp032TiIsolatorFootprintEvidence
} from "./bp032-ti-isolator-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

function isFrozenAliasFreeDataGraph(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true
  if (seen.has(value) || !Object.isFrozen(value)) return false
  seen.add(value)
  return Object.values(value).every((child) => isFrozenAliasFreeDataGraph(child, seen))
}

function renderedArtifacts(component: React.ReactElement, reference: string) {
  const json = renderTestCircuit(component)
  const source = json.find((element) => element.type === "source_component" && element.name === reference)
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
  const courtyard = json.filter(
    (element) =>
      element.type === "pcb_courtyard_rect" &&
      pcb?.type === "pcb_component" &&
      element.pcb_component_id === pcb.pcb_component_id
  )
  return { courtyard, json, pads, source }
}

describe("BP-032 exact TI isolator footprint evidence", () => {
  it("binds exactly the two BP-122 populated references, orderables, and pin directions", () => {
    expect(validateBp032TiIsolatorFootprintEvidence()).toEqual([])
    expect(isFrozenAliasFreeDataGraph(bp032TiIsolatorFootprintEvidence)).toBe(true)
    expect(bp032TiIsolatorFootprintEvidence.sourceControl).toMatchObject({
      basisCommit: "40d41db371b04a3479afdee16867da68ba1982e3",
      canonicalContract: {
        path: "packages/scoring-circuit/src/bench-prototype-isolation-channel.ts",
        sha256: "2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1",
        workUnit: "BP-122"
      }
    })
    expect(
      bp032TiIsolatorFootprintEvidence.devices.map((device) => [
        device.canonicalReference,
        device.manufacturerPartNumber
      ])
    ).toEqual([
      ["U_ISO_MAIN", "ISO7762FDWR"],
      ["U_ISO_AUX", "ISO7721FDR"]
    ])
    expect(bp032TiIsolatorFootprintEvidence.devices[0].pinDirectionMap).toEqual([
      { channel: 1, direction: "scoring-to-application", signal: "SCORE_SCK", scoringPin: 2, applicationPin: 15 },
      { channel: 2, direction: "scoring-to-application", signal: "SCORE_MOSI", scoringPin: 3, applicationPin: 14 },
      { channel: 3, direction: "scoring-to-application", signal: "SCORE_CS_N", scoringPin: 4, applicationPin: 13 },
      { channel: 4, direction: "scoring-to-application", signal: "RESET_REQUEST", scoringPin: 5, applicationPin: 12 },
      { channel: 5, direction: "application-to-scoring", signal: "SCORE_MISO", scoringPin: 6, applicationPin: 11 },
      { channel: 6, direction: "application-to-scoring", signal: "ESP32_HEARTBEAT", scoringPin: 7, applicationPin: 10 }
    ])
    expect(bp032TiIsolatorFootprintEvidence.devices[1].pinDirectionMap).toEqual([
      { channel: 1, direction: "scoring-to-application", signal: "STM32_HEARTBEAT", scoringPin: 3, applicationPin: 6 },
      {
        channel: 2,
        direction: "application-to-scoring",
        signal: "SERVICE_ONLY_REVERSE_CHANNEL",
        scoringPin: 2,
        applicationPin: 7
      }
    ])
  })

  it("hashes exact-orderable TI evidence while denying CAD and physical-release claims", () => {
    for (const device of bp032TiIsolatorFootprintEvidence.devices) {
      const sourceBytes = readFileSync(new URL(`../${device.manufacturerSource.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(sourceBytes).digest("hex").toUpperCase()).toBe(
        device.manufacturerSource.sha256
      )
      expect(device.manufacturerSource.authority).toBe("manufacturer-primary")
      expect(device.manufacturerFacts).toMatchObject({
        exactOrderableStatus: "manufacturer-specified-exact-orderable",
        packageStatus: "manufacturer-specified-package",
        landPatternStatus: "manufacturer-example-not-cad"
      })
      expect(device.manufacturerCad).toEqual({ state: "not-acquired", authority: "deny" })
      expect(device.gates).toEqual({
        cad: "deny",
        placement: "deny",
        physicalIsolation: "deny",
        release: "deny",
        fabrication: "deny"
      })
      expect(device.projectGeometry.status).toBe("project-review-input")
      expect(device.projectGeometry.orientation.status).toBe("pending-layout-review")
    }
    expect(bp032TiIsolatorFootprintEvidence.devices[0].manufacturerSource).toMatchObject({
      documentNumber: "SLLSER1H",
      exactOrderablePages: [38, 42, 44],
      packagePages: [45, 46, 47, 48],
      pinOnePage: 4,
      landPatternExamplePage: 47
    })
    expect(bp032TiIsolatorFootprintEvidence.devices[1].manufacturerSource).toMatchObject({
      documentNumber: "SLLSEP3G",
      exactOrderablePages: [37, 38, 41, 43],
      packagePages: [34, 35, 36, 37],
      pinOnePage: 5,
      landPatternExamplePage: 35
    })
  })

  it("renders only review geometry with top-view pin one at positive Y for both package families", () => {
    const main = renderedArtifacts(<Bp032Iso7762FdwrFootprint />, "U_ISO_MAIN")
    expect(main.source).toMatchObject({ manufacturer_part_number: "ISO7762FDWR" })
    expect(main.pads).toHaveLength(16)
    expect(main.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: -4.875,
          y: 4.445,
          width: 1.65,
          height: 0.6,
          soldermask_margin: -0.07,
          port_hints: expect.arrayContaining(["1", "pin1"])
        }),
        expect.objectContaining({
          x: 4.875,
          y: 4.445,
          width: 1.65,
          height: 0.6,
          soldermask_margin: -0.07,
          port_hints: expect.arrayContaining(["16", "pin16"])
        }),
        expect.objectContaining({ x: -4.875, y: -4.445, port_hints: expect.arrayContaining(["8", "pin8"]) }),
        expect.objectContaining({ x: 4.875, y: -4.445, port_hints: expect.arrayContaining(["9", "pin9"]) })
      ])
    )
    expect(bp032TiIsolatorFootprintEvidence.devices[0].projectGeometry.orientation).toEqual({
      status: "pending-layout-review",
      topViewPinOne: "upper-left"
    })
    expect(main.courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 11.9, height: 9.99 })])
    )

    const auxiliary = renderedArtifacts(<Bp032Iso7721FdrFootprint />, "U_ISO_AUX")
    expect(auxiliary.source).toMatchObject({ manufacturer_part_number: "ISO7721FDR" })
    expect(auxiliary.pads).toHaveLength(8)
    expect(auxiliary.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: -2.75,
          y: 1.905,
          width: 1.4,
          height: 0.6,
          soldermask_margin: -0.07,
          port_hints: expect.arrayContaining(["1", "pin1"])
        }),
        expect.objectContaining({
          x: 2.75,
          y: 1.905,
          width: 1.4,
          height: 0.6,
          soldermask_margin: -0.07,
          port_hints: expect.arrayContaining(["8", "pin8"])
        }),
        expect.objectContaining({ x: -2.75, y: -1.905, port_hints: expect.arrayContaining(["4", "pin4"]) }),
        expect.objectContaining({ x: 2.75, y: -1.905, port_hints: expect.arrayContaining(["5", "pin5"]) })
      ])
    )
    expect(bp032TiIsolatorFootprintEvidence.devices[1].projectGeometry.orientation).toEqual({
      status: "pending-layout-review",
      topViewPinOne: "upper-left"
    })
    expect(auxiliary.courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 7.4, height: 4.91 })])
    )
    expect([...main.json, ...auxiliary.json].filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("fails closed on descriptor, alias, cycle, identity, direction, and gate attacks", () => {
    const descriptorFlagDrift = structuredClone(bp032TiIsolatorFootprintEvidence)
    expect(validateBp032TiIsolatorFootprintEvidence(descriptorFlagDrift)).not.toEqual([])

    const nullPrototypeSubstitution = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(
      nullPrototypeSubstitution.devices[0],
      "gates",
      Object.assign(Object.create(null), nullPrototypeSubstitution.devices[0].gates)
    )
    expect(validateBp032TiIsolatorFootprintEvidence(nullPrototypeSubstitution)).not.toEqual([])

    const changedIdentity = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(changedIdentity.devices[0], "manufacturerPartNumber", "ISO7721FDR")
    expect(validateBp032TiIsolatorFootprintEvidence(changedIdentity)).not.toEqual([])

    const changedDirection = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(changedDirection.devices[0].pinDirectionMap[4], "direction", "scoring-to-application")
    expect(validateBp032TiIsolatorFootprintEvidence(changedDirection)).not.toEqual([])

    const changedGate = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(changedGate.devices[1].gates, "fabrication", "allow")
    expect(validateBp032TiIsolatorFootprintEvidence(changedGate)).not.toEqual([])

    const accessor = structuredClone(bp032TiIsolatorFootprintEvidence)
    Object.defineProperty(accessor.devices[0], "role", { get: () => "forged" })
    expect(validateBp032TiIsolatorFootprintEvidence(accessor)).not.toEqual([])

    const aliased = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(aliased.devices[0], "gates", aliased.devices[1].gates)
    expect(validateBp032TiIsolatorFootprintEvidence(aliased)).not.toEqual([])

    const cyclic = structuredClone(bp032TiIsolatorFootprintEvidence)
    Reflect.set(cyclic.devices[0].projectGeometry, "courtyard", cyclic.devices[0].projectGeometry)
    expect(validateBp032TiIsolatorFootprintEvidence(cyclic)).not.toEqual([])

    expect(
      validateBp032TiIsolatorFootprintEvidence(
        new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error("forged")
            }
          }
        )
      )
    ).not.toEqual([])
  })
})
