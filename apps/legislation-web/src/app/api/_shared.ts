import { executeAuthenticatedApiRequest } from "../../modules/request-handling/next/authenticated-api-request"

export async function notFoundResponse(request: Request): Promise<Response> {
  return await executeAuthenticatedApiRequest(request, async () => false)
}
