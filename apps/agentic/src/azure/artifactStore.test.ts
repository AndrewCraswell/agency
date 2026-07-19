import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sha256 } from "../prototype/context"
import {
  AzureBlobArtifactStore,
  AzureBlobArtifactStoreFactory,
  LocalArtifactStoreFactory,
  createArtifactStoreFactory
} from "./artifactStore"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("AzureBlobArtifactStore", () => {
  it("uploads immutable content and retains an ephemeral local mirror", async () => {
    const root = await mkdtemp(join(tmpdir(), "azure-artifacts-"))
    roots.push(root)
    const blobs = new Map<string, Buffer>()
    const container = {
      getBlockBlobClient: vi.fn((blobName: string) => ({
        uploadData: vi.fn(async (content: Uint8Array) => {
          blobs.set(blobName, Buffer.from(content))
        }),
        downloadToBuffer: vi.fn(async () => blobs.get(blobName) ?? Buffer.alloc(0))
      })),
      getProperties: vi.fn(async () => ({}))
    }
    const store = new AzureBlobArtifactStore(root, container, "runs/run-1")

    await expect(store.write("validation/test.log", Buffer.from("evidence"), "text/plain")).resolves.toBe(
      "validation/test.log"
    )
    await expect(readFile(join(root, "validation", "test.log"), "utf8")).resolves.toBe("evidence")
    expect(container.getBlockBlobClient).toHaveBeenCalledWith("runs/run-1/validation/test.log")
    expect(blobs.get("runs/run-1/validation/test.log")).toEqual(Buffer.from("evidence"))
    expect(blobs.get("runs/run-1/validation/test.log.sha256")?.toString("utf8")).toMatch(/^[0-9a-f]{64}\n$/u)
    await expect(store.read("validation/test.log")).resolves.toEqual(Buffer.from("evidence"))
    await expect(store.verify("validation/test.log")).resolves.toBeUndefined()
  })

  it("accepts an idempotent immutable upload and rejects different existing content", async () => {
    const root = await mkdtemp(join(tmpdir(), "azure-artifacts-"))
    roots.push(root)
    const blobs = new Map<string, Buffer>([
      ["runs/run-1/result.txt", Buffer.from("same")],
      ["runs/run-1/result.txt.sha256", Buffer.from(`${sha256(Buffer.from("same"))}\n`)]
    ])
    const container = {
      getBlockBlobClient: (blobName: string) => ({
        uploadData: vi.fn(async () => Promise.reject({ statusCode: 412 })),
        downloadToBuffer: vi.fn(async () => blobs.get(blobName) ?? Buffer.alloc(0))
      }),
      getProperties: vi.fn(async () => ({}))
    }
    const store = new AzureBlobArtifactStore(root, container, "runs/run-1")

    await expect(store.write("result.txt", Buffer.from("same"), "text/plain")).resolves.toBe("result.txt")
    await expect(store.write("result.txt", Buffer.from("different"), "text/plain")).rejects.toThrow(
      "already has different content"
    )
  })

  it("rejects failed uploads, unsafe paths, corrupt digests, and unknown manifest entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "azure-artifacts-"))
    roots.push(root)
    const blobs = new Map<string, Buffer>([
      ["runs/run-1/corrupt.txt", Buffer.from("content")],
      ["runs/run-1/corrupt.txt.sha256", Buffer.from("0".repeat(64))]
    ])
    const uploadFailure = new Error("upload failed")
    const container = {
      getBlockBlobClient: (blobName: string) => ({
        uploadData: vi.fn(async () => Promise.reject(uploadFailure)),
        downloadToBuffer: vi.fn(async () => blobs.get(blobName) ?? Buffer.alloc(0))
      }),
      getProperties: vi.fn(async () => ({}))
    }
    const store = new AzureBlobArtifactStore(root, container, "runs/run-1")

    await expect(store.write("result.txt", Buffer.from("content"), "text/plain")).rejects.toThrow("upload failed")
    await expect(store.write("../result.txt", Buffer.from("content"), "text/plain")).rejects.toThrow()
    await expect(store.read("corrupt.txt")).rejects.toThrow("failed digest verification")
    await expect(store.verify("missing.txt")).rejects.toThrow("not in the local manifest")
    expect(() => new AzureBlobArtifactStore(root, container, "../unsafe")).toThrow()
  })
})

describe("artifact store factories", () => {
  it("creates ready local stores and validates provider selection", async () => {
    const root = await mkdtemp(join(tmpdir(), "local-artifacts-"))
    roots.push(root)
    const local = new LocalArtifactStoreFactory()

    await expect(local.assertReady()).resolves.toBeUndefined()
    await expect(local.forRun("run-1", root).write("result.txt", Buffer.from("ok"), "text/plain")).resolves.toBe(
      "result.txt"
    )
    expect(createArtifactStoreFactory({}).provider).toBe("local")
    expect(() => createArtifactStoreFactory({ ARTIFACT_STORE_PROVIDER: "unsupported" })).toThrow()
  })

  it("checks Azure container readiness and scopes stores to a UUID run", async () => {
    const container = {
      getBlockBlobClient: vi.fn(() => ({
        uploadData: vi.fn(async () => undefined),
        downloadToBuffer: vi.fn(async () => Buffer.alloc(0))
      })),
      getProperties: vi.fn(async () => ({}))
    }
    const factory = new AzureBlobArtifactStoreFactory(container)

    await expect(factory.assertReady()).resolves.toBeUndefined()
    expect(container.getProperties).toHaveBeenCalledOnce()
    expect(() => factory.forRun("not-a-uuid", "artifacts")).toThrow()
    expect(
      AzureBlobArtifactStoreFactory.fromManagedIdentity({
        accountUrl: "https://example.blob.core.windows.net",
        containerName: "artifacts",
        managedIdentityClientId: "client-id"
      }).provider
    ).toBe("azure")
  })
})
