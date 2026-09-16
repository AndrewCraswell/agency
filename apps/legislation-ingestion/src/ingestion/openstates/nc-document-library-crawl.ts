import { createHash } from "node:crypto"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { parseNcDocumentLibrary } from "./nc-document-library.js"

const receiptSchema = z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), retrievedAt: z.iso.datetime() })
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

/** One immutable observation per folder per caller-owned crawl store. New syncs use a new store. */
export async function crawlNcDocumentLibrary(options: {
  siteId: string
  rootFolder: string
  store: ArtifactStore
  maxRequests: number
  maxFolders: number
  fetcher?: typeof fetch
}) {
  const { siteId, rootFolder, store, maxRequests, maxFolders } = options
  if (
    ![siteId, rootFolder].every((id) => /^[1-9][0-9]*$/.test(id)) ||
    ![maxRequests, maxFolders].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 1000)
  ) {
    throw new Error("Invalid NC crawl bounds")
  }
  const queue = [rootFolder]
  const discovered = new Set(queue)
  const pages = []
  let requests = 0
  for (const folder of queue) {
    const prefix = `${siteId}/${rootFolder}/${folder}`
    const receiptKey = `${prefix}/receipt.json`
    const url = `https://www.ncleg.gov/Documents/DocumentSiteContents/${siteId}/false/${folder}`
    if (!(await store.exists(receiptKey))) {
      if (requests >= maxRequests) {
        break
      }
      requests++
      const response = await (options.fetcher ?? fetch)(url, {
        signal: AbortSignal.timeout(25000),
        redirect: "error"
      })
      if (!response.ok || !response.body) {
        throw new Error(`NC library HTTP ${response.status}`)
      }
      const chunks: Uint8Array[] = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.byteLength
        if (size > 4_000_000) {
          throw new Error("NC library response exceeds byte limit")
        }
        chunks.push(chunk)
      }
      const bytes = Buffer.concat(chunks)
      parseNcDocumentLibrary(bytes.toString("utf8"), siteId)
      const sha256 = digest(bytes)
      const key = `${prefix}/${sha256}.html`
      await store.put(key, bytes)
      if (digest(await store.read(key)) !== sha256) {
        throw new Error("NC library archive checksum mismatch")
      }
      await store.put(receiptKey, Buffer.from(JSON.stringify({ sha256, retrievedAt: new Date().toISOString() })))
    }
    const receipt = receiptSchema.parse(JSON.parse(Buffer.from(await store.read(receiptKey)).toString("utf8")))
    const bytes = await store.read(`${prefix}/${receipt.sha256}.html`)
    if (digest(bytes) !== receipt.sha256) {
      throw new Error("NC library retained checksum mismatch")
    }
    const inventory = parseNcDocumentLibrary(Buffer.from(bytes).toString("utf8"), siteId)
    pages.push({ folder, url, ...receipt, ...inventory })
    for (const child of inventory.folders) {
      if (!discovered.has(child.id)) {
        if (discovered.size >= maxFolders) {
          throw new Error("NC library folder limit exceeded; inventory is incomplete")
        }
        discovered.add(child.id)
        queue.push(child.id)
      }
    }
  }
  return { complete: pages.length === queue.length, requests, pendingFolders: queue.slice(pages.length), pages }
}
