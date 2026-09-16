import { createHash } from "node:crypto"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
import type { ArtifactStore } from "./documents/artifact-store.js"

export interface StoredSource {
  bytes: number
  contentHash: string
  contentPath: string
  metadataPath: string
  unchanged: boolean
}

export interface SourceStore {
  put(
    provider: string,
    scope: string,
    content: Uint8Array,
    metadata?: Readonly<Record<string, unknown>>
  ): Promise<StoredSource>
}

function safeSegment(value: string): string {
  const segment = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
  if (segment.length === 0 || segment === "." || segment === "..") {
    throw new Error("Invalid source path segment")
  }
  return segment
}

export class LocalSourceStore implements SourceStore {
  readonly #root: string

  constructor(root: string) {
    this.#root = resolve(root)
  }

  async put(
    provider: string,
    scope: string,
    content: Uint8Array,
    metadata: Readonly<Record<string, unknown>> = {}
  ): Promise<StoredSource> {
    const contentHash = createHash("sha256").update(content).digest("hex")
    const directory = this.#resolve(provider, scope)
    const contentPath = resolve(directory, `${contentHash}.source`)
    const metadataPath = resolve(directory, `${contentHash}.json`)
    await mkdir(directory, { recursive: true })
    let unchanged = false
    try {
      unchanged = (await stat(contentPath)).size === content.byteLength
    } catch {
      unchanged = false
    }
    if (!unchanged) {
      const temporaryPath = `${contentPath}.${process.pid}.tmp`
      await writeFile(temporaryPath, content, { flag: "wx" })
      await rename(temporaryPath, contentPath)
    }
    await writeFile(
      metadataPath,
      `${JSON.stringify({ acquiredAt: new Date().toISOString(), bytes: content.byteLength, contentHash, ...metadata }, null, 2)}\n`,
      "utf8"
    )
    return { bytes: content.byteLength, contentHash, contentPath, metadataPath, unchanged }
  }

  async readMetadata(
    provider: string,
    scope: string,
    contentHash: string
  ): Promise<Record<string, unknown> | undefined> {
    try {
      return JSON.parse(
        await readFile(resolve(this.#resolve(provider, scope), `${contentHash}.json`), "utf8")
      ) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  #resolve(...segments: string[]): string {
    const target = resolve(this.#root, ...segments.map(safeSegment))
    if (target !== this.#root && !target.startsWith(`${this.#root}${sep}`)) {
      throw new Error("Source path escapes configured root")
    }
    return target
  }
}

export class ArtifactSourceStore implements SourceStore {
  readonly #artifacts: ArtifactStore

  constructor(artifacts: ArtifactStore) {
    this.#artifacts = artifacts
  }

  async put(
    provider: string,
    scope: string,
    content: Uint8Array,
    metadata: Readonly<Record<string, unknown>> = {}
  ): Promise<StoredSource> {
    const contentHash = createHash("sha256").update(content).digest("hex")
    const prefix = `${safeSegment(provider)}/${safeSegment(scope)}/${contentHash}`
    const contentPath = `${prefix}.source`
    const metadataPath = `${prefix}.json`
    const unchanged = !(await this.#artifacts.put(contentPath, content))
    await this.#artifacts.put(
      metadataPath,
      new TextEncoder().encode(
        `${JSON.stringify({ acquiredAt: new Date().toISOString(), bytes: content.byteLength, contentHash, ...metadata }, null, 2)}\n`
      )
    )
    return { bytes: content.byteLength, contentHash, contentPath, metadataPath, unchanged }
  }
}
