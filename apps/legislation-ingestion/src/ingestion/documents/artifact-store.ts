import { randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { access, copyFile, link, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import type { BlobServiceClient } from "@azure/storage-blob"
import { createLazyAzureCredential } from "../azure-credential.js"

export interface ArtifactStore {
  exists(path: string): Promise<boolean>
  put(path: string, bytes: Uint8Array): Promise<boolean>
  read(path: string): Promise<Uint8Array>
}

/** Streaming file transfer used by large cross-worker artifacts that must not be buffered in task memory. */
export interface FileArtifactStore extends ArtifactStore {
  putFile(path: string, localPath: string): Promise<boolean>
  readToFile(path: string, localPath: string): Promise<void>
}

export class ArtifactNotFoundError extends Error {
  readonly path: string

  constructor(path: string, options: ErrorOptions = {}) {
    super(`Stored document artifact was not found: ${path}`, options)
    this.name = "ArtifactNotFoundError"
    this.path = path
  }
}

export class LocalArtifactStore implements FileArtifactStore {
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

  async put(path: string, bytes: Uint8Array): Promise<boolean> {
    const target = this.#resolve(path)
    await mkdir(resolve(target, ".."), { recursive: true })
    try {
      await writeFile(target, bytes, { flag: "wx" })
      return true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
      return false
    }
  }

  async read(path: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.#resolve(path)))
    } catch (error) {
      if (isMissingArtifactError(error)) {
        throw new ArtifactNotFoundError(path, { cause: error })
      }
      throw error
    }
  }

  async putFile(path: string, localPath: string): Promise<boolean> {
    const source = await lstat(localPath)
    if (!source.isFile() || source.isSymbolicLink()) throw new Error("Artifact source must be a regular file")
    const target = this.#resolve(path)
    await mkdir(resolve(target, ".."), { recursive: true })
    try {
      await copyFile(localPath, target, constants.COPYFILE_EXCL)
      return true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
      return false
    }
  }

  async readToFile(path: string, localPath: string): Promise<void> {
    const target = resolve(localPath)
    await mkdir(resolve(target, ".."), { recursive: true })
    try {
      await copyFile(this.#resolve(path), target, constants.COPYFILE_EXCL)
    } catch (error) {
      if (isMissingArtifactError(error)) throw new ArtifactNotFoundError(path, { cause: error })
      throw error
    }
  }

  #resolve(path: string): string {
    const target = resolve(this.#root, path)
    if (target !== this.#root && !target.startsWith(`${this.#root}${sep}`)) {
      throw new Error("Artifact path escapes the configured store")
    }
    return target
  }
}

export class AzureBlobArtifactStore implements FileArtifactStore {
  readonly #accountName: string
  readonly #containerName: string
  #container: Promise<ReturnType<BlobServiceClient["getContainerClient"]>> | undefined

  constructor(accountName: string, containerName: string) {
    this.#accountName = accountName
    this.#containerName = containerName
  }

  async #blob(path: string) {
    const normalized = normalizeBlobPath(path)
    this.#container ??= import("@azure/storage-blob").then(({ BlobServiceClient }) => {
      const service = new BlobServiceClient(
        `https://${this.#accountName}.blob.core.windows.net`,
        createLazyAzureCredential()
      )
      return service.getContainerClient(this.#containerName)
    })
    return (await this.#container).getBlockBlobClient(normalized)
  }

  async exists(path: string): Promise<boolean> {
    return (await this.#blob(path)).exists()
  }

  async put(path: string, bytes: Uint8Array): Promise<boolean> {
    const blob = await this.#blob(path)
    try {
      await blob.uploadData(bytes, { conditions: { ifNoneMatch: "*" } })
      return true
    } catch (error) {
      if (!isExistingBlobError(error)) {
        throw error
      }
      return false
    }
  }

  async read(path: string): Promise<Uint8Array> {
    try {
      const blob = await this.#blob(path)
      return new Uint8Array(await blob.downloadToBuffer())
    } catch (error) {
      if (isMissingArtifactError(error)) {
        throw new ArtifactNotFoundError(path, { cause: error })
      }
      throw error
    }
  }

  async putFile(path: string, localPath: string): Promise<boolean> {
    const source = await lstat(localPath)
    if (!source.isFile() || source.isSymbolicLink()) throw new Error("Artifact source must be a regular file")
    const blob = await this.#blob(path)
    try {
      await blob.uploadFile(localPath, { conditions: { ifNoneMatch: "*" } })
      return true
    } catch (error) {
      if (!isExistingBlobError(error)) throw error
      return false
    }
  }

  async readToFile(path: string, localPath: string): Promise<void> {
    const target = resolve(localPath)
    await mkdir(resolve(target, ".."), { recursive: true })
    const temporary = `${target}.${randomUUID()}.partial`
    try {
      const blob = await this.#blob(path)
      await blob.downloadToFile(temporary, 0, undefined, {
        conditions: { ifMatch: "*" }
      })
      await link(temporary, target)
    } catch (error) {
      if (isMissingArtifactError(error)) throw new ArtifactNotFoundError(path, { cause: error })
      throw error
    } finally {
      await rm(temporary, { force: true })
    }
  }
}

export function isExistingBlobError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error.statusCode === 409 || error.statusCode === 412)
  )
}

export function isMissingArtifactError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("statusCode" in error && error.statusCode === 404) || ("code" in error && error.code === "ENOENT"))
  )
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
