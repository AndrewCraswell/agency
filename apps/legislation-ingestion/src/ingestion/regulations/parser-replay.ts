import { resolve } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import { z } from "zod"
import { replayRegulatoryBackfill } from "./backfill-plan.js"
import { parseRegulatoryArtifact, regulatoryParserCodeHash, validateRegulatoryOutput } from "./parser-bridge.js"
import { auditRetainedRegulatoryInputs } from "./retained-audit.js"

/** Ignore execution metadata only. Changed shard boundaries conservatively require review too. */
function comparableSummary(summary: z.infer<typeof regulatoryParseSummarySchema>) {
  const { parserCodeHash: _code, elapsedSeconds: _elapsed, expatVersion: _runtime, ...content } = summary
  return content
}

export async function replayRegulatoryParserBatch(input: {
  manifest: unknown
  locations: unknown
  outputRoot: string
  afterUnitKey?: string
  limit?: number
}) {
  const manifest = await replayRegulatoryBackfill(input.manifest)
  const limit = z
    .number()
    .int()
    .min(1)
    .max(5)
    .parse(input.limit ?? 5)
  const outputRoot = resolve(z.string().min(1).parse(input.outputRoot))
  let start = 0
  if (input.afterUnitKey !== undefined) {
    const index = manifest.units.findIndex((unit) => unit.key === input.afterUnitKey)
    if (index === -1) {
      throw new Error("Parser replay cursor does not belong to manifest")
    }
    start = index + 1
  }
  const selected = manifest.units.slice(start, start + limit)
  const parserCodeHash = await regulatoryParserCodeHash()
  const results = []
  const failures = []
  let nextUnitKey = input.afterUnitKey ?? null
  if (selected.length > 0) {
    const audit = await auditRetainedRegulatoryInputs({
      manifest,
      locations: input.locations,
      parserCodeHash,
      unitKeys: selected.map((unit) => unit.key)
    })
    if (audit.normalizedInventoryIssues.length > 0) {
      throw new Error("Parser replay requires resolution of normalized inventory issues")
    }
    for (const unit of selected) {
      try {
        const retained = audit.units.find((item) => item.unitKey === unit.key)
        if (
          retained === undefined ||
          retained.rawStatus !== "verified" ||
          retained.artifactHash === null ||
          retained.artifactPath === null ||
          retained.normalizedStatus === "invalid" ||
          retained.retainedGenerations.some((generation) => generation.status !== "verified")
        ) {
          throw new Error("Parser replay requires verified, unambiguous retained inputs")
        }
        const baselines = retained.retainedGenerations.map((generation) => ({
          directory: generation.directory,
          parserCodeHash: generation.parserCodeHash
        }))
        if (retained.normalizedDirectory !== null) {
          baselines.push({ directory: retained.normalizedDirectory, parserCodeHash })
        }
        if (baselines.length === 0) {
          throw new Error("Parser replay has no verified comparison baseline")
        }
        if ((await regulatoryParserCodeHash()) !== parserCodeHash) {
          throw new Error("Parser code changed during replay")
        }
        const parsed = await parseRegulatoryArtifact({
          unit,
          artifactHash: retained.artifactHash,
          path: retained.artifactPath,
          outputRoot
        })
        if (parsed.summary.parserCodeHash !== parserCodeHash || (await regulatoryParserCodeHash()) !== parserCodeHash) {
          throw new Error("Parser code changed during replay")
        }
        const current = comparableSummary(parsed.summary)
        const comparisons = []
        for (const baseline of baselines) {
          // Revalidate instead of trusting the earlier audit or a saved comparison receipt.
          const previous = comparableSummary(
            await validateRegulatoryOutput(baseline.directory, unit, retained.artifactHash, baseline.parserCodeHash)
          )
          const previousFields = new Map(Object.entries(previous))
          const changedFields = Object.entries(current)
            .filter(([key, value]) => !isDeepStrictEqual(previousFields.get(key), value))
            .map(([key]) => key)
          comparisons.push({
            ...baseline,
            previousDigest: digest(JSON.stringify(previous)),
            currentDigest: digest(JSON.stringify(current)),
            previousRecords: previous.records,
            currentRecords: current.records,
            changedFields,
            identical: changedFields.length === 0
          })
        }
        results.push({
          unitKey: unit.key,
          nativeId: unit.nativeId,
          artifactHash: retained.artifactHash,
          directory: parsed.directory,
          generation: parsed.generation,
          reused: parsed.reused,
          records: parsed.summary.records,
          comparisons,
          disposition: comparisons.every((comparison) => comparison.identical) ? "identical" : "review_required"
        })
        nextUnitKey = unit.key
      } catch (error) {
        failures.push({
          unitKey: unit.key,
          nativeId: unit.nativeId,
          error: error instanceof Error ? error.message.slice(0, 300) : "Parser replay failed"
        })
        break
      }
    }
  }
  return {
    manifestId: manifest.id,
    parserCodeHash,
    afterUnitKey: input.afterUnitKey ?? null,
    nextUnitKey,
    expectedUnits: manifest.units.length,
    selectedUnits: selected.length,
    results,
    failures,
    exhausted: failures.length === 0 && start + results.length === manifest.units.length,
    reviewRequired: results.some((result) => result.disposition === "review_required"),
    canonicalWrites: false,
    publicationReady: false,
    networkRequests: 0,
    embeddingsEnabled: false
  }
}
