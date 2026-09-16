SET LOCAL lock_timeout = '1s';
--> statement-breakpoint
SET LOCAL statement_timeout = '15s';
--> statement-breakpoint
CREATE TABLE legislation.passage_search_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_kind text NOT NULL CHECK (entity_kind IN ('document', 'bill')),
  entity_id text NOT NULL,
  after_document_id text,
  enqueued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0,
  error_category text,
  CONSTRAINT passage_search_changes_transaction_key UNIQUE(entity_kind,entity_id,transaction_id)
);
--> statement-breakpoint
CREATE INDEX passage_search_changes_retry_idx ON legislation.passage_search_changes(retry_at,id);
--> statement-breakpoint
CREATE TABLE legislation.passage_search_backfill (
  name text PRIMARY KEY,
  after_document_id text,
  completed_at timestamptz
);
--> statement-breakpoint
CREATE FUNCTION legislation.capture_passage_search_change() RETURNS trigger AS $$
DECLARE
  old_key text;
  new_key text;
  kind text;
BEGIN
  -- No foreign keys: deleted canonical records still need search tombstones.
  -- Do not use sequence IDs as commit-order watermarks.
  CASE TG_TABLE_NAME
    WHEN 'document_sections' THEN
      kind := 'document';
      IF TG_OP <> 'INSERT' THEN old_key := OLD.document_id; END IF;
      IF TG_OP <> 'DELETE' THEN new_key := NEW.document_id; END IF;
    WHEN 'bill_documents' THEN
      kind := 'document';
      IF TG_OP <> 'INSERT' THEN old_key := OLD.id; END IF;
      IF TG_OP <> 'DELETE' THEN new_key := NEW.id; END IF;
    WHEN 'bill_sponsors' THEN
      kind := 'bill';
      IF TG_OP <> 'INSERT' THEN old_key := OLD.bill_id; END IF;
      IF TG_OP <> 'DELETE' THEN new_key := NEW.bill_id; END IF;
    WHEN 'bills' THEN
      kind := 'bill';
      IF TG_OP <> 'INSERT' THEN old_key := OLD.id; END IF;
      IF TG_OP <> 'DELETE' THEN new_key := NEW.id; END IF;
    ELSE RAISE EXCEPTION 'Unsupported passage capture table';
  END CASE;
  IF old_key IS NOT NULL THEN
    INSERT INTO legislation.passage_search_changes(entity_kind,entity_id) VALUES(kind,old_key) ON CONFLICT DO NOTHING;
  END IF;
  IF new_key IS NOT NULL AND new_key IS DISTINCT FROM old_key THEN
    INSERT INTO legislation.passage_search_changes(entity_kind,entity_id) VALUES(kind,new_key) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER capture_passage_section_change AFTER INSERT OR UPDATE OR DELETE
ON legislation.document_sections FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();
--> statement-breakpoint
CREATE TRIGGER capture_passage_document_change AFTER INSERT OR UPDATE OR DELETE
ON legislation.bill_documents FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();
--> statement-breakpoint
CREATE TRIGGER capture_passage_bill_change AFTER INSERT OR UPDATE OR DELETE
ON legislation.bills FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();
--> statement-breakpoint
CREATE TRIGGER capture_passage_sponsor_change AFTER INSERT OR UPDATE OR DELETE
ON legislation.bill_sponsors FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();
