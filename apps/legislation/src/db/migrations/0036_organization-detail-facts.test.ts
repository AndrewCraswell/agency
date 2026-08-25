import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(new URL("./0036_organization-detail-facts.sql", import.meta.url), "utf8")

describe("organization detail facts migration", () => {
  it("adds nullable profile facts and fail-closed completeness flags idempotently", () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "description" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "website_url" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "public_contact_address" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "public_contact_phone" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "public_contact_email" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "terms_of_reference" text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "detail_facts_complete" boolean NOT NULL DEFAULT false')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "child_relations_complete" boolean NOT NULL DEFAULT false')
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS "membership_relations_complete" boolean NOT NULL DEFAULT false'
    )
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "organizations_website_url_check"')
    expect(migration).toContain('CHECK ("website_url" IS NULL OR "website_url" ~ \'^https://\')')
  })
})
