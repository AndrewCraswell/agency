import { productionHarnessSelection } from "./production-harness-selection.js"

export type ReadinessStatus = "pending" | "source-identified" | "verified"

export type ConnectorPhysicalEvidence = {
  cableMpn?: string
  connectorGender?: string
  contactRating: string
  cycleRating: string
  exactSampleMpns?: readonly string[]
  interface:
    | "ethernet-rj45"
    | "interboard-power"
    | "interboard-usb2"
    | "locking-power"
    | "piste-harness"
    | "primary-output-harness"
    | "reel-socket"
    | "usb-c"
    | "weapon-harness"
  keying?: string
  mateHousingMpn?: string
  mateMpn?: string
  mounting: "panel-chassis" | "pcb-harness" | "pcb-with-chassis-support"
  openGates: readonly string[]
  pairAssignment?: string
  pinAssignment?: string
  retention: string
  service?: string
  shield: string
  terminalMpn?: string
}

export type CriticalPartReadiness = {
  assembly: "application-carrier" | "communications-module" | "external-panel-module" | "scoring-io-board"
  blockers: readonly string[]
  cad: {
    status: "manufacturer-verified" | "supplier-candidate" | "not-applicable" | "pending"
    url?: string
  }
  evidenceUrls: readonly string[]
  footprint: {
    status: ReadinessStatus | "not-applicable"
    description: string
    url?: string
  }
  manufacturer: string
  mechanical: {
    status: ReadinessStatus
    description: string
  }
  mpn: string
  // Optional at the type boundary so validation can report a missing record; required for external-panel-module entries.
  physical?: ConnectorPhysicalEvidence
  productionApproved: boolean
  references: readonly string[]
  selectionStatus: "candidate" | "selected"
}

export const criticalPartReadiness = [
  {
    assembly: "scoring-io-board",
    blockers: [
      "Obtain the configured Molex 43650-0300 and 43645-0300 drawings and exact CAD, then review pin one, copper, solder mask, paste, courtyard, board edge, latch, and exit clearance",
      "Release the three-conductor 45003 harness drawing with 43030-0007 crimp tooling, pull force, continuity, pinout, label, chassis clamp, vibration, ESD, and analog-fault tests"
    ],
    cad: { status: "pending", url: "https://www.molex.com/en-us/products/part-detail/436500300" },
    evidenceUrls: [
      "https://www.molex.com/en-us/products/part-detail/436500300",
      "https://www.molex.com/en-us/products/part-detail/436450300",
      "https://www.molex.com/en-us/products/part-detail/430300007",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45003"
    ],
    footprint: {
      status: "pending",
      description: "Exact right-angle three-circuit Micro-Fit 3.0 header artwork remains unimported"
    },
    manufacturer: "Molex",
    mechanical: {
      status: "pending",
      description: "Chassis clamp and socket-module harness load path remain unverified"
    },
    mpn: "43650-0300",
    physical: {
      cableMpn: "45003",
      connectorGender: "male right-angle PCB header",
      contactRating: "7 A per contact component candidate; system current and temperature remain qualification gates",
      cycleRating: "30 mating cycles component candidate; configured drawing and qualification remain gates",
      interface: "weapon-harness",
      keying: "Three-circuit polarized Micro-Fit 3.0 latch; header size is the left-weapon noninterchange feature",
      mateHousingMpn: "43645-0300",
      mateMpn: "43645-0300 housing with 43030-0007 female crimp terminals",
      mounting: "pcb-harness",
      openGates: [
        "Configured drawing, CAD, copper, solder mask, paste, courtyard, and board-edge review",
        "Controlled 45003 harness build, chassis clamp, pull, vibration, ESD, analog-fault, and de-energized service tests"
      ],
      pinAssignment: "1 WEAPON_A, 2 WEAPON_B, 3 WEAPON_C",
      retention:
        "Chassis clamp within 25 mm transfers all body-cord socket and cable load; latch and PCB solder joints are not load paths",
      service: "De-energize the apparatus before mating; J_L is a distinct off-board chassis socket cluster",
      shield: "No cable shield or chassis bond; A, B, and C enter connector-side ESD and analog-fault protection",
      terminalMpn: "43030-0007"
    },
    productionApproved: false,
    references: ["J_WEAPON_HARNESS_L"],
    selectionStatus: "selected"
  },
  {
    assembly: "scoring-io-board",
    blockers: [
      "Obtain the configured Molex 43650-0400 and 43645-0400 drawings and exact CAD, then review pin one, copper, solder mask, paste, courtyard, board edge, latch, and exit clearance",
      "Release the four-conductor 45004 harness drawing with cavity four empty, orange core insulated and floating, 43030-0007 crimp tooling, pull force, continuity, pinout, label, chassis clamp, vibration, ESD, and analog-fault tests"
    ],
    cad: { status: "pending", url: "https://www.molex.com/en-us/products/part-detail/436500400" },
    evidenceUrls: [
      "https://www.molex.com/en-us/products/part-detail/436500400",
      "https://www.molex.com/en-us/products/part-detail/436450400",
      "https://www.molex.com/en-us/products/part-detail/430300007",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45004"
    ],
    footprint: {
      status: "pending",
      description: "Exact right-angle four-circuit Micro-Fit 3.0 header artwork remains unimported"
    },
    manufacturer: "Molex",
    mechanical: {
      status: "pending",
      description: "Chassis clamp and socket-module harness load path remain unverified"
    },
    mpn: "43650-0400",
    physical: {
      cableMpn: "45004",
      connectorGender: "male right-angle PCB header",
      contactRating: "7 A per contact component candidate; system current and temperature remain qualification gates",
      cycleRating: "30 mating cycles component candidate; configured drawing and qualification remain gates",
      interface: "weapon-harness",
      keying:
        "Four-circuit polarized Micro-Fit 3.0 latch; header size is the right-weapon noninterchange feature and empty cavity four is not a key",
      mateHousingMpn: "43645-0400",
      mateMpn: "43645-0400 housing with 43030-0007 female crimp terminals",
      mounting: "pcb-harness",
      openGates: [
        "Configured drawing, CAD, copper, solder mask, paste, courtyard, and board-edge review",
        "Controlled 45004 harness build, empty-cavity and floating-orange-core inspection, chassis clamp, pull, vibration, ESD, analog-fault, and de-energized service tests"
      ],
      pinAssignment: "1 WEAPON_A, 2 WEAPON_B, 3 WEAPON_C, 4 EMPTY_CAVITY_NO_TERMINAL",
      retention:
        "Chassis clamp within 25 mm transfers all body-cord socket and cable load; latch and PCB solder joints are not load paths",
      service: "De-energize the apparatus before mating; J_R is a distinct off-board chassis socket cluster",
      shield:
        "No cable shield or chassis bond; the trimmed orange core stays insulated and floating and does not enter cavity four",
      terminalMpn: "43030-0007"
    },
    productionApproved: false,
    references: ["J_WEAPON_HARNESS_R"],
    selectionStatus: "selected"
  },
  {
    assembly: "scoring-io-board",
    blockers: [
      "Obtain the configured Molex 43650-0200 and 43645-0200 drawings and exact CAD, then review pin one, copper, solder mask, paste, courtyard, board edge, latch, and exit clearance",
      "Release the 45002 harness drawing with 43030-0007 crimp tooling, pull force, continuity, return mapping, chassis clamp, ESD, cable-coupling, and de-energized service tests"
    ],
    cad: { status: "pending", url: "https://www.molex.com/en-us/products/part-detail/436500200" },
    evidenceUrls: [
      "https://www.molex.com/en-us/products/part-detail/436500200",
      "https://www.molex.com/en-us/products/part-detail/436450200",
      "https://www.molex.com/en-us/products/part-detail/430300007",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45002"
    ],
    footprint: {
      status: "pending",
      description: "Exact right-angle two-circuit Micro-Fit 3.0 header artwork remains unimported"
    },
    manufacturer: "Molex",
    mechanical: { status: "pending", description: "Chassis clamp and harness service clearance remain unverified" },
    mpn: "43650-0200",
    physical: {
      cableMpn: "45002",
      connectorGender: "male right-angle PCB header",
      contactRating: "7 A per contact component candidate; system current and temperature remain qualification gates",
      cycleRating: "30 mating cycles component candidate; configured drawing and qualification remain gates",
      interface: "piste-harness",
      keying: "Two-circuit polarized Micro-Fit 3.0 latch; header size is the piste noninterchange feature",
      mateHousingMpn: "43645-0200",
      mateMpn: "43645-0200 housing with 43030-0007 female crimp terminals",
      mounting: "pcb-harness",
      openGates: [
        "Configured drawing, CAD, copper, solder mask, paste, courtyard, and board-edge review",
        "Controlled 45002 harness build, chassis clamp, ESD-return, cable-coupling, pull, vibration, and de-energized service tests"
      ],
      pinAssignment: "1 PISTE, 2 PISTE_RETURN",
      retention: "Chassis clamp within 25 mm transfers cable load; latch and PCB solder joints are not load paths",
      service: "De-energize the apparatus before mating or unmating",
      shield:
        "No cable shield, drain, or chassis bond; pin two is insulated PISTE_RETURN into connector-side ESD_RETURN",
      terminalMpn: "43030-0007"
    },
    productionApproved: false,
    references: ["J_PISTE_HARNESS"],
    selectionStatus: "selected"
  },
  {
    assembly: "scoring-io-board",
    blockers: [
      "Obtain the configured Molex 39-29-1067 and 39-01-2060 drawings and exact CAD, then review pin one, copper, solder mask, paste, courtyard, board edge, latch, and exit clearance",
      "Release the 45066 harness drawing with 39-00-0039 crimp tooling, contact-temperature, load-current, lamp and buzzer fault, common-return, chassis clamp, EMC, pull, vibration, and de-energized service tests"
    ],
    cad: { status: "pending", url: "https://www.molex.com/en-us/products/part-detail/39291067" },
    evidenceUrls: [
      "https://www.molex.com/en-us/products/part-detail/39291067",
      "https://www.molex.com/en-us/products/part-detail/39012060",
      "https://www.molex.com/en-us/products/part-detail/39000039",
      "https://www.alphawire.com/disteAPI/SpecPDF/DownloadProductSpecPdf?productPartNumber=45066"
    ],
    footprint: {
      status: "pending",
      description: "Exact right-angle six-circuit Mini-Fit Jr. header artwork remains unimported"
    },
    manufacturer: "Molex",
    mechanical: {
      status: "pending",
      description: "Chassis clamp, lamp-module harness load path, and service clearance remain unverified"
    },
    mpn: "39-29-1067",
    physical: {
      cableMpn: "45066",
      connectorGender: "male right-angle PCB header",
      contactRating:
        "9 A per contact component candidate; channel and common-return current plus temperature remain qualification gates",
      cycleRating: "30 mating cycles component candidate; configured drawing and qualification remain gates",
      interface: "primary-output-harness",
      keying: "Six-circuit dual-row Mini-Fit Jr. polarized latch is distinct from all Micro-Fit scoring harnesses",
      mateHousingMpn: "39-01-2060",
      mateMpn: "39-01-2060 housing with 39-00-0039 female crimp terminals",
      mounting: "pcb-harness",
      openGates: [
        "Configured drawing, CAD, copper, solder mask, paste, courtyard, and board-edge review",
        "Controlled 45066 harness build, chassis clamp, pull, vibration, contact-temperature, lamp and buzzer load, fault, EMC, and de-energized service tests"
      ],
      pinAssignment: "1 LAMP_RED, 2 LAMP_GREEN, 3 LAMP_WHITE_L, 4 LAMP_WHITE_R, 5 BUZZER, 6 PRIMARY_RETURN",
      retention:
        "Chassis clamp within 25 mm transfers all lamp and buzzer cable load; latch, mounting flange, and PCB solder joints are not load paths",
      service:
        "De-energize the apparatus before mating or unmating; primary outputs retain five outputs and one dedicated return",
      shield: "No cable shield, drain, or chassis bond; pin six is the dedicated primary-output return",
      terminalMpn: "39-00-0039"
    },
    productionApproved: false,
    references: ["J_PRIMARY_OUTPUTS_HARNESS"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Import and independently verify the manufacturer land pattern against the module drawing",
      "Review antenna keepout, RF connector access, and assigned GPIOs before placement approval"
    ],
    cad: {
      status: "manufacturer-verified",
      url: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1U_20220720.glb"
    },
    evidenceUrls: [
      "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
      "https://www.espressif.com/en/products/modules/esp32-s3/esp32-s3-wroom-1"
    ],
    footprint: {
      status: "source-identified",
      description: "Espressif ESP32-S3-WROOM-1U recommended land pattern",
      url: "https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1U%20PCB%20Footprint.dxf"
    },
    manufacturer: "Espressif",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer drawing and 3D model identify an 18 mm by 19.2 mm module body"
    },
    mpn: "ESP32-S3-WROOM-1U-N16R2",
    productionApproved: false,
    references: ["U_ESP32"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Import and independently verify the TI RPE VQFN-HR land pattern, exposed pad, stencil, and thermal copper",
      "Prove the TPS56A37-generated V5 rail remains 4.75 V to 5.25 V at the regulator across source, load, and temperature corners",
      "Measure effective output capacitance under DC bias and temperature, load transient response, startup, discharge, and blocked-vent thermal performance",
      "Verify at the TPS389033 SENSE/VDD and ESP32 3V3 pins that DC distribution loss and transient droop remain inside the executable 20 mV and 70 mV budgets",
      "Scope brownout assertion across the allowed rail-collapse slopes because TPS3890 falling propagation delay has no guaranteed maximum"
    ],
    cad: {
      status: "pending",
      url: "https://www.ti.com/product/LMR43620-Q1"
    },
    evidenceUrls: ["https://www.ti.com/product/LMR43620-Q1", "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf"],
    footprint: {
      status: "source-identified",
      description: "TI RPE VQFN-HR 2 mm x 2 mm, 9-pin HotRod package with exposed thermal pad",
      url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf"
    },
    manufacturer: "Texas Instruments",
    mechanical: {
      status: "source-identified",
      description: "TI package outline and land-pattern guidance for the 2 mm x 2 mm RPE package"
    },
    mpn: "LMR43620MSC3RPERQ1",
    productionApproved: false,
    references: ["U_APP_REGULATOR"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Confirm the exact assembled CT capacitor retains at least 61.2 nF effective capacitance across initial tolerance, temperature, DC bias, and lifetime aging",
      "Measure TPS389033 reset-release delay at voltage, temperature, and lot corners and verify the 53.04 ms calculated minimum",
      "Import the exact part-specific Yageo KEMET 0603 land pattern, solder mask, stencil, and courtyard before any PCB artwork is enabled",
      "Independently verify the regulator input, bootstrap, reset-timing, and bypass assembly placements"
    ],
    cad: { status: "not-applicable" },
    evidenceUrls: ["https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"],
    footprint: {
      status: "source-identified",
      description: "Yageo KEMET 0603 / 1608 MLCC package dimensions",
      url: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"
    },
    manufacturer: "Yageo KEMET",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer specification identifies the 1.6 mm by 0.8 mm 0603 body"
    },
    mpn: "C0603C104K3RACTU",
    productionApproved: false,
    references: [
      "C_STM_SUPERVISOR_CT",
      "C_STM_SUPERVISOR_BYPASS",
      "C_ESP_SUPERVISOR_CT",
      "C_ESP_SUPERVISOR_BYPASS",
      "C_APP_REG_IN_HF",
      "C_APP_REG_BOOT"
    ],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Import the exact Coilcraft XGL4030 recommended land pattern and independently verify terminal, mask, paste, courtyard, and polarity-independent pin mapping",
      "Replace the intentional do-not-place no-footprint circuit representation before generating fabrication outputs",
      "Measure inductor temperature and regulator transient response with the released copper geometry at the declared load and 50 C blocked-vent ambient"
    ],
    cad: {
      status: "pending",
      url: "https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xgl/xgl4030/xgl4030-222/"
    },
    evidenceUrls: [
      "https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xgl/xgl4030/xgl4030-222/",
      "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf"
    ],
    footprint: {
      status: "pending",
      description:
        "Exact Coilcraft XGL4030 land pattern is intentionally absent; generic 0402 substitution is prohibited",
      url: "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf"
    },
    manufacturer: "Coilcraft",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer XGL4030 drawing controls the body, terminal, and height envelope"
    },
    mpn: "XGL4030-222MEC",
    productionApproved: false,
    references: ["L_APP_REGULATOR"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Independently verify the Yageo 0603 land pattern and assembly substitution controls",
      "Measure APP_PGOOD low level and ESP32 EN_RESET release level and rise time at voltage and temperature corners"
    ],
    cad: { status: "not-applicable" },
    evidenceUrls: ["https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"],
    footprint: {
      status: "source-identified",
      description: "Yageo RC 0603 / 1608 thick-film resistor package dimensions",
      url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
    },
    manufacturer: "Yageo",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer specification identifies the 1.6 mm by 0.8 mm 0603 body"
    },
    mpn: "RC0603FR-0710KL",
    productionApproved: false,
    references: ["R_ESP_EN_PULLUP", "R_APP_REG_PGOOD"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Resolve the eFuse worst-low current-limit conflict with the declared 100 ms V5 peak without changing the USB-PD contract by assumption",
      "Import and independently verify the TI RPA VQFN-HR land pattern, exposed pad, stencil, and thermal copper",
      "Prove regulator VIN remains within 28 V recommended and 32 V absolute maximum at its pins during PD, eFuse, ESD, EFT, and surge events",
      "Measure V5 load-step, panel startup, short-circuit recovery, effective MLCC capacitance, and blocked-vent thermal performance with the selected HUB75 panel"
    ],
    cad: {
      status: "pending",
      url: "https://www.ti.com/product/TPS56A37/part-details/TPS56A37RPAR"
    },
    evidenceUrls: [
      "https://www.ti.com/product/TPS56A37/part-details/TPS56A37RPAR",
      "https://www.ti.com/lit/ds/symlink/tps56a37.pdf",
      "https://www.ti.com/lit/ug/slvuct3/slvuct3.pdf"
    ],
    footprint: {
      status: "source-identified",
      description: "TI RPA VQFN-HR 3 mm x 3 mm, 10-pin HotRod package with exposed thermal pad",
      url: "https://www.ti.com/lit/ds/symlink/tps56a37.pdf"
    },
    manufacturer: "Texas Instruments",
    mechanical: {
      status: "source-identified",
      description: "TI package outline and EVM layout identify the 3 mm x 3 mm RPA package and thermal-pad dependency"
    },
    mpn: "TPS56A37RPAR",
    productionApproved: false,
    references: ["U_V5_BUCK"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Import and independently verify the Bourns 2512 land pattern, copper keepout, solder paste, and Kelvin sense escape",
      "Verify the selected 3 W shunt's temperature coefficient, pulse/overload behavior, and terminal temperature at continuous and repeated peak V5 load",
      "Calibrate INA238 current telemetry after the shunt, routing, and production assembly are fixed"
    ],
    cad: {
      status: "pending",
      url: "https://www.bourns.com/docs/product-datasheets/cre.pdf"
    },
    evidenceUrls: [
      "https://www.bourns.com/docs/product-datasheets/cre.pdf",
      "https://www.bourns.com/products/resistors/current-sense-resistors/surface-mount-current-sense-resistors/cre"
    ],
    footprint: {
      status: "source-identified",
      description:
        "Bourns CRE 2512 two-terminal current-sense resistor land-pattern evidence is pending independent CAD import; separate Kelvin PCB traces must reach its terminal pads",
      url: "https://www.bourns.com/docs/product-datasheets/cre.pdf"
    },
    manufacturer: "Bourns",
    mechanical: {
      status: "source-identified",
      description: "Bourns CRE data sheet identifies the 2512 package and 3 W rated resistor option"
    },
    mpn: "CRE2512-FZ-R002E-3",
    productionApproved: false,
    references: ["R_V5_SENSE"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Import and independently review the exact Molex header land pattern, solder mask, paste, courtyard, keying, and pin one against the controlled harness drawing",
      "Verify equal-length 20 AWG parallel conductors, copper escapes, voltage drop, current sharing, contact temperature, and de-energized service at the 3 A apparatus limit"
    ],
    cad: {
      status: "pending",
      url: "https://www.molex.com/en-us/products/connectors/wire-to-board-connectors/micro-fit-30-connectors"
    },
    evidenceUrls: ["https://www.molex.com/en-us/products/connectors/wire-to-board-connectors/micro-fit-30-connectors"],
    footprint: {
      status: "pending",
      description:
        "Exact Molex Micro-Fit 3.0 four-circuit carrier header land pattern, mask, paste, and courtyard remain unimported"
    },
    manufacturer: "Molex",
    mechanical: {
      status: "pending",
      description: "Header keying, harness strain relief, and enclosure service clearance remain unverified"
    },
    mpn: "43045-0400",
    physical: {
      connectorGender: "male right-angle PCB header",
      contactRating: "Two 20 AWG positive contacts and two 20 AWG returns; project limit 1.5 A per contact",
      cycleRating: "30-cycle project qualification minimum; manufacturer durability and derating remain drawing gates",
      interface: "interboard-power",
      keying: "Micro-Fit 3.0 four-circuit polarized latch; exact key and orientation require drawing overlay",
      mateMpn: "43025-0400 housing with 43030-0007 female crimp terminals",
      mounting: "pcb-harness",
      openGates: [
        "Obtain configured header, housing, terminal, and harness drawings and overlay pin one, latch, copper, mask, paste, and courtyard",
        "Complete current-sharing, voltage-drop, contact-temperature, retention, vibration, mis-mate, and de-energized service tests"
      ],
      pairAssignment: "not applicable; equal-length parallel power and return conductors",
      pinAssignment: "1 V20_EFUSE_OUT_A, 2 GND_A, 3 V20_EFUSE_OUT_B, 4 GND_B",
      retention:
        "Positive Micro-Fit latch plus harness tie-down within 25 mm; PCB solder joints are not the service load path",
      service: "External USB-C removed and V20_EFUSE_OUT discharged before mating or unmating",
      shield: "No shield and no chassis contact; both returns are APP_GND"
    },
    productionApproved: false,
    references: ["J_PWR_CARRIER"],
    selectionStatus: "selected"
  },
  {
    assembly: "application-carrier",
    blockers: [
      "Obtain the configured Samtec Series Print and independently review carrier-socket pair assignment, 0.80 mm board geometry, copper, mask, paste, courtyard, and latch orientation",
      "Pass USB 2.0 high-speed eye, attach/detach, ESD, shield-current, common-mode emission, and de-energized service tests on the released 7.87 inch assembly"
    ],
    cad: {
      status: "pending",
      url: "https://www.samtec.com/products/hsec8"
    },
    evidenceUrls: ["https://www.samtec.com/products/hsec8", "https://www.samtec.com/products/ecdp-08-07.87-l1-l2-1-3"],
    footprint: {
      status: "pending",
      description:
        "Exact Samtec HSEC8 carrier socket land pattern, mask, paste, courtyard, and pair assignment remain controlled release data"
    },
    manufacturer: "Samtec",
    mechanical: {
      status: "pending",
      description: "Latch clearance, harness retention, chassis contact, and service access remain unverified"
    },
    mpn: "HSEC8-113-01-L-DV-A-L2",
    physical: {
      connectorGender: "female vertical latching edge-card socket",
      contactRating: "USB 2.0 signal pair only; no power or signal-ground conductor is assigned",
      cycleRating: "Production cycle rating remains a configured Series Print and qualification gate",
      interface: "interboard-usb2",
      keying: "L2 latch orientation at both sockets; configured Series Print controls mating orientation",
      mateMpn: "ECDP-08-07.87-L1-L2-1-3",
      mounting: "pcb-harness",
      openGates: [
        "Obtain the configured ECDP and HSEC8 Series Prints and overlay contacts, latch, board thickness, copper, mask, paste, and courtyard",
        "Complete retention, USB high-speed eye, ESD, common-mode, shield-current, vibration, and de-energized service tests"
      ],
      pairAssignment:
        "One 100 ohm twinax pair: negative conductor USB_DN, positive conductor USB_DP; shield is CHASSIS only",
      pinAssignment:
        "Logical endpoint 1 USB_DN, 2 USB_DP, 3 SHIELD; exact physical contacts require configured Series Print",
      retention:
        "Latching sockets at both ends plus harness tie-down within 25 mm; solder joints are not the service load path",
      service: "External USB-C removed and V20_EFUSE_OUT discharged before mating or unmating",
      shield: "Cable shield and both HSEC8 metalwork bond to CHASSIS; no APP_GND conductor is present"
    },
    productionApproved: false,
    references: ["J_USB2_CARRIER"],
    selectionStatus: "selected"
  },
  {
    assembly: "communications-module",
    blockers: [
      "Independently verify the LQFP-48 land pattern and exposed fabrication output on the communications module",
      "Release exact footprints and placement for the selected crystal, clock loads, resistors, TOCAP, 1V2O, ferrite, upstream ferrite-input bypass, VDD bypass, and six AVDD bypasses",
      "Complete magnetics, termination, clock, AVDD/VDD power-integrity, Ethernet SI, and EMC review; measured crystal negative-resistance magnitude must be at least 200 Ohm at every released-layout corner"
    ],
    cad: { status: "supplier-candidate" },
    evidenceUrls: [
      "https://docs.wiznet.io/Product/Chip/Ethernet/W5500",
      "https://docs.wiznet.io/Design-Guide/package_information"
    ],
    footprint: {
      status: "source-identified",
      description: "WIZnet LQFP-48, 7 mm body, 0.5 mm pitch"
    },
    manufacturer: "WIZnet",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer package table identifies 9 mm lead span and 1.6 mm maximum height"
    },
    mpn: "W5500",
    productionApproved: false,
    references: ["U_ETHERNET"],
    selectionStatus: "selected"
  },
  {
    assembly: "communications-module",
    blockers: [
      "Download and independently verify the official PCB footprint and STEP model",
      "Complete magnetics topology, LED, shield, chassis, emissions, and surge review"
    ],
    cad: {
      status: "pending",
      url: "https://www.we-online.com/components/products/download/7499011121A%20(rev1).stp"
    },
    evidenceUrls: [
      "https://www.we-online.com/en/components/products/WE-LAN-RJ45",
      "https://www.we-online.com/components/products/datasheet/7499011121A.pdf"
    ],
    footprint: {
      status: "source-identified",
      description: "Manufacturer THT footprint for the selected integrated-magnetics RJ45"
    },
    manufacturer: "Wurth Elektronik",
    mechanical: {
      status: "source-identified",
      description: "Manufacturer product data identifies shield tabs, LEDs, and through-hole mounting"
    },
    mpn: "7499011121A",
    physical: {
      contactRating: "Manufacturer datasheet does not publish a contact-current or contact-resistance rating",
      cycleRating: "750 mating cycles",
      interface: "ethernet-rj45",
      mounting: "pcb-with-chassis-support",
      openGates: [
        "Import the exact manufacturer STEP and verify all signal, LED, shell-tab, and panel features",
        "Provide a chassis bezel and strain-relief load path independent of the THT solder joints",
        "Complete shield bonding, magnetics return, surge, and EMC review"
      ],
      retention:
        "Manufacturer cycle rating does not carry cable insertion load; chassis support and strain relief are required",
      shield: "Integrated brass shield with 50 microinch nickel plating and two shell-tab features"
    },
    productionApproved: false,
    references: ["J_ETHERNET_MAGJACK"],
    selectionStatus: "selected"
  },
  {
    assembly: "communications-module",
    blockers: [
      "Download and independently verify the official footprint and STEP model",
      "Design and cycle-test chassis strain relief and the replaceable communications module",
      "Validate 5 V-before-contract isolation, 20 V/3 A PD negotiation, capability-mismatch shutdown, detach, ESD, EFT, and USB attach behavior in the released module"
    ],
    cad: {
      status: "pending",
      url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip"
    },
    evidenceUrls: [
      "https://www.amphenol-cs.com/product/1017707000011lf.html",
      "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf",
      "https://cdn.amphenol-cs.com/media/wysiwyg/files/documentation/gs-12-1351.pdf"
    ],
    footprint: {
      status: "source-identified",
      description: "Manufacturer SMT footprint with shell stakes"
    },
    manufacturer: "Amphenol Communications Solutions",
    mechanical: {
      status: "source-identified",
      description: "Right-angle 16-position USB 2.0 Type-C receptacle rated for 20,000 mating cycles"
    },
    mpn: "10177070-00011LF",
    physical: {
      contactRating: "Manufacturer product-level rating: 5 A, 20 V; 40 milliohms contact resistance",
      cycleRating: "20,000 mating cycles",
      interface: "usb-c",
      mounting: "pcb-with-chassis-support",
      openGates: [
        "Acquire and import the exact manufacturer drawing and STP model",
        "Verify all contact, shell-stake, paste, board-edge, and 0.80 mm PCB-thickness features",
        "Provide chassis strain relief and complete service-module cable-load, USB-PD power-path, 60 W adapter and cable thermal, ESD, and EFT review"
      ],
      retention:
        "SMT termination is not a panel load path; the communications module must transfer plug load to chassis supports",
      shield: "Manufacturer specifies a shielded receptacle; exact shell and stake-pad geometry remains a CAD gate"
    },
    productionApproved: false,
    references: ["J_USB_C"],
    selectionStatus: "selected"
  },
  {
    assembly: "external-panel-module",
    blockers: [
      "Select the exact color suffixes and keyed left/right harnesses",
      "Validate body-cord plug compatibility, salt and sweat exposure, and production cycle life"
    ],
    cad: {
      status: "pending",
      url: "https://standstep.ec.staubli.com/catalog/show/caddata/%7CTM%7CTMline%7C"
    },
    evidenceUrls: [
      "https://www.staubli.com/content/dam/ecs/technical-documentation/datasheets/TM/66.9684_en.pdf",
      "https://www.staubli.com/content/dam/ecs/catalogs-brochures/TM/TM-Main-11014124-en.pdf"
    ],
    footprint: {
      status: "not-applicable",
      description: "Panel sockets with M4 rear termination to a replaceable keyed harness"
    },
    manufacturer: "Staubli",
    mechanical: {
      status: "source-identified",
      description: "Machined-brass insulated rigid 4 mm panel socket family rated 20 A"
    },
    mpn: "XUB-G 66.9684-*",
    physical: {
      contactRating: "20 A rated current; Stäubli does not publish a socket contact-resistance value",
      cycleRating: "Not published by Stäubli; project target is 1,000-cycle EVT and 10,000-cycle DVT",
      exactSampleMpns: ["66.9684-22", "66.9684-25"],
      interface: "reel-socket",
      mounting: "panel-chassis",
      openGates: [
        "Receive and inspect exact 66.9684-22 and 66.9684-25 samples, then compare the selected mounting variant with official CAD",
        "Prove whole three-pin body-cord plug fit, orientation, sleeve shrouding, and keyed harness mapping",
        "Design and test an independent chassis retainer, sweat/salt screen, and endurance program"
      ],
      retention:
        "Accepts spring-loaded 4 mm plugs with rigid insulating sleeves; FIE safety retention requires a project chassis retainer",
      shield: "Insulated socket; Stäubli publishes no shielding or chassis-bonding claim for XUB-G"
    },
    productionApproved: false,
    references: ["J_L", "J_R"],
    selectionStatus: "candidate"
  }
] as const satisfies readonly CriticalPartReadiness[]

/**
 * Readiness records retain their evidence prose, but their selected harness
 * identities must stay aligned with the reviewed production selection.
 */
export function validateSelectedHarnessReadiness(parts: readonly CriticalPartReadiness[]): readonly string[] {
  const errors: string[] = []
  for (const selection of productionHarnessSelection) {
    const readiness = parts.find((part) => part.references.includes(selection.boardReference))
    if (readiness === undefined) continue

    const expected = {
      cableMpn: selection.cable.mpn,
      headerMpn: selection.connector.headerMpn,
      mateHousingMpn: selection.connector.mateHousingMpn,
      mateTerminalMpn: selection.connector.mateTerminalMpn
    } as const
    if (readiness.mpn !== expected.headerMpn) {
      errors.push(
        `${selection.boardReference}: readiness MPN ${readiness.mpn} must match selected header MPN ${expected.headerMpn}`
      )
    }
    if (readiness.physical?.cableMpn !== expected.cableMpn) {
      errors.push(
        `${selection.boardReference}: readiness cable MPN ${readiness.physical?.cableMpn ?? "<missing>"} must match selected cable MPN ${expected.cableMpn}`
      )
    }
    if (readiness.physical?.mateHousingMpn !== expected.mateHousingMpn) {
      errors.push(
        `${selection.boardReference}: readiness mate housing MPN ${readiness.physical?.mateHousingMpn ?? "<missing>"} must match selected mate housing MPN ${expected.mateHousingMpn}`
      )
    }
    if (readiness.physical?.terminalMpn !== expected.mateTerminalMpn) {
      errors.push(
        `${selection.boardReference}: readiness terminal MPN ${readiness.physical?.terminalMpn ?? "<missing>"} must match selected terminal MPN ${expected.mateTerminalMpn}`
      )
    }
  }
  return errors
}

export function validateCriticalPartReadiness(parts: readonly CriticalPartReadiness[]): readonly string[] {
  const errors: string[] = []
  const referenceOwners = new Map<string, { assembly: CriticalPartReadiness["assembly"]; mpn: string }>()
  const selectedMpns = new Set<string>()

  for (const part of parts) {
    if (part.references.length === 0) errors.push(`${part.mpn}: at least one circuit reference is required`)
    for (const reference of part.references) {
      const owner = referenceOwners.get(reference)
      if (owner !== undefined) {
        errors.push(`${reference}: circuit reference is assigned more than once`)
        errors.push(
          `${reference}: circuit reference ownership conflicts between ${owner.assembly}/${owner.mpn} and ${part.assembly}/${part.mpn}`
        )
      } else {
        referenceOwners.set(reference, { assembly: part.assembly, mpn: part.mpn })
      }
    }

    if (part.selectionStatus === "selected") {
      if (selectedMpns.has(part.mpn)) errors.push(`${part.mpn}: selected MPN is duplicated`)
      selectedMpns.add(part.mpn)
      if (/\bTBD\b/i.test(part.mpn)) errors.push(`${part.mpn}: selected parts cannot use a placeholder MPN`)
    }

    if (part.physical !== undefined) {
      if (["ethernet-rj45", "usb-c"].includes(part.physical.interface) && part.assembly !== "communications-module") {
        errors.push(
          `${part.mpn}: ${part.physical.interface} physical evidence belongs to the communications-module assembly`
        )
      }
      if (part.physical.interface === "reel-socket" && part.assembly !== "external-panel-module") {
        errors.push(`${part.mpn}: reel-socket physical evidence belongs to the external-panel-module assembly`)
      }
      if (
        ["weapon-harness", "piste-harness", "primary-output-harness"].includes(part.physical.interface) &&
        part.assembly !== "scoring-io-board"
      ) {
        errors.push(
          `${part.mpn}: ${part.physical.interface} physical evidence belongs to the scoring-io-board assembly`
        )
      }
      if (
        ["interboard-power", "interboard-usb2"].includes(part.physical.interface) &&
        part.assembly !== "application-carrier"
      ) {
        errors.push(
          `${part.mpn}: ${part.physical.interface} carrier evidence belongs to the application-carrier assembly`
        )
      }
      const requiredInterboardMpn =
        part.physical.interface === "interboard-power"
          ? "43045-0400"
          : part.physical.interface === "interboard-usb2"
            ? "HSEC8-113-01-L-DV-A-L2"
            : undefined
      if (requiredInterboardMpn !== undefined && part.mpn !== requiredInterboardMpn) {
        errors.push(`${part.mpn}: ${part.physical.interface} requires exact MPN ${requiredInterboardMpn}`)
      }
      if (requiredInterboardMpn !== undefined) {
        for (const [field, value] of [
          ["connectorGender", part.physical.connectorGender],
          ["keying", part.physical.keying],
          ["mateMpn", part.physical.mateMpn],
          ["pairAssignment", part.physical.pairAssignment],
          ["pinAssignment", part.physical.pinAssignment],
          ["service", part.physical.service]
        ] as const) {
          if (value === undefined || value.trim().length === 0) {
            errors.push(`${part.mpn}: ${part.physical.interface} physical ${field} must be nonblank`)
          }
        }
        if (part.physical.openGates.length === 0) {
          errors.push(`${part.mpn}: ${part.physical.interface} physical openGates must not be empty before release`)
        }
      }
      if (["weapon-harness", "piste-harness", "primary-output-harness"].includes(part.physical.interface)) {
        for (const [field, value] of [
          ["cableMpn", part.physical.cableMpn],
          ["connectorGender", part.physical.connectorGender],
          ["keying", part.physical.keying],
          ["mateHousingMpn", part.physical.mateHousingMpn],
          ["mateMpn", part.physical.mateMpn],
          ["pinAssignment", part.physical.pinAssignment],
          ["service", part.physical.service],
          ["terminalMpn", part.physical.terminalMpn]
        ] as const) {
          if (value === undefined || value.trim().length === 0) {
            errors.push(`${part.mpn}: ${part.physical.interface} physical ${field} must be nonblank`)
          }
        }
        if (part.physical.openGates.length === 0) {
          errors.push(`${part.mpn}: ${part.physical.interface} physical openGates must not be empty before release`)
        }
      }
      if (
        part.physical.interface === "interboard-power" &&
        !(
          part.physical.mateMpn?.includes("43025-0400") &&
          part.physical.mateMpn.includes("43030-0007") &&
          part.physical.pinAssignment?.includes("1 V20_EFUSE_OUT_A") &&
          part.physical.pinAssignment.includes("4 GND_B")
        )
      ) {
        errors.push(`${part.mpn}: interboard-power mate and four-contact assignment changed`)
      }
      if (
        part.physical.interface === "interboard-usb2" &&
        !(
          part.physical.mateMpn === "ECDP-08-07.87-L1-L2-1-3" &&
          part.physical.pairAssignment?.includes("100 ohm") &&
          part.physical.pairAssignment.includes("USB_DN") &&
          part.physical.pairAssignment.includes("USB_DP") &&
          part.physical.pairAssignment.includes("CHASSIS") &&
          part.physical.contactRating.includes("no power or signal-ground conductor")
        )
      ) {
        errors.push(`${part.mpn}: interboard-usb2 mate, pair, shield, or no-ground assignment changed`)
      }
      const physicalScalars = [
        ["contactRating", part.physical.contactRating],
        ["cycleRating", part.physical.cycleRating],
        ["interface", part.physical.interface],
        ["mounting", part.physical.mounting],
        ["retention", part.physical.retention],
        ["shield", part.physical.shield]
      ] as const
      for (const [field, value] of physicalScalars) {
        if (value.trim().length === 0) errors.push(`${part.mpn}: physical ${field} must be nonblank`)
      }
      for (const gate of part.physical.openGates) {
        if (gate.trim().length === 0) errors.push(`${part.mpn}: physical open gate must be nonblank`)
      }

      const exactSampleMpns = part.physical.exactSampleMpns
      if (
        part.physical.interface === "reel-socket" &&
        (exactSampleMpns === undefined || exactSampleMpns.length === 0)
      ) {
        errors.push(`${part.mpn}: reel-socket physical evidence requires exact sample MPNs`)
      }
      if (exactSampleMpns !== undefined) {
        if (exactSampleMpns.length === 0) {
          errors.push(`${part.mpn}: exactSampleMpns must not be empty when present`)
        }
        const sampleMpns = new Set<string>()
        for (const sampleMpn of exactSampleMpns) {
          const normalizedSampleMpn = sampleMpn.trim()
          if (normalizedSampleMpn.length === 0) {
            errors.push(`${part.mpn}: exact sample MPN must be nonblank`)
          }
          if (sampleMpns.has(normalizedSampleMpn)) {
            errors.push(`${part.mpn}: exact sample MPN is duplicated`)
          }
          sampleMpns.add(normalizedSampleMpn)
          if (/\bTBD\b/i.test(sampleMpn)) errors.push(`${part.mpn}: exact sample MPN cannot use a placeholder`)
        }
      }
    } else if (part.references.some((reference) => reference.startsWith("J_"))) {
      errors.push(`${part.mpn}: connector references require physical evidence`)
    }

    for (const url of [
      ...part.evidenceUrls,
      ...(part.cad.url === undefined ? [] : [part.cad.url]),
      ...(part.footprint.url === undefined ? [] : [part.footprint.url])
    ]) {
      if (!url.startsWith("https://")) errors.push(`${part.mpn}: evidence URL must use HTTPS`)
    }

    if (
      part.productionApproved &&
      (part.selectionStatus !== "selected" ||
        !["verified", "not-applicable"].includes(part.footprint.status) ||
        !["manufacturer-verified", "not-applicable"].includes(part.cad.status) ||
        part.mechanical.status !== "verified" ||
        part.blockers.length > 0 ||
        (part.references.some((reference) => reference.startsWith("J_")) &&
          (part.physical === undefined || part.physical.openGates.length > 0)))
    ) {
      errors.push(`${part.mpn}: production approval requires every readiness gate to pass`)
    }
  }

  errors.push(...validateSelectedHarnessReadiness(parts))
  return errors
}

export function summarizeCriticalPartReadiness(parts: readonly CriticalPartReadiness[]) {
  return {
    candidateSelections: parts.filter((part) => part.selectionStatus === "candidate").length,
    manufacturerVerifiedCad: parts.filter((part) => part.cad.status === "manufacturer-verified").length,
    productionApproved: parts.filter((part) => part.productionApproved).length,
    selectedParts: parts.filter((part) => part.selectionStatus === "selected").length,
    total: parts.length,
    verifiedFootprints: parts.filter((part) => part.footprint.status === "verified").length,
    verifiedMechanical: parts.filter((part) => part.mechanical.status === "verified").length
  } as const
}
