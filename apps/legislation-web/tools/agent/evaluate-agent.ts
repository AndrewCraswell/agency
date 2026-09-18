import { execFileSync } from "node:child_process"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { createResearchModel, researchAgentLimits } from "../../src/modules/conversations/agent"
import { getResearchPrompt } from "../../src/modules/conversations/prompt"
import {
  assertSafeArtifact,
  datasetSchema,
  digest,
  experimentSchema,
  type EvalScore
} from "../../src/modules/evaluations/contracts"
import { evaluationInputContract } from "../../src/modules/evaluations/evaluationInput"
import { criticInstructions, evaluateResult, judgeInstructions } from "../../src/modules/evaluations/evaluators"
import {
  CheckpointMismatch,
  createStageJournal,
  durableCallCounter,
  withEvaluationLock,
  writeArtifact
} from "../../src/modules/evaluations/journal"
import { createEvalLangfuse, observeEval } from "../../src/modules/evaluations/langfuse"
import { createCallBudget, executeCase } from "../../src/modules/evaluations/runner"
import { caseResultSchema } from "../../src/modules/evaluations/runner"
import { smokeDataset } from "../../src/modules/evaluations/smoke"

const { values } = parseArgs({
  options: {
    execute: { type: "boolean", default: false },
    resume: { type: "string" },
    judge: { type: "boolean", default: false },
    sync: { type: "boolean", default: false },
    upload: { type: "string" },
    report: { type: "string" },
    config: { type: "string", default: "evals/agent-experiment.json" },
    dataset: { type: "string" },
    "langfuse-dataset": { type: "string" },
    case: { type: "string" },
    output: { type: "string", default: "tmp/agent-evaluations" }
  }
})

async function save(file: string, value: unknown) {
  assertSafeArtifact(value)
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}

const runContract = "checkpointed-evaluation"
const promptSnapshotSchema = z.object({
  name: z.string(),
  version: z.number().int().positive(),
  prompt: z.string().min(1)
})
const frozenManifestSchema = z.object({
  runId: z.string(),
  runContract: z.literal(runContract),
  inputContract: z.literal(evaluationInputContract),
  config: experimentSchema,
  datasetHash: z.string(),
  datasetVersion: z.string(),
  caseHashes: z.array(z.object({ id: z.string(), hash: z.string() })),
  sources: z.array(z.object({ file: z.string(), hash: z.string() })),
  limits: z.unknown(),
  prompts: z.array(z.object({ name: z.string(), version: z.number(), hash: z.string() })),
  synced: z.object({ ids: z.record(z.string(), z.string()), timestamp: z.string() }),
  evaluatorPrompts: z.object({ judge: promptSnapshotSchema, critic: promptSnapshotSchema }).optional()
})
const candidateCheckpointSchema = z.object({ result: caseResultSchema, traceId: z.string(), observationId: z.string() })

function print(value: unknown) {
  process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)
}

const scoreSchema = z.object({ name: z.string(), value: z.number().nullable(), detail: z.string() })
const uploadSchema = z.object({
  runName: z.string(),
  datasetName: z.string(),
  datasetItemId: z.string(),
  datasetVersion: z.string(),
  traceId: z.string(),
  observationId: z.string(),
  output: z.json(),
  metadata: z.record(z.string(), z.unknown()),
  scores: z.array(scoreSchema)
})

async function main() {
  if ([values.execute, values.sync, values.upload, values.report, values.resume].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --execute, --sync, --upload, --report or --resume.")
  }
  if (
    values.resume &&
    (values.dataset ||
      values["langfuse-dataset"] ||
      values.case ||
      values.judge ||
      values.config !== "evals/agent-experiment.json")
  ) {
    throw new Error("Resume uses its frozen manifest; do not supply dataset, case, judge or config overrides.")
  }
  if (values.report) {
    const manifest = z
      .object({
        config: experimentSchema,
        caseHashes: z.array(z.object({ id: z.string(), hash: z.string() }))
      })
      .parse(JSON.parse(await readFile(path.join(values.report, "manifest.json"), "utf8")))
    const files = (await readdir(values.report)).filter((name) => name.endsWith(".result.json"))
    const rows = []
    for (const file of files) {
      const result = z
        .object({
          candidateId: z.string(),
          caseId: z.string(),
          repeat: z.number(),
          status: z.string(),
          scores: z.array(scoreSchema),
          humanOutcome: z.string()
        })
        .parse(JSON.parse(await readFile(path.join(values.report, file), "utf8")))
      rows.push({
        candidate: result.candidateId,
        case: result.caseId,
        repeat: result.repeat,
        status: result.status,
        contractFailures: result.scores.filter((score) => score.value === 0).map((score) => score.name),
        humanOutcome: result.humanOutcome
      })
    }
    const missing = []
    for (const candidate of manifest.config.candidates) {
      for (const item of manifest.caseHashes) {
        for (let repeat = 0; repeat < manifest.config.repeats; repeat++) {
          if (!rows.some((row) => row.candidate === candidate.id && row.case === item.id && row.repeat === repeat)) {
            missing.push({ candidate: candidate.id, case: item.id, repeat, status: "not-executed" })
          }
        }
      }
    }
    print(
      JSON.stringify(
        {
          releaseApproved: false,
          note: "Diagnostic per-case comparison only. No human-confirmed quality estimate or promotion inference.",
          planned: manifest.config.candidates.length * manifest.caseHashes.length * manifest.config.repeats,
          unresolved: missing.length + rows.filter((row) => row.status === "ungradable").length,
          rows,
          missing
        },
        null,
        2
      )
    )
    return
  }
  if (values.upload) {
    const langfuse = createEvalLangfuse(process.env)
    await langfuse.verifyProject()
    const tracing = langfuse.startTracing()
    try {
      for (const name of (await readdir(values.upload)).filter((entry) => entry.endsWith(".upload.json"))) {
        await langfuse.publishResult(
          uploadSchema.parse(JSON.parse(await readFile(path.join(values.upload, name), "utf8")))
        )
      }
    } finally {
      await tracing.shutdown()
    }
    print("Stored experiment links and scores uploaded without repeating inference.")
    return
  }
  const frozen = values.resume
    ? frozenManifestSchema.parse(JSON.parse(await readFile(path.join(values.resume, "manifest.json"), "utf8")))
    : undefined
  let dataset = smokeDataset
  if (values.dataset && values["langfuse-dataset"]) {
    throw new Error("Choose a local dataset or a Langfuse dataset, not both.")
  }
  let hosted: Awaited<ReturnType<ReturnType<typeof createEvalLangfuse>["loadDataset"]>> | undefined
  if (values["langfuse-dataset"]) {
    const client = createEvalLangfuse(process.env)
    await client.verifyProject()
    hosted = await client.loadDataset(values["langfuse-dataset"])
    dataset = hosted.dataset
  }
  if (values.resume) {
    dataset = datasetSchema.parse(JSON.parse(await readFile(path.join(values.resume, "dataset.json"), "utf8")))
  } else if (values.dataset) {
    dataset = datasetSchema.parse(JSON.parse(await readFile(values.dataset, "utf8")))
  }
  assertSafeArtifact(dataset)
  const selectedIds = values.case?.split(",")
  const cases = dataset.cases.filter((item) => selectedIds === undefined || selectedIds.includes(item.id))
  if (!cases.length) {
    throw new Error("No matching evaluation cases.")
  }
  const config = frozen?.config ?? experimentSchema.parse(JSON.parse(await readFile(values.config, "utf8")))
  if (values.judge) {
    config.evaluate = true
  }
  if (!config.allowDrafts && cases.some((item) => item.review !== "reviewed")) {
    throw new Error("Draft cases require allowDrafts; they never support release approval.")
  }
  if (!values.execute && !values.sync && !values.resume) {
    print(
      JSON.stringify(
        {
          mode: "dry-run",
          dataset: dataset.name,
          datasetHash: digest(dataset),
          cases: cases.map((item) => item.id),
          candidates: config.candidates,
          plannedTasks: cases.length * config.candidates.length * config.repeats,
          maximumModelCalls: config.maximumModelCalls,
          evaluate: config.evaluate,
          releaseApproved: false
        },
        null,
        2
      )
    )
    return
  }
  const langfuse = createEvalLangfuse(process.env)
  await langfuse.verifyProject()
  const synced = frozen?.synced ?? hosted?.synced ?? (await langfuse.syncDataset(dataset.name, cases))
  if (values.sync) {
    await langfuse.publishEvaluatorPrompts({
      "legislative-research-judge": judgeInstructions,
      "legislative-research-critic": criticInstructions
    })
    print(
      JSON.stringify({
        dataset: dataset.name,
        cases: cases.length,
        datasetVersion: synced.timestamp,
        inferenceCalls: 0
      })
    )
    return
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required.")
  }
  const controller = new AbortController()
  process.once("SIGINT", () => controller.abort())
  let evaluatorPrompts = frozen?.evaluatorPrompts
  if (!frozen && config.evaluate) {
    evaluatorPrompts = await langfuse.getEvaluatorPrompts()
  }
  const prompts = new Map<number, Awaited<ReturnType<typeof getResearchPrompt>>>()
  if (values.resume) {
    const saved = z
      .array(
        promptSnapshotSchema.extend({
          name: z.literal("legislative-research"),
          type: z.literal("text"),
          labels: z.array(z.string())
        })
      )
      .parse(JSON.parse(await readFile(path.join(values.resume, "prompts.json"), "utf8")))
    for (const prompt of saved) {
      prompts.set(prompt.version, prompt)
    }
  }
  for (const candidate of config.candidates) {
    if (!prompts.has(candidate.promptVersion)) {
      if (frozen) {
        throw new Error("Frozen prompt snapshot missing; resume aborted.")
      }
      prompts.set(
        candidate.promptVersion,
        await getResearchPrompt(process.env, controller.signal, candidate.promptVersion)
      )
    }
  }
  const runId = frozen?.runId ?? crypto.randomUUID()
  const directory = values.resume ?? path.join(values.output, runId)
  await mkdir(directory, { recursive: true })
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const trackedDiff = execFileSync(
    "git",
    ["-C", root, "diff", "HEAD", "--", "apps/legislation-web", "packages/legislation-core"],
    {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024
    }
  )
  const sourceFiles = execFileSync(
    "git",
    [
      "-C",
      root,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps/legislation-web/src",
      "apps/legislation-web/tools/agent/evaluate-agent.ts",
      "packages/legislation-core/src"
    ],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
  const sources = await Promise.all(
    [...new Set(sourceFiles)].map(async (file) => ({
      file,
      hash: digest(await readFile(path.join(root, file), "utf8"))
    }))
  )
  const manifest = {
    runId,
    runContract,
    inputContract: evaluationInputContract,
    synced,
    startedAt: new Date().toISOString(),
    revision,
    dirtyDiffHash: digest(trackedDiff),
    sources,
    config,
    datasetHash: digest({ ...dataset, cases }),
    datasetVersion: synced.timestamp,
    caseHashes: cases.map((item) => ({ id: item.id, hash: digest(item) })),
    prompts: [...prompts.values()].map((prompt) => ({
      name: prompt.name,
      version: prompt.version,
      hash: digest(prompt.prompt)
    })),
    limits: researchAgentLimits,
    judgeHash: digest(judgeInstructions),
    criticHash: digest(criticInstructions),
    evaluatorPrompts,
    releaseApproved: false
  }
  if (frozen) {
    if (
      digest(frozen.sources) !== digest(sources) ||
      frozen.datasetHash !== manifest.datasetHash ||
      digest(frozen.prompts) !== digest(manifest.prompts) ||
      digest(frozen.limits) !== digest(researchAgentLimits)
    ) {
      throw new Error("Frozen run inputs or source code changed; start a new run rather than mixing results.")
    }
  } else {
    await save(path.join(directory, "manifest.json"), manifest)
    await save(path.join(directory, "dataset.json"), { ...dataset, cases })
    await save(path.join(directory, "prompts.json"), [...prompts.values()])
  }
  const ledger = durableCallCounter(path.join(directory, "calls.jsonl"))
  const budget = createCallBudget(config.maximumModelCalls, config.maximumInputCharacters, ledger)
  const journal = createStageJournal(path.join(directory, "stages"))
  const tracing = langfuse.startTracing()
  let completed = 0
  let pendingUploads = 0
  try {
    for (let repeat = 0; repeat < config.repeats; repeat++) {
      for (const item of cases) {
        const candidates = [...config.candidates].sort((left, right) =>
          digest({ runId, repeat, caseId: item.id, candidate: left.id }).localeCompare(
            digest({ runId, repeat, caseId: item.id, candidate: right.id })
          )
        )
        for (const candidate of candidates) {
          if (controller.signal.aborted || budget.blocked) {
            break
          }
          const prompt = prompts.get(candidate.promptVersion)
          if (!prompt) {
            throw new Error("Pinned prompt missing.")
          }
          const unitId = `${candidate.id}-${item.id}-${repeat}`
          const observed = await journal.stage(
            `${unitId}-candidate`,
            { caseHash: digest(item), candidate, promptHash: digest(prompt.prompt), sources },
            candidateCheckpointSchema,
            () =>
              observeEval(
                { messages: item.messages, followUps: item.followUps },
                {
                  runId,
                  caseId: item.id,
                  candidateId: candidate.id,
                  repeat,
                  promptName: prompt.name,
                  promptVersion: prompt.version,
                  model: candidate.model,
                  review: item.review
                },
                (sessionId) =>
                  executeCase({
                    item,
                    sessionId,
                    model: createResearchModel(process.env.OPENROUTER_API_KEY, candidate.model, {
                      ...candidate,
                      reasoning: candidate.reasoning === undefined ? { effort: "low" } : candidate.reasoning
                    }),
                    instructions: prompt.prompt,
                    budget,
                    signal: controller.signal
                  })
              ),
            true
          )
          const record = {
            ...observed.result,
            candidateId: candidate.id,
            repeat,
            traceId: observed.traceId,
            observationId: observed.observationId
          }
          await writeArtifact(path.join(directory, `${unitId}.result.json`), record)
          const scores: EvalScore[] = record.status === "ungradable" ? [] : [...record.scores]
          let evaluationTraceId: string | undefined
          if (evaluatorPrompts) {
            const evaluated = await observeEval(
              { caseId: item.id, sourceTraceId: observed.traceId },
              { runId, purpose: "critic-judge", model: config.evaluatorModel },
              () =>
                evaluateResult({
                  item,
                  result: { ...observed.result, providerFailures: [] },
                  modelId: config.evaluatorModel,
                  apiKey: process.env.OPENROUTER_API_KEY,
                  budget,
                  prompts: evaluatorPrompts,
                  checkpointDirectory: path.join(directory, "stages", unitId),
                  signal: controller.signal
                })
            )
            const evaluation = evaluated.result
            evaluationTraceId = evaluated.traceId
            await writeArtifact(path.join(directory, `${unitId}.evaluation.json`), evaluation)
            if (evaluation.status === "scored" && evaluation.judge.applicability === "gradable") {
              scores.push({
                name: "judge-critical-failure",
                value: evaluation.judge.criticalFailure === null ? null : Number(evaluation.judge.criticalFailure),
                detail: evaluation.judge.rationale
              })
              for (const name of ["correctness", "grounding", "completeness", "usefulness"] as const) {
                scores.push({
                  name: `judge-${name}`,
                  value: evaluation.judge[name],
                  detail: evaluation.judge.rationale
                })
              }
            }
          }
          const datasetItemId = synced.ids[item.id]
          if (!datasetItemId) {
            throw new Error("Dataset item not synced.")
          }
          const upload = {
            runName: `${runId}-${candidate.id}-repeat-${repeat}`,
            datasetName: dataset.name,
            datasetItemId,
            datasetVersion: synced.timestamp,
            traceId: observed.traceId,
            observationId: observed.observationId,
            output: observed.result,
            metadata: {
              runId,
              candidate,
              evaluationTraceId,
              datasetHash: manifest.datasetHash,
              inputContract: evaluationInputContract,
              releaseApproved: false
            },
            scores
          }
          await writeArtifact(path.join(directory, `${unitId}.upload.json`), upload)
          try {
            await journal.stage(
              `${unitId}-upload`,
              {
                ...upload,
                metadata: {
                  runId,
                  candidate,
                  datasetHash: manifest.datasetHash,
                  inputContract: evaluationInputContract
                }
              },
              z.boolean(),
              async () => {
                await langfuse.publishResult(upload)
                return true
              }
            )
          } catch (error) {
            if (error instanceof CheckpointMismatch) {
              throw error
            }
            pendingUploads++
            process.stderr.write(`Upload pending for ${unitId}; saved locally for --upload.\n`)
          }
          completed++
        }
      }
    }
  } finally {
    await writeArtifact(path.join(directory, "summary.json"), {
      completed,
      pendingUploads,
      planned: cases.length * config.candidates.length * config.repeats,
      modelCalls: budget.used,
      cancelled: controller.signal.aborted,
      budgetBlocked: budget.blocked,
      releaseApproved: false
    })
    await tracing.shutdown()
  }
  print({ directory, completed, modelCalls: budget.used, releaseApproved: false })
}

;(values.execute || values.resume ? withEvaluationLock(main) : main()).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed.")
  process.exitCode = 1
})
