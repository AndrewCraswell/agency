import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  key: vi.fn(),
  trigger: vi.fn()
}))
vi.mock("@trigger.dev/sdk", () => ({
  idempotencyKeys: { create: mocks.key },
  tasks: { trigger: mocks.trigger }
}))

import { continueRegulatoryDiscoveryStage } from "./regulatory-discovery-continuation.js"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.key.mockResolvedValue("global-controller-key")
  mocks.trigger.mockResolvedValue({ id: "controller-run" })
})

it("replenishes the bounded controller with one stable global key per completed stage unit", async () => {
  const payload = { manifestId: "a".repeat(64), unitKey: "b".repeat(64) }
  const scope = { sourceId: "ecfr", scopeKey: "c".repeat(64) }
  await expect(continueRegulatoryDiscoveryStage("parsing", payload, scope)).resolves.toEqual({ id: "controller-run" })
  expect(mocks.key).toHaveBeenCalledWith(expect.stringMatching(/^regulatory-discovery-controller:[a-f0-9]{64}$/), {
    scope: "global"
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-discovery-controller",
    { ...scope, afterUnitKey: null, limit: 25 },
    { idempotencyKey: "global-controller-key" }
  )
})
