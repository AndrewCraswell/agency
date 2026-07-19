import { z } from "zod"

export const WEBHOOK_ENVELOPE_SCHEMA_VERSION = "1" as const

export const WebhookOperationSchema = z.enum([
  "create",
  "resume",
  "cancel",
  "record_evidence",
  "request_review",
  "apply_review",
  "ignore"
])

export const WebhookEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(WEBHOOK_ENVELOPE_SCHEMA_VERSION),
    provider: z.literal("github"),
    deliveryId: z.string().uuid(),
    correlationId: z.uuid(),
    eventName: z.string().regex(/^[a-z_]+$/u),
    action: z
      .string()
      .regex(/^[a-z_]+$/u)
      .nullable(),
    operation: WebhookOperationSchema,
    installationId: z.string().regex(/^\d+$/u).nullable(),
    repository: z
      .object({
        owner: z.string().trim().min(1),
        name: z.string().trim().min(1)
      })
      .strict()
      .nullable(),
    actor: z
      .object({
        login: z.string().trim().min(1),
        type: z.string().trim().min(1)
      })
      .strict()
      .nullable(),
    issueNumber: z.number().int().positive().nullable(),
    pullRequestNumber: z.number().int().positive().nullable(),
    headCommitSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/u)
      .nullable(),
    review: z
      .object({
        id: z.number().int().positive(),
        state: z.enum(["approved", "changes_requested", "commented", "dismissed", "pending"])
      })
      .strict()
      .nullable(),
    checkId: z.number().int().positive().nullable(),
    command: z.enum(["resume", "cancel", "retry"]).nullable(),
    untrustedText: z
      .object({
        title: z.string().max(500).nullable(),
        body: z.string().max(20_000).nullable()
      })
      .strict(),
    payloadDigest: z.string().regex(/^[0-9a-f]{64}$/u),
    receivedAt: z.iso.datetime({ offset: true })
  })
  .strict()

export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>
