import { readFile } from "node:fs/promises"
import invariant from "tiny-invariant"
import { expect, it } from "vitest"
import { z } from "zod"
import { digest } from "./contracts.js"
import { prepareCommonRegulatoryPassages } from "./embedding-common-passages.js"

it("prepares identical lossless county-table inputs with both real tokenizers", async () => {
  const retained = z
    .object({
      fixtures: z.array(
        z.object({
          versionId: z.string(),
          nativeId: z.string(),
          blockXmlHash: z.string(),
          block: z.object({ text: z.string(), xml: z.string() })
        })
      )
    })
    .parse(JSON.parse(await readFile(new URL("./fixtures/ditto-continuation-tables.json", import.meta.url), "utf8")))
  const fixture = retained.fixtures.find((row) => row.nativeId === "cfr:40:section:81.324")
  invariant(fixture, "common_county_fixture_required")
  expect(digest(fixture.block.xml)).toBe(fixture.blockXmlHash)
  const input = {
    versionId: fixture.versionId,
    body: fixture.block.text,
    inputContract: "xml",
    context: "Federal code",
    blocks: [{ ordinal: 0, kind: "table", tag: "DIV", ...fixture.block }]
  }
  const result = await prepareCommonRegulatoryPassages(input)
  expect(result.passages.map((p) => p.text).join("")).toBe(input.body)
  expect(result.records).toEqual(result.passages.map((p) => ({ id: p.id, versionId: p.versionId, input: p.inputText })))
  expect(result.passages.every((p) => p.modelCounts.length === 2 && p.modelCounts.every((c) => c.tokens <= 1200))).toBe(
    true
  )
  expect(result.modelSelected).toBe(false)
  expect(await prepareCommonRegulatoryPassages(input)).toEqual(result)
}, 30_000)

it("rejects a whole version that cannot qualify instead of silently selecting its usable text", async () => {
  await expect(
    prepareCommonRegulatoryPassages({
      versionId: "bad",
      body: "Different source",
      blocks: [{ ordinal: 0, kind: "text", tag: "P", text: "Missing text", xml: "<P>Missing text</P>" }],
      inputContract: "xml",
      context: "Federal"
    })
  ).rejects.toThrow("regulatory_common_whole_version_ineligible")
})
