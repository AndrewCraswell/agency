import { describe, expect, it } from "vitest"
import { ingestionLeaseHandoffAt } from "./job.js"

describe("ingestion lease handoff", () => {
  it("uses PostgreSQL string timestamps instead of falling back to a short retry", () => {
    expect(ingestionLeaseHandoffAt("2026-08-20T12:46:30.119Z", new Date("2026-08-20T12:18:30.000Z"))).toEqual(
      new Date("2026-08-20T12:46:40.119Z")
    )
  })

  it("adds the handoff margin to Date values and invalid-value fallbacks", () => {
    const now = new Date("2026-08-20T12:18:30.000Z")

    expect(ingestionLeaseHandoffAt(new Date("2026-08-20T12:46:30.119Z"), now)).toEqual(
      new Date("2026-08-20T12:46:40.119Z")
    )
    expect(ingestionLeaseHandoffAt(undefined, now)).toEqual(new Date("2026-08-20T12:18:40.000Z"))
  })
})
