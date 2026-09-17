import { createHash, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { createInterface } from "node:readline"
import { finished } from "node:stream/promises"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { legalReaderContract } from "@repo/legislation-core/legal-text/reader-text"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalPassageShapeContract } from "./passage-shapes.js"
import { legalPassageContract } from "./passages.js"

export const legalPassageManifestContract = "legal-passage-manifest-2026-09-17"
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const editionSchema = z.strictObject({
  id: z.uuid(),
  source_id: z.enum(["ecfr", "govinfo-cfr"]),
  generation_id: hashSchema,
  rights_profile_id: z.string().min(1),
  native_key: z.string().min(1),
  currency_date: z.string().nullable()
})
const preparationIdentitySchema = z.strictObject({ model: z.string().min(1), tokenizerId: z.string().min(1) })
const resultSchema = z.object({
  key: hashSchema,
  edition: editionSchema,
  inventoryHash: hashSchema,
  rightsHash: hashSchema,
  dataHash: hashSchema,
  counters: z.object({ records: z.int().positive() })
})
const inventorySchema = z.strictObject({
  contract: z.literal(legalPassageShapeContract),
  implementationHash: hashSchema,
  preparation: z.array(preparationIdentitySchema).min(1),
  selected: z.array(editionSchema).min(1),
  results: z.array(resultSchema).min(1),
  complete: z.literal(true)
})
const preparedSchema = z.strictObject({
  model: z.string().min(1),
  tokenizerId: z.string().min(1),
  contextHash: hashSchema,
  status: z.literal("prepared"),
  eligibility: z.enum(["eligible", "empty_text"]),
  generation: hashSchema,
  manifestHash: hashSchema,
  passages: z.int().nonnegative(),
  tokens: z.int().nonnegative(),
  maximumTokens: z.int().nonnegative(),
  maximumInputCharacters: z.int().nonnegative(),
  continuations: z.int().nonnegative()
})
const blockedSchema = z.strictObject({
  model: z.string().min(1),
  tokenizerId: z.string().min(1),
  contextHash: hashSchema,
  status: z.literal("blocked"),
  reason: z.string().regex(/^[a-z_]+$/)
})
const recordSchema = z.object({
  ordinal: z.int().nonnegative(),
  versionId: z.uuid(),
  contentHash: hashSchema,
  nativeId: z.string().min(1),
  sourceLocator: z.string().startsWith("/"),
  preparation: z.array(z.discriminatedUnion("status", [preparedSchema, blockedSchema])).min(1)
})

export const legalPassageManifestEntrySchema = z.strictObject({
  ordinal: z.int().nonnegative(),
  versionId: z.uuid(),
  contentHash: hashSchema,
  nativeId: z.string().min(1),
  sourceLocator: z.string().startsWith("/"),
  contextHash: hashSchema,
  eligibility: z.enum(["eligible", "empty_text"]),
  generationId: hashSchema,
  inputManifestHash: hashSchema,
  passageCount: z.int().nonnegative()
})
type ManifestEntry = z.infer<typeof legalPassageManifestEntrySchema>

export const legalPassagePartitionManifestSchema = z.strictObject({
  contract: z.literal(legalPassageManifestContract),
  contracts: z.strictObject({
    qualification: z.string().min(1),
    qualificationImplementation: hashSchema,
    sourceInput: z.string().min(1),
    reader: z.string().min(1),
    passage: z.string().min(1)
  }),
  owner: z.strictObject({
    kind: z.literal("edition"),
    id: z.uuid(),
    sourceId: z.enum(["ecfr", "govinfo-cfr"]),
    sourceGenerationId: hashSchema,
    rightsProfileId: z.string().min(1),
    nativeKey: z.string().min(1),
    currencyDate: z.string().nullable()
  }),
  sourceMembership: z.strictObject({
    inventoryHash: hashSchema,
    qualificationDataHash: hashSchema,
    rightsHash: hashSchema,
    records: z.int().positive()
  }),
  preparation: z.strictObject({ model: z.string().min(1), tokenizerId: z.string().min(1) }),
  entries: z.strictObject({
    file: z.string().min(1),
    sha256: hashSchema,
    versions: z.int().positive(),
    passages: z.int().nonnegative(),
    eligibility: z.strictObject({ eligible: z.int().nonnegative(), emptyText: z.int().nonnegative() })
  })
})

export const legalPassageCatalogSchema = z.strictObject({
  contract: z.literal(legalPassageManifestContract),
  qualificationInventoryHash: hashSchema,
  implementationHash: hashSchema,
  model: z.string().min(1),
  tokenizerId: z.string().min(1),
  partitions: z
    .array(
      z.strictObject({
        ownerId: z.uuid(),
        manifestHash: hashSchema,
        entriesHash: hashSchema,
        versions: z.int().positive(),
        passages: z.int().nonnegative(),
        manifest: z.string().min(1)
      })
    )
    .min(1),
  totals: z.strictObject({
    partitions: z.int().positive(),
    versions: z.int().positive(),
    passages: z.int().nonnegative()
  })
})

function entryLine(entry: ManifestEntry) {
  return `${JSON.stringify(entry)}\n`
}

async function fileHash(path: string) {
  const hash = createHash("sha256")
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest("hex")
}

async function writeOrVerify(path: string, contents: string) {
  try {
    const current = await readFile(path, "utf8")
    invariant(current === contents, "legal_passage_manifest_replay_mismatch")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    await writeFile(path, contents, { flag: "wx" })
  }
}

/**
 * Freezes qualification evidence into model-specific, per-edition manifests.
 * The retained inputManifestHash is the hash of the complete passage objects, including every passage inputHash.
 */
export async function freezeLegalPassageManifests(input: {
  inventoryPath: string
  outputDirectory: string
  implementationHash: string
  model: string
}) {
  const inventory = inventorySchema.parse(JSON.parse(await readFile(input.inventoryPath, "utf8")))
  invariant(inventory.implementationHash === input.implementationHash, "legal_passage_manifest_implementation_mismatch")
  const identity = inventory.preparation.find(({ model }) => model === input.model)
  invariant(identity, "legal_passage_manifest_model_missing")
  invariant(inventory.selected.length === inventory.results.length, "legal_passage_manifest_partition_count_mismatch")
  await mkdir(input.outputDirectory, { recursive: true })
  const qualificationDirectory = dirname(input.inventoryPath)
  const partitions = []
  let totalVersions = 0
  let totalPassages = 0

  for (const [index, result] of inventory.results.entries()) {
    const selected = inventory.selected[index]
    invariant(selected?.id === result.edition.id, "legal_passage_manifest_partition_order_mismatch")
    const partitionDirectory = join(input.outputDirectory, result.edition.id, digest(input.model).slice(0, 16))
    await mkdir(partitionDirectory, { recursive: true })
    const entriesPath = join(partitionDirectory, "entries.ndjson")
    const pendingPath = join(partitionDirectory, `.${randomUUID()}.pending`)
    const stream = createWriteStream(pendingPath, { flags: "wx" })
    const entriesHash = createHash("sha256")
    const qualificationDataHash = createHash("sha256")
    let versions = 0
    let passages = 0
    let eligible = 0
    let empty = 0
    let expectedOrdinal = 0
    try {
      for await (const line of createInterface({
        input: createReadStream(join(qualificationDirectory, result.key, "records.ndjson")),
        crlfDelay: Infinity
      })) {
        qualificationDataHash.update(`${line}\n`)
        const record = recordSchema.parse(JSON.parse(line))
        invariant(record.ordinal === expectedOrdinal, "legal_passage_manifest_member_order_mismatch")
        expectedOrdinal++
        const prepared = record.preparation.find(({ model }) => model === input.model)
        invariant(prepared, "legal_passage_manifest_record_model_missing")
        invariant(prepared.tokenizerId === identity.tokenizerId, "legal_passage_manifest_tokenizer_mismatch")
        invariant(prepared.status === "prepared", "legal_passage_manifest_blocked_input")
        const manifestEntry: ManifestEntry = {
          ordinal: record.ordinal,
          versionId: record.versionId,
          contentHash: record.contentHash,
          nativeId: record.nativeId,
          sourceLocator: record.sourceLocator,
          contextHash: prepared.contextHash,
          eligibility: prepared.eligibility,
          generationId: prepared.generation,
          inputManifestHash: prepared.manifestHash,
          passageCount: prepared.passages
        }
        const output = entryLine(manifestEntry)
        entriesHash.update(output)
        if (!stream.write(output)) await new Promise<void>((resolve) => stream.once("drain", resolve))
        versions++
        passages += prepared.passages
        eligible += Number(prepared.eligibility === "eligible")
        empty += Number(prepared.eligibility === "empty_text")
      }
      stream.end()
      await finished(stream)
      invariant(versions === result.counters.records, "legal_passage_manifest_record_count_mismatch")
      invariant(
        qualificationDataHash.digest("hex") === result.dataHash,
        "legal_passage_manifest_qualification_data_mismatch"
      )
      const hash = entriesHash.digest("hex")
      try {
        const existingHash = await fileHash(entriesPath)
        invariant(existingHash === hash, "legal_passage_manifest_replay_mismatch")
        await rm(pendingPath)
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
        await rename(pendingPath, entriesPath)
      }
      const relativeEntriesPath = `${basename(dirname(partitionDirectory))}/${basename(partitionDirectory)}/entries.ndjson`
      const manifest = {
        contract: legalPassageManifestContract,
        contracts: {
          qualification: inventory.contract,
          qualificationImplementation: inventory.implementationHash,
          sourceInput: regulatoryParserContract,
          reader: legalReaderContract,
          passage: legalPassageContract
        },
        owner: {
          kind: "edition" as const,
          id: result.edition.id,
          sourceId: result.edition.source_id,
          sourceGenerationId: result.edition.generation_id,
          rightsProfileId: result.edition.rights_profile_id,
          nativeKey: result.edition.native_key,
          currencyDate: result.edition.currency_date
        },
        sourceMembership: {
          inventoryHash: result.inventoryHash,
          qualificationDataHash: result.dataHash,
          rightsHash: result.rightsHash,
          records: versions
        },
        preparation: { model: input.model, tokenizerId: identity.tokenizerId },
        entries: {
          file: relativeEntriesPath,
          sha256: hash,
          versions,
          passages,
          eligibility: { eligible, emptyText: empty }
        }
      }
      const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`
      const manifestPath = join(partitionDirectory, "manifest.json")
      await writeOrVerify(manifestPath, manifestContents)
      const manifestHash = digest(manifestContents)
      partitions.push({
        ownerId: result.edition.id,
        manifest: manifestPath,
        manifestHash,
        entriesHash: hash,
        versions,
        passages
      })
      totalVersions += versions
      totalPassages += passages
    } catch (error) {
      stream.destroy()
      await rm(pendingPath, { force: true })
      throw error
    }
  }

  invariant(
    new Set(partitions.map(({ ownerId }) => ownerId)).size === partitions.length,
    "legal_passage_manifest_duplicate_owner"
  )
  const catalog = {
    contract: legalPassageManifestContract,
    qualificationInventoryHash: await fileHash(input.inventoryPath),
    implementationHash: inventory.implementationHash,
    model: input.model,
    tokenizerId: identity.tokenizerId,
    partitions: partitions.map(({ manifest, ...partition }) => ({
      ...partition,
      manifest: manifest.slice(input.outputDirectory.length + 1).replaceAll("\\", "/")
    })),
    totals: { partitions: partitions.length, versions: totalVersions, passages: totalPassages }
  }
  const catalogContents = `${JSON.stringify(catalog, null, 2)}\n`
  await writeOrVerify(join(input.outputDirectory, "catalog.json"), catalogContents)
  return { ...catalog, catalogHash: digest(catalogContents) }
}
