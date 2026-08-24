export const mcpHttpMethods = [
  "compareBillVersions",
  "findRelatedBills",
  "getAmendment",
  "getBill",
  "getBillText",
  "getBillTimeline",
  "getBillVotes",
  "getEvent",
  "getOrganization",
  "getPerson",
  "getSupportingMaterial",
  "getVote",
  "searchAmendments",
  "searchBills",
  "searchBillText",
  "searchChanges",
  "searchEvents",
  "searchOrganizations",
  "searchPeople",
  "searchSupportingMaterials",
  "searchVotes"
] as const

export type McpHttpMethod = (typeof mcpHttpMethods)[number]

const mcpHttpMethodSet: ReadonlySet<string> = new Set(mcpHttpMethods)

export function isMcpHttpMethod(value: string): value is McpHttpMethod {
  return mcpHttpMethodSet.has(value)
}
