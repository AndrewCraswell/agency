SET LOCAL lock_timeout = '1s';
--> statement-breakpoint
SET LOCAL statement_timeout = '15s';
--> statement-breakpoint
CREATE TABLE "legislation"."amendment_section_search" (
  "section_id" text PRIMARY KEY REFERENCES "legislation"."document_sections"("id") ON DELETE CASCADE,
  "document_id" text NOT NULL REFERENCES "legislation"."bill_documents"("id") ON DELETE CASCADE,
  "section_vector" tsvector,
  "title_vector" tsvector NOT NULL
);
--> statement-breakpoint
CREATE INDEX "amendment_section_search_document_idx"
ON "legislation"."amendment_section_search" ("document_id");
--> statement-breakpoint
CREATE INDEX "amendment_section_search_section_gin_idx"
ON "legislation"."amendment_section_search" USING gin ("section_vector");
--> statement-breakpoint
CREATE INDEX "amendment_section_search_title_gin_idx"
ON "legislation"."amendment_section_search" USING gin ("title_vector");
--> statement-breakpoint
CREATE FUNCTION "legislation"."sync_amendment_section_search"() RETURNS trigger AS $$
DECLARE
  parent_classification text;
  parent_title text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.document_id IS NOT DISTINCT FROM OLD.document_id
       AND NEW.search_vector IS NOT DISTINCT FROM OLD.search_vector THEN
      RETURN NEW;
    END IF;
    -- Coordinate moves with both parents. Deterministic lock ordering reduces,
    -- but cannot eliminate, deadlocks with concurrent parent-first writers.
    -- A deadlock must abort/retry the transaction; never skip a projection write.
    PERFORM id FROM legislation.bill_documents
    WHERE id IN (OLD.document_id, NEW.document_id)
    ORDER BY id COLLATE "C" FOR SHARE;
  ELSE
    PERFORM id FROM legislation.bill_documents WHERE id = NEW.document_id FOR SHARE;
  END IF;

  -- Read after acquiring the parent lock so a committed classification/title
  -- change cannot be overwritten with a pre-lock snapshot at READ COMMITTED.
  SELECT classification, title INTO STRICT parent_classification, parent_title
  FROM legislation.bill_documents WHERE id = NEW.document_id;

  IF parent_classification = 'amendment' THEN
    INSERT INTO legislation.amendment_section_search
      (section_id, document_id, section_vector, title_vector)
    VALUES (NEW.id, NEW.document_id, NEW.search_vector,
      to_tsvector('english', coalesce(parent_title, '')))
    ON CONFLICT (section_id) DO UPDATE SET
      document_id = EXCLUDED.document_id,
      section_vector = EXCLUDED.section_vector,
      title_vector = EXCLUDED.title_vector;
  ELSE
    DELETE FROM legislation.amendment_section_search WHERE section_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Runs after the existing BEFORE trigger has produced the exact weighted vector.
-- UPDATE OF heading/text is required: a BEFORE-trigger assignment to search_vector
-- does not itself cause an UPDATE OF search_vector trigger to fire.
CREATE TRIGGER "document_sections_amendment_search_trigger"
AFTER INSERT OR UPDATE OF "document_id", "heading", "text", "search_vector"
ON "legislation"."document_sections"
FOR EACH ROW EXECUTE FUNCTION "legislation"."sync_amendment_section_search"();
--> statement-breakpoint
CREATE FUNCTION "legislation"."sync_amendment_document_search"() RETURNS trigger AS $$
BEGIN
  IF NEW.classification IS NOT DISTINCT FROM OLD.classification
     AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
    RETURN NEW;
  END IF;

  -- The parent UPDATE already owns its row lock. Section writers acquire FOR
  -- SHARE on this row before projection maintenance, serializing the two paths.
  IF NEW.classification <> 'amendment' THEN
    DELETE FROM legislation.amendment_section_search WHERE document_id = NEW.id;
  ELSIF OLD.classification <> 'amendment' THEN
    INSERT INTO legislation.amendment_section_search
      (section_id, document_id, section_vector, title_vector)
    SELECT id, document_id, search_vector, to_tsvector('english', coalesce(NEW.title, ''))
    FROM legislation.document_sections WHERE document_id = NEW.id
    ON CONFLICT (section_id) DO UPDATE SET
      document_id = EXCLUDED.document_id,
      section_vector = EXCLUDED.section_vector,
      title_vector = EXCLUDED.title_vector;
  ELSIF NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE legislation.amendment_section_search
    SET title_vector = to_tsvector('english', coalesce(NEW.title, ''))
    WHERE document_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bill_documents_amendment_search_trigger"
AFTER UPDATE OF "title", "classification" ON "legislation"."bill_documents"
FOR EACH ROW EXECUTE FUNCTION "legislation"."sync_amendment_document_search"();
