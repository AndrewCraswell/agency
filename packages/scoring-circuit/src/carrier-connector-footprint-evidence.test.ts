import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  canReleaseCarrierConnector,
  carrierConnectorFootprintEvidence,
  findCarrierConnectorEvidence,
  validateCarrierConnectorEvidence
} from "./carrier-connector-footprint-evidence.js"

describe("carrier connector footprint evidence", () => {
  it("binds every acquired manufacturer source to the checked-in artifact bytes", () => {
    const acquiredSources = carrierConnectorFootprintEvidence.flatMap((record) =>
      record.primarySources.filter((source) => source.access === "manufacturer-acquired-hash-bound")
    )

    expect(acquiredSources).toHaveLength(3)
    for (const source of acquiredSources) {
      const artifact = source.acquiredArtifact
      if (artifact === undefined) throw new Error("Hash-bound source is missing its acquired artifact")
      const url = new URL(`../../../${artifact.evidenceFile}`, import.meta.url)
      expect(createHash("sha256").update(readFileSync(url)).digest("hex").toUpperCase()).toBe(artifact.sha256)
    }
  })

  it("keeps the selected Molex and Samtec records unique and fabrication-denied", () => {
    expect(validateCarrierConnectorEvidence(carrierConnectorFootprintEvidence)).toEqual([])
    expect(new Set(carrierConnectorFootprintEvidence.map((record) => record.mpn)).size).toBe(
      carrierConnectorFootprintEvidence.length
    )
    for (const record of carrierConnectorFootprintEvidence) {
      expect(record.releaseState).toBe("deny")
      expect(record.missingReleaseEvidence.length).toBeGreaterThan(0)
      expect(record.primarySources.length).toBeGreaterThan(0)
      expect(canReleaseCarrierConnector(record)).toBe(false)
    }
  })

  it("models the exact four-circuit Molex header and keyed harness mate", () => {
    const header = findCarrierConnectorEvidence("43045-0400")
    const housing = findCarrierConnectorEvidence("43025-0400")
    const terminal = findCarrierConnectorEvidence("43030-0007")
    if (header === undefined || housing === undefined || terminal === undefined) {
      throw new Error("Molex carrier connector evidence is incomplete")
    }

    expect(header).toMatchObject({
      exactMates: ["43025-0400"],
      footprint: {
        boardEdgePlacementMaxMm: 10.16,
        boardThicknessMm: 1.57,
        copper: { contactCount: 4, pitchMm: 3, rowCount: 2 },
        holes: expect.arrayContaining([
          expect.objectContaining({ diameterMm: 1.02, id: "1", kind: "plated-hole" }),
          expect.objectContaining({ diameterMm: 1.02, id: "4", kind: "plated-hole" })
        ])
      },
      package: expect.stringContaining("right-angle through-hole"),
      releaseState: "deny"
    })
    expect(header.footprint?.holes).toHaveLength(4)
    expect(housing.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "product-drawing", url: expect.stringContaining("430252400") })
      ])
    )
    expect(header.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "product-drawing", url: expect.stringContaining("430450201") })
      ])
    )
    expect(terminal.package).toContain("20-24 AWG")
    expect(terminal.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          revision: expect.stringContaining("revision N10"),
          url: expect.stringContaining("430300007")
        })
      ])
    )
    expect(header.missingReleaseEvidence.join(" ")).toContain("annular ring")
  })

  it("models the configured HSEC8 A and L2 mechanics without guessing USB contact assignment", () => {
    const socket = findCarrierConnectorEvidence("HSEC8-113-01-L-DV-A-L2")
    const cable = findCarrierConnectorEvidence("ECDP-08-07.87-L1-L2-1-3")
    if (socket === undefined || cable === undefined) throw new Error("Samtec carrier connector evidence is incomplete")

    expect(socket).toMatchObject({
      exactMates: ["ECDP-08-07.87-L1-L2-1-3"],
      footprint: {
        boardThicknessMm: 1.57,
        boardThicknessToleranceMm: 0.15,
        copper: {
          contactCount: 26,
          contactLandMm: { heightMm: 1.2, widthMm: 0.8 },
          pitchMm: 0.8,
          rowCount: 2
        },
        holes: expect.arrayContaining([
          expect.objectContaining({ diameterMm: 1.27, id: "ALIGN_L", kind: "non-plated-hole" }),
          expect.objectContaining({ diameterMm: 0.84, id: "LATCH_L", kind: "plated-hole" })
        ]),
        paste: { sourceStatus: "manufacturer-specified", stencilThicknessMm: 0.15 }
      },
      releaseState: "deny"
    })
    expect(socket.footprint?.holes).toHaveLength(4)
    expect(socket.missingReleaseEvidence.join(" ")).toContain("no USB_DN, USB_DP, or CHASSIS contact assignment")
    expect(cable.package).toContain("7.87 inch")
    expect(cable.harness).toMatchObject({
      cableLengthIn: 7.87,
      cableLengthMm: 199.898,
      cableOption: "100-ohm-eyespeed",
      overallLengthReferenceMm: 217.428,
      pairCount: 8,
      wiringOption: "pin-1-to-pin-1"
    })
    expect(cable.missingReleaseEvidence.join(" ")).toContain("100 ohm EyeSpeed")
    expect(cable.primarySources).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "mechanical-series-print" })])
    )
    const acquiredArtifacts = [...socket.primarySources, ...cable.primarySources]
      .filter((source) => source.access === "manufacturer-acquired-hash-bound")
      .map((source) => source.acquiredArtifact)
    expect(acquiredArtifacts).toEqual([
      {
        acquiredDate: "2026-08-24",
        evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-hsec8-mkt-rev-bz.pdf",
        sha256: "7C94D52B1F5F1687411125862913A902620A3FF5D12B0992F1C657C664E08896"
      },
      {
        acquiredDate: "2026-08-24",
        evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-hsec8-footprint-rev-ah.pdf",
        sha256: "444530543B34CF92F87AE037FB52C55F0583EB257ACB0BC0B7558853190DB383"
      },
      {
        acquiredDate: "2026-08-24",
        evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-ecdp-mkt-rev-x.pdf",
        sha256: "7808FF959CF6C2AE84B252620FE8D1B69808FE8766A232B4AFA78EE7B361B1C4"
      }
    ])
  })

  it("fails closed on duplicate, missing, malformed, and unqualified evidence", () => {
    const header = findCarrierConnectorEvidence("43045-0400")
    if (header === undefined) throw new Error("Molex header evidence is missing")

    expect(validateCarrierConnectorEvidence([...carrierConnectorFootprintEvidence, header])).toContain(
      "43045-0400: duplicate MPN"
    )
    expect(
      validateCarrierConnectorEvidence([
        {
          ...header,
          package: "",
          exactMates: [],
          missingReleaseEvidence: [""],
          primarySources: [{ ...header.primarySources[0], revision: "", url: "http://invalid.example" }]
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        "43045-0400: package description is required",
        "43045-0400: exact mate assignment is required",
        "43045-0400: release blockers must be nonblank",
        "43045-0400: source URL must use HTTPS",
        "43045-0400: source revision is required"
      ])
    )
    expect(
      validateCarrierConnectorEvidence([
        {
          ...header,
          footprint: {
            ...header.footprint!,
            holes: [...header.footprint!.holes, { ...header.footprint!.holes[0], id: "1" }]
          }
        }
      ])
    ).toContain("43045-0400: duplicate hole 1")
    const socket = findCarrierConnectorEvidence("HSEC8-113-01-L-DV-A-L2")
    if (socket === undefined) throw new Error("Samtec socket evidence is missing")
    expect(
      validateCarrierConnectorEvidence([
        {
          ...socket,
          primarySources: socket.primarySources.map((source) =>
            source.access === "manufacturer-acquired-hash-bound"
              ? { ...source, acquiredArtifact: { ...source.acquiredArtifact!, sha256: "not-a-hash" } }
              : source
          )
        }
      ])
    ).toContain("HSEC8-113-01-L-DV-A-L2: hash-bound manufacturer source requires the M4-11 artifact path and SHA-256")
  })

  it("rejects malformed harness, mate, and canonical hole evidence", () => {
    const header = findCarrierConnectorEvidence("43045-0400")
    const socket = findCarrierConnectorEvidence("HSEC8-113-01-L-DV-A-L2")
    const cable = findCarrierConnectorEvidence("ECDP-08-07.87-L1-L2-1-3")
    if (
      header === undefined ||
      header.footprint === undefined ||
      socket === undefined ||
      cable === undefined ||
      cable.harness === undefined ||
      socket.footprint === undefined
    ) {
      throw new Error("Samtec evidence fixtures are incomplete")
    }

    const malformedCable = {
      ...cable,
      harness: {
        ...cable.harness,
        cableLengthMm: Number.NaN,
        pairCount: 8.5,
        wiringOption: "pin-1-to-pin-2" as never
      }
    }
    expect(validateCarrierConnectorEvidence([malformedCable])).toEqual(
      expect.arrayContaining([
        "ECDP-08-07.87-L1-L2-1-3: cable length millimetres must be finite and positive",
        "ECDP-08-07.87-L1-L2-1-3: pair count must be a positive integer",
        "ECDP-08-07.87-L1-L2-1-3: harness fields do not match the selected -08-07.87-L1-L2-1-3 configuration"
      ])
    )
    expect(validateCarrierConnectorEvidence([{ ...cable, harness: null as never }])).toContain(
      "ECDP-08-07.87-L1-L2-1-3: harness data must be an object"
    )

    expect(
      validateCarrierConnectorEvidence([
        {
          ...header,
          footprint: {
            ...header.footprint,
            holes: header.footprint.holes.map((hole, index) =>
              index === 0 ? { ...hole, diameterMm: 1.2, role: "alignment" as const } : hole
            )
          }
        }
      ])
    ).toContain("43045-0400: hole 1 must preserve the canonical 1.02 mm contact pattern")
    expect(
      validateCarrierConnectorEvidence([
        {
          ...header,
          footprint: {
            ...header.footprint,
            copper: { ...header.footprint.copper, contactCount: 5, pitchMm: 2.54, rowCount: 1 }
          }
        }
      ])
    ).toContain("43045-0400: canonical four-contact two-row 3.00 mm geometry changed")

    const holes = socket.footprint.holes.map((hole, index) =>
      index === 0 ? { ...hole, kind: "plated-hole" as const, role: "latch" as const, xMm: 0 } : hole
    )
    expect(
      validateCarrierConnectorEvidence([
        {
          ...socket,
          footprint: { ...socket.footprint, holes }
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        "HSEC8-113-01-L-DV-A-L2: hole ALIGN_L must provide both coordinates or neither",
        "HSEC8-113-01-L-DV-A-L2: two 1.27 mm alignment NPTHs and two 0.84 mm latch PTHs are required"
      ])
    )
    expect(
      validateCarrierConnectorEvidence([
        {
          ...socket,
          footprint: {
            ...socket.footprint,
            paste: { ...socket.footprint.paste, stencilThicknessMm: 0.12 }
          }
        }
      ])
    ).toContain("HSEC8-113-01-L-DV-A-L2: canonical -113-01 contact, card, or stencil geometry changed")
  })

  it("requires reciprocal canonical mates and never releases a DENY record", () => {
    const header = findCarrierConnectorEvidence("43045-0400")
    const housing = findCarrierConnectorEvidence("43025-0400")
    if (header === undefined || housing === undefined) throw new Error("Molex evidence fixtures are incomplete")

    expect(validateCarrierConnectorEvidence([header])).toContain(
      "43045-0400: exact mate 43025-0400 is missing from the evidence set"
    )
    expect(validateCarrierConnectorEvidence([header, { ...housing, exactMates: ["43030-0007"] }])).toContain(
      "43045-0400: exact mate 43025-0400 is not reciprocal"
    )

    const forgedAllTrue = {
      ...header,
      independentVerification: {
        assemblyProcessQualified: true,
        cadOverlayComplete: true,
        contactAssignmentVerified: true,
        enclosureKeepoutVerified: true,
        fabricationPreviewChecked: true,
        physicalMateTested: true
      }
    }
    expect(canReleaseCarrierConnector(forgedAllTrue)).toBe(false)
  })
})
