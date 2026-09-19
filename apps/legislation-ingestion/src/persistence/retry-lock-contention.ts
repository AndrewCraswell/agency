import { setTimeout as delay } from "node:timers/promises"

/** Only use for operations which have rolled back before rejecting. Never retry an uncertain commit. */
export async function retryLockContention<T>(
  operation: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void> = delay
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error) || !("code" in error) || error.code !== "55P03") throw error
      await wait(1000 * (attempt + 1))
    }
  }
}
