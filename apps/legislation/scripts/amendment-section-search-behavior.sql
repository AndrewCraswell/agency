-- Root-owned isolated test only. Requires minimal canonical-shaped fixture tables:
-- bill_documents(id PK, title NOT NULL, classification NOT NULL), and
-- document_sections(id PK, document_id FK bill_documents ON DELETE CASCADE,
-- heading, text NOT NULL, search_vector), the canonical BEFORE vector trigger,
-- and migration 0046. Not a production migration or a backfill.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '1s';
DO $$ BEGIN
  IF current_database() <> 'legislation_search_benchmark' THEN
    RAISE EXCEPTION 'Behavior checks require the isolated legislation_search_benchmark';
  END IF;
END $$;

CREATE FUNCTION pg_temp.require_amendment_check(condition boolean, description text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Amendment projection check failed: %', description;
  END IF;
END $$;

INSERT INTO legislation.bill_documents(id, title, classification) VALUES
  ('diagnostic-amendment-one', 'Health insurance amendment', 'amendment'),
  ('diagnostic-amendment-two', 'Tax reform amendment', 'amendment'),
  ('diagnostic-version', 'Ordinary bill version', 'version');
INSERT INTO legislation.document_sections(id, document_id, heading, text) VALUES
  ('diagnostic-section-one', 'diagnostic-amendment-one', 'Health', 'Insurance eligibility and treatment'),
  ('diagnostic-section-null', 'diagnostic-amendment-one', NULL, 'A section whose vector will be null'),
  ('diagnostic-section-version', 'diagnostic-version', 'Tax', 'Version text is not an amendment');

SELECT pg_temp.require_amendment_check(
  (SELECT count(*) = 2 FROM legislation.amendment_section_search
   WHERE section_id LIKE 'diagnostic-section-%'), 'insert membership excludes non-amendments');
SELECT pg_temp.require_amendment_check(
  (SELECT p.section_vector IS NOT DISTINCT FROM s.search_vector
   AND p.title_vector = to_tsvector('english', d.title)
   FROM legislation.amendment_section_search p
   JOIN legislation.document_sections s ON s.id=p.section_id
   JOIN legislation.bill_documents d ON d.id=p.document_id
   WHERE s.id='diagnostic-section-one'), 'copies exact weighted vector and title');

UPDATE legislation.document_sections SET search_vector=NULL WHERE id='diagnostic-section-null';
SELECT pg_temp.require_amendment_check(
  (SELECT section_vector IS NULL FROM legislation.amendment_section_search
   WHERE section_id='diagnostic-section-null'), 'preserves nullable vector without dropping membership');
UPDATE legislation.document_sections SET heading='Tax credits', text='Housing allowance'
WHERE id='diagnostic-section-one';
SELECT pg_temp.require_amendment_check(
  (SELECT p.section_vector = s.search_vector
    AND p.section_vector = setweight(to_tsvector('english','Tax credits'),'A')
      || setweight(to_tsvector('english','Housing allowance'),'B')
   FROM legislation.amendment_section_search p
   JOIN legislation.document_sections s ON s.id=p.section_id
   WHERE s.id='diagnostic-section-one'), 'observes vector changed by BEFORE heading/text trigger');

UPDATE legislation.bill_documents SET title='Revised education amendment' WHERE id='diagnostic-amendment-one';
SELECT pg_temp.require_amendment_check(
  (SELECT count(*)=2 AND bool_and(title_vector=to_tsvector('english','Revised education amendment'))
   FROM legislation.amendment_section_search WHERE document_id='diagnostic-amendment-one'),
  'parent title refresh includes null-vector sections');

SAVEPOINT classification_rollback;
UPDATE legislation.bill_documents SET classification='version' WHERE id='diagnostic-amendment-one';
SELECT pg_temp.require_amendment_check(
  NOT EXISTS (SELECT FROM legislation.amendment_section_search WHERE document_id='diagnostic-amendment-one'),
  'classification exit removes all sections');
ROLLBACK TO SAVEPOINT classification_rollback;
SELECT pg_temp.require_amendment_check(
  (SELECT count(*)=2 FROM legislation.amendment_section_search WHERE document_id='diagnostic-amendment-one'),
  'rollback restores membership atomically');

UPDATE legislation.document_sections SET document_id='diagnostic-version' WHERE id='diagnostic-section-one';
SELECT pg_temp.require_amendment_check(
  NOT EXISTS (SELECT FROM legislation.amendment_section_search WHERE section_id='diagnostic-section-one'),
  'move to non-amendment removes section');
UPDATE legislation.bill_documents SET classification='amendment', title='New amendment'
WHERE id='diagnostic-version';
SELECT pg_temp.require_amendment_check(
  (SELECT count(*)=2 AND bool_and(title_vector=to_tsvector('english','New amendment'))
   FROM legislation.amendment_section_search WHERE document_id='diagnostic-version'),
  'classification entry copies every existing section');
UPDATE legislation.document_sections SET document_id='diagnostic-amendment-two' WHERE id='diagnostic-section-one';
SELECT pg_temp.require_amendment_check(
  (SELECT document_id='diagnostic-amendment-two'
    AND title_vector=to_tsvector('english','Tax reform amendment')
   FROM legislation.amendment_section_search WHERE section_id='diagnostic-section-one'),
  'move between amendments uses new parent title');

DELETE FROM legislation.document_sections WHERE id='diagnostic-section-one';
SELECT pg_temp.require_amendment_check(
  NOT EXISTS (SELECT FROM legislation.amendment_section_search WHERE section_id='diagnostic-section-one'),
  'section delete cascades');
DELETE FROM legislation.bill_documents WHERE id='diagnostic-amendment-one';
SELECT pg_temp.require_amendment_check(
  NOT EXISTS (SELECT FROM legislation.amendment_section_search WHERE document_id='diagnostic-amendment-one'),
  'parent delete cascades');
ROLLBACK;
