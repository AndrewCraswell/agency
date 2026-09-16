import { AsyncLocalStorage } from "node:async_hooks"

export const requestSignals = new AsyncLocalStorage<AbortSignal>()
