import { and, asc, eq, lte, or, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { WebhookEnvelopeSchema, type WebhookEnvelope } from "../contracts/webhook"
import { webhookDeliveries } from "./schema"

const WebhookDeliveryRecordSchema = createSelectSchema(webhookDeliveries, {
  normalizedEnvelope: WebhookEnvelopeSchema,
  processingStatus: z.enum(["normalized", "dispatching", "dispatched", "ignored", "failed", "quarantined"])
})

export type WebhookDeliveryRecord = z.infer<typeof WebhookDeliveryRecordSchema>

export interface WebhookDeliveryStore {
  insert(envelope: WebhookEnvelope, rawPayload: string): Promise<{ created: boolean; record: WebhookDeliveryRecord }>
  listDispatchable(limit: number): Promise<string[]>
  claim(deliveryId: string): Promise<WebhookDeliveryRecord | null>
  complete(deliveryId: string, status: "dispatched" | "ignored" | "failed", error?: string): Promise<void>
  requeueRecoverable(staleBefore: Date, maximumAttempts: number): Promise<number>
}

export class PostgresWebhookDeliveryStore implements WebhookDeliveryStore {
  readonly #database: NodePgDatabase<{ webhookDeliveries: typeof webhookDeliveries }>

  constructor(database: NodePgDatabase<{ webhookDeliveries: typeof webhookDeliveries }>) {
    this.#database = database
  }

  async insert(envelopeInput: WebhookEnvelope, rawPayload: string) {
    const envelope = WebhookEnvelopeSchema.parse(envelopeInput)
    const inserted = await this.#database
      .insert(webhookDeliveries)
      .values({
        deliveryId: envelope.deliveryId,
        provider: envelope.provider,
        correlationId: envelope.correlationId,
        eventName: envelope.eventName,
        action: envelope.action,
        installationId: envelope.installationId,
        repositoryOwner: envelope.repository?.owner,
        repositoryName: envelope.repository?.name,
        payloadDigest: envelope.payloadDigest,
        rawPayload,
        normalizedEnvelope: envelope,
        processingStatus: envelope.operation === "ignore" ? "ignored" : "normalized",
        receivedAt: new Date(envelope.receivedAt)
      })
      .onConflictDoNothing({ target: webhookDeliveries.deliveryId })
      .returning()
    const created = inserted.length === 1
    const rows = created
      ? inserted
      : await this.#database
          .select()
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.deliveryId, envelope.deliveryId))
          .limit(1)
    const record = rows[0]
    if (record === undefined) {
      throw new Error(`Webhook delivery ${envelope.deliveryId} was not persisted`)
    }
    return { created, record: WebhookDeliveryRecordSchema.parse(record) }
  }

  async claim(deliveryId: string): Promise<WebhookDeliveryRecord | null> {
    const rows = await this.#database
      .update(webhookDeliveries)
      .set({
        processingStatus: "dispatching",
        attemptCount: sql`${webhookDeliveries.attemptCount} + 1`,
        nextAttemptAt: null,
        updatedAt: new Date()
      })
      .where(and(eq(webhookDeliveries.deliveryId, deliveryId), eq(webhookDeliveries.processingStatus, "normalized")))
      .returning()
    const row = rows[0]
    return row === undefined ? null : WebhookDeliveryRecordSchema.parse(row)
  }

  async complete(deliveryId: string, status: "dispatched" | "ignored" | "failed", error?: string): Promise<void> {
    const nextAttemptAt = status === "failed" ? new Date(Date.now() + 5 * 60 * 1_000) : null
    await this.#database
      .update(webhookDeliveries)
      .set({ processingStatus: status, nextAttemptAt, lastError: error, updatedAt: new Date() })
      .where(eq(webhookDeliveries.deliveryId, deliveryId))
  }

  async listDispatchable(limitInput: number): Promise<string[]> {
    const limit = z.number().int().positive().max(100).parse(limitInput)
    const rows = await this.#database
      .select({ deliveryId: webhookDeliveries.deliveryId })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.processingStatus, "normalized"))
      .orderBy(asc(webhookDeliveries.receivedAt))
      .limit(limit)
    return rows.map((row) => row.deliveryId)
  }

  async requeueRecoverable(staleBefore: Date, maximumAttemptsInput: number): Promise<number> {
    const maximumAttempts = z.number().int().positive().max(10).parse(maximumAttemptsInput)
    const now = new Date()
    const rows = await this.#database
      .update(webhookDeliveries)
      .set({ processingStatus: "normalized", nextAttemptAt: null, updatedAt: now })
      .where(
        and(
          sql`${webhookDeliveries.attemptCount} < ${maximumAttempts}`,
          or(
            and(eq(webhookDeliveries.processingStatus, "dispatching"), lte(webhookDeliveries.updatedAt, staleBefore)),
            and(eq(webhookDeliveries.processingStatus, "failed"), lte(webhookDeliveries.nextAttemptAt, now))
          )
        )
      )
      .returning({ deliveryId: webhookDeliveries.deliveryId })
    return rows.length
  }
}
