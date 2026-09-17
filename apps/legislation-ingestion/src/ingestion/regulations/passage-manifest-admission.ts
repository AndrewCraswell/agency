import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { createInterface } from "node:readline"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  legalPassageCatalogSchema,
  legalPassageManifestEntrySchema,
  legalPassagePartitionManifestSchema
} from "./passage-manifest.js"
import { legalPassageContract } from "./passages.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const editionSchema = z.object({
  id: z.uuid(),
  source_id: z.string(),
  generation_id: hashSchema,
  rights_profile_id: z.string(),
  native_key: z.string(),
  currency_date: z.string().nullable(),
  published_at: z.coerce.date(),
  policy_hash: hashSchema,
  is_active: z.literal(true),
  members: z.int().positive()
})
const memberSchema = z.object({
  ordinal: z.int().nonnegative(),
  version_id: z.uuid(),
  content_hash: hashSchema,
  native_id: z.string(),
  source_locator: z.string(),
  context: z.string(),
  source_hash: hashSchema
})
const generationSchema = z.object({
  id: hashSchema,
  provision_version_id: z.uuid(),
  document_version_id: z.null(),
  contract: z.string(),
  tokenizer_id: z.string(),
  context: z.string(),
  manifest_hash: hashSchema,
  passage_count: z.int().nonnegative(),
  actual_passages: z.int().nonnegative(),
  eligibility: z.enum(["eligible", "empty_text"]),
  source_hash: hashSchema.nullable()
})

function artifactPath(root: string, path: string) {
  invariant(!isAbsolute(path), "legal_passage_admission_absolute_path")
  const result = resolve(root, path)
  invariant(
    relative(root, result) !== "" && !relative(root, result).startsWith(".."),
    "legal_passage_admission_path_escape"
  )
  return result
}

async function readEdition(client: pg.PoolClient, editionId: string) {
  return editionSchema.parse(
    (
      await client.query(
        `SELECT e.id,e.source_id,e.generation_id,e.rights_profile_id,e.native_key,e.currency_date::text,
        e.published_at,r.policy_hash,r.is_active,count(m.*)::integer AS members
        FROM legislation.legal_editions e
        JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id
        JOIN legislation.legal_edition_provisions m ON m.edition_id=e.id
        WHERE e.id=$1 GROUP BY e.id,r.policy_hash,r.is_active`,
        [editionId]
      )
    ).rows[0]
  )
}

async function readMembers(client: pg.PoolClient, editionId: string, first: number, last: number) {
  return z.array(memberSchema).parse(
    (
      await client.query(
        `SELECT m.ordinal,m.version_id,v.content_hash,m.native_id,m.source_locator,
        left(concat_ws(E'\n',e.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context,
        legislation.legal_passage_source_hash(v.body,v.heading,v.blocks,v.input_contract) AS source_hash
        FROM legislation.legal_edition_provisions m
        JOIN legislation.legal_editions e ON e.id=m.edition_id
        JOIN legislation.legal_codes c ON c.id=m.code_id
        JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        WHERE m.edition_id=$1 AND m.ordinal BETWEEN $2 AND $3 ORDER BY m.ordinal`,
        [editionId, first, last]
      )
    ).rows
  )
}

async function readGenerations(client: pg.PoolClient, ids: string[]) {
  const rows = z.array(generationSchema).parse(
    (
      await client.query(
        `SELECT g.id,g.provision_version_id,g.document_version_id,g.contract,g.tokenizer_id,g.context,g.manifest_hash,
        g.passage_count,count(p.*)::integer AS actual_passages,g.eligibility,provenance.source_hash
        FROM legislation.legal_passage_generations g
        LEFT JOIN legislation.legal_passages p ON p.generation_id=g.id
        LEFT JOIN legislation.legal_passage_source_provenance provenance ON provenance.generation_id=g.id
        WHERE g.id=ANY($1::text[]) GROUP BY g.id,provenance.source_hash`,
        [ids]
      )
    ).rows
  )
  return new Map(rows.map((row) => [row.id, row]))
}

/** Read-only PASS-09 admission. It performs no provider calls, passage writes, dispatches or readiness promotion. */
export async function auditLegalPassageManifestAdmission(
  pool: pg.Pool,
  input: { catalogPath: string; catalogHash: string; batchSize?: number }
) {
  const catalogPath = resolve(input.catalogPath)
  const root = dirname(catalogPath)
  const expectedCatalogHash = hashSchema.parse(input.catalogHash)
  const batchSize = z
    .int()
    .min(1)
    .max(2000)
    .parse(input.batchSize ?? 1000)
  const catalogContents = await readFile(catalogPath, "utf8")
  invariant(digest(catalogContents) === expectedCatalogHash, "legal_passage_admission_catalog_hash")
  const catalog = legalPassageCatalogSchema.parse(JSON.parse(catalogContents))
  invariant(catalog.partitions.length === catalog.totals.partitions, "legal_passage_admission_partition_count")
  invariant(
    new Set(catalog.partitions.map(({ ownerId }) => ownerId)).size === catalog.partitions.length,
    "legal_passage_admission_duplicate_owner"
  )
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    const partitions = []
    let totalVersions = 0
    let totalPassages = 0
    let materialized = 0
    for (const partition of catalog.partitions) {
      const manifestContents = await readFile(artifactPath(root, partition.manifest), "utf8")
      invariant(digest(manifestContents) === partition.manifestHash, "legal_passage_admission_manifest_hash")
      const manifest = legalPassagePartitionManifestSchema.parse(JSON.parse(manifestContents))
      invariant(manifest.owner.id === partition.ownerId, "legal_passage_admission_owner")
      invariant(manifest.preparation.model === catalog.model, "legal_passage_admission_model")
      invariant(manifest.preparation.tokenizerId === catalog.tokenizerId, "legal_passage_admission_tokenizer")
      invariant(manifest.entries.sha256 === partition.entriesHash, "legal_passage_admission_entries_hash")
      invariant(manifest.entries.versions === partition.versions, "legal_passage_admission_versions")
      invariant(manifest.entries.passages === partition.passages, "legal_passage_admission_passages")
      invariant(manifest.contracts.passage === legalPassageContract, "legal_passage_admission_passage_contract")
      const edition = await readEdition(client, partition.ownerId)
      invariant(
        edition.source_id === manifest.owner.sourceId &&
          edition.generation_id === manifest.owner.sourceGenerationId &&
          edition.rights_profile_id === manifest.owner.rightsProfileId &&
          edition.native_key === manifest.owner.nativeKey &&
          edition.currency_date === manifest.owner.currencyDate &&
          edition.policy_hash === manifest.sourceMembership.rightsHash &&
          edition.members === manifest.sourceMembership.records,
        "legal_passage_admission_edition_changed"
      )
      const entriesPath = artifactPath(root, manifest.entries.file)
      const entriesHash = createHash("sha256")
      let expectedOrdinal = 0
      let passages = 0
      let partitionMaterialized = 0
      let batch: z.infer<typeof legalPassageManifestEntrySchema>[] = []
      const reconcile = async () => {
        if (batch.length === 0) return
        const members = await readMembers(client, partition.ownerId, batch[0]!.ordinal, batch.at(-1)!.ordinal)
        invariant(members.length === batch.length, "legal_passage_admission_membership_missing")
        const storageIds = batch.map((entry) => digest(JSON.stringify(["provision", entry.generationId])))
        const generations = await readGenerations(client, storageIds)
        for (const [index, entry] of batch.entries()) {
          const member = members[index]
          invariant(
            member?.ordinal === entry.ordinal &&
              member.version_id === entry.versionId &&
              member.content_hash === entry.contentHash &&
              member.native_id === entry.nativeId &&
              member.source_locator === entry.sourceLocator &&
              digest(member.context.trim()) === entry.contextHash,
            "legal_passage_admission_membership_changed"
          )
          const generation = generations.get(storageIds[index]!)
          if (generation === undefined) continue
          invariant(
            generation.provision_version_id === entry.versionId &&
              generation.contract === legalPassageContract &&
              generation.tokenizer_id === catalog.tokenizerId &&
              digest(generation.context) === entry.contextHash &&
              generation.manifest_hash === entry.inputManifestHash &&
              generation.passage_count === entry.passageCount &&
              generation.actual_passages === entry.passageCount &&
              generation.eligibility === entry.eligibility &&
              generation.source_hash === member.source_hash,
            "legal_passage_admission_generation_changed"
          )
          partitionMaterialized++
        }
        batch = []
      }
      for await (const line of createInterface({ input: createReadStream(entriesPath), crlfDelay: Infinity })) {
        entriesHash.update(`${line}\n`)
        const entry = legalPassageManifestEntrySchema.parse(JSON.parse(line))
        invariant(entry.ordinal === expectedOrdinal, "legal_passage_admission_entry_order")
        expectedOrdinal++
        passages += entry.passageCount
        batch.push(entry)
        if (batch.length === batchSize) await reconcile()
      }
      await reconcile()
      invariant(entriesHash.digest("hex") === manifest.entries.sha256, "legal_passage_admission_entries_content")
      invariant(expectedOrdinal === manifest.entries.versions, "legal_passage_admission_entry_count")
      invariant(passages === manifest.entries.passages, "legal_passage_admission_passage_count")
      totalVersions += expectedOrdinal
      totalPassages += passages
      materialized += partitionMaterialized
      partitions.push({
        ownerId: partition.ownerId,
        versions: expectedOrdinal,
        passages,
        materialized: partitionMaterialized,
        pending: expectedOrdinal - partitionMaterialized
      })
    }
    invariant(totalVersions === catalog.totals.versions, "legal_passage_admission_catalog_versions")
    invariant(totalPassages === catalog.totals.passages, "legal_passage_admission_catalog_passages")
    await client.query("COMMIT")
    return {
      catalogHash: expectedCatalogHash,
      model: catalog.model,
      tokenizerId: catalog.tokenizerId,
      admission: {
        contract: "legal-passage-manifest-admission" as const,
        catalogHash: expectedCatalogHash,
        model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]).parse(catalog.model),
        tokenizerId: catalog.tokenizerId,
        scopeKind: "edition" as const,
        partitions: partitions.map(({ ownerId, versions, passages }) => ({ ownerId, versions, passages }))
      },
      totals: {
        partitions: partitions.length,
        versions: totalVersions,
        passages: totalPassages,
        materialized,
        pending: totalVersions - materialized
      },
      partitions
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
