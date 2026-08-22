export type ReadinessStatus = "pending" | "source-identified" | "verified"

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
    cad: { status: "pending" },
    evidenceUrls: ["https://www.we-online.com/en/components/products/WE-LAN-RJ45"],
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
    productionApproved: false,
    references: ["J_ETHERNET_MAGJACK"],
    selectionStatus: "selected"
  },
  {
    assembly: "external-panel-module",
    blockers: [
      "Download and independently verify the official footprint and STEP model",
      "Design and cycle-test chassis strain relief and the replaceable communications module"
    ],
    cad: { status: "pending" },
    evidenceUrls: ["https://www.amphenol-cs.com/product/1017707000011lf.html"],
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
    productionApproved: false,
    references: ["J_USB_C"],
    selectionStatus: "selected"
  },
  {
    assembly: "external-panel-module",
    blockers: [
      "Import the manufacturer STEP and DXF into the enclosure review and verify the exact selected-variant cutout and fasteners",
      "Define the keyed harness and chassis bonding pinout",
      "Validate supply connector temperature rise, misuse behavior, service access, and purchase-time lifecycle"
    ],
    cad: {
      status: "pending",
      url: "https://www.neutrik.com/media/12908/download/3-D%20NC4MD-LX.stp?v=2"
    },
    evidenceUrls: [
      "https://www.neutrik.com/en/product/nc4md-lx",
      "https://www.neutrik.com/media/8420/download/nc4md-lx-2.pdf?v=1",
      "https://www.neutrik.com/media/11869/download/nc4md-lx-3.dxf?v=1"
    ],
    footprint: {
      status: "not-applicable",
      description: "Chassis-mounted connector wired to a keyed internal harness"
    },
    manufacturer: "Neutrik",
    mechanical: {
      status: "source-identified",
      description: "Locking four-pole metal panel connector rated 10 A per contact and above 1,000 cycles"
    },
    mpn: "NC4MD-LX",
    productionApproved: false,
    references: ["J_POWER_24V"],
    selectionStatus: "selected"
  },
  {
    assembly: "external-panel-module",
    blockers: [
      "Select the exact color suffixes and keyed left/right harnesses",
      "Validate body-cord plug compatibility, salt and sweat exposure, and production cycle life"
    ],
    cad: { status: "pending" },
    evidenceUrls: ["https://www.staubli.com/content/dam/ecs/catalogs-brochures/TM/TM-Main-11014124-en.pdf"],
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
        part.blockers.length > 0)
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
