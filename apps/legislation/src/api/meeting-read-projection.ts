import type { MeetingRead } from "../db/queries/meeting-read.js"
import type { EventLocationPayload, EventVirtualAccessPayload } from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"
import { projectMeetingSummary } from "./canonical-projection.js"

export function projectMeetingRead(read: MeetingRead, apiBaseUrl: string) {
  const source = completeSource(read)
  return projectMeetingSummary(
    {
      calendarId: null,
      classification: classification(read.classification),
      date: requiredText(read.publisherLocalDate, "meeting publisherLocalDate"),
      description: nullableText(read.description, "meeting description"),
      endsAt: read.endAt,
      id: requiredText(read.id, "meeting ID"),
      isRemote: requiredBoolean(read.isRemote, "meeting isRemote"),
      jurisdictionId: requiredText(read.jurisdictionId, "meeting jurisdictionId"),
      location: location(read.location, read.virtualAccess),
      organizationIds: read.organizationIds,
      sessionIds: read.sessionIds,
      sourceUrl: source.sourceUrl,
      startsAt: read.startAt,
      status: status(read.status),
      title: requiredText(read.name, "meeting title")
    },
    {
      apiBaseUrl,
      sources: [source],
      updatedAt: read.updatedAt
    }
  )
}

function completeSource(read: MeetingRead) {
  if (
    !isText(read.sourceProvider) ||
    !isText(read.sourceUrl) ||
    !read.sourceUrl.startsWith("https://") ||
    read.sourceRetrievedAt === null ||
    typeof read.sourceIsOfficial !== "boolean"
  ) {
    throw new LegislationError("unprocessable", "meeting canonical provenance is incomplete")
  }
  return {
    isOfficial: read.sourceIsOfficial,
    provider: read.sourceProvider,
    retrievedAt: read.sourceRetrievedAt,
    sourceUpdatedAt: read.sourceUpdatedAt,
    sourceUrl: read.sourceUrl
  }
}

function location(value: EventLocationPayload | null, virtual: EventVirtualAccessPayload | null) {
  if (value === null && virtual === null) {
    return null
  }
  return {
    address: optionalText(value?.address),
    name: optionalText(value?.name),
    room: optionalText(value?.room),
    virtualUrl: optionalText(virtual?.url)
  }
}

function classification(value: string | null): "hearing" | "meeting" | "other" | "session" {
  if (value === "hearing" || value === "meeting" || value === "other" || value === "session") {
    return value
  }
  throw new LegislationError("unprocessable", "meeting classification is not canonical")
}

function status(value: string): "cancelled" | "completed" | "other" | "postponed" | "scheduled" {
  if (["cancelled", "completed", "other", "postponed", "scheduled"].includes(value)) {
    return value as "cancelled" | "completed" | "other" | "postponed" | "scheduled"
  }
  throw new LegislationError("unprocessable", "meeting status is not canonical")
}

function requiredText(value: string | null, name: string): string {
  if (!isText(value)) {
    throw new LegislationError("unprocessable", `${name} must be non-empty`)
  }
  return value
}

function nullableText(value: string | null, name: string): string | null {
  return value === null ? null : requiredText(value, name)
}

function optionalText(value: unknown): string | null {
  return isText(value) ? value : null
}

function requiredBoolean(value: boolean | null, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new LegislationError("unprocessable", `${name} must be boolean`)
  }
  return value
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
