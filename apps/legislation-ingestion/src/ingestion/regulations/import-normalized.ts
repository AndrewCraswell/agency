import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import {
  storageBatchBytes,
  storageBatchRecords,
  type RegulatoryRecord
} from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { resolveAnnualCfrObservation } from "./annual-cfr-observations.js"
import { validateRegulatoryArtifactRetention } from "./artifact-backfill.js"
import { inspectCanonicalRegulatoryReuse } from "./canonical-reuse.js"
import { validateRegulatoryOutput } from "./parser-bridge.js"
import {
  parseRegulatoryImportManifest,
  regulatoryImportReceiptSchema,
  sameRegulatoryImportUnit
} from "./regulatory-import-contract.js"
import {
  claimRegulatoryLease,
  materializeRegulatoryEdition,
  publishRegulatoryEdition,
  registerRegulatoryImport,
  releaseRegulatoryLease,
  stageRegulatoryRecords,
  validateStagedRegulatoryImport
} from "./storage.js"

export async function importNormalizedRegulatoryUnit(
  pool: pg.Pool,
  input: {
    manifest: unknown
    receipt: unknown
    directory: string
    parserCodeHash: string
    artifactLocator: string
    artifactValidationPath?: string
    reuseOnly?: boolean
  }
) {
  const manifest = parseRegulatoryImportManifest(input.manifest)
  const receipt = regulatoryImportReceiptSchema.parse(input.receipt)
  const unit = manifest.units.find((item) => item.key === receipt.unit.key)
  invariant(unit && sameRegulatoryImportUnit(unit, receipt.unit), "unit_manifest_mismatch")
  await validateRegulatoryArtifactRetention(
    input.artifactValidationPath ?? input.artifactLocator,
    receipt.sha256,
    receipt.bytes
  )
  // Revalidate every retained shard before creating a database generation. No trust in a prior CLI report.
  const summary = await validateRegulatoryOutput(input.directory, receipt.unit, receipt.sha256, input.parserCodeHash)
  if (unit.sourceId === "ecfr") {
    const reuse = await inspectCanonicalRegulatoryReuse(pool, {
      unit,
      artifactHash: receipt.sha256,
      directory: input.directory,
      parserCodeHash: input.parserCodeHash,
      artifactValidationPath: input.artifactValidationPath
    })
    if (reuse.status === "verified") {
      return {
        generationId: reuse.generationId,
        editionId: reuse.editionId,
        isCurrent: reuse.isCurrent,
        state: "published",
        reused: true
      }
    }
    invariant(reuse.status !== "invalid", "canonical_reuse_content_mismatch")
  }
  invariant(!input.reuseOnly, "canonical_reuse_required")
  const generationId = await registerRegulatoryImport(pool, { ...input, manifest, receipt, summary })
  const lease = await claimRegulatoryLease(pool, generationId)
  try {
    const existing = await pool.query<{ state: string; blocked_reason: string | null }>(
      "SELECT state,blocked_reason FROM legislation.legal_import_generations WHERE id=$1",
      [generationId]
    )
    const state = existing.rows[0]?.state
    if (receipt.unit.sourceId === "govinfo-cfr" && (state === "blocked" || state === "observed")) {
      const observation = await resolveAnnualCfrObservation(pool, lease)
      if (observation) {
        return { generationId, state: "observed", observation, reused: observation.reused }
      }
    }
    if (receipt.unit.sourceId === "govinfo-fr" && state === "published") {
      return { generationId, state, reused: true }
    }
    if (state === "blocked") {
      return { generationId, state, reason: existing.rows[0]?.blocked_reason, reused: true }
    }
    if (state === "staging") {
      let batch: RegulatoryRecord[] = []
      let bytes = 0
      for (const shard of summary.shards) {
        const stream = createReadStream(join(input.directory, shard.file), { encoding: "utf8" })
        const shardHash = createHash("sha256")
        stream.on("data", (chunk) => {
          shardHash.update(chunk)
        })
        const lines = createInterface({ input: stream, crlfDelay: Infinity })
        try {
          for await (const line of lines) {
            const record = regulatoryRecordSchema.parse(JSON.parse(line))
            const size = Buffer.byteLength(JSON.stringify(record))
            if (batch.length > 0 && (batch.length >= storageBatchRecords || bytes + size > storageBatchBytes)) {
              await stageRegulatoryRecords(pool, lease, batch)
              batch = []
              bytes = 0
            }
            batch.push(record)
            bytes += size
          }
        } finally {
          lines.close()
          stream.destroy()
        }
        invariant(shardHash.digest("hex") === shard.sha256, "shard_changed_during_staging")
      }
      if (batch.length > 0) {
        await stageRegulatoryRecords(pool, lease, batch)
      }
    }
    const validated = await validateStagedRegulatoryImport(pool, lease)
    if (validated === "blocked") {
      if (receipt.unit.sourceId === "govinfo-cfr") {
        const observation = await resolveAnnualCfrObservation(pool, lease)
        if (observation) {
          return { generationId, state: "observed", observation, reused: observation.reused }
        }
      }
      const reason = await pool.query<{ blocked_reason: string }>(
        "SELECT blocked_reason FROM legislation.legal_import_generations WHERE id=$1",
        [generationId]
      )
      return { generationId, state: validated, reason: reason.rows[0]?.blocked_reason, reused: false }
    }
    if (receipt.unit.sourceId === "govinfo-cfr") {
      const editionId = await materializeRegulatoryEdition(pool, lease)
      return {
        generationId,
        editionId,
        state: state === "published" ? "published" : "materialized",
        publicationReady: state === "published",
        reason: state === "published" ? undefined : "awaiting_complete_annual_title"
      }
    }
    // Capture expected pointer before materialization. Concurrent publishers force an explicit replay.
    const title = z
      .string()
      .regex(/^title-\d+$/)
      .parse(receipt.unit.nativeId)
    const head = await pool.query<{ edition_id: string }>(
      `SELECT h.edition_id FROM legislation.legal_code_heads h
      JOIN legislation.legal_codes c ON c.id=h.code_id WHERE c.jurisdiction_id='jurisdiction:us'
      AND c.code_key=$1 AND h.source_id=$2`,
      [`cfr-${title}`, receipt.unit.sourceId]
    )
    await materializeRegulatoryEdition(pool, lease)
    const published = await publishRegulatoryEdition(pool, lease, head.rows[0]?.edition_id ?? null)
    return { generationId, state: "published", ...published }
  } finally {
    await releaseRegulatoryLease(pool, lease)
  }
}
