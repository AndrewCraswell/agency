import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { acquisitionUnitSchema, digest } from "./contracts.js"
import { parseRegulatoryArtifact, validateRegulatoryOutput } from "./parser-bridge.js"
import { regulatoryRecordSchema } from "./parser-contract.js"

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url))
const provenance = z
  .array(z.object({ fixture: z.string(), fixtureHash: z.string(), sourceUnit: acquisitionUnitSchema }))
  .parse(JSON.parse(await readFile(join(fixtures, "provenance.json"), "utf8")))
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function temporary() {
  const path = await mkdtemp(join(tmpdir(), "tabra-regulatory-parser-"))
  directories.push(path)
  return path
}

async function fixtureInput(name: string) {
  const item = provenance.find((entry) => entry.fixture === name)
  if (item === undefined) {
    throw new Error("Missing source fixture")
  }
  return {
    unit: item.sourceUnit,
    artifactHash: item.fixtureHash,
    path: join(fixtures, item.fixture),
    outputRoot: await temporary()
  }
}

async function records(directory: string) {
  const result = []
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".ndjson")).sort()) {
    for (const line of (await readFile(join(directory, name), "utf8")).trimEnd().split("\n")) {
      result.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    }
  }
  return result
}

const simpleXml =
  '<ECFR><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD><DIV8 N="1.1" TYPE="SECTION"><HEAD>§ 1.1 Dose</HEAD><P>Use <I>10</I> mg daily.</P><FTNT><P>Footnote evidence.</P></FTNT></DIV8></DIV1></ECFR>'
async function syntheticInput(xml: string) {
  const input = await fixtureInput("ecfr-title-1-excerpt.xml")
  const path = join(await temporary(), "input.xml")
  await writeFile(path, xml)
  return { ...input, path, artifactHash: digest(xml) }
}

describe("federal streaming parser and bridge", () => {
  it("retains quoted future revisions inside annual provisions without creating duplicate current sections", async () => {
    const input = await fixtureInput("cfr-2024-title1-excerpt.xml")
    const xml = `<CFRDOC><TITLE><SECTION><SECTNO>§ 1.1</SECTNO><P>Current wording.</P>
      <EFFDNOTP><P>Effective next month.</P><REVTXT><SUBPART><SECTION><SECTNO>§ 1.1</SECTNO>
      <P>Future wording.</P></SECTION></SUBPART></REVTXT></EFFDNOTP></SECTION></TITLE></CFRDOC>`
    const path = join(await temporary(), "quoted-revision.xml")
    await writeFile(path, xml)
    const result = await parseRegulatoryArtifact({ ...input, path, artifactHash: digest(xml) })
    const parsed = await records(result.directory)
    expect(result.summary.records).toBe(2)
    const section = parsed.find((row) => row.nodeKind === "section")
    expect(section?.nativeId).toBe("cfr:1:section:1.1")
    expect(section?.text).toContain("Current wording.")
    expect(section?.text).toContain("Future wording.")
    expect(section?.blocks.find((row) => row.tag === "EFFDNOTP")?.xml).toContain("<REVTXT>")
    expect(parsed.filter((row) => row.nodeKind === "section")).toHaveLength(1)
    const ambiguous = xml.replace("<SUBPART>", "<CHAPTER><SUBPART>").replace("</SUBPART>", "</SUBPART></CHAPTER>")
    await writeFile(path, ambiguous)
    const flagged = await parseRegulatoryArtifact({ ...input, path, artifactHash: digest(ambiguous) })
    expect(flagged.summary.warnings).toEqual([expect.objectContaining({ code: "quoted_revision_scope_review" })])
  })
  it("recognizes historical FRDOC formatting without guessing missing identities", { timeout: 30_000 }, async () => {
    const input = await fixtureInput("fr-2024-01-02-excerpt.xml")
    const xml =
      "<FEDREG><NOTICE><FRDOC>[FR DOC. 00-1108 Filed1-14-00;8:45am]</FRDOC></NOTICE><NOTICE><FRDOC>FR Doc. 00-1098 Filed 1-14-00; 8:45am]</FRDOC></NOTICE></FEDREG>"
    const path = join(await temporary(), "historical.xml")
    await writeFile(path, xml)
    const result = await parseRegulatoryArtifact({ ...input, path, artifactHash: digest(xml) })
    expect((await records(result.directory)).map((row) => row.nativeId)).toEqual(["00-1108", "00-1098"])
    for (const fragment of [
      "<FRDOC>See FR Doc. 00-1108 Filed 1-14-00</FRDOC>",
      "<FRDOC>FR Doc. 00-1108 FiledWrong</FRDOC>",
      "<FRDOC>FR Doc. 00-1108 Filed 1-14-00</FRDOC><FRDOC>FR Doc. 00-1098 Filed 1-14-00</FRDOC>"
    ]) {
      const invalid = `<FEDREG><NOTICE>${fragment}</NOTICE></FEDREG>`
      await writeFile(path, invalid)
      await expect(parseRegulatoryArtifact({ ...input, path, artifactHash: digest(invalid) })).rejects.toThrow(
        "missing_document_number"
      )
    }
  })
  // Two real subprocess parses and shard validation need headroom under full coverage load.
  it(
    "splits at record boundaries and produces identical shards on independent parses",
    { timeout: 30_000 },
    async () => {
      const sections = Array.from(
        { length: 5001 },
        (_, i) => `<DIV8 N="1.${i}" TYPE="SECTION"><P>Section ${i}</P></DIV8>`
      ).join("")
      const input = await syntheticInput(`<ECFR><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD>${sections}</DIV1></ECFR>`)
      const first = await parseRegulatoryArtifact(input)
      const second = await parseRegulatoryArtifact({ ...input, outputRoot: await temporary() })
      expect(first.summary.records).toBe(5002)
      expect(first.summary.shards.map((shard) => shard.records)).toEqual([5000, 2])
      expect(second.summary.shards).toEqual(first.summary.shards)
      expect(second.reused).toBe(false)
    }
  )
  it("preserves explicitly empty eCFR subject groups without inventing section identities", async () => {
    const xml = simpleXml.replace("</DIV1>", '<DIV7 N="" TYPE="SUBJGRP" EMPTY="true" /></DIV1>')
    const result = await parseRegulatoryArtifact(await syntheticInput(xml))
    const rows = await records(result.directory)
    const empty = rows.find((row) => row.nodeKind === "subjgrp")
    expect(empty).toMatchObject({
      identityBasis: "source_locator",
      text: "",
      sourceAttributes: { N: "", TYPE: "SUBJGRP", EMPTY: "true" }
    })
    expect(rows.find((row) => row.nodeKind === "section")?.nativeId).toBe("cfr:1:section:1.1")
  })
  it("preserves real eCFR text, tables, hierarchy and source references", async () => {
    const input = await fixtureInput("ecfr-title-1-excerpt.xml")
    const result = await parseRegulatoryArtifact(input)
    const rows = await records(result.directory)
    const section = rows.find((row) => row.nativeId === "cfr:1:section:1.1")
    expect(section?.text).toContain("Administrative Committee")
    expect(section?.heading).toContain("Definitions")
    expect(rows.some((row) => row.blocks.some((block) => block.kind === "table" && block.xml.includes("Monday")))).toBe(
      true
    )
    expect(rows.filter((row) => row.parentKey === null)).toHaveLength(1)
    expect(result.summary.records).toBe(rows.length)
    expect(result.summary.sourceRecords).toBe(rows.length)
    expect(result.summary.warnings).toEqual([])
    expect(
      rows.every((row) => row.provenance.artifactHash === input.artifactHash && row.legalStatus === "unknown")
    ).toBe(true)
    const again = await parseRegulatoryArtifact(input)
    expect(again).toMatchObject({ generation: result.generation, reused: true })
  })

  it("keeps rules, proposals and correction notices separate with their document numbers", async () => {
    const result = await parseRegulatoryArtifact(await fixtureInput("fr-2024-01-02-excerpt.xml"))
    const rows = await records(result.directory)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.publicationKind).sort()).toEqual(["final_rule", "notice", "proposed_rule"])
    const correction = rows.find((row) => row.nativeId === "C1-2023-27742")
    expect(correction?.text).toContain("February 1, 2024")
    expect(correction?.text).toContain("2023-27742")
    expect(correction?.blocks.some((block) => block.xml.includes('P="43"'))).toBe(true)
    expect(rows.every((row) => row.identityBasis === "document_number")).toBe(true)
  })

  it("flags the source's annual edition date mismatch instead of inventing a 2024 issue date", async () => {
    const result = await parseRegulatoryArtifact(await fixtureInput("cfr-2024-title1-excerpt.xml"))
    expect(result.summary.sourceDates).toContainEqual(
      expect.objectContaining({ kind: "printed_revision", value: "2023-01-01" })
    )
    expect(result.summary.warnings).toContainEqual(expect.objectContaining({ code: "source_date_mismatch" }))
    expect(result.summary.publicationReady).toBe(false)
    const rows = await records(result.directory)
    expect(rows.some((row) => row.nativeId === "cfr:1:section:1.1")).toBe(true)
    expect(rows.every((row) => row.provenance.publisherIssueDate === null)).toBe(true)
  })

  it("retains inline text spacing and footnotes without copying child bodies into the title", async () => {
    const result = await parseRegulatoryArtifact(await syntheticInput(simpleXml))
    const rows = await records(result.directory)
    const section = rows.find((row) => row.nodeKind === "section")
    expect(section?.text).toContain("Use 10 mg daily.")
    expect(section?.blocks.some((block) => block.kind === "footnote" && block.text.includes("Footnote evidence"))).toBe(
      true
    )
    expect(rows.find((row) => row.nodeKind === "title")?.text).toBe("Title 1")
  })

  it.each([
    ["truncated", simpleXml.slice(0, -10)],
    ["DTD", '<!DOCTYPE ECFR [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' + simpleXml.replace("10", "&secret;")],
    ["entity expansion", '<!DOCTYPE ECFR [<!ENTITY a "expanded">]>' + simpleXml],
    ["deep nesting", "<ECFR>" + "<P>".repeat(70) + "</P>".repeat(70) + "</ECFR>"],
    ["wrong title", simpleXml.replace('N="1"', 'N="2"')],
    ["missing identity", simpleXml.replace('N="1.1"', "")],
    [
      "duplicate sections",
      simpleXml.replace("</DIV1>", '<DIV8 N="1.1" TYPE="SECTION"><HEAD>Duplicate</HEAD></DIV8></DIV1>')
    ]
  ])("rejects %s input without publishing a partial generation", async (_name, xml) => {
    const input = await syntheticInput(xml)
    await expect(parseRegulatoryArtifact(input)).rejects.toThrow("parser failed")
    expect(await readdir(input.outputRoot)).toEqual([])
  })

  it("kills a timed-out parser and cleans its staging and lock", async () => {
    const input = await syntheticInput(simpleXml)
    await expect(parseRegulatoryArtifact({ ...input, timeoutMs: 1 })).rejects.toThrow("timed out")
    expect(await readdir(input.outputRoot)).toEqual([])
  })

  it("rejects a corrupt input and altered normalized shard on reuse", async () => {
    const input = await syntheticInput(simpleXml)
    await expect(parseRegulatoryArtifact({ ...input, artifactHash: "0".repeat(64) })).rejects.toThrow("checksum")
    const result = await parseRegulatoryArtifact(input)
    const shard = result.summary.shards[0]
    if (shard === undefined) {
      throw new Error("Missing shard")
    }
    const path = join(result.directory, shard.file)
    const body = await readFile(path, "utf8")
    await writeFile(path, body.replace("daily", "night"))
    await expect(parseRegulatoryArtifact(input)).rejects.toThrow("checksum mismatch")
  }, 30_000)

  it("rejects parent, provenance, and count mismatches even when shard hashes are recomputed", async () => {
    const input = await syntheticInput(simpleXml)
    const result = await parseRegulatoryArtifact(input)
    const rows = await records(result.directory)
    const section = rows.find((row) => row.nodeKind === "section")
    const shard = result.summary.shards[0]
    if (section === undefined || shard === undefined) {
      throw new Error("Missing parser output")
    }
    section.parentKey = "0".repeat(64)
    const body = rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
    await writeFile(join(result.directory, shard.file), body)
    shard.sha256 = digest(body)
    shard.bytes = Buffer.byteLength(body)
    await writeFile(join(result.directory, "summary.json"), JSON.stringify(result.summary))
    await expect(
      validateRegulatoryOutput(result.directory, input.unit, input.artifactHash, result.summary.parserCodeHash)
    ).rejects.toThrow("parent missing")
  })
})
