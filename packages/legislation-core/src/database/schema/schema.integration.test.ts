import { fileURLToPath } from "node:url"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { isDatabaseAvailable, isDatabaseReady } from "../readiness.js"
import * as schema from "./schema.js"

const databaseUrl = process.env.LEGISLATION_CORE_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url))
const contentHash = "a".repeat(64)

if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/legislation_core_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("LEGISLATION_CORE_TEST_DATABASE_URL must target a local disposable legislation_core_test database")
  }
}

describePostgres.sequential("legislation PostgreSQL schema", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("installs pgvector and creates each pinned embedding dimension", async () => {
    await expect(isDatabaseAvailable(pool)).resolves.toBe(true)
    await expect(isDatabaseReady(pool)).resolves.toBe(true)

    const result = await pool.query<{ column_type: string; table_name: string }>(
      "select c.relname as table_name, format_type(a.atttypid, a.atttypmod) as column_type from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'legislation' and c.relname in ('bill_embeddings', 'document_section_embeddings', 'amendment_embeddings', 'supporting_material_section_embeddings') and a.attname = 'embedding' order by c.relname"
    )

    expect(result.rows).toEqual([
      { column_type: "vector(1536)", table_name: "amendment_embeddings" },
      { column_type: "vector(1024)", table_name: "bill_embeddings" },
      { column_type: "vector(1536)", table_name: "document_section_embeddings" },
      { column_type: "vector(1024)", table_name: "supporting_material_section_embeddings" }
    ])
  })

  it("installs nullable canonical facts and fail-closed completeness defaults", async () => {
    const result = await pool.query<{
      table_name: string
      column_name: string
      is_nullable: string
      column_default: string | null
      data_type: string
    }>(
      `select table_name, column_name, is_nullable, column_default, data_type
       from information_schema.columns
       where table_schema = 'legislation'
         and table_name in ('organizations', 'event_agenda_items', 'organization_memberships')`
    )
    for (const [tableName, columnNames] of [
      [
        "organizations",
        [
          "description",
          "website_url",
          "public_contact_address",
          "public_contact_phone",
          "public_contact_email",
          "terms_of_reference"
        ]
      ],
      ["event_agenda_items", ["description", "title", "status"]]
    ] as const) {
      for (const columnName of columnNames) {
        expect(result.rows).toContainEqual({
          table_name: tableName,
          column_name: columnName,
          is_nullable: "YES",
          column_default: null,
          data_type: "text"
        })
      }
    }
    for (const [tableName, columnNames] of [
      ["organizations", ["detail_facts_complete", "child_relations_complete", "membership_relations_complete"]],
      [
        "event_agenda_items",
        [
          "canonical_facts_complete",
          "bill_relations_complete",
          "amendment_relations_complete",
          "material_relations_complete"
        ]
      ]
    ] as const) {
      for (const columnName of columnNames) {
        expect(result.rows).toContainEqual({
          table_name: tableName,
          column_name: columnName,
          is_nullable: "NO",
          column_default: "false",
          data_type: "boolean"
        })
      }
    }
    const membershipDates = result.rows
      .filter((column) => column.table_name === "organization_memberships" && column.data_type === "date")
      .map((column) => column.column_name)
      .sort()
    expect(membershipDates).toEqual([
      "detected_end_date",
      "detected_start_date",
      "effective_end_date",
      "effective_start_date",
      "last_observed_date"
    ])
    expect(
      result.rows.some((column) => column.table_name === "event_agenda_items" && column.column_name === "bill_id")
    ).toBe(false)
  })

  it("installs calendar keyset indexes and session-scoped membership identity", async () => {
    const result = await pool.query<{ name: string; unique: boolean; columns: string[] }>(
      `select index_relation.relname as name, definition.indisunique as unique,
              array_agg(attribute.attname::text order by key.ordinality) as columns
       from pg_index definition
       join pg_class index_relation on index_relation.oid = definition.indexrelid
       join pg_namespace namespace on namespace.oid = index_relation.relnamespace
       cross join lateral unnest(definition.indkey) with ordinality as key(attribute_number, ordinality)
       join pg_attribute attribute on attribute.attrelid = definition.indrelid
         and attribute.attnum = key.attribute_number
       where namespace.nspname = 'legislation' and definition.indisvalid and definition.indisready
         and index_relation.relname = any($1::text[])
       group by index_relation.relname, definition.indisunique order by index_relation.relname`,
      [
        [
          "calendar_events_event_idx",
          "calendars_browse_idx",
          "calendars_name_idx",
          "calendars_organization_idx",
          "organization_memberships_session_tenure_uidx"
        ]
      ]
    )
    expect(result.rows).toEqual([
      { name: "calendar_events_event_idx", unique: false, columns: ["event_id", "calendar_id"] },
      { name: "calendars_browse_idx", unique: false, columns: ["jurisdiction_id", "organization_id", "name", "id"] },
      { name: "calendars_name_idx", unique: false, columns: ["name", "id"] },
      { name: "calendars_organization_idx", unique: false, columns: ["organization_id", "name", "id"] },
      {
        name: "organization_memberships_session_tenure_uidx",
        unique: true,
        columns: ["organization_id", "person_id", "legislative_session_id", "tenure_ordinal"]
      }
    ])
    const reasons = await pool.query<{ label: string }>(
      `select value.enumlabel as label from pg_enum value
       join pg_type enum_type on enum_type.oid = value.enumtypid
       join pg_namespace namespace on namespace.oid = enum_type.typnamespace
       where namespace.nspname = 'legislation' and enum_type.typname = 'organization_membership_end_reason'
       order by value.enumsortorder`
    )
    expect(reasons.rows.map((row) => row.label)).toEqual([
      "roster_removal_detected",
      "congress_ended",
      "historical_at_first_observation"
    ])
  })

  it("installs parent cascade and reference restriction rules for calendars and agenda relations", async () => {
    const result = await pool.query<{ child: string; parent: string; delete_action: string }>(
      `select child.relname as child, parent.relname as parent, relation.confdeltype::text as delete_action
       from pg_constraint relation
       join pg_class child on child.oid = relation.conrelid
       join pg_class parent on parent.oid = relation.confrelid
       join pg_namespace namespace on namespace.oid = child.relnamespace
       where namespace.nspname = 'legislation' and relation.contype = 'f'
         and child.relname = any($1::text[])
       order by child.relname, parent.relname`,
      [
        [
          "calendars",
          "calendar_events",
          "event_agenda_item_bills",
          "event_agenda_item_amendments",
          "event_agenda_item_supporting_materials"
        ]
      ]
    )
    expect(result.rows).toEqual([
      { child: "calendar_events", parent: "calendars", delete_action: "c" },
      { child: "calendar_events", parent: "legislative_events", delete_action: "c" },
      { child: "calendars", parent: "jurisdictions", delete_action: "r" },
      { child: "calendars", parent: "organizations", delete_action: "r" },
      { child: "event_agenda_item_amendments", parent: "amendments", delete_action: "r" },
      { child: "event_agenda_item_amendments", parent: "event_agenda_items", delete_action: "c" },
      { child: "event_agenda_item_bills", parent: "bills", delete_action: "r" },
      { child: "event_agenda_item_bills", parent: "event_agenda_items", delete_action: "c" },
      { child: "event_agenda_item_supporting_materials", parent: "event_agenda_items", delete_action: "c" },
      { child: "event_agenda_item_supporting_materials", parent: "supporting_materials", delete_action: "r" }
    ])
  })

  it("persists a canonical bill aggregate and cascades bill-owned records", async () => {
    const jurisdictionId = "jurisdiction:wa"
    const sessionId = "session:wa:2025-2026"
    const billId = "bill:wa:2025-2026:hb:1234"
    const relatedBillId = "bill:wa:2025-2026:sb:5678"
    const personId = "person:openstates:person-1"
    const actionId = `${billId}:action:1`
    const voteId = `${billId}:vote:1`
    const documentId = `${billId}:document:introduced`

    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Washington",
      subdivisionCode: "WA"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "2025-2026",
      jurisdictionId,
      name: "2025-2026 Regular Session"
    })
    await database.insert(schema.bills).values([
      {
        id: billId,
        identifier: "HB 1234",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/hb-1234",
        title: "An act relating to legislative data"
      },
      {
        id: relatedBillId,
        identifier: "SB 5678",
        jurisdictionId,
        sessionId,
        sourceUrl: "https://example.test/sb-5678",
        title: "A companion act relating to legislative data"
      }
    ])
    await database.insert(schema.people).values({ id: personId, jurisdictionId, name: "Representative Example" })
    await database.insert(schema.billSponsors).values({
      billId,
      classification: "primary",
      id: `${billId}:sponsor:1`,
      isPrimary: true,
      name: "Representative Example",
      personId
    })
    await database.insert(schema.billActions).values({
      billId,
      description: "Introduced in the House",
      id: actionId,
      ordinal: 0
    })
    await database.insert(schema.votes).values({ billId, id: voteId, motion: "Passage", yesCount: 50 })
    await database.insert(schema.votePositions).values({ option: "yes", personId, sourceIdentity: personId, voteId })
    await database.insert(schema.billDocuments).values({
      billId,
      classification: "version",
      id: documentId,
      sourceUrl: "https://example.test/hb-1234/text",
      title: "Introduced bill",
      versionCode: "introduced"
    })
    await database.insert(schema.documentSections).values({
      contentHash,
      documentId,
      id: `${documentId}:section:1`,
      ordinal: 0,
      sectionIdentifier: "1",
      sourceEndOffset: 48,
      sourceStartOffset: 0,
      text: "Section 1. This act concerns legislative data."
    })
    await database.insert(schema.billRelations).values({
      billId,
      classification: "companion",
      relatedBillId
    })

    await expect(database.select().from(schema.bills).where(eq(schema.bills.id, billId))).resolves.toHaveLength(1)

    await database.delete(schema.bills).where(eq(schema.bills.id, billId))

    await expect(
      database.select().from(schema.billActions).where(eq(schema.billActions.billId, billId))
    ).resolves.toHaveLength(0)
    await expect(
      database.select().from(schema.billDocuments).where(eq(schema.billDocuments.billId, billId))
    ).resolves.toHaveLength(0)
    await expect(database.select().from(schema.bills).where(eq(schema.bills.id, relatedBillId))).resolves.toHaveLength(
      1
    )
  })

  it("rejects a noncanonical bill identifier", async () => {
    const jurisdictionId = "jurisdiction:invalid-id"
    const sessionId = "session:invalid-id:2026"
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Identifier constraint"
    })
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      identifier: "2026",
      jurisdictionId,
      name: "Identifier constraint 2026"
    })
    const operation = database.insert(schema.bills).values({
      id: "not-canonical",
      identifier: "HB 9999",
      jurisdictionId,
      sessionId,
      sourceUrl: "https://example.test/hb-9999",
      title: "An invalid bill"
    })
    const rejection: unknown = await operation.then(
      () => new Error("Expected the bill identifier constraint to reject the insert"),
      (error: unknown) => error
    )

    expect(rejection).toMatchObject({ cause: { code: "23514", constraint: "bills_id_check" } })
  })

  it("rejects incomplete jurisdiction and session provenance", async () => {
    const jurisdictionId = "jurisdiction:foundation-constraint"
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Foundation constraint"
    })
    await expect(
      database.insert(schema.jurisdictions).values({
        classification: "state",
        countryCode: "US",
        id: "jurisdiction:invalid-provenance",
        isActive: true,
        name: "Invalid provenance",
        provenanceComplete: true,
        sourceIsOfficial: true,
        sourceProvider: " ",
        sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
        sourceUrl: "https://legislature.example.test/invalid"
      })
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "jurisdictions_provenance_complete_check" })
    })
    await expect(
      database.insert(schema.legislativeSessions).values({
        classification: "regular",
        id: "session:foundation:invalid-provenance",
        identifier: "invalid",
        isActive: true,
        jurisdictionId,
        name: "Invalid provenance",
        provenanceComplete: true,
        sourceIsOfficial: true,
        sourceProvider: "official-legislature",
        sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
        sourceUrl: "http://legislature.example.test/invalid"
      })
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        code: "23514",
        constraint: "legislative_sessions_provenance_complete_check"
      })
    })
  })

  it("rejects incomplete civic provenance on canonical records", async () => {
    const jurisdictionId = "jurisdiction:civic-foundation"
    const personId = "person:official:civic-foundation"
    const parentOrganizationId = "organization:official:civic-parent"
    const organizationId = "organization:official:civic-child"
    const termId = `${personId}:term:civic-foundation`
    const membershipId = `${organizationId}:membership:civic-foundation`
    const completeProvenance = {
      isActive: true,
      provenanceComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "official-legislature",
      sourceRetrievedAt: new Date("2026-08-24T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/civic-foundation"
    }
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Civic foundation",
      subdivisionCode: "CF"
    })
    await database.insert(schema.people).values({
      ...completeProvenance,
      id: personId,
      jurisdictionId,
      name: "Civic Person"
    })
    await database.insert(schema.organizations).values([
      {
        ...completeProvenance,
        chamber: "legislature",
        classification: "legislature",
        id: parentOrganizationId,
        jurisdictionId,
        name: "Civic Legislature",
        sourceId: "legislature"
      },
      {
        ...completeProvenance,
        chamber: "lower",
        classification: "committee",
        id: organizationId,
        jurisdictionId,
        name: "Civic Committee",
        parentOrganizationId,
        sourceId: "committee"
      }
    ])
    await database.insert(schema.legislativeTerms).values({
      ...completeProvenance,
      chamber: "lower",
      id: termId,
      jurisdictionId,
      officeTitle: "Representative",
      organizationId,
      personId
    })
    await database.insert(schema.organizationMemberships).values({
      ...completeProvenance,
      id: membershipId,
      label: "Committee member",
      organizationId,
      personId,
      role: "member"
    })

    await expect(
      database
        .update(schema.people)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.people.id, personId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "people_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.people)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.people.id, personId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "people_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.organizations)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.organizations.id, organizationId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "organizations_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.organizations)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.organizations.id, organizationId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "organizations_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.legislativeTerms)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.legislativeTerms.id, termId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "legislative_terms_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.legislativeTerms)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.legislativeTerms.id, termId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "legislative_terms_provenance_complete_check" })
    })
    await expect(
      database
        .update(schema.organizationMemberships)
        .set({ ...completeProvenance, sourceUrl: null })
        .where(eq(schema.organizationMemberships.id, membershipId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        code: "23514",
        constraint: "organization_memberships_provenance_complete_check"
      })
    })
    await expect(
      database
        .update(schema.organizationMemberships)
        .set({ ...completeProvenance, sourceProvider: null })
        .where(eq(schema.organizationMemberships.id, membershipId))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        code: "23514",
        constraint: "organization_memberships_provenance_complete_check"
      })
    })
  })

  it("rejects incomplete supporting-material page ranges", async () => {
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: "jurisdiction:material-search",
      name: "Material page constraint"
    })
    await database.insert(schema.supportingMaterials).values({
      classification: "testimony",
      id: "material:material-search:2026:committee-report:0000",
      jurisdictionId: "jurisdiction:material-search",
      sourceId: "material-page-constraint",
      sourceUrl: "https://example.test/material",
      title: "Page constraint"
    })
    await expect(
      database.insert(schema.supportingMaterialSections).values({
        contentHash: "b".repeat(64),
        id: "material-section:material-search:invalid-page-range",
        materialId: "material:material-search:2026:committee-report:0000",
        ordinal: 1,
        pageStart: 1,
        sourceEndOffset: 1,
        sourceStartOffset: 0,
        text: "x"
      })
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23514", constraint: "supporting_material_sections_pages_check" })
    })
  })
})
