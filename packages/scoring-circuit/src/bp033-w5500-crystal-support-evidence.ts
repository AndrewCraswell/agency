import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

type W5500SupportSource = {
  readonly id: string
  readonly authority: "manufacturer-primary-page-capture" | "manufacturer-primary-retained-bytes"
  readonly manufacturer: string
  readonly exactMpn: string | null
  readonly artifactPath: string
  readonly sha256: string
  readonly url: string
  readonly reviewedPagesOrFields: readonly string[]
}

type W5500SupportRow = {
  readonly references: readonly string[]
  readonly manufacturer: string
  readonly mpn: string
  readonly package: string
  readonly sourceIds: readonly string[]
  readonly boundFields: readonly string[]
}

const requiredReferences = [
  "Y_W5500",
  "C_W5500_XI",
  "C_W5500_XO",
  "R_W5500_XTAL",
  "R_W5500_XO",
  "R_W5500_EXRES",
  "C_W5500_TOCAP",
  "C_W5500_1V2O",
  "FB_W5500_AVDD"
] as const

function buildEvidence() {
  return {
    artifactKind: "bp033-w5500-crystal-support-exact-mpn-evidence",
    workUnit: "BP-033",
    scope: "only the currently unresolved W5500 crystal and support references",
    rows: [
      {
        references: ["Y_W5500"],
        manufacturer: "ECS Inc.",
        mpn: "ECS-250-18-33B-JGN-TR",
        package: "ECS-33B, 3.20 mm x 2.50 mm x 0.80 mm, 4-pad SMD, 1K reel",
        sourceIds: ["ecs-33b-exact-page", "ecs-33b-datasheet"],
        boundFields: [
          "Exact product page: ECS-250-18-33B-JGN-TR, 33B package code, 25 MHz, +/-20 ppm, +/-30 ppm, 18 pF, and -40 C to 85 C",
          "PDF page 1: ECS-33B package, 2 pF shunt, 200 uW maximum drive, -40 C to 85 C, and part-number guide",
          "PDF page 2: 250 frequency code is 25.000 MHz and 21 MHz to 39.999 MHz ESR maximum is 40 Ohm"
        ]
      },
      {
        references: ["C_W5500_XI", "C_W5500_XO"],
        manufacturer: "TDK",
        mpn: "CGA3E2C0G1H180J080AA",
        package: "CGA3 (1608 metric), EIA 0603, 1.60 mm x 0.80 mm x 0.80 mm",
        sourceIds: ["tdk-cga3-exact-page"],
        boundFields: [
          "Exact part number, Production status, CGA3 EIA 0603 series, 18 pF +/-5%, 50 VDC, C0G",
          "Body dimensions, -55 C to 125 C operating range, AEC-Q200, and punched-paper 180 mm reel"
        ]
      },
      {
        references: ["R_W5500_XTAL"],
        manufacturer: "Panasonic Industry",
        mpn: "ERJ3EKF1004V",
        package: "ERJ-3EK, EIA 0603 (1608 metric), 1.60 mm x 0.80 mm",
        sourceIds: ["panasonic-erj3ekf1004v-exact-page", "panasonic-erj3ek-series"],
        boundFields: [
          "Exact product page: 1 MOhm, +/-1%, 0.100 W, +/-100 ppm/K, and punched-paper taping",
          "Series PDF pages 2 to 4: ERJ3EK 0603 package, 1% family, dimensions, and 1 MOhm range"
        ]
      },
      {
        references: ["R_W5500_XO"],
        manufacturer: "Panasonic Industry",
        mpn: "ERJ3GEY0R00V",
        package: "ERJ-3GE, EIA 0603 (1608 metric), 1.60 mm x 0.80 mm",
        sourceIds: ["panasonic-erj3gey0r00v-exact-page", "panasonic-erj3gey-series"],
        boundFields: [
          "Exact product page: 0 Ohm jumper, EIA 0603, and punched-paper taping",
          "Series PDF pages 1 to 3: ERJ3GE 0603, 0 Ohm jumper code, 0.100 W series row, and dimensions"
        ]
      },
      {
        references: ["R_W5500_EXRES"],
        manufacturer: "Panasonic Industry",
        mpn: "ERJ3EKF1242V",
        package: "ERJ-3EK, EIA 0603 (1608 metric), 1.60 mm x 0.80 mm",
        sourceIds: ["panasonic-erj3ekf1242v-exact-page", "panasonic-erj3ek-series"],
        boundFields: [
          "Exact product page: 12.4 kOhm, +/-1%, 0.100 W, +/-100 ppm/K, and punched-paper taping",
          "Series PDF pages 2 to 4: ERJ3EK 0603 package, 1% family, dimensions, and resistance range"
        ]
      },
      {
        references: ["C_W5500_TOCAP"],
        manufacturer: "Murata",
        mpn: "GRM21BR71C475KA73L",
        package: "0805 (2012 metric), 2.0 mm x 1.25 mm, maximum thickness 1.4 mm, package code L",
        sourceIds: ["murata-grm21-exact-page"],
        boundFields: [
          "Exact product record: 4.7 uF, +/-10%, 16 VDC, X7R (EIA), 0805, and -55 C to 125 C",
          "Package-code suffix L and maximum thickness 1.4 mm"
        ]
      },
      {
        references: ["C_W5500_1V2O"],
        manufacturer: "Murata",
        mpn: "GRM188R71H103KA01D",
        package: "0603 (1608 metric), 1.60 mm x 0.80 mm, package code D, 180 mm paper tape",
        sourceIds: ["murata-grm188-exact-page"],
        boundFields: [
          "Exact product record: 10 nF, +/-10%, 50 VDC, X7R (EIA), 0603, and -55 C to 125 C",
          "Package-code suffix D and 180 mm paper-tape packaging"
        ]
      },
      {
        references: ["FB_W5500_AVDD"],
        manufacturer: "Murata",
        mpn: "BLM21PG221SN1D",
        package: "0805 (2012 metric), package code D, 180 mm paper tape",
        sourceIds: ["murata-blm21-exact-page"],
        boundFields: [
          "Exact product record and specification: 220 Ohm at 100 MHz, +/-25%, and 0.045 Ohm maximum DCR",
          "Rated current 2.0 A at 85 C and 1.25 A at 125 C"
        ]
      }
    ] as const satisfies readonly W5500SupportRow[],
    sources: [
      {
        id: "ecs-33b-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "ECS Inc.",
        exactMpn: "ECS-250-18-33B-JGN-TR",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/ecs-250-18-33b-jgn-tr-product-page-capture.md",
        sha256: "C2032BF49E73607070DDCD43CC08DDC512BCB1A83D14376C3CDAC37CFF049E15",
        url: "https://ecsxtal.com/products/crystals/surface-mount-crystals/ecs-250-18-33b-jgn-tr/",
        reviewedPagesOrFields: [
          "Exact product name and package code 33B",
          "25 MHz, +/-20 ppm tolerance, +/-30 ppm stability, 18 pF load, -40 C to 85 C, and 40 Ohm ESR"
        ]
      },
      {
        id: "ecs-33b-datasheet",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "ECS Inc.",
        exactMpn: "ECS-250-18-33B-JGN-TR",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/ecs-ecs-33b-datasheet.pdf",
        sha256: "CD8DE6F9688A36A2C6F13EE55518C1FAE6399E1B7D741553DDD3B72909C7C3A0",
        url: "https://ecsxtal.com/store/pdf/ECS-33B.pdf",
        reviewedPagesOrFields: [
          "PDF page 1 part-number guide and electrical table",
          "PDF page 2 frequency code and dimensions"
        ]
      },
      {
        id: "tdk-cga3-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "TDK",
        exactMpn: "CGA3E2C0G1H180J080AA",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/tdk-cga3e2c0g1h180j080aa-product-page-capture.md",
        sha256: "B53B12A5524CD008F98F8926A6F3E8D30482E3AC591149ED3BF8C43A345C9641",
        url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E2C0G1H180J080AA",
        reviewedPagesOrFields: [
          "Exact part number",
          "Production status",
          "CGA3 EIA 0603",
          "18 pF, 50 VDC, C0G, dimensions, temperature, and packing"
        ]
      },
      {
        id: "panasonic-erj3ekf1004v-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Panasonic Industry",
        exactMpn: "ERJ3EKF1004V",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/panasonic-erj3ekf1004v-product-page-capture.md",
        sha256: "B3770B436B712896DADDF2C538AB1AC8ACABB704949EF5CBDC7919A4F88D7E1C",
        url: "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1004V",
        reviewedPagesOrFields: ["Exact part number", "1 MOhm, +/-1%, 0603, 0.100 W, +/-100 ppm/K, punched paper taping"]
      },
      {
        id: "panasonic-erj3ekf1242v-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Panasonic Industry",
        exactMpn: "ERJ3EKF1242V",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/panasonic-erj3ekf1242v-product-page-capture.md",
        sha256: "A5D26968F6B3B39D90169FBFB94FBCF079047C4D6A6BAA1EC4F19D24E069AFEE",
        url: "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1242V",
        reviewedPagesOrFields: [
          "Exact part number",
          "12.4 kOhm, +/-1%, 0603, 0.100 W, +/-100 ppm/K, punched paper taping"
        ]
      },
      {
        id: "panasonic-erj3ek-series",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Panasonic Industry",
        exactMpn: null,
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/panasonic-erj3ek-series-datasheet.pdf",
        sha256: "78825B819853A63F57CC18214F321D2F1DA9DC205A7E58AF7DB18AE73563E378",
        url: "https://industrial.panasonic.com/cdbs/www-data/pdf/RDA0000/AOA0000C304.pdf",
        reviewedPagesOrFields: ["PDF pages 2 to 4 ERJ3EK family, 0603 dimensions, ratings, and resistance ranges"]
      },
      {
        id: "panasonic-erj3gey0r00v-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Panasonic Industry",
        exactMpn: "ERJ3GEY0R00V",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/panasonic-erj3gey0r00v-product-page-capture.md",
        sha256: "7467502D79199301AF698D418B7AEE94E3D31B5411639B047A0000CFBC45B5CA",
        url: "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3GEY0R00V",
        reviewedPagesOrFields: ["Exact part number", "0 Ohm jumper, 0603, 0.100 W series row, and punched paper taping"]
      },
      {
        id: "panasonic-erj3gey-series",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Panasonic Industry",
        exactMpn: null,
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/panasonic-erj3gey-series-datasheet.pdf",
        sha256: "BA49C765470E0C44B83E707ABC93B240FCCA45C4D7E7F3294B09ECFA98A29FBE",
        url: "https://industrial.panasonic.com/cdbs/www-data/pdf/RDA0000/AOA0000C301.pdf",
        reviewedPagesOrFields: ["PDF pages 1 to 3 ERJ3GE family, 0 Ohm jumper row, ratings, and 0603 dimensions"]
      },
      {
        id: "murata-grm21-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Murata",
        exactMpn: "GRM21BR71C475KA73L",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/murata-grm21br71c475ka73l-product-page-capture.md",
        sha256: "A78E96B8B6C6658179C1B1F3052E27D6F533477F09D5C841A4FCEA5CB3090DC3",
        url: "https://www.murata.com/en-global/products/productdetail?partno=GRM21BR71C475KA73%23",
        reviewedPagesOrFields: [
          "Exact part number",
          "4.7 uF, +/-10%, 16 VDC, X7R, 0805, dimensions, temperature, and package code L"
        ]
      },
      {
        id: "murata-grm188-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Murata",
        exactMpn: "GRM188R71H103KA01D",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/murata-grm188r71h103ka01d-product-page-capture.md",
        sha256: "5AF993341ECF88A0342B14DE62122BA346EDA5D45EE09FFEFD620753A6D27E85",
        url: "https://www.murata.com/en-global/products/productdetail?partno=GRM188R71H103KA01%23",
        reviewedPagesOrFields: [
          "Exact part number",
          "10 nF, +/-10%, 50 VDC, X7R, 0603, temperature, and package code D"
        ]
      },
      {
        id: "murata-blm21-exact-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "Murata",
        exactMpn: "BLM21PG221SN1D",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/murata-blm21pg221sn1d-product-page-capture.md",
        sha256: "5E63E3C6BAED8142E494532F0511E4BB1AD5A91B0A6B570775B123446CAEDF28",
        url: "https://www.murata.com/en-global/products/productdetail?partno=BLM21PG221SN1%23",
        reviewedPagesOrFields: [
          "Exact part number",
          "Specification PDF link",
          "220 Ohm at 100 MHz, DCR, current, 0805, and package code D"
        ]
      }
    ] as const satisfies readonly W5500SupportSource[],
    denyGates: {
      manufacturerCad: "deny",
      boardPlacement: "deny",
      fabrication: "deny",
      release: "deny",
      accepted: false
    }
  } as const
}

function freezeDataGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 W5500 evidence cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 W5500 evidence must contain data properties only")
    }
    freezeDataGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const privateBaseline = freezeDataGraph(buildEvidence())
export const bp033W5500CrystalSupportEvidence = freezeDataGraph(buildEvidence())

type GraphState = {
  readonly actualToExpected: Map<object, object>
  readonly expectedToActual: Map<object, object>
  readonly activeActual: Set<object>
  readonly activeExpected: Set<object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphState, path: string): void {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 W5500 evidence drift at ${path}`)
    return
  }
  if (actual === null || typeof actual !== "object") throw new RangeError(`BP-033 W5500 evidence drift at ${path}`)
  if (state.activeActual.has(actual) || state.activeExpected.has(expected)) {
    throw new RangeError(`BP-033 W5500 evidence cycle at ${path}`)
  }
  if (state.actualToExpected.has(actual) || state.expectedToActual.has(expected)) {
    throw new RangeError(`BP-033 W5500 evidence alias at ${path}`)
  }
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    throw new RangeError(`BP-033 W5500 evidence prototype drift at ${path}`)
  }
  if (Array.isArray(actual) !== Array.isArray(expected)) {
    throw new RangeError(`BP-033 W5500 evidence container drift at ${path}`)
  }
  const expectedNames = Object.getOwnPropertyNames(expected)
  const actualNames = Object.getOwnPropertyNames(actual)
  if (expectedNames.length !== actualNames.length || expectedNames.some((name) => !actualNames.includes(name))) {
    throw new RangeError(`BP-033 W5500 evidence property drift at ${path}`)
  }
  if (Object.getOwnPropertySymbols(actual).length !== 0 || Object.getOwnPropertySymbols(expected).length !== 0) {
    throw new RangeError(`BP-033 W5500 evidence symbol drift at ${path}`)
  }
  state.actualToExpected.set(actual, expected)
  state.expectedToActual.set(expected, actual)
  state.activeActual.add(actual)
  state.activeExpected.add(expected)
  try {
    for (const name of expectedNames) {
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, name)
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, name)
      if (
        expectedDescriptor === undefined ||
        actualDescriptor === undefined ||
        !("value" in expectedDescriptor) ||
        !("value" in actualDescriptor) ||
        expectedDescriptor.enumerable !== actualDescriptor.enumerable ||
        expectedDescriptor.configurable !== actualDescriptor.configurable ||
        expectedDescriptor.writable !== actualDescriptor.writable
      ) {
        throw new RangeError(`BP-033 W5500 evidence descriptor drift at ${path}.${name}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${name}`)
    }
  } finally {
    state.activeActual.delete(actual)
    state.activeExpected.delete(expected)
  }
}

function artifactBytes(artifactPath: string): Buffer {
  const relativePath = artifactPath.replace(/^packages\/scoring-circuit\//u, "")
  return readFileSync(new URL(`../${relativePath}`, import.meta.url))
}

function assertScopeAndEvidence(value: typeof bp033W5500CrystalSupportEvidence): void {
  const references = value.rows.flatMap((row) => row.references)
  if (
    value.rows.length !== 8 ||
    references.length !== requiredReferences.length ||
    new Set(references).size !== requiredReferences.length ||
    requiredReferences.some((reference) => !references.includes(reference))
  ) {
    throw new RangeError("BP-033 W5500 support reference scope drifted")
  }
  for (const row of value.rows) {
    const sourceIds: readonly string[] = row.sourceIds
    const boundFields: readonly string[] = row.boundFields
    if (sourceIds.length === 0 || boundFields.length === 0) {
      throw new RangeError(`BP-033 W5500 evidence missing for ${row.references.join(",")}`)
    }
    const rowSources = sourceIds.map((id) => value.sources.find((source) => source.id === id))
    if (rowSources.some((source) => source === undefined)) {
      throw new RangeError(`BP-033 W5500 source reference drifted for ${row.references.join(",")}`)
    }
    const exactSources = rowSources.filter((source) => source?.exactMpn === row.mpn)
    if (exactSources.length === 0 || exactSources.some((source) => source?.manufacturer !== row.manufacturer)) {
      throw new RangeError(`BP-033 W5500 exact MPN evidence drifted for ${row.references.join(",")}`)
    }
  }
  for (const source of value.sources) {
    const reviewedPagesOrFields: readonly string[] = source.reviewedPagesOrFields
    if (reviewedPagesOrFields.length === 0 || !/^[A-F0-9]{64}$/u.test(source.sha256)) {
      throw new RangeError(`BP-033 W5500 source metadata drifted for ${source.id}`)
    }
    const actualSha256 = createHash("sha256").update(artifactBytes(source.artifactPath)).digest("hex").toUpperCase()
    if (actualSha256 !== source.sha256) {
      throw new RangeError(`BP-033 W5500 retained evidence digest drifted for ${source.id}`)
    }
  }
}

/** Throws whenever references, exact MPNs, packages, retained bytes, or deny gates drift. */
export function validateBp033W5500CrystalSupportEvidence(value: unknown = bp033W5500CrystalSupportEvidence): true {
  try {
    assertScopeAndEvidence(bp033W5500CrystalSupportEvidence)
    assertExactDataGraph(
      value,
      privateBaseline,
      { actualToExpected: new Map(), expectedToActual: new Map(), activeActual: new Set(), activeExpected: new Set() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 W5500 exact-MPN evidence or deny state drifted")
  }
  return true
}
