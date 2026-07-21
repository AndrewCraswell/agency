import type { ProviderDeliveryStore } from "../persistence/providerDeliveryStore"
import type { WorkflowService } from "../workflows/service"

const MAXIMUM_ATTEMPTS = 3
const STALE_DISPATCH_MS = 5 * 60 * 1_000

export class ProviderDeliveryDispatcher {
  readonly #store: ProviderDeliveryStore
  readonly #receiveWebhook: WorkflowService["receiveWebhook"]
  readonly #now: () => Date

  constructor(
    store: ProviderDeliveryStore,
    receiveWebhook: WorkflowService["receiveWebhook"],
    now: () => Date = () => new Date()
  ) {
    this.#store = store
    this.#receiveWebhook = receiveWebhook
    this.#now = now
  }

  async dispatchPending(limit = 25): Promise<number> {
    await this.#store.recover(new Date(this.#now().getTime() - STALE_DISPATCH_MS), MAXIMUM_ATTEMPTS)
    const deliveryKeys = await this.#store.listPending(limit)
    await Promise.all(deliveryKeys.map((deliveryKey) => this.dispatch(deliveryKey)))
    return deliveryKeys.length
  }

  async dispatch(deliveryKey: string): Promise<void> {
    const delivery = await this.#store.claim(deliveryKey)
    if (delivery === null) return
    try {
      const matchedCount = await this.#receiveWebhook(delivery.receipt, delivery.deliveryKey)
      await this.#store.complete(delivery.deliveryKey, matchedCount)
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1_000) : "Provider delivery dispatch failed"
      await this.#store.fail(delivery.deliveryKey, message, delivery.attemptCount >= MAXIMUM_ATTEMPTS)
    }
  }
}
