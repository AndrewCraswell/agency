import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  applicationDisplayHub75SupportPart,
  applicationDisplayHub75SupportParts
} from "./application-display-carrier-support.js"
import { benchPrototypeHub75Safing, validateBenchPrototypeHub75Safing } from "./bench-prototype-hub75-safing.js"
import {
  Bp033Sn74ahct245pwrTssop20FootprintA,
  Bp033Sn74ahct245pwrTssop20FootprintB,
  type Bp033Sn74ahct245pwrTssop20Footprint,
  bp033Sn74ahct245pwrTssop20Footprint,
  validateBp033Sn74ahct245pwrTssop20Footprint
} from "./bp033-sn74ahct245pwr-tssop20-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const candidate = bp033Sn74ahct245pwrTssop20Footprint

function retainedArtifactUrl(artifactPath: string): URL {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function sha256(artifactPath: string): string {
  return createHash("sha256")
    .update(readFileSync(retainedArtifactUrl(artifactPath)))
    .digest("hex")
    .toUpperCase()
}

function cloneWithReviewDescriptors<T>(value: T, configurableKey?: PropertyKey): T {
  const seen = new WeakMap<object, object>()
  const clone = (input: unknown): unknown => {
    if (typeof input !== "object" || input === null) return input
    const existing = seen.get(input)
    if (existing !== undefined) return existing
    const output = Array.isArray(input) ? [] : Object.create(Object.getPrototypeOf(input))
    seen.set(input, output)
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)
      if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("data descriptor expected")
      Object.defineProperty(output, key, {
        ...descriptor,
        configurable: descriptor.configurable || key === configurableKey,
        value: clone(descriptor.value)
      })
    }
    return output
  }
  return clone(value) as T
}

describe("BP-033 exact SN74AHCT245PWR TSSOP-20 display-buffer candidate", () => {
  it("binds both canonical references to the exact active TI orderable", () => {
    expect(validateBp033Sn74ahct245pwrTssop20Footprint(candidate)).toBe(true)
    expect(Object.isFrozen(candidate)).toBe(true)
    expect(candidate).toMatchObject({
      workUnit: "BP-033",
      references: ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"],
      canonicalIdentity: {
        manufacturer: "Texas Instruments",
        manufacturerPartNumber: "SN74AHCT245PWR",
        package: "TSSOP-20",
        packageCode: "PW",
        packagePins: 20,
        orderableStatus: "active production"
      },
      sourceBinding: {
        sourceArtifactPath: "docs/evidence/bp-033/ti-sn74ahct245-datasheet-official.pdf",
        sourceSha256: "9E7C1B200CDEFD3DC72CD0E8B9019059FED2833B1B15AC80E97E099DFCAC93D7",
        reviewedPages: [1, 3, 13, 20]
      }
    })
    expect(applicationDisplayHub75SupportParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_DISPLAY_BUFFER_A", mpn: "SN74AHCT245PWR", package: "TSSOP-20" }),
        expect.objectContaining({ reference: "U_DISPLAY_BUFFER_B", mpn: "SN74AHCT245PWR", package: "TSSOP-20" })
      ])
    )
    expect(applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_A").mpn).toBe(
      candidate.canonicalIdentity.manufacturerPartNumber
    )
    expect(applicationDisplayHub75SupportPart("U_DISPLAY_BUFFER_B").package).toBe(candidate.canonicalIdentity.package)
    expect(sha256(candidate.sourceBinding.supportSourcePath)).toBe(candidate.sourceBinding.supportSourceSha256)
    expect(sha256(candidate.sourceBinding.bp144SourcePath)).toBe(candidate.sourceBinding.bp144SourceSha256)
  })

  it("hash-binds the retained official TI PDF and its visually reviewed identity, pin, and outline pages", () => {
    expect(candidate.officialEvidence.authority).toBe("manufacturer-primary")
    expect(sha256(candidate.officialEvidence.artifactPath)).toBe(candidate.officialEvidence.sha256)
    expect(candidate.officialEvidence.visualReview).toEqual({
      packageIdentityPage: 1,
      pinOneAndPinMapPage: 3,
      exactPwrOrderablePage: 13,
      packageOutlinePage: 20
    })
    expect(candidate.manufacturerLandGuidance).toMatchObject({
      status: "not-published-in-retained-datasheet",
      sourcePage: 20,
      copperGeometry: null,
      solderMaskGeometry: null,
      pasteGeometry: null,
      courtyardGeometry: null
    })
  })

  it("freezes the TI 20-pin map and the BP-144 A/B signal assignment", () => {
    expect(candidate.manufacturerFacts.pinMap).toEqual([
      { pin: 1, name: "DIR", type: "input", function: "direction-select; hard-tied A-to-B" },
      { pin: 2, name: "A1", type: "input-output", function: "channel A1 input/output" },
      { pin: 3, name: "A2", type: "input-output", function: "channel A2 input/output" },
      { pin: 4, name: "A3", type: "input-output", function: "channel A3 input/output" },
      { pin: 5, name: "A4", type: "input-output", function: "channel A4 input/output" },
      { pin: 6, name: "A5", type: "input-output", function: "channel A5 input/output" },
      { pin: 7, name: "A6", type: "input-output", function: "channel A6 input/output" },
      { pin: 8, name: "A7", type: "input-output", function: "channel A7 input/output" },
      { pin: 9, name: "A8", type: "input-output", function: "channel A8 input/output" },
      { pin: 10, name: "GND", type: "ground", function: "APP_GND logic reference" },
      { pin: 11, name: "B8", type: "input-output", function: "channel B8 input/output" },
      { pin: 12, name: "B7", type: "input-output", function: "channel B7 input/output" },
      { pin: 13, name: "B6", type: "input-output", function: "channel B6 input/output" },
      { pin: 14, name: "B5", type: "input-output", function: "channel B5 input/output" },
      { pin: 15, name: "B4", type: "input-output", function: "channel B4 input/output" },
      { pin: 16, name: "B3", type: "input-output", function: "channel B3 input/output" },
      { pin: 17, name: "B2", type: "input-output", function: "channel B2 input/output" },
      { pin: 18, name: "B1", type: "input-output", function: "channel B1 input/output" },
      { pin: 19, name: "OE", type: "input", function: "active-low output enable" },
      { pin: 20, name: "VCC", type: "power", function: "V5_DISPLAY_LIMITED" }
    ])
    expect(validateBenchPrototypeHub75Safing(benchPrototypeHub75Safing)).toBe(true)
    expect(candidate.interfaceBinding.signalMap).toEqual(benchPrototypeHub75Safing.signalMap)
    expect(candidate.interfaceBinding.sourceContract).toBe("BP-144 reset-safe HUB75 path")
    expect(candidate.interfaceBinding.supplyNet).toBe("V5_DISPLAY_LIMITED")
    expect(candidate.interfaceBinding.groundNet).toBe("APP_GND")
  })

  it("records package dimensions, pin-one orientation, and the denied project geometry boundary", () => {
    expect(candidate.manufacturerFacts).toMatchObject({
      packageDesignation: "PW (TSSOP, 20)",
      bodyNominalMm: { lengthMm: 6.5, widthMm: 4.4 },
      bodyLimitsMm: { lengthMm: { min: 6.2, max: 6.6 }, widthMm: { min: 4.3, max: 4.5 } },
      maximumHeightMm: 1.2,
      terminalCount: 20,
      terminalPitchMm: 0.65
    })
    expect(candidate.projectGeometry).toMatchObject({
      coordinateFrame: "package-center top view; +X right and +Y up",
      bodyOutline: { widthMm: 4.4, lengthMm: 6.5, maximumHeightMm: 1.2 },
      pinOneOrientation: {
        sourceMark: "PIN 1 INDEX AREA",
        sourceView: "top view with pin 1 at upper-left, pin 20 at upper-right",
        nominalBoardRotationDegrees: 0,
        independentOverlay: "pending",
        orientationAccepted: false
      },
      perimeterPads: { status: "not-generated", geometry: null },
      keepout: { status: "not-published", geometry: null, authority: "deny" },
      paste: { status: "not-published", geometry: null, authority: "deny" },
      courtyard: { status: "not-published", geometry: null, authority: "deny" }
    })
    expect(candidate.authority).toMatchObject({
      manufacturerCadImport: "deny",
      manufacturerLandPattern: "deny-not-published",
      orientationOverlay: "deny-pending",
      placement: "deny",
      schematicIntegration: "deny",
      fabrication: "deny",
      release: "deny",
      acceptance: false
    })
  })

  it("renders only two package-outline review datums with no inferred copper", () => {
    const rendered = [
      ...renderTestCircuit(<Bp033Sn74ahct245pwrTssop20FootprintA />),
      ...renderTestCircuit(<Bp033Sn74ahct245pwrTssop20FootprintB />)
    ]
    const sources = rendered.filter(
      (element) =>
        element.type === "source_component" && ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"].includes(element.name)
    )
    expect(sources).toHaveLength(2)
    expect(
      sources.every(
        (source) => "manufacturer_part_number" in source && source.manufacturer_part_number === "SN74AHCT245PWR"
      )
    ).toBe(true)
    expect(rendered.filter((element) => element.type === "pcb_silkscreen_rect")).toHaveLength(2)
    expect(rendered.filter((element) => element.type === "pcb_silkscreen_circle")).toHaveLength(2)
    expect(
      rendered.filter((element) => ["pcb_smtpad", "pcb_plated_hole", "pcb_solder_paste"].includes(element.type))
    ).toEqual([])
    expect(rendered.filter((element) => ["pcb_courtyard_rect", "pcb_keepout"].includes(element.type))).toEqual([])
    expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("fails closed for descriptor, sparse-array, prototype, cycle, alias, accessor, and proxy drift", () => {
    const descriptorDrift = cloneWithReviewDescriptors(candidate, "accepted")
    const descriptor = Object.getOwnPropertyDescriptor(descriptorDrift, "accepted")
    if (descriptor === undefined || !("value" in descriptor)) return
    Object.defineProperty(descriptorDrift, "accepted", { ...descriptor, enumerable: false })
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(descriptorDrift)).toThrow(RangeError)

    const sparsePinMap = cloneWithReviewDescriptors(candidate, "1")
    expect(Reflect.deleteProperty(sparsePinMap.manufacturerFacts.pinMap, 1)).toBe(true)
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(sparsePinMap)).toThrow(RangeError)

    const prototypeDrift = cloneWithReviewDescriptors(candidate)
    Object.setPrototypeOf(prototypeDrift, null)
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(prototypeDrift)).toThrow(RangeError)

    const cycleDrift = structuredClone(candidate)
    Reflect.set(cycleDrift.projectGeometry, "cycle", cycleDrift.projectGeometry)
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(cycleDrift)).toThrow(RangeError)

    const aliasDrift = structuredClone(candidate)
    Reflect.set(aliasDrift.interfaceBinding.signalMap, 1, aliasDrift.interfaceBinding.signalMap[0])
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(aliasDrift)).toThrow(RangeError)

    let getterCalled = false
    const accessorDrift = structuredClone(candidate)
    Object.defineProperty(accessorDrift, "accepted", {
      configurable: true,
      get: () => {
        getterCalled = true
        throw new Error("accessor executed")
      }
    })
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(accessorDrift)).toThrow(RangeError)
    expect(getterCalled).toBe(false)

    const proxyDrift = new Proxy(structuredClone(candidate), {
      ownKeys: () => {
        throw new Error("ownKeys executed")
      }
    })
    expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(proxyDrift)).toThrow(RangeError)
  })

  it("fails closed for identity, source, pin-map, geometry, and every release gate", () => {
    const reject = (mutate: (value: Bp033Sn74ahct245pwrTssop20Footprint) => void) => {
      const drift = structuredClone(candidate) as Bp033Sn74ahct245pwrTssop20Footprint
      mutate(drift)
      expect(() => validateBp033Sn74ahct245pwrTssop20Footprint(drift)).toThrow(RangeError)
    }
    reject((value) => Reflect.set(value.canonicalIdentity, "manufacturerPartNumber", "SN74AHCT245PW"))
    reject((value) => Reflect.set(value.sourceBinding, "sourceSha256", "0".repeat(64)))
    reject((value) => Reflect.set(value.manufacturerFacts.pinMap[0], "name", "OE"))
    reject((value) => Reflect.set(value.projectGeometry.bodyOutline, "widthMm", 5))
    reject((value) => Reflect.set(value.projectGeometry.pinOneOrientation, "orientationAccepted", true))
    reject((value) => Reflect.set(value.authority, "fabrication", "allow"))
    reject((value) => Reflect.set(value.authority, "release", "allow"))
    reject((value) => Reflect.set(value, "fabricationAuthority", "allow"))
    reject((value) => Reflect.set(value, "releaseState", "allow"))
    reject((value) => Reflect.set(value, "accepted", true))
  })
})
