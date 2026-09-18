import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, describe, expect, it } from "vitest"
import { LocalArtifactStore } from "../documents/artifact-store.js"
import {
  materializeRegulatoryArtifact,
  regulatoryArtifactLocator,
  regulatoryArtifactLocatorSchema,
  retainRegulatoryArtifact
} from "./durable-artifact.js"

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("durable regulatory artifacts", () => {
  it("streams, replays and revalidates a content-addressed source artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "regulatory-store-"))
    const scratch = await mkdtemp(join(tmpdir(), "regulatory-scratch-"))
    directories.push(root, scratch)
    const source = join(scratch, "source.xml")
    const restored = join(scratch, "restored.xml")
    const body = Buffer.from("<FEDREG>retained</FEDREG>")
    await writeFile(source, body)
    const store = new LocalArtifactStore(root)
    const retained = await retainRegulatoryArtifact(store, {
      kind: "source",
      hash: digest(body),
      bytes: body.length,
      extension: "xml",
      localPath: source
    })
    expect(retained.created).toBe(true)
    await expect(
      retainRegulatoryArtifact(store, { ...retained, kind: "source", extension: "xml", localPath: source })
    ).resolves.toMatchObject({
      created: false
    })
    await expect(
      materializeRegulatoryArtifact(store, {
        locator: retained.locator,
        hash: retained.hash,
        bytes: retained.bytes,
        localPath: restored
      })
    ).resolves.toMatchObject({ kind: "source", localPath: restored })
    await expect(readFile(restored)).resolves.toEqual(body)
  })

  it("rejects locator traversal, hash mismatches and corrupted retained collisions", async () => {
    expect(() => regulatoryArtifactLocatorSchema.parse("regulatory-artifact://source/aa/../file")).toThrow()
    expect(() => regulatoryArtifactLocator("source", "bad", "xml")).toThrow()
    const root = await mkdtemp(join(tmpdir(), "regulatory-store-"))
    const scratch = await mkdtemp(join(tmpdir(), "regulatory-scratch-"))
    directories.push(root, scratch)
    const source = join(scratch, "source.xml")
    await writeFile(source, "expected")
    const hash = digest("expected")
    const locator = regulatoryArtifactLocatorSchema.parse(regulatoryArtifactLocator("source", hash, "xml"))
    await mkdir(dirname(join(root, locator.path)), { recursive: true })
    await writeFile(join(root, locator.path), "corrupt", { flag: "wx" })
    await expect(
      retainRegulatoryArtifact(new LocalArtifactStore(root), {
        kind: "source",
        hash,
        bytes: Buffer.byteLength("expected"),
        extension: "xml",
        localPath: source
      })
    ).rejects.toThrow("regulatory_artifact_immutable_conflict")
  })
})
