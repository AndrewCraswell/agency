import { handleLegalPassageRequest } from "../../../../../../modules/request-handling/next/legal-route-handler"
import { notFoundResponse } from "../../../../_shared"

export const runtime = "nodejs"
export async function GET(request: Request) {
  return handleLegalPassageRequest(request)
}
export async function DELETE(request: Request) {
  return notFoundResponse(request)
}
export async function HEAD(request: Request) {
  return notFoundResponse(request)
}
export async function OPTIONS(request: Request) {
  return notFoundResponse(request)
}
export async function PATCH(request: Request) {
  return notFoundResponse(request)
}
export async function POST(request: Request) {
  return notFoundResponse(request)
}
export async function PUT(request: Request) {
  return notFoundResponse(request)
}
