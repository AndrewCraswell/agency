import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const kindSchema = z.enum(["source", "metadata", "pdf", "normalized"])
const extensionSchema = z.string().regex(/^[a-z0-9]{1,12}$/)
export const regulatoryArtifactLocatorSchema = z
  .string()
  .url({ protocol: /^regulatory-artifact$/ })
  .transform((value) => {
    const url = new URL(value)
    invariant(
      url.username === "" && url.password === "" && url.port === "" && !url.search && !url.hash,
      "invalid_regulatory_artifact_locator"
    )
    const kind = kindSchema.parse(url.hostname)
    const segments = url.pathname.slice(1).split("/")
    invariant(segments.length === 3, "invalid_regulatory_artifact_locator")
    const [prefix, filename, extra] = segments
    invariant(extra !== undefined && extra === "file", "invalid_regulatory_artifact_locator")
    const match = /^([a-f0-9]{64})\.([a-z0-9]{1,12})$/.exec(filename ?? "")
    invariant(match?.[1] && match[2], "invalid_regulatory_artifact_locator")
    const hash = hashSchema.parse(match[1])
    invariant(prefix === hash.slice(0, 2), "invalid_regulatory_artifact_locator")
    return { kind, hash, extension: extensionSchema.parse(match[2]), path: `${kind}/${prefix}/${filename}` }
  })

export function regulatoryArtifactLocator(kindValue: unknown, hashValue: unknown, extensionValue: unknown) {
  const kind = kindSchema.parse(kindValue)
  const hash = hashSchema.parse(hashValue)
  const extension = extensionSchema.parse(extensionValue)
  return `regulatory-artifact://${kind}/${hash.slice(0, 2)}/${hash}.${extension}/file`
}

export async function inspectRegulatoryArtifactFile(path: string) {
  const stat = await lstat(path)
  invariant(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, "regulatory_artifact_not_regular_file")
  const hash = createHash("sha256")
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
    bytes += chunk.length
  }
  invariant(bytes === stat.size, "regulatory_artifact_changed_during_hash")
  return { hash: hash.digest("hex"), bytes }
}

/** Uploads a verified immutable file without buffering it in the workflow process. */
export async function retainRegulatoryArtifact(
  store: FileArtifactStore,
  input: { kind: z.infer<typeof kindSchema>; hash: string; bytes: number; extension: string; localPath: string }
) {
  const hash = hashSchema.parse(input.hash)
  const bytes = z.int().positive().parse(input.bytes)
  const locator = regulatoryArtifactLocator(input.kind, hash, input.extension)
  const parsed = regulatoryArtifactLocatorSchema.parse(locator)
  const local = await inspectRegulatoryArtifactFile(input.localPath)
  invariant(local.hash === hash && local.bytes === bytes, "regulatory_artifact_local_mismatch")
  const created = await store.putFile(parsed.path, input.localPath)
  if (!created) {
    const verificationPath = join(dirname(input.localPath), `${randomUUID()}.verification`)
    try {
      await store.readToFile(parsed.path, verificationPath)
      const retained = await inspectRegulatoryArtifactFile(verificationPath)
      invariant(retained.hash === hash && retained.bytes === bytes, "regulatory_artifact_immutable_conflict")
    } finally {
      await rm(verificationPath, { force: true })
    }
  }
  return { locator, path: parsed.path, hash, bytes, created }
}

/** Materializes and revalidates one immutable file into a worker's exclusive scratch path. */
export async function materializeRegulatoryArtifact(
  store: FileArtifactStore,
  input: { locator: string; hash: string; bytes: number; localPath: string }
) {
  const parsed = regulatoryArtifactLocatorSchema.parse(input.locator)
  const hash = hashSchema.parse(input.hash)
  const bytes = z.int().positive().parse(input.bytes)
  invariant(parsed.hash === hash, "regulatory_artifact_locator_hash_mismatch")
  try {
    await store.readToFile(parsed.path, input.localPath)
    const local = await inspectRegulatoryArtifactFile(input.localPath)
    invariant(local.hash === hash && local.bytes === bytes, "regulatory_artifact_retention_mismatch")
    return { ...parsed, localPath: input.localPath, bytes }
  } catch (error) {
    await rm(input.localPath, { force: true })
    throw error
  }
}

/** Materializes a content-addressed locator when the database contract does not store its byte count separately. */
export async function materializeRegulatoryArtifactFromLocator(
  store: FileArtifactStore,
  input: { locator: string; localPath: string; maximumBytes: number; expectedKind?: z.infer<typeof kindSchema> }
) {
  const parsed = regulatoryArtifactLocatorSchema.parse(input.locator)
  if (input.expectedKind !== undefined) {
    invariant(parsed.kind === input.expectedKind, "regulatory_artifact_locator_kind_mismatch")
  }
  const maximumBytes = z.int().positive().parse(input.maximumBytes)
  try {
    await store.readToFile(parsed.path, input.localPath)
    const local = await inspectRegulatoryArtifactFile(input.localPath)
    invariant(local.hash === parsed.hash && local.bytes <= maximumBytes, "regulatory_artifact_retention_mismatch")
    return { ...parsed, localPath: input.localPath, bytes: local.bytes }
  } catch (error) {
    await rm(input.localPath, { force: true })
    throw error
  }
}
