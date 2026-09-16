import type { z } from "zod"
import { getResearchRuntime } from "../search/research-runtime"
import type { referenceSearchSchema, StagedReference } from "./chatRequest"
import { resultStore } from "./resultStore"

export async function searchReferences(
  input: z.infer<typeof referenceSearchSchema>,
  signal: AbortSignal
): Promise<StagedReference[]> {
  signal.throwIfAborted()
  if (input.kind === "all") {
    const references: StagedReference[] = []
    for (const kind of ["bill", "person", "organization", "meeting", "vote", "amendment", "material"] as const) {
      references.push(...(await searchReferences({ ...input, kind }, signal)))
    }
    return references
  }
  const query = input.query
  const result = await getResearchRuntime().run(async (service) => {
    switch (input.kind) {
      case "all":
        throw new Error("Reference search kind was not narrowed")
      case "meeting":
        return { tool: "search_events", data: await service.searchEvents({ query, limit: 5 }) }
      case "vote":
        return { tool: "search_votes", data: await service.searchVotes({ query, limit: 5 }) }
      case "person":
        return { tool: "search_people", data: await service.searchPeople({ query, limit: 5 }) }
      case "organization":
        return { tool: "search_organizations", data: await service.searchOrganizations({ query, limit: 5 }) }
      case "amendment":
        return { tool: "search_amendments", data: await service.searchAmendments({ query, limit: 5, mode: "lexical" }) }
      case "material":
        return {
          tool: "search_supporting_materials",
          data: await service.searchSupportingMaterials({ query, limit: 5, mode: "lexical" })
        }
      case "bill":
        return { tool: "search_bills", data: await service.searchBills({ query, limit: 5, mode: "lexical" }) }
    }
  })
  signal.throwIfAborted()
  const page = resultStore.create(input.sessionKey, result.tool, result.data, query, async () => {
    throw new Error("Search again to refine references")
  })
  if (!page) {
    throw new Error("Reference results could not be read")
  }
  return page.items.map((record) => ({ resultId: page.id, recordId: record.id, record }))
}
