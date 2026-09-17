import { createRecordCollectionHandler } from "../../../../modules/request-handling/api/record-resolution-routes"
import { executeAuthenticatedApiRequest } from "../../../../modules/request-handling/next/authenticated-api-request"
import { getResearchRuntime } from "../../../../modules/search/research-runtime"

export const runtime = "nodejs"

export async function POST(request: Request): Promise<Response> {
  return await executeAuthenticatedApiRequest(
    request,
    createRecordCollectionHandler(
      async (input) => await getResearchRuntime().run((service) => service.readRecordCollection(input))
    )
  )
}
