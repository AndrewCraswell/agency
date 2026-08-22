import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import {
  createGoldenVectorExport,
  assertCurrentGoldenVectorExport,
  serializeGoldenVectorExport
} from "../dist/golden-vector-exporter.js"

const artifactUrl = new URL("../fixtures/golden-vector-export.json", import.meta.url)
const mode = process.argv[2] ?? "write"

if (mode !== "write" && mode !== "--check") {
  throw new Error("Usage: node scripts/export-golden-vectors.mjs [--check]")
}

if (mode === "--check") {
  const rawArtifact = readFileSync(artifactUrl, "utf8")
  const artifact = JSON.parse(rawArtifact)
  assertCurrentGoldenVectorExport(artifact)

  const expectedArtifact = serializeGoldenVectorExport(createGoldenVectorExport())

  if (rawArtifact !== expectedArtifact) {
    throw new Error("Stale golden-vector export bytes")
  }
} else {
  mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true })
  writeFileSync(artifactUrl, serializeGoldenVectorExport(createGoldenVectorExport()), "utf8")
}
