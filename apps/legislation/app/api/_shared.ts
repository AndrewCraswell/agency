import { executeAuthenticatedApiRequest } from "../../src/server/next/authenticated-api-request"

export async function notFoundResponse(request: Request): Promise<Response> {
  return await executeAuthenticatedApiRequest(request, async () => false)
}
