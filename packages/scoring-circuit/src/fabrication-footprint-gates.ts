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
    references: ["J_WEAPON_HARNESS_L"],
    manufacturer: "Molex",
    mpn: "43650-0300",
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/436500300",
    packageEvidence: {
      body: "Micro-Fit 3.0 three-circuit right-angle through-hole PCB header",
      terminals: 3,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["pinheader", "micro-fit", "microfit", "molex-3pin"],
    releaseEvidence: [
      "Configured Molex drawing and CAD establish exact pin one, copper, solder mask, paste, courtyard, edge clearance, and right-angle cable exit",
      "Controlled 45003 and 43645-0300/43030-0007 harness build, chassis clamp, pull, vibration, ESD, analog-fault, and service evidence are accepted"
    ]
  },
  {
    references: ["J_WEAPON_HARNESS_R"],
    manufacturer: "Molex",
    mpn: "43650-0400",
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/436500400",
    packageEvidence: {
      body: "Micro-Fit 3.0 four-circuit right-angle through-hole PCB header",
      terminals: 4,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["pinheader", "micro-fit", "microfit", "molex-4pin"],
    releaseEvidence: [
      "Configured Molex drawing and CAD establish exact pin one, copper, solder mask, paste, courtyard, edge clearance, and right-angle cable exit",
      "Controlled 45004 and 43645-0400/43030-0007 harness build proves empty cavity four, insulated floating orange core, chassis clamp, pull, vibration, ESD, analog-fault, and service evidence"
    ]
  },
  {
    references: ["J_PISTE_HARNESS"],
    manufacturer: "Molex",
    mpn: "43650-0200",
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/436500200",
    packageEvidence: {
      body: "Micro-Fit 3.0 two-circuit right-angle through-hole PCB header",
      terminals: 2,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["pinheader", "micro-fit", "microfit", "molex-2pin"],
    releaseEvidence: [
      "Configured Molex drawing and CAD establish exact pin one, copper, solder mask, paste, courtyard, edge clearance, and right-angle cable exit",
      "Controlled 45002 and 43645-0200/43030-0007 harness build proves PISTE_RETURN-to-ESD_RETURN, chassis clamp, ESD, cable-coupling, vibration, and service evidence"
    ]
  },
  {
    references: ["J_PRIMARY_OUTPUTS_HARNESS"],
    manufacturer: "Molex",
    mpn: "39-29-1067",
    primaryEvidenceUrl: "https://www.molex.com/en-us/products/part-detail/39291067",
    packageEvidence: {
      body: "Mini-Fit Jr. six-circuit dual-row right-angle through-hole PCB header",
      terminals: 6,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["pinheader", "mini-fit", "minifit", "molex-6pin"],
    releaseEvidence: [
      "Configured Molex drawing and CAD establish exact pin one, copper, solder mask, paste, courtyard, edge clearance, and right-angle cable exit",
      "Controlled 45066 and 39-01-2060/39-00-0039 harness build proves five outputs plus dedicated return, chassis clamp, contact-temperature, load, fault, EMC, vibration, and service evidence"
    ]
  },
  {
    references: ["U_USB_PORT_PROTECT"],
    manufacturer: "Texas Instruments",
    mpn: "TPD4S201TRGRRQ1",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf",
    packageEvidence: {
      body: "RGR VQFN, 20 terminals plus exposed ground pad",
      terminals: 20,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["qfn20", "qfn", "vqfn"],
    releaseEvidence: [
      "Complete and independently review the manufacturer copper, solder mask, stencil, thermal-pad, and courtyard data as one CAD object",
      "Review the connector-side CC escape and VBUS ESD return before fabrication output"
    ]
  },
  {
    references: ["D_USB_PD_VBUS_TVS"],
    manufacturer: "Texas Instruments",
    mpn: "TVS2200DRVR",
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tvs2200.pdf",
    packageEvidence: {
      body: "DRV WSON, 6 terminals plus exposed ground pad",
      terminals: 6,
      orientation: "pin-1",
      thermalPad: "required"
    },
    prohibitedGenericFootprints: ["wson6", "qfn6", "qfn"],
    releaseEvidence: [
      "Complete and independently review the manufacturer copper, solder mask, stencil, thermal-pad, and courtyard data as one CAD object",
      "Verify VBUS surge return and chip-pin clamp waveform in the released layout"
    ]
  },
  {
    references: ["D_USB_PD_VBUS_DISCONNECT"],
    manufacturer: "Diodes Incorporated",
    mpn: "B340A-13-F",
    primaryEvidenceUrl: "https://www.diodes.com/datasheet/download/B340A.pdf",
    packageEvidence: {
      body: "SMA Schottky diode",
      terminals: 2,
      orientation: "polarized",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["sma", "smb", "sod123"],
    releaseEvidence: [
      "Complete and independently review the manufacturer copper, solder mask, stencil, courtyard, and cathode-band orientation data",
      "Verify the assembled cathode band against the exact reel before release"
    ]
  },
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
  },
  {
    references: ["C_V5_BUCK_IN_A", "C_V5_BUCK_IN_B"],
    manufacturer: "Murata",
    mpn: "GRM32ER7YA106KA12L",
    primaryEvidenceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM32ER7YA106KA12-01.pdf",
    packageEvidence: {
      body: "1210 MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["1210", "1206", "0805"],
    releaseEvidence: [
      "Import the exact part-specific Murata land pattern, solder mask, stencil, and courtyard from a primary source",
      "Verify effective capacitance, reflow process, and high-current input-loop placement"
    ]
  },
  {
    references: ["C_V5_BUCK_OUT_A", "C_V5_BUCK_OUT_B"],
    manufacturer: "Murata",
    mpn: "GRM32ER71E226KE15L",
    primaryEvidenceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM32ER71E226KE15-01.pdf",
    packageEvidence: {
      body: "1210 MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["1210", "1206", "0805"],
    releaseEvidence: [
      "Import the exact part-specific Murata land pattern, solder mask, stencil, and courtyard from a primary source",
      "Verify effective capacitance, reflow process, and output-loop placement"
    ]
  },
  {
    references: ["C_APP_REG_OUT_A", "C_APP_REG_OUT_B", "C_APP_REG_OUT_C"],
    manufacturer: "TDK",
    mpn: "C2012X7S1A226M125AC",
    primaryEvidenceUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7S1A226M125AC",
    packageEvidence: {
      body: "0805 MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0805", "0603", "1206"],
    releaseEvidence: [
      "Import the exact part-specific TDK land pattern, solder mask, stencil, and courtyard from a primary source",
      "Verify effective capacitance, reflow process, and regulator output-loop placement"
    ]
  },
  {
    references: ["C_APP_REG_IN_HF", "C_APP_REG_BOOT"],
    manufacturer: "Yageo KEMET",
    mpn: "C0603C104K3RACTU",
    primaryEvidenceUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en",
    packageEvidence: {
      body: "0603 MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Import the exact part-specific Yageo KEMET land pattern, solder mask, stencil, and courtyard from a primary source",
      "Verify reflow process and regulator high-frequency-loop placement"
    ]
  },
  {
    references: ["C_APP_REG_VCC"],
    manufacturer: "Murata",
    mpn: "GRM188R71A105KA61",
    primaryEvidenceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A105KA61-01.pdf",
    packageEvidence: {
      body: "0603 MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Import the exact part-specific Murata land pattern, solder mask, stencil, and courtyard from a primary source",
      "Verify reflow process and regulator VCC bypass placement"
    ]
  },
  {
    references: ["Y_W5500"],
    manufacturer: "ECS Inc.",
    mpn: "ECS-250-18-33B-JGN-TR",
    primaryEvidenceUrl: "https://www.ecsxtal.com/store/pdf/ECS-33B2.pdf",
    packageEvidence: {
      body: "ECS-33B2 3.2 mm by 2.5 mm four-pad crystal package",
      terminals: 4,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["crystal", "3225", "2520"],
    releaseEvidence: [
      "Exact ECS copper, solder mask, paste, courtyard, and pin mapping are imported and independently reviewed",
      "Crystal, load capacitors, and feedback network placement and released-layout parasitics are reviewed before oscillator qualification"
    ]
  },
  {
    references: ["C_W5500_XI", "C_W5500_XO"],
    manufacturer: "TDK",
    mpn: "CGA3E2C0G1H180J080AA",
    primaryEvidenceUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E2C0G1H180J080AA",
    packageEvidence: {
      body: "CGA3 0603 C0G MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact TDK copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "The two capacitors are placed against the crystal pins and released-layout stray capacitance is reviewed"
    ]
  },
  {
    references: ["R_W5500_XTAL"],
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3EKF1004V",
    primaryEvidenceUrl:
      "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1004V",
    packageEvidence: {
      body: "ERJ-3EK 0603 chip resistor",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact Panasonic copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "Crystal feedback placement is reviewed together with the released oscillator loop"
    ]
  },
  {
    references: ["R_W5500_XO"],
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3GEY0R00V",
    primaryEvidenceUrl:
      "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3GEY0R00V",
    packageEvidence: {
      body: "ERJ-3GEY 0603 chip jumper",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact Panasonic copper, solder mask, paste, courtyard, and delivery rating are approved for the release build",
      "Crystal series-link placement and current estimate are reviewed with the released oscillator loop"
    ]
  },
  {
    references: ["R_W5500_EXRES"],
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3EKF1242V",
    primaryEvidenceUrl:
      "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1242V",
    packageEvidence: {
      body: "ERJ-3EK 0603 chip resistor",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact Panasonic copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "EXRES analog-ground return and PHY behavior are independently reviewed on the released layout"
    ]
  },
  {
    references: ["C_W5500_TOCAP"],
    manufacturer: "Murata",
    mpn: "GRM21BR71C475KA73L",
    primaryEvidenceUrl:
      "https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/dynamic-model/component-list-d-mlcc-2504.ashx?cvid=20250523010405000000&la=en",
    packageEvidence: {
      body: "0805 X7R MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0805", "0603", "1206"],
    releaseEvidence: [
      "Exact Murata copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "TOCAP has a reviewed short trace to the W5500 and its analog behavior is verified on hardware"
    ]
  },
  {
    references: ["C_W5500_1V2O"],
    manufacturer: "Murata",
    mpn: "GRM188R71H103KA01D",
    primaryEvidenceUrl:
      "https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/dynamic-model/component-list-d-mlcc-2504.ashx?cvid=20250523010405000000&la=en",
    packageEvidence: {
      body: "0603 X7R MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact Murata copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "1V2O has a reviewed short trace and W5500 bring-up validates its required decoupling"
    ]
  },
  {
    references: [
      "C_ETH_AVDD_FERRITE_INPUT",
      "C_W5500_VDD",
      "C_W5500_AVDD_1",
      "C_W5500_AVDD_2",
      "C_W5500_AVDD_3",
      "C_W5500_AVDD_4",
      "C_W5500_AVDD_5",
      "C_W5500_AVDD_6"
    ],
    manufacturer: "Murata",
    mpn: "GRM188R71C104KA01D",
    primaryEvidenceUrl:
      "https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/dynamic-model/component-list-d-mlcc-2504.ashx?cvid=20250523010405000000&la=en",
    packageEvidence: {
      body: "0603 X7R MLCC",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0603", "0402", "0805"],
    releaseEvidence: [
      "Exact Murata copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "Ferrite-input, VDD, and each AVDD bypass location are placement-reviewed and their AVDD/VDD impedance is measured"
    ]
  },
  {
    references: ["FB_W5500_AVDD"],
    manufacturer: "Murata",
    mpn: "BLM21PG221SN1D",
    primaryEvidenceUrl: "https://www.murata.com/en-eu/api/pdfdownloadapi?cate=cgsubChipFerriBead&partno=BLM21PG221SN1D",
    packageEvidence: {
      body: "0805 chip ferrite bead",
      terminals: 2,
      orientation: "symmetric",
      thermalPad: "not-applicable"
    },
    prohibitedGenericFootprints: ["0805", "0603", "1206"],
    releaseEvidence: [
      "Exact Murata copper, solder mask, paste, and courtyard are approved for the fabricator and assembly process",
      "Ferrite current, heating, AVDD impedance, Ethernet SI, and EMC behavior are verified on released hardware"
    ]
  }
] as const satisfies readonly FabricationFootprintGate[]
