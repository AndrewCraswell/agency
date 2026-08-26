import { describe, expect, it, vi } from "vitest"
import type { LegislationDatabase } from "../db/database.js"
import type { CalendarRow } from "../db/queries/calendar-read.js"
import type { MeetingListInput, MeetingPage } from "../db/queries/meeting-read.js"
import { createCalendarReadRepository } from "./calendar-read-repository.js"

const mocks = vi.hoisted(() => ({
  getCalendarRead: vi.fn<(database: LegislationDatabase, calendarId: string) => Promise<CalendarRow>>(),
  listMeetings: vi.fn<(database: LegislationDatabase, input: MeetingListInput) => Promise<MeetingPage>>()
}))

vi.mock("../db/queries/calendar-read.js", () => ({
  assertCalendarExists: vi.fn<() => Promise<void>>(),
  getCalendarRead: mocks.getCalendarRead,
  listCalendars: vi.fn<() => Promise<never>>()
}))

vi.mock("../db/queries/meeting-read.js", () => ({
  listMeetings: mocks.listMeetings
}))

const calendar = {
  id: "calendar:wa:committee-schedule",
  jurisdictionId: "jurisdiction:wa",
  timezone: "America/Los_Angeles"
} as CalendarRow

describe("calendar read repository", () => {
  it("passes the selected calendar timezone to date-only child meeting reads", async () => {
    mocks.getCalendarRead.mockResolvedValue(calendar)
    mocks.listMeetings.mockResolvedValue({ items: [], truncated: false })
    const repository = createCalendarReadRepository({} as LegislationDatabase)

    await repository.listCalendarMeetings({
      calendarId: calendar.id,
      from: "2026-03-08",
      limit: 25,
      to: "2026-03-08"
    })

    expect(mocks.listMeetings).toHaveBeenCalledWith(
      {},
      {
        calendarId: calendar.id,
        dateTimezone: "America/Los_Angeles",
        from: "2026-03-08",
        jurisdictionId: "jurisdiction:wa",
        limit: 25,
        to: "2026-03-08"
      }
    )
  })
})
