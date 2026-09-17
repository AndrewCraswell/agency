import { LegislationError } from "@repo/legislation-core/domain/errors"
import {
  recordCollectionSchema,
  recordResolutionSchema,
  type RecordCollectionInput,
  type RecordResolutionInput
} from "@repo/legislation-core/research/record-contracts"
import { apiResource, readJsonBody, requestUrl, sendApiError, sendApiJson, type HttpApiHandler } from "./http"

export function createRecordResolutionHandler(
  resolve: (input: RecordResolutionInput) => Promise<unknown>
): HttpApiHandler {
  return async (request, response) => {
    if (request.method !== "POST" || requestUrl(request).pathname !== "/api/records/resolve") {
      return false
    }
    try {
      const parsed = recordResolutionSchema.safeParse(await readJsonBody(request))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid record identity or scope")
      }
      sendApiJson(response, 200, apiResource(request, await resolve(parsed.data)))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}

export function createRecordCollectionHandler(
  read: (input: RecordCollectionInput) => Promise<unknown>
): HttpApiHandler {
  return async (request, response) => {
    if (request.method !== "POST" || requestUrl(request).pathname !== "/api/records/collection") {
      return false
    }
    try {
      const parsed = recordCollectionSchema.safeParse(await readJsonBody(request))
      if (!parsed.success) {
        throw new LegislationError("invalid_request", "Invalid record collection selection")
      }
      sendApiJson(response, 200, apiResource(request, await read(parsed.data)))
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
