import { eq } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import {
  assertCalendarExists as assertPersistedCalendarExists,
  getCalendarRead as getPersistedCalendarRead,
  listCalendars as listPersistedCalendars,
  type CalendarListInput as CalendarQueryInput,
  type CalendarPage as CalendarQueryPage,
  type CalendarRow
} from "../db/queries/calendar-read.js"
import { listMeetings, type MeetingPage } from "../db/queries/meeting-read.js"
import { organizations } from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"
import type { DateValue, ProjectionSourceInput } from "./canonical-projection.js"

export interface CalendarRead {
  id: string
  jurisdictionId: string
  organizationId: string | null
  name: string
  classification: string
  timezone: string | null
  sourceUrl: string
  isActive: boolean
  description: string | null
  coverageFrom: DateValue | null
  coverageTo: DateValue | null
  updatedAt: DateValue
  sources: readonly [ProjectionSourceInput, ...ProjectionSourceInput[]]
}

export type CalendarListInput = CalendarQueryInput & { limit: number }

export interface CalendarMeetingListInput {
  calendarId: string
  cursor?: string
  from?: string
  limit: number
  sort?: "starts-asc" | "starts-desc"
  status?: "cancelled" | "completed" | "other" | "postponed" | "scheduled"
  to?: string
}

export interface CalendarPage {
  items: CalendarRead[]
  nextCursor?: string
  truncated: boolean
  warnings?: readonly string[]
}

export interface CalendarReadRepository {
  assertCalendarExists(calendarId: string): Promise<void>
  assertOrganizationExists(organizationId: string): Promise<void>
  getCalendarRead(calendarId: string): Promise<CalendarRead>
  listCalendarMeetings(input: CalendarMeetingListInput): Promise<MeetingPage>
  listCalendars(input: CalendarListInput): Promise<CalendarPage>
}

export function createCalendarReadRepository(database: LegislationDatabase): CalendarReadRepository {
  return {
    assertCalendarExists: async (calendarId) => await assertPersistedCalendarExists(database, calendarId),
    assertOrganizationExists: async (organizationId) => await assertOrganizationExists(database, organizationId),
    getCalendarRead: async (calendarId) => toCalendarRead(await getPersistedCalendarRead(database, calendarId)),
    listCalendarMeetings: async (input) => {
      const calendar = await getPersistedCalendarRead(database, input.calendarId)
      return await listMeetings(database, {
        ...input,
        dateTimezone: calendar.timezone,
        jurisdictionId: calendar.jurisdictionId
      })
    },
    listCalendars: async (input) => mapPage(await listPersistedCalendars(database, input))
  }
}

async function assertOrganizationExists(database: LegislationDatabase, organizationId: string): Promise<void> {
  const id = requiredId(organizationId, "organizationId")
  const rows = await database
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1)
  if (rows[0] === undefined) {
    throw new LegislationError("not_found", `Organization ${id} was not found`)
  }
}

function requiredId(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0 || normalized.length > 256) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and 256 characters`)
  }
  return normalized
}

function mapPage(page: CalendarQueryPage<CalendarRow>): CalendarPage {
  return { ...page, items: page.items.map(toCalendarRead) }
}

function toCalendarRead(row: CalendarRow): CalendarRead {
  return {
    classification: row.classification,
    coverageFrom: row.coverageFrom,
    coverageTo: row.coverageTo,
    description: row.description,
    id: row.id,
    isActive: row.isActive,
    jurisdictionId: row.jurisdictionId,
    name: row.name,
    organizationId: row.organizationId,
    sourceUrl: row.sourceUrl,
    sources: [
      {
        isOfficial: row.sourceIsOfficial,
        provider: row.sourceProvider,
        retrievedAt: row.sourceRetrievedAt,
        sourceUpdatedAt: row.sourceUpdatedAt,
        sourceUrl: row.sourceUrl
      }
    ],
    timezone: row.timezone,
    updatedAt: row.updatedAt
  }
}
