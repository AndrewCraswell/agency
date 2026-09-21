export type RefreshPolicy = "copy" | "clear" | "exclude" | "rebuild"

const copy = [
  "jurisdictions",
  "legislative_sessions",
  "bills",
  "bill_actions",
  "people",
  "person_aliases",
  "person_details",
  "person_external_identifiers",
  "person_jurisdictions",
  "organizations",
  "legislative_terms",
  "organization_memberships",
  "legislative_events",
  "event_sessions",
  "event_organizations",
  "event_participants",
  "event_bills",
  "event_documents",
  "event_agenda_items",
  "event_agenda_item_bills",
  "event_agenda_item_amendments",
  "event_agenda_item_supporting_materials",
  "event_continuations",
  "calendar_entries",
  "calendars",
  "calendar_events",
  "bill_sponsors",
  "bill_organizations",
  "bill_relations",
  "amendments",
  "amendment_actions",
  "amendment_relations",
  "supporting_materials",
  "supporting_material_sections",
  "supporting_material_links",
  "votes",
  "vote_positions",
  "event_outcome_links",
  "event_outcomes",
  "bill_documents",
  "document_sections",
  "canonical_record_fingerprints",
  "legal_rights_profiles",
  "legal_sources",
  "legal_import_manifests",
  "legal_artifacts",
  "legal_import_generations",
  "legal_import_records",
  "legal_annual_source_observations",
  "legal_codes",
  "legal_editions",
  "legal_annual_editions",
  "legal_annual_edition_volumes",
  "legal_provisions",
  "legal_provision_versions",
  "legal_edition_provisions",
  "legal_provision_source_reviews",
  "legal_code_heads",
  "legal_fr_issue_preparations",
  "legal_fr_issue_renditions",
  "regulatory_documents",
  "regulatory_document_versions",
  "regulatory_document_observations",
  "regulatory_source_documents",
  "regulatory_source_inventories",
  "regulatory_source_renditions",
  "regulatory_source_reviews"
] as const

const clear = [
  "research_result_snapshots",
  "subscriptions",
  "subscription_events",
  "webhook_audit_records",
  "subscription_deliveries",
  "api_idempotency_records",
  "document_download_leases",
  "ingestion_runs",
  "ingestion_locks",
  "sync_checkpoints",
  "change_events",
  "passage_search_changes",
  "passage_search_backfill",
  "legal_discovery_checkpoints",
  "legal_discovery_pages",
  "legal_discovery_units",
  "legal_discovery_dispatches",
  "legal_preparation_dispatches",
  "legal_preparation_plans",
  "legal_derived_outbox",
  "regulatory_publication_batches",
  "regulatory_publication_outbox"
] as const

const exclude = ["webhooks", "webhook_signing_keys"] as const

const rebuild = [
  "amendment_section_search",
  "bill_embeddings",
  "document_section_embeddings",
  "amendment_embeddings",
  "supporting_material_section_embeddings",
  "legal_copy_revisions",
  "legal_passage_generations",
  "legal_passages",
  "legal_passage_source_provenance",
  "legal_passage_preparations",
  "legal_passage_preparation_items"
] as const

export const refreshPolicy = {
  copy,
  clear,
  exclude,
  rebuild
} as const satisfies Record<RefreshPolicy, readonly string[]>

export const privateTables = clear.slice(0, 6)
export const copyTriggeredOperationalTables = [
  "passage_search_changes",
  "legal_derived_outbox",
  "regulatory_publication_outbox"
] as const

export function classifyRefreshTables(tables: readonly string[]): Map<string, RefreshPolicy> {
  const configured = new Map<string, RefreshPolicy>()
  for (const [policy, names] of Object.entries(refreshPolicy) as [RefreshPolicy, readonly string[]][]) {
    for (const name of names) {
      if (configured.has(name)) {
        throw new Error(`Refresh policy assigns legislation.${name} more than once`)
      }
      configured.set(name, policy)
    }
  }
  const unknown = tables.filter((table) => !configured.has(table))
  const missing = [...configured.keys()].filter((table) => !tables.includes(table))
  if (unknown.length > 0 || missing.length > 0) {
    throw new Error(
      `Refresh catalog does not match policy (unknown: ${unknown.join(", ") || "none"}; missing: ${missing.join(", ") || "none"})`
    )
  }
  return configured
}
