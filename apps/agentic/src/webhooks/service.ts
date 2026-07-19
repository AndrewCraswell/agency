import { z } from "zod"
import type { WebhookEnvelope } from "../contracts/webhook"
import type { WebhookDeliveryStore } from "../persistence/webhookStore"
import { normalizeGitHubEvent } from "./normalize"
import { verifyGitHubSignature } from "./signature"

const HeaderSchema = z
  .object({
    deliveryId: z.uuid(),
    eventName: z.string().regex(/^[a-z_]+$/u),
    signature: z.string()
  })
  .strict()

export interface WebhookEventRouter {
  route(envelope: WebhookEnvelope): Promise<void>
}

export class DurableWebhookDispatcher {
  readonly #store: WebhookDeliveryStore
  readonly #router: WebhookEventRouter

  constructor(store: WebhookDeliveryStore, router: WebhookEventRouter) {
    this.#store = store
    this.#router = router
  }

  async dispatchPending(limit = 25): Promise<number> {
    const deliveryIds = await this.#store.listDispatchable(limit)
    await Promise.all(deliveryIds.map((deliveryId) => this.dispatch(deliveryId)))
    return deliveryIds.length
  }

  async dispatch(deliveryId: string): Promise<void> {
    const delivery = await this.#store.claim(deliveryId)
    if (delivery === null) {
      return
    }
    try {
      await this.#router.route(delivery.normalizedEnvelope)
      await this.#store.complete(deliveryId, "dispatched")
    } catch (error) {
      await this.#store.complete(
        deliveryId,
        "failed",
        error instanceof Error ? error.message.slice(0, 1_000) : "Dispatch failed"
      )
    }
  }
}

export class GitHubWebhookService {
  readonly #secret: string
  readonly #assignmentLabel: string
  readonly #botLogin: string | undefined
  readonly #store: WebhookDeliveryStore
  readonly #dispatcher: DurableWebhookDispatcher
  readonly #now: () => Date

  constructor(input: {
    secret: string
    assignmentLabel: string
    botLogin?: string
    store: WebhookDeliveryStore
    router: WebhookEventRouter
    now?: () => Date
  }) {
    this.#secret = z.string().min(1).parse(input.secret)
    this.#assignmentLabel = z.string().trim().min(1).parse(input.assignmentLabel)
    this.#botLogin = input.botLogin
    this.#store = input.store
    this.#dispatcher = new DurableWebhookDispatcher(input.store, input.router)
    this.#now = input.now ?? (() => new Date())
  }

  async receive(input: {
    deliveryId: string | undefined
    eventName: string | undefined
    signature: string | undefined
    rawBody: Buffer
  }) {
    if (!verifyGitHubSignature(input.rawBody, input.signature, this.#secret)) {
      throw new Error("Invalid GitHub webhook signature")
    }
    const headers = HeaderSchema.parse({
      deliveryId: input.deliveryId,
      eventName: input.eventName,
      signature: input.signature
    })
    const envelope = normalizeGitHubEvent({
      deliveryId: headers.deliveryId,
      eventName: headers.eventName,
      rawBody: input.rawBody,
      receivedAt: this.#now(),
      assignmentLabel: this.#assignmentLabel,
      ...(this.#botLogin === undefined ? {} : { botLogin: this.#botLogin })
    })
    const persisted = await this.#store.insert(envelope, input.rawBody.toString("utf8"))
    return {
      deliveryId: envelope.deliveryId,
      created: persisted.created,
      dispatch: persisted.created && envelope.operation !== "ignore"
    }
  }

  async dispatch(deliveryId: string): Promise<void> {
    await this.#dispatcher.dispatch(deliveryId)
  }
}
