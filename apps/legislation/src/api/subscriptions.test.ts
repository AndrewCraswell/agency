import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  createWebhookSecretProtector,
  SubscriptionApiError,
  SubscriptionService,
  type Subscription,
  type SubscriptionRepository,
  type Webhook,
  type WebhookRepository
} from "./subscriptions.js"

function repository(): SubscriptionRepository & WebhookRepository {
  const subscriptions = new Map<string, Subscription>()
  const webhooks = new Map<string, Webhook>()
  const noEvents = async () => ({ items: [], truncated: false }) as const
  return {
    activateWebhook: async ({ id, revision, when }) => {
      const existing = webhooks.get(id)!
      const next: Webhook = { ...existing, revision: `${revision}-active`, status: "active", updatedAt: when }
      webhooks.set(id, next)
      return next
    },
    cancelSubscription: async ({ id, revision, when }) => {
      const existing = subscriptions.get(id)!
      const next = {
        ...existing,
        cancelledAt: when,
        revision: `${revision}-cancelled`,
        status: "cancelled" as const,
        updatedAt: when
      }
      subscriptions.set(id, next)
      return next
    },
    cancelWebhook: async ({ id, revision, when }) => {
      const existing = webhooks.get(id)!
      const next = {
        ...existing,
        cancelledAt: when,
        revision: `${revision}-cancelled`,
        status: "cancelled" as const,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    createSubscription: async ({ subscription }) => {
      subscriptions.set(subscription.id, subscription)
      return subscription
    },
    createWebhook: async ({ webhook }) => {
      webhooks.set(webhook.id, webhook)
      return webhook
    },
    findExactSubscription: async (owner, fingerprint) =>
      [...subscriptions.values()].find(
        (subscription) =>
          subscription.owner.userId === owner.userId &&
          subscription.owner.organizationId === owner.organizationId &&
          subscription.status !== "cancelled" &&
          // The in-memory test repository does not persist its internal fingerprint.
          fingerprint.length === 64 &&
          subscription.target.type === "record"
      ),
    getSubscription: async ({ id }) => subscriptions.get(id),
    getWebhook: async (id) => webhooks.get(id),
    listDeliveries: noEvents,
    listSubscriptionEvents: noEvents,
    listSubscriptions: async ({ owner }) => ({
      items: [...subscriptions.values()].filter(
        (subscription) =>
          subscription.owner.userId === owner.userId && subscription.owner.organizationId === owner.organizationId
      ),
      truncated: false
    }),
    listWebhooks: async ({ owner }) => ({
      items: [...webhooks.values()].filter(
        (webhook) => webhook.owner.userId === owner.userId && webhook.owner.organizationId === owner.organizationId
      ),
      truncated: false
    }),
    rotateWebhookSecret: async ({ id, keyId, overlapEndsAt, revision, when }) => {
      const existing = webhooks.get(id)!
      const next = {
        ...existing,
        activeKeyIds: overlapEndsAt === null ? [keyId] : [...existing.activeKeyIds, keyId],
        overlapEndsAt,
        revision: `${revision}-rotated`,
        updatedAt: when
      }
      webhooks.set(id, next)
      return next
    },
    updateSubscription: async ({ id, patch, revision, when }) => {
      const existing = subscriptions.get(id)!
      const next: Subscription = { ...existing, ...patch, revision: `${revision}-next`, updatedAt: when }
      subscriptions.set(id, next)
      return next
    },
    updateWebhook: async ({ id, patch, revision, when }) => {
      const existing = webhooks.get(id)!
      const next: Webhook = { ...existing, ...patch, revision: `${revision}-next`, updatedAt: when }
      webhooks.set(id, next)
      return next
    }
  }
}

describe("SubscriptionService", () => {
  const now = new Date("2026-08-24T12:00:00.000Z")
  const identity = { organizationId: "org:one", userId: "user:one" }

  function service() {
    let sequence = 0
    return new SubscriptionService(
      repository(),
      createWebhookSecretProtector(async (secret) => `encrypted:${secret}`),
      () => now,
      () => `id-${++sequence}`
    )
  }

  it("creates an organization-owned subscription and prevents a foreign user from reading it", async () => {
    const subject = service()
    const created = await subject.createSubscription(identity, {
      delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
      eventTypes: ["vote-added"],
      frequency: "immediate",
      name: "  Floor votes  ",
      target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
      timezone: "America/Los_Angeles"
    })

    expect(created).toMatchObject({ name: "Floor votes", status: "active" })
    await expect(subject.getSubscription({ userId: "user:two" }, created.id)).rejects.toMatchObject({
      category: "not_found"
    })
  })

  it("requires a current revision for mutation and cancellation", async () => {
    const subject = service()
    const created = await subject.createSubscription(identity, {
      delivery: [{ channel: "in-app", destinationId: null, isEnabled: true }],
      eventTypes: ["vote-added"],
      frequency: "immediate",
      name: "Floor votes",
      target: { recordId: "bill:us:119:hr:1", recordType: "bill", type: "record" },
      timezone: "America/Los_Angeles"
    })

    await expect(subject.updateSubscription(identity, created.id, "stale", { name: "Updated" })).rejects.toEqual(
      expect.objectContaining<Partial<SubscriptionApiError>>({ category: "precondition_failed" })
    )
    const updated = await subject.updateSubscription(identity, created.id, created.revision, { name: "Updated" })
    await expect(subject.cancelSubscription(identity, updated.id, updated.revision)).resolves.toMatchObject({
      status: "cancelled"
    })
  })

  it("creates a pending-verification webhook and rotates the secret with a bounded overlap", async () => {
    const subject = service()
    const created = await subject.createWebhook(identity, {
      eventTypes: ["vote-added"],
      name: "Policy pipeline",
      url: "https://hooks.example.test/legislation"
    })

    expect(created.secret).toHaveLength(43)
    expect(created.webhook.status).toBe("pending-verification")
    const rotated = await subject.rotateWebhookSecret(identity, created.webhook.id, created.webhook.revision, 60)
    expect(rotated.webhook.activeKeyIds).toHaveLength(2)
    expect(rotated.webhook.overlapEndsAt).toEqual(new Date("2026-08-24T12:01:00.000Z"))
  })
})

describe("subscription persistence constraints", () => {
  it("deduplicates personal subscriptions with a null-safe owner key", async () => {
    const migration = await readFile(
      new URL("../db/migrations/0024_subscriptions-webhooks-and-idempotency.sql", import.meta.url),
      "utf8"
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "subscriptions_exact_active_uidx" ON "legislation"."subscriptions" USING btree (coalesce("owner_organization_id", \'\'),"owner_user_id","target_fingerprint")'
    )
  })

  it("rejects a webhook secret protector that returns plaintext", async () => {
    const protector = createWebhookSecretProtector(async (plaintext) => plaintext)
    await expect(protector.protect("plaintext-secret")).rejects.toThrow("distinct from plaintext")
  })
})
