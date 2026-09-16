import { handleMeetingCalendarRequest } from "../../../../../modules/request-handling/next/meeting-calendar-route-handler"
import { notFoundResponse } from "../../../_shared"

export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  return await handleMeetingCalendarRequest(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function HEAD(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function OPTIONS(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function PATCH(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function POST(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function PUT(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}
