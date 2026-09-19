import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { parseArgs } from "node:util"
import type { Page, Request } from "playwright"
import { redactCredentials } from "../../src/modules/conversations/redactCredentials"
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
  await textbox.fill("/export")
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.getByRole("button", { name: "Send question", exact: true }).click()
  ])
  const stream = await download.createReadStream()
  if (!stream) {
    throw new Error("The conversation export download is unavailable.")
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    const value: unknown = chunk
    if (!Buffer.isBuffer(value)) {
      throw new Error("Unexpected conversation export stream content.")
    }
    size += value.length
    if (size > 10_000_000) {
      stream.destroy()
      throw new Error("Conversation export exceeds the driver read limit; nothing was truncated.")
    }
    chunks.push(value)
  }
  return snapshotSchema.parse(redactCredentials(JSON.parse(Buffer.concat(chunks).toString("utf8"))))
}

async function execute(scenario: Scenario, baseUrl: string, output: string) {
  // Neither Playwright nor a browser is loaded by plan/validation mode.
  const { chromium } = await import("playwright")
  await mkdir(output, { recursive: true })
  const directory = join(output, `${scenario.id}-${Date.now()}-${randomUUID()}`)
  await mkdir(directory)
  const progress: StepProgress[] = scenario.steps.map((step) => ({
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
  const requests = new Map<Request, RequestObservation & { exchange: number }>()
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    await page.route("**/*", async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (isExporting && url.origin === baseUrl && url.pathname === "/chat") {
        exportViolation = true
        record("export-chat-request-blocked", { method: request.method() })
        await route.abort("blockedbyclient")
      } else if (request.isNavigationRequest() && request.frame() === page.mainFrame() && url.origin !== baseUrl) {
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
        record("response", {
          requestId: observation.id,
          requestExchange: observation.exchange,
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

    outer: for (const [index, step] of progress.entries()) {
      activeStep = step
      const selection = selectStep(scenario, index, progress)
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
        await page.getByRole("textbox", { name: "Your question", exact: true }).fill(selection.prompt)
        await page.getByRole("button", { name: "Send question", exact: true }).click()
      }
      let submission: unknown = { kind: "prompt", text: selection.prompt }
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
        while (Date.now() - started < 170_000) {
          if (journalError) {
            throw new Error("The event journal could not be persisted.")
          }
          const observed = [...requests.values()].filter((request) => request.exchange === exchange)
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
            await stop.click()
          }
          reason = "The driver wait budget expired; no timeout cause is attributed to the application."
          break outer
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
          evidenceAssessment: "unassessed"
        })
        record("exchange-observed", { stepId: step.id, ...summary })
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
          const form = page.getByRole("form", { name: "Clarification", exact: true })
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
    if (progress.every((step) => step.answered)) {
      state = "finished-unassessed"
      reason = "All selected prompts received terminal answers; research correctness remains unassessed."
    }
  } catch (error) {
    state = "harness-error"
    reason = String(errorText(error))
    record("driver-error", { reason })
  } finally {
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
        coverage: scenarioCoverage(scenario, progress),
        progress,
        exchanges,
        requests: [...requests.values()],
        events,
        limitations: [
          "No semantic evidence assessment is performed. Invocation, discovered records and delivered answers are distinct.",
          "Request observations do not establish duplicate model generations or billing.",
          "Transport failures remain recorded even when a terminal answer was delivered.",
          "Only explicitly authored questions, jurisdiction choices and missing-discovery branches can be submitted.",
          "This driver never resumes old runs or automatically retries a request."
        ]
      }),
      { flag: "wx" }
    )
  }
  process.stdout.write(serialized({ directory, state, reason, coverage: scenarioCoverage(scenario, progress) }))
  process.exitCode = state === "finished-unassessed" ? 0 : 1
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", default: false },
      scenario: { type: "string" },
      execute: { type: "boolean", default: false },
      "base-url": { type: "string", default: "http://127.0.0.1:3000" },
      output: { type: "string", default: "artifacts/scenario-runs" }
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
        "Clarification questions/options match exactly; missing answers pause. No resume, implicit state selection, retries or semantic pass claim.\n"
    )
    return
  }
  const input = values.scenario === "-" ? readFileSync(0, "utf8") : await readFile(resolve(values.scenario), "utf8")
  const scenario = scenarioSchema.parse(JSON.parse(input))
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
  await execute(scenario, baseUrl.origin, output)
}

void main().catch((error: unknown) => {
  process.stderr.write(String(errorText(error)) + "\n")
  process.exitCode = 1
})
