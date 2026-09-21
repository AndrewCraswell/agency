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
    rebuild: vi.fn(async () => undefined),
    seedFixtures: vi.fn(async () => undefined),
    auditEmpty: vi.fn(async () => undefined),
    validate: vi.fn(async () => validation),
    terminateStaleTargetConnections: vi.fn(async () => undefined)
  }
  const copyEngine: CopyEngine = {
    copy: vi.fn(async (request) => ({ engine: "direct" as const, tables: request.tables }))
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
  it("copies, sanitizes, seeds, rebuilds, validates, then restores availability", async () => {
    const fixture = fixtures()
    const result = await refreshStaging({ endpoints, ...fixture })
    expect(result.receipt.engine).toBe("direct")
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
