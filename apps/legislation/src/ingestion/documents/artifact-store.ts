import { constants } from "node:fs"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient } from "@azure/storage-blob"

export interface ArtifactStore {
  exists(path: string): Promise<boolean>
  put(path: string, bytes: Uint8Array): Promise<void>
  read(path: string): Promise<Uint8Array>
}

export class LocalArtifactStore implements ArtifactStore {
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.#resolve(path), constants.F_OK)
      return true
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return false
      }
      throw error
    }
  }

  async put(path: string, bytes: Uint8Array): Promise<void> {
    const target = this.#resolve(path)
    await mkdir(resolve(target, ".."), { recursive: true })
    try {
      await writeFile(target, bytes, { flag: "wx" })
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
    }
  }

  async read(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.#resolve(path)))
  }

  #resolve(path: string): string {
    const target = resolve(this.#root, path)
    if (target !== this.#root && !target.startsWith(`${this.#root}${sep}`)) {
      throw new Error("Artifact path escapes the configured store")
    }
    return target
  }
}

export class AzureBlobArtifactStore implements ArtifactStore {
  readonly #container: ReturnType<BlobServiceClient["getContainerClient"]>

  constructor(accountName: string, containerName: string) {
    const service = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, new DefaultAzureCredential())
    this.#container = service.getContainerClient(containerName)
  }

  async exists(path: string): Promise<boolean> {
    return this.#container.getBlockBlobClient(normalizeBlobPath(path)).exists()
  }

  async put(path: string, bytes: Uint8Array): Promise<void> {
    const blob = this.#container.getBlockBlobClient(normalizeBlobPath(path))
    try {
      await blob.uploadData(bytes, { conditions: { ifNoneMatch: "*" } })
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 412)) {
        throw error
      }
    }
  }

  async read(path: string): Promise<Uint8Array> {
    return new Uint8Array(await this.#container.getBlockBlobClient(normalizeBlobPath(path)).downloadToBuffer())
  }
}

function normalizeBlobPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "")
  if (normalized.length === 0 || normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("Invalid blob artifact path")
  }
  return normalized
}

export function artifactPath(source: string, documentId: string, contentHash: string, sourceUrl: string): string {
  const extension = extname(new URL(sourceUrl).pathname)
    .toLowerCase()
    .replaceAll(/[^.a-z0-9]/g, "")
  const safeSource = source.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-")
  const safeDocument = documentId.replaceAll(/[^a-zA-Z0-9-]/g, "-")
  return `${safeSource}/${safeDocument}/${contentHash}${extension}`
}
