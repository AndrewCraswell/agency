import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rm } from "node:fs/promises"
import { basename, join } from "node:path"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import {
  inspectRegulatoryArtifactFile,
  materializeRegulatoryArtifact,
  regulatoryArtifactLocator,
  regulatoryArtifactLocatorSchema,
  retainRegulatoryArtifact
} from "./durable-artifact.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const filenameSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
const retainedFileSchema = z.strictObject({
  file: filenameSchema,
  locator: z.string().min(1),
  hash: hashSchema,
  bytes: z.int().positive()
})
export const regulatoryNormalizedBundleSchema = z.strictObject({
  contract: z.literal("regulatory-normalized-bundle-2026-09-17"),
  generation: hashSchema,
  sourceHash: hashSchema,
  parserHash: hashSchema,
  summary: retainedFileSchema.extend({ file: z.literal("summary.json") }),
  shards: z.array(retainedFileSchema).min(1)
})

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function requireNormalizedLocator(locator: string, hash: string) {
  const parsed = regulatoryArtifactLocatorSchema.parse(locator)
  invariant(parsed.kind === "normalized" && parsed.hash === hash, "normalized_bundle_locator_mismatch")
  return parsed
}

/** Retains a complete parser generation as immutable summary, shard and descriptor artifacts. */
export async function retainRegulatoryNormalizedBundle(
  store: FileArtifactStore,
  input: { directory: string; generation: string; sourceHash: string; summary: unknown }
) {
  const summary = regulatoryParseSummarySchema.parse(input.summary)
  const generation = hashSchema.parse(input.generation)
  const sourceHash = hashSchema.parse(input.sourceHash)
  invariant(
    summary.inputHash === sourceHash && hashSchema.parse(summary.parserCodeHash) === summary.parserCodeHash,
    "normalized_bundle_summary_mismatch"
  )
  const summaryPath = join(input.directory, "summary.json")
  const summaryFile = await inspectRegulatoryArtifactFile(summaryPath)
  const retainedSummary = await retainRegulatoryArtifact(store, {
    kind: "normalized",
    hash: summaryFile.hash,
    bytes: summaryFile.bytes,
    extension: "json",
    localPath: summaryPath
  })
  const shards = []
  for (const shard of summary.shards) {
    filenameSchema.parse(shard.file)
    const retained = await retainRegulatoryArtifact(store, {
      kind: "normalized",
      hash: shard.sha256,
      bytes: shard.bytes,
      extension: "ndjson",
      localPath: join(input.directory, shard.file)
    })
    shards.push({ file: shard.file, locator: retained.locator, hash: retained.hash, bytes: retained.bytes })
  }
  const descriptor = regulatoryNormalizedBundleSchema.parse({
    contract: "regulatory-normalized-bundle-2026-09-17",
    generation,
    sourceHash,
    parserHash: summary.parserCodeHash,
    summary: {
      file: "summary.json",
      locator: retainedSummary.locator,
      hash: retainedSummary.hash,
      bytes: retainedSummary.bytes
    },
    shards
  })
  const bytes = Buffer.from(JSON.stringify(descriptor))
  const descriptorHash = digest(bytes)
  const locator = regulatoryArtifactLocator("normalized", descriptorHash, "json")
  const parsed = regulatoryArtifactLocatorSchema.parse(locator)
  const created = await store.put(parsed.path, bytes)
  if (!created) {
    const existing = await store.read(parsed.path)
    invariant(digest(existing) === descriptorHash, "normalized_bundle_immutable_conflict")
  }
  return { locator, hash: descriptorHash, bytes: bytes.byteLength, descriptor, created }
}

/** Downloads every file in a retained normalized generation and verifies the exact descriptor before use. */
export async function materializeRegulatoryNormalizedBundle(
  store: FileArtifactStore,
  input: { locator: string; outputRoot: string }
) {
  const parsedLocator = regulatoryArtifactLocatorSchema.parse(input.locator)
  invariant(
    parsedLocator.kind === "normalized" && parsedLocator.extension === "json",
    "normalized_bundle_locator_invalid"
  )
  const descriptorBytes = await store.read(parsedLocator.path)
  invariant(digest(descriptorBytes) === parsedLocator.hash, "normalized_bundle_descriptor_hash_mismatch")
  const descriptor = regulatoryNormalizedBundleSchema.parse(JSON.parse(Buffer.from(descriptorBytes).toString("utf8")))
  const directory = join(input.outputRoot, `${descriptor.generation}-${randomUUID()}.materialized`)
  await mkdir(directory, { recursive: false })
  try {
    requireNormalizedLocator(descriptor.summary.locator, descriptor.summary.hash)
    await materializeRegulatoryArtifact(store, {
      locator: descriptor.summary.locator,
      hash: descriptor.summary.hash,
      bytes: descriptor.summary.bytes,
      localPath: join(directory, descriptor.summary.file)
    })
    for (const shard of descriptor.shards) {
      requireNormalizedLocator(shard.locator, shard.hash)
      invariant(basename(shard.file) === shard.file, "normalized_bundle_shard_path_invalid")
      await materializeRegulatoryArtifact(store, {
        locator: shard.locator,
        hash: shard.hash,
        bytes: shard.bytes,
        localPath: join(directory, shard.file)
      })
    }
    const summary = regulatoryParseSummarySchema.parse(
      JSON.parse(await readFile(join(directory, "summary.json"), "utf8"))
    )
    invariant(
      summary.inputHash === descriptor.sourceHash &&
        summary.parserCodeHash === descriptor.parserHash &&
        summary.shards.length === descriptor.shards.length &&
        summary.shards.every((shard, index) => {
          const retained = descriptor.shards[index]
          return retained?.file === shard.file && retained.hash === shard.sha256 && retained.bytes === shard.bytes
        }),
      "normalized_bundle_content_mismatch"
    )
    return { directory, descriptor }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
