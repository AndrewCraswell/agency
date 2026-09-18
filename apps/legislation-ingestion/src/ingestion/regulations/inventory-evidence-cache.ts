import { randomUUID } from "node:crypto"
import { link, mkdir, open, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import {
  digest,
  inventoryEvidenceSchema,
  officialUrl,
  type AcquisitionUnit,
  type InventoryEvidence
} from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"

const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])

function evidenceIdentity(sourceId: AcquisitionUnit["sourceId"], url: string) {
  return digest(JSON.stringify(["regulatory-inventory-evidence-2026-09-17", sourceId, url]))
}

function validateEvidence(value: unknown, sourceId: AcquisitionUnit["sourceId"], url: string) {
  const evidence = inventoryEvidenceSchema.parse(value)
  invariant(evidence.sourceId === sourceId && evidence.url === url, "inventory_evidence_identity_mismatch")
  officialUrl(evidence.url, evidence.sourceId)
  invariant(
    evidence.sha256 === digest(evidence.body) && evidence.bytes === Buffer.byteLength(evidence.body),
    "inventory_evidence_content_mismatch"
  )
  return evidence
}

async function readCached(path: string, sourceId: AcquisitionUnit["sourceId"], url: string) {
  try {
    return validateEvidence(JSON.parse(await readFile(path, "utf8")), sourceId, url)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null
    throw error
  }
}

/** Reads or atomically retains one complete official inventory response under its source/request identity. */
export async function cacheRegulatoryInventoryEvidence(
  directory: string,
  sourceValue: unknown,
  urlValue: unknown,
  fetchEvidence: () => Promise<InventoryEvidence>
) {
  const sourceId = sourceSchema.parse(sourceValue)
  const url = officialUrl(z.url().parse(urlValue), sourceId).href
  const id = evidenceIdentity(sourceId, url)
  const evidenceDirectory = join(directory, "evidence")
  const temporaryDirectory = join(directory, "temporary")
  const path = join(evidenceDirectory, `${id}.json`)
  await Promise.all([mkdir(evidenceDirectory, { recursive: true }), mkdir(temporaryDirectory, { recursive: true })])
  const cached = await readCached(path, sourceId, url)
  if (cached !== null) return { evidence: cached, id, path, reused: true }
  const evidence = validateEvidence(await fetchEvidence(), sourceId, url)
  const temporaryPath = join(temporaryDirectory, `${id}-${randomUUID()}.json`)
  const handle = await open(temporaryPath, "wx")
  try {
    await handle.writeFile(`${JSON.stringify(evidence, null, 2)}\n`)
    await handle.sync()
  } finally {
    await handle.close()
  }
  let created = false
  try {
    await link(temporaryPath, path)
    created = true
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
  } finally {
    await rm(temporaryPath, { force: true })
  }
  const retained = await readCached(path, sourceId, url)
  invariant(retained !== null, "inventory_evidence_retention_missing")
  invariant(
    retained.sha256 === evidence.sha256 && retained.retrievedAt === evidence.retrievedAt,
    "inventory_evidence_concurrent_conflict"
  )
  return { evidence: retained, id, path, reused: !created }
}

/** Creates one bounded reader whose retry can reuse every response committed by earlier attempts. */
export function createCachedRegulatoryInventoryReader(options: {
  directory: string
  maximumRequests: number
  fetchEvidence: (sourceId: AcquisitionUnit["sourceId"], url: string) => Promise<InventoryEvidence>
}) {
  const maximumRequests = z.int().min(1).max(500).parse(options.maximumRequests)
  let requested = 0
  let reused = 0
  return {
    read: async (sourceId: AcquisitionUnit["sourceId"], url: string) => {
      const cached = await cacheRegulatoryInventoryEvidence(options.directory, sourceId, url, async () => {
        if (requested >= maximumRequests) {
          throw new Error(`inventory_request_limit_reached:${sourceId}:${url}`)
        }
        requested++
        return options.fetchEvidence(sourceId, url)
      })
      if (cached.reused) reused++
      return cached.evidence
    },
    stats: () => ({ maximumRequests, requested, reused })
  }
}
