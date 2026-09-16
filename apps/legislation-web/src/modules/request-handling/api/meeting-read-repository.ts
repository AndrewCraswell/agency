import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { jurisdictions, legislativeSessions, organizations } from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { eq } from "drizzle-orm"
import {
  getMeetingRead,
  listMeetings,
  listMeetingOrganizations,
  type MeetingListInput,
  type MeetingOrganizationRead,
  type MeetingPage,
  type MeetingRead
} from "../../legislation/persistence/queries/meeting-read.js"

export type MeetingCollectionInput = MeetingListInput
export type MeetingCollectionPage = MeetingPage

export interface MeetingReadRepository {
  assertJurisdictionExists(jurisdictionId: string): Promise<void>
  assertOrganizationExists(organizationId: string): Promise<void>
  assertSessionExists(sessionId: string): Promise<void>
  getMeetingRead(meetingId: string): Promise<MeetingRead>
  listMeetingOrganizations(meetingId: string): Promise<MeetingOrganizationRead[]>
  listMeetings(input: MeetingCollectionInput): Promise<MeetingCollectionPage>
}

export function createMeetingReadRepository(database: LegislationDatabase): MeetingReadRepository {
  return {
    assertJurisdictionExists: async (id) => await assertExists(database, jurisdictions, id, "Jurisdiction"),
    assertOrganizationExists: async (id) => await assertExists(database, organizations, id, "Organization"),
    assertSessionExists: async (id) => await assertExists(database, legislativeSessions, id, "Session"),
    getMeetingRead: async (id) => await getMeetingRead(database, id),
    listMeetingOrganizations: async (id) => await listMeetingOrganizations(database, id),
    listMeetings: async (input) => await listMeetings(database, input)
  }
}

async function assertExists(
  database: LegislationDatabase,
  table: typeof jurisdictions | typeof legislativeSessions | typeof organizations,
  value: string,
  label: string
): Promise<void> {
  const id = requiredId(value, `${label[0]?.toLowerCase()}${label.slice(1)}Id`)
  const rows = await database.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1)
  if (rows[0] === undefined) {
    throw new LegislationError("not_found", `${label} ${id} was not found`)
  }
}

function requiredId(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}
