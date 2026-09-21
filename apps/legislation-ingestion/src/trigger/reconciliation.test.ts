import { describe, expect, it, vi } from "vitest"
import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"
import { createSynchronizationScheduleManifest } from "./manifest.js"
import {
  applySynchronizationScheduleReconciliation,
  planSynchronizationScheduleReconciliation,
  selectSynchronizationScheduleScope,
  type RemoteSynchronizationSchedule
} from "./reconciliation.js"

function remoteSchedule(
  schedule: ReturnType<typeof createSynchronizationScheduleManifest>[number],
  overrides: Partial<RemoteSynchronizationSchedule> = {}
): RemoteSynchronizationSchedule {
  return {
    active: false,
    cron: schedule.cron,
    deduplicationKey: schedule.deduplicationKey,
    externalId: schedule.externalId,
    id: `schedule-${schedule.externalId}`,
    taskIdentifier: schedule.taskIdentifier,
    timezone: schedule.timezone,
    ...overrides
  }
}

describe("planSynchronizationScheduleReconciliation", () => {
  const manifest = createSynchronizationScheduleManifest()

  it("creates every missing schedule without activating it", () => {
    const plan = planSynchronizationScheduleReconciliation(manifest, [])

    expect(plan.unchanged).toBe(0)
    expect(plan.actions).toHaveLength(164)
    expect(plan.actions.every((action) => action.type === "create" && action.schedule.active === false)).toBe(true)
  })

  it("leaves matching inactive schedules unchanged", () => {
    const remote = manifest.map((schedule) => remoteSchedule(schedule))
    const plan = planSynchronizationScheduleReconciliation(manifest, remote)

    expect(plan).toEqual({ actions: [], unchanged: 164 })
  })

  it("activates only the Congress wave, Senate, and GovInfo schedules during standard activation", () => {
    const activeManifest = createSynchronizationScheduleManifest({ active: true })
    const remote = activeManifest.map((schedule) => remoteSchedule(schedule))
    const plan = planSynchronizationScheduleReconciliation(activeManifest, remote)

    expect(plan.actions).toHaveLength(3)
    expect(plan.actions.every((action) => action.type === "activate")).toBe(true)
    expect(
      plan.actions.map((action) => (action.type === "activate" ? action.schedule.externalId : undefined)).sort()
    ).toEqual(["congress:bills:current", "govinfo:bill-status:119", "senate:votes:119"])
    expect(
      plan.actions.every((action) => action.type !== "activate" || action.schedule.identity.provider !== "openstates")
    ).toBe(true)
  })

  it("deactivates OpenStates schedules during standard activation when they are remotely active", () => {
    const activeManifest = createSynchronizationScheduleManifest({ active: true })
    const remote = activeManifest.map((schedule) =>
      remoteSchedule(schedule, { active: schedule.identity.provider === "openstates" })
    )
    const plan = planSynchronizationScheduleReconciliation(activeManifest, remote)

    expect(plan.actions.filter((action) => action.type === "activate")).toHaveLength(3)
    expect(
      plan.actions.filter((action) => action.type === "deactivate" && action.externalId?.startsWith("openstates:"))
    ).toHaveLength(156)
  })

  it("updates drift and deactivates an active desired schedule", () => {
    const desired = manifest[0]
    expect(desired).toBeDefined()
    if (desired === undefined) {
      return
    }
    const plan = planSynchronizationScheduleReconciliation(manifest, [
      remoteSchedule(desired, { active: true, cron: "0 0 * * *" })
    ])

    expect(plan.actions.slice(0, 2).map((action) => action.type)).toEqual(["update", "deactivate"])
  })

  it("deactivates an obsolete managed schedule without touching unrelated schedules", () => {
    const stale: RemoteSynchronizationSchedule = {
      active: true,
      cron: "0 0 * * *",
      deduplicationKey: "development:openstates:bills:obsolete",
      externalId: "openstates:bills:obsolete",
      id: "stale",
      taskIdentifier: "schedule-dispatcher",
      timezone: "UTC"
    }
    const unrelated: RemoteSynchronizationSchedule = {
      ...stale,
      deduplicationKey: "another-product:daily-report",
      id: "unrelated"
    }
    const remote = [...manifest.map((schedule) => remoteSchedule(schedule)), stale, unrelated]
    const plan = planSynchronizationScheduleReconciliation(manifest, remote)

    expect(plan.actions).toEqual([
      {
        deduplicationKey: stale.deduplicationKey,
        externalId: stale.externalId,
        id: stale.id,
        reason: "stale-managed-schedule",
        type: "deactivate"
      }
    ])
  })

  it("rejects duplicate managed schedule keys", () => {
    const desired = manifest[0]
    expect(desired).toBeDefined()
    if (desired === undefined) {
      return
    }
    const remote = remoteSchedule(desired)

    expect(() => planSynchronizationScheduleReconciliation(manifest, [remote, { ...remote, id: "duplicate" }])).toThrow(
      "duplicate managed schedule key"
    )
  })

  it("isolates state and federal schedule reconciliation", () => {
    const remote = manifest.map((schedule) => remoteSchedule(schedule))
    const openStates = selectSynchronizationScheduleScope(manifest, remote, "openstates")
    const federal = selectSynchronizationScheduleScope(manifest, remote, "federal")

    expect(openStates.manifest).toHaveLength(156)
    expect(openStates.remoteSchedules).toHaveLength(156)
    expect(openStates.manifest.every((schedule) => schedule.identity.provider === "openstates")).toBe(true)
    expect(federal.manifest).toHaveLength(8)
    expect(federal.remoteSchedules).toHaveLength(8)
    expect(federal.manifest.every((schedule) => schedule.identity.provider !== "openstates")).toBe(true)
  })

  it("rejects inconsistent remote provider identities before applying a scoped plan", () => {
    const desired = manifest.find((schedule) => schedule.identity.provider === "openstates")
    expect(desired).toBeDefined()
    if (desired === undefined) {
      return
    }
    expect(() =>
      selectSynchronizationScheduleScope(
        manifest,
        [remoteSchedule(desired, { externalId: "congress:bills:current" })],
        "openstates"
      )
    ).toThrow("provider identity is inconsistent")
  })

  it("safely configures newly created inactive schedules", async () => {
    const schedule = manifest[0]
    expect(schedule).toBeDefined()
    if (schedule === undefined) {
      return
    }
    const client = {
      activate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      create: vi.fn<(input: unknown) => Promise<{ id: string }>>(async () => ({ id: "created" })),
      deactivate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      update: vi.fn<(id: string, input: unknown) => Promise<void>>(async () => undefined)
    }

    const result = await applySynchronizationScheduleReconciliation(
      { actions: [{ schedule, type: "create" }], unchanged: 0 },
      client
    )

    expect(result).toEqual({ activated: 0, created: 1, deactivated: 1, updated: 1 })
    expect(client.create).toHaveBeenCalledWith({
      cron: schedule.cron,
      deduplicationKey: schedule.deduplicationKey,
      externalId: `disabled:${schedule.externalId}`,
      task: "schedule-dispatcher",
      timezone: "UTC"
    })
    expect(client.deactivate).toHaveBeenCalledWith("created")
    expect(client.update).toHaveBeenCalledWith("created", {
      cron: schedule.cron,
      externalId: schedule.externalId,
      task: "schedule-dispatcher",
      timezone: "UTC"
    })
    expect(client.create.mock.invocationCallOrder[0]).toBeLessThan(client.deactivate.mock.invocationCallOrder[0] ?? 0)
    expect(client.deactivate.mock.invocationCallOrder[0]).toBeLessThan(client.update.mock.invocationCallOrder[0] ?? 0)
  })

  it("only activates a newly created active schedule after safe configuration", async () => {
    const schedule = createSynchronizationScheduleManifest({
      active: true,
      openStatesActiveJurisdictions: ["al"]
    })[0]
    expect(schedule).toBeDefined()
    if (schedule === undefined) {
      return
    }
    const client = {
      activate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      create: vi.fn<(input: unknown) => Promise<{ id: string }>>(async () => ({ id: "created" })),
      deactivate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      update: vi.fn<(id: string, input: unknown) => Promise<void>>(async () => undefined)
    }

    const result = await applySynchronizationScheduleReconciliation(
      { actions: [{ schedule, type: "create" }], unchanged: 0 },
      client
    )

    expect(result).toEqual({ activated: 1, created: 1, deactivated: 1, updated: 1 })
    expect(client.update.mock.invocationCallOrder[0]).toBeLessThan(client.activate.mock.invocationCallOrder[0] ?? 0)
  })

  it("uses the safe creation handshake for the complete active schedule inventory", async () => {
    const activeManifest = createSynchronizationScheduleManifest({
      active: true,
      openStatesActiveJurisdictions: supportedOpenStatesJurisdictions
    })
    let nextId = 0
    const client = {
      activate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      create: vi.fn<(input: unknown) => Promise<{ id: string }>>(async () => ({ id: `created-${nextId++}` })),
      deactivate: vi.fn<(id: string) => Promise<void>>(async () => undefined),
      update: vi.fn<(id: string, input: unknown) => Promise<void>>(async () => undefined)
    }

    const result = await applySynchronizationScheduleReconciliation(
      {
        actions: activeManifest.map((schedule) => ({ schedule, type: "create" as const })),
        unchanged: 0
      },
      client
    )

    expect(result).toEqual({ activated: 159, created: 164, deactivated: 164, updated: 164 })
    expect(client.create).toHaveBeenCalledTimes(164)
    expect(client.deactivate).toHaveBeenCalledTimes(164)
    expect(client.update).toHaveBeenCalledTimes(164)
    expect(client.activate).toHaveBeenCalledTimes(159)
    for (let index = 0; index < activeManifest.length; index += 1) {
      const createOrder = client.create.mock.invocationCallOrder[index]
      const deactivateOrder = client.deactivate.mock.invocationCallOrder[index]
      const updateOrder = client.update.mock.invocationCallOrder[index]
      expect(createOrder).toBeLessThan(deactivateOrder ?? 0)
      expect(deactivateOrder).toBeLessThan(updateOrder ?? 0)
    }
    const activeUpdateOrders = activeManifest.flatMap((schedule, index) =>
      schedule.active ? [client.update.mock.invocationCallOrder[index]] : []
    )
    expect(
      activeUpdateOrders.every(
        (updateOrder, index) => (updateOrder ?? 0) < (client.activate.mock.invocationCallOrder[index] ?? 0)
      )
    ).toBe(true)
  })
})
