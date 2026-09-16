import type { LegislationQueryApi } from "../../src/mcp/tools"
import { canonicalJson, type EvalCase } from "./contracts"

export function createFixtureService(item: EvalCase) {
  const missing: { method: string; input: unknown }[] = []
  const entries = new Map<string, unknown>()
  for (const fixture of item.fixtures) {
    const key = `${fixture.method}:${canonicalJson(fixture.input)}`
    if (entries.has(key)) {
      throw new Error("Duplicate fixture arguments.")
    }
    entries.set(key, fixture.output)
  }
  const lookup = (method: string) => async (input: unknown) => {
    const key = `${method}:${canonicalJson(input)}`
    if (!entries.has(key)) {
      missing.push({ method, input })
      throw new Error("Frozen-world fixture coverage gap.")
    }
    return structuredClone(entries.get(key))
  }
  const service: LegislationQueryApi = {
    compareBillVersions: lookup("compareBillVersions"),
    findRelatedBills: lookup("findRelatedBills"),
    getAmendment: lookup("getAmendment"),
    getBill: lookup("getBill"),
    getBillVotes: lookup("getBillVotes"),
    getBillText: lookup("getBillText"),
    getBillTimeline: lookup("getBillTimeline"),
    getEvent: lookup("getEvent"),
    getOrganization: lookup("getOrganization"),
    getPerson: lookup("getPerson"),
    getSupportingMaterial: lookup("getSupportingMaterial"),
    getVote: lookup("getVote"),
    searchAmendments: lookup("searchAmendments"),
    searchBills: lookup("searchBills"),
    searchBillText: lookup("searchBillText"),
    searchChanges: lookup("searchChanges"),
    searchEvents: lookup("searchEvents"),
    searchOrganizations: lookup("searchOrganizations"),
    searchPeople: lookup("searchPeople"),
    searchSupportingMaterials: lookup("searchSupportingMaterials"),
    searchVotes: lookup("searchVotes")
  }
  return { service, missing }
}
