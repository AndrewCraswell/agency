import { expect, it, vi } from "vitest"
import { retryLockContention } from "./retry-lock-contention.js"

it("retries only rolled-back lock timeouts with bounded backoff", async () => {
  const locked = Object.assign(new Error("lock timeout"), { code: "55P03" })
  const operation = vi.fn().mockRejectedValueOnce(locked).mockRejectedValueOnce(locked).mockResolvedValue("done")
  const wait = vi.fn(async () => undefined)
  await expect(retryLockContention(operation, wait)).resolves.toBe("done")
  expect(operation).toHaveBeenCalledTimes(3)
  expect(wait.mock.calls).toEqual([[1000], [2000]])
})

it("stops after three attempts and preserves the database error", async () => {
  const locked = Object.assign(new Error("lock timeout"), { code: "55P03" })
  const operation = vi.fn().mockRejectedValue(locked)
  const wait = vi.fn(async () => undefined)
  await expect(retryLockContention(operation, wait)).rejects.toBe(locked)
  expect(operation).toHaveBeenCalledTimes(3)
  expect(wait).toHaveBeenCalledTimes(2)
})

it("never retries validation failures, connection errors, or statement timeouts", async () => {
  for (const error of [
    new Error("evidence changed"),
    Object.assign(new Error("connection lost"), { code: "08006" }),
    Object.assign(new Error("statement timeout"), { code: "57014" }),
    { code: "55P03" }
  ]) {
    const operation = vi.fn().mockRejectedValue(error)
    const wait = vi.fn(async () => undefined)
    await expect(retryLockContention(operation, wait)).rejects.toBe(error)
    expect(operation).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  }
})
