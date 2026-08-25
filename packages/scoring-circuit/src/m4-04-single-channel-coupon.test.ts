import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { M404_SINGLE_CHANNEL_COUPON, validateM404SingleChannelCoupon } from "./m4-04-single-channel-coupon.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

describe("M4-04 single-channel sensing coupon", () => {
  it("passes the source-bound ERC and reconciles all schematic references to exact BOM identities", () => {
    expect(validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)).toBe(true)
    expect(M404_SINGLE_CHANNEL_COUPON.erc.status).toBe("pass")
    expect(M404_SINGLE_CHANNEL_COUPON.erc.checks.map((check) => check.net)).toEqual(
      expect.arrayContaining([
        "LINE",
        "QUIET",
        "AINP",
        "AINN",
        "REF_2V5",
        "V5_ANALOG",
        "V5_NEG",
        "APP_3V3",
        "SCORING_SGND"
      ])
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.reference)).toEqual(
      oneChannelAnalogExperimentBom.map((part) => part.reference)
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints).toHaveLength(40)
    expect(new Set(M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.exactMpn)).size).toBe(23)
  })

  it("records source evidence per exact MPN without inventing CAD or artwork", () => {
    for (const footprint of M404_SINGLE_CHANNEL_COUPON.footprints) {
      expect(footprint.evidence.exactMpn).toBe(footprint.exactMpn)
      expect(footprint.evidence.manufacturerPrimaryDocument.url).toMatch(/^https:\/\//u)
      expect(footprint.evidence.manufacturerCad.status).toBe("not-acquired")
      if (footprint.exactMpn === "ERA3AEB2491V") {
        expect(footprint.evidence.manufacturerCad).toMatchObject({
          availability: "not-published",
          sourceUrl:
            "https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V/cad",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html",
          sha256: "ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D"
        })
      } else {
        expect(footprint.evidence.manufacturerCad).toMatchObject({ availability: "not-verified" })
      }
      expect(footprint.evidence.reviewArtwork).toMatchObject({
        overlayStatus: "not-generated",
        status: "schematic-reference-only"
      })
    }
    expect(
      M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === "43650-0300")?.evidence
    ).toMatchObject({
      manufacturerDrawing: {
        acquisition: "series-drawing-identified-not-hash-acquired",
        drawingIdentifier: "SD-43650-001, revision D8",
        sha256: null
      }
    })
    expect(
      M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === "ADA4177-1ARZ")?.evidence
    ).toMatchObject({
      manufacturerDrawing: {
        acquisition: "not-acquired",
        artifactPath: null,
        drawingUrl: null,
        drawingIdentifier: null,
        geometry: null,
        sha256: null
      },
      manufacturerIdentitySource: {
        acquisition: "exact-primary-identity-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/analog-devices-ada4177-1arz-product.html",
        identityIdentifier: "Analog Devices ADA4177-1 product page and Rev. E data-sheet identity, R-8 package option",
        sourceUrl: "https://www.analog.com/en/products/ADA4177-1.html",
        geometry: null,
        byteMarkers: ["ADA4177-1ARZ", "SOIC_N", "R-8", "Rev. E"],
        sha256: "A456369D2013DAF8E166E9CC2BCB1AAF54834FA86EAA292F5C1BE89EBE316703"
      },
      manufacturerPrimaryDocument: {
        status: "identified-not-hash-acquired",
        url: "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf"
      }
    })
  })

  it("binds a thirteen-MPN manufacturer drawing batch without granting footprint authority", () => {
    const acquired = M404_SINGLE_CHANNEL_COUPON.footprints
      .filter((footprint) => footprint.evidence.manufacturerDrawing.acquisition === "exact-drawing-hash-bound")
      .filter(
        (footprint, index, footprints) =>
          footprints.findIndex((candidate) => candidate.exactMpn === footprint.exactMpn) === index
      )
      .map((footprint) => ({
        artifactPath: footprint.evidence.manufacturerDrawing.artifactPath,
        exactMpn: footprint.exactMpn,
        sha256: footprint.evidence.manufacturerDrawing.sha256,
        sourceUrl: footprint.evidence.manufacturerDrawing.drawingUrl
      }))

    expect(acquired).toEqual([
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf",
        exactMpn: "TPS60400DBVR",
        sha256: "B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tps60400.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf",
        exactMpn: "REF5025AQDRQ1",
        sha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B",
        sourceUrl: "https://www.ti.com/lit/gpn/REF5025A-Q1"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf",
        exactMpn: "TPD4E05U06DQAR",
        sha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf",
        exactMpn: "TMUX1112PWR",
        sha256: "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
        exactMpn: "ERA3AEB2491V",
        sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79",
        sourceUrl: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c102j5gactu-datasheet.pdf",
        exactMpn: "C0603C102J5GACTU",
        sha256: "B62452DE5A68C2E26AE145A4F4F4DF1D989AA5482AF4746C93A86155D5910221",
        sourceUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf",
        exactMpn: "ADS8881IDGS",
        sha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
        exactMpn: "T521B106M025ATE100",
        sha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD",
        sourceUrl: "https://search.kemet.com/download/specsheet/T521B106M025ATE100"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf",
        exactMpn: "CGA3E3X7R1H105K080AB",
        sha256: "E6F5803E89514DC61813BF2C96414D784005274730A8AF43A5EF54EBD546DBFF",
        sourceUrl:
          "https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/catalog/mlcc_automotive_general_zh.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
        exactMpn: "C0603C104K3RACTU",
        sha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
        sourceUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf",
        exactMpn: "GRM21BR71A106KE51L",
        sha256: "E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F",
        sourceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM21BR71A106KE51-01.pdf"
      }
    ])
    expect(
      M404_SINGLE_CHANNEL_COUPON.footprints
        .filter((footprint) => footprint.evidence.manufacturerDrawing.acquisition === "exact-drawing-hash-bound")
        .every((footprint) => footprint.evidence.manufacturerPrimaryDocument.status === "hash-bound")
    ).toBe(true)
    expect(M404_SINGLE_CHANNEL_COUPON.authority).toMatchObject({
      footprintsIndependentlyReviewed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("binds the exact Panasonic ERA3AEB2491V package and identity while recording CAD absence", () => {
    const resistor = M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === "ERA3AEB2491V")
    expect(resistor).toMatchObject({
      manufacturer: "Panasonic",
      exactMpn: "ERA3AEB2491V",
      package: "0603",
      evidence: {
        manufacturerDrawing: {
          acquisition: "exact-drawing-hash-bound",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
          drawingIdentifier: "Panasonic ERAA type, ERA3A 0603 manufacturer dimensions",
          drawingUrl: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf",
          geometry: null,
          sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79",
          supportingSources: [
            {
              classification: "manufacturer-recommended-land-pattern",
              artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf",
              sourceUrl: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf",
              sha256: "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D",
              scope: expect.stringContaining("Manufacturer guidance only")
            }
          ]
        },
        manufacturerIdentitySource: {
          acquisition: "exact-primary-identity-hash-bound",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html",
          sourceUrl: "https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V",
          identityIdentifier:
            "Panasonic Industry exact ERA3AEB2491V product page, 0603 / 1.6 x 0.8 mm, 2490 ohm, 0.1 percent, 0.1 W, 25 ppm/K",
          geometry: null,
          sha256: "BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048"
        },
        manufacturerCad: {
          availability: "not-published",
          sourceUrl:
            "https://industrial.panasonic.cn/ea/products/pt/high-precision-chip-resistors/models/ERA3AEB2491V/cad",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html",
          sha256: "ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D",
          status: "not-acquired"
        },
        reviewArtwork: { overlayStatus: "not-generated", status: "schematic-reference-only" }
      },
      footprintRelease: "deny"
    })
    expect(resistor?.evidence.manufacturerDrawing.scope).toContain("a = 0.7-0.9 mm")
    expect(resistor?.evidence.manufacturerDrawing.scope).toContain("no project footprint")
    expect(resistor?.evidence.manufacturerCad.scope).toContain("no Panasonic CAD object")
  })

  it("does not carry the removed isolation converter into the active coupon footprint set", () => {
    const converter = M404_SINGLE_CHANNEL_COUPON.footprints.find(
      (footprint) => String(footprint.exactMpn) === "NXE1S0505MC"
    )
    expect(converter).toBeUndefined()
  })

  it("binds the corrected ADA4177-1ARZ primary identity capture without granting drawing or release authority", () => {
    const buffer = M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === "ADA4177-1ARZ")
    expect(buffer).toMatchObject({
      manufacturer: "Analog Devices",
      package: "R SOIC-8",
      evidence: {
        manufacturerDrawing: {
          acquisition: "not-acquired",
          artifactPath: null,
          drawingUrl: null,
          drawingIdentifier: null,
          geometry: null,
          byteMarkers: [],
          sha256: null
        },
        manufacturerIdentitySource: {
          acquisition: "exact-primary-identity-hash-bound",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/analog-devices-ada4177-1arz-product.html",
          sourceUrl: "https://www.analog.com/en/products/ADA4177-1.html",
          identityIdentifier:
            "Analog Devices ADA4177-1 product page and Rev. E data-sheet identity, R-8 package option",
          geometry: null,
          byteMarkers: ["ADA4177-1ARZ", "SOIC_N", "R-8", "Rev. E"],
          sha256: "A456369D2013DAF8E166E9CC2BCB1AAF54834FA86EAA292F5C1BE89EBE316703",
          scope: expect.stringContaining("not a manufacturer package drawing")
        },
        manufacturerPrimaryDocument: {
          status: "identified-not-hash-acquired",
          url: "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf"
        },
        manufacturerCad: { availability: "not-verified", status: "not-acquired" },
        reviewArtwork: { overlayStatus: "not-generated", status: "schematic-reference-only" }
      },
      footprintRelease: "deny"
    })
  })

  it("hash-binds the exact TDK selection sources without inventing 5 V effective capacitance", () => {
    const repoRoot = new URL("../../../", import.meta.url)
    const selected = M404_SINGLE_CHANNEL_COUPON.selectedOneUfCapacitor
    expect(selected).toMatchObject({
      manufacturer: "TDK",
      selectedMpn: "CGA3E3X7R1H105K080AB",
      nonAutomotiveAlternativeMpn: "C1608X7R1H105K080AB",
      selection: {
        aecQ200: true,
        capacitanceTolerancePercent: 10,
        nominalCapacitanceUf: 1,
        operatingTemperatureC: { maximum: 125, minimum: -55 },
        package: { eia: "0603", metric: "1608" },
        ratedVoltageVdc: 50,
        temperatureCharacteristic: "X7R"
      },
      dcBiasEvidence: {
        exactEffectiveCapacitanceAt5V: null,
        modelBytesAcquired: false,
        rawCsvBytesAcquired: false
      },
      authority: {
        artworkApproved: false,
        cadApproved: false,
        fabricationApproved: false,
        footprintApproved: false,
        orientationApproved: false,
        procurementApproved: false,
        releaseState: "deny"
      }
    })
    expect(selected.recommendedLandPatternGuidanceMm).toEqual({
      flow: { pa: [0.7, 1], pb: [0.8, 1], pc: [0.6, 0.8] },
      reflow: { pa: [0.6, 0.8], pb: [0.6, 0.8], pc: [0.6, 0.8] },
      sourceUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E3X7R1H105K080AB"
    })
    for (const source of [
      selected.sources.exactPartDetail,
      selected.sources.automotiveCatalog,
      selected.sources.virtualComponentLibraryPartsList
    ]) {
      const bytes = readFileSync(new URL(source.artifactPath, repoRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
  })

  it("retains a Vishay D/CRCW family drawing as series evidence, not exact-MPN evidence", () => {
    const expectedMpn = [
      "CRCW060322R0FKEAHP",
      "CRCW120656K0FKEAHP",
      "CRCW0603100KFKEAHP",
      "CRCW060320R0FKEAHP"
    ] as const
    const records = M404_SINGLE_CHANNEL_COUPON.footprints.filter((footprint) =>
      expectedMpn.includes(footprint.exactMpn as (typeof expectedMpn)[number])
    )
    expect(records.map((record) => record.exactMpn)).toEqual(expectedMpn)
    expect(new Set(records.map((record) => record.evidence.manufacturerDrawing.artifactPath)).size).toBe(1)
    for (const record of records) {
      expect(record.evidence.manufacturerPrimaryDocument).toMatchObject({
        status: "series-hash-bound",
        url: "https://www.vishay.com/docs/20035/dcrcwe3.pdf"
      })
      expect(record.evidence.manufacturerDrawing).toMatchObject({
        acquisition: "series-drawing-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf",
        drawingUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
        geometry: null,
        sha256: "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
      })
      expect(record.evidence.manufacturerDrawing.scope).toContain("does not name this exact CRCW orderable MPN")
      expect(record.footprintRelease).toBe("deny")
    }
    expect(M404_SINGLE_CHANNEL_COUPON.authority).toMatchObject({
      footprintsIndependentlyReviewed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("keeps the JST guarded-force connector source hash-bound at family scope", () => {
    const connector = M404_SINGLE_CHANNEL_COUPON.footprints.find(
      (footprint) => footprint.exactMpn === "B2B-PH-K-S(LF)(SN)"
    )
    expect(connector?.evidence.manufacturerDrawing).toMatchObject({
      acquisition: "series-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/jst-ph-series-datasheet.pdf",
      drawingIdentifier: "JST ePH, PH series header layout, manufacturer dimensions",
      drawingUrl: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf",
      geometry: null,
      sha256: "447624F4F2F7D37C58C1EAA7EE314AD757FE7AFF48F6186491EF6F69FBC00B96"
    })
    expect(connector?.evidence.manufacturerPrimaryDocument.status).toBe("series-hash-bound")
    expect(connector?.evidence.manufacturerDrawing.scope).toContain("does not prove the exact suffix")
    expect(connector?.footprintRelease).toBe("deny")
  })

  it("records the JST PHR-2 mate separately at family scope without creating footprint authority", () => {
    expect(M404_SINGLE_CHANNEL_COUPON.connectorMates).toEqual([
      {
        connectorReference: "J_GUARDED_FORCE",
        boardMpn: "B2B-PH-K-S(LF)(SN)",
        mateMpn: "PHR-2",
        manufacturer: "JST",
        role: "mate-only",
        manufacturerDrawing: {
          acquisition: "series-drawing-hash-bound",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/jst-ph-series-datasheet.pdf",
          drawingIdentifier: "JST ePH, page 3 exact PHR-2 housing table, manufacturer dimensions",
          drawingUrl: "https://www.jst-mfg.com/product/pdf/eng/ePH.pdf",
          geometry: null,
          byteMarkers: ["PH", "B2B"],
          sha256: "447624F4F2F7D37C58C1EAA7EE314AD757FE7AFF48F6186491EF6F69FBC00B96",
          scope: expect.stringContaining("explicitly lists PHR-2")
        }
      }
    ])
    expect(M404_SINGLE_CHANNEL_COUPON.connectorMates[0]?.manufacturerDrawing.geometry).toBeNull()
    expect(M404_SINGLE_CHANNEL_COUPON.authority).toMatchObject({
      footprintsIndependentlyReviewed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("keeps the RCWE0603 resistor source hash-bound at family scope", () => {
    const resistor = M404_SINGLE_CHANNEL_COUPON.footprints.find(
      (footprint) => footprint.exactMpn === "RCWE0603R220FKEA"
    )
    expect(resistor?.evidence.manufacturerDrawing).toMatchObject({
      acquisition: "series-drawing-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf",
      drawingIdentifier: "Vishay RCWE, revision 24-Oct-2023, document 20019, RCWE0603 series drawing",
      drawingUrl: "https://www.vishay.com/docs/20019/rcwe.pdf",
      geometry: null,
      sha256: "5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374"
    })
    expect(resistor?.evidence.manufacturerDrawing.scope).toContain("does not name the exact RCWE0603R220FKEA orderable")
    expect(resistor?.evidence.manufacturerPrimaryDocument.status).toBe("series-hash-bound")
    expect(resistor?.footprintRelease).toBe("deny")
  })

  it("hash-verifies every retained drawing and checks its source markers from PDF bytes", () => {
    const repoRoot = new URL("../../../", import.meta.url)
    const inflatePdfStreams = (bytes: Buffer) => {
      let decoded = ""
      let cursor = 0
      while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
        const streamStart =
          bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
            ? cursor + 8
            : bytes[cursor + 6] === 10
              ? cursor + 7
              : cursor + 6
        const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
        if (streamEnd < 0) break
        try {
          decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
        } catch {
          // Non-content or uncompressed streams do not contribute to marker checks.
        }
        cursor = streamEnd + "endstream".length
      }
      return decoded
    }

    for (const drawing of [
      ...M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.evidence.manufacturerDrawing),
      ...M404_SINGLE_CHANNEL_COUPON.connectorMates.map((mate) => mate.manufacturerDrawing)
    ]) {
      if (drawing.acquisition !== "exact-drawing-hash-bound" && drawing.acquisition !== "series-drawing-hash-bound") {
        continue
      }
      const bytes = readFileSync(new URL(drawing.artifactPath, repoRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(drawing.sha256)
      const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
      for (const marker of drawing.byteMarkers) expect(pdfContent).toContain(marker)
      expect(drawing.drawingIdentifier).toMatch(/(?:mechanical drawing|manufacturer dimensions|series drawing)$/u)
      expect(drawing.geometry).toBeNull()
    }
  }, 15_000)

  it("hash-verifies primary identity captures without treating them as manufacturer drawings", () => {
    const repoRoot = new URL("../../../", import.meta.url)
    const footprint = M404_SINGLE_CHANNEL_COUPON.footprints.find((candidate) => candidate.exactMpn === "ADA4177-1ARZ")
    const identity = footprint?.evidence.manufacturerIdentitySource
    expect(identity).toMatchObject({
      acquisition: "exact-primary-identity-hash-bound",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/analog-devices-ada4177-1arz-product.html",
      sourceUrl: "https://www.analog.com/en/products/ADA4177-1.html",
      geometry: null,
      sha256: "A456369D2013DAF8E166E9CC2BCB1AAF54834FA86EAA292F5C1BE89EBE316703"
    })
    if (identity?.acquisition !== "exact-primary-identity-hash-bound" || identity.artifactPath === null) {
      throw new Error("ADA4177-1ARZ identity capture must be hash-bound")
    }
    const bytes = readFileSync(new URL(identity.artifactPath, repoRoot))
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(identity.sha256)
    for (const marker of identity.byteMarkers) expect(bytes.toString("utf8")).toContain(marker)
    expect(footprint?.evidence.manufacturerDrawing).toMatchObject({
      acquisition: "not-acquired",
      artifactPath: null,
      drawingUrl: null,
      geometry: null,
      sha256: null
    })
    expect(footprint?.evidence.manufacturerCad).toMatchObject({ availability: "not-verified", status: "not-acquired" })
    expect(footprint?.footprintRelease).toBe("deny")
  })

  it("hash-verifies the Panasonic exact-MPN, recommended-land-pattern, and CAD-status captures", () => {
    const repoRoot = new URL("../../../", import.meta.url)
    const sources = [
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html",
        sha256: "BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048",
        markers: ["ERA3AEB2491V", "1.6 x 0.8", "2490.0000"]
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
        sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79",
        markers: ["%PDF-1.7"]
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf",
        sha256: "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D",
        markers: ["%PDF-1.7"]
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html",
        sha256: "ADA48ECB98E85E4C346D9365C1C6BC7FED81504131E1B761854AD664D960A93D",
        markers: ["ERA3AEB2491V", "CAD Data", "no-es-cad-files", "componentsearchengine.com", "snapeda.com"]
      }
    ]
    const inflatePdfStreams = (bytes: Buffer) => {
      let decoded = ""
      let cursor = 0
      while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
        const streamStart =
          bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
            ? cursor + 8
            : bytes[cursor + 6] === 10
              ? cursor + 7
              : cursor + 6
        const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
        if (streamEnd < 0) break
        try {
          decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
        } catch {
          // Non-content or uncompressed streams do not contribute to marker checks.
        }
        cursor = streamEnd + "endstream".length
      }
      return decoded
    }
    for (const source of sources) {
      const bytes = readFileSync(new URL(source.artifactPath, repoRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      const content = source.artifactPath.endsWith(".pdf")
        ? `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
        : bytes.toString("utf8")
      for (const marker of source.markers) expect(content).toContain(marker)
    }
    expect(
      M404_SINGLE_CHANNEL_COUPON.footprints.find((footprint) => footprint.exactMpn === "ERA3AEB2491V")?.footprintRelease
    ).toBe("deny")
  })

  it("requires a separate root reviewer and refuses to convert implementation reconciliation into footprint approval", () => {
    for (const footprint of M404_SINGLE_CHANNEL_COUPON.footprints) {
      expect(footprint.implementationEvidence.reviewerId).not.toBe(footprint.independentDrawingReview.reviewerId)
      expect(footprint.independentDrawingReview).toMatchObject({ reviewerId: "root-final-reviewer", status: "pending" })
      expect(footprint.footprintRelease).toBe("deny")
    }
    expect(M404_SINGLE_CHANNEL_COUPON.authority).toMatchObject({
      footprintsIndependentlyReviewed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it.each([
    ["forged ERC pass", (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.erc, "status", "fail")],
    [
      "forged footprint approval",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.footprints[0], "footprintRelease", "released")
    ],
    [
      "cross-MPN source reuse",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) =>
        Reflect.set(copy.footprints[0].evidence, "exactMpn", copy.footprints[1]?.exactMpn)
    ],
    [
      "self approved drawing",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) =>
        Reflect.set(copy.footprints[0].independentDrawingReview, "reviewerId", "m4-04-implementation-agent")
    ],
    [
      "unacquired series drawing represented as acquired",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) =>
        Reflect.set(
          copy.footprints.find((footprint) => footprint.exactMpn === "43650-0300")?.evidence.manufacturerDrawing ?? {},
          "acquisition",
          "source-recorded"
        )
    ],
    [
      "series evidence promoted to exact-MPN evidence",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) =>
        Reflect.set(
          copy.footprints.find((footprint) => footprint.exactMpn === "CRCW060322R0FKEAHP")?.evidence
            .manufacturerDrawing ?? {},
          "acquisition",
          "exact-drawing-hash-bound"
        )
    ],
    [
      "fabrication authority",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ]
  ])("rejects %s", (_name, mutate) => {
    const copy = structuredClone(M404_SINGLE_CHANNEL_COUPON)
    mutate(copy)
    expect(() => validateM404SingleChannelCoupon(copy)).toThrow(RangeError)
  })
})
