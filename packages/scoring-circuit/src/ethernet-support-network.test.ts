import { describe, expect, it } from "vitest"
import {
  calculateCrystalLoadEnvelope,
  ethernetCrystalLoadEnvelope,
  ethernetCrystalQualification,
  ethernetSupportNetwork,
  ethernetSupportSources,
  qualifyW5500Crystal,
  validateEthernetSupportNetwork
} from "./ethernet-support-network.js"

const validLoadInput = () => ({
  capacitorPf: 18,
  capacitorTolerancePercent: 5,
  crystalDriveMaximumUw: 200,
  crystalEsrMaximumOhm: 40,
  strayCapacitancePf: 9
})

describe("W5500 support-network selection", () => {
  it("records the WIZnet requirements and keeps both release gates denied", () => {
    expect(ethernetSupportNetwork.w5500).toMatchObject({
      normalOperationCurrentMa: 132,
      supplyMaximumV: 3.63,
      supplyMinimumV: 2.97,
      targetCrystalAgingMaximumPpmPerYear: 3,
      targetCrystalDriveLevelUw: 59.12,
      targetCrystalFrequencyMHz: 25,
      targetCrystalFrequencyToleranceMaximumPpm: 30,
      targetCrystalLoadPf: 18,
      targetCrystalNegativeResistanceMarginFactor: 5,
      targetCrystalNegativeResistanceVerificationCorners: [
        "supply-voltage",
        "temperature",
        "component-tolerance",
        "released-layout"
      ],
      targetCrystalShuntMaximumPf: 7
    })
    expect(ethernetSupportNetwork.avddPinCount).toBe(6)
    expect(ethernetSupportNetwork.requiredLocalSupplyCapacitors).toBe(7)
    expect(ethernetSupportNetwork.integrationRelease).toBe(false)
    expect(ethernetSupportNetwork.fabricationRelease).toBe(false)
    expect(ethernetSupportNetwork.releaseState).toBe("deny")
  })

  it("selects exact orderable support parts with electrical and environmental limits", () => {
    const byReference = new Map(ethernetSupportNetwork.supportNetworkComponents.map((part) => [part.reference, part]))
    expect(byReference.get("Y_W5500")).toMatchObject({
      manufacturer: "ECS Inc.",
      mpn: "ECS-250-18-33B-JGN-TR",
      package: "ECS-33B2, 3.20mm x 2.50mm x 0.80mm, 4-pad SMD, 1K reel",
      temperatureRangeC: [-40, 85],
      tolerance: "±20ppm tolerance, ±30ppm stability",
      value: "25.000MHz, 18pF load, 2pF shunt, 40Ohm maximum ESR, ±2ppm first-year aging",
      voltageOrCurrentRating: "200uW maximum drive level"
    })
    expect(byReference.get("C_W5500_XI")).toMatchObject({
      manufacturer: "TDK",
      mpn: "CGA3E2C0G1H180J080AA",
      package: "CGA3 (1608 metric), 0603, paper tape suffix AA",
      tolerance: "±5%",
      value: "18pF"
    })
    expect(byReference.get("R_W5500_EXRES")).toMatchObject({
      manufacturer: "Panasonic Industry",
      mpn: "ERJ3EKF1242V",
      tolerance: "±1%, ±100ppm/°C TCR",
      value: "12.4kOhm",
      voltageOrCurrentRating: "100mW, 75V maximum working voltage"
    })
    expect(byReference.get("R_W5500_XTAL")).toMatchObject({
      manufacturer: "Panasonic Industry",
      mpn: "ERJ3EKF1004V",
      tolerance: "±1%, ±100ppm/°C TCR",
      value: "1MOhm",
      voltageOrCurrentRating: "100mW, 75V maximum working voltage"
    })
    expect(byReference.get("R_W5500_XO")).toMatchObject({
      manufacturer: "Panasonic Industry",
      mpn: "ERJ3GEY0R00V",
      tolerance: "jumper (manufacturer page does not specify tolerance)",
      value: "0Ohm jumper",
      temperatureRangeC: [-55, 155],
      voltageOrCurrentRating:
        "manufacturer page does not specify; validate jumper current and derating in approval sheet"
    })
    expect(byReference.get("C_W5500_TOCAP")).toMatchObject({
      manufacturer: "Murata",
      mpn: "GRM21BR71C475KA73L",
      package: "0805 (2012 metric), embossed tape suffix L",
      tolerance: "±10%",
      value: "4.7uF"
    })
    expect(byReference.get("C_W5500_1V2O")).toMatchObject({
      mpn: "GRM188R71H103KA01D",
      package: "0603 (1608 metric), paper tape suffix D",
      value: "10nF"
    })
    expect(byReference.get("FB_W5500_AVDD")).toMatchObject({
      manufacturer: "Murata",
      mpn: "BLM21PG221SN1D",
      package: "0805 (2012 metric), paper tape suffix D",
      value: "220Ohm impedance at 100MHz, 0.045Ohm maximum DCR",
      voltageOrCurrentRating: "2.0A rated current at 85°C, 1.25A at 125°C"
    })

    const supplyCaps = ethernetSupportNetwork.supportNetworkComponents.filter(
      (part) => part.component === "capacitor" && part.value === "100nF"
    )
    expect(supplyCaps).toHaveLength(8)
    expect(supplyCaps.filter((part) => part.reference.startsWith("C_W5500_AVDD_")).length).toBe(6)
    expect(supplyCaps.some((part) => part.reference === "C_W5500_VDD")).toBe(true)
    expect(supplyCaps.some((part) => part.reference === "C_ETH_AVDD_FERRITE_INPUT")).toBe(true)
  })

  it("calculates the assumed 18pF crystal load window and drive margin", () => {
    expect(ethernetCrystalLoadEnvelope).toMatchObject({
      candidateDriveMaximumUw: 200,
      candidateEsrMaximumOhm: 40,
      driveHeadroomUw: expect.closeTo(140.88, 2),
      driveMarginFactor: expect.closeTo(3.383, 3),
      effectiveLoadMinimumPf: expect.closeTo(17.55, 2),
      effectiveLoadMaximumPf: expect.closeTo(18.45, 2),
      esrCheck: "requires-measured-negative-resistance",
      minimumMeasuredNegativeResistanceOhm: 200,
      negativeResistanceMarginFactor: 5,
      negativeResistanceVerificationCorners: [
        "supply-voltage",
        "temperature",
        "component-tolerance",
        "released-layout"
      ],
      targetLoadPf: 18,
      targetLoadWindowPass: true
    })
  })

  it("qualifies every published crystal characteristic and rejects the former aging value", () => {
    expect(ethernetCrystalQualification).toEqual({
      agingPass: true,
      drivePass: true,
      esrPublishedPass: true,
      frequencyPass: true,
      loadPass: true,
      negativeResistanceProductionMinimumOhm: 200,
      overallPass: false,
      publishedSpecificationPass: true,
      releasePass: false,
      shuntPass: true,
      tolerancePass: true
    })
    expect(
      qualifyW5500Crystal({
        agingMaximumPpmPerYear: 5,
        driveLevelMaximumUw: 100,
        esrMaximumOhm: 40,
        frequencyMHz: 25,
        frequencyTolerancePpm: 30,
        loadCapacitancePf: 18,
        shuntCapacitancePf: 7
      })
    ).toMatchObject({ agingPass: false, overallPass: false, publishedSpecificationPass: false })
  })

  it("keeps ESR release conservative because WIZnet does not publish negative resistance", () => {
    expect(ethernetCrystalLoadEnvelope.esrCheck).toBe("requires-measured-negative-resistance")
    expect(ethernetCrystalLoadEnvelope.minimumMeasuredNegativeResistanceOhm).toBe(200)
    expect(ethernetSupportSources.find((source) => source.manufacturer === "WIZnet")?.claims).toEqual(
      expect.arrayContaining([expect.stringContaining("59.12uW drive level")])
    )
  })

  it.each([
    [
      {
        capacitorPf: 0,
        capacitorTolerancePercent: 5,
        strayCapacitancePf: 9,
        crystalDriveMaximumUw: 200,
        crystalEsrMaximumOhm: 40
      },
      "crystal capacitor"
    ],
    [
      {
        capacitorPf: 18,
        capacitorTolerancePercent: 100,
        strayCapacitancePf: 9,
        crystalDriveMaximumUw: 200,
        crystalEsrMaximumOhm: 40
      },
      "less than 100"
    ],
    [
      {
        capacitorPf: 18,
        capacitorTolerancePercent: 5,
        strayCapacitancePf: Number.NaN,
        crystalDriveMaximumUw: 200,
        crystalEsrMaximumOhm: 40
      },
      "crystal stray capacitance"
    ],
    [
      {
        capacitorPf: 18,
        capacitorTolerancePercent: 5,
        strayCapacitancePf: 9,
        crystalDriveMaximumUw: Number.POSITIVE_INFINITY,
        crystalEsrMaximumOhm: 40
      },
      "crystal drive maximum"
    ]
  ])("rejects unsafe crystal calculation input", (input, message) => {
    expect(() => calculateCrystalLoadEnvelope(input)).toThrow(message)
  })

  it.each([
    null,
    [],
    {},
    Object.create(null),
    { ...validLoadInput(), unexpected: true },
    { ...validLoadInput(), [Symbol("forged")]: true },
    Object.defineProperty(validLoadInput(), "capacitorPf", { enumerable: true, get: () => 18 }),
    { ...validLoadInput(), capacitorTolerancePercent: -1 },
    { ...validLoadInput(), crystalEsrMaximumOhm: Number.NEGATIVE_INFINITY }
  ])("fails closed on malformed, noncanonical, or unsafe load input", (input) => {
    expect(() => calculateCrystalLoadEnvelope(input)).toThrow(RangeError)
  })

  it("fails closed on malformed qualification input", () => {
    expect(() => qualifyW5500Crystal(null)).toThrow(RangeError)
    expect(() =>
      qualifyW5500Crystal({
        agingMaximumPpmPerYear: 2,
        driveLevelMaximumUw: 200,
        esrMaximumOhm: 40,
        frequencyMHz: 25,
        frequencyTolerancePpm: 20,
        loadCapacitancePf: 18,
        shuntCapacitancePf: 2,
        unexpected: true
      })
    ).toThrow(RangeError)
  })

  it("deep-validates the canonical MPNs, sources, and topology", () => {
    expect(validateEthernetSupportNetwork(ethernetSupportNetwork)).toBe(true)

    const forgedMpn = structuredClone(ethernetSupportNetwork)
    Reflect.set(forgedMpn.supportNetworkComponents[0], "mpn", "FORGED")
    expect(() => validateEthernetSupportNetwork(forgedMpn)).toThrow(RangeError)

    const forgedSource = structuredClone(ethernetSupportNetwork)
    Reflect.set(forgedSource.sources[0], "url", "https://invalid.example")
    expect(() => validateEthernetSupportNetwork(forgedSource)).toThrow(RangeError)

    const forgedTopology = structuredClone(ethernetSupportNetwork)
    Reflect.set(forgedTopology, "avddPinCount", 5)
    expect(() => validateEthernetSupportNetwork(forgedTopology)).toThrow(RangeError)
  })

  it("rejects deep symbols and accessors without evaluating them", () => {
    const forgedSymbol = structuredClone(ethernetSupportNetwork)
    Reflect.set(forgedSymbol.supportNetworkComponents[0], Symbol("forged"), true)
    expect(() => validateEthernetSupportNetwork(forgedSymbol)).toThrow(RangeError)

    const forgedAccessor = structuredClone(ethernetSupportNetwork)
    let getterRead = false
    Object.defineProperty(forgedAccessor.w5500, "targetCrystalLoadPf", {
      enumerable: true,
      get: () => {
        getterRead = true
        return 18
      }
    })
    expect(() => validateEthernetSupportNetwork(forgedAccessor)).toThrow(RangeError)
    expect(getterRead).toBe(false)
  })
})
