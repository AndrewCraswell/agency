import { describe, expect, it, vi } from "vitest"
import { createNextLegislationRuntime, type NextLegislationRuntimeApplication } from "./runtime.js"

function createApplication(readiness: NextLegislationRuntimeApplication["readiness"]) {
  const close = vi.fn<() => Promise<void>>(() => Promise.resolve())
  return { application: { close, readiness }, close }
}

const readyReadiness = {
  check: async () => true,
  details: () => ({ databasePool: { active: 0, idle: 1, maximum: 1, saturation: 0, total: 1, waiting: 0 } })
}

describe("Next legislation application runtime", () => {
  it("reuses one composed application until it is closed", async () => {
    const first = createApplication(readyReadiness)
    const second = createApplication(readyReadiness)
    const factory = vi
      .fn<() => NextLegislationRuntimeApplication>()
      .mockReturnValueOnce(first.application)
      .mockReturnValue(second.application)
    const runtime = createNextLegislationRuntime(factory)

    expect(runtime.getApplication()).toBe(first.application)
    expect(runtime.getApplication()).toBe(first.application)
    expect(await runtime.getReadiness().check()).toBe(true)
    expect(runtime.getReadiness().details()).toEqual({ databasePool: expect.any(Object) })
    expect(factory).toHaveBeenCalledOnce()

    await runtime.close()

    expect(first.close).toHaveBeenCalledOnce()
    expect(runtime.getApplication()).toBe(second.application)
  })

  it("converts initialization and readiness exceptions into unavailable results", async () => {
    const initializationFailure = createNextLegislationRuntime<NextLegislationRuntimeApplication>(() => {
      throw new Error("configuration must not leak")
    })
    const readinessFailure = createNextLegislationRuntime(
      () =>
        createApplication({
          check: async () => {
            throw new Error("database must not leak")
          },
          details: () => ({ databasePool: { active: 0, idle: 0, maximum: 1, saturation: 0, total: 0, waiting: 0 } })
        }).application
    )

    await expect(initializationFailure.getReadiness().check()).resolves.toBe(false)
    expect(initializationFailure.getReadiness().details()).toEqual({})
    await expect(readinessFailure.getReadiness().check()).resolves.toBe(false)
  })
})
