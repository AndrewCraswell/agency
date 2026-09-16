import { describe, expect, it } from "vitest"
import { createCongressSynchronizationIdentity } from "../identities.js"
import { scheduledTaskIdentifierFor } from "./schedule-dispatcher.js"

describe("scheduled Congress routing", () => {
  it("never schedules an independent Congress domain worker", () => {
    for (const domain of ["amendments", "entities", "events", "house-votes", "committee-reports"] as const) {
      expect(scheduledTaskIdentifierFor(createCongressSynchronizationIdentity(domain, 119))).toBe(
        "congress-wave-coordinator"
      )
    }
    expect(scheduledTaskIdentifierFor(createCongressSynchronizationIdentity("bills"))).toBe("congress-wave-coordinator")
  })
})
