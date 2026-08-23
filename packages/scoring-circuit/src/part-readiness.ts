export type ReadinessStatus = "pending" | "source-identified" | "verified"

export type ConnectorPhysicalEvidence = {
  contactRating: string
  cycleRating: string
  exactSampleMpns?: readonly string[]
  interface: "ethernet-rj45" | "locking-power" | "reel-socket" | "usb-c"
  mounting: "panel-chassis" | "pcb-with-chassis-support"
  openGates: readonly string[]
  retention: string
  shield: string
}

export type CriticalPartReadiness = {
  assembly: "application-carrier" | "external-panel-module"
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
      "Independently verify the LQFP-48 land pattern and exposed fabrication output",
      "Complete magnetics, termination, clock, decoupling, and Ethernet SI review"
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
    assembly: "external-panel-module",
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
    assembly: "external-panel-module",
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

export function validateCriticalPartReadiness(parts: readonly CriticalPartReadiness[]): readonly string[] {
  const errors: string[] = []
  const references = new Set<string>()
  const selectedMpns = new Set<string>()

  for (const part of parts) {
    if (part.references.length === 0) errors.push(`${part.mpn}: at least one circuit reference is required`)
    for (const reference of part.references) {
      if (references.has(reference)) errors.push(`${reference}: circuit reference is assigned more than once`)
      references.add(reference)
    }

    if (part.selectionStatus === "selected") {
      if (selectedMpns.has(part.mpn)) errors.push(`${part.mpn}: selected MPN is duplicated`)
      selectedMpns.add(part.mpn)
      if (/\bTBD\b/i.test(part.mpn)) errors.push(`${part.mpn}: selected parts cannot use a placeholder MPN`)
    }

    if (part.physical !== undefined) {
      if (part.assembly !== "external-panel-module") {
        errors.push(`${part.mpn}: connector physical evidence must be assigned to the external-panel-module assembly`)
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
    } else if (part.assembly === "external-panel-module") {
      errors.push(`${part.mpn}: external-panel-module requires physical evidence`)
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
        (part.assembly === "external-panel-module" &&
          (part.physical === undefined || part.physical.openGates.length > 0)))
    ) {
      errors.push(`${part.mpn}: production approval requires every readiness gate to pass`)
    }
  }

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
