import { NextResponse, type NextRequest } from "next/server"
import { jsonResponse, notFoundResponse, requestCorrelationId } from "./response"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: NextRequest): NextResponse {
  return jsonResponse(requestCorrelationId(request), 200, { status: "ok" })
}

export function DELETE(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function HEAD(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function OPTIONS(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function PATCH(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function POST(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function PUT(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}
