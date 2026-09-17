import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it } from "vitest"
import { freezeLegalPassageManifests } from "./passage-manifest.js"
import { legalPassageShapeContract } from "./passage-shapes.js"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))))
const hash = (value: string) => createHash("sha256").update(value).digest("hex")

async function fixture(overrides?: { status?: "prepared" | "blocked" }) {
  const root = await mkdtemp(join(tmpdir(), "tabra-passage-manifest-"))
  roots.push(root)
  const qualification = join(root, "qualification")
  const output = join(root, "manifests")
  const key = "a".repeat(64)
  const edition = {
    id: randomUUID(),
    source_id: "ecfr",
    generation_id: "b".repeat(64),
    rights_profile_id: "official-federal-text",
    native_key: "2026-09-17",
    currency_date: "2026-09-17"
  }
  const model = "openai/text-embedding-3-small"
  const tokenizerId = "tiktoken:pinned"
  const prepared = {
    model,
    tokenizerId,
    contextHash: "c".repeat(64),
    ...(overrides?.status === "blocked"
      ? { status: "blocked" as const, reason: "invalid_source_blocks" }
      : {
          status: "prepared" as const,
          eligibility: "eligible" as const,
          generation: "d".repeat(64),
          manifestHash: "e".repeat(64),
          passages: 2,
          tokens: 20,
          maximumTokens: 12,
          maximumInputCharacters: 60,
          continuations: 0
        })
  }
  const records = `${JSON.stringify({
    ordinal: 0,
    versionId: randomUUID(),
    contentHash: "f".repeat(64),
    nativeId: "ecfr:title:1",
    sourceLocator: "/ECFR[1]",
    preparation: [prepared]
  })}\n`
  await mkdir(join(qualification, key), { recursive: true })
  const recordsPath = join(qualification, key, "records.ndjson")
  await writeFile(recordsPath, records)
  const inventoryPath = join(qualification, "inventory.json")
  const implementationHash = "1".repeat(64)
  await writeFile(
    inventoryPath,
    JSON.stringify({
      contract: legalPassageShapeContract,
      implementationHash,
      preparation: [{ model, tokenizerId }],
      selected: [edition],
      results: [
        {
          key,
          edition,
          inventoryHash: "2".repeat(64),
          rightsHash: "3".repeat(64),
          dataHash: hash(records),
          counters: { records: 1 }
        }
      ],
      complete: true
    })
  )
  return { inventoryPath, output, implementationHash, model, edition, recordsPath }
}

it("freezes a replay-stable per-edition input manifest", async () => {
  const value = await fixture()
  const first = await freezeLegalPassageManifests({
    inventoryPath: value.inventoryPath,
    outputDirectory: value.output,
    implementationHash: value.implementationHash,
    model: value.model
  })
  const replay = await freezeLegalPassageManifests({
    inventoryPath: value.inventoryPath,
    outputDirectory: value.output,
    implementationHash: value.implementationHash,
    model: value.model
  })
  expect(replay).toEqual(first)
  expect(first.totals).toEqual({ partitions: 1, versions: 1, passages: 2 })
  const manifest = JSON.parse(await readFile(join(value.output, first.partitions[0]!.manifest), "utf8"))
  expect(manifest).toMatchObject({
    contracts: { sourceInput: "regulatory-xml-2026-09-14" },
    owner: { id: value.edition.id, sourceGenerationId: value.edition.generation_id },
    preparation: { model: value.model, tokenizerId: "tiktoken:pinned" },
    entries: { versions: 1, passages: 2 }
  })
  const entry = JSON.parse((await readFile(join(value.output, manifest.entries.file), "utf8")).trim())
  expect(entry).toMatchObject({ contextHash: "c".repeat(64), inputManifestHash: "e".repeat(64) })
})

it("rejects qualification records changed after terminal completion", async () => {
  const value = await fixture()
  const record = JSON.parse((await readFile(value.recordsPath, "utf8")).trim())
  await writeFile(value.recordsPath, `${JSON.stringify({ ...record, contentHash: "0".repeat(64) })}\n`)
  await expect(
    freezeLegalPassageManifests({
      inventoryPath: value.inventoryPath,
      outputDirectory: value.output,
      implementationHash: value.implementationHash,
      model: value.model
    })
  ).rejects.toThrow("legal_passage_manifest_qualification_data_mismatch")
})

it("refuses to freeze a blocked member", async () => {
  const value = await fixture({ status: "blocked" })
  await expect(
    freezeLegalPassageManifests({
      inventoryPath: value.inventoryPath,
      outputDirectory: value.output,
      implementationHash: value.implementationHash,
      model: value.model
    })
  ).rejects.toThrow("legal_passage_manifest_blocked_input")
})
