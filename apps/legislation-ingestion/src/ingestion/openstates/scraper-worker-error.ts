/** The caller must not release ownership when the runtime cannot prove the worker has stopped. */
export class ScraperWorkerStopUnconfirmedError extends Error {
  constructor(options?: ErrorOptions) {
    super("Scraper worker shutdown could not be confirmed; retain ownership and inspect the runtime", options)
    this.name = "ScraperWorkerStopUnconfirmedError"
  }
}

export class ScraperBatchAlreadyPromotedError extends Error {
  constructor() {
    super("Frozen batch already has a committed promotion receipt")
    this.name = "ScraperBatchAlreadyPromotedError"
  }
}
