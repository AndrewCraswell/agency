import { AsyncLocalStorage } from "node:async_hooks"

const ingestionRun = new AsyncLocalStorage<string>()

export function currentIngestionRunId(): string | undefined {
  return ingestionRun.getStore()
}

export function withIngestionRun<T>(runId: string, operation: () => Promise<T>): Promise<T> {
  return ingestionRun.run(runId, operation)
}
