/**
 * RC-04 handheld hardware-selection contract.
 *
 * This is a frozen schematic input, not a release, procurement, firmware, or
 * factory record. Its numeric budgets are calculated targets until the stated
 * physical evidence exists.
 */
type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("RC-04 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("RC-04 data can contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  artifactKind: "encrypted-ir-handheld-hardware-selection",
  workUnit: "RC-04",
  releaseState: "deny",
  architecture: {
    handheld: "battery-powered encrypted infrared transmitter",
    apparatus: "TSOP38438 receiver to ESP32-S3 GPIO35 RMT RX through BP-126 and BP-146",
    apparatusPowerInput: "USB-C PD remains the normal apparatus power input",
    remoteChargeInput:
      "USB-C 5 V sink for remote charging only; it requests default USB current and has no PD controller",
    securityBoundary:
      "Hardware may capture or transmit pulses but never authenticates, authorizes, or dispatches a scoring command."
  },
  handheldElectronics: {
    mcuModule: {
      manufacturer: "Raytac Corporation",
      mpn: "MDBT50Q-1MV2",
      soc: "Nordic Semiconductor nRF52840 revision 2",
      package: "certified 10.5 mm x 15.5 mm x 2.05 mm module",
      antennaAndRf: {
        topology: "module-integrated chip antenna and matching network; no host RF matching parts",
        hostRule: "copy the Raytac antenna keepout and ground boundary from the current module design guide"
      },
      clocks: {
        highFrequency: "module-integrated 32 MHz crystal; no host load capacitors",
        lowFrequency: "nRF52840 internal 32.768 kHz RC oscillator selected",
        dnp: ["external 32.768 kHz crystal", "two low-frequency crystal load capacitors"]
      },
      power: {
        mode: "LDO mode",
        input: "VREMOTE_3V3",
        hostDecoupling: [
          { manufacturer: "Murata", mpn: "GRM188R71A104KA01D", value: "100 nF, 10 V, X7R" },
          { manufacturer: "Murata", mpn: "GRM188R61A475KE15D", value: "4.7 uF, 10 V, X5R" }
        ],
        integrated: "DEC4 1 uF is populated inside the module",
        dnp: ["DC-DC L2", "DC-DC L3", "DC-DC C14"]
      },
      resetAndDebug: {
        resetPullup: { manufacturer: "YAGEO", mpn: "RC0603FR-0710KL", value: "10 kohm, 1%" },
        swdioSeries: { manufacturer: "YAGEO", mpn: "RC0603FR-0722RL", value: "22 ohm, 1%" },
        swclkSeries: { manufacturer: "YAGEO", mpn: "RC0603FR-0722RL", value: "22 ohm, 1%" },
        topology: "nRESET is pulled to VREMOTE_3V3; SWDIO and SWCLK reach only the headerless service target"
      },
      powerState:
        "Module remains on VREMOTE_3V3 and enters nRF52840 System OFF; matrix inputs are the only normal wake sources. Reset, boot, and debug must leave the IR MOSFET gate pulled off.",
      basis: "1 MB flash, 256 kB RAM, 48 GPIO, integrated certified radio path, PWM, watchdog, and debug protection"
    },
    irEmitter: {
      manufacturer: "Vishay Semiconductors",
      mpn: "VSMY14940UL",
      wavelengthNm: 940,
      carrierKHz: 38,
      package: "side-view SMD, 3.0 mm x 2.61 mm x 1.2 mm",
      basis: "Manufacturer identifies this 940 nm part for remote-control operation at 38 kHz."
    },
    emitterDriver: {
      manufacturer: "Nexperia",
      mpn: "PMV16XN",
      function: "low-side N-channel MOSFET pulse switch",
      supportNetwork: [
        {
          reference: "R_IR_GATE",
          manufacturer: "YAGEO",
          mpn: "RC0603FR-07100RL",
          value: "100 ohm, 1%",
          topology: "MCU IR PWM output to PMV16XN gate"
        },
        {
          reference: "R_IR_GATE_PD",
          manufacturer: "YAGEO",
          mpn: "RC0603FR-07100KL",
          value: "100 kohm, 1%",
          topology: "PMV16XN gate to PACK-; transmitter is off during reset and high impedance"
        },
        {
          reference: "R_IR_LED",
          manufacturer: "YAGEO",
          mpn: "RC1206FR-0727RL",
          value: "27 ohm, 1%",
          topology: "PACK+ to R_IR_LED to VSMY14940UL anode; emitter cathode to PMV16XN drain; source to PACK-"
        }
      ],
      calculatedPulseCurrent:
        "Candidate current is resistor-limited; 4.20 V maximum cell minus emitter forward voltage and switch drop, divided by 27 ohm. Actual current, pulse energy, range, thermal behavior, and eye safety remain unmeasured and DENY."
    },
    switch: {
      manufacturer: "C&K",
      mpn: "KMR221G LFS",
      function: "tactile key switch",
      publishedActuationForceN: 2,
      publishedLifeCycles: 200000
    },
    buttonMatrix: {
      rows: ["P0.03", "P0.04", "P0.28", "P0.29"],
      columns: ["P0.05", "P0.06", "P0.07", "P0.08", "P0.11", "P0.12", "P0.13", "P0.14"],
      keys: 32,
      antiGhostDiode: {
        quantity: 32,
        manufacturer: "Vishay Semiconductors",
        mpn: "1N4148W-E3-08",
        package: "SOD-123",
        topology: "one diode per key, anode at its row switch and cathode at its column; no shared or omitted diode"
      },
      electricalPolicy:
        "One normally-open switch per row-column intersection, no diode omission, scan only while awake, and reject ghosted or ambiguous simultaneous presses."
    },
    battery: {
      manufacturer: "Panasonic Energy",
      mpn: "NCR18650B",
      chemistry: "Li-ion",
      nominalVoltageV: 3.6,
      typicalCapacityMah: 3350,
      minimumCapacityMah: 3250,
      chargeTemperatureC: { minimum: 10, maximum: 45 },
      state:
        "bare candidate cell; welded pack construction, enclosure fit, protection validation, thermal, transport, and service policy are denied"
    },
    cellProtection: {
      protector: { manufacturer: "Texas Instruments", mpn: "BQ29700DSER" },
      backToBackFets: { manufacturer: "Texas Instruments", mpn: "CSD85301Q2" },
      support: [
        { reference: "R_PROTECT_IN", manufacturer: "YAGEO", mpn: "RC0603FR-07330RL", value: "330 ohm, 1%" },
        { reference: "C_PROTECT", manufacturer: "Murata", mpn: "GRM188R71H104KA93D", value: "100 nF, 50 V, X7R" }
      ],
      topology:
        "CELL+ feeds BQ29700 BAT through R_PROTECT_IN; C_PROTECT is BAT to VSS; BQ29700 COUT/DOUT drive the CSD85301Q2 back-to-back FETs between CELL- and PACK-."
    },
    remoteUsbCSink: {
      receptacle: { manufacturer: "Global Connector Technology", mpn: "USB4105-GF-A" },
      ccPulldowns: {
        quantity: 2,
        manufacturer: "YAGEO",
        mpn: "RC0603FR-075K1L",
        value: "5.1 kohm, 1%",
        topology: "one resistor from CC1 to PACK- and one resistor from CC2 to PACK-"
      },
      inputProtection: {
        manufacturer: "Texas Instruments",
        mpn: "BQ24314DSGR",
        vbusPath:
          "USB VBUS passes the connector-side TPD1E10B06 ESD clamp to BQ24314 IN; BQ24314 OUT feeds MCP73831 VDD only",
        ccPath:
          "USB CC1 and CC2 pass through two TPD4S012 5.5 V signal clamps to the two 5.1 kohm Rd pulldowns; its VBUS and ID clamps are NC; USB data is absent",
        connectorEsd: {
          vbus: { manufacturer: "Texas Instruments", mpn: "TPD1E10B06DPYR", workingVoltageV: 5.5 },
          cc: { manufacturer: "Texas Instruments", mpn: "TPD4S012DRYR", protectedChannels: 2 }
        },
        currentLimit: {
          resistor: { manufacturer: "YAGEO", mpn: "RC0603FR-0750KL", valueOhm: 50000 },
          nominalLimitMa: 500,
          calculation: "25 A-kohm / 50.0 kohm = 0.500 A nominal BQ24314 input-overcurrent threshold"
        },
        batterySenseResistor: {
          manufacturer: "YAGEO",
          mpn: "RC0603FR-07100KL",
          valueOhm: 100000,
          topology: "BQ24314 VBAT to protected PACK+"
        },
        capacitors: {
          input: { manufacturer: "Murata", mpn: "GRM188R71H105KA12D", value: "1 uF, 50 V, X7R" },
          output: { manufacturer: "Murata", mpn: "GRM188R71A105KA61D", value: "1 uF, 10 V, X7R" }
        },
        faultOutput: {
          pullup: { manufacturer: "YAGEO", mpn: "RC0603FR-0710KL", value: "10 kohm, 1%" },
          topology: "BQ24314 FAULT is open drain, pulled to TEMP_3V3, and routed to a named service test point"
        },
        pinDisposition:
          "IN from connector VBUS, OUT to MCP73831 VDD, ILIM to its 50.0 kohm resistor, VBAT through 100 kohm to PACK+, CE from the fail-closed temperature inhibit, FAULT to its test point, NC open, VSS and exposed pad to PACK-",
        protection:
          "BQ24314 disconnects OUT on input overvoltage, sustained input overcurrent, battery overvoltage, or overtemperature; CE high disables OUT"
      },
      topology:
        "Connector-clamped and BQ24314-protected VBUS supplies MCP73831 VDD only; protected CC1/CC2 terminate in Rd; USB data and SuperSpeed pins are not connected; shield treatment remains an EMC layout gate; no USB-PD controller is present."
    },
    chargeTemperatureInhibit: {
      sensor: { manufacturer: "Texas Instruments", mpn: "TMP390A2DRLR" },
      usbPoweredRail: {
        regulator: { manufacturer: "Texas Instruments", mpn: "TPS70933DBVR", outputV: 3.3, inputMaximumV: 30 },
        inputCapacitor: { manufacturer: "Murata", mpn: "GRM188R71H105KA12D", value: "1 uF, 50 V, X7R" },
        outputCapacitor: { manufacturer: "Murata", mpn: "GRM188R71A225KE15D", value: "2.2 uF, 10 V, X7R" },
        topology:
          "TPD1E10B06-clamped connector VBUS powers TPS70933 with EN tied to IN; TEMP_3V3 powers TMP390 and the open-drain NAND only while USB charging power is present"
      },
      thresholds: {
        hot: {
          nominalTripC: 42,
          setResistor: { manufacturer: "YAGEO", mpn: "RC0603FR-072K49L", valueOhm: 2490 }
        },
        cold: {
          nominalTripC: 15,
          hysteresisC: 5,
          setResistor: { manufacturer: "YAGEO", mpn: "RC0603FR-0714KL", valueOhm: 14000 }
        }
      },
      support: {
        outputPullups: {
          quantity: 2,
          manufacturer: "YAGEO",
          mpn: "RC0603FR-0710KL",
          value: "10 kohm, 1%"
        },
        bypass: {
          quantity: 2,
          manufacturer: "Murata",
          mpn: "GRM188R71A104KA01D",
          value: "100 nF, 10 V, X7R",
          topology: "one at TMP390 VDD and one at SN74LVC1G38 VCC"
        },
        validWindowNand: { manufacturer: "Texas Instruments", mpn: "SN74LVC1G38DCKR", output: "open drain" },
        chargeEnableBias: {
          upper: { manufacturer: "YAGEO", mpn: "RC0603FR-0710KL", valueOhm: 10000 },
          lower: { manufacturer: "YAGEO", mpn: "RC0603FR-0710KL", valueOhm: 10000 },
          normalUsbCalculation: "4.75 V to 5.25 V divided by two gives CE 2.375 V to 2.625 V, above 1.4 V VIH"
        },
        chargeEnableClamp: { manufacturer: "Nexperia", mpn: "BZT52-C3V3", nominalVoltageV: 3.3 },
        chargeEnableTopology:
          "10 kohm from connector VBUS to BQ24314 CE and 10 kohm from CE to PACK-, with BZT52-C3V3 cathode at CE and anode at PACK-; the divider holds CE high at normal USB voltage, the Zener limits connector overvoltage, and the open-drain NAND may only pull CE low"
      },
      failClosedTopology:
        "TMP390 hot and cold outputs must both be high before SN74LVC1G38 can pull active-low BQ24314 CE low. The connector-VBUS pullup and 3.3 V clamp hold CE high during startup, invalid threshold resistance, temperature fault, lost TEMP_3V3, or logic disconnection, so BQ24314 OUT remains disconnected from the charger.",
      physicalPlacement: "TMP390 must be thermally bonded to the protected cell pack, not placed beside the charger",
      state: "exact hardware inhibit selected; threshold accuracy, thermal coupling, and trip testing remain DENY"
    },
    charger: {
      manufacturer: "Microchip",
      mpn: "MCP73831T-2ACI/OT",
      input: "5 V USB-C sink input only, no USB-PD contract",
      chargeCurrentMa: 250,
      progResistor: { manufacturer: "YAGEO", mpn: "RC0603FR-074KL", valueOhm: 4000, tolerancePercent: 1 },
      inputCapacitor: { manufacturer: "Murata", mpn: "GRM188R61C475KE11D", valueUf: 4.7 },
      outputCapacitor: { manufacturer: "Murata", mpn: "GRM188R61C475KE11D", valueUf: 4.7 },
      programmingCalculation: "1000 V / 4.000 kohm = 250 mA nominal fast-charge target",
      thermalAssumptions: {
        allowedCellTemperatureC: { minimum: 10, maximum: 45 },
        chargerSpecifiedAmbientC: { minimum: -40, maximum: 85 },
        sot23ThetaJaCPerW: 230,
        usbInputVoltageV: { minimum: 4.75, nominal: 5, maximum: 5.25 },
        policy:
          "The USB-powered TMP390 and fail-closed BQ24314 enable path inhibits charging outside a conservative nominal 15 C to 42 C window even when the cell rail is depleted. Firmware cannot override the hardware inhibit; depleted-cell dissipation, copper area, threshold accuracy, thermal coupling, and regulation require measurement."
      },
      basis: "Single-cell 4.20 V Li-ion controller; exact 250 mA network is a candidate pending thermal and pack tests."
    },
    regulator: {
      manufacturer: "Texas Instruments",
      mpn: "TPS62743YFPR",
      outputV: 3.3,
      inductor: { manufacturer: "Murata", mpn: "LQH2MCN2R2M52L", valueUh: 2.2 },
      inputCapacitor: { manufacturer: "Murata", mpn: "GRM188R61A106KE69D", valueUf: 10 },
      outputCapacitor: { manufacturer: "Murata", mpn: "GRM188R61A106KE69D", valueUf: 10 },
      selectionPins:
        "VSEL2, VSEL1, and VSEL0 strapped for the data-sheet 3.3 V selection; schematic review must verify the package-ball mapping",
      basis: "2 V to 5.5 V buck converter, 300 mA maximum output, 360 nA typical quiescent current."
    },
    debugAndTest: {
      debugCableManufacturer: "Tag-Connect",
      debugCableMpn: "TC2050-IDC-NL-050-ALL",
      targetInterface: {
        populatedHeader: false,
        manufacturerFootprintId: "TC2050-IDC-NL-FP",
        drawingRevision: "A; 2010-12-02",
        conductivePads: { count: 10, diameterMm: 0.787, toleranceMm: 0.076, solderPaste: false },
        nonPlatedAlignmentHoles: { count: 3, diameterMm: 0.991, toleranceMm: 0.076 },
        contactPadSignalClearanceMinimumMm: 0.508,
        keepout: "No tracks or vias in the manufacturer-shaded keepout; import the official pattern without redrawing."
      },
      retention: {
        manufacturer: "Tag-Connect",
        mpn: "TC2050-CLIP-3PACK",
        use: "clip attaches to the three alignment pins from the PCB underside for temporary service retention only"
      },
      requiredSignals: ["SWDIO", "SWCLK", "nRESET", "VTREF", "GND"],
      requiredTestPoints: ["BAT+", "VREMOTE_3V3", "IR_LED_ANODE", "IR_LED_CATHODE", "MATRIX_ROW0", "MATRIX_COL0"],
      servicePolicy: "Debug access must be locked in field firmware and enabled only by a controlled service procedure."
    }
  },
  calculatedTargets: {
    operatingRange: { frontalM: 20, evidence: "not measured" },
    batteryLife: {
      targetHours: 300,
      manufacturerMinimumCapacityMah: 3250,
      reserveFraction: 0.2,
      availableCapacityMah: 2600,
      maximumAverageCurrentMa: 8.667,
      calculation: "3250 mAh manufacturer minimum x (1 - 0.20 reserve) / 300 h = 8.667 mA"
    },
    latency: {
      remoteGestureToEmitterEdgeMsMaximum: 20,
      emitterEdgeToAuthenticatedEventMsMaximum: 50,
      endToEndMsMaximum: 70,
      evidence: "not measured"
    },
    resetAndFault: {
      resetToTransmitInhibitMsMaximum: 10,
      invalidOrFloodedInputAcceptedCommands: 0,
      recoveryAfterQuietIntervalMsMaximum: 1000,
      evidence: "not measured"
    },
    service: {
      chargeCurrentMa: 250,
      debugSupplyVoltageV: 3.3,
      testPointProbeMinimumClearanceMm: 2.54,
      evidence: "not measured"
    }
  },
  physicalEvidence: {
    partsDatasheetsReviewed: true,
    apparatusReceiverLinked: true,
    apparatusUsbCPdPreserved: true,
    moduleRfLayoutApproved: false,
    moduleClockAndPowerMeasured: false,
    temperatureInhibitMeasured: false,
    usbInputProtectionMeasured: false,
    emitterCurrentAndEyeSafetyMeasured: false,
    chargerThermalMeasured: false,
    cellProtectionValidated: false,
    range20mMeasured: false,
    batteryProfileMeasured: false,
    latencyMeasured: false,
    resetAndFloodMeasured: false,
    buttonErgonomicsApproved: false,
    enclosureFitApproved: false,
    industrialDesignApproved: false,
    footprintReleased: false,
    procurementAuthorized: false,
    fabricationAuthorized: false
  },
  requiredEvidenceBeforeRelease: [
    "Review the complete LED pulse-current, thermal, optical-power, and IEC 62471 eye-safety calculation against the actual emitter drive waveform.",
    "Measure 1000 valid encrypted frames at 20 m frontal and 100 frames at 20 m at plus or minus 15 degrees in declared ambient light.",
    "Measure the declared 300-hour battery-use profile including low-battery behavior, charging temperature, and aging reserve.",
    "Measure remote gesture to authenticated apparatus event latency, reset behavior, flood recovery, and false-accept count.",
    "Approve labels, button spacing, enclosure, window material, service access, and production footprints independently."
  ],
  sources: [
    "https://docs.nordicsemi.com/r/bundle/ps_nrf52840/page/keyfeatures_html5.html",
    "https://www.raytac.com/product/ins.php?index_id=24",
    "https://www.raytac.com/document/",
    "https://www.vishay.com/en/product/80542/",
    "https://www.nexperia.com/product/PMV16XN",
    "https://www.vishay.com/docs/86356/1n4148w.pdf",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
    "https://yageogroup.com/component-documentation/download/specsheet/RC1206FR-0727RL",
    "https://www.ckswitches.com/media/2233/shortform_nov2017-sc.pdf",
    "https://na.industrial.panasonic.com/sites/default/pidsa/files/ncr18650b.pdf",
    "https://www.ti.com/product/BQ2970",
    "https://www.ti.com/product/CSD85301Q2",
    "https://gct.co/connector/usb4105",
    "https://www.ti.com/product/BQ24314",
    "https://www.ti.com/product/TPD1E10B06",
    "https://www.ti.com/product/TPD4S012",
    "https://www.ti.com/lit/gpn/TMP390",
    "https://www.ti.com/product/TPS709",
    "https://www.ti.com/product/SN74LVC1G38",
    "https://www.nexperia.com/product/BZT52-C3V3",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-075K1L",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-0750KL",
    "https://ww1.microchip.com/downloads/en/DeviceDoc/MCP73831-Family-Data-Sheet-DS20001984H.pdf",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-074KL",
    "https://www.murata.com/products/productdetail?partno=GRM188R61C475KE11%23",
    "https://www.murata.com/products/productdetail?partno=GRM188R71H105KA12%23",
    "https://www.murata.com/products/productdetail?partno=GRM188R71A105KA61%23",
    "https://www.murata.com/products/productdetail?partno=GRM188R71A225KE15%23",
    "https://www.ti.com/product/TPS62743",
    "https://www.murata.com/en-global/products/productdetail?partno=LQH2MCN2R2M52L%23",
    "https://www.murata.com/en-global/products/productdetail?partno=GRM188R61A106KE69%23",
    "https://www.tag-connect.com/product/tc2050-idc-nl-050-all",
    "https://www.tag-connect.com/wp-content/uploads/bsk-pdf-manager/TC2050-IDC-NL_Datasheet_8.pdf",
    "https://www.vishay.com/docs/82491/tsop382.pdf"
  ]
} as const

export const remoteControlHardwareSelection = deepFreeze(definition)

/** Rejects substitutions, evidence relaxation, and accidental release authority. */
export function validateRemoteControlHardwareSelection(value: unknown): true {
  if (!sameDataGraph(value, remoteControlHardwareSelection)) {
    throw new RangeError("RC-04 must exactly match the reviewed handheld hardware-selection contract")
  }
  const contract = remoteControlHardwareSelection
  if (
    contract.workUnit !== "RC-04" ||
    contract.releaseState !== "deny" ||
    contract.handheldElectronics.mcuModule.mpn !== "MDBT50Q-1MV2" ||
    contract.handheldElectronics.mcuModule.soc !== "Nordic Semiconductor nRF52840 revision 2" ||
    contract.handheldElectronics.mcuModule.antennaAndRf.topology.includes("integrated") === false ||
    contract.handheldElectronics.mcuModule.clocks.lowFrequency.includes("internal") === false ||
    contract.handheldElectronics.mcuModule.power.mode !== "LDO mode" ||
    contract.handheldElectronics.mcuModule.power.hostDecoupling.length !== 2 ||
    contract.handheldElectronics.mcuModule.power.dnp.length !== 3 ||
    contract.handheldElectronics.irEmitter.wavelengthNm !== 940 ||
    contract.handheldElectronics.irEmitter.carrierKHz !== 38 ||
    contract.handheldElectronics.emitterDriver.supportNetwork.length !== 3 ||
    contract.handheldElectronics.buttonMatrix.keys !== 32 ||
    contract.handheldElectronics.buttonMatrix.antiGhostDiode.quantity !== 32 ||
    contract.handheldElectronics.buttonMatrix.antiGhostDiode.mpn !== "1N4148W-E3-08" ||
    contract.handheldElectronics.buttonMatrix.rows.length * contract.handheldElectronics.buttonMatrix.columns.length !==
      32 ||
    contract.handheldElectronics.debugAndTest.debugCableMpn !== "TC2050-IDC-NL-050-ALL" ||
    contract.handheldElectronics.debugAndTest.targetInterface.populatedHeader ||
    contract.handheldElectronics.debugAndTest.targetInterface.manufacturerFootprintId !== "TC2050-IDC-NL-FP" ||
    contract.handheldElectronics.debugAndTest.targetInterface.conductivePads.count !== 10 ||
    contract.handheldElectronics.debugAndTest.targetInterface.nonPlatedAlignmentHoles.count !== 3 ||
    contract.handheldElectronics.remoteUsbCSink.receptacle.mpn !== "USB4105-GF-A" ||
    contract.handheldElectronics.remoteUsbCSink.ccPulldowns.quantity !== 2 ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.mpn !== "BQ24314DSGR" ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.connectorEsd.vbus.mpn !== "TPD1E10B06DPYR" ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.connectorEsd.cc.mpn !== "TPD4S012DRYR" ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.currentLimit.resistor.valueOhm !== 50000 ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.batterySenseResistor.valueOhm !== 100000 ||
    contract.handheldElectronics.remoteUsbCSink.inputProtection.faultOutput.pullup.mpn !== "RC0603FR-0710KL" ||
    contract.handheldElectronics.chargeTemperatureInhibit.sensor.mpn !== "TMP390A2DRLR" ||
    contract.handheldElectronics.chargeTemperatureInhibit.usbPoweredRail.regulator.mpn !== "TPS70933DBVR" ||
    contract.handheldElectronics.chargeTemperatureInhibit.thresholds.hot.nominalTripC !== 42 ||
    contract.handheldElectronics.chargeTemperatureInhibit.thresholds.cold.nominalTripC !== 15 ||
    contract.handheldElectronics.chargeTemperatureInhibit.support.validWindowNand.mpn !== "SN74LVC1G38DCKR" ||
    contract.handheldElectronics.chargeTemperatureInhibit.support.bypass.quantity !== 2 ||
    contract.handheldElectronics.chargeTemperatureInhibit.support.chargeEnableBias.upper.valueOhm !== 10000 ||
    contract.handheldElectronics.chargeTemperatureInhibit.support.chargeEnableBias.lower.valueOhm !== 10000 ||
    contract.handheldElectronics.chargeTemperatureInhibit.support.chargeEnableClamp.mpn !== "BZT52-C3V3" ||
    contract.handheldElectronics.chargeTemperatureInhibit.failClosedTopology.includes("hold CE high") === false ||
    contract.handheldElectronics.charger.progResistor.valueOhm !== 4000 ||
    contract.handheldElectronics.charger.chargeCurrentMa !== 250 ||
    contract.handheldElectronics.cellProtection.protector.mpn !== "BQ29700DSER" ||
    contract.handheldElectronics.cellProtection.backToBackFets.mpn !== "CSD85301Q2" ||
    contract.handheldElectronics.regulator.inductor.mpn !== "LQH2MCN2R2M52L" ||
    contract.architecture.apparatusPowerInput !== "USB-C PD remains the normal apparatus power input" ||
    contract.architecture.remoteChargeInput.includes("remote charging only") === false ||
    contract.calculatedTargets.operatingRange.frontalM !== 20 ||
    contract.calculatedTargets.batteryLife.targetHours !== 300 ||
    contract.calculatedTargets.batteryLife.manufacturerMinimumCapacityMah !== 3250 ||
    contract.calculatedTargets.batteryLife.maximumAverageCurrentMa !== 8.667 ||
    contract.calculatedTargets.latency.endToEndMsMaximum !== 70 ||
    contract.calculatedTargets.resetAndFault.invalidOrFloodedInputAcceptedCommands !== 0 ||
    contract.physicalEvidence.range20mMeasured ||
    contract.physicalEvidence.moduleRfLayoutApproved ||
    contract.physicalEvidence.moduleClockAndPowerMeasured ||
    contract.physicalEvidence.temperatureInhibitMeasured ||
    contract.physicalEvidence.usbInputProtectionMeasured ||
    contract.physicalEvidence.chargerThermalMeasured ||
    contract.physicalEvidence.cellProtectionValidated ||
    contract.physicalEvidence.batteryProfileMeasured ||
    contract.physicalEvidence.latencyMeasured ||
    contract.physicalEvidence.resetAndFloodMeasured ||
    contract.physicalEvidence.fabricationAuthorized
  ) {
    throw new RangeError("RC-04 must retain exact candidates, numeric targets, and denied physical-release gates")
  }
  return true
}
