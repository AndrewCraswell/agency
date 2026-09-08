import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { packManifest, loadManifest } from "./bundle.ts"
import type { AdminClient } from "./client.ts"
import { createFileAdapter, localFile } from "./files.ts"

const directories: string[] = []
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "content-test-"))
  directories.push(directory)
  writeFileSync(join(directory, "guide.png"), "image fixture")
  return { directory, data: { filename: "guide.png", path: "guide.png", alt: "Measurement guide" } }
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("portable file resources", () => {
  it("uses content-addressed names and rejects files outside the manifest directory", () => {
    const { directory, data } = fixture()
    const initial = localFile(data, directory)
    expect(initial.filename).toMatch(/^guide-[a-f0-9]{16}\.png$/)
    writeFileSync(join(directory, "guide.png"), "changed")
    expect(localFile(data, directory).filename).not.toBe(initial.filename)
    const other = fixture()
    expect(() => localFile({ ...data, path: join(other.directory, "guide.png") }, directory)).toThrow("inside")
    writeFileSync(join(directory, "guide.png"), "")
    expect(() => localFile(data, directory)).toThrow("1 byte")
  })

  it("reuses a ready matching file and refuses ambiguous or unfinished files", async () => {
    const { directory, data } = fixture()
    const local = localFile(data, directory)
    const ready = { id: "file", fileStatus: "READY", image: { url: `https://cdn.shopify.com/${local.filename}` } }
    const client = vi
      .fn<AdminClient>()
      .mockResolvedValueOnce({ resources: { nodes: [ready], pageInfo: { hasNextPage: false } } })
      .mockResolvedValueOnce({ resources: { nodes: [ready, ready], pageInfo: { hasNextPage: false } } })
      .mockResolvedValueOnce({
        resources: { nodes: [{ ...ready, fileStatus: "PROCESSING" }], pageInfo: { hasNextPage: false } }
      })
    const adapter = createFileAdapter(client, directory)
    expect((await adapter.find(data))?.id).toBe("file")
    await expect(adapter.find(data)).rejects.toThrow("Multiple files")
    await expect(adapter.find(data)).rejects.toThrow("PROCESSING")
  })

  it("uploads through a staged target and waits for file readiness", async () => {
    const { directory, data } = fixture()
    const client = vi
      .fn<AdminClient>()
      .mockResolvedValueOnce({
        stagedUploadsCreate: {
          stagedTargets: [
            {
              url: "https://upload.example.com/",
              resourceUrl: "https://upload.example.com/result",
              parameters: [{ name: "key", value: "file-key" }]
            }
          ],
          userErrors: []
        }
      })
      .mockResolvedValueOnce({ fileCreate: { files: [{ id: "file", fileStatus: "PROCESSING" }], userErrors: [] } })
      .mockResolvedValueOnce({
        node: { id: "file", fileStatus: "READY", image: { url: "https://cdn.shopify.com/guide.png" } }
      })
    const upload = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 201 }))
    const adapter = createFileAdapter(client, directory, upload, async () => undefined)
    expect((await adapter.create(data)).id).toBe("file")
    expect(upload).toHaveBeenCalledOnce()
    expect(client.mock.calls[1]?.[1]).toMatchObject({ input: [{ duplicateResolutionMode: "RAISE_ERROR" }] })
  })

  it("builds a relocatable content bundle and refuses to overwrite an existing bundle", async () => {
    const { directory, data } = fixture()
    const manifestPath = join(directory, "source.json")
    writeFileSync(manifestPath, JSON.stringify({ name: "test", resources: [{ key: "image", kind: "file", data }] }))
    const output = join(directory, "bundle")
    const manifest = await loadManifest(await packManifest(manifestPath, output))
    const resource = manifest.manifest.resources[0]!
    expect(localFile(resource.data, manifest.directory).hash).toBe(localFile(data, directory).hash)
    await expect(packManifest(manifestPath, output)).rejects.toThrow("EEXIST")
  })
})
