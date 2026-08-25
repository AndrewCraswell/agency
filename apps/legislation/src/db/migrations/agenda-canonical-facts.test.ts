import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(new URL("./0028_agenda-canonical-facts.sql", import.meta.url), "utf8")

describe("agenda canonical facts migration", () => {
  it("adds nullable canonical fields with fail-closed completeness defaults", () => {
    const linkBackfill = migration.indexOf('INSERT INTO "legislation"."event_agenda_item_bills"')
    const legacyColumnDrop = migration.indexOf('DROP COLUMN "bill_id"')

    expect(linkBackfill).toBeGreaterThan(migration.indexOf('CREATE TABLE "legislation"."event_agenda_item_bills"'))
    expect(linkBackfill).toBeLessThan(legacyColumnDrop)
    expect(migration).toContain('WHERE "bill_id" IS NOT NULL')
    expect(migration).toContain("ON CONFLICT DO NOTHING")
    expect(migration).toContain('DROP CONSTRAINT "event_agenda_items_bill_id_bills_id_fk"')
    expect(migration).toContain('DROP INDEX "legislation"."event_agenda_items_bill_idx"')
    expect(migration).toContain('DROP COLUMN "bill_id"')
    expect(migration).toContain('ALTER COLUMN "description" DROP NOT NULL')
    expect(migration).toContain('ADD COLUMN "title" text')
    expect(migration).toContain('ADD COLUMN "status" text')
    expect(migration).toContain('"canonical_facts_complete" boolean DEFAULT false NOT NULL')
    expect(migration).toContain('"bill_relations_complete" boolean DEFAULT false NOT NULL')
    expect(migration).toContain('"amendment_relations_complete" boolean DEFAULT false NOT NULL')
    expect(migration).toContain('"material_relations_complete" boolean DEFAULT false NOT NULL')
    expect(migration).toContain('"event_agenda_items_canonical_facts_check"')
  })

  it("creates explicit relation tables rather than deriving agenda relationships", () => {
    expect(migration).toContain('CREATE TABLE "legislation"."event_agenda_item_bills"')
    expect(migration).toContain('CREATE TABLE "legislation"."event_agenda_item_amendments"')
    expect(migration).toContain('CREATE TABLE "legislation"."event_agenda_item_supporting_materials"')
    expect(migration).toContain("ON DELETE cascade")
  })
})
