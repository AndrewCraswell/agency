export type FabricationFootprintGate = {
  /** Circuit references that must remain non-placeable until this gate is closed. */
  readonly references: readonly string[]
  readonly manufacturer: string
  readonly mpn: string
  readonly primaryEvidenceUrl: string
  readonly packageEvidence: {
    readonly body: string
    readonly terminals: number
    readonly orientation: "polarized" | "pin-1" | "symmetric"
    readonly thermalPad: "required" | "not-applicable"
  }
  /** Generic library names are intentionally prohibited for the selected MPN. */
  readonly prohibitedGenericFootprints: readonly string[]
  /** Artwork required before an exact footprint may replace the DNP model. */
  readonly releaseEvidence: readonly string[]
}

// These are not footprints. They are the evidence contract for components whose
// generic tscircuit library pattern would be unsafe to export as fabrication data.
// A component listed here must have doNotPlace and emit no copper pads.
export const fabricationFootprintGates = [
  {
    references: ["L_APP_REGULATOR"],
    manufacturer: "Coilcraft",
    mpn: "XGL4030-222MEC",
    primaryEvidenceUrl: "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf",
    packageEvidence: {
      body: "XGL4030 molded inductor, 4.3 mm maximum by 4.3 mm maximum",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0402", "0603", "0805", "1206", "1210", "2512", "2924"],
    releaseEvidence: [
      "Coilcraft-recommended land pattern imported from the primary mechanical drawing or approved CAD package",
      "Independent review of terminal copper, solder mask, paste apertures, courtyard, and pin-1-independent pad mapping",
      "Released copper thermal and load-transient test at 50 C blocked-vent ambient"
    ]
  },
  {
    references: ["J_USB_C"],
    manufacturer: "Amphenol Communications Solutions",
    mpn: "10177070-00011LF",
    primaryEvidenceUrl: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf",
    packageEvidence: {
      body: "Right-angle USB 2.0 Type-C receptacle for 0.80 mm PCB, 16 contacts plus shell features",
      terminals: 16,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["usb_c", "usb-c", "type-c"],
    releaseEvidence: [
      "Official Amphenol drawing and exact STEP model imported together",
      "All contact pads, shell stakes, paste apertures, courtyard, board edge, 0.80 mm thickness, and mating-axis orientation overlaid in CAD",
      "Chassis support transfers plug load independently of the SMT joints"
    ]
  },
  {
    references: ["U_USB_PD"],
    manufacturer: "Texas Instruments",
    mpn: "TPS25730ADREFR",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tps25730a.pdf",
    packageEvidence: {
      body: "DRE WQFN, 6 mm by 4 mm",
      terminals: 38,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["qfn38", "qfn", "wqfn"],
    releaseEvidence: [
      "TI DRE package drawing and recommended land pattern imported without substitution",
      "All 38 terminals, pin-1 orientation, exposed thermal pad, via policy, paste windowing, solder mask, and courtyard independently reviewed",
      "PD power-path and chip-pin surge layout review completed"
    ]
  },
  {
    references: ["U_EFUSE"],
    manufacturer: "Texas Instruments",
    mpn: "TPS259474ARPWR",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
    packageEvidence: {
      body: "RPW VQFN-HR",
      terminals: 10,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["qfn10", "qfn", "vqfn"],
    releaseEvidence: [
      "TI RPW package drawing and recommended land pattern imported without substitution",
      "All 10 terminals, pin-1 orientation, exposed thermal pad, via policy, paste windowing, solder mask, and courtyard independently reviewed",
      "20 V, 3 A eFuse copper temperature and fault tests completed"
    ]
  },
  {
    references: ["U_V5_BUCK"],
    manufacturer: "Texas Instruments",
    mpn: "TPS56A37RPAR",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tps56a37.pdf",
    packageEvidence: {
      body: "RPA VQFN-HR, 3 mm by 3 mm",
      terminals: 10,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["qfn10", "qfn", "vqfn"],
    releaseEvidence: [
      "TI RPA package drawing and recommended land pattern imported without substitution",
      "All 10 terminals, pin-1 orientation, exposed thermal pad, via policy, paste windowing, solder mask, and courtyard independently reviewed",
      "High-current switching loop, thermal, startup, and load-transient layout review completed"
    ]
  },
  {
    references: ["L_V5_BUCK"],
    manufacturer: "Wurth Elektronik",
    mpn: "744325330",
    primaryEvidenceUrl: "https://www.we-online.com/components/products/datasheet/744325330.pdf",
    packageEvidence: {
      body: "WE-HCI high-current shielded power inductor",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["we-pad-12mm", "we-hci", "inductor"],
    releaseEvidence: [
      "Exact Wurth mechanical drawing and recommended land pattern imported for 744325330",
      "Terminal copper, solder mask, paste apertures, courtyard, and symmetric terminal mapping independently reviewed",
      "Released switching-loop copper, inductance under bias, and blocked-vent thermal performance validated"
    ]
  },
  {
    references: ["R_V5_SENSE"],
    manufacturer: "Bourns",
    mpn: "CRE2512-FZ-R002E-3",
    primaryEvidenceUrl: "https://www.bourns.com/docs/product-datasheets/cre.pdf",
    packageEvidence: {
      body: "CRE 2512, 3 W current-sense resistor",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["2512", "2010", "1206"],
    releaseEvidence: [
      "Bourns mechanical drawing or approved CAD package establishes the exact land pattern",
      "Terminal copper, paste apertures, courtyard, current path, and Kelvin-sense escape independently reviewed",
      "Shunt terminal temperature and telemetry calibration completed at continuous and repeated peak load"
    ]
  },
  {
    references: ["C_USB_PD_LDO"],
    manufacturer: "Vishay",
    mpn: "T55A106M010C0200",
    primaryEvidenceUrl: "https://www.vishay.com/docs/40030/t55.pdf",
    packageEvidence: {
      body: "T55 polymer tantalum, 1206 case",
      terminals: 2,
      orientation: "polarized",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["1206", "1210", "2924"],
    releaseEvidence: [
      "Vishay case drawing and polarity marking verified for the exact MPN",
      "Anode/cathode pad mapping, paste apertures, courtyard, and polarized assembly orientation independently reviewed"
    ]
  },
  {
    references: ["U_APP_REGULATOR"],
    manufacturer: "Texas Instruments",
    mpn: "LMR43620MSC3RPERQ1",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf",
    packageEvidence: {
      body: "RPE VQFN-HR, 2 mm by 2 mm",
      terminals: 9,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["qfn9", "qfn", "vqfn"],
    releaseEvidence: [
      "TI RPE package drawing and recommended land pattern imported without substitution",
      "All 9 terminals, pin-1 orientation, HotRod thermal copper, via policy, paste windowing, solder mask, and courtyard independently reviewed",
      "V5-to-3.3 V switching-loop, transient, and blocked-vent thermal layout validation completed"
    ]
  },
  {
    references: ["C_USB_PD_PPHV", "C_EFUSE_OUT"],
    manufacturer: "KEMET",
    mpn: "T523H107M035APE070",
    primaryEvidenceUrl: "https://content.kemet.com/datasheets/KEM_T2076_T52X-530.pdf",
    packageEvidence: {
      body: "T523 H-case polymer tantalum, EIA 7360-20",
      terminals: 2,
      orientation: "polarized",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["2924", "2917", "1210", "7360"],
    releaseEvidence: [
      "KEMET case drawing and polarity marking verified for the exact MPN",
      "Anode/cathode pad mapping, paste apertures, courtyard, and polarized assembly orientation independently reviewed",
      "PD/eFuse output capacitor ripple-current, surge, and temperature validation completed"
    ]
  }
] as const satisfies readonly FabricationFootprintGate[]
