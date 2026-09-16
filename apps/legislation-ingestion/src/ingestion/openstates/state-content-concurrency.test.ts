import { expect, it } from "vitest"
import { runStateContentBills } from "./state-content-concurrency.js"

it("waits for active siblings and stops admission after a failure", async () => {
  const sibling = Promise.withResolvers<void>()
  const started: number[] = []
  let finished = false
  const running = runStateContentBills([1, 2, 3, 4], 2, async (value) => {
    started.push(value)
    if (value === 1) {
      throw new Error("provider failure")
    }
    await sibling.promise
  }).catch((error: unknown) => {
    finished = true
    return error
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(started).toEqual([1, 2])
  expect(finished).toBe(false)
  sibling.resolve()
  expect(await running).toBeInstanceOf(AggregateError)
  expect(started).toEqual([1, 2])
})
