import { createHash } from "node:crypto"
import type { IncomingMessage } from "node:http"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { z } from "zod"
import type { CanonicalDocumentRead } from "../../legislation/persistence/queries/document-reads"
import { buildDocumentDiff, type DiffGranularity, type DiffHunk, type DiffSection } from "./document-diff"
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
  readDocumentDiff: (input: Readonly<{ billId: string; leftDocumentId: string; rightDocumentId: string }>) => Promise<{
    left: { document: CanonicalDocumentRead; sections: readonly DiffSection[] }
    right: { document: CanonicalDocumentRead; sections: readonly DiffSection[] }
  }>
}

const identifier = z.string().trim().min(1).max(256)
const requestSchema = z
  .object({
    billId: identifier,
    cursor: z.string().trim().min(1).max(2048).nullable().optional(),
    granularity: z.enum(["section", "paragraph", "word"]).optional(),
    includeUnchanged: z.boolean().optional(),
    leftDocumentId: identifier,
    limit: z.number().int().min(1).max(100).optional(),
    rightDocumentId: identifier
  })
  .strict()

type DiffRequest = z.infer<typeof requestSchema> & {
  granularity: DiffGranularity
  includeUnchanged: boolean
  limit: number
}

function binding(request: DiffRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        billId: request.billId,
        granularity: request.granularity,
        includeUnchanged: request.includeUnchanged,
        leftDocumentId: request.leftDocumentId,
        rightDocumentId: request.rightDocumentId
      })
    )
    .digest("base64url")
}

function decodeCursor(cursor: string | null | undefined, request: DiffRequest): number {
  if (cursor === null || cursor === undefined) {
    return 0
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof value !== "object" ||
      value === null ||
      !("binding" in value) ||
      !("offset" in value) ||
      !("version" in value) ||
      value.binding !== binding(request) ||
      typeof value.offset !== "number" ||
      !Number.isSafeInteger(value.offset) ||
      value.offset < 0 ||
      value.version !== 1
    ) {
      throw new Error("invalid cursor")
    }
    return value.offset
  } catch {
    throw new LegislationError("invalid_request", "cursor must be a valid document diff cursor")
  }
}

function encodeCursor(offset: number, request: DiffRequest): string {
  return Buffer.from(JSON.stringify({ binding: binding(request), offset, version: 1 })).toString("base64url")
}

function apiRequest(value: z.infer<typeof requestSchema>): DiffRequest {
  if (value.leftDocumentId === value.rightDocumentId) {
    throw new LegislationError("invalid_request", "leftDocumentId and rightDocumentId must differ")
  }
  return {
    ...value,
    granularity: value.granularity ?? "section",
    includeUnchanged: value.includeUnchanged ?? false,
    limit: value.limit ?? 100
  }
}

function publicHunks(hunks: readonly DiffHunk[]): DiffHunk[] {
  return hunks.map((hunk) => ({
    ...hunk,
    operations: hunk.operations.map((operation) => ({ ...operation })),
    sources: [...hunk.sources]
  }))
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
      const input = apiRequest(requestSchema.parse(await readJsonBody(request)))
      const offset = decodeCursor(input.cursor, input)
      const read = await service.readDocumentDiff(input)
      const leftDocument = projectDocumentSummaryRead(read.left.document, options.apiBaseUrl)
      const rightDocument = projectDocumentSummaryRead(read.right.document, options.apiBaseUrl)
      const diff = buildDocumentDiff({
        billId: input.billId,
        granularity: input.granularity,
        left: { document: leftDocument, sections: read.left.sections },
        right: { document: rightDocument, sections: read.right.sections }
      })
      const visible = input.includeUnchanged
        ? diff.allHunks
        : diff.allHunks.filter((hunk) => hunk.classification !== "unchanged")
      const items = visible.slice(offset, offset + input.limit)
      const hasNext = visible.length > offset + input.limit
      sendApiJson(
        response,
        200,
        apiResource(request, {
          billId: diff.billId,
          counts: diff.counts,
          granularity: diff.granularity,
          hunks: publicHunks(items),
          id: diff.id,
          leftDocument: diff.leftDocument,
          nextCursor: hasNext ? encodeCursor(offset + input.limit, input) : null,
          rightDocument: diff.rightDocument,
          truncated: hasNext
        })
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendApiError(
          request,
          response,
          new LegislationError("invalid_request", error.issues[0]?.message ?? "Invalid request")
        )
      } else if (error instanceof Error && error.message === "Document diff hunk exceeds the allowed size") {
        sendApiError(request, response, new LegislationError("payload_too_large", error.message))
      } else {
        sendApiError(request, response, error)
      }
    }
    return true
  }
}
