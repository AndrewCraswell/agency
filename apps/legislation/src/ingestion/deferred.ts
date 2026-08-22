/**
 * A controlled handoff to an orchestrator waitpoint. This is not a provider
 * failure: callers release local leases and resume at retryAt.
 */
export class DeferredIngestionError extends Error {
  readonly deferKind?: string
  readonly retryAt: Date

  constructor(message: string, retryAt: Date, deferKind?: string) {
    super(message)
    this.deferKind = deferKind
    this.name = "DeferredIngestionError"
    this.retryAt = retryAt
  }
}

export function isDeferredIngestionError(error: unknown): error is DeferredIngestionError {
  return error instanceof DeferredIngestionError
}
