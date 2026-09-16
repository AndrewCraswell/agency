import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { digest } from "../../src/app/evals/contracts"

const resultSchema = z.object({
  caseId: z.string(),
  family: z.string(),
  candidateId: z.string(),
  repeat: z.number(),
  status: z.string(),
  turns: z.array(z.object({ durationMs: z.number() })),
  scores: z.array(z.object({ name: z.string(), value: z.number().nullable() })),
  fixtureGaps: z.array(z.unknown())
})
const evaluationSchema = z.object({
  status: z.string(),
  judge: z
    .object({
      applicability: z.string(),
      criticalFailure: z.boolean().nullable(),
      correctness: z.number().nullable(),
      grounding: z.number().nullable(),
      completeness: z.number().nullable()
    })
    .optional()
})

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { cohorts: { type: "string" } } })
  const cohorts = values.cohorts
    ? z
        .array(z.object({ directory: z.string(), caseIds: z.array(z.string()).min(1), reason: z.string().min(1) }))
        .min(1)
        .parse(JSON.parse(await readFile(values.cohorts, "utf8")))
    : undefined
  if (cohorts && positionals.length) {
    throw new Error("Use either --cohorts or positional run directories.")
  }
  const directories = cohorts?.map((cohort) => cohort.directory) ?? positionals
  if (new Set(directories).size !== directories.length) {
    throw new Error("Run directories must be unique.")
  }
  function selectCases(source: string, cases: { id: string }[]) {
    const selected = cohorts?.find((cohort) => cohort.directory === source)?.caseIds
    if (!selected) {
      return cases
    }
    if (new Set(selected).size !== selected.length || selected.some((id) => !cases.some((item) => item.id === id))) {
      throw new Error("Cohort IDs must be distinct and present in the source manifest.")
    }
    return cases.filter((item) => selected.includes(item.id))
  }
  const directory = directories[0]
  if (!directory) {
    throw new Error("Provide a frozen experiment run directory")
  }
  const manifest = z
    .object({
      runId: z.string(),
      config: z.object({
        repeats: z.number(),
        candidates: z.array(z.object({ id: z.string(), model: z.string(), promptVersion: z.number() }))
      }),
      caseHashes: z.array(z.object({ id: z.string() }))
    })
    .parse(JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")))
  manifest.caseHashes = selectCases(directory, manifest.caseHashes)
  const sourceRuns = [manifest.runId]
  const comparisonManifestSchema = z.object({
    runId: z.string(),
    config: z.unknown(),
    prompts: z.unknown(),
    evaluatorPrompts: z.unknown(),
    datasetHash: z.string(),
    limits: z.unknown(),
    sources: z.unknown(),
    inputContract: z.string().optional(),
    caseHashes: z.array(z.object({ id: z.string() }))
  })
  const referenceManifest = comparisonManifestSchema.parse(
    JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"))
  )
  const sourceCodeHashes = [digest(referenceManifest.sources)]
  const signatures = (value: z.infer<typeof comparisonManifestSchema>) =>
    digest({
      config: value.config,
      prompts: value.prompts,
      evaluatorPrompts: value.evaluatorPrompts,
      datasetHash: value.datasetHash,
      limits: value.limits,
      inputContract: value.inputContract ?? "original-reference-payload"
    })
  const caseIds = new Set(manifest.caseHashes.map((item) => item.id))
  for (const otherDirectory of directories.slice(1)) {
    const other = comparisonManifestSchema.parse(
      JSON.parse(await readFile(path.join(otherDirectory, "manifest.json"), "utf8"))
    )
    sourceCodeHashes.push(digest(other.sources))
    if (signatures(referenceManifest) !== signatures(other)) {
      throw new Error("Cannot combine different dataset, prompt, model, evaluator or limit configurations.")
    }
    const cases = selectCases(otherDirectory, other.caseHashes)
    for (const item of cases) {
      if (caseIds.has(item.id)) {
        throw new Error("Cannot combine overlapping case cohorts; choose explicit non-overlapping segments.")
      }
      caseIds.add(item.id)
      manifest.caseHashes.push(item)
    }
    sourceRuns.push(z.string().parse(other.runId))
  }
  const rows: {
    caseId: string
    family: string
    candidateId: string
    repeat: number
    gradable: boolean
    contractFailures: string[]
    fixtureGaps: number
    durationMs: number
    screeningPass: boolean | null
    criticalFlag: boolean | null
  }[] = []
  for (const sourceDirectory of directories) {
    for (const file of (await readdir(sourceDirectory)).filter((name) => name.endsWith(".result.json"))) {
      const result = resultSchema.parse(JSON.parse(await readFile(path.join(sourceDirectory, file), "utf8")))
      const selected = cohorts?.find((cohort) => cohort.directory === sourceDirectory)?.caseIds
      if (selected && !selected.includes(result.caseId)) {
        continue
      }
      if (
        !caseIds.has(result.caseId) ||
        rows.some(
          (row) =>
            row.caseId === result.caseId && row.candidateId === result.candidateId && row.repeat === result.repeat
        )
      ) {
        throw new Error("Unexpected or duplicate comparison outcome.")
      }
      let evaluation: z.infer<typeof evaluationSchema> | undefined
      try {
        evaluation = evaluationSchema.parse(
          JSON.parse(
            await readFile(path.join(sourceDirectory, file.replace(".result.json", ".evaluation.json")), "utf8")
          )
        )
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error
        }
      }
      const judge =
        evaluation?.status === "scored" && evaluation.judge?.applicability === "gradable" ? evaluation.judge : undefined
      const gradable = result.status !== "ungradable" && judge !== undefined
      const contractFailures = result.scores.filter((score) => score.value === 0).map((score) => score.name)
      const semanticPass =
        judge !== undefined &&
        judge.criticalFailure === false &&
        [judge.correctness, judge.grounding, judge.completeness].every((score) => score === null || score >= 3)
      rows.push({
        caseId: result.caseId,
        family: result.family,
        candidateId: result.candidateId,
        repeat: result.repeat,
        gradable,
        contractFailures,
        fixtureGaps: result.fixtureGaps.length,
        durationMs: result.turns.reduce((sum, turn) => sum + turn.durationMs, 0),
        screeningPass: gradable ? result.status === "completed" && semanticPass && contractFailures.length === 0 : null,
        criticalFlag: judge?.criticalFailure ?? null
      })
    }
  }
  const summary = manifest.config.candidates.map((candidate) => {
    const selected = rows.filter((row) => row.candidateId === candidate.id)
    const planned = manifest.caseHashes.length * manifest.config.repeats
    return {
      ...candidate,
      planned,
      saved: selected.length,
      missing: planned - selected.length,
      ungradable: selected.filter((row) => !row.gradable).length,
      screeningPasses: selected.filter((row) => row.screeningPass === true).length,
      contractFailures: selected.filter((row) => row.contractFailures.length).length,
      criticalFlags: selected.filter((row) => row.criticalFlag).length,
      fixtureGaps: selected.filter((row) => row.fixtureGaps).length,
      meanLatencyMs: selected.length
        ? Math.round(selected.reduce((sum, row) => sum + row.durationMs, 0) / selected.length)
        : null
    }
  })
  const pairs = manifest.config.candidates
    .filter((candidate) => candidate.id !== "baseline")
    .map((candidate) => {
      const deltas: { family: string; delta: number }[] = []
      let wins = 0
      let losses = 0
      let ties = 0
      for (const baseline of rows.filter((row) => row.candidateId === "baseline")) {
        const comparison = rows.find(
          (row) => row.candidateId === candidate.id && row.caseId === baseline.caseId && row.repeat === baseline.repeat
        )
        if (baseline.screeningPass === null || comparison?.screeningPass === null || !comparison) {
          continue
        }
        const delta = Number(comparison.screeningPass) - Number(baseline.screeningPass)
        deltas.push({ family: baseline.family, delta })
        if (delta > 0) {
          wins++
        } else if (delta < 0) {
          losses++
        } else {
          ties++
        }
      }
      const families = [...new Set(deltas.map((entry) => entry.family))]
      let seed = 20260915
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296
        return seed / 4294967296
      }
      const samples: number[] = []
      if (families.length) {
        for (let draw = 0; draw < 2000; draw++) {
          const sampled = Array.from(
            { length: families.length },
            () => families[Math.floor(random() * families.length)]
          ).flatMap((family) => deltas.filter((entry) => entry.family === family))
          samples.push(sampled.reduce((sum, entry) => sum + entry.delta, 0) / sampled.length)
        }
        samples.sort((left, right) => left - right)
      }
      return {
        candidate: candidate.id,
        pairedGradableUnits: deltas.length,
        excludedOrMissingPairs: manifest.caseHashes.length * manifest.config.repeats - deltas.length,
        independentFamilies: families.length,
        wins,
        losses,
        ties,
        screeningDelta: deltas.length ? (wins - losses) / deltas.length : null,
        exploratoryFamilyBootstrap95: samples.length ? [samples[49], samples[1949]] : null
      }
    })
  const report = {
    runId: manifest.runId,
    sourceRuns,
    cohorts,
    sourceCodeDrift: new Set(sourceCodeHashes).size > 1,
    label:
      "Exploratory judge-plus-contract screening; not human-confirmed success, not representative, no promotion inference. Paired estimates condition on gradable pairs; exclusions may bias them.",
    releaseApproved: false,
    summary,
    pairs,
    rows
  }
  const reportName = directories.length > 1 ? "combined-comparison.json" : "comparison.json"
  await writeFile(path.join(directory, reportName), JSON.stringify(report, null, 2), { flag: "wx" })
  process.stdout.write(`${JSON.stringify({ runId: report.runId, summary, pairs, releaseApproved: false }, null, 2)}\n`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Comparison failed")
  process.exitCode = 1
})
