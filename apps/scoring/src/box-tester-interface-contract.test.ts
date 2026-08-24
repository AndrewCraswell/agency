import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { boxTesterInterfaceContract, evaluateBoxTesterInterfaceContract } from "./box-tester-interface-contract.js"

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(`${repositoryRoot}/${path}`))
    .digest("hex")
    .toUpperCase()
}

describe("BT-02 tester interface contract", () => {
  it("freezes the two keyed three-contact reels and separate piste reference", () => {
    const result = evaluateBoxTesterInterfaceContract()
    expect(result).toMatchObject({ physicalRunAuthorized: false, status: "deny" })
    expect(boxTesterInterfaceContract.reelInterfaces).toEqual([
      expect.objectContaining({
        conductors: ["left.A", "left.B", "left.C"],
        contactMap: [
          { contact: "A", conductor: "left.A" },
          { contact: "B", conductor: "left.B" },
          { contact: "C", conductor: "left.C" }
        ],
        keying: "left-only"
      }),
      expect.objectContaining({
        conductors: ["right.A", "right.B", "right.C"],
        contactMap: [
          { contact: "A", conductor: "right.A" },
          { contact: "B", conductor: "right.B" },
          { contact: "C", conductor: "right.C" }
        ],
        keying: "right-only"
      })
    ])
    expect(boxTesterInterfaceContract.pisteInterface).toMatchObject({ contact: "P", conductor: "piste" })
  })

  it("preserves USB-C PD as normal apparatus input and tester independence", () => {
    expect(boxTesterInterfaceContract.apparatusPower).toEqual(
      expect.objectContaining({
        normalExternalInput: "USB-C PD",
        negotiatedRequest: { currentMilliamps: 3_000, voltageMillivolts: 20_000 }
      })
    )
    expect(boxTesterInterfaceContract.testerIndependence.power).toContain("independent")
    expect(boxTesterInterfaceContract.floatingBoundary.forbiddenTies).toContain("DUT power return")
  })

  it("binds conservative normal and guarded fault envelopes to committed source digests", () => {
    expect(boxTesterInterfaceContract.voltageCurrentEnvelope).toMatchObject({
      guardedFaultTest: {
        maximumAbsoluteVoltageMillivolts: 24_000,
        maximumPulseDurationMilliseconds: 100,
        maximumSourceCurrentMicroamps: 433,
        maximumSourceEnergyMicrojoules: 1_040
      },
      normalStimulus: {
        maximumAbsoluteVoltageMillivolts: 2_500,
        maximumSourceCurrentMicroamps: 1_100,
        minimumSourceResistanceOhms: 2_490
      },
      unresolvedDutBoundary: { status: "blocked" }
    })
    for (const source of boxTesterInterfaceContract.sourceProvenance) {
      expect(sha256(source.sourcePath)).toBe(source.sha256)
    }
  })

  it("keeps unproven DUT limits, no-back-power proof, and physical claims denied", () => {
    expect(boxTesterInterfaceContract.claims).toEqual({
      fabricationAuthorized: false,
      fieApprovalClaim: false,
      physicalQualificationClaim: false,
      testerHardwareApproved: false
    })
  })

  it("rejects altered interface, safety, and observer projections", () => {
    const changedPower = structuredClone(boxTesterInterfaceContract)
    Object.defineProperty(changedPower.apparatusPower, "normalExternalInput", {
      configurable: true,
      enumerable: true,
      value: "bench supply",
      writable: true
    })
    expect(() => evaluateBoxTesterInterfaceContract(changedPower)).toThrow(RangeError)

    const changedPiste = structuredClone(boxTesterInterfaceContract)
    Object.defineProperty(changedPiste.pisteInterface, "conductor", {
      configurable: true,
      enumerable: true,
      value: "protective-earth",
      writable: true
    })
    expect(() => evaluateBoxTesterInterfaceContract(changedPiste)).toThrow(RangeError)

    const changedObserver = structuredClone(boxTesterInterfaceContract)
    Object.defineProperty(changedObserver.outputObservation, "channels", {
      configurable: true,
      enumerable: true,
      value: changedObserver.outputObservation.channels.slice(0, -1),
      writable: true
    })
    expect(() => evaluateBoxTesterInterfaceContract(changedObserver)).toThrow(RangeError)

    const changedEnvelope = structuredClone(boxTesterInterfaceContract)
    Object.defineProperty(changedEnvelope.voltageCurrentEnvelope.normalStimulus, "maximumSourceCurrentMicroamps", {
      configurable: true,
      enumerable: true,
      value: 1_200,
      writable: true
    })
    expect(() => evaluateBoxTesterInterfaceContract(changedEnvelope)).toThrow(RangeError)

    const permutedContact = structuredClone(boxTesterInterfaceContract)
    Object.defineProperty(permutedContact.reelInterfaces[0].contactMap[1], "conductor", {
      configurable: true,
      enumerable: true,
      value: "left.C",
      writable: true
    })
    expect(() => evaluateBoxTesterInterfaceContract(permutedContact)).toThrow(RangeError)
  })
})
