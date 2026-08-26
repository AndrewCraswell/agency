import { handleNx05aRequest } from "../../../../../src/server/next/nx05a"
import { notFoundResponse } from "../../../_shared"

export const runtime = "nodejs"

export async function DELETE(request: Request): Promise<Response> {
  return await notFoundResponse(request)
}

export async function GET(request: Request): Promise<Response> {
  return await handleNx05aRequest(request)
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
