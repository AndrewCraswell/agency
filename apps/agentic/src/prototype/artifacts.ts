import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { ArtifactManifest } from "../contracts/results"
import { sha256 } from "./context"

export class ArtifactStore {
  readonly #root: string
  readonly #manifest = new Map<string, ArtifactManifest[number]>()

  constructor(root: string) {
    this.#root = root
  }

  async write(relativePath: string, content: Uint8Array, mediaType: string): Promise<string> {
    const destination = join(this.#root, ...relativePath.split("/"))
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, content)
    this.#manifest.set(relativePath, {
      relativePath,
      mediaType,
      byteLength: content.byteLength,
      sha256: sha256(content)
    })
    return relativePath
  }

  manifest(): ArtifactManifest {
    return [...this.#manifest.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  }
}
