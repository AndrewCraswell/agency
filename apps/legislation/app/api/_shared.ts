import { executeNextHttpApiHandler } from "../../src/api/next/node-handler"

export async function notFoundResponse(request: Request): Promise<Response> {
  return await executeNextHttpApiHandler(request, async () => false)
}
