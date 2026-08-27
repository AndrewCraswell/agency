import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(new URL("./0044_committee_membership_detection.sql", import.meta.url), "utf8")
const journal = JSON.parse(readFileSync(new URL("./meta/_journal.json", import.meta.url), "utf8")) as {
  entries: Array<{ idx: number; tag: string }>
}

describe("committee membership detection migration", () => {
  it("is registered after membership tenure identity", () => {
    const index = journal.entries.findIndex((entry) => entry.tag === "0044_committee_membership_detection")

    expect(journal.entries.at(index - 1)).toMatchObject({ idx: 43, tag: "0043_membership_tenures" })
    expect(journal.entries.at(index)).toMatchObject({ idx: 44, tag: "0044_committee_membership_detection" })
  })

  it("separates effective dates from detected dates and scopes tenures to sessions", () => {
    expect(migration).toContain(
      "CREATE TYPE \"legislation\".\"organization_membership_end_reason\" AS ENUM('roster_removal_detected', 'congress_ended')"
    )
    expect(migration).toContain('RENAME COLUMN "start_date" TO "effective_start_date"')
    expect(migration).toContain('RENAME COLUMN "end_date" TO "effective_end_date"')
    expect(migration).toContain('ADD COLUMN "legislative_session_id" text')
    expect(migration).toContain('ADD COLUMN "detected_start_date" date')
    expect(migration).toContain('ADD COLUMN "detected_end_date" date')
    expect(migration).toContain('ADD COLUMN "last_observed_date" date')
    expect(migration).toContain('ADD COLUMN "ended_reason"')
    expect(migration).toContain('"organization_memberships_roster_removal_check"')
    expect(migration).toContain('"organization_memberships_congress_end_check"')
    expect(migration).toContain('CREATE UNIQUE INDEX "organization_memberships_session_tenure_uidx"')
  })
})
