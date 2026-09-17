import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { legalTableLayout, legalTableRows } from "./table-passages.js"

const retainedSchema = z.object({
  fixtures: z.array(
    z.object({
      nativeId: z.string(),
      tableIndex: z.int().nonnegative(),
      blockHash: z.string(),
      text: z.string(),
      xml: z.string()
    })
  )
})

async function retained(nativeId: string, tableIndex?: number) {
  const source = retainedSchema.parse(
    JSON.parse(await readFile(new URL("./fixtures/current-ditto-source-tables.json", import.meta.url), "utf8"))
  )
  const fixture = source.fixtures.find(
    (item) => item.nativeId === nativeId && (tableIndex === undefined || item.tableIndex === tableIndex)
  )
  expect(fixture).toBeDefined()
  return fixture!
}

describe("source-reviewed current table continuations", () => {
  it.each([
    ["cfr:40:section:52.730", 0],
    ["cfr:40:section:52.876", 0],
    ["cfr:40:section:81.331", 2],
    ['ecfr:[["TITLE","49"],["SUBTITLE","B"],["CHAPTER","II"],["PART","210"],["APPENDIX","Appendix A to Part 210"]]', 0],
    ["cfr:21:section:73.1", 1],
    ["cfr:21:section:73.1", 2],
    ["cfr:21:section:155.200", 0],
    ["cfr:21:section:177.2800", 0],
    ["cfr:47:section:73.182", 1]
  ] as const)("classifies every retained row in %s table %i", async (nativeId, tableIndex) => {
    const fixture = await retained(nativeId, tableIndex)
    const layouts = legalTableLayout(fixture)
    expect(layouts.length).toBe(1)
    expect(layouts.map(legalTableRows).reduce((count, layout) => count + layout.rows.length, 0)).toBeGreaterThan(0)
  })

  it("rejects a changed Illinois continuation identity", async () => {
    const fixture = await retained("cfr:40:section:52.730")
    expect(() =>
      legalTableLayout({
        ...fixture,
        text: fixture.text.replace("(b) 11BIA crude heater", "(b) changed heater"),
        xml: fixture.xml.replace("(b) 11BIA crude heater", "(b) changed heater")
      }).map(legalTableRows)
    ).toThrow("passage_table_unresolved_ditto")
  })

  it("rejects a changed Kansas facility group", async () => {
    const fixture = await retained("cfr:40:section:52.876")
    expect(() =>
      legalTableLayout({
        ...fixture,
        text: fixture.text.replace("U.S. Steel—Universal Atlas Cement", "Changed facility"),
        xml: fixture.xml.replace("U.S. Steel—Universal Atlas Cement", "Changed facility")
      }).map(legalTableRows)
    ).toThrow("passage_table_unresolved_ditto")
  })

  it("rejects an unknown EPA designated-area header", async () => {
    const fixture = await retained("cfr:40:section:81.331")
    expect(() =>
      legalTableLayout({
        ...fixture,
        text: fixture.text.replace("Designated Area", "Unknown Area"),
        xml: fixture.xml.replace("Designated Area", "Unknown Area")
      }).map(legalTableRows)
    ).toThrow("passage_table_unresolved_ditto")
  })

  it("rejects a changed FDA sparse-row identity", async () => {
    const fixture = await retained("cfr:21:section:73.1", 1)
    expect(() =>
      legalTableLayout({
        ...fixture,
        text: fixture.text.replace("Ethyl cellulose", "Changed cellulose"),
        xml: fixture.xml.replace("Ethyl cellulose", "Changed cellulose")
      }).map(legalTableRows)
    ).toThrow("passage_table_unresolved_ditto")
  })

  it("rejects a changed railroad category", async () => {
    const fixture = await retained(
      'ecfr:[["TITLE","49"],["SUBTITLE","B"],["CHAPTER","II"],["PART","210"],["APPENDIX","Appendix A to Part 210"]]',
      0
    )
    expect(() =>
      legalTableLayout({
        ...fixture,
        text: fixture.text.replace(
          "All Locomotives Manufactured After 31 December 1979",
          "Changed locomotive category"
        ),
        xml: fixture.xml.replace("All Locomotives Manufactured After 31 December 1979", "Changed locomotive category")
      }).map(legalTableRows)
    ).toThrow("passage_table_unresolved_ditto")
  })
})
