import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { describe, expect, it, vi } from "vitest"
import { importArchivedStateFoundation } from "./foundation-import.js"
import { peopleSourceProfiles } from "./people-repository.js"

describe("archived state foundation import", () => {
  it("validates the immutable pair before replaying people and committees", async () => {
    const database = drizzle({ connection: "postgresql://unused", schema })
    const retrievedAt = new Date("2026-09-17T00:00:00Z")
    const current = {
      state: "ak" as const,
      lane: "entities" as const,
      revision: peopleSourceProfiles.ak.revision,
      retrievedAt,
      objects: [],
      files: [{ path: "data/ak/legislature/current.yml", content: "current" }]
    }
    const history = {
      state: "ak" as const,
      lane: "history" as const,
      revision: peopleSourceProfiles.ak.revision,
      retrievedAt,
      objects: [],
      files: [{ path: "data/ak/retired/former.yml", content: "former" }]
    }
    const importPeople = vi.fn(async () => ({ status: "imported" as const }))
    const importCommittees = vi.fn(async () => ({ status: "observations_imported" as const }))
    const result = await importArchivedStateFoundation(
      database,
      {
        store: { read: async () => new Uint8Array() },
        state: "ak",
        currentManifestPath: "current",
        historyManifestPath: "history"
      },
      {
        read: vi.fn(async (_store, path) => (path === "current" ? current : history)),
        importPeople,
        importCommittees
      }
    )
    expect(result).toMatchObject({ status: "foundation_imported", state: "ak", revision: current.revision })
    expect(importPeople).toHaveBeenCalledBefore(importCommittees)
    expect(importCommittees).toHaveBeenCalledWith(
      database,
      "ak",
      current.files,
      history.files,
      retrievedAt,
      current.revision
    )
  })

  it("rejects a pair from another state before canonical writes", async () => {
    const database = drizzle({ connection: "postgresql://unused", schema })
    const retrievedAt = new Date("2026-09-17T00:00:00Z")
    const archive = (lane: "entities" | "history") => ({
      state: "nc" as const,
      lane,
      revision: peopleSourceProfiles.nc.revision,
      retrievedAt,
      objects: [],
      files: []
    })
    const importPeople = vi.fn()
    await expect(
      importArchivedStateFoundation(
        database,
        {
          store: { read: async () => new Uint8Array() },
          state: "ak",
          currentManifestPath: "current",
          historyManifestPath: "history"
        },
        {
          read: vi.fn(async (_store, path) => archive(path === "current" ? "entities" : "history")),
          importPeople,
          importCommittees: vi.fn()
        }
      )
    ).rejects.toThrow("does not match requested state")
    expect(importPeople).not.toHaveBeenCalled()
  })
})
