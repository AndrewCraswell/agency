import { describe, expect, it, vi } from "vitest"
import { WebhookEnvelopeSchema } from "../contracts/webhook"
import { PostgresWebhookDeliveryStore } from "./webhookStore"

const envelope = WebhookEnvelopeSchema.parse({
  schemaVersion: "1",
  provider: "github",
  deliveryId: "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1",
  correlationId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
  eventName: "issues",
  action: "labeled",
  operation: "create",
  installationId: "42",
  repository: { owner: "AndrewCraswell", name: "agency" },
  actor: { login: "andrew", type: "User" },
  issueNumber: 123,
  pullRequestNumber: null,
  headCommitSha: null,
  review: null,
  checkId: null,
  command: null,
  untrustedText: { title: "Task", body: null },
  payloadDigest: "a".repeat(64),
  receivedAt: "2026-07-19T12:00:00.000Z"
})

function record(overrides: Record<string, unknown> = {}) {
  return {
    deliveryId: envelope.deliveryId,
    provider: "github",
    correlationId: envelope.correlationId,
    eventName: envelope.eventName,
    action: envelope.action,
    installationId: envelope.installationId,
    repositoryOwner: envelope.repository?.owner ?? null,
    repositoryName: envelope.repository?.name ?? null,
    payloadDigest: envelope.payloadDigest,
    rawPayload: "{}",
    normalizedEnvelope: envelope,
    processingStatus: "normalized",
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    receivedAt: new Date(envelope.receivedAt),
    updatedAt: new Date(envelope.receivedAt),
    ...overrides
  }
}

function insertDatabase(inserted: unknown[], selected: unknown[] = []) {
  const returning = vi.fn(async () => inserted)
  const onConflictDoNothing = vi.fn(() => ({ returning }))
  const values = vi.fn(() => ({ onConflictDoNothing }))
  const limit = vi.fn(async () => selected)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  return {
    database: { insert: vi.fn(() => ({ values })), select: vi.fn(() => ({ from })) },
    values
  }
}

function updateDatabase(rows: unknown[] = []) {
  const returning = vi.fn(async () => rows)
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  return { database: { update: vi.fn(() => ({ set })) }, set }
}

describe("PostgresWebhookDeliveryStore", () => {
  it("inserts a normalized delivery and returns an existing duplicate", async () => {
    const createdDatabase = insertDatabase([record()])
    const createdStore = new PostgresWebhookDeliveryStore(createdDatabase.database as never)

    await expect(createdStore.insert(envelope, "{}")).resolves.toMatchObject({ created: true })
    expect(createdDatabase.values).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: envelope.deliveryId, processingStatus: "normalized" })
    )

    const duplicateDatabase = insertDatabase([], [record()])
    const duplicateStore = new PostgresWebhookDeliveryStore(duplicateDatabase.database as never)

    await expect(duplicateStore.insert(envelope, "{}")).resolves.toMatchObject({ created: false })
  })

  it("claims one normalized delivery and tolerates a lost claim", async () => {
    const claimedDatabase = updateDatabase([record({ processingStatus: "dispatching", attemptCount: 1 })])
    const claimedStore = new PostgresWebhookDeliveryStore(claimedDatabase.database as never)

    await expect(claimedStore.claim(envelope.deliveryId)).resolves.toMatchObject({ processingStatus: "dispatching" })
    expect(claimedDatabase.set).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "dispatching", nextAttemptAt: null })
    )

    const lostDatabase = updateDatabase([])
    await expect(
      new PostgresWebhookDeliveryStore(lostDatabase.database as never).claim(envelope.deliveryId)
    ).resolves.toBeNull()
  })

  it("records terminal and retryable dispatch outcomes", async () => {
    const failedDatabase = updateDatabase()
    const failedStore = new PostgresWebhookDeliveryStore(failedDatabase.database as never)

    await failedStore.complete(envelope.deliveryId, "failed", "temporary failure")
    expect(failedDatabase.set).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "failed", nextAttemptAt: expect.any(Date) })
    )

    const completedDatabase = updateDatabase()
    await new PostgresWebhookDeliveryStore(completedDatabase.database as never).complete(
      envelope.deliveryId,
      "dispatched"
    )
    expect(completedDatabase.set).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "dispatched", nextAttemptAt: null })
    )
  })

  it("lists dispatchable deliveries and requeues only recoverable attempts", async () => {
    const limit = vi.fn(async () => [{ deliveryId: envelope.deliveryId }])
    const orderBy = vi.fn(() => ({ limit }))
    const where = vi.fn(() => ({ orderBy }))
    const from = vi.fn(() => ({ where }))
    const store = new PostgresWebhookDeliveryStore({ select: vi.fn(() => ({ from })) } as never)

    await expect(store.listDispatchable(25)).resolves.toEqual([envelope.deliveryId])

    const requeueDatabase = updateDatabase([{ deliveryId: envelope.deliveryId }, { deliveryId: "second" }])
    const requeueStore = new PostgresWebhookDeliveryStore(requeueDatabase.database as never)
    await expect(requeueStore.requeueRecoverable(new Date("2026-07-19T11:55:00.000Z"), 3)).resolves.toBe(2)
    expect(requeueDatabase.set).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "normalized", nextAttemptAt: null })
    )
  })
})
