import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ArtifactStore } from "./artifacts"

describe("ArtifactStore", () => {
  it("writes nested binary artifacts and returns a sorted digest manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-artifacts-"))
    try {
      const store = new ArtifactStore(root)
      const binary = Uint8Array.from([0, 255, 1])

      await expect(store.write("z/data.bin", binary, "application/octet-stream")).resolves.toBe("z/data.bin")
      await store.write("a/result.txt", Buffer.from("result"), "text/plain")

      expect(await readFile(join(root, "z", "data.bin"))).toEqual(Buffer.from(binary))
      expect(store.manifest()).toEqual([
        {
          relativePath: "a/result.txt",
          mediaType: "text/plain",
          byteLength: 6,
          sha256: "f6a214f7a5fcda0c2cee9660b7fc29f5649e3c68aad48e20e950137c98913a68"
        },
        {
          relativePath: "z/data.bin",
          mediaType: "application/octet-stream",
          byteLength: 3,
          sha256: "47ffa3ea45a70b8a41c2c0825df323c00a8b7a01c1ea06083cc41dddcc001123"
        }
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
