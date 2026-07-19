import { createHash, randomUUID } from "node:crypto"
import { z } from "zod"
import { WEBHOOK_ENVELOPE_SCHEMA_VERSION, WebhookEnvelopeSchema } from "../contracts/webhook"

const PayloadSchema = z
  .object({
    action: z.string().optional(),
    installation: z.object({ id: z.number().int().positive() }).passthrough().optional(),
    repository: z
      .object({
        name: z.string().trim().min(1),
        owner: z.object({ login: z.string().trim().min(1) }).passthrough()
      })
      .passthrough()
      .optional(),
    sender: z
      .object({ login: z.string().trim().min(1), type: z.string().trim().min(1) })
      .passthrough()
      .optional(),
    issue: z
      .object({ number: z.number().int().positive(), title: z.string(), body: z.string().nullable() })
      .passthrough()
      .optional(),
    comment: z.object({ body: z.string() }).passthrough().optional(),
    label: z.object({ name: z.string() }).passthrough().optional(),
    pull_request: z
      .object({
        number: z.number().int().positive(),
        title: z.string(),
        body: z.string().nullable(),
        head: z
          .object({ sha: z.string().regex(/^[0-9a-f]{40}$/u) })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    review: z
      .object({
        id: z.number().int().positive(),
        state: z.enum(["approved", "changes_requested", "commented", "dismissed", "pending"]),
        body: z.string().nullable()
      })
      .passthrough()
      .optional(),
    check_run: z.object({ id: z.number().int().positive() }).passthrough().optional(),
    check_suite: z.object({ id: z.number().int().positive() }).passthrough().optional()
  })
  .passthrough()

const commandPattern = /^\/agency (resume|cancel|retry)$/u

export function normalizeGitHubEvent(input: {
  deliveryId: string
  eventName: string
  rawBody: Buffer
  receivedAt: Date
  assignmentLabel: string
  botLogin?: string
  correlationId?: string
}) {
  const payloadDigest = createHash("sha256").update(input.rawBody).digest("hex")
  const payload = PayloadSchema.parse(JSON.parse(input.rawBody.toString("utf8")))
  const action = payload.action ?? null
  const isBot = payload.sender?.type === "Bot" || payload.sender?.login === input.botLogin
  let operation: "create" | "resume" | "cancel" | "record_evidence" | "request_review" | "apply_review" | "ignore" =
    "ignore"
  let command: "resume" | "cancel" | "retry" | null = null

  if (!isBot && input.eventName === "issues" && action === "labeled" && payload.label?.name === input.assignmentLabel) {
    operation = "create"
  } else if (!isBot && input.eventName === "issue_comment" && action === "created") {
    const commandMatch = commandPattern.exec(payload.comment?.body.trim() ?? "")
    const matchedCommand = commandMatch?.[1]
    if (matchedCommand === "resume" || matchedCommand === "cancel" || matchedCommand === "retry") {
      command = matchedCommand
    }
    if (command === "cancel") {
      operation = "cancel"
    } else if (command === "resume" || command === "retry") {
      operation = "resume"
    }
  } else if (
    input.eventName === "pull_request" &&
    (action === "opened" || action === "reopened" || action === "ready_for_review" || action === "synchronize")
  ) {
    operation = "request_review"
  } else if (input.eventName === "pull_request" && action === "closed") {
    operation = "cancel"
  } else if (
    input.eventName === "pull_request_review" &&
    action === "submitted" &&
    (payload.review?.state === "approved" || payload.review?.state === "changes_requested")
  ) {
    operation = "apply_review"
  } else if ((input.eventName === "check_run" || input.eventName === "check_suite") && action === "completed") {
    operation = "record_evidence"
  }

  return WebhookEnvelopeSchema.parse({
    schemaVersion: WEBHOOK_ENVELOPE_SCHEMA_VERSION,
    provider: "github",
    deliveryId: input.deliveryId,
    correlationId: input.correlationId ?? randomUUID(),
    eventName: input.eventName,
    action,
    operation,
    installationId: payload.installation?.id.toString() ?? null,
    repository:
      payload.repository === undefined
        ? null
        : { owner: payload.repository.owner.login, name: payload.repository.name },
    actor: payload.sender === undefined ? null : { login: payload.sender.login, type: payload.sender.type },
    issueNumber: payload.issue?.number ?? null,
    pullRequestNumber: payload.pull_request?.number ?? null,
    headCommitSha: payload.pull_request?.head?.sha ?? null,
    review: payload.review === undefined ? null : { id: payload.review.id, state: payload.review.state },
    checkId: payload.check_run?.id ?? payload.check_suite?.id ?? null,
    command,
    untrustedText: {
      title: (payload.issue?.title ?? payload.pull_request?.title ?? null)?.slice(0, 500) ?? null,
      body:
        (
          payload.comment?.body ??
          payload.review?.body ??
          payload.issue?.body ??
          payload.pull_request?.body ??
          null
        )?.slice(0, 20_000) ?? null
    },
    payloadDigest,
    receivedAt: input.receivedAt.toISOString()
  })
}
