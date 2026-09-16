import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { LocalArtifactStore } from "../documents/artifact-store.js"
import { crawlNcDocumentLibrary } from "./nc-document-library-crawl.js"

it("resumes retained folders, bounds requests, and terminates cycles", async () => {
  const root = await mkdtemp(join(tmpdir(), "nc-crawl-"))
  try {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(`<div id="folders"><button onclick="navigateToFolder(512, 2, 'child');">child</button></div>`)
      )
    const options = {
      siteId: "512",
      rootFolder: "1",
      store: new LocalArtifactStore(root),
      maxRequests: 1,
      maxFolders: 5,
      fetcher
    }
    const first = await crawlNcDocumentLibrary(options)
    expect(first.complete).toBe(false)
    expect(first.pendingFolders).toEqual(["2"])
    expect((await crawlNcDocumentLibrary(options)).complete).toBe(true)
    expect((await crawlNcDocumentLibrary(options)).requests).toBe(0)
    expect(fetcher).toHaveBeenCalledTimes(2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it("rejects malformed responses without checkpointing them", async () => {
  const store = {
    exists: async () => false,
    put: vi.fn<(path: string, bytes: Uint8Array) => Promise<boolean>>(),
    read: vi.fn<(path: string) => Promise<Uint8Array>>()
  }
  await expect(
    crawlNcDocumentLibrary({
      siteId: "512",
      rootFolder: "1",
      store,
      maxRequests: 1,
      maxFolders: 2,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response("login"))
    })
  ).rejects.toThrow(/missing/)
  expect(store.put).not.toHaveBeenCalled()
})
