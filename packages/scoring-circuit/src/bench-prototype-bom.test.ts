import { describe, expect, it } from "vitest"
import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import { findCommunicationsFootprintEvidence } from "./communications-footprint-evidence.js"
import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

describe("bench prototype BOM baseline", () => {
  it("selects the minimal ESP32, power, Ethernet, display, and IR identities", () => {
    expect(validateBenchPrototypeBom(benchPrototypeBom)).toBe(true)

    const selectedByReference = new Map(
      benchPrototypeBom.rows.filter((row) => row.disposition === "selected").map((row) => [row.reference, row.mpn])
    )
    expect(Object.fromEntries(selectedByReference)).toMatchObject({
      U_APP: "ESP32-S3-WROOM-1U-N16R2",
      R_ESP_BOOT_PULLUP: "RC0603FR-0710KL",
      R_ESP_EN_PULLUP: "RC0603FR-0710KL",
      C_ESP_EN_DELAY: "C1608X5R1A105K080AC",
      C_ESP_3V3_HF: "GCM188R71H104KA57D",
      C_ESP_3V3_BULK: "GCM32EC71A476KE02L",
      U_APP_SUPERVISOR: "TPS389033DSER",
      U_APP_WDOG: "TPS3431SDRBR",
      C_APP_SUPERVISOR_CT_AND_BYPASS: "C0603C104K3RACTU",
      C_APP_WDOG_BYPASS: "C0603C104K3RACTU",
      R_APP_WDOG_TIMEOUT: "RC0603FR-0710KL",
      R_APP_WDI_PULLUP: "RC0603FR-07100KL",
      U_REF: "REF5025AQDRQ1",
      U_APP_REGULATOR: "LMR43620MSC3RPERQ1",
      L_APP_REGULATOR: "XGL4030-222MEC",
      C_APP_REG_IN: "C2012X7R1E475K125AB",
      C_APP_REG_IN_HF: "C0603C104K3RACTU",
      C_APP_REG_BOOT: "C0603C104K3RACTU",
      C_APP_REG_VCC: "885012206052",
      C_APP_REG_OUT_A: "C2012X7S1A226M125AC",
      C_APP_REG_OUT_B: "C2012X7S1A226M125AC",
      C_APP_REG_OUT_C: "C2012X7S1A226M125AC",
      R_APP_REG_DISCHARGE: "RC0603FR-071KL",
      U_W5500: "W5500",
      J_ETH: "7499011121A",
      J_USB_C: "10177070-00011LF",
      U_USB_PD: "TPS25730ADREFR",
      U_USB_PORT_PROTECT: "TPD4S201TRGRRQ1",
      U_USB_DATA_PROTECT: "TPD2EUSB30DRTR",
      D_USB_PD_VBUS_TVS: "TVS2200DRVR",
      D_USB_PD_VBUS_DISCONNECT: "B340A-13-F",
      U_EFUSE: "TPS259474ARPWR",
      C_USB_PD_PPHV: "T523H107M035APE070",
      C_USB_PD_LDO: "T55A106M010C0200",
      U_DISPLAY_BUFFER_A: "SN74AHCT245PWR",
      U_DISPLAY_BUFFER_B: "SN74AHCT245PWR",
      J_HUB75: "TST-108-04-G-D-RA",
      R_HUB75_SIGNAL_DEFAULTS: "RC0603FR-0710KL",
      R_HUB75_PANEL_OE_PULLUP: "RC0603FR-0710KL",
      C_HUB75_BUFFER_BYPASS: "C0603C104K3RACTU",
      Q_DISPLAY_ENABLE: "BSS138AKA",
      R_DISPLAY_ENABLE_PULLUP_AND_GATE: "RC0603FR-0710KL",
      R_DISPLAY_ENABLE_GATE_PD: "RC0603FR-07100KL",
      U_V5_BUCK: "TPS56A37RPAR",
      U_IR_RX: "TSOP38438",
      R_IR_VS: "RC0603FR-07100RL",
      C_IR_VS: "C0603C104K3RACTU",
      R_IR_OUT: "RC0603FR-07100RL",
      R_IR_PULLUP: "RC0603FR-0710KL",
      TP_IR_RX: "5001"
    })
  })

  it("explicitly removes dual-MCU and nonessential application parts", () => {
    for (const reference of [
      "U_SCORING",
      "U_ISO_MAIN",
      "U_ISO_AUX",
      "U_ISO_POWER",
      "U_SCORING_REG",
      "U_SCORING_WDOG",
      "U_SCORING_SUPERVISOR",
      "J_STM32_SWD",
      "J_ESP32_SERVICE",
      "J_LAB_INJECTION",
      "S_POWER_SOURCE_SELECTOR",
      "U_FRAM",
      "U_RTC",
      "U_SECURE_ELEMENT",
      "U_AUDIO",
      "J_SPEAKER",
      "ANT_EXTERNAL"
    ]) {
      expect(benchPrototypeBom.rows.find((row) => row.reference === reference)).toMatchObject({
        disposition: "DNP",
        quantity: 0
      })
    }
  })

  it("makes every populated ESP32 support part explicit", () => {
    expect(
      benchPrototypeBom.rows.filter((row) => row.source?.kind === "processor-support").map((row) => row.reference)
    ).toEqual(
      expect.arrayContaining([
        "R_ESP_BOOT_PULLUP",
        "R_ESP_EN_PULLUP",
        "C_ESP_EN_DELAY",
        "C_ESP_3V3_HF",
        "C_ESP_3V3_BULK"
      ])
    )
  })

  it("replaces the stale application-regulator placeholder with every exact physical support row", () => {
    const applicationRailRows = benchPrototypeBom.rows.filter((row) => row.source?.kind === "application-rail")
    expect(applicationRailRows.map((row) => row.reference)).toEqual([
      "U_APP_REGULATOR",
      "L_APP_REGULATOR",
      "C_APP_REG_IN",
      "C_APP_REG_IN_HF",
      "C_APP_REG_BOOT",
      "C_APP_REG_VCC",
      "C_APP_REG_OUT_A",
      "C_APP_REG_OUT_B",
      "C_APP_REG_OUT_C",
      "R_APP_REG_DISCHARGE"
    ])
    expect(applicationRailRows.every((row) => row.disposition === "selected" && row.quantity === 1)).toBe(true)
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_APP_REG")).toBeUndefined()
  })

  it("selects one reset/watchdog domain and one shared HUB75 enable gate", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_APP_SUPERVISOR")).toMatchObject({
      disposition: "selected",
      mpn: "TPS389033DSER",
      quantity: 1
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_APP_WDOG")).toMatchObject({
      disposition: "selected",
      mpn: "TPS3431SDRBR",
      quantity: 1
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "Q_DISPLAY_ENABLE")).toMatchObject({
      disposition: "selected",
      mpn: "BSS138AKA",
      quantity: 1
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_HUB75_SIGNAL_DEFAULTS")?.quantity).toBe(16)
  })

  it("keeps CC/SBU and USB 2.0 protection ownership distinct", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB_PORT_PROTECT")).toMatchObject({
      function: "USB-C CC1, CC2, SBU1, and SBU2 short-to-VBUS protection",
      mpn: "TPD4S201TRGRRQ1",
      package: "VQFN-20 (RGR), 3.5mm x 3.5mm nominal body"
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB_DATA_PROTECT")).toMatchObject({
      function: "Native USB 2.0 low-capacitance ESD protection",
      mpn: "TPD2EUSB30DRTR",
      package: "SOT-9X3 (DRT), 3-pin"
    })
  })

  it("uses USB-C PD as the only populated power input", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_LAB_INJECTION")).toMatchObject({
      disposition: "DNP",
      quantity: 0
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "S_POWER_SOURCE_SELECTOR")).toMatchObject({
      disposition: "DNP",
      quantity: 0
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_USB_C")?.disposition).toBe("selected")
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

  it("does not populate the obsolete isolated processor supply", () => {
    const row = benchPrototypeBom.rows.find((candidate) => candidate.reference === "U_ISO_POWER")

    expect(row).toMatchObject({
      disposition: "DNP",
      quantity: 0
    })
    expect(benchPrototypeBom.releaseState).toBe("deny")
    expect(benchPrototypeBom.fabricationRelease).toBe(false)
  })

  it("keeps unresolved analog, primary-output, and USB power scope explicit", () => {
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_ANALOG_CELL_1")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_WEAPON_HARNESS")).toMatchObject({
      disposition: "DNP",
      quantity: 0
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_ANALOG_ISO_POWER")).toMatchObject({
      disposition: "DNP",
      quantity: 0
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_PRIMARY_OUTPUTS")?.disposition).toBe("TBD")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "J_USB_C")?.disposition).toBe("selected")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_USB_PD")?.disposition).toBe("selected")
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB_PD_STRAPS")).toBeUndefined()
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB2_SERIES")).toBeUndefined()
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB_PD_ADCIN1_UP")).toMatchObject({
      disposition: "selected",
      mpn: "RC0402FR-0724K9L"
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "C_USB_PD_VBUS")).toMatchObject({
      disposition: "selected",
      mpn: "GRM21BR71H475KA73L"
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "R_USB_DP_SERIES")).toMatchObject({
      disposition: "selected",
      mpn: "RC0402FR-0722RL"
    })
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_PRIMARY_OUTPUT_LATCH")).toBeUndefined()
    expect(benchPrototypeBom.rows.find((row) => row.reference === "U_PRIMARY_OUTPUT_DRIVER")?.disposition).toBe("TBD")
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
