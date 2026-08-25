import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"

const tdkCaptureSha256 = "BFCA5B5FA3A61383D54E9DF3AC784B571747A28D3E8ADA7410DE2391C3A40A93"

type ExactBinding = {
  readonly reference: string
  readonly manufacturer: string
  readonly manufacturerPartNumber: string
  readonly package: string
}

function buildCandidateDefinition() {
  const exactBindings = [
    {
      reference: "U_APP_REGULATOR",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "LMR43620MSC3RPERQ1",
      package: "VQFN-HR RPE, 2 mm x 2 mm"
    },
    {
      reference: "L_APP_REGULATOR",
      manufacturer: "Coilcraft",
      manufacturerPartNumber: "XGL4030-222MEC",
      package: "XGL4030, 4 mm x 4 mm x 3 mm molded power inductor"
    },
    {
      reference: "C_APP_REG_IN",
      manufacturer: "TDK",
      manufacturerPartNumber: "C2012X7R1E475K125AB",
      package: "0805"
    },
    {
      reference: "C_APP_REG_VCC",
      manufacturer: "Wurth Elektronik",
      manufacturerPartNumber: "885012206052",
      package: "0603"
    },
    {
      reference: "R_APP_REG_DISCHARGE",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0603FR-071KL",
      package: "0603"
    }
  ] as const satisfies readonly ExactBinding[]

  return {
    artifactKind: "bp033-application-regulator-support-footprint-evidence",
    workUnit: "BP-033",
    candidateStatus: "exact-orderables-proven-review-only",
    scope: {
      references: exactBindings.map((binding) => binding.reference),
      excludes: [
        "C_APP_REG_IN_HF",
        "C_APP_REG_BOOT",
        "C_APP_REG_OUT_A",
        "C_APP_REG_OUT_B",
        "C_APP_REG_OUT_C",
        "R_APP_REG_PGOOD"
      ],
      canonicalLedger: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
      topologyContract: "packages/scoring-circuit/src/bench-prototype-application-rail.ts"
    },
    exactBindings,
    sources: [
      {
        id: "ti-lmr43620-q1-datasheet",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Texas Instruments",
        manufacturerPartNumber: "LMR43620MSC3RPERQ1",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/ti-lmr43620-q1-datasheet.pdf",
        sha256: "DB767B9234F756C358C8254E682B917F16381EB0DB649A2936833E15EB8037FD",
        url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf",
        reviewedPdfPages: [50, 54, 55, 56],
        exactOrderableEvidence: "PDF page 50 names LMR43620MSC3RPERQ1 as VQFN-HR RPE, 9-pin orderable.",
        geometryEvidence:
          "PDF pages 54 through 56 are the RPE0009A package outline, land-pattern, mask, and stencil drawings."
      },
      {
        id: "coilcraft-xgl4030-datasheet",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Coilcraft",
        manufacturerPartNumber: "XGL4030-222MEC",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/coilcraft-xgl4030-datasheet.pdf",
        sha256: "34BB1C739914FC2114653D5B3D5893E90501129D5C2AF8A152E546B8068B72E5",
        url: "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf",
        reviewedPdfPages: [1, 4],
        exactOrderableEvidence: "Page 1 lists XGL4030-222ME_ and its order-code key maps E and C to XGL4030-222MEC.",
        geometryEvidence: "Page 4 gives the 0.98 mm by 3.40 mm two-pad recommended land pattern and 2.37 mm inner gap."
      },
      {
        id: "tdk-c2012x7r1e475k125ab-product-page",
        authority: "manufacturer-primary-page-capture",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7R1E475K125AB",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/tdk-c2012x7r1e475k125ab-product-page-capture.md",
        sha256: tdkCaptureSha256,
        url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7R1E475K125AB",
        reviewedPdfPages: [],
        exactOrderableEvidence:
          "The primary product page names C2012X7R1E475K125AB, Production status, C2012 0805 series, 4.7 uF, 25 VDC, and X7R.",
        geometryEvidence:
          "The exact page gives package dimensions and PA/PB/PC reflow land-pattern ranges, but not a finished CAD mapping."
      },
      {
        id: "wurth-885012206052-datasheet",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Wurth Elektronik",
        manufacturerPartNumber: "885012206052",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/wurth-885012206052-datasheet.pdf",
        sha256: "459D7762A62A7A4BF66BDA7F96D4306A1EFFCCA85C8BB68F7B8444D5BBAFEA0F",
        url: "https://www.we-online.com/components/products/datasheet/885012206052.pdf",
        reviewedPdfPages: [1],
        exactOrderableEvidence: "Page 1 prints order code 885012206052, 1 uF, 16 VDC, X7R, 0603.",
        geometryEvidence:
          "Page 1 gives the reflow recommended land pattern: 2.3 mm total, 0.7 mm gap, 0.8 mm pad width."
      },
      {
        id: "yageo-rc0603fr-071kl-datasheet",
        authority: "manufacturer-primary-retained-bytes",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0603FR-071KL",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-071kl-datasheet.pdf",
        sha256: "81CC922D526F75AC7B479167DC5BC3B6A46618F09A7F8BEB2C5E309767E596CB",
        url: "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-071KL",
        reviewedPdfPages: [1],
        exactOrderableEvidence: "Page 1 names RC0603FR-071KL as 1 kOhm, 1 percent, 0603 / 1608.",
        geometryEvidence: "Page 1 gives 1.6 mm by 0.8 mm body and terminal dimensions; it publishes no land pattern."
      }
    ],
    families: [
      {
        reference: "U_APP_REGULATOR",
        manufacturerPartNumber: "LMR43620MSC3RPERQ1",
        package: {
          designation: "VQFN-HR RPE0009A",
          bodyMm: { minimum: 1.9, maximum: 2.1, maximumHeight: 1 },
          terminals: 9,
          pinDirection:
            "Top view: pin 1 is lower-left; 1 through 4 run up the left side, 5 through 8 run down the right side, and 9 is the central HotRod ground terminal."
        },
        manufacturerGeometry: {
          state: "published-exact-orderable",
          copper:
            "TI's compound RPE0009A land pattern is on retained PDF page 55; it must remain a single locked CAD import.",
          solderMask: "TI page 55 shows NSMD preferred with 0.05 mm maximum mask all around.",
          paste: "TI page 56 specifies 0.125 mm stencil, 90 percent coverage at pads 1 and 8, and 85 percent at pad 9.",
          courtyard: "not-published"
        },
        projectReviewGeometry: {
          state: "drawing-trace-only-not-emitted",
          coordinateConvention:
            "TI top-view drawing; no simplified rectangular-pad substitution is generated for compound copper.",
          accepted: false,
          fabricationAuthority: "deny"
        }
      },
      {
        reference: "L_APP_REGULATOR",
        manufacturerPartNumber: "XGL4030-222MEC",
        package: {
          designation: "XGL4030 molded inductor",
          bodyMm: { length: 4, width: 4, maximumHeight: 3.1 },
          terminals: 2,
          pinDirection:
            "Connect the marked short-lead side to the high dV/dt node for lowest EMI; electrical terminals remain symmetric."
        },
        manufacturerGeometry: {
          state: "published-exact-series-order-code",
          copper: "Two 0.98 mm by 3.40 mm pads with 2.37 mm inner gap.",
          solderMask: "not-published",
          paste: "not-published",
          courtyard: "not-published"
        },
        projectReviewGeometry: {
          state: "review-only-source-derived",
          coordinateConvention:
            "Local X is terminal-to-terminal; pad 1 is at negative X and is the marked short-lead switch-node side.",
          pads: [
            { pad: "1", xMm: -1.675, yMm: 0, widthMm: 0.98, heightMm: 3.4 },
            { pad: "2", xMm: 1.675, yMm: 0, widthMm: 0.98, heightMm: 3.4 }
          ],
          accepted: false,
          fabricationAuthority: "deny"
        }
      },
      {
        reference: "C_APP_REG_IN",
        manufacturerPartNumber: "C2012X7R1E475K125AB",
        package: {
          designation: "C2012 EIA 0805 MLCC",
          bodyMm: { lengthNominal: 2, widthNominal: 1.25, thicknessNominal: 1.25 },
          terminals: 2,
          pinDirection: "Non-polar two-terminal MLCC; 180-degree rotation is electrically equivalent."
        },
        manufacturerGeometry: {
          state: "published-exact-orderable-range-only",
          copper: "TDK lists reflow PA 0.90 to 1.20 mm, PB 0.70 to 0.90 mm, PC 0.90 to 1.20 mm.",
          solderMask: "not-published",
          paste: "not-published",
          courtyard: "not-published"
        },
        projectReviewGeometry: {
          state: "range-retained-not-transformed-to-pads",
          coordinateConvention:
            "The exact TDK page does not map PA/PB/PC to a finished CAD pad-axis convention; no pad coordinates are inferred.",
          accepted: false,
          fabricationAuthority: "deny"
        }
      },
      {
        reference: "C_APP_REG_VCC",
        manufacturerPartNumber: "885012206052",
        package: {
          designation: "WCAP-CSGP 0603 MLCC",
          bodyMm: { lengthNominal: 1.6, widthNominal: 0.8, thicknessNominal: 0.8 },
          terminals: 2,
          pinDirection: "Non-polar two-terminal MLCC; 180-degree rotation is electrically equivalent."
        },
        manufacturerGeometry: {
          state: "published-exact-orderable",
          copper: "Reflow drawing gives two 0.8 mm by 0.8 mm pads, 0.7 mm inner gap, 2.3 mm total pattern length.",
          solderMask: "not-published",
          paste: "not-published",
          courtyard: "not-published"
        },
        projectReviewGeometry: {
          state: "review-only-source-derived",
          coordinateConvention:
            "Local X is terminal-to-terminal; pad 1 is negative X and pad 2 positive X, with no electrical polarity.",
          pads: [
            { pad: "1", xMm: -0.75, yMm: 0, widthMm: 0.8, heightMm: 0.8 },
            { pad: "2", xMm: 0.75, yMm: 0, widthMm: 0.8, heightMm: 0.8 }
          ],
          accepted: false,
          fabricationAuthority: "deny"
        }
      },
      {
        reference: "R_APP_REG_DISCHARGE",
        manufacturerPartNumber: "RC0603FR-071KL",
        package: {
          designation: "RC 0603 / 1608 thick-film resistor",
          bodyMm: { lengthNominal: 1.6, widthNominal: 0.8, thicknessNominal: 0.45 },
          terminals: 2,
          pinDirection: "Non-polar two-terminal resistor; 180-degree rotation is electrically equivalent."
        },
        manufacturerGeometry: {
          state: "package-only-exact-orderable",
          copper: "not-published",
          solderMask: "not-published",
          paste: "not-published",
          courtyard: "not-published"
        },
        projectReviewGeometry: {
          state: "review-only-project-input",
          coordinateConvention:
            "Local X is terminal-to-terminal; pad 1 is negative X and pad 2 positive X, with no electrical polarity.",
          derivation: "0.9 mm square pads and 0.5 mm inner gap are project inputs, not Yageo land guidance.",
          pads: [
            { pad: "1", xMm: -0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 },
            { pad: "2", xMm: 0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 }
          ],
          accepted: false,
          fabricationAuthority: "deny"
        }
      }
    ],
    denyGates: {
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      boardPlacement: { state: "not-integrated", authority: "deny" },
      physicalFitAndClearance: { state: "not-reviewed", authority: "deny" },
      switchingLoopAndThermal: { state: "not-reviewed", authority: "deny" },
      assemblyProcess: { state: "not-reviewed", authority: "deny" },
      fabrication: { state: "deny", authority: "deny" },
      release: { state: "deny", authority: "deny" },
      accepted: false
    }
  } as const
}

function freezeDataGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 private/public evidence graphs must not contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor))
      throw new RangeError("BP-033 evidence graphs must be data-only")
    freezeDataGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const privateBaseline = freezeDataGraph(buildCandidateDefinition())
export const bp033ApplicationRegulatorSupportFootprintEvidence = freezeDataGraph(buildCandidateDefinition())

type GraphState = {
  readonly actualToExpected: Map<object, object>
  readonly expectedToActual: Map<object, object>
  readonly activeActual: Set<object>
  readonly activeExpected: Set<object>
}

function assertExactPlainDataGraph(actual: unknown, expected: unknown, state: GraphState, path: string): void {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 data drift at ${path}`)
    return
  }
  if (actual === null || typeof actual !== "object") throw new RangeError(`BP-033 object drift at ${path}`)
  if (state.activeActual.has(actual) || state.activeExpected.has(expected))
    throw new RangeError(`BP-033 cycle at ${path}`)
  if (state.actualToExpected.has(actual) || state.expectedToActual.has(expected))
    throw new RangeError(`BP-033 alias at ${path}`)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected))
    throw new RangeError(`BP-033 prototype drift at ${path}`)
  if (
    (Array.isArray(actual) && Object.getPrototypeOf(actual) !== Array.prototype) ||
    (!Array.isArray(actual) && Object.getPrototypeOf(actual) !== Object.prototype)
  ) {
    throw new RangeError(`BP-033 non-plain graph node at ${path}`)
  }
  if (Array.isArray(actual) !== Array.isArray(expected)) throw new RangeError(`BP-033 container drift at ${path}`)
  const expectedSymbols = Object.getOwnPropertySymbols(expected)
  const actualSymbols = Object.getOwnPropertySymbols(actual)
  if (expectedSymbols.length !== 0 || actualSymbols.length !== 0)
    throw new RangeError(`BP-033 symbol property at ${path}`)
  const expectedNames = Object.getOwnPropertyNames(expected)
  const actualNames = Object.getOwnPropertyNames(actual)
  if (expectedNames.length !== actualNames.length || expectedNames.some((name) => !actualNames.includes(name))) {
    throw new RangeError(`BP-033 property drift at ${path}`)
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
        expectedDescriptor.get !== undefined ||
        expectedDescriptor.set !== undefined ||
        actualDescriptor.get !== undefined ||
        actualDescriptor.set !== undefined ||
        expectedDescriptor.enumerable !== actualDescriptor.enumerable ||
        expectedDescriptor.configurable !== actualDescriptor.configurable ||
        expectedDescriptor.writable !== actualDescriptor.writable
      ) {
        throw new RangeError(`BP-033 descriptor or accessor drift at ${path}.${name}`)
      }
      assertExactPlainDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${name}`)
    }
  } finally {
    state.activeActual.delete(actual)
    state.activeExpected.delete(expected)
  }
}

function assertCanonicalApplicationBindings(candidate: typeof bp033ApplicationRegulatorSupportFootprintEvidence): void {
  if (!validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)) {
    throw new RangeError("BP-033 canonical application footprint ledger is invalid")
  }
  for (const binding of candidate.exactBindings) {
    const matches = benchPrototypeApplicationFootprints.records.filter(
      (record) =>
        record.reference === binding.reference &&
        record.manufacturer === binding.manufacturer &&
        record.mpn === binding.manufacturerPartNumber &&
        record.package === binding.package
    )
    if (matches.length !== 1)
      throw new RangeError(`BP-033 canonical binding missing or duplicated: ${binding.reference}`)
  }
}

/** Throws whenever exact source, canonical binding, graph, or a deny gate drifts. */
export function validateBp033ApplicationRegulatorSupportFootprintEvidence(
  value: unknown = bp033ApplicationRegulatorSupportFootprintEvidence
): true {
  try {
    assertCanonicalApplicationBindings(bp033ApplicationRegulatorSupportFootprintEvidence)
    assertExactPlainDataGraph(
      value,
      privateBaseline,
      { actualToExpected: new Map(), expectedToActual: new Map(), activeActual: new Set(), activeExpected: new Set() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 application-regulator support exact evidence or deny state drifted")
  }
  return true
}
