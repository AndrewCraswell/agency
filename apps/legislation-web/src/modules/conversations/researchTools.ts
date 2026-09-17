export const researchToolLabels: Readonly<Record<string, string>> = {
  read_record_collection: "Read record details",
  resolve_record: "Resolve record identity",
  list_jurisdictions: "List jurisdictions",
  list_sessions: "List sessions",
  get_memberships: "Read memberships",
  get_sponsored_bills: "Read sponsored bills",
  get_committee_bills: "Read committee bills",
  get_document_sections: "Read document sections",
  search_bills: "Search bills",
  get_bill: "Read bill",
  get_bills: "Read bills",
  get_bill_timeline: "Read bill timeline",
  search_bill_text: "Search bill text",
  get_bill_text: "Read bill text",
  compare_bill_versions: "Compare bill versions",
  find_related_bills: "Find related bills",
  search_people: "Search people",
  get_person: "Read person",
  search_organizations: "Search organizations",
  get_organization: "Read organization",
  search_events: "Search meetings",
  get_event: "Read meeting",
  search_votes: "Search votes",
  get_bill_votes: "Read bill votes",
  get_vote: "Read vote",
  get_votes: "Read votes",
  search_amendments: "Search amendments",
  get_amendment: "Read amendment",
  get_amendments: "Read amendments",
  search_amendments_for_bills: "Find amendments for bills",
  search_supporting_materials: "Search supporting materials",
  get_supporting_material: "Read supporting material",
  search_changes: "Search recorded changes"
}

export function isResearchTool(name: string) {
  return Object.hasOwn(researchToolLabels, name)
}
