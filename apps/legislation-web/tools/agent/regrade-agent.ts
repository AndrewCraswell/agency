import { mkdir, readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { datasetSchema, digest, experimentSchema } from "../../src/modules/evaluations/contracts"
import { evaluationInputContract } from "../../src/modules/evaluations/evaluationInput"
import { evaluateResult } from "../../src/modules/evaluations/evaluators"
import {
  createStageJournal,
  durableCallCounter,
  withEvaluationLock,
  writeArtifact
} from "../../src/modules/evaluations/journal"
import { createEvalLangfuse, observeEval } from "../../src/modules/evaluations/langfuse"
import { caseResultSchema, createCallBudget } from "../../src/modules/evaluations/runner"

const { values } = parseArgs({
  options: { run: { type: "string" }, resume: { type: "string" }, execute: { type: "boolean", default: false } }
})
const promptSchema = z.object({ prompt: z.string(), version: z.number().int().positive() })
const sourceManifestSchema = z.object({
  runId: z.string(),
  config: experimentSchema,
  evaluatorPrompts: z.object({ judge: promptSchema, critic: promptSchema })
})

async function main() {
  if (!values.run || (values.resume && !values.execute)) {
    throw new Error(
      "Provide --run SOURCE and --execute to regrade; --resume GRADING_DIRECTORY continues a matching regrade."
    )
  }
  const source = path.resolve(values.run)
  const manifest = sourceManifestSchema.parse(JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8")))
  const dataset = datasetSchema.parse(JSON.parse(await readFile(path.join(source, "dataset.json"), "utf8")))
  const filenames = (await readdir(source)).filter((name) => name.endsWith(".result.json")).sort()
  const records = await Promise.all(
    filenames.map(async (file) => ({
      file,
      record: caseResultSchema.parse(JSON.parse(await readFile(path.join(source, file), "utf8")))
    }))
  )
  const implementation = await Promise.all(
    [
      "../../src/modules/evaluations/evaluators.ts",
      "../../src/modules/evaluations/evaluationInput.ts",
      "../../src/modules/evaluations/providerRecovery.ts",
      "../../src/modules/evaluations/journal.ts",
      "./regrade-agent.ts"
    ].map(async (file) => ({ file, hash: digest(await readFile(new URL(file, import.meta.url), "utf8")) }))
  )
  const identity = {
    sourceRun: manifest.runId,
    source,
    datasetHash: digest(dataset),
    outputs: records.map(({ file, record }) => ({ file, hash: digest(record) })),
    model: manifest.config.evaluatorModel,
    prompts: manifest.evaluatorPrompts,
    inputContract: evaluationInputContract,
    implementation
  }
  const identityHash = digest(identity)
  if (!values.execute) {
    process.stdout.write(
      `${JSON.stringify({ mode: "dry-run", candidateCalls: 0, savedOutputs: records.length, identityHash, inputContract: evaluationInputContract }, null, 2)}\n`
    )
    return
  }
  const directory = values.resume ?? path.join("tmp/agent-regrades", crypto.randomUUID())
  await mkdir(directory, { recursive: true })
  if (values.resume) {
    const saved = z
      .object({ identityHash: z.string() })
      .parse(JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8")))
    if (saved.identityHash !== identityHash) {
      throw new Error("Regrade inputs changed; use a new grading directory.")
    }
  } else {
    await writeArtifact(path.join(directory, "manifest.json"), {
      identityHash,
      ...identity,
      startedAt: new Date().toISOString()
    })
  }
  const langfuse = createEvalLangfuse(process.env)
  await langfuse.verifyProject()
  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.once("SIGINT", interrupt)
  const ledger = durableCallCounter(path.join(directory, "calls.jsonl"))
  const budget = createCallBudget(manifest.config.maximumModelCalls, manifest.config.maximumInputCharacters, ledger)
  const stages = createStageJournal(path.join(directory, "uploads"))
  const tracing = langfuse.startTracing()
  let scored = 0
  let ungradable = 0
  let pendingUploads = 0
  try {
    for (const { file, record } of records) {
      if (controller.signal.aborted || budget.blocked) {
        break
      }
      const item = dataset.cases.find((candidate) => candidate.id === record.caseId)
      if (!item || digest(item) !== record.caseHash) {
        throw new Error("Saved output does not match the frozen case.")
      }
      const unit = file.replace(".result.json", "")
      const observed = await observeEval(
        { sourceRun: manifest.runId, caseId: item.id },
        { purpose: "regrade", inputContract: evaluationInputContract, sourceRun: manifest.runId },
        () =>
          evaluateResult({
            item,
            result: { ...record, providerFailures: [] },
            modelId: manifest.config.evaluatorModel,
            apiKey: process.env.OPENROUTER_API_KEY,
            prompts: manifest.evaluatorPrompts,
            budget,
            signal: controller.signal,
            checkpointDirectory: path.join(directory, "stages", unit)
          })
      )
      const evaluation = observed.result
      await writeArtifact(path.join(directory, `${unit}.evaluation.json`), {
        ...evaluation,
        sourceRun: manifest.runId,
        sourceFile: file,
        sourceHash: digest(record)
      })
      if (evaluation.status === "scored") {
        scored++
      } else {
        ungradable++
      }
      if (evaluation.status === "scored") {
        const scores = ["correctness", "grounding", "completeness", "usefulness"] as const
        const originalUpload = z
          .object({ datasetItemId: z.string(), datasetVersion: z.string() })
          .parse(JSON.parse(await readFile(path.join(source, file.replace(".result.json", ".upload.json")), "utf8")))
        const upload = {
          ...originalUpload,
          runName: `regrade-${path.basename(directory)}-${unit}`,
          datasetName: dataset.name,
          traceId: observed.traceId,
          observationId: observed.observationId,
          output: evaluation,
          metadata: { inputContract: evaluationInputContract, sourceRun: manifest.runId },
          scores: scores.map((name) => ({
            name: `regrade-${name}`,
            value: evaluation.judge[name],
            detail: evaluation.judge.rationale
          }))
        }
        await writeArtifact(path.join(directory, `${unit}.upload.json`), upload)
        try {
          await stages.stage(`${unit}-observed`, { identity, scores: upload.scores }, z.boolean(), async () => {
            await langfuse.publishResult(upload)
            return true
          })
        } catch {
          pendingUploads++
        }
      }
    }
  } finally {
    process.removeListener("SIGINT", interrupt)
    await writeArtifact(path.join(directory, "summary.json"), {
      scored,
      ungradable,
      pendingUploads,
      planned: records.length,
      modelCalls: budget.used,
      candidateCalls: 0,
      budgetBlocked: budget.blocked,
      cancelled: controller.signal.aborted,
      releaseApproved: false
    })
    await tracing.shutdown()
  }
  process.stdout.write(
    `${JSON.stringify({ directory, scored, ungradable, pendingUploads, modelCalls: budget.used, candidateCalls: 0 })}\n`
  )
}

;(values.execute ? withEvaluationLock(main) : main()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Regrade failed")
  process.exitCode = 1
})
