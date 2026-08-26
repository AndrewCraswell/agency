import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(new URL("./0041_calendar-foundation.sql", import.meta.url), "utf8")
const journal = JSON.parse(readFileSync(new URL("./meta/_journal.json", import.meta.url), "utf8")) as {
  entries: Array<{ idx: number; tag: string }>
}
const schema = readFileSync(new URL("../schema/schema.ts", import.meta.url), "utf8")

describe("calendar foundation migration", () => {
  it("is registered immediately after the webhook audit migration", () => {
    const calendarIndex = journal.entries.findIndex((entry) => entry.tag === "0041_calendar-foundation")

    expect(calendarIndex).toBeGreaterThan(0)
    expect(journal.entries.at(calendarIndex - 1)).toMatchObject({ idx: 40, tag: "0040_webhook-mutation-audit" })
    expect(journal.entries.at(calendarIndex)).toMatchObject({ idx: 41, tag: "0041_calendar-foundation" })
  })

  it("matches the calendar schema's parents, provenance gates, and keyset indexes", () => {
    expect(migration).toContain('REFERENCES "legislation"."jurisdictions"("id") ON DELETE restrict')
    expect(migration).toContain('REFERENCES "legislation"."organizations"("id") ON DELETE restrict')
    expect(migration).toContain('REFERENCES "legislation"."calendars"("id") ON DELETE cascade')
    expect(migration).toContain('REFERENCES "legislation"."legislative_events"("id") ON DELETE cascade')
    expect(migration).toContain('"calendars_coverage_bounds_check"')
    expect(migration).toContain('"calendar_events_source_url_check"')
    expect(migration).toContain('CREATE INDEX "calendars_name_idx"')
    expect(migration).toContain('CREATE INDEX "calendars_browse_idx"')
    expect(migration).toContain('CREATE INDEX "calendars_organization_idx"')
    expect(migration).toContain('CREATE INDEX "calendar_events_event_idx"')
    expect(schema).toContain('index("calendars_name_idx").on(table.name, table.id)')
    expect(schema).toContain(
      'index("calendars_browse_idx").on(table.jurisdictionId, table.organizationId, table.name, table.id)'
    )
  })
})
