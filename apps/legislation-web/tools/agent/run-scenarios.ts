import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import type { LanguageModel } from "ai"
import type { Page, Request } from "playwright"
import { z } from "zod"
import { entityKindSchema } from "../../src/modules/conversations/entityResults"
import { redactCredentials } from "../../src/modules/conversations/redactCredentials"
import { createChatModel } from "../../src/services/openrouter/chat-model"
import { planAdaptiveTurn } from "./adaptive-planner"
import {
  approvedJurisdictions,
  inspectSnapshot,
  requestIdentity,
  scenarioCoverage,
  scenarioSchema,
  selectClarification,
  selectStep,
  snapshotSchema,
  summarizeExchange,
  type AdaptiveDecision,
  type VisibleConversation,
  type RequestObservation,
  type Scenario,
  type StepProgress
} from "./scenario-policy"

function serialized(value: unknown) {
  return JSON.stringify(redactCredentials(value), null, 2) + "\n"
}

function errorText(error: unknown) {
  return redactCredentials(error instanceof Error ? error.message : String(error))
}

async function exportConversation(page: Page) {
  const textbox = page.getByRole("textbox", { name: "Your question", exact: true })
  const code = page
    .getByRole("region", { name: "Conversation export", exact: true })
    .getByLabel("Conversation export JSON", { exact: true })
  const previous = (await code.count()) ? await code.textContent() : null
  await textbox.fill("/export")
  await page.getByRole("button", { name: "Send question", exact: true }).click()
  await code.waitFor({ timeout: 15_000 })
  if (previous !== null) {
    await page.waitForFunction(
      (old) => document.querySelector("[data-conversation-export] code")?.textContent !== old,
      previous,
      { timeout: 15_000 }
    )
  }
  const json = await code.textContent()
  if (!json) {
    throw new Error("The conversation export is empty.")
  }
  if (Buffer.byteLength(json, "utf8") > 10_000_000) {
    throw new Error("Conversation export exceeds the driver read limit; nothing was truncated.")
  }
  return snapshotSchema.parse(redactCredentials(JSON.parse(json)))
}

async function visibleConversation(page: Page): Promise<VisibleConversation> {
  const conversation = page.getByRole("log", { name: "Conversation", exact: true })
  const transcript = (
    await conversation
      .locator(
        'article[aria-label="Your question"], article[aria-label="Rostra response"], [role="alert"], form[aria-label="Clarification"]'
      )
      .allInnerTexts()
  ).join("\n\n")
  const form = page.getByRole("form", { name: "Clarification", exact: true })
  let clarification: VisibleConversation["clarification"] = null
  if (await form.isVisible()) {
    const multiple = (await form.getByRole("checkbox").count()) > 0
    const controls = form.getByRole(multiple ? "checkbox" : "radio")
    const optionLabels = await controls.evaluateAll((elements) =>
      elements.map((element) => {
        const ids = element.getAttribute("aria-labelledby")?.split(/\s+/) ?? []
        return (
          ids
            .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
            .join(" ")
            .trim() ||
          element.getAttribute("aria-label") ||
          element.closest("label")?.textContent?.trim() ||
          ""
        )
      })
    )
    clarification = {
      question: await form.locator("legend").innerText(),
      optionLabels,
      allowsText: await form.getByRole("textbox", { name: "Your answer", exact: true }).isVisible(),
      multiple
    }
  }
  const lastResponse = conversation.getByRole("article", { name: "Rostra response", exact: true }).last()
  const hasFailure =
    (await conversation.getByRole("button", { name: "Try again", exact: true }).isVisible()) ||
    ((await lastResponse.count()) > 0 &&
      (await lastResponse.getByText("Incomplete response", { exact: true }).isVisible()))
  return { transcript: String(redactCredentials(transcript)), clarification, hasFailure }
}

export async function runScenario(
  scenario: Scenario,
  baseUrl: string,
  output: string,
  options: { adaptiveModel?: string; model?: LanguageModel; waitMs: number }
) {
  const { adaptiveModel, waitMs } = options
  // Neither Playwright nor a browser is loaded by plan/validation mode.
  const { chromium } = await import("playwright")
  await mkdir(output, { recursive: true })
  const directory = join(output, `${scenario.id}-${Date.now()}-${randomUUID()}`)
  await mkdir(directory)
  const progress: StepProgress[] = (scenario.adaptive ? [] : scenario.steps).map((step) => ({
    id: step.id,
    selected: null,
    executedRequestIds: [],
    answered: false,
    records: []
  }))
  await writeFile(
    join(directory, "plan.json"),
    serialized({
      scenario,
      adaptiveModel: adaptiveModel ?? null,
      plannerReasoning: scenario.adaptive ? "low" : null,
      waitMs,
      approvedJurisdictions: approvedJurisdictions(scenario),
      baseUrl,
      coverage: scenarioCoverage(scenario, progress)
    }),
    { flag: "wx" }
  )
  const journalFile = join(directory, "events.jsonl")
  await writeFile(journalFile, "", { flag: "wx" })
  const events: unknown[] = []
  const exchanges: unknown[] = []
  let writes = Promise.resolve()
  let journalError: unknown
  let exchange = 0
  function record(event: string, data: unknown) {
    const entry = redactCredentials({ at: new Date().toISOString(), exchange, event, data })
    events.push(entry)
    writes = writes
      .then(() => appendFile(journalFile, JSON.stringify(entry) + "\n"))
      .catch((error: unknown) => {
        journalError ??= error
      })
  }
  let state = "paused"
  let reason = "No exchange was executed."
  let isExporting = false
  let exportViolation = false
  let activeStep: StepProgress | undefined
  const decisions: AdaptiveDecision[] = []
  let visible: VisibleConversation | undefined
  const planner =
    options.model ??
    (scenario.adaptive && adaptiveModel
      ? createChatModel(process.env.OPENROUTER_API_KEY, adaptiveModel, { reasoning: { effort: "low" } })
      : undefined)
  const requests = new Map<Request, RequestObservation & { exchange: number }>()
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let page: Page | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" })
    page = await context.newPage()
    const activePage = page
    page.setDefaultTimeout(10_000)
    await page.route("**/*", async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (isExporting && url.origin === baseUrl && url.pathname === "/chat") {
        exportViolation = true
        record("export-chat-request-blocked", { method: request.method() })
        await route.abort("blockedbyclient")
      } else if (
        request.isNavigationRequest() &&
        request.frame() === activePage.mainFrame() &&
        url.origin !== baseUrl
      ) {
        record("external-navigation-blocked", { origin: url.origin })
        await route.abort("blockedbyclient")
      } else {
        await route.continue()
      }
    })
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (url.origin !== baseUrl || url.pathname !== "/chat") {
        return
      }
      let body: unknown
      try {
        body = request.postDataJSON()
      } catch {
        body = undefined
      }
      const observation = {
        ...requestIdentity(body),
        id: randomUUID(),
        exchange,
        serverRequestId: null,
        status: null,
        terminal: null,
        failure: null
      } satisfies RequestObservation & { exchange: number }
      requests.set(request, observation)
      if (!isExporting && (observation.kind === "generation" || observation.kind === "resume")) {
        activeStep?.executedRequestIds.push(observation.id)
      }
      record("request", { ...observation, method: request.method() })
    })
    page.on("response", (response) => {
      const observation = requests.get(response.request())
      if (observation) {
        observation.status = response.status()
        const header = response.headers()["x-rostra-request-id"]
        const serverRequestId = z.uuid().safeParse(header)
        observation.serverRequestId = serverRequestId.success ? serverRequestId.data : null
        if (header && !serverRequestId.success) {
          record("invalid-server-request-id", { requestId: observation.id })
        }
        record("response", {
          requestId: observation.id,
          requestExchange: observation.exchange,
          serverRequestId: observation.serverRequestId,
          status: observation.status
        })
      }
    })
    page.on("requestfinished", (request) => {
      const observation = requests.get(request)
      if (observation) {
        observation.terminal = "finished"
        record("request-finished", { requestId: observation.id, requestExchange: observation.exchange })
      }
    })
    page.on("requestfailed", (request) => {
      const observation = requests.get(request)
      if (observation) {
        observation.terminal = "failed"
        observation.failure = request.failure()?.errorText ?? "Unknown transport failure"
        record("request-failed", {
          requestId: observation.id,
          requestExchange: observation.exchange,
          failure: observation.failure
        })
      }
    })
    page.on("pageerror", (error) => record("page-error", { message: errorText(error) }))
    const navigation = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
    if (!navigation?.ok()) {
      throw new Error("The application document is unavailable.")
    }
    await page.getByRole("textbox", { name: "Your question", exact: true }).waitFor()
    const seenMessages = new Set<string>()
    const answeredQuestions = new Set<string>()
    let conversationId: string | undefined

    const slots = scenario.adaptive ? scenario.maximumExchanges : scenario.steps.length
    outer: for (let index = 0; index < slots; index++) {
      let decision: AdaptiveDecision | undefined
      let selection: ReturnType<typeof selectStep>
      let step = progress[index]
      if (scenario.adaptive) {
        if (exchange >= scenario.maximumExchanges) {
          reason = "The approved exchange budget is exhausted; goals remain unassessed."
          break
        }
        if (index > 0) {
          if (!planner || !visible) {
            throw new Error("Adaptive planning requires a model and visible conversation.")
          }
          const planned = await planAdaptiveTurn({
            model: planner,
            scenario,
            visible,
            previous: decisions,
            exchange,
            signal: AbortSignal.timeout(60_000),
            record
          })
          decision = planned.decision
          record("adaptive-decision", { model: adaptiveModel, ...planned })
          decisions.push(decision)
          if (decision.action === "finish" || decision.action === "pause") {
            state = decision.action === "finish" ? "finished-unassessed" : "paused"
            reason = decision.reason
            break
          }
        }
        step = {
          id: `exchange-${exchange + 1}`,
          selected: "primary",
          executedRequestIds: [],
          answered: false,
          records: []
        }
        progress.push(step)
        selection = {
          kind: "submit",
          branch: "primary",
          prompt:
            (decision?.text ?? scenario.steps[0]!.prompt) +
            `\n\nApproved jurisdictions: ${approvedJurisdictions(scenario).join(", ")}.`
        }
      } else {
        selection = selectStep(scenario, index, progress)
      }
      if (!step) {
        throw new Error("The selected step is unavailable.")
      }
      activeStep = step
      if (selection.kind === "pause") {
        reason = selection.reason
        break
      }
      if (selection.prompt.length > 24_000) {
        reason = "The selected prompt exceeds the application limit; the driver will not truncate it."
        break
      }
      step.selected = selection.branch
      record("step-selected", { stepId: step.id, ...selection })
      let submit = async () => {
        await activePage.getByRole("textbox", { name: "Your question", exact: true }).fill(selection.prompt)
        await activePage.getByRole("button", { name: "Send question", exact: true }).click()
      }
      let submission: unknown = { kind: "prompt", text: selection.prompt }
      if (decision?.action === "clarify") {
        const answer = decision
        const question = visible?.clarification
        if (!question) {
          throw new Error("The visible clarification is unavailable.")
        }
        submission = { kind: "clarification", question: question.question, answer }
        submit = async () => {
          const form = activePage.getByRole("form", { name: "Clarification", exact: true })
          if ((await form.locator("legend").innerText()) !== question.question) {
            throw new Error("The visible clarification changed.")
          }
          for (const label of answer.optionLabels) {
            await form.getByRole(question.multiple ? "checkbox" : "radio", { name: label, exact: true }).click()
          }
          if (answer.text) {
            await form.getByRole("textbox", { name: "Your answer", exact: true }).fill(answer.text)
          }
          await form.getByRole("button", { name: "Continue", exact: true }).click()
        }
      }
      while (!step.answered) {
        if (exchange >= scenario.maximumExchanges) {
          reason = "The approved exchange budget is exhausted; dependent prompts remain unexecuted."
          break outer
        }
        exchange++
        record("submission", { stepId: step.id, submission })
        await submit()
        const started = Date.now()
        let idleSince: number | undefined
        let isSettled = false
        while (Date.now() - started < waitMs) {
          if (journalError) {
            throw new Error("The event journal could not be persisted.")
          }
          const observed = [...requests.values()].filter(
            (request) =>
              request.exchange === exchange && ["generation", "resume", "confirmation"].includes(request.kind)
          )
          const isBusy = await page.getByRole("button", { name: "Stop response", exact: true }).isVisible()
          const isConfirming = (await page.locator('form[aria-label="Clarification"][aria-busy="true"]').count()) > 0
          if (observed.length && observed.every((request) => request.terminal !== null) && !isBusy && !isConfirming) {
            idleSince ??= Date.now()
            if (Date.now() - idleSince >= 750) {
              isSettled = true
              break
            }
          } else {
            idleSince = undefined
          }
          await delay(150)
        }
        if (!isSettled) {
          record("driver-timeout", { stepId: step.id })
          const stop = page.getByRole("button", { name: "Stop response", exact: true })
          if (await stop.isVisible()) {
            await stop
              .click()
              .then(() => record("timeout-stop", { requested: true }))
              .catch((error: unknown) => record("timeout-stop-failed", { message: errorText(error) }))
          }
          reason = "The driver wait budget expired; no timeout cause is attributed to the application."
          record("timeout-visible", await visibleConversation(page))
          await page
            .screenshot({ path: join(directory, `timeout-${exchange}.png`), fullPage: true })
            .catch((error: unknown) => record("screenshot-failed", { message: errorText(error) }))
        }
        isExporting = true
        const snapshot = await exportConversation(page).finally(() => {
          isExporting = false
        })
        if (exportViolation || (conversationId && conversationId !== snapshot.conversationId)) {
          throw new Error("Export entered chat or changed conversation identity; continuation stopped.")
        }
        conversationId = snapshot.conversationId
        await writeFile(join(directory, `exchange-${exchange}.json`), serialized(snapshot), { flag: "wx" })
        const inspection = inspectSnapshot(snapshot, seenMessages)
        for (const id of inspection.messageIds) {
          seenMessages.add(id)
        }
        const observed = [...requests.values()].filter((request) => request.exchange === exchange)
        const summary = summarizeExchange(observed, inspection.outcome)
        step.records.push(...inspection.records)
        step.answered = summary.answered
        exchanges.push({
          exchange,
          stepId: step.id,
          submission,
          requests: observed,
          ...summary,
          messageIds: inspection.messageIds,
          calls: inspection.calls,
          evidenceCandidates: inspection.evidenceCandidates,
          evidenceAssessment: "unassessed",
          driverTimedOut: !isSettled
        })
        record("exchange-observed", { stepId: step.id, ...summary })
        if (!isSettled) {
          break outer
        }
        if (scenario.adaptive) {
          visible = await visibleConversation(page)
          record("visible-conversation", visible)
          reason = "The approved exchange budget ended; adaptive goal assessment remains unverified."
          break
        }
        if (step.answered) {
          break
        }
        if (!inspection.clarification || inspection.outcome?.status !== "clarification") {
          reason = `No delivered terminal answer or actionable clarification; observed status: ${summary.delivery}.`
          break outer
        }
        const clarification = selectClarification(scenario, inspection.clarification, answeredQuestions)
        if (clarification.kind === "pause") {
          reason = clarification.reason
          record("clarification-paused", { question: inspection.clarification.input.question, reason })
          break outer
        }
        const question = inspection.clarification.input.question
        const controlKind = inspection.clarification.input.kind === "single" ? "radio" : "checkbox"
        submission = { kind: "clarification", question, answer: clarification }
        submit = async () => {
          const form = activePage.getByRole("form", { name: "Clarification", exact: true })
          if ((await form.locator("legend").innerText()) !== question) {
            throw new Error("The visible clarification changed; the authored answer was not submitted.")
          }
          for (const label of clarification.optionLabels) {
            await form.getByRole(controlKind, { name: label, exact: true }).click()
          }
          if (clarification.text) {
            await form.getByRole("textbox", { name: "Your answer", exact: true }).fill(clarification.text)
          }
          await form.getByRole("button", { name: "Continue", exact: true }).click()
          answeredQuestions.add(question)
        }
      }
    }
    if (!scenario.adaptive && progress.every((step) => step.answered)) {
      state = "finished-unassessed"
      reason = "All selected prompts received terminal answers; research correctness remains unassessed."
    }
  } catch (error) {
    state = "harness-error"
    reason = String(errorText(error))
    record("driver-error", { reason })
  } finally {
    if (page && state !== "finished-unassessed") {
      await page
        .screenshot({ path: join(directory, "final.png"), fullPage: true })
        .catch((error: unknown) => record("final-screenshot-failed", { message: errorText(error) }))
      await visibleConversation(page)
        .then((value) => record("final-visible-conversation", value))
        .catch((error: unknown) => record("final-visible-failed", { message: errorText(error) }))
      isExporting = true
      await exportConversation(page)
        .then((snapshot) => writeFile(join(directory, "final-snapshot.json"), serialized(snapshot), { flag: "wx" }))
        .catch((error: unknown) => record("final-export-failed", { message: errorText(error) }))
        .finally(() => {
          isExporting = false
        })
    }
    await browser?.close().catch((error: unknown) => record("browser-close-error", { message: errorText(error) }))
    await writes
    if (journalError) {
      state = "harness-error"
      reason = "Event journal persistence failed; retained in-memory observations are included in the report."
    }
    await writeFile(
      join(directory, "report.json"),
      serialized({
        state,
        reason,
        mode: scenario.adaptive ? "adaptive" : "fixed",
        decisions,
        goalAssessment: scenario.adaptive ? { goals: decisions.at(-1)?.goals ?? [], verified: false } : null,
        exchangeCounts: {
          submitted: exchange,
          captured: exchanges.length,
          answered: progress.filter((step) => step.answered).length
        },
        coverage: scenarioCoverage(scenario, scenario.adaptive ? [] : progress),
        progress,
        exchanges,
        requests: [...requests.values()],
        events,
        limitations: [
          "No semantic evidence assessment is performed. Invocation, discovered records and delivered answers are distinct.",
          "Request observations do not establish duplicate model generations or billing.",
          "Transport failures remain recorded even when a terminal answer was delivered.",
          "Adaptive decisions use rendered conversation only; diagnostic exports are not planner inputs. Model scope adherence and goal claims require human review.",
          "This driver never resumes old runs or blindly retries a request. Adaptive recovery is separately budgeted and preserves initial failures.",
          "A driver deadline is a capture boundary, not an application timeout. Final captures after Stop may remain partial."
        ]
      }),
      { flag: "wx" }
    )
  }
  return { directory, state, reason, coverage: scenarioCoverage(scenario, scenario.adaptive ? [] : progress) }
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", default: false },
      scenario: { type: "string" },
      execute: { type: "boolean", default: false },
      "base-url": { type: "string", default: "http://127.0.0.1:3000" },
      output: { type: "string", default: "artifacts/scenario-runs" },
      "adaptive-model": { type: "string" },
      "wait-ms": { type: "string", default: "600000" }
    }
  })
  if (values.help || !values.scenario) {
    process.stdout.write(
      "Usage: pnpm tool agent/run-scenarios --scenario <authored.json> [--execute] [--base-url http://127.0.0.1:3000] [--output artifacts/scenario-runs]\n" +
        "Default: validate and print a plan without browser or network access. Use --scenario - for JSON on stdin. --execute authorizes real application research.\n" +
        "Input: id, objective, jurisdictions (explicit full U.S. state names or U.S. federal), maximumExchanges (1-8), steps [{id,prompt}].\n" +
        "clarificationAnswers: jurisdiction rules {question,kind:'jurisdiction',jurisdictions,options?:[{label,jurisdictions}]}; other rules {question,kind:'other',optionLabels,text}.\n" +
        "Jurisdiction text is generated from structured choices; option labels must exactly join their mapped jurisdiction names with ', '. State-only answers may omit an already approved federal scope.\n" +
        "Optional: acceptedNarrowing {jurisdictions,reason}; step.requiresRecordsFrom {stepId,kind,onMissingRecords}.\n" +
        `Dependency kind must be one of: ${entityKindSchema.options.join(", ")}. Use meeting for search_events results, not event; unsupported kinds fail validation before execution.\n` +
        "Fixed clarification questions/options match exactly; missing answers pause. No resume or semantic pass claim.\n" +
        "Adaptive: add adaptive {persona,constraints,maximumRecoveries:0-2}; steps become coverage goals after the opening prompt. --adaptive-model <model-id> is required with --execute and incurs planner calls using OPENROUTER_API_KEY.\n" +
        "--wait-ms defaults to 600000 per browser exchange; on expiry Stop and final capture are attempted, never automatic resubmission.\n"
    )
    return
  }
  const input = values.scenario === "-" ? readFileSync(0, "utf8") : await readFile(resolve(values.scenario), "utf8")
  const scenario = scenarioSchema.parse(JSON.parse(input))
  const waitMs = Number(values["wait-ms"])
  if (!Number.isSafeInteger(waitMs) || waitMs < 1000 || waitMs > 3_600_000) {
    throw new Error("wait-ms must be 1000-3600000.")
  }
  if (values["adaptive-model"] && !scenario.adaptive) {
    throw new Error("adaptive-model requires an adaptive scenario.")
  }
  if (values.execute && scenario.adaptive && (!values["adaptive-model"]?.trim() || !process.env.OPENROUTER_API_KEY)) {
    throw new Error("Adaptive execution requires adaptive-model and OPENROUTER_API_KEY.")
  }
  const baseUrl = new URL(values["base-url"])
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("The browser driver requires a credential-free loopback application origin.")
  }
  const output = resolve(values.output)
  const outputRelative = relative(process.cwd(), output)
  if (outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
    throw new Error("The output root must remain within the current application directory.")
  }
  if (!values.execute) {
    process.stdout.write(
      serialized({
        mode: "plan",
        scenario,
        approvedJurisdictions: approvedJurisdictions(scenario),
        coverage: scenarioCoverage(scenario, []),
        note: "No browser connected, requests sent, branches selected, answers assessed or run files created."
      })
    )
    return
  }
  const result = await runScenario(scenario, baseUrl.origin, output, {
    adaptiveModel: values["adaptive-model"],
    waitMs
  })
  process.stdout.write(serialized(result))
  process.exitCode = result.state === "finished-unassessed" ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(String(errorText(error)) + "\n")
    process.exitCode = 1
  })
}
