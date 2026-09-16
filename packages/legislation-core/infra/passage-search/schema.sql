-- Run only in the separately provisioned legislation_passage_search database.
-- The official image bootstraps pg_search; this file does not install extensions.
DO $$ BEGIN
  IF current_database() <> 'legislation_passage_search' THEN
    RAISE EXCEPTION 'Not the isolated passage search database';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_search' AND extversion='0.25.9') THEN
    RAISE EXCEPTION 'Expected preinstalled pg_search 0.25.9';
  END IF;
END $$;
CREATE SCHEMA legislation;
CREATE TABLE legislation.document_sections (
  id text PRIMARY KEY,
  document_id text NOT NULL,
  heading text,
  text text NOT NULL,
  content_hash text NOT NULL,
  page_start integer,
  page_end integer,
  search_document_title text NOT NULL,
  search_metadata jsonb NOT NULL
);
CREATE INDEX document_sections_document_idx ON legislation.document_sections(document_id);
CREATE INDEX document_sections_ranked_text_idx ON legislation.document_sections USING paradedb (
  id, (document_id::pdb.literal), (heading::pdb.literal), page_start, page_end,
  ((coalesce(heading,'') || ' ' || text)::pdb.simple('alias=body','stemmer=english')),
  (search_document_title::pdb.simple('alias=title','stemmer=english')),
  (search_metadata::pdb.literal)
) WITH (key_field='id', mutable_segment_rows=0);
