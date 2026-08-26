import { handleNx03bRequest } from "legislation/server/next/nx03b"
import { notFoundResponse } from "../../_shared"

export const runtime = "nodejs"

export async function DELETE(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function GET(request: Request): Promise<Response> {
  return await handleNx03bRequest(request)
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
