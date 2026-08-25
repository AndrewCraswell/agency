import { describe, expect, it } from "vitest"
import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import { findCommunicationsFootprintEvidence } from "./communications-footprint-evidence.js"
import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

describe("bench prototype BOM baseline", () => {
  it("selects exact processors, isolation, and wired Ethernet identities", () => {
    expect(validateBenchPrototypeBom(benchPrototypeBom)).toBe(true)

    const selectedByReference = new Map(
      benchPrototypeBom.rows.filter((row) => row.disposition === "selected").map((row) => [row.reference, row.mpn])
    )
    expect(Object.fromEntries(selectedByReference)).toMatchObject({
      U_SCORING: "STM32G474RET3TR",
      U_APP: "ESP32-S3-WROOM-1U-N16R2",
      U_ISO_MAIN: "ISO7762FDWR",
      U_ISO_AUX: "ISO7721FDR",
      U_ISO_POWER: "NXE1S0505MC",
      U_REF: "REF5025AQDRQ1",
      U_W5500: "W5500",
      J_ETH: "7499011121A",
      J_USB_C: "10177070-00011LF",
      U_USB_PD: "TPS25730ADREFR",
      U_USB_PORT_PROTECT: "TPD4S201TRGRRQ1",
      U_USB2_ESD: "TPD2EUSB30DRTR",
      J_LAB_INJECTION: "43045-0400",
      S_POWER_SOURCE_SELECTOR: "7101SYZQE",
      D_USB_PD_VBUS_TVS: "TVS2200DRVR",
      D_USB_PD_VBUS_DISCONNECT: "B340A-13-F",
      U_EFUSE: "TPS259474ARPWR",
      C_USB_PD_PPHV: "T523H107M035APE070",
      C_USB_PD_LDO: "T55A106M010C0200",
      U_DISPLAY_BUFFER_A: "SN74AHCT245PWR",
      U_DISPLAY_BUFFER_B: "SN74AHCT245PWR"
    })
  })

  it("keeps CC/SBU and USB 2.0 protection ownership distinct", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB_PORT_PROTECT")?.function).toBe(
      "USB-C CC1, CC2, SBU1, and SBU2 short-to-VBUS protection"
    )
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB2_ESD")?.function).toBe(
      "Native USB 2.0 low-capacitance ESD protection"
    )
  })

  it("classifies diagnostic injection as test-only and hard-selected", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_LAB_INJECTION")).toMatchObject({
      disposition: "selected",
      mpn: "43045-0400",
      function: "Test-only 20 V, 2.3 A post-eFuse diagnostic injection connector"
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "S_POWER_SOURCE_SELECTOR")).toMatchObject({
      disposition: "selected",
      mpn: "7101SYZQE"
    })
  })

  it("accounts for the selected external Adafruit 2277 panel", () => {
    expect(benchPrototypeBom.externalItems).toEqual([
      expect.objectContaining({
        itemId: "DISPLAY_PANEL",
        selection: "selected-external",
        manufacturer: "Adafruit Industries",
        productId: "2277",
        interface: "HUB75, 64x32, 1/16 scan"
      })
    ])
  })

  it("includes the committed W5500 support references as selected rows", () => {
    const selectedReferences = new Set(
      benchPrototypeBom.rows.filter((row) => row.disposition === "selected").map((row) => row.reference)
    )
    for (const reference of [
      "Y_W5500",
      "C_W5500_XI",
      "R_W5500_XTAL",
      "R_W5500_XO",
      "C_W5500_XO",
      "R_W5500_EXRES",
      "C_W5500_TOCAP",
      "C_W5500_1V2O",
      "FB_W5500_AVDD"
    ]) {
      expect(selectedReferences.has(reference)).toBe(true)
    }
  })

  it("binds U_W5500 to the exact manufacturer-backed LQFP package", () => {
    const row = benchPrototypeBom.rows.find((candidate) => candidate.reference === "U_W5500")
    const evidence = findCommunicationsFootprintEvidence("W5500")

    expect(row).toMatchObject({
      mpn: "W5500",
      package: "LQFP-48, 7mm x 7mm body, 0.5mm pitch"
    })
    expect(evidence).toMatchObject({
      mpn: "W5500",
      package: "LQFP-48",
      body: "7 mm x 7 mm, 48-pin LQFP; 0.5 mm pitch"
    })
  })

  it("binds U_REF to the exact TI D SOIC-8 orderable package", () => {
    expect(benchPrototypeBom.rows.find((candidate) => candidate.reference === "U_REF")).toMatchObject({
      manufacturer: "Texas Instruments",
      mpn: "REF5025AQDRQ1",
      package: "D SOIC-8, 5.0mm x 3.9mm body, 1.27mm pitch",
      source: { kind: "component-decision", url: "https://www.ti.com/product/REF5025A-Q1" }
    })
  })

  it("records the NXE1 manufacturer package positions without releasing a project footprint", () => {
    const row = benchPrototypeBom.rows.find((candidate) => candidate.reference === "U_ISO_POWER")

    expect(row).toMatchObject({
      mpn: "NXE1S0505MC",
      package:
        "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect"
    })
    expect(benchPrototypeBom.releaseState).toBe("deny")
    expect(benchPrototypeBom.fabricationRelease).toBe(false)
  })

  it("keeps unresolved analog, connector, and USB power scope explicit", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_ANALOG_CELL_1")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_WEAPON_HARNESS")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_PRIMARY_OUTPUTS")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_USB_C")?.disposition).toBe("selected")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB_PD")?.disposition).toBe("selected")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB_PD_STRAPS")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB2_SERIES")?.disposition).toBe("TBD")
  })

  it("requires selected rows to carry orderable metadata", () => {
    for (const row of benchPrototypeBom.rows.filter((candidate) => candidate.disposition === "selected")) {
      expect(row.quantity).toBeGreaterThan(0)
      expect(row.manufacturer).toBeTruthy()
      expect(row.mpn).toBeTruthy()
      expect(["active", "active-preferred", "unresolved"]).toContain(row.lifecycle)
      expect(row.package).toBeTruthy()
      expect(row.source?.url).toMatch(/^https:\/\//)
    }
    for (const reference of ["D_USB_PD_VBUS_DISCONNECT", "C_USB_PD_PPHV", "C_USB_PD_LDO"]) {
      expect(benchPrototypeBom.rows.find((row) => row.reference === reference)?.lifecycle).toBe("unresolved")
    }
  })

  it("deep-freezes the exported canonical baseline", () => {
    expect(Object.isFrozen(benchPrototypeBom)).toBe(true)
    expect(Object.isFrozen(benchPrototypeBom.rows)).toBe(true)
    expect(Object.isFrozen(benchPrototypeBom.rows[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeBom.rows[0]?.source)).toBe(true)
    expect(() => Object.defineProperty(benchPrototypeBom.rows[0], "mpn", { value: "forged" })).toThrow(TypeError)
    expect(validateBenchPrototypeBom(benchPrototypeBom)).toBe(true)
  })

  it("rejects duplicate references, malformed selected rows, and release-like flags", () => {
    const duplicate = { ...benchPrototypeBom, rows: [...benchPrototypeBom.rows, benchPrototypeBom.rows[0]] }
    expect(() => validateBenchPrototypeBom(duplicate)).toThrow(RangeError)

    const first = benchPrototypeBom.rows[0]
    const malformed = {
      ...benchPrototypeBom,
      rows: [{ ...first, package: undefined }, ...benchPrototypeBom.rows.slice(1)]
    }
    expect(() => validateBenchPrototypeBom(malformed)).toThrow(RangeError)

    const releaseLike = { ...benchPrototypeBom, isOrderBom: true as const }
    expect(() => validateBenchPrototypeBom(releaseLike)).toThrow(RangeError)
  })

  it("fails closed for unknown runtime values", () => {
    for (const value of [null, undefined, [], "bom", { rows: [] }, { ...benchPrototypeBom, rows: null }]) {
      expect(() => validateBenchPrototypeBom(value)).toThrow(RangeError)
    }
  })

  it("rejects symbols, extras, accessors, and non-plain prototypes", () => {
    const symbolBom = structuredClone(benchPrototypeBom)
    Object.defineProperty(symbolBom, Symbol("hidden"), { enumerable: true, value: true })
    expect(() => validateBenchPrototypeBom(symbolBom)).toThrow(RangeError)

    expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, unexpected: true })).toThrow(RangeError)

    const accessorBom = structuredClone(benchPrototypeBom)
    Object.defineProperty(accessorBom, "rows", {
      enumerable: true,
      get: () => {
        throw new Error("accessor must never execute")
      }
    })
    expect(() => validateBenchPrototypeBom(accessorBom)).toThrow(RangeError)

    const prototypeBom = structuredClone(benchPrototypeBom)
    Object.setPrototypeOf(prototypeBom.rows[0], { injected: true })
    expect(() => validateBenchPrototypeBom(prototypeBom)).toThrow(RangeError)
  })

  it("rejects sparse arrays, aliases, and cycles", () => {
    const sparseRows: unknown[] = []
    sparseRows.length = benchPrototypeBom.rows.length
    sparseRows[0] = benchPrototypeBom.rows[0]
    expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, rows: sparseRows })).toThrow(RangeError)

    const aliasedRows = [...benchPrototypeBom.rows]
    aliasedRows[1] = aliasedRows[0]
    expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, rows: aliasedRows })).toThrow(RangeError)

    const cycleBom = structuredClone(benchPrototypeBom)
    Object.defineProperty(cycleBom.rows[0], "source", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: cycleBom.rows[0]
    })
    expect(() => validateBenchPrototypeBom(cycleBom)).toThrow(RangeError)

    const sourceAliasBom = structuredClone(benchPrototypeBom)
    Object.defineProperty(sourceAliasBom.rows[1], "source", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: sourceAliasBom.rows[0]?.source
    })
    expect(() => validateBenchPrototypeBom(sourceAliasBom)).toThrow(RangeError)
  })

  it("binds selected metadata to its exact provenance", () => {
    for (const [reference, change] of [
      ["U_REF", { mpn: "forged-mpn" }],
      ["U_REF", { package: "wrong-package" }],
      ["U_DISPLAY_BUFFER_A", { manufacturer: "Not TI" }],
      ["U_DISPLAY_BUFFER_B", { lifecycle: "active-preferred" }],
      ["Y_W5500", { mpn: "wrong-crystal" }],
      ["D_USB_PD_VBUS_DISCONNECT", { package: "wrong-SMA" }]
    ] as const) {
      const rows = benchPrototypeBom.rows.map((row) => (row.reference === reference ? { ...row, ...change } : row))
      expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, rows })).toThrow(RangeError)
    }

    const rows = benchPrototypeBom.rows.map((row) =>
      row.reference === "U_REF" && row.source !== undefined
        ? { ...row, source: { ...row.source, url: "https://example.com/forged" } }
        : row
    )
    expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, rows })).toThrow(RangeError)
  })

  it("does not let mutable imported evidence redefine canonical provenance", () => {
    const decision = componentDecisions.find((candidate) => candidate.mpn === "REF5025AQDRQ1")
    const ethernet = ethernetSupportNetwork.supportNetworkComponents.find(
      (candidate) => candidate.reference === "Y_W5500"
    )
    const usbPd = usbPdFootprints.find((candidate) => candidate.mpn === "B340A-13-F")
    if (decision === undefined || ethernet === undefined || usbPd === undefined)
      throw new Error("test evidence missing")

    const decisionDescriptor = Object.getOwnPropertyDescriptor(decision, "manufacturer")
    const ethernetDescriptor = Object.getOwnPropertyDescriptor(ethernet, "manufacturer")
    const usbPdDescriptor = Object.getOwnPropertyDescriptor(usbPd.drawing, "url")
    if (decisionDescriptor === undefined || ethernetDescriptor === undefined || usbPdDescriptor === undefined) {
      throw new Error("test evidence descriptor missing")
    }

    try {
      Object.defineProperty(decision, "manufacturer", {
        ...decisionDescriptor,
        value: "Forged decision manufacturer"
      })
      Object.defineProperty(ethernet, "manufacturer", {
        ...ethernetDescriptor,
        value: "Forged Ethernet manufacturer"
      })
      Object.defineProperty(usbPd.drawing, "url", {
        ...usbPdDescriptor,
        value: "https://example.com/forged-usb-pd-footprint"
      })

      expect(validateBenchPrototypeBom(benchPrototypeBom)).toBe(true)

      const forgedRows = benchPrototypeBom.rows.map((row) => {
        if (row.reference === "U_REF") return { ...row, manufacturer: "Forged decision manufacturer" }
        if (row.reference === "Y_W5500") return { ...row, manufacturer: "Forged Ethernet manufacturer" }
        if (row.reference === "D_USB_PD_VBUS_DISCONNECT" && row.source !== undefined) {
          return { ...row, source: { ...row.source, url: "https://example.com/forged-usb-pd-footprint" } }
        }
        return row
      })
      expect(() => validateBenchPrototypeBom({ ...benchPrototypeBom, rows: forgedRows })).toThrow(RangeError)
    } finally {
      Object.defineProperty(decision, "manufacturer", decisionDescriptor)
      Object.defineProperty(ethernet, "manufacturer", ethernetDescriptor)
      Object.defineProperty(usbPd.drawing, "url", usbPdDescriptor)
    }
  })
})
