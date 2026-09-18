import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, link, rm } from "node:fs/promises"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import * as cheerio from "cheerio"
import invariant from "tiny-invariant"
import { z } from "zod"
import { readBounded } from "../http-client.js"
import { frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { auditFrPdfBoundaries } from "./fr-pdf-boundaries.js"
import { frPdfLocation } from "./fr-reconciliation.js"
import { frSubjectKey } from "./fr-subject.js"
import { RegulatorySourceClient } from "./source-client.js"

export class FrHtmlSubjectMismatch extends Error {
  constructor() {
    super("fr_html_subject_mismatch")
    this.name = "FrHtmlSubjectMismatch"
  }
}

export function parseFrHtml(body: string, recordValue: unknown) {
  const record = frMetadataRecordSchema.parse(recordValue)
  const number = normalizeFrDocumentNumber(record.document_number)
  const $ = cheerio.load(body)
  invariant($("pre").length === 1 && $("pre script, pre style").length === 0, "fr_html_unexpected_structure")
  const text = $("pre").text().replaceAll("\r\n", "\n").trim()
  const headers = [...text.matchAll(/^\[FR Doc No:\s*([^\]]+)\]\s*$/gm)]
  invariant(headers.length === 1 && headers[0]?.[1] === number, "fr_html_document_identity_mismatch")
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${record.publication_date}T00:00:00Z`))
  invariant(
    text.startsWith(`[Federal Register Volume ${record.volume}, Number `) &&
      text.split("\n")[0]?.endsWith(`(${dateLabel})]`),
    "fr_html_publication_date_mismatch"
  )
  const pages = /^\[Pages? (\d+)(?:-(\d+))?\]\s*$/m.exec(text)
  invariant(
    pages && Number(pages[1]) === record.start_page && Number(pages[2] ?? pages[1]) === record.end_page,
    "fr_html_page_range_mismatch"
  )
  const kind = {
    Rule: "Rules and Regulations",
    "Proposed Rule": "Proposed Rules",
    Notice: "Notices",
    "Presidential Document": null,
    "Uncategorized Document": null
  }[record.type]
  invariant(
    kind !== null && text.split("\n").some((line) => line.trim() === `[${kind}]`),
    "fr_html_publication_kind_mismatch"
  )
  // Publisher metadata can mix one document's title/pages with another's body when numbers collide.
  // Compare the subject area only; a reference to the metadata title later in the body is not identity evidence.
  const subjectEnd = text.search(/^\s*(?:AGENCY|ACTION|SUMMARY):/m)
  const subjectArea = text.slice(0, subjectEnd >= 0 ? subjectEnd : 4096)
  if (!frSubjectKey(subjectArea).includes(frSubjectKey(record.title))) {
    throw new FrHtmlSubjectMismatch()
  }
  const boundaries = auditFrPdfBoundaries(text, number)
  invariant(
    boundaries.expectedFooterFound && boundaries.foreignDocumentNumbers.length === 0,
    "fr_html_publication_boundary_mismatch"
  )
  return {
    text,
    textHash: digest(text),
    documentNumber: number,
    publicationDate: record.publication_date,
    startPage: record.start_page,
    endPage: record.end_page,
    publicationKind: record.type,
    boundaryEvidence: "publisher_document_header_and_footer",
    canonicalWrites: false,
    publicationReady: false
  }
}

const receiptSchema = z.strictObject({
  sourceUrl: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z
    .int()
    .min(1)
    .max(8 * 1024 * 1024),
  acquiredAt: z.iso.datetime(),
  contentType: z.string()
})

/** The HTML location is a deterministic candidate derived from a validated official PDF locator, then checked by content. */
export async function acquireFrHtmlEvidence(
  input: { record: unknown; metadataManifestId: string; directory: string },
  client = new RegulatorySourceClient()
) {
  const record = frMetadataRecordSchema.parse(input.record)
  const manifestId = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.metadataManifestId)
  invariant(record.pdf_url, "fr_html_pdf_locator_missing")
  const number = normalizeFrDocumentNumber(record.document_number)
  const pdfUrl = frPdfLocation(record.pdf_url, number, record.publication_date)
  const sourceUrl = pdfUrl.replace(`/pdf/${number}.pdf`, `/html/${number}.htm`)
  const key = digest(sourceUrl)
  const receiptPath = join(input.directory, "receipts", `${key}.json`)
  for (const folder of ["receipts", "blobs", "temporary"]) {
    await mkdir(join(input.directory, folder), { recursive: true })
  }
  async function retain(target: string, bytes: Uint8Array) {
    const temporary = join(input.directory, "temporary", randomUUID())
    try {
      await writeFile(temporary, bytes, { flag: "wx", flush: true })
      try {
        await link(temporary, target)
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
          throw error
        }
        invariant(digest(await readFile(target)) === digest(bytes), "fr_html_immutable_conflict")
      }
    } finally {
      await rm(temporary, { force: true })
    }
  }
  let receipt: z.infer<typeof receiptSchema>
  let bytes: Uint8Array
  let reused = false
  let saved: string | null = null
  try {
    saved = await readFile(receiptPath, "utf8")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  if (saved !== null) {
    receipt = receiptSchema.parse(JSON.parse(saved))
    invariant(receipt.sourceUrl === sourceUrl, "fr_html_receipt_scope_mismatch")
    bytes = await readFile(join(input.directory, "blobs", `${receipt.sha256}.htm`))
    invariant(bytes.length === receipt.bytes && digest(bytes) === receipt.sha256, "fr_html_source_hash_mismatch")
    reused = true
  } else {
    const response = await client.response("govinfo-fr", sourceUrl, "text/html")
    const contentType = response.headers.get("content-type") ?? ""
    if (!/^text\/html(?:;|$)/i.test(contentType)) {
      await response.body?.cancel()
      throw new Error("fr_html_content_type_mismatch")
    }
    bytes = await readBounded(response, 8 * 1024 * 1024)
    receipt = receiptSchema.parse({
      sourceUrl,
      sha256: digest(bytes),
      bytes: bytes.length,
      acquiredAt: new Date().toISOString(),
      contentType
    })
    await retain(join(input.directory, "blobs", `${receipt.sha256}.htm`), bytes)
    await retain(receiptPath, Buffer.from(JSON.stringify(receipt)))
  }
  return {
    contract: "fr-html-rendition-2026-09-14",
    metadataManifestId: manifestId,
    metadataRecordHash: digest(JSON.stringify(record)),
    receipt,
    bytes,
    reused
  }
}

export async function acquireFrHtml(
  input: { record: unknown; metadataManifestId: string; directory: string },
  client = new RegulatorySourceClient()
) {
  const { bytes, ...evidence } = await acquireFrHtmlEvidence(input, client)
  return { ...evidence, parsed: parseFrHtml(new TextDecoder("utf-8", { fatal: true }).decode(bytes), input.record) }
}
