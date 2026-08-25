import { randomUUID } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

const jsonContentType = "application/json; charset=utf-8"

export function requestCorrelationId(request: NextRequest): string {
  return request.headers.get("x-correlation-id") ?? randomUUID()
}

export function jsonResponse(
  correlationId: string,
  status: number,
  body: Readonly<Record<string, unknown>>
): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "content-type": jsonContentType,
      "x-correlation-id": correlationId
    },
    status
  })
}

export function notFoundResponse(request: NextRequest): NextResponse {
  return jsonResponse(requestCorrelationId(request), 404, { error: "not_found" })
}
