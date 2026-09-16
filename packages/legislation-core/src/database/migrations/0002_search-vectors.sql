CREATE FUNCTION "legislation"."update_bill_search_vector"() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."summary", '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW."subjects", '{}'::text[]), ' ')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "bills_search_vector_trigger"
BEFORE INSERT OR UPDATE OF "title", "summary", "subjects" ON "legislation"."bills"
FOR EACH ROW EXECUTE FUNCTION "legislation"."update_bill_search_vector"();--> statement-breakpoint
UPDATE "legislation"."bills" SET "title" = "title";--> statement-breakpoint

CREATE FUNCTION "legislation"."update_document_section_search_vector"() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."text", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "document_sections_search_vector_trigger"
BEFORE INSERT OR UPDATE OF "heading", "text" ON "legislation"."document_sections"
FOR EACH ROW EXECUTE FUNCTION "legislation"."update_document_section_search_vector"();--> statement-breakpoint
UPDATE "legislation"."document_sections" SET "text" = "text";
