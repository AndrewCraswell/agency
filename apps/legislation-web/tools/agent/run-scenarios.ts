import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import type { LanguageModel } from "ai"
import type { Browser, Page, Response } from "playwright"
import { redactCredentials } from "../../src/modules/conversations/redactCredentials"
import { createChatModel } from "../../src/services/openrouter/chat-model"
import { scenarioBrowser } from "./scenario-browser"
import { applicationUrl, approvedJurisdictions, scenarioSchema, type Scenario } from "./scenario-policy"
import { parseCapture, ScenarioSession } from "./scenario-session"

export async function runScenario(
  scenario: Scenario,
  baseUrl: string,
  output: string,
  options: {
    adaptiveModel?: string
    model?: LanguageModel
    waitMs: number
    page?: Page
    resume?: string
    signal?: AbortSignal
  }
) {
  const directory = options.resume ?? join(output, `${Date.now()}-${randomUUID()}`)
  const session = await ScenarioSession.open(directory, scenario)
  const authorized = applicationUrl(baseUrl)
  await session.authorizeOrigin(authorized.href)
  const model =
    options.model ??
    (options.adaptiveModel
      ? createChatModel(process.env.OPENROUTER_API_KEY, options.adaptiveModel, { reasoning: { effort: "low" } })
      : undefined)
  if (!model) {
    throw new Error("Goal-driven execution requires an explicit planner model.")
  }
  let ownedBrowser: Browser | undefined
  let page = options.page
  if (!page) {
    const { chromium } = await import("playwright")
    ownedBrowser = await chromium.launch({ headless: true })
    page = await ownedBrowser.newPage()
  }
  const activePage = page
  const operate = (operation: Parameters<typeof scenarioBrowser>[1]) =>
    scenarioBrowser(activePage, operation, {
      signal: options.signal,
      origin: authorized.origin,
      onRecovery: (observation) => session.record("browser-recovery", observation)
    })
  let acknowledgements = Promise.resolve()
  const onResponse = (response: Response) => {
    const request = response.request()
    if (
      request.method() !== "POST" ||
      new URL(request.url()).origin !== authorized.origin ||
      new URL(request.url()).pathname !== "/chat"
    ) {
      return
    }
    try {
      const body: unknown = request.postDataJSON()
      if (!body || typeof body !== "object" || !("messages" in body) || "action" in body) {
        return
      }
      acknowledgements = acknowledgements.then(() =>
        session.acknowledge({ status: response.status(), requestId: response.headers()["x-rostra-request-id"] ?? null })
      )
    } catch {
      return
    }
  }
  activePage.on("response", onResponse)
  let state = "checkpoint"
  let reason = ""
  try {
    if (!session.summary.sessionId && session.summary.submissions.length === 0) {
      await operate({ action: "navigate", url: authorized.href })
    } else if (
      !options.page &&
      session.summary.sessionId &&
      !activePage.url().includes(`/conversations/${session.summary.sessionId}`)
    ) {
      await operate({ action: "navigate", url: `${authorized.origin}/conversations/${session.summary.sessionId}` })
    } else if (!session.summary.sessionId && options.resume && !options.page) {
      throw new Error(
        "Submission delivery is unknown. Restore the original browser tab and reconcile before continuing."
      )
    }
    while (true) {
      options.signal?.throwIfAborted()
      if (session.summary.submissions.at(-1)?.status === "intended") {
        let lastCheckpoint = Date.now()
        let settled = false
        while (!settled) {
          options.signal?.throwIfAborted()
          if (Date.now() - lastCheckpoint >= options.waitMs) {
            await session.checkpoint("Continuing to observe the pending response; no Stop or resubmission.")
            lastCheckpoint = Date.now()
          }
          const view = await operate({ action: "inspect" })
          if ("busy" in view && !view.busy && !view.restoring) {
            const capture = parseCapture(await operate({ action: "export" }))
            await acknowledgements
            settled = (await session.capture(capture.snapshot, capture.visible)).settled
            if (settled) {
              break
            }
          }
          await delay(250, undefined, { signal: options.signal })
        }
      }
      const decision = await session.next(model, options.signal)
      if (decision.action === "finish" || decision.action === "pause") {
        state = session.summary.status
        reason = decision.reason
        break
      }
      const inspected = await operate({ action: "inspect" })
      if (!("empty" in inspected)) {
        throw new Error("Browser inspection unavailable.")
      }
      const intended = await session.prepare({ empty: inspected.empty, url: inspected.url })
      await operate({
        action: "submit",
        text: intended.text,
        clarification:
          decision.action === "clarify" ? { text: decision.text, optionLabels: decision.optionLabels } : undefined
      })
    }
  } catch (error) {
    reason = String(redactCredentials(error instanceof Error ? error.message : String(error)))
    await session.checkpoint(reason)
  } finally {
    activePage.off("response", onResponse)
    await acknowledgements.catch((error: unknown) => session.checkpoint(String(error)))
    if (ownedBrowser && state === "finished-unassessed") {
      await ownedBrowser.close()
    }
    const summary = session.summary
    await writeFile(
      join(directory, "report.json"),
      JSON.stringify(
        redactCredentials({
          state,
          reason,
          scenario: summary.scenario.id,
          sessionId: summary.sessionId,
          exchangeCounts: {
            submitted: summary.submissions.length,
            captured: summary.submissions.filter((submission) => submission.status === "captured").length
          },
          correctness: "unassessed",
          resumable: state === "checkpoint",
          browserRetained: state === "checkpoint"
        }),
        null,
        2
      )
    )
  }
  return { directory, state, reason }
}

async function main() {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      resume: { type: "string" },
      continue: { type: "string" },
      execute: { type: "boolean", default: false },
      "base-url": { type: "string", default: "http://127.0.0.1:3000" },
      output: { type: "string", default: "artifacts/scenario-runs" },
      "adaptive-model": { type: "string" },
      "wait-ms": { type: "string", default: "600000" }
    }
  })
  if (!values.scenario && !values.resume) {
    process.stdout.write(
      "Use --scenario <file> to validate a goal-driven plan, --execute --adaptive-model <model> to run, or --resume <attempt-directory> to reconcile an existing attempt. --wait-ms is a checkpoint, never a research Stop.\n"
    )
    return
  }
  const scenario = values.resume
    ? (await ScenarioSession.open(resolve(values.resume))).summary.scenario
    : scenarioSchema.parse(
        JSON.parse(
          values.scenario === "-" ? readFileSync(0, "utf8") : await readFile(resolve(values.scenario!), "utf8")
        )
      )
  if (values.continue && !values.resume) {
    throw new Error("--continue requires --resume and an explicit reason.")
  }
  const base = applicationUrl(values["base-url"])
  const output = resolve(values.output)
  const outputRelative = relative(process.cwd(), output)
  if (outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
    throw new Error("Output must stay in the application directory.")
  }
  const waitMs = Number(values["wait-ms"])
  if (!Number.isSafeInteger(waitMs) || waitMs <= 0) {
    throw new Error("wait-ms must be a positive checkpoint interval.")
  }
  if (!values.execute) {
    process.stdout.write(
      JSON.stringify(
        {
          mode: "plan",
          scenario,
          approvedJurisdictions: approvedJurisdictions(scenario),
          unassessed: scenario.steps.map((step) => step.id),
          note: "No browser or model invoked."
        },
        null,
        2
      )
    )
    return
  }
  if (!values["adaptive-model"] || !process.env.OPENROUTER_API_KEY) {
    throw new Error("Execution requires an explicit planner model and credentials.")
  }
  if (values.continue && values.resume) {
    await (await ScenarioSession.open(resolve(values.resume))).continueAfterBlocker(values.continue)
  }
  const cancellation = new AbortController()
  const cancel = () =>
    cancellation.abort(new Error("Operator cancelled execution; pending research was not stopped or resent."))
  process.once("SIGINT", cancel)
  process.once("SIGTERM", cancel)
  const result = await runScenario(scenario, base.href, output, {
    adaptiveModel: values["adaptive-model"],
    waitMs,
    resume: values.resume ? resolve(values.resume) : undefined,
    signal: cancellation.signal
  })
  process.removeListener("SIGINT", cancel)
  process.removeListener("SIGTERM", cancel)
  process.stdout.write(JSON.stringify(result))
  process.exitCode = result.state === "finished-unassessed" ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(String(redactCredentials(String(error))) + "\n")
    process.exitCode = 1
  })
}
