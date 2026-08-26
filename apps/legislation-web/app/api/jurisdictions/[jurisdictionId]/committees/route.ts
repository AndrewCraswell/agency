import { handleNx02Request } from "legislation/server/next/nx02"
import { notFoundResponse } from "../../../_shared"

export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  return await handleNx02Request(request)
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
