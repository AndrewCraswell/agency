type Waiter = {
  signal?: AbortSignal
  cancel: () => void
  accept: (release: () => void) => void
}

export class ConnectionQueue {
  #active = 0
  #waiting: Waiter[] = []
  readonly #capacity: number

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError("Connection capacity must be a positive safe integer")
    }
    this.#capacity = capacity
  }

  get waitingCount(): number {
    return this.#waiting.length
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    if (this.#active < this.#capacity) {
      this.#active += 1
      return this.#release
    }
    return await new Promise<() => void>((accept, reject) => {
      const waiter: Waiter = {
        accept,
        signal,
        cancel: () => {
          this.#waiting.splice(this.#waiting.indexOf(waiter), 1)
          reject(signal?.reason)
        }
      }
      this.#waiting.push(waiter)
      signal?.addEventListener("abort", waiter.cancel, { once: true })
    })
  }

  #release = () => {
    const next = this.#waiting.shift()
    if (next === undefined) {
      this.#active -= 1
      return
    }
    next.signal?.removeEventListener("abort", next.cancel)
    next.accept(this.#release)
  }
}
