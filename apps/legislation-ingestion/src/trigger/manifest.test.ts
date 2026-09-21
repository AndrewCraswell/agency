import { describe, expect, it } from "vitest"
import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"
import {
  createSynchronizationScheduleManifest,
  parseManagedSynchronizationIdentity,
  SynchronizationScheduleManifestError,
  validateSynchronizationScheduleManifest
} from "./manifest.js"

describe("synchronization schedule manifest", () => {
  it("generates the complete deterministic inactive schedule inventory", () => {
    const first = createSynchronizationScheduleManifest()
    const second = createSynchronizationScheduleManifest()
    const openStatesSchedules = first.filter((schedule) => schedule.identity.provider === "openstates")
    const congressSchedules = first.filter((schedule) => schedule.identity.provider === "congress")
    const govInfoSchedules = first.filter((schedule) => schedule.identity.provider === "govinfo")
    const senateSchedules = first.filter((schedule) => schedule.identity.provider === "senate")

    expect(first).toEqual(second)
    expect(first).toHaveLength(164)
    expect(openStatesSchedules).toHaveLength(156)
    expect(congressSchedules).toHaveLength(6)
    expect(govInfoSchedules).toHaveLength(1)
    expect(senateSchedules).toHaveLength(1)
    expect(
      first.every(
        (schedule) =>
          schedule.active === false &&
          schedule.managed &&
          schedule.taskIdentifier === "schedule-dispatcher" &&
          schedule.timezone === "UTC"
      )
    ).toBe(true)
    expect(new Set(first.map((schedule) => schedule.externalId)).size).toBe(164)
    expect(new Set(first.map((schedule) => schedule.deduplicationKey)).size).toBe(164)

    for (const domain of ["bills", "entities", "events"] as const) {
      const schedules = openStatesSchedules.filter((schedule) => schedule.identity.domain === domain)
      expect(schedules).toHaveLength(52)
      expect(schedules.map((schedule) => schedule.identity.scope)).toEqual(supportedOpenStatesJurisdictions)
    }
  })

  it("uses the exact Open States phase formulas for representative jurisdictions", () => {
    const manifest = createSynchronizationScheduleManifest()

    expect(schedule(manifest, "openstates:bills:ca").cron).toBe("4,34 * * * *")
    expect(schedule(manifest, "openstates:entities:ca").cron).toBe("8 5 * * *")
    expect(schedule(manifest, "openstates:events:ca").cron).toBe("14 */2 * * *")
    expect(schedule(manifest, "openstates:bills:tx").cron).toBe("12,42 * * * *")
    expect(schedule(manifest, "openstates:entities:tx").cron).toBe("24 6 * * *")
    expect(schedule(manifest, "openstates:events:tx").cron).toBe("22 */2 * * *")
    expect(schedule(manifest, "openstates:bills:dc").cron).toBe("20,50 * * * *")
    expect(schedule(manifest, "openstates:entities:dc").cron).toBe("40 6 * * *")
    expect(schedule(manifest, "openstates:events:dc").cron).toBe("0 */2 * * *")
    expect(schedule(manifest, "openstates:bills:pr").cron).toBe("21,51 * * * *")
    expect(schedule(manifest, "openstates:entities:pr").cron).toBe("42 6 * * *")
    expect(schedule(manifest, "openstates:events:pr").cron).toBe("1 */2 * * *")

    const phaseSizes = Array.from(
      { length: 30 },
      (_, phase) =>
        manifest
          .filter((entry) => entry.identity.provider === "openstates" && entry.identity.domain === "bills")
          .filter((entry) => entry.cron.startsWith(`${phase},`)).length
    )
    expect(phaseSizes).toEqual([...Array<number>(22).fill(2), ...Array<number>(8).fill(1)])
  })

  it("uses the exact Congress timeline and configured current Congress", () => {
    const manifest = createSynchronizationScheduleManifest({ currentCongress: 120, environment: "staging" })

    expect(schedule(manifest, "congress:bills:current").cron).toBe("0 * * * *")
    expect(schedule(manifest, "congress:amendments:120").cron).toBe("5 * * * *")
    expect(schedule(manifest, "congress:events:120").cron).toBe("20 * * * *")
    expect(schedule(manifest, "congress:house-votes:120").cron).toBe("35 * * * *")
    expect(schedule(manifest, "congress:committee-reports:120").cron).toBe("50 */6 * * *")
    expect(schedule(manifest, "congress:entities:120").cron).toBe("10 3 * * *")
    expect(schedule(manifest, "senate:votes:120")).toMatchObject({
      cron: "40 * * * *",
      workerTaskIdentifier: "senate-votes-sync"
    })
    expect(schedule(manifest, "congress:events:120").deduplicationKey).toBe("staging:congress:events:120")
    expect(
      congressSchedules(manifest).every((entry) => entry.workerTaskIdentifier === "congress-wave-coordinator")
    ).toBe(true)
    expect(schedule(manifest, "govinfo:bill-status:120")).toMatchObject({
      cron: "45 11 * * *",
      timezone: "UTC",
      workerTaskIdentifier: "govinfo-bill-status-sync"
    })
  })

  it("only activates the singleton Congress wave ingress and GovInfo with standard activation", () => {
    const manifest = createSynchronizationScheduleManifest({ active: true })

    expect(manifest.filter((entry) => entry.identity.provider === "openstates").every((entry) => !entry.active)).toBe(
      true
    )
    const activeCongress = manifest.filter((entry) => entry.identity.provider === "congress" && entry.active)
    expect(activeCongress).toEqual([expect.objectContaining({ externalId: "congress:bills:current" })])
    expect(manifest.filter((entry) => entry.identity.provider === "govinfo").every((entry) => entry.active)).toBe(true)
    expect(manifest.filter((entry) => entry.identity.provider === "senate").every((entry) => entry.active)).toBe(true)
    expect(manifest.every((entry) => entry.taskIdentifier === "schedule-dispatcher")).toBe(true)
  })

  it("requires explicit provider opt-in before marking OpenStates schedules active", () => {
    const manifest = createSynchronizationScheduleManifest({
      active: true,
      openStatesActiveJurisdictions: ["ak", "nc"]
    })

    expect(
      manifest
        .filter((entry) => entry.identity.provider === "openstates" && ["ak", "nc"].includes(entry.identity.scope))
        .every((entry) => entry.active)
    ).toBe(true)
    expect(
      manifest
        .filter((entry) => entry.identity.provider === "openstates" && !["ak", "nc"].includes(entry.identity.scope))
        .every((entry) => !entry.active)
    ).toBe(true)
    expect(manifest.filter((entry) => entry.identity.provider === "openstates" && entry.active)).toHaveLength(6)
    expect(manifest.filter((entry) => entry.identity.provider === "govinfo").every((entry) => entry.active)).toBe(true)
    expect(manifest.filter((entry) => entry.identity.provider === "congress" && entry.active)).toHaveLength(1)
    expect(
      createSynchronizationScheduleManifest({ openStatesActiveJurisdictions: ["ak", "nc"] }).every(
        (entry) => !entry.active
      )
    ).toBe(true)
  })

  it("validates entries against the checked-in manifest and rejects unknown scheduled identities", () => {
    const manifest = createSynchronizationScheduleManifest()
    const [first, ...remaining] = manifest
    if (first === undefined) {
      throw new Error("Expected a non-empty synchronization schedule manifest")
    }

    expect(parseManagedSynchronizationIdentity("openstates:events:pr", manifest)).toEqual({
      domain: "events",
      provider: "openstates",
      scope: "pr"
    })
    expect(() => parseManagedSynchronizationIdentity("congress:events:118", manifest)).toThrow(
      SynchronizationScheduleManifestError
    )
    expect(() => validateSynchronizationScheduleManifest([{ ...first, cron: "* * * * *" }, ...remaining])).toThrow(
      SynchronizationScheduleManifestError
    )
  })
})

function schedule(manifest: ReturnType<typeof createSynchronizationScheduleManifest>, externalId: string) {
  const entry = manifest.find((candidate) => candidate.externalId === externalId)
  if (entry === undefined) {
    throw new Error(`Missing schedule: ${externalId}`)
  }
  return entry
}

function congressSchedules(manifest: ReturnType<typeof createSynchronizationScheduleManifest>) {
  return manifest.filter((entry) => entry.identity.provider === "congress")
}
