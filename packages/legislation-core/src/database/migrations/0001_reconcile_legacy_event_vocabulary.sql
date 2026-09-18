UPDATE legislation.legislative_events
SET classification = CASE
    WHEN classification IS NULL OR classification = ANY (ARRAY['meeting', 'hearing', 'session', 'other'])
      THEN classification
    WHEN lower(btrim(replace(classification, '_', '-'))) = 'markup' THEN 'meeting'
    WHEN lower(btrim(replace(classification, '_', '-'))) ~ '(^|[- ])hearing$' THEN 'hearing'
    WHEN lower(btrim(replace(classification, '_', '-'))) ~ '(^|[- ])session$' THEN 'session'
    WHEN lower(btrim(replace(classification, '_', '-'))) ~ '(^|[- ])meeting$' THEN 'meeting'
    ELSE 'other'
  END,
  status = CASE
    WHEN status = ANY (ARRAY['scheduled', 'completed', 'cancelled', 'postponed', 'other']) THEN status
    WHEN lower(btrim(replace(status, '_', '-'))) IN ('scheduled', 'confirmed', 'tentative') THEN 'scheduled'
    WHEN lower(btrim(replace(status, '_', '-'))) IN ('completed', 'passed', 'held') THEN 'completed'
    WHEN lower(btrim(replace(status, '_', '-'))) IN ('cancelled', 'canceled') THEN 'cancelled'
    WHEN lower(btrim(replace(status, '_', '-'))) IN ('postponed', 'rescheduled', 'deferred') THEN 'postponed'
    ELSE 'other'
  END,
updated_at = clock_timestamp()
WHERE (classification IS NOT NULL AND classification <> ALL (ARRAY['meeting', 'hearing', 'session', 'other']))
  OR status <> ALL (ARRAY['scheduled', 'completed', 'cancelled', 'postponed', 'other']);
--> statement-breakpoint
ALTER TABLE legislation.bill_relations VALIDATE CONSTRAINT bill_relations_canonical_facts_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.bill_relations VALIDATE CONSTRAINT bill_relations_classification_check;
--> statement-breakpoint
ALTER TABLE legislation.bill_relations VALIDATE CONSTRAINT bill_relations_direction_check;
--> statement-breakpoint
ALTER TABLE legislation.bill_relations VALIDATE CONSTRAINT bill_relations_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.document_section_embeddings VALIDATE CONSTRAINT document_section_embeddings_classification_check;
--> statement-breakpoint
ALTER TABLE legislation.document_sections VALIDATE CONSTRAINT document_sections_page_range_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_events VALIDATE CONSTRAINT legislative_events_canonical_facts_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_events VALIDATE CONSTRAINT legislative_events_classification_vocabulary_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_events VALIDATE CONSTRAINT legislative_events_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_events VALIDATE CONSTRAINT legislative_events_source_sequence_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_events VALIDATE CONSTRAINT legislative_events_status_vocabulary_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_terms VALIDATE CONSTRAINT legislative_terms_chamber_vocabulary_check;
--> statement-breakpoint
ALTER TABLE legislation.legislative_terms VALIDATE CONSTRAINT legislative_terms_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_congress_end_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_detected_dates_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_effective_dates_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_historical_observation_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_last_observed_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_legislative_session_id_legislative_ses;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.organization_memberships VALIDATE CONSTRAINT organization_memberships_roster_removal_check;
--> statement-breakpoint
ALTER TABLE legislation.organizations VALIDATE CONSTRAINT organizations_chamber_check;
--> statement-breakpoint
ALTER TABLE legislation.organizations VALIDATE CONSTRAINT organizations_classification_check;
--> statement-breakpoint
ALTER TABLE legislation.organizations VALIDATE CONSTRAINT organizations_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.people VALIDATE CONSTRAINT people_provenance_complete_check;
--> statement-breakpoint
ALTER TABLE legislation.supporting_material_sections VALIDATE CONSTRAINT supporting_material_sections_pages_check;
