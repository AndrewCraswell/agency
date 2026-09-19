import { sanitizeIngestionMessage } from "./errors.js"
import type { JobCounts } from "./job.js"

export function createJobCounts(overrides: Partial<JobCounts> = {}): JobCounts {
  return { discovered: 0, failed: 0, inserted: 0, read: 0, skipped: 0, unchanged: 0, updated: 0, ...overrides }
}

export function ingestionFailureSummary(
  failures: ReadonlyArray<Readonly<{ identifier?: string; message: string }>>
): string | null {
  return (
    failures
      .slice(0, 20)
      .map((failure) =>
        sanitizeIngestionMessage(
          failure.identifier === undefined ? failure.message : `${failure.identifier}: ${failure.message}`
        )
      )
      .join("; ")
      .slice(0, 8000) || null
  )
}
