import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { acquisitionUnitSchema } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, expect, it } from "vitest"
import { z } from "zod"
import { LocalArtifactStore } from "../documents/artifact-store.js"
import { regulatoryArtifactLocatorSchema } from "./durable-artifact.js"
import { materializeRegulatoryNormalizedBundle, retainRegulatoryNormalizedBundle } from "./durable-normalized-bundle.js"
import { parseRegulatoryArtifact, validateRegulatoryOutput } from "./parser-bridge.js"

const fixtures = fileURLToPath(new URL("./fixtures/", import.meta.url))
const provenance = z
  .array(z.object({ fixture: z.string(), fixtureHash: z.string(), sourceUnit: acquisitionUnitSchema }))
  .parse(JSON.parse(await readFile(join(fixtures, "provenance.json"), "utf8")))
const fixture = provenance.find((entry) => entry.fixture === "ecfr-title-1-excerpt.xml")
if (fixture === undefined) throw new Error("Missing eCFR bundle fixture")
const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function temporary(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  directories.push(directory)
  return directory
}

it("replays a complete immutable normalized parser generation on another worker", { timeout: 30_000 }, async () => {
  const parsed = await parseRegulatoryArtifact({
    unit: fixture.sourceUnit,
    artifactHash: fixture.fixtureHash,
    path: join(fixtures, fixture.fixture),
    outputRoot: await temporary("tabra-normalized-origin-")
  })
  const store = new LocalArtifactStore(await temporary("tabra-normalized-store-"))
  const retained = await retainRegulatoryNormalizedBundle(store, {
    directory: parsed.directory,
    generation: parsed.generation,
    sourceHash: fixture.fixtureHash,
    summary: parsed.summary
  })
  expect(regulatoryArtifactLocatorSchema.parse(retained.locator)).toMatchObject({
    kind: "normalized",
    extension: "json"
  })
  await rm(parsed.directory, { recursive: true })
  const replayed = await materializeRegulatoryNormalizedBundle(store, {
    locator: retained.locator,
    outputRoot: await temporary("tabra-normalized-replay-")
  })
  await expect(
    validateRegulatoryOutput(replayed.directory, fixture.sourceUnit, fixture.fixtureHash, parsed.summary.parserCodeHash)
  ).resolves.toEqual(parsed.summary)
})
