import { createHash, randomUUID } from "node:crypto"
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { redactCredentials } from "../../src/modules/conversations/redactCredentials"
import { planAdaptiveTurn } from "./adaptive-planner"
import {
  adaptiveDecisionSchema,
  scenarioSchema,
  snapshotSchema,
  type AdaptiveDecision,
  type Scenario,
  type Snapshot,
  type VisibleConversation
} from "./scenario-policy"
import { applicationUrl } from "./scenario-policy"

export const visibleConversationSchema = z.object({
  transcript: z.string(),
  clarification: z
    .object({ question: z.string(), optionLabels: z.array(z.string()), allowsText: z.boolean(), multiple: z.boolean() })
    .nullable(),
  hasFailure: z.boolean()
})

const submissionSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  decision: adaptiveDecisionSchema,
  status: z.enum(["intended", "captured"]),
  request: z.object({ status: z.number(), requestId: z.string().nullable() }).optional(),
  messageIds: z.array(z.string()).optional()
})
const stateSchema = z.object({
  scenario: scenarioSchema,
  sessionId: z.string().optional(),
  submissions: z.array(submissionSchema),
  next: adaptiveDecisionSchema.optional(),
  visible: visibleConversationSchema.optional(),
  status: z.enum(["active", "finished-unassessed", "paused"]),
  blocker: z.string().optional(),
  origin: z.string().optional()
})

export class ScenarioSession {
  private constructor(
    readonly directory: string,
    private state: z.infer<typeof stateSchema>
  ) {}

  static async open(directory: string, scenario?: Scenario) {
    await mkdir(directory, { recursive: true })
    try {
      const state = stateSchema.parse(JSON.parse(await readFile(join(directory, "state.json"), "utf8")))
      if (scenario && JSON.stringify(state.scenario) !== JSON.stringify(scenario)) {
        throw new Error("Scenario changed; use a separate attempt directory.")
      }
      return new ScenarioSession(directory, state)
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT" || !scenario) {
        throw error
      }
      const session = new ScenarioSession(resolve(directory), { scenario, submissions: [], status: "active" })
      await session.save()
      return session
    }
  }

  get summary() {
    return structuredClone(this.state)
  }

  private async save() {
    const temporary = join(this.directory, `state-${randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify(redactCredentials(this.state), null, 2), { flag: "wx" })
    await rename(temporary, join(this.directory, "state.json"))
  }

  async record(event: string, data: unknown) {
    await appendFile(
      join(this.directory, "events.jsonl"),
      JSON.stringify(redactCredentials({ at: new Date().toISOString(), event, data })) + "\n"
    )
  }

  async checkpoint(reason: string) {
    this.state.blocker = reason
    await this.save()
    await this.record("checkpoint", { reason })
  }

  async continueAfterBlocker(reason: string) {
    if (!reason.trim()) {
      throw new Error("Explicit continuation requires a reason.")
    }
    await this.record("operator-continue", {
      reason,
      previousStatus: this.state.status,
      previousDecision: this.state.next
    })
    if (this.state.next?.action === "pause" || this.state.next?.action === "finish") {
      this.state.next = undefined
    }
    this.state.status = "active"
    this.state.blocker = undefined
    await this.save()
  }

  async authorizeOrigin(url: string) {
    const origin = applicationUrl(url).origin
    if (this.state.origin && this.state.origin !== origin) {
      throw new Error("Attempt belongs to a different application origin. Use a separate authorized attempt.")
    }
    this.state.origin = origin
    await this.save()
  }

  async next(model: LanguageModel, signal?: AbortSignal): Promise<AdaptiveDecision> {
    if (this.state.submissions.at(-1)?.status === "intended") {
      throw new Error(
        "Unconfirmed submission: inspect and capture the existing browser conversation before continuing. Do not resend it."
      )
    }
    if (this.state.next) {
      return this.state.next
    }
    if (!this.state.submissions.length) {
      this.state.next = {
        action: "follow-up",
        text: this.state.scenario.steps[0]!.prompt,
        optionLabels: [],
        reason: "Start the authored objective in a fresh conversation."
      }
    } else {
      if (!this.state.visible) {
        throw new Error("Capture the visible conversation before planning.")
      }
      try {
        const planned = await planAdaptiveTurn({
          model,
          scenario: this.state.scenario,
          visible: this.state.visible,
          previous: this.state.submissions.map((submission) => submission.decision),
          exchange: this.state.submissions.length,
          signal,
          record: (event, data) => this.record(event, data)
        })
        this.state.next = planned.decision
      } catch (error) {
        await this.checkpoint(error instanceof Error ? error.message : "Planner unavailable")
        throw error
      }
    }
    if (this.state.next.action === "finish") {
      this.state.status = "finished-unassessed"
    }
    if (this.state.next.action === "pause") {
      this.state.status = "paused"
    }
    this.state.blocker = undefined
    await this.save()
    await this.record("decision", this.state.next)
    return this.state.next
  }

  async prepare(fresh?: { empty: boolean; url: string }) {
    const decision = this.state.next
    if (!decision || decision.action === "finish" || decision.action === "pause") {
      throw new Error("No question is awaiting submission.")
    }
    if (this.state.submissions.at(-1)?.status === "intended") {
      throw new Error("Submission already intended; reconcile it, do not resend.")
    }
    if (!this.state.submissions.length && !fresh?.empty) {
      throw new Error("Start each scenario in an empty conversation.")
    }
    if (fresh) {
      await this.authorizeOrigin(fresh.url)
    }
    let text = decision.text
    if (decision.action === "clarify") {
      const clarification = this.state.visible?.clarification
      if (!clarification) {
        throw new Error("Clarification no longer available.")
      }
      text = [...clarification.optionLabels.filter((label) => decision.optionLabels.includes(label)), decision.text]
        .filter(Boolean)
        .join("\n")
    }
    if (text.length > 24_000) {
      throw new Error("Question exceeds the application's 24000-character contract.")
    }
    const submission = submissionSchema.parse({ id: randomUUID(), text, decision, status: "intended" })
    this.state.submissions.push(submission)
    this.state.next = undefined
    await this.save()
    await this.record("submission-intent", submission)
    return submission
  }

  async acknowledge(request: z.infer<typeof submissionSchema>["request"]) {
    const submission = this.state.submissions.at(-1)
    if (!submission || submission.status !== "intended") {
      throw new Error("No pending submission.")
    }
    submission.request = request
    await this.save()
    await this.record("request-observed", { submissionId: submission.id, request })
  }

  async capture(snapshot: Snapshot, visible: VisibleConversation) {
    const pending = this.state.submissions.at(-1)
    if (!pending) {
      throw new Error("No submitted question to capture.")
    }
    const questions = snapshot.messages.filter((message) => message.role === "user")
    const texts = questions.map((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    )
    const sessionChanged = this.state.sessionId && this.state.sessionId !== snapshot.conversationId
    const mixed =
      texts.length !== this.state.submissions.length ||
      texts.some((text, index) => text !== this.state.submissions[index]?.text)
    const path = join(this.directory, `capture-${randomUUID()}.json`)
    await writeFile(path, JSON.stringify(redactCredentials({ snapshot, visible }), null, 2), { flag: "wx" })
    if (sessionChanged || mixed) {
      await this.checkpoint("Conversation isolation mismatch; capture retained for reconciliation.")
      throw new Error("Conversation isolation mismatch. No further question will be sent.")
    }
    const owners = join(dirname(this.directory), ".conversation-owners")
    await mkdir(owners, { recursive: true })
    const identityFile = join(owners, createHash("sha256").update(snapshot.conversationId).digest("hex"))
    try {
      await writeFile(identityFile, resolve(this.directory), { flag: "wx" })
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error
      }
      if ((await readFile(identityFile, "utf8")) !== resolve(this.directory)) {
        await this.checkpoint(
          "This conversation belongs to another scenario attempt; capture retained, continuation refused."
        )
        throw new Error("Conversation already belongs to another attempt.")
      }
    }
    this.state.sessionId = snapshot.conversationId
    this.state.visible = visible
    if (["submitted", "streaming"].includes(snapshot.interactionStatus)) {
      await this.save()
      await this.record("capture-running", { path })
      return { settled: false }
    }
    const lastQuestion = questions.at(-1)
    const questionIndex = snapshot.messages.findIndex((message) => message.id === lastQuestion?.id)
    const answers = snapshot.messages.slice(questionIndex + 1).filter((message) => message.role === "assistant")
    const outcomes = snapshot.responseOutcomes.filter((outcome) =>
      answers.some((message) => message.id === outcome.messageId)
    )
    if (!answers.length && !visible.hasFailure && !(pending.request && pending.request.status >= 400)) {
      await this.checkpoint(
        "No answer or explicit request failure yet; await or inspect, never resubmit automatically."
      )
      return { settled: false }
    }
    this.state.visible.hasFailure ||=
      !answers.length ||
      outcomes.some((outcome) => ["failed", "cancelled", "partial", "unknown", "exhausted"].includes(outcome.status))
    pending.status = "captured"
    pending.messageIds = answers.map((message) => message.id)
    this.state.blocker = undefined
    await this.save()
    await this.record("exchange-captured", { path, submissionId: pending.id, outcomes, request: pending.request })
    return { settled: true }
  }
}

export function parseCapture(value: unknown) {
  return z.object({ snapshot: snapshotSchema, visible: visibleConversationSchema }).parse(value)
}
