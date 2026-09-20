CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6 (Debian 18.6-1.pgdg12+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg12+2)

SET LOCAL statement_timeout = 0;
SET LOCAL lock_timeout = 0;
SET LOCAL idle_in_transaction_session_timeout = 0;
SET LOCAL transaction_timeout = 0;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', true);
SET LOCAL check_function_bodies = false;
SET LOCAL xmloption = content;
SET LOCAL client_min_messages = warning;
SET LOCAL row_security = off;

--
-- Name: legislation; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA legislation;


--
-- Name: organization_membership_end_reason; Type: TYPE; Schema: legislation; Owner: -
--

CREATE TYPE legislation.organization_membership_end_reason AS ENUM (
    'roster_removal_detected',
    'congress_ended',
    'historical_at_first_observation'
);


--
-- Name: advance_legal_copy_revision(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.advance_legal_copy_revision() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE previous_id text; next_id text;
BEGIN
  IF TG_OP='TRUNCATE' THEN
    UPDATE legislation.legal_copy_revisions SET revision=revision+1;
    RETURN NULL;
  END IF;
  IF TG_OP<>'INSERT' THEN previous_id=to_jsonb(OLD)->>TG_ARGV[0]; END IF;
  IF TG_OP<>'DELETE' THEN next_id=to_jsonb(NEW)->>TG_ARGV[0]; END IF;
  IF TG_ARGV[0]='version' THEN
    previous_id=NULL; next_id=NULL;
    IF TG_OP<>'INSERT' THEN previous_id=OLD.id::text; END IF;
    IF TG_OP<>'DELETE' THEN next_id=NEW.id::text; END IF;
    INSERT INTO legislation.legal_copy_revisions(generation_id,revision)
    SELECT id,1 FROM legislation.legal_passage_generations
    WHERE (TG_TABLE_NAME='legal_provision_versions' AND provision_version_id IN (previous_id::uuid,next_id::uuid))
       OR (TG_TABLE_NAME='regulatory_document_versions' AND document_version_id IN (previous_id::uuid,next_id::uuid))
    ORDER BY id
    ON CONFLICT(generation_id) DO UPDATE SET revision=legislation.legal_copy_revisions.revision+1;
  ELSE
    INSERT INTO legislation.legal_copy_revisions(generation_id,revision)
    SELECT DISTINCT id,1 FROM unnest(ARRAY[previous_id,next_id]) AS changed(id) WHERE id IS NOT NULL ORDER BY id
    ON CONFLICT(generation_id) DO UPDATE SET revision=legislation.legal_copy_revisions.revision+1;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: capture_passage_search_change(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.capture_passage_search_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: legal_passage_source_hash(text, text, jsonb, text); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.legal_passage_source_hash(body text, heading text, blocks jsonb, input_contract text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object('body',body,'heading',heading,'blocks',blocks,'input_contract',input_contract)::text,'UTF8')),'hex')
$$;


--
-- Name: sync_amendment_document_search(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.sync_amendment_document_search() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: sync_amendment_section_search(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.sync_amendment_section_search() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: update_bill_search_vector(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.update_bill_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."summary", '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW."subjects", '{}'::text[]), ' ')), 'C');
  RETURN NEW;
END;
$$;


--
-- Name: update_document_section_search_vector(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.update_document_section_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."text", '')), 'B');
  RETURN NEW;
END;
$$;


--
-- Name: update_supporting_material_section_search_vector(); Type: FUNCTION; Schema: legislation; Owner: -
--

CREATE FUNCTION legislation.update_supporting_material_section_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."heading", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."text", '')), 'B');
  RETURN NEW;
END;
$$;


SET LOCAL default_tablespace = '';

SET LOCAL default_table_access_method = heap;

--
-- Name: amendment_actions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.amendment_actions (
    id text NOT NULL,
    amendment_id text NOT NULL,
    ordinal integer NOT NULL,
    description text NOT NULL,
    classification text[] DEFAULT '{}'::text[] NOT NULL,
    action_date date,
    action_at timestamp with time zone,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_actions_description_check CHECK ((length(description) > 0)),
    CONSTRAINT amendment_actions_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: amendment_embeddings; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.amendment_embeddings (
    amendment_id text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    input_contract text NOT NULL,
    input_hash character(64) NOT NULL,
    embedding public.vector(1536) NOT NULL,
    rollout_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_embeddings_contract_check CHECK ((length(input_contract) > 0)),
    CONSTRAINT amendment_embeddings_dimensions_check CHECK ((dimensions = 1536)),
    CONSTRAINT amendment_embeddings_hash_check CHECK ((input_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT amendment_embeddings_model_check CHECK ((length(model) > 0)),
    CONSTRAINT amendment_embeddings_rollout_check CHECK ((length(rollout_id) > 0))
);


--
-- Name: amendment_relations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.amendment_relations (
    amendment_id text NOT NULL,
    related_amendment_id text NOT NULL,
    classification text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendment_relations_distinct_check CHECK ((amendment_id <> related_amendment_id))
);


--
-- Name: amendment_section_search; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.amendment_section_search (
    section_id text NOT NULL,
    document_id text NOT NULL,
    section_vector tsvector,
    title_vector tsvector NOT NULL
);


--
-- Name: amendments; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.amendments (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    session_id text,
    bill_id text,
    sponsor_person_id text,
    source_id text NOT NULL,
    printed_identifier text NOT NULL,
    amendment_type text NOT NULL,
    amendment_number text NOT NULL,
    chamber text,
    purpose text,
    description text,
    status text,
    sponsor_name text,
    sponsor_source_id text,
    submitted_date date,
    source_url text NOT NULL,
    source_updated_at timestamp with time zone,
    upstream_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amendments_id_check CHECK ((length(id) > 0)),
    CONSTRAINT amendments_identifier_check CHECK ((length(printed_identifier) > 0)),
    CONSTRAINT amendments_number_check CHECK ((length(amendment_number) > 0)),
    CONSTRAINT amendments_source_id_check CHECK ((length(source_id) > 0)),
    CONSTRAINT amendments_type_check CHECK ((length(amendment_type) > 0))
);


--
-- Name: api_idempotency_records; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.api_idempotency_records (
    principal_scope character(64) NOT NULL,
    method text NOT NULL,
    canonical_path text NOT NULL,
    key text NOT NULL,
    request_hash character(64) NOT NULL,
    status_code integer NOT NULL,
    response_headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_ciphertext text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_idempotency_records_hash_check CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_records_key_check CHECK (((length(key) >= 8) AND (length(key) <= 128))),
    CONSTRAINT api_idempotency_records_scope_check CHECK ((principal_scope ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT api_idempotency_records_status_check CHECK (((status_code >= 200) AND (status_code <= 599)))
);


--
-- Name: bill_actions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_actions (
    id text NOT NULL,
    bill_id text NOT NULL,
    ordinal integer NOT NULL,
    description text NOT NULL,
    classification text[] DEFAULT '{}'::text[] NOT NULL,
    action_date date,
    action_at timestamp with time zone,
    chamber text,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id text,
    source_organization_id text,
    CONSTRAINT bill_actions_description_check CHECK ((length(description) > 0)),
    CONSTRAINT bill_actions_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: bill_documents; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_documents (
    id text NOT NULL,
    bill_id text NOT NULL,
    classification text NOT NULL,
    version_code text,
    title text NOT NULL,
    document_date date,
    page_count integer,
    source_url text NOT NULL,
    content_type text,
    blob_path text,
    text text,
    content_hash character(64),
    processing_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone,
    processing_attempts integer DEFAULT 0 NOT NULL,
    processing_error text,
    processing_error_category text,
    ocr_status text,
    ocr_provider text,
    ocr_completed_at timestamp with time zone,
    ocr_page_count integer,
    CONSTRAINT bill_documents_attempts_check CHECK ((processing_attempts >= 0)),
    CONSTRAINT bill_documents_error_category_check CHECK (((processing_error_category IS NULL) OR (processing_error_category = ANY (ARRAY['download-permanent'::text, 'download-transient'::text, 'malformed-document'::text, 'not-found'::text, 'ocr-required'::text, 'oversized'::text, 'processing-transient'::text, 'source-inaccessible'::text, 'unsafe-url'::text, 'unsupported-format'::text])))),
    CONSTRAINT bill_documents_hash_check CHECK (((content_hash IS NULL) OR (content_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT bill_documents_ocr_metadata_status_check CHECK ((((ocr_provider IS NULL) AND (ocr_completed_at IS NULL) AND (ocr_page_count IS NULL)) OR (NOT (ocr_status IS DISTINCT FROM 'processed'::text)))),
    CONSTRAINT bill_documents_ocr_page_count_check CHECK (((ocr_page_count IS NULL) OR (ocr_page_count > 0))),
    CONSTRAINT bill_documents_ocr_provider_check CHECK (((ocr_provider IS NULL) OR (length(btrim(ocr_provider)) > 0))),
    CONSTRAINT bill_documents_ocr_status_check CHECK (((ocr_status IS NULL) OR (ocr_status = ANY (ARRAY['not-required'::text, 'pending'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'unsupported'::text])))),
    CONSTRAINT bill_documents_ocr_success_check CHECK (((ocr_status <> 'processed'::text) OR ((ocr_provider IS NOT NULL) AND (length(btrim(ocr_provider)) > 0) AND (ocr_completed_at IS NOT NULL)))),
    CONSTRAINT bill_documents_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'unsupported'::text, 'failed'::text]))),
    CONSTRAINT bill_documents_title_check CHECK ((length(title) > 0))
);


--
-- Name: bill_embeddings; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_embeddings (
    bill_id text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    input_contract text NOT NULL,
    input_hash character(64) NOT NULL,
    embedding public.vector(1024) NOT NULL,
    rollout_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bill_embeddings_contract_check CHECK ((length(input_contract) > 0)),
    CONSTRAINT bill_embeddings_dimensions_check CHECK ((dimensions = 1024)),
    CONSTRAINT bill_embeddings_hash_check CHECK ((input_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT bill_embeddings_model_check CHECK ((length(model) > 0)),
    CONSTRAINT bill_embeddings_rollout_check CHECK ((length(rollout_id) > 0))
);


--
-- Name: bill_organizations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_organizations (
    bill_id text NOT NULL,
    organization_id text NOT NULL,
    classification text NOT NULL,
    source_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bill_organizations_classification_check CHECK ((length(classification) > 0))
);


--
-- Name: bill_relations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_relations (
    bill_id text NOT NULL,
    related_bill_id text NOT NULL,
    classification text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    direction text,
    source_url text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    canonical_facts_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT bill_relations_canonical_facts_complete_check CHECK (((NOT canonical_facts_complete) OR ((direction IS NOT NULL) AND provenance_complete AND (source_updated_at IS NOT NULL)))),
    CONSTRAINT bill_relations_classification_check CHECK ((classification = ANY (ARRAY['companion'::text, 'replacement'::text, 'replaced-by'::text, 'prior-session'::text, 'related'::text, 'other'::text]))),
    CONSTRAINT bill_relations_direction_check CHECK (((direction IS NULL) OR (direction = ANY (ARRAY['outgoing'::text, 'incoming'::text])))),
    CONSTRAINT bill_relations_distinct_check CHECK ((bill_id <> related_bill_id)),
    CONSTRAINT bill_relations_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL))))
);


--
-- Name: bill_sponsors; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bill_sponsors (
    id text NOT NULL,
    bill_id text NOT NULL,
    person_id text,
    name text NOT NULL,
    classification text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_observed_at timestamp with time zone,
    latest_observed_at timestamp with time zone,
    CONSTRAINT bill_sponsors_name_check CHECK ((length(name) > 0)),
    CONSTRAINT bill_sponsors_observation_bounds_check CHECK ((((first_observed_at IS NULL) AND (latest_observed_at IS NULL)) OR ((first_observed_at IS NOT NULL) AND (latest_observed_at IS NOT NULL) AND (first_observed_at <= latest_observed_at))))
);


--
-- Name: bills; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.bills (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    session_id text NOT NULL,
    identifier text NOT NULL,
    title text NOT NULL,
    summary text,
    classification text[] DEFAULT '{}'::text[] NOT NULL,
    status text,
    subjects text[] DEFAULT '{}'::text[] NOT NULL,
    chamber text,
    introduced_at date,
    source_updated_at timestamp with time zone,
    source_url text NOT NULL,
    upstream_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    search_vector tsvector,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding_input_hash character(64),
    embedding_model text,
    embedded_at timestamp with time zone,
    committees text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT bills_id_check CHECK ((id ~ '^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$'::text)),
    CONSTRAINT bills_identifier_check CHECK ((length(identifier) > 0)),
    CONSTRAINT bills_title_check CHECK ((length(title) > 0))
);


--
-- Name: calendar_entries; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.calendar_entries (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    organization_id text,
    session_id text,
    source_id text NOT NULL,
    title text NOT NULL,
    classification text,
    status text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    timezone text,
    description text,
    source_url text,
    source_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_entries_dates_check CHECK (((end_at IS NULL) OR (start_at <= end_at))),
    CONSTRAINT calendar_entries_source_id_check CHECK ((length(source_id) > 0)),
    CONSTRAINT calendar_entries_title_check CHECK ((length(title) > 0))
);


--
-- Name: calendar_events; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.calendar_events (
    calendar_id text NOT NULL,
    event_id text NOT NULL,
    source_provider text NOT NULL,
    source_id text NOT NULL,
    source_url text NOT NULL,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone NOT NULL,
    source_is_official boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_events_source_id_check CHECK ((length(btrim(source_id)) > 0)),
    CONSTRAINT calendar_events_source_provider_check CHECK ((length(btrim(source_provider)) > 0)),
    CONSTRAINT calendar_events_source_url_check CHECK ((source_url ~ '^https://'::text))
);


--
-- Name: calendars; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.calendars (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    organization_id text,
    source_provider text NOT NULL,
    source_id text NOT NULL,
    name text NOT NULL,
    classification text NOT NULL,
    timezone text,
    description text,
    coverage_from date,
    coverage_to date,
    source_url text NOT NULL,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone NOT NULL,
    source_is_official boolean NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendars_classification_check CHECK ((length(btrim(classification)) > 0)),
    CONSTRAINT calendars_coverage_bounds_check CHECK (((coverage_from IS NULL) OR (coverage_to IS NULL) OR (coverage_from <= coverage_to))),
    CONSTRAINT calendars_id_check CHECK ((length(id) > 0)),
    CONSTRAINT calendars_name_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT calendars_source_id_check CHECK ((length(btrim(source_id)) > 0)),
    CONSTRAINT calendars_source_provider_check CHECK ((length(btrim(source_provider)) > 0)),
    CONSTRAINT calendars_source_url_check CHECK ((source_url ~ '^https://'::text))
);


--
-- Name: canonical_record_fingerprints; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.canonical_record_fingerprints (
    record_type text NOT NULL,
    record_id text NOT NULL,
    fingerprint character(64) NOT NULL,
    fields jsonb NOT NULL,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT canonical_record_fingerprints_hash_check CHECK ((fingerprint ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT canonical_record_fingerprints_id_check CHECK ((length(record_id) > 0)),
    CONSTRAINT canonical_record_fingerprints_type_check CHECK ((length(record_type) > 0))
);


--
-- Name: change_events; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.change_events (
    id text NOT NULL,
    ingestion_run_id uuid NOT NULL,
    record_type text NOT NULL,
    record_id text NOT NULL,
    change_type text NOT NULL,
    jurisdiction_id text,
    organization_id text,
    person_id text,
    changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
    before jsonb,
    after jsonb,
    source_updated_at timestamp with time zone,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_url text,
    source_provider text,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    CONSTRAINT change_events_change_type_check CHECK ((change_type = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'cancel'::text, 'reschedule'::text, 'relationship-change'::text]))),
    CONSTRAINT change_events_id_check CHECK ((length(id) > 0)),
    CONSTRAINT change_events_record_id_check CHECK ((length(record_id) > 0)),
    CONSTRAINT change_events_record_type_check CHECK ((length(record_type) > 0)),
    CONSTRAINT change_events_source_snapshot_check CHECK ((((source_url IS NULL) AND (source_provider IS NULL) AND (source_retrieved_at IS NULL) AND (source_is_official IS NULL)) OR ((source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL))))
);


--
-- Name: document_download_leases; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.document_download_leases (
    host text NOT NULL,
    slot integer NOT NULL,
    owner_id uuid,
    expires_at timestamp with time zone NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_download_leases_host_check CHECK (((length(host) > 0) AND (host = lower(host)))),
    CONSTRAINT document_download_leases_slot_check CHECK ((slot > 0))
);


--
-- Name: document_section_embeddings; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.document_section_embeddings (
    section_id text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    input_contract text NOT NULL,
    input_hash character(64) NOT NULL,
    embedding public.vector(1536) NOT NULL,
    rollout_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    document_classification text,
    CONSTRAINT document_section_embeddings_classification_check CHECK (((document_classification IS NULL) OR (document_classification = ANY (ARRAY['amendment'::text, 'analysis'::text, 'fiscal-note'::text, 'supplemental'::text, 'version'::text])))),
    CONSTRAINT document_section_embeddings_contract_check CHECK ((length(input_contract) > 0)),
    CONSTRAINT document_section_embeddings_dimensions_check CHECK ((dimensions = 1536)),
    CONSTRAINT document_section_embeddings_hash_check CHECK ((input_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT document_section_embeddings_model_check CHECK ((length(model) > 0)),
    CONSTRAINT document_section_embeddings_rollout_check CHECK ((length(rollout_id) > 0))
);


--
-- Name: document_sections; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.document_sections (
    id text NOT NULL,
    document_id text NOT NULL,
    ordinal integer NOT NULL,
    section_identifier text,
    heading text,
    text text NOT NULL,
    content_hash character(64) NOT NULL,
    search_vector tsvector,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding_input_hash character(64),
    embedding_model text,
    embedded_at timestamp with time zone,
    source_start_offset integer NOT NULL,
    source_end_offset integer NOT NULL,
    page_start integer,
    page_end integer,
    CONSTRAINT document_sections_hash_check CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT document_sections_offsets_check CHECK (((source_start_offset >= 0) AND (source_end_offset >= source_start_offset))),
    CONSTRAINT document_sections_ordinal_check CHECK ((ordinal >= 0)),
    CONSTRAINT document_sections_page_range_check CHECK ((((page_start IS NULL) AND (page_end IS NULL)) OR ((page_start IS NOT NULL) AND (page_end IS NOT NULL) AND (page_start > 0) AND (page_end >= page_start)))),
    CONSTRAINT document_sections_text_check CHECK ((length(text) > 0))
);


--
-- Name: event_agenda_item_amendments; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_agenda_item_amendments (
    agenda_item_id text NOT NULL,
    amendment_id text NOT NULL
);


--
-- Name: event_agenda_item_bills; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_agenda_item_bills (
    agenda_item_id text NOT NULL,
    bill_id text NOT NULL
);


--
-- Name: event_agenda_item_supporting_materials; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_agenda_item_supporting_materials (
    agenda_item_id text NOT NULL,
    material_id text NOT NULL
);


--
-- Name: event_agenda_items; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_agenda_items (
    id text NOT NULL,
    event_id text NOT NULL,
    ordinal integer NOT NULL,
    description text,
    classification text,
    organization_id text,
    document_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text,
    status text,
    canonical_facts_complete boolean DEFAULT false NOT NULL,
    bill_relations_complete boolean DEFAULT false NOT NULL,
    amendment_relations_complete boolean DEFAULT false NOT NULL,
    material_relations_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT event_agenda_items_canonical_facts_check CHECK (((NOT canonical_facts_complete) OR ((title IS NOT NULL) AND (length(btrim(title)) > 0)))),
    CONSTRAINT event_agenda_items_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: event_bills; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_bills (
    event_id text NOT NULL,
    bill_id text NOT NULL,
    classification text DEFAULT 'related'::text NOT NULL
);


--
-- Name: event_continuations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_continuations (
    event_id text NOT NULL,
    continuation_event_id text,
    continuation_at timestamp with time zone,
    source_id text NOT NULL,
    CONSTRAINT event_continuations_distinct_check CHECK (((continuation_event_id IS NULL) OR (event_id <> continuation_event_id))),
    CONSTRAINT event_continuations_source_id_check CHECK ((length(source_id) > 0))
);


--
-- Name: event_documents; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_documents (
    id text NOT NULL,
    event_id text NOT NULL,
    title text NOT NULL,
    classification text,
    source_url text NOT NULL,
    document_date date,
    content_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_documents_source_url_check CHECK ((length(source_url) > 0)),
    CONSTRAINT event_documents_title_check CHECK ((length(title) > 0))
);


--
-- Name: event_organizations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_organizations (
    event_id text NOT NULL,
    organization_id text NOT NULL
);


--
-- Name: event_outcome_links; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_outcome_links (
    id text NOT NULL,
    event_id text NOT NULL,
    action_id text,
    vote_id text,
    link_method text NOT NULL,
    source_reference text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_outcome_links_method_check CHECK ((link_method = ANY (ARRAY['explicit'::text, 'deterministic-id'::text]))),
    CONSTRAINT event_outcome_links_reference_check CHECK ((length(source_reference) > 0)),
    CONSTRAINT event_outcome_links_target_check CHECK ((((action_id IS NOT NULL) AND (vote_id IS NULL)) OR ((action_id IS NULL) AND (vote_id IS NOT NULL))))
);


--
-- Name: event_outcomes; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_outcomes (
    id text NOT NULL,
    event_id text NOT NULL,
    agenda_association text NOT NULL,
    agenda_item_id text,
    classification text NOT NULL,
    description text NOT NULL,
    action_id text,
    vote_id text,
    link_method text NOT NULL,
    source_sequence integer NOT NULL,
    source_url text NOT NULL,
    source_provider text NOT NULL,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone NOT NULL,
    source_is_official boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    occurred_at timestamp with time zone,
    occurred_date date,
    timeline_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT event_outcomes_agenda_association_check CHECK ((((agenda_association = 'explicit'::text) AND (agenda_item_id IS NOT NULL)) OR ((agenda_association = 'none'::text) AND (agenda_item_id IS NULL)))),
    CONSTRAINT event_outcomes_classification_check CHECK ((classification = ANY (ARRAY['action'::text, 'vote'::text, 'disposition'::text, 'note'::text]))),
    CONSTRAINT event_outcomes_description_check CHECK ((length(btrim(description)) > 0)),
    CONSTRAINT event_outcomes_link_method_check CHECK ((link_method = ANY (ARRAY['explicit'::text, 'deterministic-id'::text]))),
    CONSTRAINT event_outcomes_source_provider_check CHECK ((length(btrim(source_provider)) > 0)),
    CONSTRAINT event_outcomes_source_sequence_check CHECK ((source_sequence >= 0)),
    CONSTRAINT event_outcomes_source_url_check CHECK ((source_url ~ '^https://'::text)),
    CONSTRAINT event_outcomes_target_check CHECK ((((classification = 'action'::text) AND (action_id IS NOT NULL) AND (vote_id IS NULL)) OR ((classification = 'vote'::text) AND (action_id IS NULL) AND (vote_id IS NOT NULL)) OR ((classification = ANY (ARRAY['disposition'::text, 'note'::text])) AND (action_id IS NULL) AND (vote_id IS NULL)))),
    CONSTRAINT event_outcomes_timeline_complete_check CHECK (((NOT timeline_complete) OR ((occurred_at IS NOT NULL) AND (occurred_date IS NOT NULL))))
);


--
-- Name: event_participants; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_participants (
    id text NOT NULL,
    event_id text NOT NULL,
    person_id text,
    organization_id text,
    name text NOT NULL,
    role text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_participants_name_check CHECK ((length(name) > 0)),
    CONSTRAINT event_participants_target_check CHECK (((person_id IS NOT NULL) OR (organization_id IS NOT NULL) OR (length(name) > 0)))
);


--
-- Name: event_sessions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.event_sessions (
    event_id text NOT NULL,
    session_id text NOT NULL
);


--
-- Name: ingestion_locks; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.ingestion_locks (
    source text NOT NULL,
    operation text NOT NULL,
    scope_key text NOT NULL,
    owner_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ingestion_locks_operation_check CHECK ((length(operation) > 0)),
    CONSTRAINT ingestion_locks_scope_key_check CHECK ((length(scope_key) > 0)),
    CONSTRAINT ingestion_locks_source_check CHECK ((length(source) > 0))
);


--
-- Name: ingestion_runs; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.ingestion_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    operation text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    scope jsonb DEFAULT '{}'::jsonb NOT NULL,
    counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    error_summary text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    correlation_id text DEFAULT (gen_random_uuid())::text NOT NULL,
    workflow_execution_id text,
    CONSTRAINT ingestion_runs_completion_check CHECK ((((status = 'running'::text) AND (completed_at IS NULL)) OR ((status <> 'running'::text) AND (completed_at IS NOT NULL)))),
    CONSTRAINT ingestion_runs_correlation_id_check CHECK ((length(correlation_id) > 0)),
    CONSTRAINT ingestion_runs_operation_check CHECK ((length(operation) > 0)),
    CONSTRAINT ingestion_runs_source_check CHECK ((length(source) > 0)),
    CONSTRAINT ingestion_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text, 'deferred'::text])))
);


--
-- Name: jurisdictions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.jurisdictions (
    id text NOT NULL,
    name text NOT NULL,
    classification text NOT NULL,
    country_code character(2) NOT NULL,
    subdivision_code text,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    timezone text,
    is_active boolean,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT jurisdictions_classification_check CHECK ((classification = ANY (ARRAY['country'::text, 'state'::text, 'district'::text, 'territory'::text]))),
    CONSTRAINT jurisdictions_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT jurisdictions_id_check CHECK ((length(id) > 0)),
    CONSTRAINT jurisdictions_name_check CHECK ((length(name) > 0)),
    CONSTRAINT jurisdictions_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url ~ '^https://'::text) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT jurisdictions_timezone_check CHECK (((timezone IS NULL) OR (length(timezone) > 0)))
);


--
-- Name: legal_annual_edition_volumes; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_annual_edition_volumes (
    annual_edition_id text NOT NULL,
    code_id uuid NOT NULL,
    volume integer NOT NULL,
    edition_id uuid NOT NULL,
    CONSTRAINT legal_annual_edition_volumes_volume_check CHECK ((volume > 0))
);


--
-- Name: legal_annual_editions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_annual_editions (
    id text NOT NULL,
    manifest_id text NOT NULL,
    code_id uuid NOT NULL,
    package_year integer NOT NULL,
    revision_date date NOT NULL,
    expected_volumes integer NOT NULL,
    coverage jsonb NOT NULL,
    published_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_annual_editions_expected_volumes_check CHECK (((expected_volumes >= 1) AND (expected_volumes <= 200))),
    CONSTRAINT legal_annual_editions_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_annual_editions_package_year_check CHECK (((package_year >= 1996) AND (package_year <= 9999)))
);


--
-- Name: legal_annual_source_observations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_annual_source_observations (
    generation_id text NOT NULL,
    anchor_edition_id uuid NOT NULL,
    package_year integer NOT NULL,
    revision_date date NOT NULL,
    disposition text NOT NULL,
    evidence jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_annual_source_observations_check CHECK (((package_year)::numeric > EXTRACT(year FROM revision_date))),
    CONSTRAINT legal_annual_source_observations_disposition_check CHECK ((disposition = 'duplicate_revision'::text)),
    CONSTRAINT legal_annual_source_observations_package_year_check CHECK (((package_year >= 1996) AND (package_year <= 9999)))
);


--
-- Name: legal_artifacts; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_artifacts (
    hash text NOT NULL,
    bytes bigint NOT NULL,
    storage_locator text NOT NULL,
    acquired_at timestamp with time zone NOT NULL,
    CONSTRAINT legal_artifacts_bytes_check CHECK ((bytes > 0)),
    CONSTRAINT legal_artifacts_hash_check CHECK ((hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_code_heads; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_code_heads (
    code_id uuid NOT NULL,
    source_id text NOT NULL,
    edition_id uuid NOT NULL
);


--
-- Name: legal_codes; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id text NOT NULL,
    code_key text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    CONSTRAINT legal_codes_kind_check CHECK ((kind = ANY (ARRAY['regulation'::text, 'statute'::text])))
);


--
-- Name: legal_copy_revisions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_copy_revisions (
    generation_id text NOT NULL,
    revision bigint NOT NULL,
    CONSTRAINT legal_copy_revisions_generation_id_check CHECK ((generation_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_copy_revisions_revision_check CHECK ((revision > 0))
);


--
-- Name: legal_derived_outbox; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_derived_outbox (
    id bigint NOT NULL,
    edition_id uuid NOT NULL,
    operation text NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    retry_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_derived_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT legal_derived_outbox_operation_check CHECK ((operation = ANY (ARRAY['lexical'::text, 'embedding'::text, 'event'::text]))),
    CONSTRAINT legal_derived_outbox_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'acknowledged'::text])))
);


--
-- Name: legal_derived_outbox_id_seq; Type: SEQUENCE; Schema: legislation; Owner: -
--

CREATE SEQUENCE legislation.legal_derived_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: legal_derived_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: legislation; Owner: -
--

ALTER SEQUENCE legislation.legal_derived_outbox_id_seq OWNED BY legislation.legal_derived_outbox.id;


--
-- Name: legal_discovery_checkpoints; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_discovery_checkpoints (
    source_id text NOT NULL,
    scope_key text NOT NULL,
    query_hash text NOT NULL,
    query jsonb NOT NULL,
    committed_cursor jsonb,
    window_started_at timestamp with time zone,
    window_ended_at timestamp with time zone,
    overlap_started_at timestamp with time zone,
    source_cutoff jsonb,
    last_attempt_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_page_id text,
    revision bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_discovery_checkpoints_check CHECK (((window_started_at IS NULL) = (window_ended_at IS NULL))),
    CONSTRAINT legal_discovery_checkpoints_check1 CHECK (((window_started_at IS NULL) OR (window_started_at <= window_ended_at))),
    CONSTRAINT legal_discovery_checkpoints_check2 CHECK (((overlap_started_at IS NULL) OR (window_started_at IS NULL) OR (overlap_started_at <= window_started_at))),
    CONSTRAINT legal_discovery_checkpoints_last_page_id_check CHECK (((last_page_id IS NULL) OR (last_page_id ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT legal_discovery_checkpoints_query_check CHECK ((jsonb_typeof(query) = 'object'::text)),
    CONSTRAINT legal_discovery_checkpoints_query_hash_check CHECK ((query_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_discovery_checkpoints_revision_check CHECK ((revision >= 0)),
    CONSTRAINT legal_discovery_checkpoints_scope_key_check CHECK ((scope_key ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_discovery_dispatches; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_discovery_dispatches (
    id text NOT NULL,
    source_id text NOT NULL,
    scope_key text NOT NULL,
    unit_key text NOT NULL,
    manifest_id text NOT NULL,
    stage text NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    first_attempt_at timestamp with time zone,
    run_id text,
    run_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_observed_status text,
    last_observed_at timestamp with time zone,
    completed_at timestamp with time zone,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_discovery_dispatches_attempt_check CHECK ((attempt >= 0)),
    CONSTRAINT legal_discovery_dispatches_check CHECK (((lease_token IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT legal_discovery_dispatches_check1 CHECK (((state = 'submitted'::text) = (run_id IS NOT NULL))),
    CONSTRAINT legal_discovery_dispatches_check2 CHECK (((state = 'pending'::text) OR (first_attempt_at IS NOT NULL))),
    CONSTRAINT legal_discovery_dispatches_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_discovery_dispatches_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT legal_discovery_dispatches_payload_hash_check CHECK ((payload_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_discovery_dispatches_run_history_check CHECK ((jsonb_typeof(run_history) = 'array'::text)),
    CONSTRAINT legal_discovery_dispatches_stage_check CHECK ((stage = ANY (ARRAY['acquisition'::text, 'parsing'::text, 'publication'::text]))),
    CONSTRAINT legal_discovery_dispatches_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'submitting'::text, 'submitted'::text])))
);


--
-- Name: legal_discovery_pages; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_discovery_pages (
    id text NOT NULL,
    source_id text NOT NULL,
    scope_key text NOT NULL,
    expected_revision bigint NOT NULL,
    expected_cursor jsonb,
    next_cursor jsonb,
    unit_count integer NOT NULL,
    committed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_discovery_pages_expected_revision_check CHECK ((expected_revision >= 0)),
    CONSTRAINT legal_discovery_pages_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_discovery_pages_unit_count_check CHECK (((unit_count >= 0) AND (unit_count <= 100)))
);


--
-- Name: legal_discovery_units; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_discovery_units (
    source_id text NOT NULL,
    scope_key text NOT NULL,
    unit_key text NOT NULL,
    payload_hash text NOT NULL,
    unit jsonb NOT NULL,
    manifest_id text,
    state text DEFAULT 'pending'::text NOT NULL,
    discovered_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    registered_at timestamp with time zone,
    artifact_hash text,
    artifact_bytes bigint,
    storage_locator text,
    acquisition_receipt jsonb,
    acquired_at timestamp with time zone,
    parser_hash text,
    normalized_generation text,
    normalized_locator text,
    parse_summary jsonb,
    parsed_at timestamp with time zone,
    publication_generation_id text,
    edition_id uuid,
    published_at timestamp with time zone,
    CONSTRAINT legal_discovery_units_artifact_bytes_check CHECK (((artifact_bytes IS NULL) OR (artifact_bytes > 0))),
    CONSTRAINT legal_discovery_units_artifact_hash_check CHECK (((artifact_hash IS NULL) OR (artifact_hash ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT legal_discovery_units_check CHECK ((((state = 'pending'::text) AND (registered_at IS NULL)) OR ((state = ANY (ARRAY['registered'::text, 'acquired'::text, 'parsed'::text, 'published'::text])) AND (registered_at IS NOT NULL)) OR (state = 'quarantined'::text))),
    CONSTRAINT legal_discovery_units_check1 CHECK ((((state = 'pending'::text) AND (manifest_id IS NULL)) OR ((state = ANY (ARRAY['registered'::text, 'acquired'::text, 'parsed'::text, 'published'::text])) AND (manifest_id IS NOT NULL)) OR (state = 'quarantined'::text))),
    CONSTRAINT legal_discovery_units_check2 CHECK (((state = ANY (ARRAY['acquired'::text, 'parsed'::text, 'published'::text])) = ((artifact_hash IS NOT NULL) AND (artifact_bytes IS NOT NULL) AND (storage_locator IS NOT NULL) AND (acquisition_receipt IS NOT NULL) AND (acquired_at IS NOT NULL)))),
    CONSTRAINT legal_discovery_units_check3 CHECK (((state = ANY (ARRAY['parsed'::text, 'published'::text])) = ((parser_hash IS NOT NULL) AND (normalized_generation IS NOT NULL) AND (normalized_locator IS NOT NULL) AND (parse_summary IS NOT NULL) AND (parsed_at IS NOT NULL)))),
    CONSTRAINT legal_discovery_units_normalized_generation_check CHECK (((normalized_generation IS NULL) OR (normalized_generation ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT legal_discovery_units_parser_hash_check CHECK (((parser_hash IS NULL) OR (parser_hash ~ '^[a-f0-9]{64}$'::text))),
    CONSTRAINT legal_discovery_units_payload_hash_check CHECK ((payload_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_discovery_units_published_check CHECK (((state = 'published'::text) = ((publication_generation_id IS NOT NULL) AND (published_at IS NOT NULL) AND (((source_id = 'govinfo-fr'::text) AND (edition_id IS NULL)) OR ((source_id <> 'govinfo-fr'::text) AND (edition_id IS NOT NULL)))))),
    CONSTRAINT legal_discovery_units_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'registered'::text, 'acquired'::text, 'parsed'::text, 'published'::text, 'quarantined'::text]))),
    CONSTRAINT legal_discovery_units_unit_check CHECK ((jsonb_typeof(unit) = 'object'::text)),
    CONSTRAINT legal_discovery_units_unit_key_check CHECK ((unit_key ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_edition_provisions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_edition_provisions (
    edition_id uuid NOT NULL,
    code_id uuid NOT NULL,
    provision_id uuid NOT NULL,
    version_id uuid NOT NULL,
    parent_id uuid,
    ordinal integer NOT NULL,
    source_locator text NOT NULL,
    source_attributes jsonb NOT NULL,
    native_id text NOT NULL,
    CONSTRAINT legal_edition_provisions_check CHECK ((parent_id IS DISTINCT FROM provision_id)),
    CONSTRAINT legal_edition_provisions_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: legal_editions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_editions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_id uuid NOT NULL,
    jurisdiction_id text NOT NULL,
    source_id text NOT NULL,
    generation_id text NOT NULL,
    rights_profile_id text NOT NULL,
    native_key text NOT NULL,
    source_revision text NOT NULL,
    issue_date date,
    currency_date date,
    published_at timestamp with time zone
);


--
-- Name: legal_fr_issue_preparations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_fr_issue_preparations (
    source_id text DEFAULT 'govinfo-fr'::text NOT NULL,
    scope_key text NOT NULL,
    unit_key text NOT NULL,
    manifest_id text NOT NULL,
    issue_date date NOT NULL,
    generation_id text NOT NULL,
    metadata_manifest_id text NOT NULL,
    metadata_locator text NOT NULL,
    metadata_records integer NOT NULL,
    expected_renditions integer NOT NULL,
    validated_renditions integer DEFAULT 0 NOT NULL,
    state text DEFAULT 'renditions_pending'::text NOT NULL,
    failure_code text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    last_error text,
    CONSTRAINT legal_fr_issue_preparations_check CHECK (((validated_renditions >= 0) AND (validated_renditions <= expected_renditions))),
    CONSTRAINT legal_fr_issue_preparations_check1 CHECK (((state = 'quarantined'::text) = (failure_code IS NOT NULL))),
    CONSTRAINT legal_fr_issue_preparations_check2 CHECK (((state <> 'ready'::text) OR (validated_renditions = expected_renditions))),
    CONSTRAINT legal_fr_issue_preparations_check3 CHECK (((state <> 'published'::text) OR (validated_renditions = expected_renditions))),
    CONSTRAINT legal_fr_issue_preparations_expected_renditions_check CHECK (((expected_renditions > 0) AND (expected_renditions <= 1000))),
    CONSTRAINT legal_fr_issue_preparations_generation_id_check CHECK ((generation_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_fr_issue_preparations_manifest_id_check CHECK ((manifest_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_fr_issue_preparations_metadata_manifest_id_check CHECK ((metadata_manifest_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_fr_issue_preparations_metadata_records_check CHECK ((metadata_records >= 0)),
    CONSTRAINT legal_fr_issue_preparations_source_id_check CHECK ((source_id = 'govinfo-fr'::text)),
    CONSTRAINT legal_fr_issue_preparations_state_check CHECK ((state = ANY (ARRAY['renditions_pending'::text, 'ready'::text, 'published'::text, 'quarantined'::text]))),
    CONSTRAINT legal_fr_issue_preparations_unit_key_check CHECK ((unit_key ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_fr_issue_renditions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_fr_issue_renditions (
    source_id text DEFAULT 'govinfo-fr'::text NOT NULL,
    scope_key text NOT NULL,
    unit_key text NOT NULL,
    document_number text NOT NULL,
    metadata_manifest_id text NOT NULL,
    metadata_record jsonb NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    receipt jsonb,
    inspection jsonb,
    storage_locator text,
    attempt integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    last_error text,
    failure_code text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_fr_issue_renditions_attempt_check CHECK ((attempt >= 0)),
    CONSTRAINT legal_fr_issue_renditions_check CHECK (((state = ANY (ARRAY['acquired'::text, 'validated'::text])) = ((receipt IS NOT NULL) AND (storage_locator IS NOT NULL)))),
    CONSTRAINT legal_fr_issue_renditions_check1 CHECK (((state = 'validated'::text) = (inspection IS NOT NULL))),
    CONSTRAINT legal_fr_issue_renditions_check2 CHECK (((state = 'quarantined'::text) = (failure_code IS NOT NULL))),
    CONSTRAINT legal_fr_issue_renditions_check3 CHECK (((lease_token IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT legal_fr_issue_renditions_document_number_check CHECK ((document_number ~ '^[A-Z0-9]+(-[A-Z0-9]+)+$'::text)),
    CONSTRAINT legal_fr_issue_renditions_metadata_manifest_id_check CHECK ((metadata_manifest_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_fr_issue_renditions_metadata_record_check CHECK ((jsonb_typeof(metadata_record) = 'object'::text)),
    CONSTRAINT legal_fr_issue_renditions_source_id_check CHECK ((source_id = 'govinfo-fr'::text)),
    CONSTRAINT legal_fr_issue_renditions_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'acquired'::text, 'validated'::text, 'quarantined'::text]))),
    CONSTRAINT legal_fr_issue_renditions_unit_key_check CHECK ((unit_key ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_import_generations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_import_generations (
    id text NOT NULL,
    manifest_id text NOT NULL,
    unit_key text NOT NULL,
    source_id text NOT NULL,
    jurisdiction_id text NOT NULL,
    rights_profile_id text NOT NULL,
    artifact_hash text NOT NULL,
    parser_hash text NOT NULL,
    contract text NOT NULL,
    unit jsonb NOT NULL,
    summary jsonb NOT NULL,
    expected_records integer NOT NULL,
    state text DEFAULT 'staging'::text NOT NULL,
    blocked_reason text,
    fence integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_import_generations_check CHECK (((expected_records > 0) OR ((expected_records = 0) AND (contract = 'fr-html-import-2026-09-14'::text)))),
    CONSTRAINT legal_import_generations_check1 CHECK (((lease_token IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT legal_import_generations_fence_check CHECK ((fence >= 0)),
    CONSTRAINT legal_import_generations_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_import_generations_state_check CHECK ((state = ANY (ARRAY['staging'::text, 'validated'::text, 'materialized'::text, 'published'::text, 'blocked'::text, 'observed'::text])))
);


--
-- Name: legal_import_manifests; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_import_manifests (
    id text NOT NULL,
    body jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_import_manifests_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_import_records; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_import_records (
    generation_id text NOT NULL,
    record_key text NOT NULL,
    native_id text NOT NULL,
    ordinal integer NOT NULL,
    parent_key text,
    node_kind text NOT NULL,
    source_locator text NOT NULL,
    identity_key text NOT NULL,
    payload_bytes integer NOT NULL,
    record_hash text NOT NULL,
    payload jsonb NOT NULL,
    CONSTRAINT legal_import_records_ordinal_check CHECK ((ordinal >= 0)),
    CONSTRAINT legal_import_records_payload_bytes_check CHECK (((payload_bytes > 0) AND (payload_bytes <= 67108864))),
    CONSTRAINT legal_import_records_record_hash_check CHECK ((record_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_passage_generations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_passage_generations (
    id text NOT NULL,
    provision_version_id uuid,
    document_version_id uuid,
    contract text NOT NULL,
    body_hash text NOT NULL,
    tokenizer_id text NOT NULL,
    context text NOT NULL,
    manifest_hash text NOT NULL,
    passage_count integer NOT NULL,
    eligibility text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_passage_generations_body_hash_check CHECK ((body_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_passage_generations_check CHECK ((num_nonnulls(provision_version_id, document_version_id) = 1)),
    CONSTRAINT legal_passage_generations_check1 CHECK (((passage_count = 0) = (eligibility = 'empty_text'::text))),
    CONSTRAINT legal_passage_generations_eligibility_check CHECK ((eligibility = ANY (ARRAY['eligible'::text, 'empty_text'::text]))),
    CONSTRAINT legal_passage_generations_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_passage_generations_manifest_hash_check CHECK ((manifest_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_passage_generations_passage_count_check CHECK ((passage_count >= 0))
);


--
-- Name: legal_passage_preparation_items; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_passage_preparation_items (
    preparation_id text NOT NULL,
    ordinal integer NOT NULL,
    version_id uuid NOT NULL,
    context text NOT NULL,
    generation_id text,
    failure_code text,
    failed_at timestamp with time zone,
    CONSTRAINT legal_passage_preparation_items_check CHECK (((failure_code IS NULL) = (failed_at IS NULL))),
    CONSTRAINT legal_passage_preparation_items_check1 CHECK (((generation_id IS NULL) OR (failure_code IS NULL))),
    CONSTRAINT legal_passage_preparation_items_failure_code_check CHECK ((failure_code ~ '^[a-z_]+$'::text))
);


--
-- Name: legal_passage_preparations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_passage_preparations (
    id text NOT NULL,
    edition_id uuid,
    observation_id uuid,
    tokenizer_id text NOT NULL,
    inventory_hash text NOT NULL,
    expected_count integer NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    fence integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    retry_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    last_error text,
    CONSTRAINT legal_passage_preparations_check CHECK ((num_nonnulls(edition_id, observation_id) = 1)),
    CONSTRAINT legal_passage_preparations_check1 CHECK (((lease_token IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT legal_passage_preparations_expected_count_check CHECK ((expected_count > 0)),
    CONSTRAINT legal_passage_preparations_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'prepared'::text, 'blocked'::text])))
);


--
-- Name: legal_passage_source_provenance; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_passage_source_provenance (
    generation_id text NOT NULL,
    source_hash text NOT NULL,
    CONSTRAINT legal_passage_source_provenance_source_hash_check CHECK ((source_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_passages; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_passages (
    id text NOT NULL,
    generation_id text NOT NULL,
    ordinal integer NOT NULL,
    body text NOT NULL,
    input_text text NOT NULL,
    data jsonb NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, input_text)) STORED,
    CONSTRAINT legal_passages_check CHECK (((body = (data ->> 'text'::text)) AND (input_text = (data ->> 'inputText'::text)) AND (ordinal = ((data ->> 'ordinal'::text))::integer))),
    CONSTRAINT legal_passages_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_passages_ordinal_check CHECK ((ordinal >= 0))
);


--
-- Name: legal_preparation_dispatches; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_preparation_dispatches (
    id text NOT NULL,
    wave_id uuid NOT NULL,
    scope_kind text NOT NULL,
    scope_id uuid NOT NULL,
    model text NOT NULL,
    preparation_id text NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    first_attempt_at timestamp with time zone,
    run_id text,
    run_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    last_observed_status text,
    last_observed_at timestamp with time zone,
    completed_at timestamp with time zone,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_preparation_dispatches_attempt_check CHECK ((attempt >= 0)),
    CONSTRAINT legal_preparation_dispatches_check CHECK (((lease_token IS NULL) = (lease_expires_at IS NULL))),
    CONSTRAINT legal_preparation_dispatches_check1 CHECK (((state = 'submitted'::text) = (run_id IS NOT NULL))),
    CONSTRAINT legal_preparation_dispatches_check2 CHECK (((state = 'pending'::text) OR (first_attempt_at IS NOT NULL))),
    CONSTRAINT legal_preparation_dispatches_id_check CHECK ((id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_preparation_dispatches_model_check CHECK ((model = ANY (ARRAY['openai/text-embedding-3-small'::text, 'voyageai/voyage-4'::text]))),
    CONSTRAINT legal_preparation_dispatches_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT legal_preparation_dispatches_payload_hash_check CHECK ((payload_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_preparation_dispatches_preparation_id_check CHECK ((preparation_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_preparation_dispatches_run_history_check CHECK ((jsonb_typeof(run_history) = 'array'::text)),
    CONSTRAINT legal_preparation_dispatches_scope_kind_check CHECK ((scope_kind = ANY (ARRAY['edition'::text, 'publication'::text]))),
    CONSTRAINT legal_preparation_dispatches_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'submitting'::text, 'submitted'::text])))
);


--
-- Name: legal_preparation_plans; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_preparation_plans (
    wave_id uuid NOT NULL,
    request_hash text NOT NULL,
    parameters jsonb NOT NULL,
    after_id uuid,
    exhausted boolean DEFAULT false NOT NULL,
    selected_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_preparation_plans_parameters_check CHECK ((jsonb_typeof(parameters) = 'object'::text)),
    CONSTRAINT legal_preparation_plans_request_hash_check CHECK ((request_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_preparation_plans_selected_count_check CHECK ((selected_count >= 0))
);


--
-- Name: legal_provision_source_reviews; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_provision_source_reviews (
    edition_id uuid NOT NULL,
    version_id uuid NOT NULL,
    table_index integer NOT NULL,
    block_hash text NOT NULL,
    review_hash text NOT NULL,
    disposition text NOT NULL,
    evidence jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT legal_provision_source_reviews_block_hash_check CHECK ((block_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_provision_source_reviews_disposition_check CHECK ((disposition = ANY (ARRAY['accepted_context'::text, 'quarantined_source_gap'::text, 'non_data_table'::text]))),
    CONSTRAINT legal_provision_source_reviews_review_hash_check CHECK ((review_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT legal_provision_source_reviews_table_index_check CHECK ((table_index >= 0))
);


--
-- Name: legal_provision_versions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_provision_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provision_id uuid NOT NULL,
    code_id uuid NOT NULL,
    content_hash text NOT NULL,
    input_contract text NOT NULL,
    heading text NOT NULL,
    body text NOT NULL,
    node_kind text NOT NULL,
    blocks jsonb NOT NULL,
    language text NOT NULL,
    CONSTRAINT legal_provision_versions_content_hash_check CHECK ((content_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_provisions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_provisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_id uuid NOT NULL,
    identity_key text NOT NULL,
    identity_basis text NOT NULL
);


--
-- Name: legal_rights_profiles; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_rights_profiles (
    id text NOT NULL,
    policy_hash text NOT NULL,
    policy jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT legal_rights_profiles_policy_check CHECK ((jsonb_typeof(policy) = 'object'::text)),
    CONSTRAINT legal_rights_profiles_policy_hash_check CHECK ((policy_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: legal_sources; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legal_sources (
    id text NOT NULL,
    publisher text NOT NULL,
    authority text NOT NULL,
    CONSTRAINT legal_sources_authority_check CHECK ((authority = ANY (ARRAY['official'::text, 'licensed'::text])))
);


--
-- Name: legislative_events; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legislative_events (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    source_id text NOT NULL,
    name text NOT NULL,
    classification text,
    status text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    timezone text,
    all_day boolean DEFAULT false NOT NULL,
    location jsonb,
    virtual_access jsonb,
    description text,
    is_deleted boolean DEFAULT false NOT NULL,
    source_url text,
    source_updated_at timestamp with time zone,
    upstream_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    publisher_local_date date,
    is_remote boolean,
    source_sequence integer,
    source_provider text,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    canonical_facts_complete boolean DEFAULT false NOT NULL,
    session_relations_complete boolean DEFAULT false NOT NULL,
    organization_relations_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT legislative_events_canonical_facts_complete_check CHECK (((NOT canonical_facts_complete) OR ((publisher_local_date IS NOT NULL) AND (classification IS NOT NULL) AND provenance_complete))),
    CONSTRAINT legislative_events_classification_vocabulary_check CHECK (((classification IS NULL) OR (classification = ANY (ARRAY['meeting'::text, 'hearing'::text, 'session'::text, 'other'::text])))),
    CONSTRAINT legislative_events_dates_check CHECK (((end_at IS NULL) OR (start_at <= end_at))),
    CONSTRAINT legislative_events_id_check CHECK ((length(id) > 0)),
    CONSTRAINT legislative_events_name_check CHECK ((length(name) > 0)),
    CONSTRAINT legislative_events_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT legislative_events_source_id_check CHECK ((length(source_id) > 0)),
    CONSTRAINT legislative_events_source_sequence_check CHECK (((source_sequence IS NULL) OR (source_sequence >= 0))),
    CONSTRAINT legislative_events_status_check CHECK ((length(status) > 0)),
    CONSTRAINT legislative_events_status_vocabulary_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'postponed'::text, 'other'::text])))
);


--
-- Name: legislative_sessions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legislative_sessions (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    start_date date,
    end_date date,
    is_active boolean,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    classification text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT legislative_sessions_classification_check CHECK (((classification IS NULL) OR (length(classification) > 0))),
    CONSTRAINT legislative_sessions_dates_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))),
    CONSTRAINT legislative_sessions_id_check CHECK ((length(id) > 0)),
    CONSTRAINT legislative_sessions_identifier_check CHECK ((length(identifier) > 0)),
    CONSTRAINT legislative_sessions_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url ~ '^https://'::text) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL))))
);


--
-- Name: legislative_terms; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.legislative_terms (
    id text NOT NULL,
    person_id text NOT NULL,
    jurisdiction_id text NOT NULL,
    organization_id text,
    source_id text,
    chamber text,
    district text,
    party text,
    role text,
    start_date date,
    end_date date,
    start_year integer,
    end_year integer,
    is_active boolean,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    office_title text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT legislative_terms_chamber_check CHECK ((length(chamber) > 0)),
    CONSTRAINT legislative_terms_chamber_vocabulary_check CHECK (((chamber IS NULL) OR (chamber = ANY (ARRAY['lower'::text, 'upper'::text, 'unicameral'::text, 'legislature'::text])))),
    CONSTRAINT legislative_terms_dates_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))),
    CONSTRAINT legislative_terms_id_check CHECK ((length(id) > 0)),
    CONSTRAINT legislative_terms_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL))))
);


--
-- Name: organization_memberships; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.organization_memberships (
    id text NOT NULL,
    organization_id text NOT NULL,
    person_id text NOT NULL,
    source_id text,
    title text,
    rank text,
    classification text,
    effective_start_date date,
    effective_end_date date,
    is_active boolean,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role text,
    label text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    tenure_ordinal integer DEFAULT 1 NOT NULL,
    legislative_session_id text,
    detected_start_date date,
    detected_end_date date,
    last_observed_date date,
    ended_reason legislation.organization_membership_end_reason,
    CONSTRAINT organization_memberships_congress_end_check CHECK (((ended_reason IS DISTINCT FROM 'congress_ended'::legislation.organization_membership_end_reason) OR ((legislative_session_id IS NOT NULL) AND (detected_end_date IS NULL)))),
    CONSTRAINT organization_memberships_detected_dates_check CHECK (((detected_start_date IS NULL) OR (detected_end_date IS NULL) OR (detected_start_date <= detected_end_date))),
    CONSTRAINT organization_memberships_effective_dates_check CHECK (((effective_start_date IS NULL) OR (effective_end_date IS NULL) OR (effective_start_date <= effective_end_date))),
    CONSTRAINT organization_memberships_historical_observation_check CHECK (((ended_reason IS DISTINCT FROM 'historical_at_first_observation'::legislation.organization_membership_end_reason) OR ((legislative_session_id IS NOT NULL) AND (is_active IS FALSE) AND (detected_start_date IS NULL) AND (detected_end_date IS NULL) AND (last_observed_date IS NULL)))),
    CONSTRAINT organization_memberships_id_check CHECK ((length(id) > 0)),
    CONSTRAINT organization_memberships_last_observed_check CHECK (((detected_start_date IS NULL) OR (last_observed_date IS NULL) OR (detected_start_date <= last_observed_date))),
    CONSTRAINT organization_memberships_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT organization_memberships_roster_removal_check CHECK (((ended_reason IS DISTINCT FROM 'roster_removal_detected'::legislation.organization_membership_end_reason) OR (detected_end_date IS NOT NULL))),
    CONSTRAINT organization_memberships_tenure_ordinal_check CHECK ((tenure_ordinal > 0))
);


--
-- Name: organizations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.organizations (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    parent_organization_id text,
    source_id text NOT NULL,
    name text NOT NULL,
    classification text,
    chamber text,
    is_active boolean,
    source_url text,
    source_updated_at timestamp with time zone,
    upstream_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_provider text,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    description text,
    website_url text,
    public_contact_address text,
    public_contact_phone text,
    public_contact_email text,
    terms_of_reference text,
    detail_facts_complete boolean DEFAULT false NOT NULL,
    child_relations_complete boolean DEFAULT false NOT NULL,
    membership_relations_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT organizations_chamber_check CHECK (((chamber IS NULL) OR (chamber = ANY (ARRAY['lower'::text, 'upper'::text, 'unicameral'::text, 'legislature'::text])))),
    CONSTRAINT organizations_classification_check CHECK (((classification IS NULL) OR (classification = ANY (ARRAY['legislature'::text, 'chamber'::text, 'committee'::text, 'subcommittee'::text, 'commission'::text, 'agency'::text, 'other'::text])))),
    CONSTRAINT organizations_description_check CHECK (((description IS NULL) OR (length(btrim(description)) > 0))),
    CONSTRAINT organizations_id_check CHECK ((length(id) > 0)),
    CONSTRAINT organizations_name_check CHECK ((length(name) > 0)),
    CONSTRAINT organizations_parent_check CHECK (((parent_organization_id IS NULL) OR (parent_organization_id <> id))),
    CONSTRAINT organizations_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT organizations_public_contact_address_check CHECK (((public_contact_address IS NULL) OR (length(btrim(public_contact_address)) > 0))),
    CONSTRAINT organizations_public_contact_email_check CHECK (((public_contact_email IS NULL) OR (length(btrim(public_contact_email)) > 0))),
    CONSTRAINT organizations_public_contact_phone_check CHECK (((public_contact_phone IS NULL) OR (length(btrim(public_contact_phone)) > 0))),
    CONSTRAINT organizations_source_id_check CHECK ((length(source_id) > 0)),
    CONSTRAINT organizations_terms_of_reference_check CHECK (((terms_of_reference IS NULL) OR (length(btrim(terms_of_reference)) > 0))),
    CONSTRAINT organizations_website_url_check CHECK (((website_url IS NULL) OR (website_url ~ '^https://'::text)))
);


--
-- Name: passage_search_backfill; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.passage_search_backfill (
    name text NOT NULL,
    after_document_id text,
    completed_at timestamp with time zone
);


--
-- Name: passage_search_changes; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.passage_search_changes (
    id bigint NOT NULL,
    entity_kind text NOT NULL,
    entity_id text NOT NULL,
    after_document_id text,
    enqueued_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    transaction_id xid8 DEFAULT pg_current_xact_id() NOT NULL,
    retry_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    error_category text,
    CONSTRAINT passage_search_changes_entity_kind_check CHECK ((entity_kind = ANY (ARRAY['document'::text, 'bill'::text])))
);


--
-- Name: passage_search_changes_id_seq; Type: SEQUENCE; Schema: legislation; Owner: -
--

ALTER TABLE legislation.passage_search_changes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME legislation.passage_search_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: people; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.people (
    id text NOT NULL,
    jurisdiction_id text,
    name text NOT NULL,
    given_name text,
    family_name text,
    in_office_since_year integer,
    party text,
    source_url text,
    upstream_ids jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_id text,
    source_updated_at timestamp with time zone,
    is_active boolean,
    source_provider text,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT people_name_check CHECK ((length(name) > 0)),
    CONSTRAINT people_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT people_source_id_check CHECK (((source_id IS NULL) OR (length(source_id) > 0)))
);


--
-- Name: person_aliases; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.person_aliases (
    person_id text NOT NULL,
    source_identity text NOT NULL,
    name text NOT NULL,
    source_url text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_aliases_name_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT person_aliases_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT person_aliases_source_identity_check CHECK ((length(btrim(source_identity)) > 0))
);


--
-- Name: person_details; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.person_details (
    person_id text NOT NULL,
    image_url text,
    public_email text,
    official_url text,
    source_url text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_details_image_url_check CHECK (((image_url IS NULL) OR (image_url ~ '^https://'::text))),
    CONSTRAINT person_details_official_url_check CHECK (((official_url IS NULL) OR (official_url ~ '^https?://'::text))),
    CONSTRAINT person_details_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT person_details_public_email_check CHECK (((public_email IS NULL) OR (length(btrim(public_email)) > 0)))
);


--
-- Name: person_external_identifiers; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.person_external_identifiers (
    person_id text NOT NULL,
    source_identity text NOT NULL,
    scheme text NOT NULL,
    value text NOT NULL,
    source_url text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_external_identifiers_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT person_external_identifiers_scheme_check CHECK ((length(btrim(scheme)) > 0)),
    CONSTRAINT person_external_identifiers_value_check CHECK ((length(btrim(value)) > 0))
);


--
-- Name: person_jurisdictions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.person_jurisdictions (
    person_id text NOT NULL,
    jurisdiction_id text NOT NULL,
    source_identity text NOT NULL,
    source_url text,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    provenance_complete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT person_jurisdictions_provenance_complete_check CHECK (((NOT provenance_complete) OR ((source_url IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL)))),
    CONSTRAINT person_jurisdictions_source_identity_check CHECK ((length(btrim(source_identity)) > 0))
);


--
-- Name: regulatory_document_observations; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_document_observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generation_id text NOT NULL,
    document_id uuid NOT NULL,
    version_id uuid NOT NULL,
    source_id text NOT NULL,
    jurisdiction_id text NOT NULL,
    rights_profile_id text NOT NULL,
    publication_date date NOT NULL,
    metadata jsonb NOT NULL,
    source_locator text NOT NULL,
    pdf_receipt jsonb NOT NULL,
    pdf_inspection jsonb NOT NULL
);


--
-- Name: regulatory_document_versions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    content_hash text NOT NULL,
    input_contract text NOT NULL,
    pdf_hash text NOT NULL,
    heading text NOT NULL,
    body text NOT NULL,
    blocks jsonb NOT NULL,
    publication_kind text NOT NULL,
    CONSTRAINT regulatory_document_versions_blocks_check CHECK ((jsonb_typeof(blocks) = 'array'::text)),
    CONSTRAINT regulatory_document_versions_content_hash_check CHECK ((content_hash ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT regulatory_document_versions_publication_kind_check CHECK ((publication_kind = ANY (ARRAY['final_rule'::text, 'proposed_rule'::text, 'notice'::text, 'other'::text])))
);


--
-- Name: regulatory_documents; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id text NOT NULL,
    identity_namespace text NOT NULL,
    native_number text NOT NULL
);


--
-- Name: regulatory_publication_batches; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_publication_batches (
    generation_id text NOT NULL,
    metadata_manifest_id text NOT NULL,
    metadata_manifest jsonb NOT NULL,
    snapshot_hash text NOT NULL,
    reconciliation jsonb NOT NULL,
    published_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT regulatory_publication_batches_metadata_manifest_id_check CHECK ((metadata_manifest_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT regulatory_publication_batches_snapshot_hash_check CHECK ((snapshot_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: regulatory_publication_outbox; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_publication_outbox (
    id bigint NOT NULL,
    observation_id uuid NOT NULL,
    operation text NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    retry_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT regulatory_publication_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT regulatory_publication_outbox_operation_check CHECK ((operation = 'lexical'::text)),
    CONSTRAINT regulatory_publication_outbox_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'acknowledged'::text])))
);


--
-- Name: regulatory_publication_outbox_id_seq; Type: SEQUENCE; Schema: legislation; Owner: -
--

CREATE SEQUENCE legislation.regulatory_publication_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulatory_publication_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: legislation; Owner: -
--

ALTER SEQUENCE legislation.regulatory_publication_outbox_id_seq OWNED BY legislation.regulatory_publication_outbox.id;


--
-- Name: regulatory_source_documents; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_source_documents (
    generation_id text NOT NULL,
    record_key text NOT NULL,
    document_id uuid NOT NULL,
    source_observation_key text NOT NULL,
    publisher_number text NOT NULL,
    publication_date date NOT NULL,
    citation_key text,
    metadata_status text NOT NULL,
    evidence jsonb NOT NULL,
    CONSTRAINT regulatory_source_documents_metadata_status_check CHECK ((metadata_status = ANY (ARRAY['candidate'::text, 'missing'::text, 'ambiguous'::text, 'conflict'::text]))),
    CONSTRAINT regulatory_source_documents_source_observation_key_check CHECK ((source_observation_key ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: regulatory_source_inventories; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_source_inventories (
    generation_id text NOT NULL,
    metadata_manifest_id text NOT NULL,
    metadata_manifest jsonb NOT NULL,
    snapshot_hash text NOT NULL,
    coverage jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT regulatory_source_inventories_metadata_manifest_id_check CHECK ((metadata_manifest_id ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT regulatory_source_inventories_snapshot_hash_check CHECK ((snapshot_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: regulatory_source_renditions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_source_renditions (
    generation_id text NOT NULL,
    record_key text NOT NULL,
    evidence_hash text NOT NULL,
    evidence jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT regulatory_source_renditions_evidence_hash_check CHECK ((evidence_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: regulatory_source_reviews; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.regulatory_source_reviews (
    generation_id text NOT NULL,
    record_key text NOT NULL,
    review_hash text NOT NULL,
    evidence jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT regulatory_source_reviews_review_hash_check CHECK ((review_hash ~ '^[a-f0-9]{64}$'::text))
);


--
-- Name: research_result_snapshots; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.research_result_snapshots (
    id uuid NOT NULL,
    session_key uuid NOT NULL,
    snapshot jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: subscription_deliveries; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.subscription_deliveries (
    id text NOT NULL,
    subscription_id text NOT NULL,
    subscription_event_ids text[] NOT NULL,
    channel text NOT NULL,
    destination_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    delivered_at timestamp with time zone,
    failure_category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_deliveries_attempts_check CHECK (((attempt_count >= 0) AND (attempt_count <= 5))),
    CONSTRAINT subscription_deliveries_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'webhook'::text, 'in-app'::text]))),
    CONSTRAINT subscription_deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text, 'suppressed'::text])))
);


--
-- Name: subscription_events; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.subscription_events (
    id text NOT NULL,
    subscription_id text NOT NULL,
    event_type text NOT NULL,
    change_event_id text,
    record_type text NOT NULL,
    record_id text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    source_urls text[] NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    matched_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_events_event_type_check CHECK ((length(event_type) > 0)),
    CONSTRAINT subscription_events_record_check CHECK (((length(record_type) > 0) AND (length(record_id) > 0)))
);


--
-- Name: subscriptions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.subscriptions (
    id text NOT NULL,
    owner_user_id text NOT NULL,
    owner_organization_id text,
    name text NOT NULL,
    target jsonb NOT NULL,
    target_fingerprint character(64) NOT NULL,
    event_types text[] NOT NULL,
    delivery jsonb NOT NULL,
    frequency text NOT NULL,
    timezone text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    revision uuid DEFAULT gen_random_uuid() NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_cancelled_at_check CHECK ((((status = 'cancelled'::text) AND (cancelled_at IS NOT NULL)) OR ((status <> 'cancelled'::text) AND (cancelled_at IS NULL)))),
    CONSTRAINT subscriptions_frequency_check CHECK ((frequency = ANY (ARRAY['immediate'::text, 'hourly'::text, 'daily'::text]))),
    CONSTRAINT subscriptions_name_check CHECK (((length(name) >= 1) AND (length(name) <= 120))),
    CONSTRAINT subscriptions_owner_organization_check CHECK (((owner_organization_id IS NULL) OR (length(owner_organization_id) > 0))),
    CONSTRAINT subscriptions_owner_user_check CHECK ((length(owner_user_id) > 0)),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text])))
);


--
-- Name: supporting_material_links; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.supporting_material_links (
    material_id text NOT NULL,
    bill_id text,
    amendment_id text,
    event_id text,
    organization_id text,
    classification text DEFAULT 'related'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supporting_material_links_target_check CHECK (((bill_id IS NOT NULL) OR (amendment_id IS NOT NULL) OR (event_id IS NOT NULL) OR (organization_id IS NOT NULL)))
);


--
-- Name: supporting_material_section_embeddings; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.supporting_material_section_embeddings (
    section_id text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    input_contract text NOT NULL,
    input_hash character(64) NOT NULL,
    embedding public.vector(1024) NOT NULL,
    rollout_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supporting_material_section_embeddings_contract_check CHECK ((length(input_contract) > 0)),
    CONSTRAINT supporting_material_section_embeddings_dimensions_check CHECK ((dimensions = 1024)),
    CONSTRAINT supporting_material_section_embeddings_hash_check CHECK ((input_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT supporting_material_section_embeddings_model_check CHECK ((length(model) > 0)),
    CONSTRAINT supporting_material_section_embeddings_rollout_check CHECK ((length(rollout_id) > 0))
);


--
-- Name: supporting_material_sections; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.supporting_material_sections (
    id text NOT NULL,
    material_id text NOT NULL,
    ordinal integer NOT NULL,
    section_identifier text,
    heading text,
    source_start_offset integer NOT NULL,
    source_end_offset integer NOT NULL,
    text text NOT NULL,
    content_hash character(64) NOT NULL,
    search_vector tsvector,
    embedding public.vector(1536),
    embedding_input_hash character(64),
    embedding_model text,
    embedded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    page_start integer,
    page_end integer,
    CONSTRAINT supporting_material_sections_hash_check CHECK ((content_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT supporting_material_sections_offsets_check CHECK (((source_start_offset >= 0) AND (source_end_offset >= source_start_offset))),
    CONSTRAINT supporting_material_sections_ordinal_check CHECK ((ordinal >= 0)),
    CONSTRAINT supporting_material_sections_pages_check CHECK ((((page_start IS NULL) AND (page_end IS NULL)) OR ((page_start IS NOT NULL) AND (page_end IS NOT NULL) AND (page_start >= 1) AND (page_end >= page_start)))),
    CONSTRAINT supporting_material_sections_text_check CHECK ((length(text) > 0))
);


--
-- Name: supporting_materials; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.supporting_materials (
    id text NOT NULL,
    jurisdiction_id text NOT NULL,
    session_id text,
    source_id text NOT NULL,
    classification text NOT NULL,
    title text NOT NULL,
    document_date date,
    hearing_dates date[],
    page_count integer,
    source_url text NOT NULL,
    content_type text,
    blob_path text,
    text text,
    content_hash character(64),
    processing_status text DEFAULT 'pending'::text NOT NULL,
    processing_attempts integer DEFAULT 0 NOT NULL,
    processing_error text,
    source_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone,
    next_attempt_at timestamp with time zone,
    processing_error_category text,
    CONSTRAINT supporting_materials_attempts_check CHECK ((processing_attempts >= 0)),
    CONSTRAINT supporting_materials_classification_check CHECK ((length(classification) > 0)),
    CONSTRAINT supporting_materials_error_category_check CHECK (((processing_error_category IS NULL) OR (processing_error_category = ANY (ARRAY['download-permanent'::text, 'download-transient'::text, 'malformed-document'::text, 'not-found'::text, 'ocr-required'::text, 'oversized'::text, 'processing-transient'::text, 'source-inaccessible'::text, 'unsafe-url'::text, 'unsupported-format'::text])))),
    CONSTRAINT supporting_materials_hash_check CHECK (((content_hash IS NULL) OR (content_hash ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT supporting_materials_processing_status_check CHECK ((processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'unsupported'::text, 'failed'::text]))),
    CONSTRAINT supporting_materials_source_id_check CHECK ((length(source_id) > 0)),
    CONSTRAINT supporting_materials_title_check CHECK ((length(title) > 0))
);


--
-- Name: sync_checkpoints; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.sync_checkpoints (
    source text NOT NULL,
    stream text NOT NULL,
    cursor jsonb DEFAULT '{}'::jsonb NOT NULL,
    watermark timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sync_checkpoints_source_check CHECK ((length(source) > 0)),
    CONSTRAINT sync_checkpoints_stream_check CHECK ((length(stream) > 0))
);


--
-- Name: vote_positions; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.vote_positions (
    vote_id text NOT NULL,
    person_id text,
    option text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_identity text NOT NULL,
    source_person_id text,
    source_name text,
    source_sequence integer,
    CONSTRAINT vote_positions_normalized_option_check CHECK ((option = ANY (ARRAY['yes'::text, 'no'::text, 'absent'::text, 'abstain'::text, 'not-voting'::text, 'present'::text, 'proxy'::text, 'paired'::text, 'other'::text]))),
    CONSTRAINT vote_positions_option_check CHECK ((length(option) > 0)),
    CONSTRAINT vote_positions_source_identity_check CHECK ((length(source_identity) > 0)),
    CONSTRAINT vote_positions_source_sequence_check CHECK (((source_sequence IS NULL) OR (source_sequence >= 0)))
);


--
-- Name: votes; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.votes (
    id text NOT NULL,
    bill_id text,
    chamber text,
    motion text NOT NULL,
    result text,
    held_at timestamp with time zone,
    held_date date,
    yes_count integer,
    no_count integer,
    other_count integer,
    source_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    amendment_id text,
    event_id text,
    organization_id text,
    session_id text,
    classification text,
    source_id text,
    roll_call_number text,
    vote_type text,
    question text,
    requirement text,
    absent_count integer,
    abstain_count integer,
    not_voting_count integer,
    present_count integer,
    proxy_count integer,
    paired_count integer,
    source_provider text,
    source_updated_at timestamp with time zone,
    source_retrieved_at timestamp with time zone,
    source_is_official boolean,
    source_sequence integer,
    timeline_complete boolean DEFAULT false NOT NULL,
    CONSTRAINT votes_absent_count_check CHECK (((absent_count IS NULL) OR (absent_count >= 0))),
    CONSTRAINT votes_abstain_count_check CHECK (((abstain_count IS NULL) OR (abstain_count >= 0))),
    CONSTRAINT votes_motion_check CHECK ((length(motion) > 0)),
    CONSTRAINT votes_no_count_check CHECK (((no_count IS NULL) OR (no_count >= 0))),
    CONSTRAINT votes_not_voting_count_check CHECK (((not_voting_count IS NULL) OR (not_voting_count >= 0))),
    CONSTRAINT votes_other_count_check CHECK (((other_count IS NULL) OR (other_count >= 0))),
    CONSTRAINT votes_paired_count_check CHECK (((paired_count IS NULL) OR (paired_count >= 0))),
    CONSTRAINT votes_present_count_check CHECK (((present_count IS NULL) OR (present_count >= 0))),
    CONSTRAINT votes_proxy_count_check CHECK (((proxy_count IS NULL) OR (proxy_count >= 0))),
    CONSTRAINT votes_source_sequence_check CHECK (((source_sequence IS NULL) OR (source_sequence >= 0))),
    CONSTRAINT votes_target_check CHECK (((bill_id IS NOT NULL) OR (amendment_id IS NOT NULL) OR (event_id IS NOT NULL) OR (organization_id IS NOT NULL) OR (chamber IS NOT NULL))),
    CONSTRAINT votes_timeline_complete_check CHECK (((NOT timeline_complete) OR (((held_at IS NOT NULL) OR (held_date IS NOT NULL)) AND (result = ANY (ARRAY['passed'::text, 'failed'::text, 'other'::text])) AND (yes_count IS NOT NULL) AND (no_count IS NOT NULL) AND (absent_count IS NOT NULL) AND (abstain_count IS NOT NULL) AND (not_voting_count IS NOT NULL) AND (present_count IS NOT NULL) AND (proxy_count IS NOT NULL) AND (paired_count IS NOT NULL) AND (other_count IS NOT NULL) AND (source_url ~ '^https://'::text) AND (source_provider IS NOT NULL) AND (length(btrim(source_provider)) > 0) AND (source_retrieved_at IS NOT NULL) AND (source_is_official IS NOT NULL) AND (source_sequence IS NOT NULL)))),
    CONSTRAINT votes_yes_count_check CHECK (((yes_count IS NULL) OR (yes_count >= 0)))
);


--
-- Name: webhook_audit_records; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.webhook_audit_records (
    id bigint NOT NULL,
    webhook_id text NOT NULL,
    action text NOT NULL,
    actor_user_id text NOT NULL,
    actor_organization_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhook_audit_records_action_check CHECK ((length(action) > 0)),
    CONSTRAINT webhook_audit_records_actor_check CHECK ((length(actor_user_id) > 0))
);


--
-- Name: webhook_audit_records_id_seq; Type: SEQUENCE; Schema: legislation; Owner: -
--

CREATE SEQUENCE legislation.webhook_audit_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webhook_audit_records_id_seq; Type: SEQUENCE OWNED BY; Schema: legislation; Owner: -
--

ALTER SEQUENCE legislation.webhook_audit_records_id_seq OWNED BY legislation.webhook_audit_records.id;


--
-- Name: webhook_signing_keys; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.webhook_signing_keys (
    id text NOT NULL,
    webhook_id text NOT NULL,
    secret_ciphertext text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhook_signing_keys_ciphertext_check CHECK ((length(secret_ciphertext) > 0))
);


--
-- Name: webhooks; Type: TABLE; Schema: legislation; Owner: -
--

CREATE TABLE legislation.webhooks (
    id text NOT NULL,
    owner_user_id text NOT NULL,
    owner_organization_id text,
    name text NOT NULL,
    url text NOT NULL,
    event_types text[] NOT NULL,
    status text DEFAULT 'pending-verification'::text NOT NULL,
    revision uuid DEFAULT gen_random_uuid() NOT NULL,
    secret_last_four character(4) NOT NULL,
    overlap_ends_at timestamp with time zone,
    last_succeeded_at timestamp with time zone,
    last_failed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhooks_cancelled_at_check CHECK ((((status = 'cancelled'::text) AND (cancelled_at IS NOT NULL)) OR ((status <> 'cancelled'::text) AND (cancelled_at IS NULL)))),
    CONSTRAINT webhooks_name_check CHECK (((length(name) >= 1) AND (length(name) <= 120))),
    CONSTRAINT webhooks_status_check CHECK ((status = ANY (ARRAY['pending-verification'::text, 'active'::text, 'paused'::text, 'cancelled'::text]))),
    CONSTRAINT webhooks_url_check CHECK ((url ~ '^https://'::text))
);


--
-- Name: legal_derived_outbox id; Type: DEFAULT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_derived_outbox ALTER COLUMN id SET DEFAULT nextval('legislation.legal_derived_outbox_id_seq'::regclass);


--
-- Name: regulatory_publication_outbox id; Type: DEFAULT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_outbox ALTER COLUMN id SET DEFAULT nextval('legislation.regulatory_publication_outbox_id_seq'::regclass);


--
-- Name: webhook_audit_records id; Type: DEFAULT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhook_audit_records ALTER COLUMN id SET DEFAULT nextval('legislation.webhook_audit_records_id_seq'::regclass);


--
-- Name: amendment_actions amendment_actions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_actions
    ADD CONSTRAINT amendment_actions_pkey PRIMARY KEY (id);


--
-- Name: amendment_embeddings amendment_embeddings_amendment_id_model_input_contract_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_embeddings
    ADD CONSTRAINT amendment_embeddings_amendment_id_model_input_contract_pk PRIMARY KEY (amendment_id, model, input_contract);


--
-- Name: amendment_relations amendment_relations_amendment_id_related_amendment_id_classific; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_relations
    ADD CONSTRAINT amendment_relations_amendment_id_related_amendment_id_classific PRIMARY KEY (amendment_id, related_amendment_id, classification);


--
-- Name: amendment_section_search amendment_section_search_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_section_search
    ADD CONSTRAINT amendment_section_search_pkey PRIMARY KEY (section_id);


--
-- Name: amendments amendments_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendments
    ADD CONSTRAINT amendments_pkey PRIMARY KEY (id);


--
-- Name: api_idempotency_records api_idempotency_records_principal_scope_method_canonical_path_k; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.api_idempotency_records
    ADD CONSTRAINT api_idempotency_records_principal_scope_method_canonical_path_k PRIMARY KEY (principal_scope, method, canonical_path, key);


--
-- Name: bill_actions bill_actions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_actions
    ADD CONSTRAINT bill_actions_pkey PRIMARY KEY (id);


--
-- Name: bill_documents bill_documents_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_documents
    ADD CONSTRAINT bill_documents_pkey PRIMARY KEY (id);


--
-- Name: bill_embeddings bill_embeddings_bill_id_model_input_contract_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_embeddings
    ADD CONSTRAINT bill_embeddings_bill_id_model_input_contract_pk PRIMARY KEY (bill_id, model, input_contract);


--
-- Name: bill_organizations bill_organizations_bill_id_organization_id_classification_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_organizations
    ADD CONSTRAINT bill_organizations_bill_id_organization_id_classification_pk PRIMARY KEY (bill_id, organization_id, classification);


--
-- Name: bill_relations bill_relations_bill_id_related_bill_id_classification_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_relations
    ADD CONSTRAINT bill_relations_bill_id_related_bill_id_classification_pk PRIMARY KEY (bill_id, related_bill_id, classification);


--
-- Name: bill_sponsors bill_sponsors_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_sponsors
    ADD CONSTRAINT bill_sponsors_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: calendar_entries calendar_entries_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_entries
    ADD CONSTRAINT calendar_entries_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_calendar_id_event_id_source_provider_source_id_; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_events
    ADD CONSTRAINT calendar_events_calendar_id_event_id_source_provider_source_id_ PRIMARY KEY (calendar_id, event_id, source_provider, source_id);


--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (id);


--
-- Name: canonical_record_fingerprints canonical_record_fingerprints_record_type_record_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.canonical_record_fingerprints
    ADD CONSTRAINT canonical_record_fingerprints_record_type_record_id_pk PRIMARY KEY (record_type, record_id);


--
-- Name: change_events change_events_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.change_events
    ADD CONSTRAINT change_events_pkey PRIMARY KEY (id);


--
-- Name: document_download_leases document_download_leases_host_slot_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.document_download_leases
    ADD CONSTRAINT document_download_leases_host_slot_pk PRIMARY KEY (host, slot);


--
-- Name: document_section_embeddings document_section_embeddings_section_id_model_input_contract_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.document_section_embeddings
    ADD CONSTRAINT document_section_embeddings_section_id_model_input_contract_pk PRIMARY KEY (section_id, model, input_contract);


--
-- Name: document_sections document_sections_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.document_sections
    ADD CONSTRAINT document_sections_pkey PRIMARY KEY (id);


--
-- Name: event_agenda_item_amendments event_agenda_item_amendments_agenda_item_id_amendment_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_amendments
    ADD CONSTRAINT event_agenda_item_amendments_agenda_item_id_amendment_id_pk PRIMARY KEY (agenda_item_id, amendment_id);


--
-- Name: event_agenda_item_bills event_agenda_item_bills_agenda_item_id_bill_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_bills
    ADD CONSTRAINT event_agenda_item_bills_agenda_item_id_bill_id_pk PRIMARY KEY (agenda_item_id, bill_id);


--
-- Name: event_agenda_item_supporting_materials event_agenda_item_supporting_materials_agenda_item_id_material_; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_supporting_materials
    ADD CONSTRAINT event_agenda_item_supporting_materials_agenda_item_id_material_ PRIMARY KEY (agenda_item_id, material_id);


--
-- Name: event_agenda_items event_agenda_items_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_items
    ADD CONSTRAINT event_agenda_items_pkey PRIMARY KEY (id);


--
-- Name: event_bills event_bills_event_id_bill_id_classification_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_bills
    ADD CONSTRAINT event_bills_event_id_bill_id_classification_pk PRIMARY KEY (event_id, bill_id, classification);


--
-- Name: event_continuations event_continuations_event_id_source_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_continuations
    ADD CONSTRAINT event_continuations_event_id_source_id_pk PRIMARY KEY (event_id, source_id);


--
-- Name: event_documents event_documents_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_documents
    ADD CONSTRAINT event_documents_pkey PRIMARY KEY (id);


--
-- Name: event_organizations event_organizations_event_id_organization_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_organizations
    ADD CONSTRAINT event_organizations_event_id_organization_id_pk PRIMARY KEY (event_id, organization_id);


--
-- Name: event_outcome_links event_outcome_links_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcome_links
    ADD CONSTRAINT event_outcome_links_pkey PRIMARY KEY (id);


--
-- Name: event_outcomes event_outcomes_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcomes
    ADD CONSTRAINT event_outcomes_pkey PRIMARY KEY (id);


--
-- Name: event_participants event_participants_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_participants
    ADD CONSTRAINT event_participants_pkey PRIMARY KEY (id);


--
-- Name: event_sessions event_sessions_event_id_session_id_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_sessions
    ADD CONSTRAINT event_sessions_event_id_session_id_pk PRIMARY KEY (event_id, session_id);


--
-- Name: ingestion_locks ingestion_locks_source_operation_scope_key_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.ingestion_locks
    ADD CONSTRAINT ingestion_locks_source_operation_scope_key_pk PRIMARY KEY (source, operation, scope_key);


--
-- Name: ingestion_runs ingestion_runs_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.ingestion_runs
    ADD CONSTRAINT ingestion_runs_pkey PRIMARY KEY (id);


--
-- Name: jurisdictions jurisdictions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.jurisdictions
    ADD CONSTRAINT jurisdictions_pkey PRIMARY KEY (id);


--
-- Name: legal_annual_edition_volumes legal_annual_edition_volumes_annual_edition_id_edition_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_edition_volumes
    ADD CONSTRAINT legal_annual_edition_volumes_annual_edition_id_edition_id_key UNIQUE (annual_edition_id, edition_id);


--
-- Name: legal_annual_edition_volumes legal_annual_edition_volumes_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_edition_volumes
    ADD CONSTRAINT legal_annual_edition_volumes_pkey PRIMARY KEY (annual_edition_id, volume);


--
-- Name: legal_annual_editions legal_annual_editions_id_code_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_editions
    ADD CONSTRAINT legal_annual_editions_id_code_id_key UNIQUE (id, code_id);


--
-- Name: legal_annual_editions legal_annual_editions_manifest_id_code_id_package_year_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_editions
    ADD CONSTRAINT legal_annual_editions_manifest_id_code_id_package_year_key UNIQUE (manifest_id, code_id, package_year);


--
-- Name: legal_annual_editions legal_annual_editions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_editions
    ADD CONSTRAINT legal_annual_editions_pkey PRIMARY KEY (id);


--
-- Name: legal_annual_source_observations legal_annual_source_observations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_source_observations
    ADD CONSTRAINT legal_annual_source_observations_pkey PRIMARY KEY (generation_id);


--
-- Name: legal_artifacts legal_artifacts_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_artifacts
    ADD CONSTRAINT legal_artifacts_pkey PRIMARY KEY (hash);


--
-- Name: legal_code_heads legal_code_heads_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_code_heads
    ADD CONSTRAINT legal_code_heads_pkey PRIMARY KEY (code_id, source_id);


--
-- Name: legal_codes legal_codes_id_jurisdiction_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_codes
    ADD CONSTRAINT legal_codes_id_jurisdiction_id_key UNIQUE (id, jurisdiction_id);


--
-- Name: legal_codes legal_codes_jurisdiction_id_code_key_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_codes
    ADD CONSTRAINT legal_codes_jurisdiction_id_code_key_key UNIQUE (jurisdiction_id, code_key);


--
-- Name: legal_codes legal_codes_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_codes
    ADD CONSTRAINT legal_codes_pkey PRIMARY KEY (id);


--
-- Name: legal_copy_revisions legal_copy_revisions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_copy_revisions
    ADD CONSTRAINT legal_copy_revisions_pkey PRIMARY KEY (generation_id);


--
-- Name: legal_derived_outbox legal_derived_outbox_edition_id_operation_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_derived_outbox
    ADD CONSTRAINT legal_derived_outbox_edition_id_operation_key UNIQUE (edition_id, operation);


--
-- Name: legal_derived_outbox legal_derived_outbox_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_derived_outbox
    ADD CONSTRAINT legal_derived_outbox_pkey PRIMARY KEY (id);


--
-- Name: legal_discovery_checkpoints legal_discovery_checkpoints_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_checkpoints
    ADD CONSTRAINT legal_discovery_checkpoints_pkey PRIMARY KEY (source_id, scope_key);


--
-- Name: legal_discovery_dispatches legal_discovery_dispatches_manifest_id_unit_key_stage_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_dispatches
    ADD CONSTRAINT legal_discovery_dispatches_manifest_id_unit_key_stage_key UNIQUE (manifest_id, unit_key, stage);


--
-- Name: legal_discovery_dispatches legal_discovery_dispatches_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_dispatches
    ADD CONSTRAINT legal_discovery_dispatches_pkey PRIMARY KEY (id);


--
-- Name: legal_discovery_pages legal_discovery_pages_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_pages
    ADD CONSTRAINT legal_discovery_pages_pkey PRIMARY KEY (id);


--
-- Name: legal_discovery_pages legal_discovery_pages_source_id_scope_key_expected_revision_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_pages
    ADD CONSTRAINT legal_discovery_pages_source_id_scope_key_expected_revision_key UNIQUE (source_id, scope_key, expected_revision);


--
-- Name: legal_discovery_units legal_discovery_units_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_pkey PRIMARY KEY (source_id, scope_key, unit_key);


--
-- Name: legal_edition_provisions legal_edition_provisions_edition_id_ordinal_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_edition_id_ordinal_key UNIQUE (edition_id, ordinal);


--
-- Name: legal_edition_provisions legal_edition_provisions_edition_id_version_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_edition_id_version_id_key UNIQUE (edition_id, version_id);


--
-- Name: legal_edition_provisions legal_edition_provisions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_pkey PRIMARY KEY (edition_id, provision_id);


--
-- Name: legal_editions legal_editions_generation_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_generation_id_key UNIQUE (generation_id);


--
-- Name: legal_editions legal_editions_id_code_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_id_code_id_key UNIQUE (id, code_id);


--
-- Name: legal_editions legal_editions_id_code_id_source_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_id_code_id_source_id_key UNIQUE (id, code_id, source_id);


--
-- Name: legal_editions legal_editions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_pkey PRIMARY KEY (id);


--
-- Name: legal_fr_issue_preparations legal_fr_issue_preparations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_preparations
    ADD CONSTRAINT legal_fr_issue_preparations_pkey PRIMARY KEY (source_id, scope_key, unit_key);


--
-- Name: legal_fr_issue_renditions legal_fr_issue_renditions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_renditions
    ADD CONSTRAINT legal_fr_issue_renditions_pkey PRIMARY KEY (source_id, scope_key, unit_key, document_number);


--
-- Name: legal_import_generations legal_import_generations_id_source_id_jurisdiction_id_right_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_id_source_id_jurisdiction_id_right_key UNIQUE (id, source_id, jurisdiction_id, rights_profile_id);


--
-- Name: legal_import_generations legal_import_generations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_pkey PRIMARY KEY (id);


--
-- Name: legal_import_manifests legal_import_manifests_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_manifests
    ADD CONSTRAINT legal_import_manifests_pkey PRIMARY KEY (id);


--
-- Name: legal_import_records legal_import_records_generation_id_native_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_records
    ADD CONSTRAINT legal_import_records_generation_id_native_id_key UNIQUE (generation_id, native_id);


--
-- Name: legal_import_records legal_import_records_generation_id_ordinal_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_records
    ADD CONSTRAINT legal_import_records_generation_id_ordinal_key UNIQUE (generation_id, ordinal);


--
-- Name: legal_import_records legal_import_records_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_records
    ADD CONSTRAINT legal_import_records_pkey PRIMARY KEY (generation_id, record_key);


--
-- Name: legal_passage_generations legal_passage_generations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_generations
    ADD CONSTRAINT legal_passage_generations_pkey PRIMARY KEY (id);


--
-- Name: legal_passage_preparation_items legal_passage_preparation_items_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparation_items
    ADD CONSTRAINT legal_passage_preparation_items_pkey PRIMARY KEY (preparation_id, ordinal);


--
-- Name: legal_passage_preparation_items legal_passage_preparation_items_preparation_id_version_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparation_items
    ADD CONSTRAINT legal_passage_preparation_items_preparation_id_version_id_key UNIQUE (preparation_id, version_id);


--
-- Name: legal_passage_preparations legal_passage_preparations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparations
    ADD CONSTRAINT legal_passage_preparations_pkey PRIMARY KEY (id);


--
-- Name: legal_passage_source_provenance legal_passage_source_provenance_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_source_provenance
    ADD CONSTRAINT legal_passage_source_provenance_pkey PRIMARY KEY (generation_id);


--
-- Name: legal_passages legal_passages_generation_id_ordinal_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passages
    ADD CONSTRAINT legal_passages_generation_id_ordinal_key UNIQUE (generation_id, ordinal);


--
-- Name: legal_passages legal_passages_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passages
    ADD CONSTRAINT legal_passages_pkey PRIMARY KEY (id);


--
-- Name: legal_preparation_dispatches legal_preparation_dispatches_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_preparation_dispatches
    ADD CONSTRAINT legal_preparation_dispatches_pkey PRIMARY KEY (id);


--
-- Name: legal_preparation_dispatches legal_preparation_dispatches_wave_id_scope_kind_scope_id_mo_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_preparation_dispatches
    ADD CONSTRAINT legal_preparation_dispatches_wave_id_scope_kind_scope_id_mo_key UNIQUE (wave_id, scope_kind, scope_id, model);


--
-- Name: legal_preparation_plans legal_preparation_plans_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_preparation_plans
    ADD CONSTRAINT legal_preparation_plans_pkey PRIMARY KEY (wave_id);


--
-- Name: legal_provision_source_reviews legal_provision_source_reviews_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_source_reviews
    ADD CONSTRAINT legal_provision_source_reviews_pkey PRIMARY KEY (edition_id, version_id, table_index);


--
-- Name: legal_provision_versions legal_provision_versions_id_provision_id_code_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_versions
    ADD CONSTRAINT legal_provision_versions_id_provision_id_code_id_key UNIQUE (id, provision_id, code_id);


--
-- Name: legal_provision_versions legal_provision_versions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_versions
    ADD CONSTRAINT legal_provision_versions_pkey PRIMARY KEY (id);


--
-- Name: legal_provision_versions legal_provision_versions_provision_id_content_hash_input_co_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_versions
    ADD CONSTRAINT legal_provision_versions_provision_id_content_hash_input_co_key UNIQUE (provision_id, content_hash, input_contract);


--
-- Name: legal_provisions legal_provisions_code_id_identity_key_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provisions
    ADD CONSTRAINT legal_provisions_code_id_identity_key_key UNIQUE (code_id, identity_key);


--
-- Name: legal_provisions legal_provisions_id_code_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provisions
    ADD CONSTRAINT legal_provisions_id_code_id_key UNIQUE (id, code_id);


--
-- Name: legal_provisions legal_provisions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provisions
    ADD CONSTRAINT legal_provisions_pkey PRIMARY KEY (id);


--
-- Name: legal_rights_profiles legal_rights_profiles_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_rights_profiles
    ADD CONSTRAINT legal_rights_profiles_pkey PRIMARY KEY (id);


--
-- Name: legal_sources legal_sources_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_sources
    ADD CONSTRAINT legal_sources_pkey PRIMARY KEY (id);


--
-- Name: legislative_events legislative_events_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_events
    ADD CONSTRAINT legislative_events_pkey PRIMARY KEY (id);


--
-- Name: legislative_sessions legislative_sessions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_sessions
    ADD CONSTRAINT legislative_sessions_pkey PRIMARY KEY (id);


--
-- Name: legislative_terms legislative_terms_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_terms
    ADD CONSTRAINT legislative_terms_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: passage_search_backfill passage_search_backfill_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.passage_search_backfill
    ADD CONSTRAINT passage_search_backfill_pkey PRIMARY KEY (name);


--
-- Name: passage_search_changes passage_search_changes_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.passage_search_changes
    ADD CONSTRAINT passage_search_changes_pkey PRIMARY KEY (id);


--
-- Name: passage_search_changes passage_search_changes_transaction_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.passage_search_changes
    ADD CONSTRAINT passage_search_changes_transaction_key UNIQUE (entity_kind, entity_id, transaction_id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: person_aliases person_aliases_person_id_source_identity_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_aliases
    ADD CONSTRAINT person_aliases_person_id_source_identity_pk PRIMARY KEY (person_id, source_identity);


--
-- Name: person_details person_details_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_details
    ADD CONSTRAINT person_details_pkey PRIMARY KEY (person_id);


--
-- Name: person_external_identifiers person_external_identifiers_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_external_identifiers
    ADD CONSTRAINT person_external_identifiers_pk PRIMARY KEY (person_id, source_identity);


--
-- Name: person_jurisdictions person_jurisdictions_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_jurisdictions
    ADD CONSTRAINT person_jurisdictions_pk PRIMARY KEY (person_id, jurisdiction_id, source_identity);


--
-- Name: regulatory_document_observations regulatory_document_observations_generation_id_document_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observations_generation_id_document_id_key UNIQUE (generation_id, document_id);


--
-- Name: regulatory_document_observations regulatory_document_observations_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observations_pkey PRIMARY KEY (id);


--
-- Name: regulatory_document_versions regulatory_document_versions_document_id_content_hash_input_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_versions
    ADD CONSTRAINT regulatory_document_versions_document_id_content_hash_input_key UNIQUE (document_id, content_hash, input_contract, pdf_hash);


--
-- Name: regulatory_document_versions regulatory_document_versions_id_document_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_versions
    ADD CONSTRAINT regulatory_document_versions_id_document_id_key UNIQUE (id, document_id);


--
-- Name: regulatory_document_versions regulatory_document_versions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_versions
    ADD CONSTRAINT regulatory_document_versions_pkey PRIMARY KEY (id);


--
-- Name: regulatory_documents regulatory_documents_jurisdiction_id_identity_namespace_nat_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_documents
    ADD CONSTRAINT regulatory_documents_jurisdiction_id_identity_namespace_nat_key UNIQUE (jurisdiction_id, identity_namespace, native_number);


--
-- Name: regulatory_documents regulatory_documents_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_documents
    ADD CONSTRAINT regulatory_documents_pkey PRIMARY KEY (id);


--
-- Name: regulatory_publication_batches regulatory_publication_batches_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_batches
    ADD CONSTRAINT regulatory_publication_batches_pkey PRIMARY KEY (generation_id);


--
-- Name: regulatory_publication_outbox regulatory_publication_outbox_observation_id_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_outbox
    ADD CONSTRAINT regulatory_publication_outbox_observation_id_key UNIQUE (observation_id);


--
-- Name: regulatory_publication_outbox regulatory_publication_outbox_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_outbox
    ADD CONSTRAINT regulatory_publication_outbox_pkey PRIMARY KEY (id);


--
-- Name: regulatory_source_documents regulatory_source_documents_generation_id_source_observatio_key; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_documents
    ADD CONSTRAINT regulatory_source_documents_generation_id_source_observatio_key UNIQUE (generation_id, source_observation_key);


--
-- Name: regulatory_source_documents regulatory_source_documents_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_documents
    ADD CONSTRAINT regulatory_source_documents_pkey PRIMARY KEY (generation_id, record_key);


--
-- Name: regulatory_source_inventories regulatory_source_inventories_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_inventories
    ADD CONSTRAINT regulatory_source_inventories_pkey PRIMARY KEY (generation_id);


--
-- Name: regulatory_source_renditions regulatory_source_renditions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_renditions
    ADD CONSTRAINT regulatory_source_renditions_pkey PRIMARY KEY (generation_id, record_key);


--
-- Name: regulatory_source_reviews regulatory_source_reviews_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_reviews
    ADD CONSTRAINT regulatory_source_reviews_pkey PRIMARY KEY (generation_id, record_key);


--
-- Name: research_result_snapshots research_result_snapshots_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.research_result_snapshots
    ADD CONSTRAINT research_result_snapshots_pkey PRIMARY KEY (id);


--
-- Name: subscription_deliveries subscription_deliveries_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscription_deliveries
    ADD CONSTRAINT subscription_deliveries_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: supporting_material_section_embeddings supporting_material_section_embeddings_section_id_model_input_c; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_section_embeddings
    ADD CONSTRAINT supporting_material_section_embeddings_section_id_model_input_c PRIMARY KEY (section_id, model, input_contract);


--
-- Name: supporting_material_sections supporting_material_sections_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_sections
    ADD CONSTRAINT supporting_material_sections_pkey PRIMARY KEY (id);


--
-- Name: supporting_materials supporting_materials_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_materials
    ADD CONSTRAINT supporting_materials_pkey PRIMARY KEY (id);


--
-- Name: sync_checkpoints sync_checkpoints_source_stream_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.sync_checkpoints
    ADD CONSTRAINT sync_checkpoints_source_stream_pk PRIMARY KEY (source, stream);


--
-- Name: vote_positions vote_positions_vote_id_source_identity_pk; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.vote_positions
    ADD CONSTRAINT vote_positions_vote_id_source_identity_pk PRIMARY KEY (vote_id, source_identity);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: webhook_audit_records webhook_audit_records_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhook_audit_records
    ADD CONSTRAINT webhook_audit_records_pkey PRIMARY KEY (id);


--
-- Name: webhook_signing_keys webhook_signing_keys_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhook_signing_keys
    ADD CONSTRAINT webhook_signing_keys_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: amendment_actions_ordinal_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX amendment_actions_ordinal_uidx ON legislation.amendment_actions USING btree (amendment_id, ordinal);


--
-- Name: amendment_embeddings_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_embeddings_hnsw_idx ON legislation.amendment_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: amendment_embeddings_lookup_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_embeddings_lookup_idx ON legislation.amendment_embeddings USING btree (model, input_contract, amendment_id);


--
-- Name: amendment_relations_related_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_relations_related_idx ON legislation.amendment_relations USING btree (related_amendment_id, classification);


--
-- Name: amendment_section_search_document_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_section_search_document_idx ON legislation.amendment_section_search USING btree (document_id);


--
-- Name: amendment_section_search_section_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_section_search_section_gin_idx ON legislation.amendment_section_search USING gin (section_vector);


--
-- Name: amendment_section_search_title_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendment_section_search_title_gin_idx ON legislation.amendment_section_search USING gin (title_vector);


--
-- Name: amendments_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendments_bill_idx ON legislation.amendments USING btree (bill_id, submitted_date);


--
-- Name: amendments_embedding_shard_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendments_embedding_shard_idx ON legislation.amendments USING btree (((((hashtextextended(id, (0)::bigint) % (200)::bigint) + 200) % (200)::bigint)), id);


--
-- Name: amendments_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX amendments_jurisdiction_source_uidx ON legislation.amendments USING btree (jurisdiction_id, source_id);


--
-- Name: amendments_session_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendments_session_idx ON legislation.amendments USING btree (session_id, chamber, submitted_date);


--
-- Name: amendments_sponsor_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX amendments_sponsor_idx ON legislation.amendments USING btree (sponsor_person_id, submitted_date);


--
-- Name: api_idempotency_records_expiry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX api_idempotency_records_expiry_idx ON legislation.api_idempotency_records USING btree (expires_at);


--
-- Name: bill_actions_ordinal_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX bill_actions_ordinal_uidx ON legislation.bill_actions USING btree (bill_id, ordinal);


--
-- Name: bill_actions_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_actions_organization_idx ON legislation.bill_actions USING btree (organization_id, action_date);


--
-- Name: bill_actions_timeline_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_actions_timeline_idx ON legislation.bill_actions USING btree (bill_id, action_date, ordinal);


--
-- Name: bill_documents_amendment_date_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_documents_amendment_date_idx ON legislation.bill_documents USING btree (classification, ((document_date IS NULL)), document_date DESC, id);


--
-- Name: bill_documents_failed_retry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_documents_failed_retry_idx ON legislation.bill_documents USING btree (processing_error_category, next_attempt_at, id) WHERE (processing_status = 'failed'::text);


--
-- Name: bill_documents_pending_claim_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_documents_pending_claim_idx ON legislation.bill_documents USING btree (id) WHERE (processing_status = 'pending'::text);


--
-- Name: bill_documents_processing_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_documents_processing_idx ON legislation.bill_documents USING btree (processing_status, updated_at);


--
-- Name: bill_documents_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX bill_documents_source_uidx ON legislation.bill_documents USING btree (bill_id, source_url);


--
-- Name: bill_embeddings_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_embeddings_hnsw_idx ON legislation.bill_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: bill_embeddings_lookup_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_embeddings_lookup_idx ON legislation.bill_embeddings USING btree (model, input_contract, bill_id);


--
-- Name: bill_organizations_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_organizations_organization_idx ON legislation.bill_organizations USING btree (organization_id, bill_id);


--
-- Name: bill_relations_lookup_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_relations_lookup_idx ON legislation.bill_relations USING btree (bill_id, direction, classification, related_bill_id);


--
-- Name: bill_relations_related_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_relations_related_idx ON legislation.bill_relations USING btree (related_bill_id, classification);


--
-- Name: bill_sponsors_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_sponsors_bill_idx ON legislation.bill_sponsors USING btree (bill_id, is_primary);


--
-- Name: bill_sponsors_name_search_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_sponsors_name_search_gin_idx ON legislation.bill_sponsors USING gin (to_tsvector('english'::regconfig, name));


--
-- Name: bill_sponsors_person_activity_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bill_sponsors_person_activity_idx ON legislation.bill_sponsors USING btree (person_id, latest_observed_at, bill_id) WHERE ((person_id IS NOT NULL) AND (latest_observed_at IS NOT NULL));


--
-- Name: bill_sponsors_person_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX bill_sponsors_person_uidx ON legislation.bill_sponsors USING btree (bill_id, person_id, classification) WHERE (person_id IS NOT NULL);


--
-- Name: bills_classification_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_classification_gin_idx ON legislation.bills USING gin (classification);


--
-- Name: bills_embedding_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_embedding_hnsw_idx ON legislation.bills USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: bills_embedding_shard_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_embedding_shard_idx ON legislation.bills USING btree (((((hashtextextended(id, (0)::bigint) % (200)::bigint) + 200) % (200)::bigint)), id);


--
-- Name: bills_global_introduced_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_global_introduced_idx ON legislation.bills USING btree (introduced_at DESC, id);


--
-- Name: bills_identifier_lower_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_identifier_lower_idx ON legislation.bills USING btree (lower(identifier), id);


--
-- Name: bills_identifier_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX bills_identifier_uidx ON legislation.bills USING btree (jurisdiction_id, session_id, identifier);


--
-- Name: bills_introduced_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_introduced_idx ON legislation.bills USING btree (jurisdiction_id, introduced_at);


--
-- Name: bills_search_vector_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_search_vector_gin_idx ON legislation.bills USING gin (search_vector);


--
-- Name: bills_status_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_status_idx ON legislation.bills USING btree (jurisdiction_id, session_id, status);


--
-- Name: bills_subjects_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX bills_subjects_gin_idx ON legislation.bills USING gin (subjects);


--
-- Name: calendar_entries_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX calendar_entries_jurisdiction_source_uidx ON legislation.calendar_entries USING btree (jurisdiction_id, source_id);


--
-- Name: calendar_entries_schedule_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendar_entries_schedule_idx ON legislation.calendar_entries USING btree (jurisdiction_id, start_at, organization_id);


--
-- Name: calendar_events_calendar_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendar_events_calendar_idx ON legislation.calendar_events USING btree (calendar_id, event_id);


--
-- Name: calendar_events_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendar_events_event_idx ON legislation.calendar_events USING btree (event_id, calendar_id);


--
-- Name: calendars_browse_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendars_browse_idx ON legislation.calendars USING btree (jurisdiction_id, organization_id, name, id);


--
-- Name: calendars_name_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendars_name_idx ON legislation.calendars USING btree (name, id);


--
-- Name: calendars_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX calendars_organization_idx ON legislation.calendars USING btree (organization_id, name, id);


--
-- Name: calendars_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX calendars_source_uidx ON legislation.calendars USING btree (source_provider, source_id);


--
-- Name: canonical_record_fingerprints_observed_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX canonical_record_fingerprints_observed_idx ON legislation.canonical_record_fingerprints USING btree (observed_at);


--
-- Name: change_events_jurisdiction_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX change_events_jurisdiction_idx ON legislation.change_events USING btree (jurisdiction_id, observed_at);


--
-- Name: change_events_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX change_events_organization_idx ON legislation.change_events USING btree (organization_id, observed_at);


--
-- Name: change_events_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX change_events_person_idx ON legislation.change_events USING btree (person_id, observed_at);


--
-- Name: change_events_record_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX change_events_record_idx ON legislation.change_events USING btree (record_type, record_id, observed_at);


--
-- Name: change_events_run_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX change_events_run_idx ON legislation.change_events USING btree (ingestion_run_id, observed_at);


--
-- Name: document_download_leases_expiry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_download_leases_expiry_idx ON legislation.document_download_leases USING btree (expires_at);


--
-- Name: document_section_embeddings_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_section_embeddings_hnsw_idx ON legislation.document_section_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: document_section_embeddings_lookup_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_section_embeddings_lookup_idx ON legislation.document_section_embeddings USING btree (model, input_contract, section_id);


--
-- Name: document_sections_embedding_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_sections_embedding_hnsw_idx ON legislation.document_sections USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: document_sections_embedding_shard_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_sections_embedding_shard_idx ON legislation.document_sections USING btree (((((hashtextextended(id, (0)::bigint) % (200)::bigint) + 200) % (200)::bigint)), id);


--
-- Name: document_sections_identifier_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_sections_identifier_idx ON legislation.document_sections USING btree (document_id, section_identifier);


--
-- Name: document_sections_ordinal_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX document_sections_ordinal_uidx ON legislation.document_sections USING btree (document_id, ordinal);


--
-- Name: document_sections_search_vector_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX document_sections_search_vector_gin_idx ON legislation.document_sections USING gin (search_vector);


--
-- Name: event_agenda_item_amendments_amendment_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_agenda_item_amendments_amendment_idx ON legislation.event_agenda_item_amendments USING btree (amendment_id, agenda_item_id);


--
-- Name: event_agenda_item_bills_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_agenda_item_bills_bill_idx ON legislation.event_agenda_item_bills USING btree (bill_id, agenda_item_id);


--
-- Name: event_agenda_item_supporting_materials_material_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_agenda_item_supporting_materials_material_idx ON legislation.event_agenda_item_supporting_materials USING btree (material_id, agenda_item_id);


--
-- Name: event_agenda_items_ordinal_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX event_agenda_items_ordinal_uidx ON legislation.event_agenda_items USING btree (event_id, ordinal);


--
-- Name: event_bills_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_bills_bill_idx ON legislation.event_bills USING btree (bill_id, event_id);


--
-- Name: event_documents_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX event_documents_source_uidx ON legislation.event_documents USING btree (event_id, source_url);


--
-- Name: event_organizations_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_organizations_organization_idx ON legislation.event_organizations USING btree (organization_id, event_id);


--
-- Name: event_outcome_links_action_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX event_outcome_links_action_uidx ON legislation.event_outcome_links USING btree (event_id, action_id) WHERE (action_id IS NOT NULL);


--
-- Name: event_outcome_links_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_outcome_links_event_idx ON legislation.event_outcome_links USING btree (event_id, created_at);


--
-- Name: event_outcome_links_vote_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX event_outcome_links_vote_uidx ON legislation.event_outcome_links USING btree (event_id, vote_id) WHERE (vote_id IS NOT NULL);


--
-- Name: event_outcomes_agenda_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_outcomes_agenda_idx ON legislation.event_outcomes USING btree (agenda_item_id, event_id);


--
-- Name: event_outcomes_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_outcomes_event_idx ON legislation.event_outcomes USING btree (event_id, source_sequence, id);


--
-- Name: event_outcomes_timeline_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_outcomes_timeline_idx ON legislation.event_outcomes USING btree (occurred_at, source_sequence, id);


--
-- Name: event_participants_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_participants_event_idx ON legislation.event_participants USING btree (event_id, role);


--
-- Name: event_participants_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_participants_organization_idx ON legislation.event_participants USING btree (organization_id, event_id);


--
-- Name: event_participants_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_participants_person_idx ON legislation.event_participants USING btree (person_id, event_id);


--
-- Name: event_sessions_session_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX event_sessions_session_idx ON legislation.event_sessions USING btree (session_id, event_id);


--
-- Name: ingestion_locks_expiry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX ingestion_locks_expiry_idx ON legislation.ingestion_locks USING btree (expires_at);


--
-- Name: ingestion_runs_correlation_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX ingestion_runs_correlation_idx ON legislation.ingestion_runs USING btree (correlation_id);


--
-- Name: ingestion_runs_source_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX ingestion_runs_source_idx ON legislation.ingestion_runs USING btree (source, operation, started_at);


--
-- Name: ingestion_runs_workflow_execution_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX ingestion_runs_workflow_execution_idx ON legislation.ingestion_runs USING btree (workflow_execution_id);


--
-- Name: jurisdictions_foundation_incomplete_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX jurisdictions_foundation_incomplete_idx ON legislation.jurisdictions USING btree (id) WHERE (NOT provenance_complete);


--
-- Name: jurisdictions_subdivision_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX jurisdictions_subdivision_uidx ON legislation.jurisdictions USING btree (country_code, subdivision_code) WHERE (subdivision_code IS NOT NULL);


--
-- Name: legal_annual_source_observations_anchor_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_annual_source_observations_anchor_idx ON legislation.legal_annual_source_observations USING btree (anchor_edition_id, generation_id);


--
-- Name: legal_derived_outbox_retry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_derived_outbox_retry_idx ON legislation.legal_derived_outbox USING btree (state, retry_at, id);


--
-- Name: legal_discovery_dispatches_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_discovery_dispatches_pending_idx ON legislation.legal_discovery_dispatches USING btree (created_at, id) WHERE (state <> 'submitted'::text);


--
-- Name: legal_discovery_dispatches_recovery_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_discovery_dispatches_recovery_idx ON legislation.legal_discovery_dispatches USING btree (source_id, scope_key, id) WHERE ((completed_at IS NULL) AND (state = ANY (ARRAY['submitting'::text, 'submitted'::text])));


--
-- Name: legal_discovery_units_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_discovery_units_pending_idx ON legislation.legal_discovery_units USING btree (source_id, scope_key, discovered_at, unit_key) WHERE (state = 'pending'::text);


--
-- Name: legal_edition_provisions_children_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_edition_provisions_children_idx ON legislation.legal_edition_provisions USING btree (edition_id, parent_id, ordinal);


--
-- Name: legal_edition_provisions_parent_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_edition_provisions_parent_idx ON legislation.legal_edition_provisions USING btree (edition_id, parent_id, ordinal);


--
-- Name: legal_edition_provisions_version_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_edition_provisions_version_idx ON legislation.legal_edition_provisions USING btree (version_id);


--
-- Name: legal_editions_preparation_selection_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_editions_preparation_selection_idx ON legislation.legal_editions USING btree (source_id, id) INCLUDE (published_at) WHERE ((jurisdiction_id = 'jurisdiction:us'::text) AND (published_at IS NOT NULL));


--
-- Name: legal_editions_source_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_editions_source_idx ON legislation.legal_editions USING btree (code_id, source_id, issue_date, id);


--
-- Name: legal_fr_issue_preparations_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_fr_issue_preparations_pending_idx ON legislation.legal_fr_issue_preparations USING btree (updated_at, unit_key) WHERE (state = ANY (ARRAY['renditions_pending'::text, 'ready'::text]));


--
-- Name: legal_fr_issue_renditions_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_fr_issue_renditions_pending_idx ON legislation.legal_fr_issue_renditions USING btree (updated_at, unit_key, document_number) WHERE (state = ANY (ARRAY['pending'::text, 'acquired'::text]));


--
-- Name: legal_import_generations_annual_anchor_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_import_generations_annual_anchor_idx ON legislation.legal_import_generations USING btree (artifact_hash, parser_hash, ((unit ->> 'nativeId'::text))) WHERE ((source_id = 'govinfo-cfr'::text) AND (state = 'published'::text));


--
-- Name: legal_import_generations_work_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_import_generations_work_idx ON legislation.legal_import_generations USING btree (state, lease_expires_at, id);


--
-- Name: legal_passage_generations_document_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_passage_generations_document_idx ON legislation.legal_passage_generations USING btree (document_version_id, id);


--
-- Name: legal_passage_generations_provision_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_passage_generations_provision_idx ON legislation.legal_passage_generations USING btree (provision_version_id, id);


--
-- Name: legal_passage_preparation_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_passage_preparation_pending_idx ON legislation.legal_passage_preparation_items USING btree (preparation_id, ordinal) WHERE ((generation_id IS NULL) AND (failure_code IS NULL));


--
-- Name: legal_passages_search_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_passages_search_idx ON legislation.legal_passages USING gin (search_vector);


--
-- Name: legal_preparation_dispatches_pending_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_preparation_dispatches_pending_idx ON legislation.legal_preparation_dispatches USING btree (created_at, id) WHERE (state <> 'submitted'::text);


--
-- Name: legal_preparation_dispatches_preparation_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_preparation_dispatches_preparation_idx ON legislation.legal_preparation_dispatches USING btree (preparation_id, wave_id);


--
-- Name: legal_preparation_dispatches_recovery_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_preparation_dispatches_recovery_idx ON legislation.legal_preparation_dispatches USING btree (wave_id, id) WHERE ((completed_at IS NULL) AND (state = ANY (ARRAY['submitting'::text, 'submitted'::text])));


--
-- Name: legal_preparation_dispatches_wave_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legal_preparation_dispatches_wave_idx ON legislation.legal_preparation_dispatches USING btree (wave_id, id);


--
-- Name: legislative_events_deleted_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legislative_events_deleted_idx ON legislation.legislative_events USING btree (jurisdiction_id, is_deleted, start_at);


--
-- Name: legislative_events_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX legislative_events_jurisdiction_source_uidx ON legislation.legislative_events USING btree (jurisdiction_id, source_id);


--
-- Name: legislative_events_schedule_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legislative_events_schedule_idx ON legislation.legislative_events USING btree (jurisdiction_id, start_at, status);


--
-- Name: legislative_sessions_foundation_incomplete_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legislative_sessions_foundation_incomplete_idx ON legislation.legislative_sessions USING btree (id) WHERE (NOT provenance_complete);


--
-- Name: legislative_sessions_identifier_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX legislative_sessions_identifier_uidx ON legislation.legislative_sessions USING btree (jurisdiction_id, identifier);


--
-- Name: legislative_sessions_jurisdiction_id_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX legislative_sessions_jurisdiction_id_uidx ON legislation.legislative_sessions USING btree (jurisdiction_id, id);


--
-- Name: legislative_terms_jurisdiction_chamber_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legislative_terms_jurisdiction_chamber_idx ON legislation.legislative_terms USING btree (jurisdiction_id, chamber, district);


--
-- Name: legislative_terms_person_dates_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX legislative_terms_person_dates_idx ON legislation.legislative_terms USING btree (person_id, start_date, end_date);


--
-- Name: legislative_terms_person_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX legislative_terms_person_source_uidx ON legislation.legislative_terms USING btree (person_id, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: organization_memberships_active_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX organization_memberships_active_source_uidx ON legislation.organization_memberships USING btree (organization_id, source_id) WHERE ((source_id IS NOT NULL) AND (is_active IS TRUE));


--
-- Name: organization_memberships_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX organization_memberships_organization_idx ON legislation.organization_memberships USING btree (organization_id, is_active);


--
-- Name: organization_memberships_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX organization_memberships_person_idx ON legislation.organization_memberships USING btree (person_id, effective_start_date, detected_start_date);


--
-- Name: organization_memberships_session_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX organization_memberships_session_idx ON legislation.organization_memberships USING btree (legislative_session_id, is_active);


--
-- Name: organization_memberships_session_tenure_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX organization_memberships_session_tenure_uidx ON legislation.organization_memberships USING btree (organization_id, person_id, legislative_session_id, tenure_ordinal) WHERE (legislative_session_id IS NOT NULL);


--
-- Name: organization_memberships_source_tenure_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX organization_memberships_source_tenure_uidx ON legislation.organization_memberships USING btree (organization_id, source_id, tenure_ordinal) WHERE (source_id IS NOT NULL);


--
-- Name: organizations_jurisdiction_classification_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX organizations_jurisdiction_classification_idx ON legislation.organizations USING btree (jurisdiction_id, classification, chamber);


--
-- Name: organizations_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX organizations_jurisdiction_source_uidx ON legislation.organizations USING btree (jurisdiction_id, source_id);


--
-- Name: organizations_parent_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX organizations_parent_idx ON legislation.organizations USING btree (parent_organization_id);


--
-- Name: passage_search_changes_retry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX passage_search_changes_retry_idx ON legislation.passage_search_changes USING btree (retry_at, id);


--
-- Name: people_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX people_jurisdiction_source_uidx ON legislation.people USING btree (jurisdiction_id, source_id) WHERE ((jurisdiction_id IS NOT NULL) AND (source_id IS NOT NULL));


--
-- Name: person_aliases_name_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX person_aliases_name_idx ON legislation.person_aliases USING btree (name);


--
-- Name: person_aliases_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX person_aliases_person_idx ON legislation.person_aliases USING btree (person_id);


--
-- Name: person_external_identifiers_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX person_external_identifiers_person_idx ON legislation.person_external_identifiers USING btree (person_id);


--
-- Name: person_jurisdictions_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX person_jurisdictions_person_idx ON legislation.person_jurisdictions USING btree (person_id, jurisdiction_id);


--
-- Name: regulatory_document_observations_browse_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX regulatory_document_observations_browse_idx ON legislation.regulatory_document_observations USING btree (publication_date, id);


--
-- Name: regulatory_document_observations_version_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX regulatory_document_observations_version_idx ON legislation.regulatory_document_observations USING btree (version_id);


--
-- Name: regulatory_observations_preparation_selection_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX regulatory_observations_preparation_selection_idx ON legislation.regulatory_document_observations USING btree (source_id, id) INCLUDE (generation_id) WHERE (jurisdiction_id = 'jurisdiction:us'::text);


--
-- Name: regulatory_publication_outbox_retry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX regulatory_publication_outbox_retry_idx ON legislation.regulatory_publication_outbox USING btree (state, retry_at, id);


--
-- Name: regulatory_source_documents_number_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX regulatory_source_documents_number_idx ON legislation.regulatory_source_documents USING btree (publication_date, publisher_number, document_id);


--
-- Name: research_result_snapshots_expiry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX research_result_snapshots_expiry_idx ON legislation.research_result_snapshots USING btree (expires_at);


--
-- Name: subscription_deliveries_subscription_created_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX subscription_deliveries_subscription_created_idx ON legislation.subscription_deliveries USING btree (subscription_id, created_at, id);


--
-- Name: subscription_events_subscription_matched_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX subscription_events_subscription_matched_idx ON legislation.subscription_events USING btree (subscription_id, matched_at, id);


--
-- Name: subscriptions_exact_active_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX subscriptions_exact_active_uidx ON legislation.subscriptions USING btree (COALESCE(owner_organization_id, ''::text), owner_user_id, target_fingerprint) WHERE (status <> 'cancelled'::text);


--
-- Name: subscriptions_owner_updated_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX subscriptions_owner_updated_idx ON legislation.subscriptions USING btree (owner_organization_id, owner_user_id, updated_at);


--
-- Name: supporting_material_links_amendment_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_links_amendment_idx ON legislation.supporting_material_links USING btree (amendment_id, material_id);


--
-- Name: supporting_material_links_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_links_bill_idx ON legislation.supporting_material_links USING btree (bill_id, material_id);


--
-- Name: supporting_material_links_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_links_event_idx ON legislation.supporting_material_links USING btree (event_id, material_id);


--
-- Name: supporting_material_links_identity_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX supporting_material_links_identity_uidx ON legislation.supporting_material_links USING btree (material_id, bill_id, amendment_id, event_id, organization_id, classification);


--
-- Name: supporting_material_section_embeddings_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_section_embeddings_hnsw_idx ON legislation.supporting_material_section_embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: supporting_material_section_embeddings_lookup_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_section_embeddings_lookup_idx ON legislation.supporting_material_section_embeddings USING btree (model, input_contract, section_id);


--
-- Name: supporting_material_sections_embedding_hnsw_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_sections_embedding_hnsw_idx ON legislation.supporting_material_sections USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: supporting_material_sections_embedding_shard_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_sections_embedding_shard_idx ON legislation.supporting_material_sections USING btree (((((hashtextextended(id, (0)::bigint) % (200)::bigint) + 200) % (200)::bigint)), id);


--
-- Name: supporting_material_sections_identifier_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_sections_identifier_idx ON legislation.supporting_material_sections USING btree (material_id, section_identifier);


--
-- Name: supporting_material_sections_ordinal_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX supporting_material_sections_ordinal_uidx ON legislation.supporting_material_sections USING btree (material_id, ordinal);


--
-- Name: supporting_material_sections_page_range_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_sections_page_range_idx ON legislation.supporting_material_sections USING btree (material_id, page_start, page_end);


--
-- Name: supporting_material_sections_search_vector_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_material_sections_search_vector_gin_idx ON legislation.supporting_material_sections USING gin (search_vector);


--
-- Name: supporting_materials_classification_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_materials_classification_idx ON legislation.supporting_materials USING btree (jurisdiction_id, classification, document_date);


--
-- Name: supporting_materials_failed_retry_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_materials_failed_retry_idx ON legislation.supporting_materials USING btree (processing_error_category, next_attempt_at, id) WHERE (processing_status = 'failed'::text);


--
-- Name: supporting_materials_jurisdiction_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX supporting_materials_jurisdiction_source_uidx ON legislation.supporting_materials USING btree (jurisdiction_id, source_id);


--
-- Name: supporting_materials_processing_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_materials_processing_idx ON legislation.supporting_materials USING btree (processing_status, updated_at);


--
-- Name: supporting_materials_title_search_gin_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX supporting_materials_title_search_gin_idx ON legislation.supporting_materials USING gin (to_tsvector('english'::regconfig, title));


--
-- Name: vote_positions_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX vote_positions_person_idx ON legislation.vote_positions USING btree (person_id, option);


--
-- Name: vote_positions_source_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX vote_positions_source_person_idx ON legislation.vote_positions USING btree (source_person_id, option);


--
-- Name: vote_positions_vote_option_person_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX vote_positions_vote_option_person_idx ON legislation.vote_positions USING btree (vote_id, option, person_id);


--
-- Name: vote_positions_vote_sequence_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX vote_positions_vote_sequence_idx ON legislation.vote_positions USING btree (vote_id, source_sequence, source_identity);


--
-- Name: votes_amendment_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_amendment_idx ON legislation.votes USING btree (amendment_id, held_at);


--
-- Name: votes_bill_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_bill_idx ON legislation.votes USING btree (bill_id, held_at);


--
-- Name: votes_bill_timeline_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_bill_timeline_idx ON legislation.votes USING btree (bill_id, held_at, source_sequence, id);


--
-- Name: votes_event_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_event_idx ON legislation.votes USING btree (event_id, held_at);


--
-- Name: votes_occurrence_asc_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_occurrence_asc_idx ON legislation.votes USING btree (COALESCE(held_at, ((held_date)::timestamp without time zone AT TIME ZONE 'UTC'::text)), id) WHERE timeline_complete;


--
-- Name: votes_occurrence_desc_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_occurrence_desc_idx ON legislation.votes USING btree (COALESCE(held_at, ((held_date)::timestamp without time zone AT TIME ZONE 'UTC'::text)) DESC, id) WHERE timeline_complete;


--
-- Name: votes_organization_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_organization_idx ON legislation.votes USING btree (organization_id, held_at);


--
-- Name: votes_session_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX votes_session_idx ON legislation.votes USING btree (session_id, id);


--
-- Name: votes_source_uidx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE UNIQUE INDEX votes_source_uidx ON legislation.votes USING btree (source_id) WHERE (source_id IS NOT NULL);


--
-- Name: webhook_audit_records_webhook_occurred_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX webhook_audit_records_webhook_occurred_idx ON legislation.webhook_audit_records USING btree (webhook_id, occurred_at, id);


--
-- Name: webhook_signing_keys_active_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX webhook_signing_keys_active_idx ON legislation.webhook_signing_keys USING btree (webhook_id, is_active, expires_at);


--
-- Name: webhooks_owner_updated_idx; Type: INDEX; Schema: legislation; Owner: -
--

CREATE INDEX webhooks_owner_updated_idx ON legislation.webhooks USING btree (owner_organization_id, owner_user_id, updated_at);


--
-- Name: bill_documents bill_documents_amendment_search_trigger; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER bill_documents_amendment_search_trigger AFTER UPDATE OF title, classification ON legislation.bill_documents FOR EACH ROW EXECUTE FUNCTION legislation.sync_amendment_document_search();


--
-- Name: bills bills_search_vector_trigger; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER bills_search_vector_trigger BEFORE INSERT OR UPDATE OF title, summary, subjects ON legislation.bills FOR EACH ROW EXECUTE FUNCTION legislation.update_bill_search_vector();


--
-- Name: bills capture_passage_bill_change; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER capture_passage_bill_change AFTER INSERT OR DELETE OR UPDATE ON legislation.bills FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();


--
-- Name: bill_documents capture_passage_document_change; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER capture_passage_document_change AFTER INSERT OR DELETE OR UPDATE ON legislation.bill_documents FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();


--
-- Name: document_sections capture_passage_section_change; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER capture_passage_section_change AFTER INSERT OR DELETE OR UPDATE ON legislation.document_sections FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();


--
-- Name: bill_sponsors capture_passage_sponsor_change; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER capture_passage_sponsor_change AFTER INSERT OR DELETE OR UPDATE ON legislation.bill_sponsors FOR EACH ROW EXECUTE FUNCTION legislation.capture_passage_search_change();


--
-- Name: document_sections document_sections_amendment_search_trigger; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER document_sections_amendment_search_trigger AFTER INSERT OR UPDATE OF document_id, heading, text, search_vector ON legislation.document_sections FOR EACH ROW EXECUTE FUNCTION legislation.sync_amendment_section_search();


--
-- Name: document_sections document_sections_search_vector_trigger; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER document_sections_search_vector_trigger BEFORE INSERT OR UPDATE OF heading, text ON legislation.document_sections FOR EACH ROW EXECUTE FUNCTION legislation.update_document_section_search_vector();


--
-- Name: legal_passage_generations legal_copy_generation_revision; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_generation_revision AFTER INSERT OR DELETE OR UPDATE ON legislation.legal_passage_generations FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');


--
-- Name: legal_passage_generations legal_copy_generation_truncate; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_generation_truncate AFTER TRUNCATE ON legislation.legal_passage_generations FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('id');


--
-- Name: legal_passages legal_copy_passage_revision; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_passage_revision AFTER INSERT OR DELETE OR UPDATE ON legislation.legal_passages FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');


--
-- Name: legal_passages legal_copy_passage_truncate; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_passage_truncate AFTER TRUNCATE ON legislation.legal_passages FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');


--
-- Name: legal_passage_source_provenance legal_copy_provenance_revision; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_provenance_revision AFTER INSERT OR DELETE OR UPDATE ON legislation.legal_passage_source_provenance FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');


--
-- Name: legal_passage_source_provenance legal_copy_provenance_truncate; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_provenance_truncate AFTER TRUNCATE ON legislation.legal_passage_source_provenance FOR EACH STATEMENT EXECUTE FUNCTION legislation.advance_legal_copy_revision('generation_id');


--
-- Name: legal_provision_versions legal_copy_provision_revision; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_provision_revision AFTER DELETE OR UPDATE ON legislation.legal_provision_versions FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('version');


--
-- Name: regulatory_document_versions legal_copy_publication_revision; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER legal_copy_publication_revision AFTER DELETE OR UPDATE ON legislation.regulatory_document_versions FOR EACH ROW EXECUTE FUNCTION legislation.advance_legal_copy_revision('version');


--
-- Name: supporting_material_sections supporting_material_sections_search_vector_trigger; Type: TRIGGER; Schema: legislation; Owner: -
--

CREATE TRIGGER supporting_material_sections_search_vector_trigger BEFORE INSERT OR UPDATE OF heading, text ON legislation.supporting_material_sections FOR EACH ROW EXECUTE FUNCTION legislation.update_supporting_material_section_search_vector();


--
-- Name: amendment_actions amendment_actions_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_actions
    ADD CONSTRAINT amendment_actions_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE CASCADE;


--
-- Name: amendment_embeddings amendment_embeddings_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_embeddings
    ADD CONSTRAINT amendment_embeddings_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE CASCADE;


--
-- Name: amendment_relations amendment_relations_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_relations
    ADD CONSTRAINT amendment_relations_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE CASCADE;


--
-- Name: amendment_relations amendment_relations_related_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_relations
    ADD CONSTRAINT amendment_relations_related_amendment_id_amendments_id_fk FOREIGN KEY (related_amendment_id) REFERENCES legislation.amendments(id) ON DELETE CASCADE;


--
-- Name: amendment_section_search amendment_section_search_document_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_section_search
    ADD CONSTRAINT amendment_section_search_document_id_fkey FOREIGN KEY (document_id) REFERENCES legislation.bill_documents(id) ON DELETE CASCADE;


--
-- Name: amendment_section_search amendment_section_search_section_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendment_section_search
    ADD CONSTRAINT amendment_section_search_section_id_fkey FOREIGN KEY (section_id) REFERENCES legislation.document_sections(id) ON DELETE CASCADE;


--
-- Name: amendments amendments_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendments
    ADD CONSTRAINT amendments_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE SET NULL;


--
-- Name: amendments amendments_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendments
    ADD CONSTRAINT amendments_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: amendments amendments_session_id_legislative_sessions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendments
    ADD CONSTRAINT amendments_session_id_legislative_sessions_id_fk FOREIGN KEY (session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: amendments amendments_sponsor_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.amendments
    ADD CONSTRAINT amendments_sponsor_person_id_people_id_fk FOREIGN KEY (sponsor_person_id) REFERENCES legislation.people(id) ON DELETE RESTRICT;


--
-- Name: bill_actions bill_actions_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_actions
    ADD CONSTRAINT bill_actions_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_actions bill_actions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_actions
    ADD CONSTRAINT bill_actions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE SET NULL;


--
-- Name: bill_documents bill_documents_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_documents
    ADD CONSTRAINT bill_documents_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_embeddings bill_embeddings_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_embeddings
    ADD CONSTRAINT bill_embeddings_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_organizations bill_organizations_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_organizations
    ADD CONSTRAINT bill_organizations_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_organizations bill_organizations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_organizations
    ADD CONSTRAINT bill_organizations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE CASCADE;


--
-- Name: bill_relations bill_relations_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_relations
    ADD CONSTRAINT bill_relations_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_sponsors bill_sponsors_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_sponsors
    ADD CONSTRAINT bill_sponsors_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: bill_sponsors bill_sponsors_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bill_sponsors
    ADD CONSTRAINT bill_sponsors_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE RESTRICT;


--
-- Name: bills bills_session_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.bills
    ADD CONSTRAINT bills_session_fk FOREIGN KEY (jurisdiction_id, session_id) REFERENCES legislation.legislative_sessions(jurisdiction_id, id) ON DELETE RESTRICT;


--
-- Name: calendar_entries calendar_entries_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_entries
    ADD CONSTRAINT calendar_entries_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: calendar_entries calendar_entries_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_entries
    ADD CONSTRAINT calendar_entries_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: calendar_entries calendar_entries_session_id_legislative_sessions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_entries
    ADD CONSTRAINT calendar_entries_session_id_legislative_sessions_id_fk FOREIGN KEY (session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_calendar_id_calendars_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_events
    ADD CONSTRAINT calendar_events_calendar_id_calendars_id_fk FOREIGN KEY (calendar_id) REFERENCES legislation.calendars(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendar_events
    ADD CONSTRAINT calendar_events_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: calendars calendars_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendars
    ADD CONSTRAINT calendars_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: calendars calendars_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.calendars
    ADD CONSTRAINT calendars_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: change_events change_events_ingestion_run_id_ingestion_runs_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.change_events
    ADD CONSTRAINT change_events_ingestion_run_id_ingestion_runs_id_fk FOREIGN KEY (ingestion_run_id) REFERENCES legislation.ingestion_runs(id) ON DELETE RESTRICT;


--
-- Name: change_events change_events_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.change_events
    ADD CONSTRAINT change_events_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: change_events change_events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.change_events
    ADD CONSTRAINT change_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE SET NULL;


--
-- Name: change_events change_events_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.change_events
    ADD CONSTRAINT change_events_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE SET NULL;


--
-- Name: document_section_embeddings document_section_embeddings_section_id_document_sections_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.document_section_embeddings
    ADD CONSTRAINT document_section_embeddings_section_id_document_sections_id_fk FOREIGN KEY (section_id) REFERENCES legislation.document_sections(id) ON DELETE CASCADE;


--
-- Name: document_sections document_sections_document_id_bill_documents_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.document_sections
    ADD CONSTRAINT document_sections_document_id_bill_documents_id_fk FOREIGN KEY (document_id) REFERENCES legislation.bill_documents(id) ON DELETE CASCADE;


--
-- Name: event_agenda_item_amendments event_agenda_item_amendments_agenda_item_id_event_agenda_items_; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_amendments
    ADD CONSTRAINT event_agenda_item_amendments_agenda_item_id_event_agenda_items_ FOREIGN KEY (agenda_item_id) REFERENCES legislation.event_agenda_items(id) ON DELETE CASCADE;


--
-- Name: event_agenda_item_amendments event_agenda_item_amendments_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_amendments
    ADD CONSTRAINT event_agenda_item_amendments_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE RESTRICT;


--
-- Name: event_agenda_item_bills event_agenda_item_bills_agenda_item_id_event_agenda_items_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_bills
    ADD CONSTRAINT event_agenda_item_bills_agenda_item_id_event_agenda_items_id_fk FOREIGN KEY (agenda_item_id) REFERENCES legislation.event_agenda_items(id) ON DELETE CASCADE;


--
-- Name: event_agenda_item_bills event_agenda_item_bills_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_bills
    ADD CONSTRAINT event_agenda_item_bills_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE RESTRICT;


--
-- Name: event_agenda_item_supporting_materials event_agenda_item_supporting_materials_agenda_item_id_event_age; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_supporting_materials
    ADD CONSTRAINT event_agenda_item_supporting_materials_agenda_item_id_event_age FOREIGN KEY (agenda_item_id) REFERENCES legislation.event_agenda_items(id) ON DELETE CASCADE;


--
-- Name: event_agenda_item_supporting_materials event_agenda_item_supporting_materials_material_id_supporting_m; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_item_supporting_materials
    ADD CONSTRAINT event_agenda_item_supporting_materials_material_id_supporting_m FOREIGN KEY (material_id) REFERENCES legislation.supporting_materials(id) ON DELETE RESTRICT;


--
-- Name: event_agenda_items event_agenda_items_document_id_event_documents_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_items
    ADD CONSTRAINT event_agenda_items_document_id_event_documents_id_fk FOREIGN KEY (document_id) REFERENCES legislation.event_documents(id) ON DELETE SET NULL;


--
-- Name: event_agenda_items event_agenda_items_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_items
    ADD CONSTRAINT event_agenda_items_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_agenda_items event_agenda_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_agenda_items
    ADD CONSTRAINT event_agenda_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: event_bills event_bills_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_bills
    ADD CONSTRAINT event_bills_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: event_bills event_bills_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_bills
    ADD CONSTRAINT event_bills_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_continuations event_continuations_continuation_event_id_legislative_events_id; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_continuations
    ADD CONSTRAINT event_continuations_continuation_event_id_legislative_events_id FOREIGN KEY (continuation_event_id) REFERENCES legislation.legislative_events(id) ON DELETE SET NULL;


--
-- Name: event_continuations event_continuations_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_continuations
    ADD CONSTRAINT event_continuations_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_documents event_documents_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_documents
    ADD CONSTRAINT event_documents_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_organizations event_organizations_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_organizations
    ADD CONSTRAINT event_organizations_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_organizations event_organizations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_organizations
    ADD CONSTRAINT event_organizations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: event_outcome_links event_outcome_links_action_id_bill_actions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcome_links
    ADD CONSTRAINT event_outcome_links_action_id_bill_actions_id_fk FOREIGN KEY (action_id) REFERENCES legislation.bill_actions(id) ON DELETE CASCADE;


--
-- Name: event_outcome_links event_outcome_links_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcome_links
    ADD CONSTRAINT event_outcome_links_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_outcome_links event_outcome_links_vote_id_votes_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcome_links
    ADD CONSTRAINT event_outcome_links_vote_id_votes_id_fk FOREIGN KEY (vote_id) REFERENCES legislation.votes(id) ON DELETE CASCADE;


--
-- Name: event_outcomes event_outcomes_action_id_bill_actions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcomes
    ADD CONSTRAINT event_outcomes_action_id_bill_actions_id_fk FOREIGN KEY (action_id) REFERENCES legislation.bill_actions(id) ON DELETE RESTRICT;


--
-- Name: event_outcomes event_outcomes_agenda_item_id_event_agenda_items_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcomes
    ADD CONSTRAINT event_outcomes_agenda_item_id_event_agenda_items_id_fk FOREIGN KEY (agenda_item_id) REFERENCES legislation.event_agenda_items(id) ON DELETE RESTRICT;


--
-- Name: event_outcomes event_outcomes_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcomes
    ADD CONSTRAINT event_outcomes_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_outcomes event_outcomes_vote_id_votes_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_outcomes
    ADD CONSTRAINT event_outcomes_vote_id_votes_id_fk FOREIGN KEY (vote_id) REFERENCES legislation.votes(id) ON DELETE RESTRICT;


--
-- Name: event_participants event_participants_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_participants
    ADD CONSTRAINT event_participants_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_participants event_participants_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_participants
    ADD CONSTRAINT event_participants_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: event_participants event_participants_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_participants
    ADD CONSTRAINT event_participants_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE RESTRICT;


--
-- Name: event_sessions event_sessions_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_sessions
    ADD CONSTRAINT event_sessions_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: event_sessions event_sessions_session_id_legislative_sessions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.event_sessions
    ADD CONSTRAINT event_sessions_session_id_legislative_sessions_id_fk FOREIGN KEY (session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: legal_annual_edition_volumes legal_annual_edition_volumes_annual_edition_id_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_edition_volumes
    ADD CONSTRAINT legal_annual_edition_volumes_annual_edition_id_code_id_fkey FOREIGN KEY (annual_edition_id, code_id) REFERENCES legislation.legal_annual_editions(id, code_id);


--
-- Name: legal_annual_edition_volumes legal_annual_edition_volumes_edition_id_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_edition_volumes
    ADD CONSTRAINT legal_annual_edition_volumes_edition_id_code_id_fkey FOREIGN KEY (edition_id, code_id) REFERENCES legislation.legal_editions(id, code_id);


--
-- Name: legal_annual_editions legal_annual_editions_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_editions
    ADD CONSTRAINT legal_annual_editions_code_id_fkey FOREIGN KEY (code_id) REFERENCES legislation.legal_codes(id);


--
-- Name: legal_annual_editions legal_annual_editions_manifest_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_editions
    ADD CONSTRAINT legal_annual_editions_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES legislation.legal_import_manifests(id);


--
-- Name: legal_annual_source_observations legal_annual_source_observations_anchor_edition_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_source_observations
    ADD CONSTRAINT legal_annual_source_observations_anchor_edition_id_fkey FOREIGN KEY (anchor_edition_id) REFERENCES legislation.legal_editions(id);


--
-- Name: legal_annual_source_observations legal_annual_source_observations_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_annual_source_observations
    ADD CONSTRAINT legal_annual_source_observations_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: legal_code_heads legal_code_heads_edition_id_code_id_source_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_code_heads
    ADD CONSTRAINT legal_code_heads_edition_id_code_id_source_id_fkey FOREIGN KEY (edition_id, code_id, source_id) REFERENCES legislation.legal_editions(id, code_id, source_id);


--
-- Name: legal_codes legal_codes_jurisdiction_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_codes
    ADD CONSTRAINT legal_codes_jurisdiction_id_fkey FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id);


--
-- Name: legal_derived_outbox legal_derived_outbox_edition_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_derived_outbox
    ADD CONSTRAINT legal_derived_outbox_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES legislation.legal_editions(id);


--
-- Name: legal_discovery_checkpoints legal_discovery_checkpoints_source_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_checkpoints
    ADD CONSTRAINT legal_discovery_checkpoints_source_id_fkey FOREIGN KEY (source_id) REFERENCES legislation.legal_sources(id);


--
-- Name: legal_discovery_dispatches legal_discovery_dispatches_manifest_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_dispatches
    ADD CONSTRAINT legal_discovery_dispatches_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES legislation.legal_import_manifests(id);


--
-- Name: legal_discovery_dispatches legal_discovery_dispatches_source_id_scope_key_unit_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_dispatches
    ADD CONSTRAINT legal_discovery_dispatches_source_id_scope_key_unit_key_fkey FOREIGN KEY (source_id, scope_key, unit_key) REFERENCES legislation.legal_discovery_units(source_id, scope_key, unit_key);


--
-- Name: legal_discovery_pages legal_discovery_pages_source_id_scope_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_pages
    ADD CONSTRAINT legal_discovery_pages_source_id_scope_key_fkey FOREIGN KEY (source_id, scope_key) REFERENCES legislation.legal_discovery_checkpoints(source_id, scope_key);


--
-- Name: legal_discovery_units legal_discovery_units_artifact_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_artifact_fk FOREIGN KEY (artifact_hash) REFERENCES legislation.legal_artifacts(hash);


--
-- Name: legal_discovery_units legal_discovery_units_edition_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_edition_fk FOREIGN KEY (edition_id) REFERENCES legislation.legal_editions(id);


--
-- Name: legal_discovery_units legal_discovery_units_manifest_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_manifest_fk FOREIGN KEY (manifest_id) REFERENCES legislation.legal_import_manifests(id);


--
-- Name: legal_discovery_units legal_discovery_units_publication_generation_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_publication_generation_fk FOREIGN KEY (publication_generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: legal_discovery_units legal_discovery_units_source_id_scope_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_discovery_units
    ADD CONSTRAINT legal_discovery_units_source_id_scope_key_fkey FOREIGN KEY (source_id, scope_key) REFERENCES legislation.legal_discovery_checkpoints(source_id, scope_key);


--
-- Name: legal_edition_provisions legal_edition_provisions_edition_id_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_edition_id_code_id_fkey FOREIGN KEY (edition_id, code_id) REFERENCES legislation.legal_editions(id, code_id);


--
-- Name: legal_edition_provisions legal_edition_provisions_edition_id_parent_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_edition_id_parent_id_fkey FOREIGN KEY (edition_id, parent_id) REFERENCES legislation.legal_edition_provisions(edition_id, provision_id);


--
-- Name: legal_edition_provisions legal_edition_provisions_version_id_provision_id_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_edition_provisions
    ADD CONSTRAINT legal_edition_provisions_version_id_provision_id_code_id_fkey FOREIGN KEY (version_id, provision_id, code_id) REFERENCES legislation.legal_provision_versions(id, provision_id, code_id);


--
-- Name: legal_editions legal_editions_code_id_jurisdiction_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_code_id_jurisdiction_id_fkey FOREIGN KEY (code_id, jurisdiction_id) REFERENCES legislation.legal_codes(id, jurisdiction_id);


--
-- Name: legal_editions legal_editions_generation_id_source_id_jurisdiction_id_rig_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_editions
    ADD CONSTRAINT legal_editions_generation_id_source_id_jurisdiction_id_rig_fkey FOREIGN KEY (generation_id, source_id, jurisdiction_id, rights_profile_id) REFERENCES legislation.legal_import_generations(id, source_id, jurisdiction_id, rights_profile_id);


--
-- Name: legal_fr_issue_preparations legal_fr_issue_preparations_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_preparations
    ADD CONSTRAINT legal_fr_issue_preparations_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: legal_fr_issue_preparations legal_fr_issue_preparations_manifest_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_preparations
    ADD CONSTRAINT legal_fr_issue_preparations_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES legislation.legal_import_manifests(id);


--
-- Name: legal_fr_issue_preparations legal_fr_issue_preparations_source_id_scope_key_unit_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_preparations
    ADD CONSTRAINT legal_fr_issue_preparations_source_id_scope_key_unit_key_fkey FOREIGN KEY (source_id, scope_key, unit_key) REFERENCES legislation.legal_discovery_units(source_id, scope_key, unit_key) ON DELETE CASCADE;


--
-- Name: legal_fr_issue_renditions legal_fr_issue_renditions_source_id_scope_key_unit_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_fr_issue_renditions
    ADD CONSTRAINT legal_fr_issue_renditions_source_id_scope_key_unit_key_fkey FOREIGN KEY (source_id, scope_key, unit_key) REFERENCES legislation.legal_fr_issue_preparations(source_id, scope_key, unit_key) ON DELETE CASCADE;


--
-- Name: legal_import_generations legal_import_generations_artifact_hash_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_artifact_hash_fkey FOREIGN KEY (artifact_hash) REFERENCES legislation.legal_artifacts(hash);


--
-- Name: legal_import_generations legal_import_generations_jurisdiction_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_jurisdiction_id_fkey FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id);


--
-- Name: legal_import_generations legal_import_generations_manifest_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES legislation.legal_import_manifests(id);


--
-- Name: legal_import_generations legal_import_generations_rights_profile_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_rights_profile_id_fkey FOREIGN KEY (rights_profile_id) REFERENCES legislation.legal_rights_profiles(id);


--
-- Name: legal_import_generations legal_import_generations_source_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_generations
    ADD CONSTRAINT legal_import_generations_source_id_fkey FOREIGN KEY (source_id) REFERENCES legislation.legal_sources(id);


--
-- Name: legal_import_records legal_import_records_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_import_records
    ADD CONSTRAINT legal_import_records_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: legal_passage_generations legal_passage_generations_document_version_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_generations
    ADD CONSTRAINT legal_passage_generations_document_version_id_fkey FOREIGN KEY (document_version_id) REFERENCES legislation.regulatory_document_versions(id);


--
-- Name: legal_passage_generations legal_passage_generations_provision_version_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_generations
    ADD CONSTRAINT legal_passage_generations_provision_version_id_fkey FOREIGN KEY (provision_version_id) REFERENCES legislation.legal_provision_versions(id);


--
-- Name: legal_passage_preparation_items legal_passage_preparation_items_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparation_items
    ADD CONSTRAINT legal_passage_preparation_items_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_passage_generations(id);


--
-- Name: legal_passage_preparation_items legal_passage_preparation_items_preparation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparation_items
    ADD CONSTRAINT legal_passage_preparation_items_preparation_id_fkey FOREIGN KEY (preparation_id) REFERENCES legislation.legal_passage_preparations(id);


--
-- Name: legal_passage_preparations legal_passage_preparations_edition_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparations
    ADD CONSTRAINT legal_passage_preparations_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES legislation.legal_editions(id);


--
-- Name: legal_passage_preparations legal_passage_preparations_observation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_preparations
    ADD CONSTRAINT legal_passage_preparations_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES legislation.regulatory_document_observations(id);


--
-- Name: legal_passage_source_provenance legal_passage_source_provenance_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passage_source_provenance
    ADD CONSTRAINT legal_passage_source_provenance_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_passage_generations(id) ON DELETE CASCADE;


--
-- Name: legal_passages legal_passages_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_passages
    ADD CONSTRAINT legal_passages_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_passage_generations(id);


--
-- Name: legal_provision_source_reviews legal_provision_source_reviews_edition_id_version_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_source_reviews
    ADD CONSTRAINT legal_provision_source_reviews_edition_id_version_id_fkey FOREIGN KEY (edition_id, version_id) REFERENCES legislation.legal_edition_provisions(edition_id, version_id);


--
-- Name: legal_provision_versions legal_provision_versions_provision_id_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provision_versions
    ADD CONSTRAINT legal_provision_versions_provision_id_code_id_fkey FOREIGN KEY (provision_id, code_id) REFERENCES legislation.legal_provisions(id, code_id);


--
-- Name: legal_provisions legal_provisions_code_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legal_provisions
    ADD CONSTRAINT legal_provisions_code_id_fkey FOREIGN KEY (code_id) REFERENCES legislation.legal_codes(id);


--
-- Name: legislative_events legislative_events_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_events
    ADD CONSTRAINT legislative_events_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: legislative_sessions legislative_sessions_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_sessions
    ADD CONSTRAINT legislative_sessions_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: legislative_terms legislative_terms_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_terms
    ADD CONSTRAINT legislative_terms_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: legislative_terms legislative_terms_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_terms
    ADD CONSTRAINT legislative_terms_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: legislative_terms legislative_terms_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.legislative_terms
    ADD CONSTRAINT legislative_terms_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_legislative_session_id_legislative_ses; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organization_memberships
    ADD CONSTRAINT organization_memberships_legislative_session_id_legislative_ses FOREIGN KEY (legislative_session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: organization_memberships organization_memberships_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organization_memberships
    ADD CONSTRAINT organization_memberships_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_memberships organization_memberships_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organization_memberships
    ADD CONSTRAINT organization_memberships_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organizations
    ADD CONSTRAINT organizations_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: organizations organizations_parent_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.organizations
    ADD CONSTRAINT organizations_parent_organization_id_organizations_id_fk FOREIGN KEY (parent_organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: people people_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.people
    ADD CONSTRAINT people_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: person_aliases person_aliases_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_aliases
    ADD CONSTRAINT person_aliases_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: person_details person_details_person_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_details
    ADD CONSTRAINT person_details_person_id_fkey FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: person_external_identifiers person_external_identifiers_person_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_external_identifiers
    ADD CONSTRAINT person_external_identifiers_person_id_fkey FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: person_jurisdictions person_jurisdictions_jurisdiction_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_jurisdictions
    ADD CONSTRAINT person_jurisdictions_jurisdiction_id_fkey FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: person_jurisdictions person_jurisdictions_person_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.person_jurisdictions
    ADD CONSTRAINT person_jurisdictions_person_id_fkey FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE CASCADE;


--
-- Name: regulatory_document_observations regulatory_document_observati_generation_id_source_id_juri_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observati_generation_id_source_id_juri_fkey FOREIGN KEY (generation_id, source_id, jurisdiction_id, rights_profile_id) REFERENCES legislation.legal_import_generations(id, source_id, jurisdiction_id, rights_profile_id);


--
-- Name: regulatory_document_observations regulatory_document_observations_document_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observations_document_id_fkey FOREIGN KEY (document_id) REFERENCES legislation.regulatory_documents(id);


--
-- Name: regulatory_document_observations regulatory_document_observations_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observations_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.regulatory_publication_batches(generation_id);


--
-- Name: regulatory_document_observations regulatory_document_observations_version_id_document_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_observations
    ADD CONSTRAINT regulatory_document_observations_version_id_document_id_fkey FOREIGN KEY (version_id, document_id) REFERENCES legislation.regulatory_document_versions(id, document_id);


--
-- Name: regulatory_document_versions regulatory_document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_versions
    ADD CONSTRAINT regulatory_document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES legislation.regulatory_documents(id);


--
-- Name: regulatory_document_versions regulatory_document_versions_pdf_hash_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_document_versions
    ADD CONSTRAINT regulatory_document_versions_pdf_hash_fkey FOREIGN KEY (pdf_hash) REFERENCES legislation.legal_artifacts(hash);


--
-- Name: regulatory_documents regulatory_documents_jurisdiction_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_documents
    ADD CONSTRAINT regulatory_documents_jurisdiction_id_fkey FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id);


--
-- Name: regulatory_publication_batches regulatory_publication_batches_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_batches
    ADD CONSTRAINT regulatory_publication_batches_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: regulatory_publication_outbox regulatory_publication_outbox_observation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_publication_outbox
    ADD CONSTRAINT regulatory_publication_outbox_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES legislation.regulatory_document_observations(id);


--
-- Name: regulatory_source_documents regulatory_source_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_documents
    ADD CONSTRAINT regulatory_source_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES legislation.regulatory_documents(id);


--
-- Name: regulatory_source_documents regulatory_source_documents_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_documents
    ADD CONSTRAINT regulatory_source_documents_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.regulatory_source_inventories(generation_id);


--
-- Name: regulatory_source_documents regulatory_source_documents_generation_id_record_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_documents
    ADD CONSTRAINT regulatory_source_documents_generation_id_record_key_fkey FOREIGN KEY (generation_id, record_key) REFERENCES legislation.legal_import_records(generation_id, record_key);


--
-- Name: regulatory_source_inventories regulatory_source_inventories_generation_id_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_inventories
    ADD CONSTRAINT regulatory_source_inventories_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES legislation.legal_import_generations(id);


--
-- Name: regulatory_source_renditions regulatory_source_renditions_generation_id_record_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_renditions
    ADD CONSTRAINT regulatory_source_renditions_generation_id_record_key_fkey FOREIGN KEY (generation_id, record_key) REFERENCES legislation.regulatory_source_documents(generation_id, record_key);


--
-- Name: regulatory_source_reviews regulatory_source_reviews_generation_id_record_key_fkey; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.regulatory_source_reviews
    ADD CONSTRAINT regulatory_source_reviews_generation_id_record_key_fkey FOREIGN KEY (generation_id, record_key) REFERENCES legislation.regulatory_source_documents(generation_id, record_key);


--
-- Name: subscription_deliveries subscription_deliveries_subscription_id_subscriptions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscription_deliveries
    ADD CONSTRAINT subscription_deliveries_subscription_id_subscriptions_id_fk FOREIGN KEY (subscription_id) REFERENCES legislation.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_change_event_id_change_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscription_events
    ADD CONSTRAINT subscription_events_change_event_id_change_events_id_fk FOREIGN KEY (change_event_id) REFERENCES legislation.change_events(id) ON DELETE SET NULL;


--
-- Name: subscription_events subscription_events_subscription_id_subscriptions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.subscription_events
    ADD CONSTRAINT subscription_events_subscription_id_subscriptions_id_fk FOREIGN KEY (subscription_id) REFERENCES legislation.subscriptions(id) ON DELETE CASCADE;


--
-- Name: supporting_material_links supporting_material_links_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_links
    ADD CONSTRAINT supporting_material_links_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE CASCADE;


--
-- Name: supporting_material_links supporting_material_links_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_links
    ADD CONSTRAINT supporting_material_links_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: supporting_material_links supporting_material_links_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_links
    ADD CONSTRAINT supporting_material_links_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE CASCADE;


--
-- Name: supporting_material_links supporting_material_links_material_id_supporting_materials_id_f; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_links
    ADD CONSTRAINT supporting_material_links_material_id_supporting_materials_id_f FOREIGN KEY (material_id) REFERENCES legislation.supporting_materials(id) ON DELETE CASCADE;


--
-- Name: supporting_material_links supporting_material_links_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_links
    ADD CONSTRAINT supporting_material_links_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE CASCADE;


--
-- Name: supporting_material_section_embeddings supporting_material_section_embeddings_section_id_supporting_ma; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_section_embeddings
    ADD CONSTRAINT supporting_material_section_embeddings_section_id_supporting_ma FOREIGN KEY (section_id) REFERENCES legislation.supporting_material_sections(id) ON DELETE CASCADE;


--
-- Name: supporting_material_sections supporting_material_sections_material_id_supporting_materials_i; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_material_sections
    ADD CONSTRAINT supporting_material_sections_material_id_supporting_materials_i FOREIGN KEY (material_id) REFERENCES legislation.supporting_materials(id) ON DELETE CASCADE;


--
-- Name: supporting_materials supporting_materials_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_materials
    ADD CONSTRAINT supporting_materials_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES legislation.jurisdictions(id) ON DELETE RESTRICT;


--
-- Name: supporting_materials supporting_materials_session_id_legislative_sessions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.supporting_materials
    ADD CONSTRAINT supporting_materials_session_id_legislative_sessions_id_fk FOREIGN KEY (session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: vote_positions vote_positions_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.vote_positions
    ADD CONSTRAINT vote_positions_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES legislation.people(id) ON DELETE RESTRICT;


--
-- Name: vote_positions vote_positions_vote_id_votes_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.vote_positions
    ADD CONSTRAINT vote_positions_vote_id_votes_id_fk FOREIGN KEY (vote_id) REFERENCES legislation.votes(id) ON DELETE CASCADE;


--
-- Name: votes votes_amendment_id_amendments_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_amendment_id_amendments_id_fk FOREIGN KEY (amendment_id) REFERENCES legislation.amendments(id) ON DELETE SET NULL;


--
-- Name: votes votes_bill_id_bills_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_bill_id_bills_id_fk FOREIGN KEY (bill_id) REFERENCES legislation.bills(id) ON DELETE CASCADE;


--
-- Name: votes votes_event_id_legislative_events_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_event_id_legislative_events_id_fk FOREIGN KEY (event_id) REFERENCES legislation.legislative_events(id) ON DELETE SET NULL;


--
-- Name: votes votes_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES legislation.organizations(id) ON DELETE RESTRICT;


--
-- Name: votes votes_session_id_legislative_sessions_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.votes
    ADD CONSTRAINT votes_session_id_legislative_sessions_id_fk FOREIGN KEY (session_id) REFERENCES legislation.legislative_sessions(id) ON DELETE RESTRICT;


--
-- Name: webhook_audit_records webhook_audit_records_webhook_id_webhooks_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhook_audit_records
    ADD CONSTRAINT webhook_audit_records_webhook_id_webhooks_id_fk FOREIGN KEY (webhook_id) REFERENCES legislation.webhooks(id) ON DELETE CASCADE;


--
-- Name: webhook_signing_keys webhook_signing_keys_webhook_id_webhooks_id_fk; Type: FK CONSTRAINT; Schema: legislation; Owner: -
--

ALTER TABLE ONLY legislation.webhook_signing_keys
    ADD CONSTRAINT webhook_signing_keys_webhook_id_webhooks_id_fk FOREIGN KEY (webhook_id) REFERENCES legislation.webhooks(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
