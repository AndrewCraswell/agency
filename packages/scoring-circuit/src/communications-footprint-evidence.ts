/**
 * Primary-source evidence for the three external communications-module parts.
 *
 * These records are an audit boundary, not a footprint library.  Geometry is
 * retained only when it was observed in an exact manufacturer source, and no
 * record in this file grants PCB placement or fabrication release.
 */

export type CommunicationsFootprintMpn = "W5500" | "7499011121A" | "10177070-00011LF"

export type CommunicationsPrimarySource = {
  readonly access: "acquired-temporary" | "manufacturer-listed" | "access-blocked"
  readonly kind: "datasheet" | "package-information" | "eda-library" | "step-model" | "product-page" | "product-drawing"
  readonly revision: string
  readonly sha256?: string
  readonly url: string
}

export type CommunicationsPadEvidence = {
  readonly drillMm: number
  readonly heightMm: number
  readonly id: string
  readonly kind: "plated-hole" | "non-plated-hole"
  readonly shape: "circle" | "rect"
  readonly widthMm: number
  readonly xMm: number
  readonly yMm: number
}

export type CommunicationsGeometryEvidence = {
  readonly copper:
    | "manufacturer-eda-source"
    | "manufacturer-hole-pattern"
    | "manufacturer-listed-not-acquired"
    | "not-published"
  readonly courtyard: "manufacturer-eda-source" | "manufacturer-listed-not-acquired" | "not-published"
  readonly orientation: "manufacturer-eda-source" | "manufacturer-drawing-needs-overlay" | "not-acquired"
  readonly paste: "not-applicable-through-hole" | "not-published" | "not-acquired"
  readonly pinMapping: "manufacturer-eda-source" | "manufacturer-drawing-needs-overlay" | "not-acquired"
  readonly solderMask: "library-implied-not-fab-qualified" | "not-published" | "not-acquired"
}

export type CommunicationsFootprintEvidence = {
  readonly body: string
  readonly exactPads: readonly CommunicationsPadEvidence[]
  readonly geometry: CommunicationsGeometryEvidence
  readonly manufacturer: string
  readonly missingReleaseEvidence: readonly string[]
  readonly mpn: CommunicationsFootprintMpn
  readonly package: string
  readonly primarySources: readonly CommunicationsPrimarySource[]
  readonly releaseState: "deny"
}

const wurthPads: readonly CommunicationsPadEvidence[] = [
  { drillMm: 0.9, heightMm: 1.408, id: "1", kind: "plated-hole", shape: "rect", widthMm: 1.408, xMm: 0, yMm: 0 },
  {
    drillMm: 0.9,
    heightMm: 1.408,
    id: "2",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.408,
    xMm: 1.27,
    yMm: -2.54
  },
  { drillMm: 0.9, heightMm: 1.408, id: "3", kind: "plated-hole", shape: "circle", widthMm: 1.408, xMm: 2.54, yMm: 0 },
  {
    drillMm: 0.9,
    heightMm: 1.408,
    id: "4",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.408,
    xMm: 3.81,
    yMm: -2.54
  },
  { drillMm: 0.9, heightMm: 1.408, id: "5", kind: "plated-hole", shape: "circle", widthMm: 1.408, xMm: 5.08, yMm: 0 },
  {
    drillMm: 0.9,
    heightMm: 1.408,
    id: "6",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.408,
    xMm: 6.35,
    yMm: -2.54
  },
  { drillMm: 0.9, heightMm: 1.408, id: "7", kind: "plated-hole", shape: "circle", widthMm: 1.408, xMm: 7.62, yMm: 0 },
  {
    drillMm: 0.9,
    heightMm: 1.408,
    id: "8",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.408,
    xMm: 8.89,
    yMm: -2.54
  },
  {
    drillMm: 1.03,
    heightMm: 1.545,
    id: "9",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.545,
    xMm: -2.18,
    yMm: 10.43
  },
  {
    drillMm: 1.03,
    heightMm: 1.545,
    id: "10",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.545,
    xMm: 0.36,
    yMm: 10.43
  },
  {
    drillMm: 1.03,
    heightMm: 1.545,
    id: "11",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.545,
    xMm: 8.53,
    yMm: 10.43
  },
  {
    drillMm: 1.03,
    heightMm: 1.545,
    id: "12",
    kind: "plated-hole",
    shape: "circle",
    widthMm: 1.545,
    xMm: 11.07,
    yMm: 10.43
  },
  { drillMm: 1.6, heightMm: 2.4, id: "S1", kind: "plated-hole", shape: "circle", widthMm: 2.4, xMm: -3.3, yMm: 3.3 },
  { drillMm: 1.6, heightMm: 2.4, id: "S2", kind: "plated-hole", shape: "circle", widthMm: 2.4, xMm: 12.19, yMm: 3.3 },
  {
    drillMm: 3.25,
    heightMm: 3.25,
    id: "NPTH1",
    kind: "non-plated-hole",
    shape: "circle",
    widthMm: 3.25,
    xMm: -1.27,
    yMm: 6.35
  },
  {
    drillMm: 3.25,
    heightMm: 3.25,
    id: "NPTH2",
    kind: "non-plated-hole",
    shape: "circle",
    widthMm: 3.25,
    xMm: 10.16,
    yMm: 6.35
  }
] as const

export const communicationsFootprintEvidence: readonly CommunicationsFootprintEvidence[] = [
  {
    body: "7 mm x 7 mm, 48-pin LQFP; 0.5 mm pitch",
    exactPads: [],
    geometry: {
      copper: "manufacturer-eda-source",
      courtyard: "not-published",
      orientation: "manufacturer-eda-source",
      paste: "not-published",
      pinMapping: "manufacturer-eda-source",
      solderMask: "library-implied-not-fab-qualified"
    },
    manufacturer: "WIZnet",
    missingReleaseEvidence: [
      "Convert the official Eagle library into the project release CAD and independently inspect all 48 pads, pin-one orientation, and the W5500 package revision supplied by procurement",
      "Define and review fabrication-specific solder-mask expansion, paste apertures, courtyard, and assembly datum; the WIZnet source does not publish those as a locked release object",
      "Reconcile the WIZnet package-change note since July 2021 against the exact received W5500 lot before releasing copper"
    ],
    mpn: "W5500",
    package: "LQFP-48",
    primarySources: [
      {
        access: "manufacturer-listed",
        kind: "datasheet",
        revision: "W5500 Datasheet v1.1.0",
        url: "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf"
      },
      {
        access: "manufacturer-listed",
        kind: "package-information",
        revision: "WIZnet Package Information, current page checked 2026-08-23",
        url: "https://docs.wiznet.io/Design-Guide/package_information"
      },
      {
        access: "acquired-temporary",
        kind: "eda-library",
        revision: "WIZnet Eagle library, Eagle 6.4 source; archive hash recorded 2026-08-23",
        sha256: "3782F5FE121892D756F73C6C215CD7197592E6AA4D1CF313A61E86C32F9D68C8",
        url: "https://docs.wiznet.io/assets/files/w5500-8471ab91099d747f685738c072bd9b9e.zip"
      }
    ],
    releaseState: "deny"
  },
  {
    body: "16 mm x 21.25 mm x 13.5 mm, THT WE-RJ45 LAN transformer with integrated yellow-green LEDs",
    exactPads: wurthPads,
    geometry: {
      copper: "manufacturer-eda-source",
      courtyard: "manufacturer-eda-source",
      orientation: "manufacturer-eda-source",
      paste: "not-applicable-through-hole",
      pinMapping: "manufacturer-drawing-needs-overlay",
      solderMask: "library-implied-not-fab-qualified"
    },
    manufacturer: "Würth Elektronik",
    missingReleaseEvidence: [
      "Import the exact manufacturer KiCad footprint and STEP into the release CAD, then independently overlay the 16 holes and the body/panel datum against the 2023-07-11 drawing",
      "Verify the source-library pin and LED mapping against the W5500 MDI and SPDLED connections; do not rely on pad numbers alone",
      "Qualify fabricator-specific annular ring, solder-mask expansion, courtyard keepout, wave-solder process, shell/chassis return, and the independent enclosure load path"
    ],
    mpn: "7499011121A",
    package: "WE-RJ45LAN 1x1 THT",
    primarySources: [
      {
        access: "acquired-temporary",
        kind: "datasheet",
        revision: "LuWe 003.000, checked 2023-07-11",
        sha256: "05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350",
        url: "https://www.we-online.com/components/products/datasheet/7499011121A.pdf"
      },
      {
        access: "acquired-temporary",
        kind: "eda-library",
        revision: "KiCad_WE-RJ45LAN rev26b; exact footprint extracted for audit on 2026-08-23",
        sha256: "C4668F610A62D6E8D9E25FF7DBCF2AFFB33C1954ACE277C504CFD41951CA30EC",
        url: "https://www.we-online.com/components/products/download/KiCad_WE-RJ45LAN%20(rev26b).zip"
      },
      {
        access: "acquired-temporary",
        kind: "step-model",
        revision:
          "7499011121A rev1 extracted from KiCad_WE-RJ45LAN rev26b at 3dmodels/Transformer_THT_Wurth.3dshapes/T_Wurth_WE-RJ45LAN_7499011121A.step",
        sha256: "982AE39409ABE5B756E2FCD06EEE665EECBC3EF416A3464E7B90EA2631CD3FA0",
        url: "https://www.we-online.com/components/products/download/KiCad_WE-RJ45LAN%20(rev26b).zip"
      }
    ],
    releaseState: "deny"
  },
  {
    body: "Right-angle USB 2.0 Type-C receptacle, 16 contacts, 0.80 mm PCB thickness",
    exactPads: [],
    geometry: {
      copper: "manufacturer-listed-not-acquired",
      courtyard: "manufacturer-listed-not-acquired",
      orientation: "not-acquired",
      paste: "not-acquired",
      pinMapping: "not-acquired",
      solderMask: "not-acquired"
    },
    manufacturer: "Amphenol Communications Solutions",
    missingReleaseEvidence: [
      "Acquire the exact manufacturer drawing and 3D archive through an authorized access path; direct project download returned HTTP 403 on 2026-08-23",
      "Overlay every contact, shell/stake feature, paste aperture, solder mask, courtyard, board edge, mating axis, and 0.80 mm board-thickness requirement",
      "Provide independent chassis support and verify USB-C plug load, cable bend, ESD shield bonding, and service access before release"
    ],
    mpn: "10177070-00011LF",
    package: "Right-angle USB Type-C SMT receptacle",
    primarySources: [
      {
        access: "manufacturer-listed",
        kind: "product-page",
        revision: "Product page checked 2026-08-23",
        url: "https://www.amphenol-cs.com/product/1017707000011lf.html"
      },
      {
        access: "access-blocked",
        kind: "product-drawing",
        revision: "Manufacturer drawing listed; project acquisition returned HTTP 403 on 2026-08-23",
        url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf"
      },
      {
        access: "access-blocked",
        kind: "step-model",
        revision: "Manufacturer 3D archive listed; access path requires acquisition review",
        url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip"
      }
    ],
    releaseState: "deny"
  }
] as const satisfies readonly CommunicationsFootprintEvidence[]

export function validateCommunicationsFootprintEvidence(
  records: readonly CommunicationsFootprintEvidence[]
): readonly string[] {
  const errors: string[] = []
  const mpns = new Set<string>()

  for (const record of records) {
    if (mpns.has(record.mpn)) errors.push(`${record.mpn}: duplicate MPN`)
    mpns.add(record.mpn)
    if (record.body.trim().length === 0) errors.push(`${record.mpn}: body description is required`)
    if (record.package.trim().length === 0) errors.push(`${record.mpn}: package description is required`)
    if (record.releaseState !== "deny") errors.push(`${record.mpn}: release must fail closed`)
    if (record.missingReleaseEvidence.length === 0) errors.push(`${record.mpn}: release blockers are required`)
    for (const blocker of record.missingReleaseEvidence) {
      if (blocker.trim().length === 0) errors.push(`${record.mpn}: release blockers must be nonblank`)
    }

    const sourceKinds = new Set<string>()
    if (record.primarySources.length === 0) errors.push(`${record.mpn}: primary sources are required`)
    for (const source of record.primarySources) {
      if (sourceKinds.has(source.kind)) errors.push(`${record.mpn}: duplicate source kind ${source.kind}`)
      sourceKinds.add(source.kind)
      if (!source.url.startsWith("https://")) errors.push(`${record.mpn}: source URL must use HTTPS`)
      if (source.revision.trim().length === 0) errors.push(`${record.mpn}: source revision is required`)
      if (source.sha256 !== undefined && !/^[0-9A-F]{64}$/.test(source.sha256)) {
        errors.push(`${record.mpn}: source SHA-256 must be 64 uppercase hex characters`)
      }
      if (source.access === "acquired-temporary" && source.sha256 === undefined) {
        errors.push(`${record.mpn}: acquired source requires SHA-256`)
      }
    }

    const padIds = new Set<string>()
    for (const pad of record.exactPads) {
      if (padIds.has(pad.id)) errors.push(`${record.mpn}: duplicate pad ${pad.id}`)
      padIds.add(pad.id)
      for (const [dimension, value] of [
        ["width", pad.widthMm],
        ["height", pad.heightMm],
        ["drill", pad.drillMm]
      ] as const) {
        if (!Number.isFinite(value) || value <= 0)
          errors.push(`${record.mpn}: pad ${pad.id} ${dimension} must be positive`)
      }
      for (const [coordinate, value] of [
        ["x", pad.xMm],
        ["y", pad.yMm]
      ] as const) {
        if (!Number.isFinite(value)) errors.push(`${record.mpn}: pad ${pad.id} ${coordinate} must be finite`)
      }
      if (pad.shape !== "circle" && pad.shape !== "rect") {
        errors.push(`${record.mpn}: pad ${pad.id} shape must be circle or rect`)
      }
      if (pad.shape === "circle" && pad.widthMm !== pad.heightMm) {
        errors.push(`${record.mpn}: circular pad ${pad.id} must have equal width and height`)
      }
      if (pad.kind === "non-plated-hole" && (pad.widthMm !== pad.drillMm || pad.heightMm !== pad.drillMm)) {
        errors.push(`${record.mpn}: non-plated hole ${pad.id} must preserve finished-hole diameter`)
      }
      if (pad.kind === "plated-hole" && (pad.widthMm <= pad.drillMm || pad.heightMm <= pad.drillMm)) {
        errors.push(`${record.mpn}: plated hole ${pad.id} requires annular copper`)
      }
    }

    if (record.geometry.copper === "manufacturer-listed-not-acquired" && record.exactPads.length > 0) {
      errors.push(`${record.mpn}: unavailable manufacturer copper must not generate exact pads`)
    }
    if (record.geometry.copper === "not-published" && record.exactPads.length > 0) {
      errors.push(`${record.mpn}: unpublished copper must not generate exact pads`)
    }
    if (record.geometry.copper === "manufacturer-hole-pattern" && record.exactPads.length === 0) {
      errors.push(`${record.mpn}: manufacturer hole pattern requires exact pads`)
    }
    if (
      record.geometry.paste === "not-applicable-through-hole" &&
      record.exactPads.some((pad) => pad.kind !== "plated-hole" && pad.kind !== "non-plated-hole")
    ) {
      errors.push(`${record.mpn}: through-hole paste exception has an invalid pad kind`)
    }
  }

  return errors
}

export function findCommunicationsFootprintEvidence(mpn: string): CommunicationsFootprintEvidence | undefined {
  return communicationsFootprintEvidence.find((record) => record.mpn === mpn)
}
