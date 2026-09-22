import { describe, expect, it, vi } from "vitest"
import { type CopyEngine } from "./copy-engine.js"
import { refreshPolicy } from "./policy.js"
import {
  deterministicFixtureSeed,
  refreshStaging,
  type RefreshEndpoints,
  type RefreshHooks,
  type RefreshStore,
  type RefreshValidation
} from "./refresh.js"

const endpoints: RefreshEndpoints = {
  sourcePrimary: "postgresql://source.invalid/production",
  targetPrimary: "postgresql://target.invalid/staging",
  targetPassageSearch: "postgresql://search.invalid/legislation_passage_search",
  targetWeb: "https://staging-web.invalid",
  targetMcp: "https://staging-mcp.invalid"
}

const passingValidation: RefreshValidation = {
  migrations: true,
  extensions: true,
  counts: true,
  foreignKeys: true,
  privateData: true,
  passageIndex: true,
  search: true,
  webReadiness: true,
  mcpSmoke: true
}

function fixtures(validation = passingValidation) {
  const catalog = Object.values(refreshPolicy).flat()
  const source: RefreshStore = {
    catalog: vi.fn(async () => catalog),
    excludedFingerprints: vi.fn(async () => new Map()),
    beginSourceSnapshot: vi.fn(async () => "00000001-00000002-1"),
    endSourceSnapshot: vi.fn(async () => undefined),
    readSequences: vi.fn(async () => [{ name: "legislation.bills_id_seq", value: "42", called: true }]),
    writeSequences: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    assertCopyReady: vi.fn(async () => undefined),
    rebuild: vi.fn(async () => undefined),
    seedFixtures: vi.fn(async () => undefined),
    auditEmpty: vi.fn(async () => undefined),
    validate: vi.fn(async () => validation),
    terminateStaleTargetConnections: vi.fn(async () => undefined)
  }
  const fingerprints = new Map(refreshPolicy.exclude.map((table) => [table, `${table}-fixture`]))
  const target: RefreshStore = {
    ...source,
    catalog: vi.fn(async () => catalog),
    excludedFingerprints: vi.fn(async () => fingerprints),
    beginSourceSnapshot: vi.fn(async () => {
      throw new Error("target cannot export source snapshot")
    }),
    endSourceSnapshot: vi.fn(async () => undefined),
    readSequences: vi.fn(async () => []),
    writeSequences: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    assertCopyReady: vi.fn(async () => undefined),
    rebuild: vi.fn(async () => undefined),
    seedFixtures: vi.fn(async () => undefined),
    auditEmpty: vi.fn(async () => undefined),
    validate: vi.fn(async () => validation),
    terminateStaleTargetConnections: vi.fn(async () => undefined)
  }
  const copyEngine: CopyEngine = {
    copy: vi.fn(async (request) => ({ engine: "bulk" as const, tables: request.tables, counts: {} }))
  }
  const maintenance: boolean[] = []
  const hooks: RefreshHooks = {
    acquireLock: vi.fn(async () => vi.fn(async () => undefined)),
    assertMigrationLeaseAvailable: vi.fn(async () => undefined),
    setMaintenance: vi.fn(async (unavailable) => {
      maintenance.push(unavailable)
    }),
    alert: vi.fn(async () => undefined)
  }
  return { source, target, copyEngine, hooks, maintenance }
}

describe("staging refresh", () => {
  it.each([
    { ...endpoints, targetPrimary: "postgres://different-user@SOURCE.invalid:5432/%70roduction?sslmode=require" },
    { ...endpoints, targetPassageSearch: "postgresql://different-user@target.invalid:5432/staging" },
    { ...endpoints, targetPrimary: "postgres-unsafe://target.invalid/staging" }
  ])("rejects colliding or invalid databases before any hooks or clearing", async (invalidEndpoints) => {
    const fixture = fixtures()
    await expect(refreshStaging({ ...fixture, endpoints: invalidEndpoints })).rejects.toThrow("distinct")
    expect(fixture.hooks.acquireLock).not.toHaveBeenCalled()
    expect(fixture.target.clear).not.toHaveBeenCalled()
  })

  it("copies, sanitizes, seeds, rebuilds, validates, then restores availability", async () => {
    const fixture = fixtures()
    const result = await refreshStaging({ endpoints, ...fixture })
    expect(result.receipt.engine).toBe("bulk")
    expect(fixture.maintenance).toEqual([true, false])
    expect(fixture.target.clear).toHaveBeenCalledWith([
      ...refreshPolicy.copy,
      ...refreshPolicy.clear,
      ...refreshPolicy.rebuild
    ])
    expect(fixture.target.auditEmpty).toHaveBeenCalledWith(refreshPolicy.clear)
    expect(fixture.target.seedFixtures).toHaveBeenCalledWith(deterministicFixtureSeed)
    expect(fixture.target.writeSequences).toHaveBeenCalledWith([
      { name: "legislation.bills_id_seq", value: "42", called: true }
    ])
    expect(fixture.target.rebuild).toHaveBeenCalledWith(refreshPolicy.rebuild, endpoints.targetPassageSearch)
    expect(fixture.copyEngine.copy).toHaveBeenCalledWith(
      expect.objectContaining({ tables: refreshPolicy.copy, snapshot: "00000001-00000002-1" })
    )
  })

  it.each(Object.keys(passingValidation) as (keyof RefreshValidation)[])(
    "keeps staging unavailable when %s validation fails",
    async (gate) => {
      const fixture = fixtures({ ...passingValidation, [gate]: false })
      await expect(refreshStaging({ endpoints, ...fixture })).rejects.toThrow(gate)
      expect(fixture.maintenance).toEqual([true, true])
      expect(fixture.hooks.alert).toHaveBeenCalledOnce()
    }
  )

  it("refuses unknown tables before destructive copy", async () => {
    const fixture = fixtures()
    vi.mocked(fixture.source.catalog).mockResolvedValue([...Object.values(refreshPolicy).flat(), "unclassified"])
    await expect(refreshStaging({ endpoints, ...fixture })).rejects.toThrow("unknown: unclassified")
    expect(fixture.copyEngine.copy).not.toHaveBeenCalled()
    expect(fixture.maintenance).toEqual([true, true])
  })

  it("refuses insufficient bulk-load privileges before clearing data", async () => {
    const fixture = fixtures()
    vi.mocked(fixture.target.assertCopyReady).mockRejectedValue(new Error("maintenance principal required"))
    await expect(refreshStaging({ endpoints, ...fixture })).rejects.toThrow("maintenance principal required")
    expect(fixture.target.clear).not.toHaveBeenCalled()
    expect(fixture.copyEngine.copy).not.toHaveBeenCalled()
  })

  it("reasserts maintenance after a partial entry failure without clearing data", async () => {
    const fixture = fixtures()
    vi.mocked(fixture.hooks.setMaintenance).mockRejectedValueOnce(new Error("second service unavailable"))
    await expect(refreshStaging({ endpoints, ...fixture })).rejects.toThrow("second service unavailable")
    expect(fixture.hooks.setMaintenance).toHaveBeenCalledTimes(2)
    expect(fixture.target.clear).not.toHaveBeenCalled()
  })

  it("reports snapshot cleanup failure and still releases the lock", async () => {
    const fixture = fixtures()
    const release = vi.fn(async () => undefined)
    const logger = vi.fn()
    vi.mocked(fixture.hooks.acquireLock).mockResolvedValue(release)
    vi.mocked(fixture.copyEngine.copy).mockRejectedValue(new Error("copy interrupted"))
    vi.mocked(fixture.source.endSourceSnapshot).mockRejectedValue(new Error("snapshot cleanup failed"))
    await expect(refreshStaging({ ...fixture, endpoints, logger })).rejects.toThrow("copy interrupted")
    expect(release).toHaveBeenCalledOnce()
    expect(logger).toHaveBeenCalledWith("refresh.cleanup-failed", { error: "Error: snapshot cleanup failed" })
    expect(fixture.maintenance).toEqual([true, true])
  })

  it("refuses migration lease contention before maintenance or copy", async () => {
    const fixture = fixtures()
    vi.mocked(fixture.hooks.assertMigrationLeaseAvailable).mockRejectedValue(new Error("migration lease active"))
    await expect(refreshStaging({ endpoints, ...fixture })).rejects.toThrow("migration lease active")
    expect(fixture.maintenance).toEqual([])
    expect(fixture.target.clear).not.toHaveBeenCalled()
  })

  it("audits staging-owned exclusions and redacts failures", async () => {
    const fixture = fixtures()
    vi.mocked(fixture.target.excludedFingerprints)
      .mockResolvedValueOnce(new Map(refreshPolicy.exclude.map((table) => [table, "before"])))
      .mockResolvedValueOnce(new Map(refreshPolicy.exclude.map((table) => [table, "after"])))
    const logs: unknown[] = []
    await expect(
      refreshStaging({
        endpoints: { ...endpoints, sourcePrimary: "postgresql://admin:secret@source.invalid/production" },
        ...fixture,
        logger: (_event, details) => logs.push(details)
      })
    ).rejects.toThrow("excluded data changed")
    expect(JSON.stringify(logs)).not.toContain("secret")
    expect(fixture.maintenance).toEqual([true, true])
  })

  it("preserves the primary failure when the external alert hook also fails", async () => {
    const fixture = fixtures({ ...passingValidation, foreignKeys: false })
    vi.mocked(fixture.hooks.alert).mockRejectedValue(new Error("alert password=also-secret"))
    const logs: unknown[] = []
    await expect(
      refreshStaging({
        endpoints,
        ...fixture,
        logger: (event, details) => logs.push({ event, details })
      })
    ).rejects.toThrow("foreignKeys")
    expect(JSON.stringify(logs)).not.toContain("also-secret")
    expect(fixture.maintenance).toEqual([true, true])
  })
})
