import pg from "pg"
import { afterEach, describe, expect, it, vi } from "vitest"
import { digest } from "./contracts"
import { requireRights } from "./rights"
import { assertRights, officialFederalRights, rightsPolicySchema } from "./storage-contract"

afterEach(() => vi.restoreAllMocks())

describe("regulatory source rights", () => {
  it("requires explicit complete rights and refuses denied uses", () => {
    expect(() => rightsPolicySchema.parse({ retainRaw: true })).toThrow(/Invalid input/)
    expect(() => assertRights({ ...officialFederalRights, displayText: false }, "displayText")).toThrow("rights_denied")
    expect(() => assertRights({ ...officialFederalRights, retainRaw: false }, "retainRaw")).toThrow("rights_denied")
    expect(() => assertRights({ ...officialFederalRights, localSearch: false }, "localSearch")).toThrow("rights_denied")
  })
  it("preserves licensed attribution and termination restrictions without granting missing rights", () => {
    const licensed = {
      ...officialFederalRights,
      attribution: "Éditeur — synthetic licensed fixture",
      territories: ["US"],
      termination: "restrict",
      embeddings: false,
      apiMcp: false,
      sharing: false
    }
    expect(rightsPolicySchema.parse(licensed)).toMatchObject({
      embeddings: false,
      apiMcp: false,
      termination: "restrict"
    })
    expect(() => rightsPolicySchema.parse({ ...licensed, externalStandardsIncluded: true })).toThrow(/Invalid input/)
  })

  it("locks an active rights profile and verifies its retained policy hash", async () => {
    const client = new pg.Client()
    const query = vi.spyOn(client, "query").mockImplementation(async () => ({
      command: "SELECT",
      fields: [],
      oid: 0,
      rowCount: 1,
      rows: [{ policy: officialFederalRights, policy_hash: digest(JSON.stringify(officialFederalRights)) }]
    }))

    await expect(requireRights(client, "official-federal-text", "apiMcp")).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledWith(
      "SELECT policy,policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
      ["official-federal-text"]
    )
  })

  it("fails closed for unavailable, denied, or modified rights profiles", async () => {
    const client = new pg.Client()
    const query = vi.spyOn(client, "query")
    const result = { command: "SELECT", fields: [], oid: 0, rowCount: 1 }
    query.mockImplementationOnce(async () => ({ ...result, rows: [] }))
    await expect(requireRights(client, "missing", "apiMcp")).rejects.toThrow("rights_profile_unavailable")
    query.mockImplementationOnce(async () => ({
      ...result,
      rows: [{ policy: { ...officialFederalRights, apiMcp: false }, policy_hash: "untrusted" }]
    }))
    await expect(requireRights(client, "denied", "apiMcp")).rejects.toThrow("rights_denied:apiMcp")
    query.mockImplementationOnce(async () => ({
      ...result,
      rows: [{ policy: officialFederalRights, policy_hash: "modified" }]
    }))
    await expect(requireRights(client, "modified", "apiMcp")).rejects.toThrow("rights_profile_modified")
  })
})
