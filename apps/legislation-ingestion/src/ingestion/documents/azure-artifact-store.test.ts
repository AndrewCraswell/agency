import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ArtifactNotFoundError, AzureBlobArtifactStore, LocalArtifactStore } from "./artifact-store.js"

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  construct: vi.fn(),
  container: vi.fn(),
  blob: vi.fn(),
  exists: vi.fn(async () => true),
  uploadData: vi.fn<(...arguments_: unknown[]) => Promise<void>>(),
  uploadFile: vi.fn<(...arguments_: unknown[]) => Promise<void>>(),
  downloadToBuffer: vi.fn(async () => Buffer.from("source")),
  downloadToFile: vi.fn<(path: string, ...arguments_: unknown[]) => Promise<void>>()
}))
vi.mock("@azure/storage-blob", () => {
  mocks.load()
  return {
    BlobServiceClient: class {
      constructor(url: string, credential: unknown) {
        mocks.construct(url, credential)
      }
      getContainerClient(name: string) {
        mocks.container(name)
        return {
          getBlockBlobClient(path: string) {
            mocks.blob(path)
            return {
              exists: mocks.exists,
              uploadData: mocks.uploadData,
              uploadFile: mocks.uploadFile,
              downloadToBuffer: mocks.downloadToBuffer,
              downloadToFile: mocks.downloadToFile
            }
          }
        }
      }
    }
  }
})
vi.mock("@azure/identity", () => {
  throw new Error("Artifact fixtures must not load the default credential chain")
})

const directories: string[] = []
async function temporary() {
  const directory = await mkdtemp(join(tmpdir(), "azure-artifact-fixture-"))
  directories.push(directory)
  return directory
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.uploadData.mockResolvedValue(undefined)
  mocks.uploadFile.mockResolvedValue(undefined)
  mocks.downloadToFile.mockImplementation(async (path) => {
    await writeFile(path, "downloaded")
  })
})
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("deferred Azure artifact storage", () => {
  it("keeps local operations cloud-free and initializes one Azure client on first valid use", async () => {
    const local = new LocalArtifactStore(await temporary())
    await local.put("source.xml", Buffer.from("local"))
    await expect(local.read("source.xml")).resolves.toEqual(new Uint8Array(Buffer.from("local")))
    const cloud = new AzureBlobArtifactStore("fixture", "documents")
    await expect(cloud.exists("../outside")).rejects.toThrow("Invalid blob artifact path")
    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.construct).not.toHaveBeenCalled()

    await expect(Promise.all([cloud.exists("\\source.xml"), cloud.read("source.xml")])).resolves.toEqual([
      true,
      new Uint8Array(Buffer.from("source"))
    ])
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(mocks.construct).toHaveBeenCalledExactlyOnceWith(
      "https://fixture.blob.core.windows.net",
      expect.objectContaining({ getToken: expect.any(Function) })
    )
    expect(mocks.container).toHaveBeenCalledExactlyOnceWith("documents")
    expect(mocks.blob.mock.calls).toEqual([["source.xml"], ["source.xml"]])
  })

  it("retains immutable upload conditions and propagates unexpected provider failures", async () => {
    const cloud = new AzureBlobArtifactStore("fixture", "documents")
    const bytes = Buffer.from("source")
    await expect(cloud.put("source.xml", bytes)).resolves.toBe(true)
    expect(mocks.uploadData).toHaveBeenCalledWith(bytes, { conditions: { ifNoneMatch: "*" } })
    mocks.uploadData.mockRejectedValueOnce({ statusCode: 412 })
    await expect(cloud.put("source.xml", bytes)).resolves.toBe(false)
    const failure = new Error("Provider unavailable")
    mocks.uploadData.mockRejectedValueOnce(failure)
    await expect(cloud.put("source.xml", bytes)).rejects.toBe(failure)
    mocks.downloadToBuffer.mockRejectedValueOnce({ statusCode: 404 })
    await expect(cloud.read("missing.xml")).rejects.toBeInstanceOf(ArtifactNotFoundError)
  })

  it("surfaces client initialization failures to concurrent callers", async () => {
    const failure = new Error("Invalid storage configuration")
    mocks.construct.mockImplementationOnce(() => {
      throw failure
    })
    const cloud = new AzureBlobArtifactStore("fixture", "documents")
    const results = await Promise.allSettled([cloud.exists("source.xml"), cloud.read("source.xml")])
    expect(results).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure }
    ])
    expect(mocks.construct).toHaveBeenCalledOnce()
  })

  it("preserves streamed file transfer and cleans temporary downloads after missing blobs", async () => {
    const directory = await temporary()
    const source = join(directory, "source.xml")
    const restored = join(directory, "restored.xml")
    await writeFile(source, "source")
    const cloud = new AzureBlobArtifactStore("fixture", "documents")
    await expect(cloud.putFile("source.xml", source)).resolves.toBe(true)
    expect(mocks.uploadFile).toHaveBeenCalledWith(source, { conditions: { ifNoneMatch: "*" } })
    mocks.uploadFile.mockRejectedValueOnce({ statusCode: 409 })
    await expect(cloud.putFile("source.xml", source)).resolves.toBe(false)
    await cloud.readToFile("source.xml", restored)
    await expect(readFile(restored, "utf8")).resolves.toBe("downloaded")
    expect(mocks.downloadToFile).toHaveBeenCalledWith(expect.any(String), 0, undefined, {
      conditions: { ifMatch: "*" }
    })
    mocks.downloadToFile.mockImplementationOnce(async (path) => {
      await writeFile(path, "partial")
      throw Object.assign(new Error("Blob not found"), { statusCode: 404 })
    })
    await expect(cloud.readToFile("missing.xml", join(directory, "missing.xml"))).rejects.toBeInstanceOf(
      ArtifactNotFoundError
    )
    expect((await readdir(directory)).toSorted()).toEqual(["restored.xml", "source.xml"])
  })
})
