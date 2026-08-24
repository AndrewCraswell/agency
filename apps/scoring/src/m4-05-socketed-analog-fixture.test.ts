import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  M405_SOCKETED_ANALOG_FIXTURE_DESIGN,
  M405_SOURCE_CONTRACTS,
  validateM405SocketedAnalogFixtureDesign
} from "./m4-05-socketed-analog-fixture.js"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

function canonicalSourceDigest(source: Buffer | string): string {
  return createHash("sha256").update(source.toString().replace(/\r\n/gu, "\n")).digest("hex")
}

describe("M4-05 socketed analog fixture design", () => {
  it("covers the complete resistance, capacitance, temperature, and timing matrix", () => {
    const design = M405_SOCKETED_ANALOG_FIXTURE_DESIGN
    expect(design.canonicalMatrix.resistanceOhms).toEqual([
      0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, 505
    ])
    expect(design.canonicalMatrix.capacitancePf).toEqual([500, 2_000, 5_000, 10_000])
    expect(design.canonicalMatrix.temperatureC).toEqual([-40, 25, 85, 125])
    expect(design.canonicalMatrix.normalPointIds).toHaveLength(320)
    expect(design.canonicalMatrix.normalPointIds).toContain("normal-r450-c10000-t125")
    expect(design.canonicalMatrix.pulseWidthsUs).toEqual(
      expect.arrayContaining([50, 99, 100, 101, 1_000, 2_000, 10_000, 13_000, 14_000, 15_000])
    )
  })

  it("makes every socketed stimulus traceable to a bounded k=2 calibration requirement", () => {
    const { calibration, fixture } = M405_SOCKETED_ANALOG_FIXTURE_DESIGN
    expect(fixture.resistanceBank.kelvinCharacterization).toContain("four-wire")
    expect(fixture.resistanceBank.switching).toContain("one socketed resistance module at a time")
    expect(fixture.capacitanceBank.switching).toContain("one socketed capacitance module at a time")
    expect(calibration.uncertaintyLimits).toEqual({
      capacitance: { maximumExpandedUncertaintyPf: 100, coverageFactor: 2, rangePf: [500, 10_000] },
      pulseWidth: { maximumExpandedUncertaintyUs: 1, coverageFactor: 2, rangeUs: [50, 15_001] },
      resistance: { maximumExpandedUncertaintyOhms: 0.25, coverageFactor: 2, rangeOhms: [0, 505] },
      temperature: { maximumExpandedUncertaintyC: 0.5, coverageFactor: 2, rangeC: [-40, 125] }
    })
    expect(calibration.requiredRecordFields).toContain("expanded-uncertainty-k2")
  })

  it("retains de-energized interlocks and the normal USB-C PD architecture", () => {
    const design = M405_SOCKETED_ANALOG_FIXTURE_DESIGN
    expect(design.authority).toEqual({
      energizedTestAuthorization: false,
      fabricationAuthorized: false,
      faultInjectionAuthorized: false,
      scoringAuthority: false,
      schematicIntegrationAuthorized: false
    })
    expect(design.safety.defaultState).toBe("de-energized-open")
    expect(design.safety.interlocks.join(" ")).toContain("physically mutually incompatible")
    expect(design.connections.power).toContain("USB-C PD is the normal apparatus input")
    expect(design.connections.power).toContain("adds no VBUS, CC")
  })

  it("contains the six body-cord connectors, piste, both-side combinations, relay evidence, and environmental cases", () => {
    const design = M405_SOCKETED_ANALOG_FIXTURE_DESIGN
    expect(design.connections.DUT.bodyCordConnectors).toHaveLength(6)
    expect(design.connections.DUT.bodyCordConnectors.every((connector) => connector.pins === 3)).toBe(true)
    expect(design.connections.DUT.pisteTerminal).toMatchObject({ id: "piste", pinCount: 1 })
    expect(design.connections.DUT.scoringBoxPort).toMatchObject({ conductorCount: 7 })
    expect(design.combinations.bothSideFaultCombinations).toHaveLength(14)
    for (const side of ["left", "right"]) {
      expect(design.combinations.bothSideFaultCombinations.map(({ id }) => id)).toEqual(
        expect.arrayContaining([
          `${side}-open`,
          `${side}-short`,
          `${side}-cross-line`,
          `${side}-blade-guard`,
          `${side}-opponent-target`,
          `${side}-self-lame`,
          `${side}-piste`
        ])
      )
    }
    expect(design.fixture.pulseGenerator.relayRequirements).toMatchObject({ breakBeforeMake: true })
    expect(design.fixture.pulseGenerator.relayRequirements.closedResistanceAndBounceRecord).toContain("separately")
    expect(design.environmentalCases.ambientC.map(({ temperatureC }) => temperatureC)).toEqual([-40, 25, 125])
    expect(design.environmentalCases.usbCPdInput.cases).toEqual(
      expect.arrayContaining([
        "usb-pd-20v-lower-declared-tolerance",
        "usb-pd-20v-upper-declared-tolerance",
        "usb-pd-20v-brownout-falling-ramp"
      ])
    )
  })

  it("fails closed on upstream source drift and treats uncertain timing boundaries as indeterminate", () => {
    for (const contract of M405_SOURCE_CONTRACTS) {
      const current = readFileSync(resolve(repositoryRoot, contract.sourcePath))
      const committed = execFileSync("git", ["show", `${contract.commit}:${contract.sourcePath}`], {
        cwd: repositoryRoot
      })
      expect(canonicalSourceDigest(current)).toBe(contract.sha256)
      expect(canonicalSourceDigest(committed)).toBe(contract.sha256)
      expect(contract.commit).toMatch(/^[0-9a-f]{40}$/u)
    }
    const timing = M405_SOCKETED_ANALOG_FIXTURE_DESIGN.timingAcceptance
    expect(timing).toMatchObject({ coverageFactor: 2, expandedUncertaintyUs: 1 })
    expect(timing.boundaryCases).toHaveLength(7)
    expect(
      timing.boundaryCases.every(({ points }) =>
        points.every(({ disposition }) => disposition === "indeterminate-no-credit")
      )
    ).toBe(true)
    expect(
      timing.boundaryCases.find(({ boundaryUs }) => boundaryUs === 100)?.points.map(({ widthUs }) => widthUs)
    ).toEqual([99, 100, 101])
  }, 30_000)

  it("fails closed for any matrix, uncertainty, safety, or authority change", () => {
    expect(validateM405SocketedAnalogFixtureDesign(M405_SOCKETED_ANALOG_FIXTURE_DESIGN)).toBe(true)

    const alteredMatrix = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as unknown as {
      canonicalMatrix: { resistanceOhms: number[] }
    }
    alteredMatrix.canonicalMatrix.resistanceOhms.pop()
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredMatrix)).toThrow("exactly match")

    const alteredAuthority = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as {
      authority: { fabricationAuthorized: boolean }
    }
    alteredAuthority.authority.fabricationAuthorized = true
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredAuthority)).toThrow("exactly match")

    const alteredSafety = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as {
      safety: { defaultState: string }
    }
    alteredSafety.safety.defaultState = "energized"
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredSafety)).toThrow("exactly match")

    const alteredConnector = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as unknown as {
      connections: { DUT: { bodyCordConnectors: Array<{ pins: number }> } }
    }
    alteredConnector.connections.DUT.bodyCordConnectors.pop()
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredConnector)).toThrow("exactly match")

    const alteredRelay = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as {
      fixture: { pulseGenerator: { relayRequirements: { breakBeforeMake: boolean } } }
    }
    alteredRelay.fixture.pulseGenerator.relayRequirements.breakBeforeMake = false
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredRelay)).toThrow("exactly match")

    const alteredEnvironment = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as unknown as {
      environmentalCases: { usbCPdInput: { cases: string[] } }
    }
    alteredEnvironment.environmentalCases.usbCPdInput.cases.pop()
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredEnvironment)).toThrow("exactly match")

    const alteredTiming = structuredClone(M405_SOCKETED_ANALOG_FIXTURE_DESIGN) as unknown as {
      timingAcceptance: { boundaryCases: Array<{ points: Array<{ disposition: string }> }> }
    }
    alteredTiming.timingAcceptance.boundaryCases[0]!.points[0]!.disposition = "pass"
    expect(() => validateM405SocketedAnalogFixtureDesign(alteredTiming)).toThrow("exactly match")
  })
})
