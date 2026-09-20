import { LegislationError } from "@repo/legislation-core/domain/errors"
import type {
  CanonicalDocumentDetailRead,
  CanonicalDocumentRead
} from "../../legislation/persistence/queries/document-reads"
import { projectDocumentDetail, projectDocumentSummary } from "./canonical-projection"
import { sourceProjectionContext } from "./canonical-read"

export function projectDocumentSummaryRead(value: CanonicalDocumentRead, apiBaseUrl: string) {
  assertCanonicalDocumentStatuses(value)
  return projectDocumentSummary(
    {
      ...value,
      mimeType: value.mimeType
    },
    sourceProjectionContext(value, apiBaseUrl)
  )
}

export function projectDocumentDetailRead(value: CanonicalDocumentDetailRead, apiBaseUrl: string) {
  assertCanonicalDocumentStatuses(value)
  return projectDocumentDetail(
    {
      ...value,
      mimeType: value.mimeType
    },
    sourceProjectionContext(value, apiBaseUrl)
  )
}

function assertCanonicalDocumentStatuses(value: Pick<CanonicalDocumentRead, "ocrStatus" | "processingStatus">): void {
  if (
    value.ocrStatus !== "not-required" &&
    value.ocrStatus !== "pending" &&
    value.ocrStatus !== "processing" &&
    value.ocrStatus !== "processed" &&
    value.ocrStatus !== "failed" &&
    value.ocrStatus !== "unsupported"
  ) {
    throw new LegislationError("unprocessable", "Document OCR status is not canonical")
  }
  if (
    value.processingStatus !== "pending" &&
    value.processingStatus !== "processing" &&
    value.processingStatus !== "processed" &&
    value.processingStatus !== "failed" &&
    value.processingStatus !== "unsupported"
  ) {
    throw new LegislationError("unprocessable", "Document processing status is not canonical")
  }
}
