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
      expect.arrayContaining(["LINE", "QUIET", "AINP", "AINN", "REF_2V5", "S5V_ISO", "S3V3_ISO", "SGND"])
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.reference)).toEqual(
      oneChannelAnalogExperimentBom.map((part) => part.reference)
    )
    expect(M404_SINGLE_CHANNEL_COUPON.footprints).toHaveLength(45)
    expect(new Set(M404_SINGLE_CHANNEL_COUPON.footprints.map((footprint) => footprint.exactMpn)).size).toBe(26)
  })

  it("records source evidence per exact MPN without inventing CAD or artwork", () => {
    for (const footprint of M404_SINGLE_CHANNEL_COUPON.footprints) {
      expect(footprint.evidence.exactMpn).toBe(footprint.exactMpn)
      expect(footprint.evidence.manufacturerPrimaryDocument.url).toMatch(/^https:\/\//u)
      expect(footprint.evidence.manufacturerCad).toMatchObject({ availability: "not-verified", status: "not-acquired" })
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
  })

  it("binds a nine-MPN first-party drawing batch without granting footprint authority", () => {
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
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps7a20-dbvr-datasheet.pdf",
        exactMpn: "TPS7A2033PDBVR",
        sha256: "6EBFF717770572C7E301A5C16345F50A558EF379A727984ED0F3A6B1DCD400D1",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tps7a20.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-ref5025a-q1-datasheet.pdf",
        exactMpn: "REF5025AQDRQ1",
        sha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B",
        sourceUrl: "https://www.ti.com/lit/gpn/REF5025A-Q1"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tpd4e05u06-dqar-datasheet.pdf",
        exactMpn: "TPD4E05U06DQAR",
        sha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tmux1112-pwr-datasheet.pdf",
        exactMpn: "TMUX1112PWR",
        sha256: "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c102j5gactu-datasheet.pdf",
        exactMpn: "C0603C102J5GACTU",
        sha256: "B62452DE5A68C2E26AE145A4F4F4DF1D989AA5482AF4746C93A86155D5910221",
        sourceUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C102J5GACTU?lang=en"
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-ads8881-dgs-datasheet.pdf",
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
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
        exactMpn: "C0603C104K3RACTU",
        sha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
        sourceUrl: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"
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

  it("hash-verifies every retained drawing and checks exact orderable and package markers from PDF bytes", () => {
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

    for (const footprint of M404_SINGLE_CHANNEL_COUPON.footprints) {
      const drawing = footprint.evidence.manufacturerDrawing
      if (drawing.acquisition !== "exact-drawing-hash-bound") continue
      const bytes = readFileSync(new URL(drawing.artifactPath, repoRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(drawing.sha256)
      const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
      for (const marker of drawing.byteMarkers) expect(pdfContent).toContain(marker)
      expect(drawing.drawingIdentifier).toMatch(/(?:mechanical drawing|manufacturer dimensions)$/u)
      expect(drawing.geometry).toBeNull()
    }
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
      "fabrication authority",
      (copy: typeof M404_SINGLE_CHANNEL_COUPON) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ]
  ])("rejects %s", (_name, mutate) => {
    const copy = structuredClone(M404_SINGLE_CHANNEL_COUPON)
    mutate(copy)
    expect(() => validateM404SingleChannelCoupon(copy)).toThrow(RangeError)
  })
})
