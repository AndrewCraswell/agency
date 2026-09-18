import { digest, officialUrl, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { legalDiscoveryPayloadHash } from "./discovery-checkpoint.js"
import { inspectLegalDiscoveryManifestCompletion } from "./discovery-manifest-completion.js"
import { legalDiscoveryManifestContract } from "./discovery-registration.js"

const scopeKey = "a".repeat(64)
const generationId = "b".repeat(64)
const artifactHash = "c".repeat(64)
const parserHash = "d".repeat(64)
const unitValues = {
  sourceId: "govinfo-fr" as const,
  nativeId: "FR-2026-09-17",
  edition: "2026-09-17",
  inventoryHash: "e".repeat(64),
  inventoryRevision: "2026-09-18T00:00:00.000Z",
  sourceUrl: officialUrl("https://www.govinfo.gov/bulkdata/FR/2026/09/FR-2026-09-17.xml", "govinfo-fr").href,
  issueDate: "2026-09-17",
  currencyDate: null,
  sourceModifiedText: "2026-09-18T00:00:00.000Z",
  expectedBytes: null,
  format: "xml" as const,
  historical: false as const,
  rightsProfileId: "official-federal-text" as const,
  externalStandardsIncluded: false as const
}
const unit = { ...unitValues, key: unitIdentity(unitValues) }
const bodyWithoutId = {
  contract: legalDiscoveryManifestContract,
  sourceId: "govinfo-fr" as const,
  scopeKey,
  units: [unit],
  createdFrom: "legal-discovery" as const,
  recurringIngestionEnabled: false as const
}
const manifest = {
  ...bodyWithoutId,
  id: digest(
    JSON.stringify([
      bodyWithoutId.contract,
      bodyWithoutId.sourceId,
      bodyWithoutId.scopeKey,
      [[unit.key, legalDiscoveryPayloadHash(unit)]]
    ])
  )
}
const profileId = `official-federal-text:${digest(JSON.stringify(officialFederalRights))}`

function mockPool(publicationOutboxCount: number) {
  const query = vi.fn(async (text: string) => {
    if (text.startsWith("BEGIN") || text.startsWith("SET LOCAL") || text === "COMMIT" || text === "ROLLBACK") {
      return { rowCount: null, rows: [] }
    }
    if (text.includes("current_database()")) return { rowCount: 1, rows: [{ name: "legislation" }] }
    if (text.includes("SELECT body FROM legislation.legal_import_manifests")) {
      return { rowCount: 1, rows: [{ body: manifest }] }
    }
    if (text.includes("FROM legislation.legal_discovery_units unit")) {
      return {
        rowCount: 1,
        rows: [
          {
            source_id: "govinfo-fr",
            unit_key: unit.key,
            state: "published",
            artifact_hash: artifactHash,
            parser_hash: parserHash,
            publication_generation_id: generationId,
            edition_id: null,
            rights_profile_id: profileId,
            lexical_state: "acknowledged",
            lexical_delayed: false,
            publication_count: 3,
            publication_outbox_count: publicationOutboxCount
          }
        ]
      }
    }
    if (text.includes("SELECT id,is_active FROM legislation.legal_rights_profiles")) {
      return { rowCount: 1, rows: [{ id: profileId, is_active: true }] }
    }
    if (text.includes("SELECT policy,policy_hash FROM legislation.legal_rights_profiles")) {
      return {
        rowCount: 1,
        rows: [{ policy: officialFederalRights, policy_hash: digest(JSON.stringify(officialFederalRights)) }]
      }
    }
    if (text.includes("FROM legislation.legal_discovery_dispatches WHERE manifest_id")) {
      return {
        rowCount: 3,
        rows: ["acquisition", "parsing", "publication"].map((stage) => ({
          unit_key: unit.key,
          stage,
          completed_at: new Date("2026-09-18T00:00:00Z"),
          lease_active: false,
          submission_uncertain: false,
          remote_state_mismatch: false,
          failed_attempts: 0,
          cancelled_attempts: 0
        }))
      }
    }
    throw new Error(`Unexpected query: ${text}`)
  })
  const client = { query, release: vi.fn() }
  return { connect: vi.fn(async () => client), query } as never
}

describe("Federal Register discovery manifest completion", () => {
  beforeEach(() => vi.clearAllMocks())

  it("accepts a published generation without a code edition when every publication outbox exists", async () => {
    await expect(
      inspectLegalDiscoveryManifestCompletion(mockPool(3), { manifestId: manifest.id })
    ).resolves.toMatchObject({
      sourceId: "govinfo-fr",
      publication: { missingCanonical: 0 },
      lexical: { acknowledged: 1, missing: 0 },
      accounted: true,
      ready: true
    })
  })

  it("fails readiness when even one publication is missing its lexical outbox", async () => {
    await expect(
      inspectLegalDiscoveryManifestCompletion(mockPool(2), { manifestId: manifest.id })
    ).resolves.toMatchObject({
      publication: { missingCanonical: 1 },
      ready: false
    })
  })
})
