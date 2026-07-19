import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob"
import { z } from "zod"
import type { ArtifactManifest } from "../contracts/results"
import { ArtifactStore, type ArtifactStorePort } from "../prototype/artifacts"
import { sha256 } from "../prototype/context"

const BlobPathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith("/") && !path.includes("\\") && !/(^|\/)\.\.(\/|$)/u.test(path))

interface BlockBlobPort {
  uploadData(
    content: Uint8Array,
    options: {
      blobHTTPHeaders: { blobContentType: string }
      metadata: Record<string, string>
      conditions: { ifNoneMatch: "*" }
    }
  ): Promise<unknown>
  downloadToBuffer(): Promise<Buffer>
}

interface ContainerPort {
  getBlockBlobClient(blobName: string): BlockBlobPort
  getProperties(): Promise<unknown>
}

function isPreconditionFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 412
}

export class AzureBlobArtifactStore implements ArtifactStorePort {
  readonly #local: ArtifactStore
  readonly #container: ContainerPort
  readonly #prefix: string

  constructor(localRoot: string, container: ContainerPort, prefix: string) {
    this.#local = new ArtifactStore(localRoot)
    this.#container = container
    this.#prefix = BlobPathSchema.parse(prefix.replace(/^\/+|\/+$/gu, ""))
  }

  async write(relativePathInput: string, content: Uint8Array, mediaType: string): Promise<string> {
    const relativePath = BlobPathSchema.parse(relativePathInput)
    const digest = sha256(content)
    const blob = this.#container.getBlockBlobClient(`${this.#prefix}/${relativePath}`)
    const uploadImmutable = async (target: BlockBlobPort, value: Uint8Array, contentType: string): Promise<void> => {
      try {
        await target.uploadData(value, {
          blobHTTPHeaders: { blobContentType: contentType },
          metadata: { sha256: sha256(value) },
          conditions: { ifNoneMatch: "*" }
        })
      } catch (error) {
        if (!isPreconditionFailure(error)) {
          throw error
        }
        const existing = await target.downloadToBuffer()
        if (sha256(existing) !== sha256(value)) {
          throw new Error(`Immutable Azure artifact ${this.#prefix}/${relativePath} already has different content`)
        }
      }
    }
    await uploadImmutable(blob, content, mediaType)
    await uploadImmutable(
      this.#container.getBlockBlobClient(`${this.#prefix}/${relativePath}.sha256`),
      Buffer.from(`${digest}\n`),
      "text/plain"
    )
    return this.#local.write(relativePath, content, mediaType)
  }

  async read(relativePathInput: string): Promise<Buffer> {
    const relativePath = BlobPathSchema.parse(relativePathInput)
    const blobName = `${this.#prefix}/${relativePath}`
    const [content, digestContent] = await Promise.all([
      this.#container.getBlockBlobClient(blobName).downloadToBuffer(),
      this.#container.getBlockBlobClient(`${blobName}.sha256`).downloadToBuffer()
    ])
    const expectedDigest = z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .parse(digestContent.toString("utf8").trim())
    if (sha256(content) !== expectedDigest) {
      throw new Error(`Azure artifact ${blobName} failed digest verification`)
    }
    return content
  }

  manifest(): ArtifactManifest {
    return this.#local.manifest()
  }

  async verify(relativePathInput: string): Promise<void> {
    const relativePath = BlobPathSchema.parse(relativePathInput)
    const expected = this.manifest().find((entry) => entry.relativePath === relativePath)
    if (expected === undefined) {
      throw new Error(`Artifact ${relativePath} is not in the local manifest`)
    }
    const content = await this.read(relativePath)
    if (sha256(content) !== expected.sha256) {
      throw new Error(`Azure artifact ${this.#prefix}/${relativePath} does not match the run manifest`)
    }
  }
}

export interface ArtifactStoreFactory {
  provider: "local" | "azure"
  assertReady(): Promise<void>
  forRun(runId: string, localRoot: string): ArtifactStorePort
}

export class LocalArtifactStoreFactory implements ArtifactStoreFactory {
  readonly provider = "local" as const

  async assertReady(): Promise<void> {}

  forRun(_runId: string, localRoot: string): ArtifactStorePort {
    return new ArtifactStore(localRoot)
  }
}

export class AzureBlobArtifactStoreFactory implements ArtifactStoreFactory {
  readonly provider = "azure" as const
  readonly #container: ContainerPort

  constructor(container: ContainerPort) {
    this.#container = container
  }

  static fromManagedIdentity(input: {
    accountUrl: string
    containerName: string
    managedIdentityClientId?: string
  }): AzureBlobArtifactStoreFactory {
    const credential = new DefaultAzureCredential(
      input.managedIdentityClientId === undefined ? {} : { managedIdentityClientId: input.managedIdentityClientId }
    )
    const service = new BlobServiceClient(z.url().parse(input.accountUrl), credential)
    const container: ContainerClient = service.getContainerClient(
      z
        .string()
        .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/u)
        .parse(input.containerName)
    )
    return new AzureBlobArtifactStoreFactory(container)
  }

  async assertReady(): Promise<void> {
    await this.#container.getProperties()
  }

  forRun(runId: string, localRoot: string): ArtifactStorePort {
    return new AzureBlobArtifactStore(localRoot, this.#container, `runs/${z.uuid().parse(runId)}`)
  }
}

export function createArtifactStoreFactory(environment: NodeJS.ProcessEnv): ArtifactStoreFactory {
  const provider = z.enum(["local", "azure"]).default("local").parse(environment.ARTIFACT_STORE_PROVIDER)
  if (provider === "local") {
    return new LocalArtifactStoreFactory()
  }
  return AzureBlobArtifactStoreFactory.fromManagedIdentity({
    accountUrl: z.url().parse(environment.AZURE_STORAGE_ACCOUNT_URL),
    containerName: z.string().min(1).parse(environment.AZURE_ARTIFACT_CONTAINER),
    ...(environment.AZURE_CLIENT_ID === undefined ? {} : { managedIdentityClientId: environment.AZURE_CLIENT_ID })
  })
}
