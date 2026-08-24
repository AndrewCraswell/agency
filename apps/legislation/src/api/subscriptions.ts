import { createHash, randomBytes, randomUUID } from "node:crypto"
import type { RequestIdentity } from "../auth/request-context.js"

export type SubscriptionEventType =
  | "action-added"
  | "amendment-added"
  | "document-added"
  | "meeting-cancelled"
  | "meeting-rescheduled"
  | "meeting-scheduled"
  | "query-match"
  | "record-created"
  | "record-updated"
  | "relationship-changed"
  | "status-changed"
  | "vote-added"

export type SubscriptionOwner = Readonly<{ organizationId: string | null; userId: string }>

export type SubscriptionDeliveryPreference =
  | Readonly<{ channel: "email"; destinationId: string | null; isEnabled: boolean }>
  | Readonly<{ channel: "in-app"; destinationId: null; isEnabled: boolean }>
  | Readonly<{ channel: "webhook"; destinationId: string; isEnabled: boolean }>

export type SubscriptionTarget =
  | Readonly<{
      recordId: string
      recordType: "amendment" | "bill" | "calendar" | "meeting" | "organization" | "person" | "supporting-material"
      type: "record"
    }>
  | Readonly<{
      request: Readonly<Record<string, unknown>>
      searchType: "all" | "amendments" | "bills" | "passages" | "supporting-materials"
      type: "query"
    }>

export type SubscriptionFrequency = "daily" | "hourly" | "immediate"
export type SubscriptionStatus = "active" | "cancelled" | "paused"

export type Subscription = Readonly<{
  cancelledAt: Date | null
  createdAt: Date
  delivery: readonly SubscriptionDeliveryPreference[]
  eventTypes: readonly SubscriptionEventType[]
  frequency: SubscriptionFrequency
  id: string
  name: string
  owner: SubscriptionOwner
  revision: string
  status: SubscriptionStatus
  target: SubscriptionTarget
  timezone: string
  updatedAt: Date
}>

export type CreateSubscriptionInput = Readonly<{
  delivery: readonly SubscriptionDeliveryPreference[]
  eventTypes: readonly SubscriptionEventType[]
  frequency: SubscriptionFrequency
  name: string
  target: SubscriptionTarget
  timezone: string
}>

export type UpdateSubscriptionInput = Readonly<{
  delivery?: readonly SubscriptionDeliveryPreference[]
  eventTypes?: readonly SubscriptionEventType[]
  frequency?: SubscriptionFrequency
  name?: string
  status?: "active" | "paused"
  timezone?: string
}>

export type SubscriptionEvent = Readonly<{
  changeEventId: string | null
  eventType: SubscriptionEventType
  id: string
  matchedAt: Date
  occurredAt: Date
  recordId: string
  recordType: string
  sourceUrls: readonly string[]
  subscriptionId: string
  summary: string
  title: string
}>

export type Delivery = Readonly<{
  attemptCount: number
  channel: "email" | "in-app" | "webhook"
  createdAt: Date
  deliveredAt: Date | null
  destinationId: string | null
  failureCategory: string | null
  id: string
  nextAttemptAt: Date | null
  status: "delivered" | "failed" | "pending" | "processing" | "suppressed"
  subscriptionEventIds: readonly string[]
  subscriptionId: string
}>

export type WebhookStatus = "active" | "cancelled" | "paused" | "pending-verification"

export type Webhook = Readonly<{
  activeKeyIds: readonly string[]
  cancelledAt: Date | null
  createdAt: Date
  eventTypes: readonly SubscriptionEventType[]
  id: string
  lastFailedAt: Date | null
  lastSucceededAt: Date | null
  name: string
  overlapEndsAt: Date | null
  owner: SubscriptionOwner
  revision: string
  secretLastFour: string
  status: WebhookStatus
  updatedAt: Date
  url: string
}>

export type WebhookWithSecret = Readonly<{ keyId: string; secret: string; webhook: Webhook }>

export class EncryptedWebhookSecret {
  readonly #ciphertext: string

  private constructor(ciphertext: string) {
    this.#ciphertext = ciphertext
  }

  static async protect(
    plaintext: string,
    encrypt: (plaintext: string) => Promise<string>
  ): Promise<EncryptedWebhookSecret> {
    const ciphertext = await encrypt(plaintext)
    if (ciphertext.length === 0 || ciphertext === plaintext) {
      throw new Error("Webhook secret protection must return non-empty ciphertext distinct from plaintext.")
    }
    return new EncryptedWebhookSecret(ciphertext)
  }

  unwrapForPersistence(): string {
    return this.#ciphertext
  }
}

export type WebhookSecretProtector = Readonly<{ protect(plaintext: string): Promise<EncryptedWebhookSecret> }>

export function createWebhookSecretProtector(encrypt: (plaintext: string) => Promise<string>): WebhookSecretProtector {
  return {
    protect: async (plaintext) => await EncryptedWebhookSecret.protect(plaintext, encrypt)
  }
}

export type CreateWebhookInput = Readonly<{
  eventTypes: readonly SubscriptionEventType[]
  name: string
  url: string
}>

export type UpdateWebhookInput = Readonly<{
  eventTypes?: readonly SubscriptionEventType[]
  name?: string
  status?: "paused"
  url?: string
}>

export class SubscriptionApiError extends Error {
  readonly category:
    | "conflict"
    | "forbidden"
    | "invalid_request"
    | "not_found"
    | "precondition_failed"
    | "unprocessable"
  readonly details: Readonly<Record<string, unknown>> | undefined

  constructor(
    category: "conflict" | "forbidden" | "invalid_request" | "not_found" | "precondition_failed" | "unprocessable",
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message)
    this.category = category
    this.details = details
    this.name = "SubscriptionApiError"
  }
}

export type SubscriptionRepository = Readonly<{
  activateWebhook(input: Readonly<{ id: string; revision: string; when: Date }>): Promise<Webhook>
  cancelSubscription(input: Readonly<{ id: string; revision: string; when: Date }>): Promise<Subscription>
  cancelWebhook(input: Readonly<{ id: string; revision: string; when: Date }>): Promise<Webhook>
  createSubscription(input: Readonly<{ fingerprint: string; subscription: Subscription }>): Promise<Subscription>
  createWebhook(
    input: Readonly<{ keyId: string; secretCiphertext: EncryptedWebhookSecret; webhook: Webhook }>
  ): Promise<Webhook>
  findExactSubscription(owner: SubscriptionOwner, fingerprint: string): Promise<Subscription | undefined>
  getSubscription(id: string): Promise<Subscription | undefined>
  getWebhook(id: string): Promise<Webhook | undefined>
  listDeliveries(
    input: Readonly<{ cursor?: string; limit: number; subscriptionId: string }>
  ): Promise<RepositoryPage<Delivery>>
  listSubscriptionEvents(
    input: Readonly<{ cursor?: string; limit: number; subscriptionId: string }>
  ): Promise<RepositoryPage<SubscriptionEvent>>
  listSubscriptions(
    input: Readonly<{ cursor?: string; limit: number; owner: SubscriptionOwner }>
  ): Promise<RepositoryPage<Subscription>>
  listWebhooks(
    input: Readonly<{ cursor?: string; limit: number; owner: SubscriptionOwner }>
  ): Promise<RepositoryPage<Webhook>>
  rotateWebhookSecret(
    input: Readonly<{
      id: string
      keyId: string
      overlapEndsAt: Date | null
      revision: string
      secretCiphertext: EncryptedWebhookSecret
      when: Date
    }>
  ): Promise<Webhook>
  updateSubscription(
    input: Readonly<{ id: string; patch: UpdateSubscriptionInput; revision: string; when: Date }>
  ): Promise<Subscription>
  updateWebhook(
    input: Readonly<{ id: string; patch: UpdateWebhookInput; revision: string; when: Date }>
  ): Promise<Webhook>
}>

export type RepositoryPage<T> = Readonly<{
  items: readonly T[]
  nextCursor?: string
  truncated: boolean
}>

function ownerFor(identity: RequestIdentity): SubscriptionOwner {
  return { organizationId: identity.organizationId ?? null, userId: identity.userId }
}

function canAccess(identity: RequestIdentity, owner: SubscriptionOwner): boolean {
  return identity.organizationId !== undefined && owner.organizationId === identity.organizationId
    ? true
    : owner.organizationId === null && owner.userId === identity.userId
}

function normalizeEventTypes(eventTypes: readonly SubscriptionEventType[]): readonly SubscriptionEventType[] {
  return [...new Set(eventTypes)].sort()
}

function normalizeDelivery(
  delivery: readonly SubscriptionDeliveryPreference[]
): readonly SubscriptionDeliveryPreference[] {
  return [...delivery]
    .map((item) => ({ ...item }))
    .sort((left, right) =>
      `${left.channel}:${left.destinationId ?? ""}`.localeCompare(`${right.channel}:${right.destinationId ?? ""}`)
    )
}

function subscriptionFingerprint(owner: SubscriptionOwner, input: CreateSubscriptionInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        delivery: normalizeDelivery(input.delivery).filter((item) => item.isEnabled),
        eventTypes: normalizeEventTypes(input.eventTypes),
        frequency: input.frequency,
        owner,
        target: normalizeSubscriptionTarget(input.target),
        timezone: input.timezone
      })
    )
    .digest("hex")
}

function normalizeSubscriptionTarget(target: SubscriptionTarget): SubscriptionTarget {
  if (target.type === "record") {
    return target
  }
  const request = Object.fromEntries(
    Object.entries(target.request).filter(
      ([key]) => key !== "cursor" && key !== "explain" && key !== "limit" && key !== "perTypeLimit"
    )
  )
  return { ...target, request }
}

function requireRevision(expected: string, supplied: string): void {
  if (expected !== supplied) {
    throw new SubscriptionApiError("precondition_failed", "The supplied If-Match revision is stale.")
  }
}

function requireMutableInput(input: UpdateSubscriptionInput): void {
  if (Object.keys(input).length === 0) {
    throw new SubscriptionApiError("invalid_request", "A merge patch must contain at least one mutable field.")
  }
}

function validateSubscriptionInput(input: CreateSubscriptionInput): void {
  if (input.name.trim().length === 0 || input.name.trim().length > 120) {
    throw new SubscriptionApiError("invalid_request", "Subscription name must contain 1 to 120 characters.")
  }
  if (input.eventTypes.length === 0) {
    throw new SubscriptionApiError("invalid_request", "At least one subscription event type is required.")
  }
  if (!input.delivery.some((item) => item.isEnabled)) {
    throw new SubscriptionApiError("invalid_request", "At least one subscription delivery channel must be enabled.")
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input.timezone })
  } catch {
    throw new SubscriptionApiError("invalid_request", "Timezone must be a valid IANA timezone.")
  }

  if (input.target.type === "query") {
    const allowed = new Set<SubscriptionEventType>(["query-match", "record-created", "record-updated"])
    if (input.eventTypes.some((eventType) => !allowed.has(eventType))) {
      throw new SubscriptionApiError(
        "invalid_request",
        "Query subscriptions support only record-created, record-updated, and query-match events."
      )
    }
  } else {
    const allowed = allowedRecordEvents(input.target.recordType)
    if (input.eventTypes.some((eventType) => !allowed.has(eventType))) {
      throw new SubscriptionApiError(
        "invalid_request",
        "One or more events are not supported by this subscription target."
      )
    }
  }
}

function allowedRecordEvents(
  recordType: Extract<SubscriptionTarget, { type: "record" }>["recordType"]
): ReadonlySet<SubscriptionEventType> {
  switch (recordType) {
    case "bill":
      return new Set([
        "action-added",
        "amendment-added",
        "document-added",
        "record-updated",
        "relationship-changed",
        "status-changed",
        "vote-added"
      ])
    case "amendment":
      return new Set(["action-added", "document-added", "record-updated", "relationship-changed", "status-changed"])
    case "person":
      return new Set(["amendment-added", "record-updated", "relationship-changed", "vote-added"])
    case "organization":
      return new Set([
        "meeting-cancelled",
        "meeting-rescheduled",
        "meeting-scheduled",
        "record-updated",
        "relationship-changed"
      ])
    case "meeting":
    case "calendar":
      return new Set([
        "document-added",
        "meeting-cancelled",
        "meeting-rescheduled",
        "meeting-scheduled",
        "record-updated",
        "relationship-changed"
      ])
    case "supporting-material":
      return new Set(["document-added", "record-updated", "relationship-changed"])
  }
}

export class SubscriptionService {
  private readonly identifiers: () => string
  private readonly now: () => Date
  private readonly repository: SubscriptionRepository
  private readonly secretProtector: WebhookSecretProtector

  constructor(
    repository: SubscriptionRepository,
    secretProtector: WebhookSecretProtector,
    now: () => Date = () => new Date(),
    identifiers: () => string = () => randomUUID()
  ) {
    this.repository = repository
    this.secretProtector = secretProtector
    this.now = now
    this.identifiers = identifiers
  }

  async createSubscription(identity: RequestIdentity, input: CreateSubscriptionInput): Promise<Subscription> {
    validateSubscriptionInput(input)
    const owner = ownerFor(identity)
    for (const preference of input.delivery) {
      if (preference.channel !== "webhook" || !preference.isEnabled) {
        continue
      }
      const webhook = await this.repository.getWebhook(preference.destinationId)
      if (webhook === undefined || !canAccess(identity, webhook.owner) || webhook.status !== "active") {
        throw new SubscriptionApiError(
          "unprocessable",
          "An enabled webhook delivery requires an active webhook in the same scope."
        )
      }
    }
    const duplicate = await this.repository.findExactSubscription(owner, subscriptionFingerprint(owner, input))
    if (duplicate !== undefined) {
      throw new SubscriptionApiError("conflict", "An identical subscription already exists.", {
        existingSubscriptionId: duplicate.id
      })
    }
    const now = this.now()
    return await this.repository.createSubscription({
      fingerprint: subscriptionFingerprint(owner, input),
      subscription: {
        ...input,
        delivery: normalizeDelivery(input.delivery),
        eventTypes: normalizeEventTypes(input.eventTypes),
        id: `subscription:${this.identifiers()}`,
        name: input.name.trim(),
        owner,
        revision: this.identifiers(),
        status: "active",
        target: normalizeSubscriptionTarget(input.target),
        updatedAt: now,
        createdAt: now,
        cancelledAt: null
      }
    })
  }

  async getSubscription(identity: RequestIdentity, id: string): Promise<Subscription> {
    const subscription = await this.repository.getSubscription(id)
    if (subscription === undefined || !canAccess(identity, subscription.owner)) {
      throw new SubscriptionApiError("not_found", "Subscription was not found.")
    }
    return subscription
  }

  async listSubscriptions(
    identity: RequestIdentity,
    input: Readonly<{ cursor?: string; limit: number }>
  ): Promise<RepositoryPage<Subscription>> {
    return await this.repository.listSubscriptions({ ...input, owner: ownerFor(identity) })
  }

  async updateSubscription(
    identity: RequestIdentity,
    id: string,
    revision: string,
    patch: UpdateSubscriptionInput
  ): Promise<Subscription> {
    requireMutableInput(patch)
    const subscription = await this.getSubscription(identity, id)
    requireRevision(subscription.revision, revision)
    if (subscription.status === "cancelled") {
      throw new SubscriptionApiError("conflict", "Cancelled subscriptions cannot be updated.")
    }
    const candidate: CreateSubscriptionInput = {
      delivery: patch.delivery ?? subscription.delivery,
      eventTypes: patch.eventTypes ?? subscription.eventTypes,
      frequency: patch.frequency ?? subscription.frequency,
      name: patch.name ?? subscription.name,
      target: subscription.target,
      timezone: patch.timezone ?? subscription.timezone
    }
    validateSubscriptionInput(candidate)
    for (const preference of candidate.delivery) {
      if (preference.channel !== "webhook" || !preference.isEnabled) {
        continue
      }
      const webhook = await this.repository.getWebhook(preference.destinationId)
      if (webhook === undefined || !canAccess(identity, webhook.owner) || webhook.status !== "active") {
        throw new SubscriptionApiError(
          "unprocessable",
          "An enabled webhook delivery requires an active webhook in the same scope."
        )
      }
    }
    return await this.repository.updateSubscription({ id, patch, revision, when: this.now() })
  }

  async cancelSubscription(identity: RequestIdentity, id: string, revision: string): Promise<Subscription> {
    const subscription = await this.getSubscription(identity, id)
    requireRevision(subscription.revision, revision)
    return await this.repository.cancelSubscription({ id, revision, when: this.now() })
  }

  async listSubscriptionEvents(
    identity: RequestIdentity,
    id: string,
    input: Readonly<{ cursor?: string; limit: number }>
  ): Promise<RepositoryPage<SubscriptionEvent>> {
    await this.getSubscription(identity, id)
    return await this.repository.listSubscriptionEvents({ ...input, subscriptionId: id })
  }

  async listDeliveries(
    identity: RequestIdentity,
    id: string,
    input: Readonly<{ cursor?: string; limit: number }>
  ): Promise<RepositoryPage<Delivery>> {
    await this.getSubscription(identity, id)
    return await this.repository.listDeliveries({ ...input, subscriptionId: id })
  }

  async getWebhook(identity: RequestIdentity, id: string): Promise<Webhook> {
    const webhook = await this.repository.getWebhook(id)
    if (webhook === undefined || !canAccess(identity, webhook.owner)) {
      throw new SubscriptionApiError("not_found", "Webhook was not found.")
    }
    return webhook
  }

  async listWebhooks(
    identity: RequestIdentity,
    input: Readonly<{ cursor?: string; limit: number }>
  ): Promise<RepositoryPage<Webhook>> {
    return await this.repository.listWebhooks({ ...input, owner: ownerFor(identity) })
  }

  async createWebhook(identity: RequestIdentity, input: CreateWebhookInput): Promise<WebhookWithSecret> {
    validateWebhookInput(input)
    const now = this.now()
    const secret = randomBytes(32).toString("base64url")
    const secretCiphertext = await this.secretProtector.protect(secret)
    const keyId = `webhook-key:${this.identifiers()}`
    const webhook: Webhook = {
      activeKeyIds: [keyId],
      cancelledAt: null,
      createdAt: now,
      eventTypes: normalizeEventTypes(input.eventTypes),
      id: `webhook:${this.identifiers()}`,
      lastFailedAt: null,
      lastSucceededAt: null,
      name: input.name.trim(),
      overlapEndsAt: null,
      owner: ownerFor(identity),
      revision: this.identifiers(),
      secretLastFour: secret.slice(-4),
      status: "pending-verification",
      updatedAt: now,
      url: input.url
    }
    const created = await this.repository.createWebhook({ keyId, secretCiphertext, webhook })
    return { keyId, secret, webhook: created }
  }

  async updateWebhook(
    identity: RequestIdentity,
    id: string,
    revision: string,
    patch: UpdateWebhookInput
  ): Promise<Webhook> {
    requireMutableInput(patch)
    const webhook = await this.getWebhook(identity, id)
    requireRevision(webhook.revision, revision)
    if (webhook.status === "cancelled") {
      throw new SubscriptionApiError("conflict", "Cancelled webhooks cannot be updated.")
    }
    if (patch.url !== undefined) {
      validateWebhookInput({ eventTypes: webhook.eventTypes, name: webhook.name, url: patch.url })
    }
    return await this.repository.updateWebhook({ id, patch, revision, when: this.now() })
  }

  async cancelWebhook(identity: RequestIdentity, id: string, revision: string): Promise<Webhook> {
    const webhook = await this.getWebhook(identity, id)
    requireRevision(webhook.revision, revision)
    return await this.repository.cancelWebhook({ id, revision, when: this.now() })
  }

  async rotateWebhookSecret(
    identity: RequestIdentity,
    id: string,
    revision: string,
    overlapSeconds = 3600
  ): Promise<WebhookWithSecret> {
    if (!Number.isInteger(overlapSeconds) || overlapSeconds < 0 || overlapSeconds > 86_400) {
      throw new SubscriptionApiError("invalid_request", "overlapSeconds must be an integer from 0 through 86400.")
    }
    const webhook = await this.getWebhook(identity, id)
    requireRevision(webhook.revision, revision)
    if (webhook.status === "cancelled") {
      throw new SubscriptionApiError("conflict", "Cancelled webhooks cannot rotate signing keys.")
    }
    const now = this.now()
    const secret = randomBytes(32).toString("base64url")
    const secretCiphertext = await this.secretProtector.protect(secret)
    const keyId = `webhook-key:${this.identifiers()}`
    const rotated = await this.repository.rotateWebhookSecret({
      id,
      keyId,
      overlapEndsAt: overlapSeconds === 0 ? null : new Date(now.getTime() + overlapSeconds * 1000),
      revision,
      secretCiphertext,
      when: now
    })
    return { keyId, secret, webhook: rotated }
  }

  async activateWebhook(identity: RequestIdentity, id: string, revision: string): Promise<Webhook> {
    const webhook = await this.getWebhook(identity, id)
    requireRevision(webhook.revision, revision)
    if (webhook.status === "cancelled") {
      throw new SubscriptionApiError("conflict", "Cancelled webhooks cannot be verified.")
    }
    return await this.repository.activateWebhook({ id, revision, when: this.now() })
  }
}

export function validateWebhookInput(input: CreateWebhookInput): void {
  if (input.name.trim().length === 0 || input.name.trim().length > 120) {
    throw new SubscriptionApiError("invalid_request", "Webhook name must contain 1 to 120 characters.")
  }
  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    throw new SubscriptionApiError("invalid_request", "Webhook URL must be absolute.")
  }
  if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0 || input.url.length > 2048) {
    throw new SubscriptionApiError(
      "invalid_request",
      "Webhook URL must be a credential-free HTTPS URL up to 2048 characters."
    )
  }
}
