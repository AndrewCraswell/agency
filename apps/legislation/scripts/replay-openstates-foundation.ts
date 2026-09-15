import assert from "node:assert/strict"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../src/db/database.js"
import { jurisdictions, organizationMemberships, organizations } from "../src/db/schema/schema.js"
import { LocalArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { importCommitteeRepository } from "../src/ingestion/openstates/committee-import.js"
import { validatePeopleArchivePair } from "../src/ingestion/openstates/people-archive-pair.js"
import { importPeopleRepository } from "../src/ingestion/openstates/people-import.js"
import { readArchivedPeoplePilot } from "../src/ingestion/openstates/pilot-archive.js"

// Explicitly isolated local replay. Never accepts a production database or drops a schema.
const [directory, currentManifest, historyManifest] = process.argv.slice(2)
if (!directory || !currentManifest || !historyManifest || process.argv.length !== 5) {
  throw new Error("Usage: replay-openstates-foundation <archive-directory> <current-manifest> <history-manifest>")
}
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!url) {
  throw new Error("LEGISLATION_TEST_DATABASE_URL is required")
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Replay target must be local legislation_test")
}
const store = new LocalArtifactStore(directory)
const current = await readArchivedPeoplePilot(store, currentManifest)
const history = await readArchivedPeoplePilot(store, historyManifest)
const pair = validatePeopleArchivePair(current, history)
const { database, pool } = createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 10000 })
try {
  await migrate(database, {
    migrationsFolder: "src/db/migrations",
    migrationsSchema: "legislation_migrations",
    migrationsTable: "migrations"
  })
  await database
    .insert(jurisdictions)
    .values({
      id: `jurisdiction:${pair.state}`,
      name: pair.state === "ak" ? "Alaska" : "North Carolina",
      classification: "state",
      countryCode: "US",
      subdivisionCode: pair.state.toUpperCase()
    })
    .onConflictDoNothing()
  const people = await importPeopleRepository(database, pair.state, current.files, history.files, pair.retrievedAt)
  const committees = await importCommitteeRepository(
    database,
    pair.state,
    current.files,
    history.files,
    pair.retrievedAt
  )
  const readMemberships = () =>
    database
      .select({
        id: organizationMemberships.id,
        personId: organizationMemberships.personId,
        organizationId: organizationMemberships.organizationId,
        tenure: organizationMemberships.tenureOrdinal
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
      .where(eq(organizations.jurisdictionId, `jurisdiction:${pair.state}`))
      .orderBy(organizationMemberships.id)
  const first = await readMemberships()
  await importCommitteeRepository(database, pair.state, current.files, history.files, pair.retrievedAt)
  assert.deepEqual(await readMemberships(), first, "Committee replay changed canonical membership identities")
  process.stdout.write(
    `${JSON.stringify({ state: pair.state, people: people.counts, committeeStatus: committees.status, eligibleCommittees: committees.plan.eligible.length, eligibleMemberships: committees.plan.eligibleMemberships, heldCommittees: committees.plan.held.length, heldMemberships: committees.plan.heldMemberships, stableReplay: true, productionWrites: false })}\n`
  )
} finally {
  await pool.end()
}
