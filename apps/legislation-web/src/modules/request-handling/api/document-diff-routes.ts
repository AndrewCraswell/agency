import type { IncomingMessage } from "node:http"
import { createDocumentComparisonPage, parseDocumentComparisonRequest } from "../../legislation/document-comparison"
import type { DocumentDiffRead } from "../../legislation/persistence/queries/document-diff-read"
import { projectDocumentSummaryRead } from "./document-read-routes"
import {
  apiResource,
  assertAllowedQueryParameters,
  readJsonBody,
  requestUrl,
  sendApiError,
  sendApiJson,
  type HttpApiHandler
} from "./http"

export interface DocumentDiffApi {
  readDocumentDiff: (
    input: Readonly<{ billId: string; leftDocumentId: string; rightDocumentId: string }>
  ) => Promise<DocumentDiffRead>
}

export function createDocumentDiffApiHandler(
  service: DocumentDiffApi,
  options: Readonly<{ apiBaseUrl: string }>
): HttpApiHandler {
  return async (request: IncomingMessage, response) => {
    const url = requestUrl(request)
    if (request.method !== "POST" || url.pathname !== "/api/document-diffs") {
      return false
    }
    try {
      assertAllowedQueryParameters(url, [])
      const input = parseDocumentComparisonRequest(await readJsonBody(request))
      const read = await service.readDocumentDiff(input)
      const comparison = createDocumentComparisonPage(read, input)
      sendApiJson(
        response,
        200,
        apiResource(request, {
          ...comparison,
          leftDocument: projectDocumentSummaryRead(read.left.document, options.apiBaseUrl),
          rightDocument: projectDocumentSummaryRead(read.right.document, options.apiBaseUrl)
        })
      )
    } catch (error) {
      sendApiError(request, response, error)
    }
    return true
  }
}
