import { zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import {
  californiaPubinfoDocumentKey,
  californiaPubinfoLobIndex,
  readCaliforniaPubinfoTables,
  visitCaliforniaPubinfoLobs
} from "./california-pubinfo.js"

async function* archiveChunks(bytes: Uint8Array) {
  for (let offset = 0; offset < bytes.byteLength; offset += 17) {
    yield bytes.subarray(offset, offset + 17)
  }
}

async function* oneArchiveChunk(bytes: Uint8Array) {
  yield bytes
}

describe("California PUBINFO document mapping", () => {
  it("maps only exact official document URL contracts", () => {
    expect(
      californiaPubinfoDocumentKey(
        "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=198919900SB1744&version=19890SB174495CHP"
      )
    ).toBe("version:19890SB174495CHP")
    expect(
      californiaPubinfoDocumentKey(
        "http://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB1300"
      )
    ).toBe("bill:202320240AB1300")
    expect(
      californiaPubinfoDocumentKey(
        "https://leginfo.legislature.ca.gov/faces/billAnalysisClient.xhtml?bill_id=202520260SB1013&analysisId=404425&analyzingOffice=Assembly"
      )
    ).toBe("analysis:404425")

    expect(californiaPubinfoDocumentKey("https://example.gov/faces/billPdf.xhtml?bill_id=1&version=1")).toBeUndefined()
    expect(
      californiaPubinfoDocumentKey(
        "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB1300&unexpected=1"
      )
    ).toBeUndefined()
    expect(
      californiaPubinfoDocumentKey(
        "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=198919900SB1744&version=../../secret"
      )
    ).toBeUndefined()
  })

  it("joins official PUBINFO table rows to their LOB files", () => {
    const versionTable = [
      "`19890SB174495CHP`\t`198919900SB1744`\t95\t1989-07-31 00:00:00\t`Chaptered`\tNULL\t`Title`\tNULL\tNULL\tNULL\tNULL\tNULL\tNULL\tNULL\tBILL_VERSION_TBL_42.lob\t`Y`",
      "`20250SB101399INT`\t`202520260SB1013`\t99\t2025-02-01 00:00:00\t`Introduced`\tNULL\t`Title`\tNULL\tNULL\tNULL\tNULL\tNULL\tNULL\tNULL\tBILL_VERSION_TBL_43.lob\t`Y`"
    ].join("\n")
    const billTable =
      "`202520260SB1013`\t`20252026`\t`0`\t`SB`\t1013\t`Active`\t`2025`\t`INT`\t`0`\t`1`\t`20250SB101399INT`\t`Y`"
    const analysisTable =
      "404425\t`202520260SB1013`\t`A`\t`STR`\t`CZ01`\t`ASSEMBLY FLOOR ANALYSIS`\t`CERVANTES`\t2026-08-18 00:00:00\t2026-08-17 00:00:00\tNULL\tBILL_ANALYSIS_TBL_12.lob\t`Y`"

    const index = californiaPubinfoLobIndex({ analysisTable, billTable, versionTable })

    expect(index.get("version:19890SB174495CHP")).toBe("BILL_VERSION_TBL_42.lob")
    expect(index.get("bill:202520260SB1013")).toBe("BILL_VERSION_TBL_43.lob")
    expect(index.get("analysis:404425")).toBe("BILL_ANALYSIS_TBL_12.lob")
  })

  it("streams only required tables and selected LOBs from the archive", async () => {
    const encoder = new TextEncoder()
    const archive = zipSync({
      "BILL_ANALYSIS_TBL.dat": encoder.encode("analysis"),
      "BILL_ANALYSIS_TBL_12.lob": encoder.encode("analysis body"),
      "BILL_TBL.dat": encoder.encode("bill"),
      "BILL_VERSION_TBL.dat": encoder.encode("version"),
      "BILL_VERSION_TBL_42.lob": encoder.encode("version body"),
      "ignored.bin": new Uint8Array(100_000)
    })

    await expect(readCaliforniaPubinfoTables(archiveChunks(archive))).resolves.toEqual({
      analysisTable: "analysis",
      billTable: "bill",
      versionTable: "version"
    })
    const bodies = new Map<string, string>()
    const visited = await visitCaliforniaPubinfoLobs(
      archiveChunks(archive),
      new Set(["BILL_ANALYSIS_TBL_12.lob", "BILL_VERSION_TBL_42.lob"]),
      async (filename, bytes) => {
        bodies.set(filename, new TextDecoder().decode(bytes))
      },
      2
    )

    expect(visited).toEqual(new Set(["BILL_ANALYSIS_TBL_12.lob", "BILL_VERSION_TBL_42.lob"]))
    expect(bodies).toEqual(
      new Map([
        ["BILL_ANALYSIS_TBL_12.lob", "analysis body"],
        ["BILL_VERSION_TBL_42.lob", "version body"]
      ])
    )
  })

  it("enforces visit concurrency when one archive chunk completes many LOBs", async () => {
    const encoder = new TextEncoder()
    const entries = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`BILL_VERSION_TBL_${index}.lob`, encoder.encode(`body ${index}`)])
    )
    const archive = zipSync(entries)
    let active = 0
    let maximumActive = 0

    const visited = await visitCaliforniaPubinfoLobs(
      oneArchiveChunk(archive),
      new Set(Object.keys(entries)),
      async () => {
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
      },
      3
    )

    expect(visited.size).toBe(20)
    expect(maximumActive).toBe(3)
  })
})
