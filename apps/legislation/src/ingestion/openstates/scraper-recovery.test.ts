import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import * as schema from "../../db/schema/schema.js"
import { recoverLocalScraperOwnership } from "./scraper-recovery.js"

function fixture() {
  const database = drizzle({ connection: "postgresql://unused", schema })
  const record = {
    ownershipStream: "ownership:nc-bills:2025:inventory:batch",
    token: "held-attempt",
    requiresConfirmedRelease: true,
    released: false,
    executor: { host: "same-host", pid: 123, runtimeId: "same-runtime" }
  }
  type Dependencies = NonNullable<Parameters<typeof recoverLocalScraperOwnership>[2]>
  const dependencies = {
    read: vi.fn<Dependencies["read"]>().mockResolvedValue(record),
    release: vi.fn<Dependencies["release"]>().mockResolvedValue(true),
    host: () => "same-host",
    runtimeId: async () => "same-runtime",
    hasExecutor: vi.fn<Dependencies["hasExecutor"]>().mockResolvedValue(false),
    hasContainer: vi.fn<Dependencies["hasContainer"]>().mockResolvedValue(false)
  }
  return { database, record, dependencies }
}

describe("local held-attempt recovery", () => {
  it("releases only after checking executor and container absence", async () => {
    const { database, dependencies } = fixture()
    expect(await recoverLocalScraperOwnership(database, "held-attempt", dependencies)).toMatchObject({
      status: "released",
      executorAbsent: true,
      containerAbsent: true
    })
    expect(dependencies.hasExecutor).toHaveBeenCalledWith(123)
    expect(dependencies.hasContainer).toHaveBeenCalledWith("held-attempt")
    expect(dependencies.release).toHaveBeenCalledExactlyOnceWith(
      database,
      expect.objectContaining({ token: "held-attempt" })
    )
  })
  it.each(["executor", "container"] as const)("refuses a remaining %s", async (kind) => {
    const { database, dependencies } = fixture()
    if (kind === "executor") {
      dependencies.hasExecutor.mockResolvedValue(true)
    } else {
      dependencies.hasContainer.mockResolvedValue(true)
    }
    await expect(recoverLocalScraperOwnership(database, "held-attempt", dependencies)).rejects.toThrow("still exists")
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it.each(["executor", "container"] as const)("refuses uncertain %s inspection", async (kind) => {
    const { database, dependencies } = fixture()
    if (kind === "executor") {
      dependencies.hasExecutor.mockRejectedValue(new Error("inspection unavailable"))
    } else {
      dependencies.hasContainer.mockRejectedValue(new Error("inspection unavailable"))
    }
    await expect(recoverLocalScraperOwnership(database, "held-attempt", dependencies)).rejects.toThrow(
      "inspection unavailable"
    )
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it("rejects different hosts, stale tokens and missing provenance", async () => {
    const { database, record, dependencies } = fixture()
    for (const value of [
      null,
      { ...record, executor: null },
      { ...record, token: "new-attempt" },
      { ...record, executor: { host: "remote-host", pid: 123 } }
    ]) {
      dependencies.read.mockResolvedValueOnce(value)
      await expect(recoverLocalScraperOwnership(database, "held-attempt", dependencies)).rejects.toThrow(
        /Invalid|original host/
      )
    }
    expect(dependencies.release).not.toHaveBeenCalled()
  })
  it("does not report success when ownership changes before release", async () => {
    const { database, dependencies } = fixture()
    dependencies.release.mockResolvedValue(false)
    await expect(recoverLocalScraperOwnership(database, "held-attempt", dependencies)).rejects.toThrow(
      "Ownership changed"
    )
  })
  it("does not inspect a different Docker daemon as if it were the original runtime", async () => {
    const { database, dependencies } = fixture()
    dependencies.runtimeId = async () => "different-runtime"
    await expect(recoverLocalScraperOwnership(database, "held-attempt", dependencies)).rejects.toThrow(
      "original Docker runtime"
    )
    expect(dependencies.release).not.toHaveBeenCalled()
  })
})
