import { handleLegalBrowseRequest } from "../../../../../modules/request-handling/next/legal-route-handler"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return handleLegalBrowseRequest(request)
}
