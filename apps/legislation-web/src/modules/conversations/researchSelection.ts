import { LegislationError } from "@repo/legislation-core/domain/errors"
import { readResultPage, researchResultByteLimit } from "@repo/legislation-core/research/result-pages"
import { z } from "zod"
import { ResearchFailure, type ResearchFailureCode, type ResearchRecovery } from "./researchFailure"

type Input = Readonly<Record<string, unknown>>
type CursorField = "cursor" | "childCursor"
type DocumentSelection = { ids: string[]; billId?: string; versionCode?: string }
const documentSchema = z.object({
  id: z.string().min(1).max(512),
  billId: z
    .string()
    .max(512)
    .regex(/^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$/),
  versionCode: z.string().min(1).max(128).nullish()
})
type Document = NonNullable<ResearchRecovery["documents"]>[number]
const maximumSelections = 1600
const maximumRecoveryBytes = 32768

function documentSelection(name: string, input: Input): DocumentSelection | undefined {
  const billId = typeof input.billId === "string" ? input.billId : undefined
  if (name === "get_bill_text" || name === "get_document_sections") {
    return {
      ids: typeof input.documentId === "string" ? [input.documentId] : [],
      billId: name === "get_bill_text" && typeof input.id === "string" ? input.id : undefined,
      versionCode: typeof input.versionCode === "string" ? input.versionCode : undefined
    }
  }
  if (name === "compare_bill_versions" || name === "search_bill_text") {
    return { ids: z.array(z.string()).parse(input.documentIds ?? []), billId }
  }
  if (name === "read_record_collection" && input.collection === "document-sections") {
    return { ids: typeof input.recordId === "string" ? [input.recordId] : [] }
  }
  return undefined
}

function matchesContinuation(name: string, input: Input) {
  try {
    readResultPage(name, input)
    return true
  } catch (error) {
    if (error instanceof LegislationError && error.category === "invalid_request") {
      return false
    }
    throw error
  }
}

function suppliedCursors(input: Input) {
  return (["cursor", "childCursor"] as const).filter((field) => typeof input[field] === "string")
}

export function createResearchSelections() {
  const cursors = new Map<string, CursorField>()
  const documents = new Map<string, Document>()
  const offeredRecoveries = new Set<string>()

  function register(data: unknown, reference: string, consumed?: { tool: string; input: Input }) {
    const nextCursors = new Map(cursors)
    const nextDocuments = new Map(documents)
    if (consumed && typeof consumed.input.cursor === "string") {
      const page = readResultPage(consumed.tool, consumed.input)
      if (
        page.fragment ||
        (typeof page.input.cursor === "string" && page.input.cursor.startsWith("research-evidence:"))
      ) {
        nextCursors.delete(consumed.input.cursor)
      }
    }
    function visit(value: unknown, parent?: string) {
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item, parent)
        }
      } else if (value !== null && typeof value === "object") {
        const record = z.record(z.string(), z.unknown()).parse(value)
        let id: string | undefined
        if (typeof record.documentId === "string") {
          id = record.documentId
        } else if (
          typeof record.id === "string" &&
          (parent === "document" || parent === "documents" || /(^document:|:document:)/.test(record.id))
        ) {
          id = record.id
        }
        const parsed = documentSchema.safeParse({ ...record, id })
        if (parsed.success) {
          const document: Document = {
            id: parsed.data.id,
            billId: parsed.data.billId,
            ...(parsed.data.versionCode ? { versionCode: parsed.data.versionCode } : {})
          }
          const previous = nextDocuments.get(document.id)
          if (
            previous &&
            (previous.billId !== document.billId ||
              (previous.versionCode && document.versionCode && previous.versionCode !== document.versionCode))
          ) {
            throw new ResearchFailure("invalid_response", reference)
          }
          nextDocuments.set(document.id, { ...previous, ...document })
        }
        for (const [key, item] of Object.entries(record)) {
          if ((key === "nextCursor" || key === "nextChildCursor") && typeof item === "string" && item.length > 0) {
            nextCursors.set(item, key === "nextCursor" ? "cursor" : "childCursor")
          } else {
            visit(item, key)
          }
        }
      }
    }
    visit(data)
    if (
      nextCursors.size + nextDocuments.size > maximumSelections ||
      Buffer.byteLength(JSON.stringify([[...nextCursors], [...nextDocuments.values()]]), "utf8") >
        researchResultByteLimit
    ) {
      throw new ResearchFailure("result_limit", reference)
    }
    cursors.clear()
    documents.clear()
    for (const [cursor, field] of nextCursors) {
      cursors.set(cursor, field)
    }
    for (const [id, document] of nextDocuments) {
      documents.set(id, document)
    }
  }

  function validate(name: string, input: Input, reference: string) {
    const fields = suppliedCursors(input)
    if (
      fields.length > 0 &&
      (fields.some((field) => cursors.get(String(input[field])) !== field) || !matchesContinuation(name, input))
    ) {
      throw new ResearchFailure("invalid_cursor", reference)
    }
    const selection = documentSelection(name, input)
    for (const id of selection?.ids ?? []) {
      const document = documents.get(id)
      if (
        document &&
        ((selection?.billId && document.billId !== selection.billId) ||
          (selection?.versionCode && document.versionCode && document.versionCode !== selection.versionCode))
      ) {
        throw new ResearchFailure("invalid_request", reference)
      }
    }
  }

  function recover(name: string, input: Input, code: ResearchFailureCode): ResearchRecovery | undefined {
    const selection = documentSelection(name, input)
    const isDocumentFailure =
      selection &&
      selection.ids.length > 0 &&
      (code === "invalid_request" ||
        code === "not_found" ||
        (code === "internal" && selection.ids.some((id) => !documents.has(id))))
    if (code !== "invalid_cursor" && !isDocumentFailure) {
      return undefined
    }
    const recoveryKey = JSON.stringify([
      name,
      code,
      Object.entries(input).sort(([left], [right]) => left.localeCompare(right))
    ])
    if (offeredRecoveries.has(recoveryKey)) {
      return {
        action: "answer",
        instruction:
          "Recovery for this exact failed selection has already been offered. Do not repeat this unchanged failed call. Use verified evidence or a different explicitly returned selection, and identify incomplete coverage. Empty or heading-only text does not establish absent duties."
      }
    }
    offeredRecoveries.add(recoveryKey)
    let recovery: ResearchRecovery
    if (code === "invalid_cursor") {
      const fields = suppliedCursors(input)
      const field = fields.length === 1 ? fields[0] : undefined
      const selectionInput = Object.fromEntries(
        Object.entries(input).filter(([key]) => key !== "cursor" && key !== "childCursor")
      )
      const supplied = field ? input[field] : undefined
      const knownField = typeof supplied === "string" ? cursors.get(supplied) : undefined
      const candidates = [...cursors].filter(
        ([value, candidateField]) =>
          fields.length === 1 &&
          (knownField ? value === supplied : field === candidateField) &&
          matchesContinuation(name, { ...selectionInput, [candidateField]: value })
      )
      const candidate = candidates.length === 1 ? candidates[0] : undefined
      recovery =
        candidate && Buffer.byteLength(candidate[0], "utf8") < maximumRecoveryBytes / 2
          ? {
              action: "select_returned",
              instruction:
                "One returned continuation matches this tool and all unchanged non-cursor inputs. Remove cursor and childCursor, then copy this value byte-for-byte into only the indicated field if it is the intended page. Do not change the source, version, filters or limit. Do not repeat an unchanged failed call.",
              continuation: { field: candidate[1], value: candidate[0] }
            }
          : {
              action: "restart",
              instruction:
                "No unique returned continuation matches this request. Make at most one recovery call: restart this same tool without cursor or childCursor, retaining every other input. Do not reconstruct a token or switch documents or versions."
            }
    } else {
      const knownDocument = selection?.ids.length === 1 ? documents.get(selection.ids[0] ?? "") : undefined
      if (
        name === "get_bill_text" &&
        knownDocument?.versionCode &&
        knownDocument.billId === selection?.billId &&
        selection.versionCode &&
        knownDocument.versionCode !== selection.versionCode
      ) {
        return {
          action: "select_returned",
          instruction:
            "This exact returned document belongs to the requested bill but its versionCode differs from the supplied value. Verify that this is the intended version, then copy this document ID and its returned versionCode exactly. Do not substitute another document or infer that a shorthand version label is equivalent. If this is not the intended version, resolve that version explicitly before reading.",
          documents: [knownDocument]
        }
      }
      const candidates =
        name === "get_bill_text" && selection?.ids.length === 1 && !documents.has(selection.ids[0] ?? "")
          ? [...documents.values()].filter(
              (document) =>
                document.billId === selection.billId &&
                (!selection.versionCode || document.versionCode === selection.versionCode)
            )
          : []
      recovery =
        candidates.length > 0 && candidates.length <= 3
          ? {
              action: "select_returned",
              instruction:
                "These are exact returned document choices for the requested bill and version filter, not automatic corrections. Select only the intended source/version; if that is uncertain, resolve the document instead. Copy its ID unchanged, retain all other filters, and make at most one recovery call.",
              documents: candidates
            }
          : {
              action: "resolve_document",
              instruction:
                "Do not guess a replacement ID or version. Make at most one recovery call: resolve_record with kind document and the explicit ID, or read_record_collection with collection bill-documents and the intended bill's exact recordId. If no exact choice is established, answer with the read limitation."
            }
    }
    return recovery
  }

  return { register, validate, recover }
}
