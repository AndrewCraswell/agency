import { createDatabase } from "@repo/legislation-core/database/database"
import { afterAll, describe, expect, it } from "vitest"
import { loadConfig } from "../../config/config.js"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { createJobCounts } from "../job-result.js"
import { runIngestionJob, type JobResult } from "../job.js"
import type { OpenStatesImportResult } from "../openstates/import.js"
import type { SourceStore } from "../source-store.js"
import {
  executeGovInfoHistoricalImport,
  executeOpenStatesArchiveImport,
  listOpenStatesHistoricalArchives,
  type GovInfoBackfillDependencies,
  type OpenStatesBackfillDependencies
} from "./backfill.js"

const config = loadConfig({ NODE_ENV: "test" })
const { database, pool } = createDatabase(config.database)

afterAll(async () => {
  await pool.end()
})

describe("Trigger backfill services", () => {
  it("expands matching OpenStates archive streams into independent workers", async () => {
    const archives = await listOpenStatesHistoricalArchives(
      {
        config,
        jurisdictions: ["ca"],
        manifestBlob: "manifests/openstates.json"
      },
      {
        artifactStore: manifestStore({
          archives: [
            { jurisdictionCode: "ca", session: "2023", url: "https://archives.example.test/ca-2023.json" },
            { jurisdictionCode: "tx", session: "2023", url: "https://archives.example.test/tx-2023.json" }
          ],
          source: "openstates",
          version: 1
        })
      }
    )

    expect(archives).toEqual([
      {
        jurisdictionCode: "ca",
        session: "2023",
        stream: "ca-2023",
        url: "https://archives.example.test/ca-2023.json"
      }
    ])
  })

  it("retains an existing archive stream when importing one archive", async () => {
    const jobInputs: Parameters<typeof runIngestionJob>[1][] = []
    const imported: string[] = []
    const dependencies: OpenStatesBackfillDependencies = {
      archiveClient: {
        async getBytes() {
          return new TextEncoder().encode("[]")
        }
      },
      importOpenStatesRecords: async (_database, _context, _records, options) => {
        imported.push(options.stream)
        return importedResult()
      },
      runIngestionJob: jobRunner(jobInputs),
      sourceStore: sourceStore()
    }

    await executeOpenStatesArchiveImport(
      {
        archive: {
          jurisdictionCode: "ca",
          session: "2023",
          stream: "archive-openstates-ca-2023",
          url: new URL("https://archives.example.test/ca-2023.json")
        },
        config,
        correlationId: "trigger-run",
        database
      },
      dependencies
    )

    expect(jobInputs[0]).toMatchObject({ scopeKey: "stream:archive-openstates-ca-2023" })
    expect(imported).toEqual(["archive-openstates-ca-2023"])
  })

  it("uses the legacy GovInfo range stream so package-index checkpoints continue", async () => {
    const jobInputs: Parameters<typeof runIngestionJob>[1][] = []
    const discovered: Array<Readonly<{ billTypes: readonly string[]; congresses: readonly number[] }>> = []
    const imported: Array<Readonly<{ packages: number; stream: string }>> = []
    const dependencies: GovInfoBackfillDependencies = {
      govInfoClient: {
        async discover(congresses, billTypes) {
          discovered.push({ billTypes, congresses })
          return [
            {
              billType: "hr",
              congress: 118,
              packageId: "BILLSTATUS-118hr1",
              url: new URL("https://www.govinfo.gov/bulkdata/BILLSTATUS/118/hr/BILLSTATUS-118hr1.xml")
            }
          ]
        },
        async getBillStatus() {
          return ""
        }
      },
      importGovInfoPackages: async (_database, _client, packages, options) => {
        imported.push({ packages: packages.length, stream: options.stream })
        return { checkpoint: { complete: true, index: packages.length }, counts: createJobCounts(), failures: [] }
      },
      runIngestionJob: jobRunner(jobInputs),
      sourceStore: sourceStore()
    }

    const result = await executeGovInfoHistoricalImport(
      {
        billTypes: ["hr", "s"],
        config,
        correlationId: "trigger-run",
        database,
        endCongress: 119,
        startCongress: 118
      },
      dependencies
    )

    expect(result.status).toBe("succeeded")
    expect(discovered).toEqual([{ billTypes: ["hr", "s"], congresses: [118, 119] }])
    expect(jobInputs[0]).toMatchObject({
      operation: "bill-status-sync",
      scope: { billTypes: ["hr", "s"], end: 119, start: 118 },
      scopeKey: "bill-status:all",
      source: "govinfo"
    })
    expect(imported).toEqual([{ packages: 1, stream: "118-119-hr-s" }])
  })

  it("rejects a GovInfo backfill without bill types before discovery or leasing", async () => {
    const dependencies: GovInfoBackfillDependencies = {
      govInfoClient: {
        async discover() {
          throw new Error("Discovery must not run")
        },
        async getBillStatus() {
          return ""
        }
      },
      runIngestionJob: async () => {
        throw new Error("Lease acquisition must not run")
      }
    }

    await expect(
      executeGovInfoHistoricalImport(
        {
          billTypes: [],
          config,
          correlationId: "trigger-run",
          database
        },
        dependencies
      )
    ).rejects.toThrow("At least one GovInfo bill type is required")
  })

  it("rejects an empty GovInfo discovery before declaring the rebuild complete", async () => {
    await expect(
      executeGovInfoHistoricalImport(
        { billTypes: ["hr"], config, correlationId: "trigger-run", database },
        {
          govInfoClient: {
            async discover() {
              return []
            },
            async getBillStatus() {
              return ""
            }
          },
          runIngestionJob: jobRunner([])
        }
      )
    ).rejects.toThrow("GovInfo discovery returned no BILLSTATUS packages")
  })

  it("does not discover GovInfo history when the shared lease is unavailable", async () => {
    let discoveries = 0
    await expect(
      executeGovInfoHistoricalImport(
        { billTypes: ["hr"], config, correlationId: "overlap", database },
        {
          govInfoClient: {
            async discover() {
              discoveries += 1
              return []
            },
            async getBillStatus() {
              return ""
            }
          },
          runIngestionJob: async () => {
            throw new Error("lease unavailable")
          }
        }
      )
    ).rejects.toThrow("lease unavailable")
    expect(discoveries).toBe(0)
  })
})

function manifestStore(manifest: unknown): ArtifactStore {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest))
  return {
    async exists() {
      return true
    },
    async put() {
      return true
    },
    async read() {
      return bytes
    }
  }
}

function sourceStore(): SourceStore {
  return {
    async put() {
      return {
        bytes: 0,
        contentHash: "content-hash",
        contentPath: "content-path",
        metadataPath: "metadata-path",
        unchanged: false
      }
    }
  }
}

function importedResult(): OpenStatesImportResult {
  return { checkpoint: { complete: true, index: 1 }, counts: createJobCounts(), diagnostics: [], failures: [] }
}

function jobRunner(
  inputs: Parameters<typeof runIngestionJob>[1][]
): NonNullable<OpenStatesBackfillDependencies["runIngestionJob"]> {
  return async (_database, input, operation): Promise<JobResult> => {
    inputs.push(input)
    const result = await operation("run-1")
    return {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "run-1",
      source: input.source,
      status: result.counts.failed === 0 ? "succeeded" : "partial",
      workflowExecutionId: input.workflowExecutionId
    }
  }
}
