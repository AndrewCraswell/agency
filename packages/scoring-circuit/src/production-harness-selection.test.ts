import { describe, expect, it } from "vitest"
import {
  productionHarnessFabricationState,
  productionHarnessSelection,
  validateProductionHarnessSelection
} from "./production-harness-selection.js"

describe("production scoring harness selection", () => {
  it("selects the exact reviewed connector, terminal, and cable identities in fixed order", () => {
    validateProductionHarnessSelection()
    expect(
      productionHarnessSelection.map(({ boardReference, cable, connector, id }) => ({
        boardReference,
        cableMpn: cable.mpn,
        headerMpn: connector.headerMpn,
        housingMpn: connector.mateHousingMpn,
        id,
        terminalMpn: connector.mateTerminalMpn
      }))
    ).toEqual([
      {
        boardReference: "J_WEAPON_HARNESS_L",
        cableMpn: "45003",
        headerMpn: "43650-0300",
        housingMpn: "43645-0300",
        id: "left-weapon-micro-fit-3",
        terminalMpn: "43030-0007"
      },
      {
        boardReference: "J_WEAPON_HARNESS_R",
        cableMpn: "45004",
        headerMpn: "43650-0400",
        housingMpn: "43645-0400",
        id: "right-weapon-micro-fit-4",
        terminalMpn: "43030-0007"
      },
      {
        boardReference: "J_PISTE_HARNESS",
        cableMpn: "45002",
        headerMpn: "43650-0200",
        housingMpn: "43645-0200",
        id: "piste-micro-fit-2",
        terminalMpn: "43030-0007"
      },
      {
        boardReference: "J_PRIMARY_OUTPUTS_HARNESS",
        cableMpn: "45066",
        headerMpn: "39-29-1067",
        housingMpn: "39-01-2060",
        id: "primary-output-mini-fit-6",
        terminalMpn: "39-00-0039"
      }
    ])
  })

  it("binds mechanical attributes, gauge compatibility, and still-open qualification evidence", () => {
    for (const harness of productionHarnessSelection) {
      expect(harness.connector).toMatchObject({
        configuredDrawingState: "acquisition-gate",
        crimpValidationState: "open",
        deratingState: "open",
        durabilityMatingCyclesMaximum: 30,
        headerGender: "male",
        headerOrientation: "right-angle",
        housingGender: "female-receptacle",
        locking: true,
        polarized: true,
        retentionEvidenceState: "open",
        shrouded: true
      })
      expect(harness.connector.terminalWireGaugeAwg.selected).toBe(harness.cable.wireGaugeAwg)
      expect(harness.connector.terminalWireGaugeAwg.minimum).toBeLessThanOrEqual(harness.cable.wireGaugeAwg)
      expect(harness.connector.terminalWireGaugeAwg.maximum).toBeGreaterThanOrEqual(harness.cable.wireGaugeAwg)
      expect(harness.serviceLoadPath).toContain("not the load path")
      expect(harness.releaseGates[0]).toContain("configured 2, 3, and 4-circuit Micro-Fit drawings")
    }
  })

  it("preserves exact functions, colors, keying, return, ESD, and no-shield policy", () => {
    const [left, right, piste, primary] = productionHarnessSelection
    expect(left.pins.map((pin) => [pin.pin, pin.function, pin.wire])).toEqual([
      [1, "weapon A", "Alpha Wire 45003 black core"],
      [2, "weapon B", "Alpha Wire 45003 brown core"],
      [3, "weapon C", "Alpha Wire 45003 red core"]
    ])
    expect(right.pins).toEqual([
      { function: "weapon A", pin: 1, terminalInstalled: true, wire: "Alpha Wire 45004 black core" },
      { function: "weapon B", pin: 2, terminalInstalled: true, wire: "Alpha Wire 45004 brown core" },
      { function: "weapon C", pin: 3, terminalInstalled: true, wire: "Alpha Wire 45004 red core" },
      {
        function: "intentional empty cavity",
        pin: 4,
        terminalInstalled: false,
        wire: "no terminal and no conductor enters cavity four"
      }
    ])
    expect(right.keyingStrategy).toContain("connector size is the mechanical noninterchange feature")
    expect(right.keyingStrategy).toContain("empty cavity is not the key")
    expect(right.cable.unusedCorePolicy).toContain("trimmed, individually insulated, and floating")
    expect(piste.pins.map((pin) => pin.function)).toEqual(["piste signal", "piste return to connector-side ESD return"])
    expect(primary.pins.map((pin) => pin.wire)).toEqual([
      "Alpha Wire 45066 black core",
      "Alpha Wire 45066 red core",
      "Alpha Wire 45066 white core",
      "Alpha Wire 45066 green core",
      "Alpha Wire 45066 orange core",
      "Alpha Wire 45066 blue core"
    ])
    for (const harness of productionHarnessSelection) {
      expect(harness.returnShieldEsdPolicy).toMatch(/no (?:cable )?shield/u)
      expect(harness.returnShieldEsdPolicy).not.toContain("CHASSIS")
    }
    expect(piste.returnShieldEsdPolicy).toContain("temporary scoring-board pin label SHIELD")
  })

  it("keeps the exact manufacturer terminal URL and a hard fabrication deny", () => {
    for (const harness of productionHarnessSelection.slice(0, 3)) {
      expect(harness.primarySourceUrls).toContain("https://www.molex.com/en-us/products/part-detail/430300007")
      expect(harness.boardIntegrationState).toBe("integrated-dnp")
      expect(harness.harnessBuildState).toBe("unbuilt")
    }
    expect(productionHarnessFabricationState).toEqual(
      expect.objectContaining({ fabricationAuthorized: false, state: "deny" })
    )
  })

  it("rejects hidden keys, accessors, sparse arrays, and cycles at the runtime boundary", () => {
    const extraArrayProperty = [...productionHarnessSelection]
    Object.defineProperty(extraArrayProperty, "releaseBypass", { enumerable: true, value: true })
    expect(() => validateProductionHarnessSelection(extraArrayProperty)).toThrow(
      new RangeError("production harness selection must be a dense array with no extra own keys")
    )

    const hiddenProperty = structuredClone(productionHarnessSelection)
    Object.defineProperty(hiddenProperty[0].connector, "hiddenOverride", { enumerable: false, value: "unsafe" })
    expect(() => validateProductionHarnessSelection(hiddenProperty)).toThrow(
      new RangeError("production harness selection must exactly match the reviewed canonical contract")
    )

    const symbolProperty = structuredClone(productionHarnessSelection)
    Object.defineProperty(symbolProperty[0].connector, Symbol("release"), { value: true })
    expect(() => validateProductionHarnessSelection(symbolProperty)).toThrow(
      new RangeError("production harness selection[0].connector must not contain symbol keys")
    )

    const sparseArray = [...productionHarnessSelection]
    delete sparseArray[1]
    expect(() => validateProductionHarnessSelection(sparseArray)).toThrow(
      new RangeError("production harness selection must be a dense array with no extra own keys")
    )

    const accessorProperty = structuredClone(productionHarnessSelection)
    Object.defineProperty(accessorProperty[0].connector, "headerMpn", {
      configurable: true,
      enumerable: true,
      get: () => "43650-0300"
    })
    expect(() => validateProductionHarnessSelection(accessorProperty)).toThrow(
      new RangeError("production harness selection[0].connector.headerMpn must not contain accessors")
    )

    const directCycle: unknown[] = []
    directCycle.push(directCycle)
    expect(() => validateProductionHarnessSelection(directCycle)).toThrow(
      new RangeError("production harness selection[0] must not contain cycles")
    )

    const indirectCycle: unknown[] = []
    const cycleHolder = { indirectCycle }
    indirectCycle.push(cycleHolder)
    expect(() => validateProductionHarnessSelection(indirectCycle)).toThrow(
      new RangeError("production harness selection[0].indirectCycle must not contain cycles")
    )
  })

  it.each([
    [null, "production harness selection must be an array"],
    ["not an array", "production harness selection must be an array"],
    [{}, "production harness selection must be an array"],
    [[null], "production harness selection must exactly match the reviewed canonical contract"],
    [
      [{ ...productionHarnessSelection[0], connector: null }, ...productionHarnessSelection.slice(1)],
      "production harness selection must exactly match the reviewed canonical contract"
    ],
    [
      productionHarnessSelection.slice(0, 3),
      "production harness selection must exactly match the reviewed canonical contract"
    ],
    [
      [...productionHarnessSelection, productionHarnessSelection[0]],
      "production harness selection must exactly match the reviewed canonical contract"
    ],
    [
      [...productionHarnessSelection].reverse(),
      "production harness selection must exactly match the reviewed canonical contract"
    ],
    [
      productionHarnessSelection.map((harness, index) =>
        index === 0 ? { ...harness, connector: { ...harness.connector, headerMpn: "43650-0400" } } : harness
      ),
      "production harness selection must exactly match the reviewed canonical contract"
    ],
    [
      productionHarnessSelection.map((harness, index) =>
        index === 2 ? { ...harness, cable: { ...harness.cable, wireGaugeAwg: Number.NaN } } : harness
      ),
      "production harness selection[2].cable.wireGaugeAwg must contain only finite numbers"
    ],
    [
      productionHarnessSelection.map((harness, index) =>
        index === 3
          ? {
              ...harness,
              pins: harness.pins.map((pin, pinIndex) =>
                pinIndex === 5 ? { ...pin, wire: "substituted return core" } : pin
              )
            }
          : harness
      ),
      "production harness selection must exactly match the reviewed canonical contract"
    ]
  ])("rejects malformed, reordered, missing, extra, substituted, or nonfinite runtime input", (input, message) => {
    expect(() => validateProductionHarnessSelection(input)).toThrow(new RangeError(message))
  })
})
