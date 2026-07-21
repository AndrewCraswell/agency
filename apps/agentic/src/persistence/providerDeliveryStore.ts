import { and, asc, eq, lte, or, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { NangoWebhookReceiptSchema, type NangoWebhookReceipt } from "../webhooks/nango"
import { providerDeliveries } from "./schema"

const ProviderDeliveryRecordSchema = createSelectSchema(providerDeliveries, {
  receipt: NangoWebhookReceiptSchema,
  status: z.enum(["pending", "dispatching", "dispatched", "failed", "quarantined"])
})

export type ProviderDeliveryRecord = z.infer<typeof ProviderDeliveryRecordSchema>

export interface ProviderDeliveryStore {
  insert(
    receipt: NangoWebhookReceipt,
    deliveryKey: string,
    rawPayloadDigest: string
  ): Promise<{ created: boolean; record: ProviderDeliveryRecord }>
  listPending(limit: number): Promise<string[]>
  claim(deliveryKey: string): Promise<ProviderDeliveryRecord | null>
  complete(deliveryKey: string, matchedCount: number): Promise<void>
  fail(deliveryKey: string, error: string, quarantine: boolean): Promise<void>
  recover(staleBefore: Date, maximumAttempts: number): Promise<number>
}

export class PostgresProviderDeliveryStore implements ProviderDeliveryStore {
  readonly #database: NodePgDatabase<{ providerDeliveries: typeof providerDeliveries }>
  readonly #now: () => Date

  constructor(
    database: NodePgDatabase<{ providerDeliveries: typeof providerDeliveries }>,
    now: () => Date = () => new Date()
  ) {
    this.#database = database
    this.#now = now
  }

  async insert(receiptInput: NangoWebhookReceipt, deliveryKeyInput: string, rawPayloadDigestInput: string) {
    const receipt = NangoWebhookReceiptSchema.parse(receiptInput)
    const deliveryKey = z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .parse(deliveryKeyInput)
    const rawPayloadDigest = z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .parse(rawPayloadDigestInput)
    const inserted = await this.#database
      .insert(providerDeliveries)
      .values({ deliveryKey, provider: "nango", receipt, rawPayloadDigest, status: "pending" })
      .onConflictDoNothing({ target: providerDeliveries.deliveryKey })
      .returning()
    const created = inserted.length === 1
    const rows = created
      ? inserted
      : await this.#database
          .select()
          .from(providerDeliveries)
          .where(eq(providerDeliveries.deliveryKey, deliveryKey))
          .limit(1)
    const record = rows[0]
    if (record === undefined) throw new Error(`Provider delivery ${deliveryKey} was not persisted`)
    return { created, record: ProviderDeliveryRecordSchema.parse(record) }
  }

  async listPending(limitInput: number): Promise<string[]> {
    const limit = z.number().int().positive().max(100).parse(limitInput)
    const rows = await this.#database
      .select({ deliveryKey: providerDeliveries.deliveryKey })
      .from(providerDeliveries)
      .where(eq(providerDeliveries.status, "pending"))
      .orderBy(asc(providerDeliveries.receivedAt))
      .limit(limit)
    return rows.map(({ deliveryKey }) => deliveryKey)
  }

  async claim(deliveryKey: string): Promise<ProviderDeliveryRecord | null> {
    const now = this.#now()
    const rows = await this.#database
      .update(providerDeliveries)
      .set({
        status: "dispatching",
        attemptCount: sql`${providerDeliveries.attemptCount} + 1`,
        dispatchStartedAt: now,
        nextAttemptAt: null,
        updatedAt: now
      })
      .where(and(eq(providerDeliveries.deliveryKey, deliveryKey), eq(providerDeliveries.status, "pending")))
      .returning()
    return rows[0] === undefined ? null : ProviderDeliveryRecordSchema.parse(rows[0])
  }

  async complete(deliveryKey: string, matchedCountInput: number): Promise<void> {
    const matchedCount = z.number().int().nonnegative().parse(matchedCountInput)
    const now = this.#now()
    await this.#database
      .update(providerDeliveries)
      .set({ status: "dispatched", matchedCount, lastError: null, dispatchedAt: now, updatedAt: now })
      .where(and(eq(providerDeliveries.deliveryKey, deliveryKey), eq(providerDeliveries.status, "dispatching")))
  }

  async fail(deliveryKey: string, errorInput: string, quarantine: boolean): Promise<void> {
    const error = z.string().min(1).max(1_000).parse(errorInput)
    const now = this.#now()
    await this.#database
      .update(providerDeliveries)
      .set({
        status: quarantine ? "quarantined" : "failed",
        lastError: error,
        failedAt: now,
        quarantinedAt: quarantine ? now : null,
        nextAttemptAt: quarantine ? null : new Date(now.getTime() + 5 * 60 * 1_000),
        updatedAt: now
      })
      .where(and(eq(providerDeliveries.deliveryKey, deliveryKey), eq(providerDeliveries.status, "dispatching")))
  }

  async recover(staleBefore: Date, maximumAttemptsInput: number): Promise<number> {
    const maximumAttempts = z.number().int().positive().max(10).parse(maximumAttemptsInput)
    const now = this.#now()
    const recoverable = or(
      and(eq(providerDeliveries.status, "dispatching"), lte(providerDeliveries.dispatchStartedAt, staleBefore)),
      and(eq(providerDeliveries.status, "failed"), lte(providerDeliveries.nextAttemptAt, now))
    )
    const quarantined = await this.#database
      .update(providerDeliveries)
      .set({ status: "quarantined", quarantinedAt: now, nextAttemptAt: null, updatedAt: now })
      .where(and(recoverable, sql`${providerDeliveries.attemptCount} >= ${maximumAttempts}`))
      .returning({ deliveryKey: providerDeliveries.deliveryKey })
    const pending = await this.#database
      .update(providerDeliveries)
      .set({ status: "pending", dispatchStartedAt: null, nextAttemptAt: null, updatedAt: now })
      .where(and(recoverable, sql`${providerDeliveries.attemptCount} < ${maximumAttempts}`))
      .returning({ deliveryKey: providerDeliveries.deliveryKey })
    return quarantined.length + pending.length
  }
}
