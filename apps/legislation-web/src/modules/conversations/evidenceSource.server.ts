import { createHash } from "node:crypto"
import type { Logger } from "@repo/legislation-core/observability/logger"
import { z } from "zod"
import { projectResearchEvidence, sourceUrlSchema, type EvidenceSourceContext } from "./evidence"

const renditionSchema = z.object({
  id: z.string().nullish(),
  documentId: z.string().nullish(),
  billId: z.string().nullish(),
  classification: z.string().nullish(),
  versionId: z.string().nullish(),
  versionCode: z.string().nullish(),
  documentDate: z.string().nullish(),
  sourceObservationId: z.string().nullish(),
  versionHash: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  url: z.string().nullish(),
  readableUrl: z.string().nullish(),
  contentType: z.string().nullish(),
  mimeType: z.string().nullish(),
  format: z.string().nullish()
})

type Rendition = z.infer<typeof renditionSchema>

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function evidenceId(identity: string) {
  const hash = digest(identity)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function sourceFormat(url: string, source: Rendition) {
  const extension = new URL(url).pathname.split(".").at(-1)?.toLowerCase()
  if (extension && ["xml", "json", "txt"].includes(extension)) {
    return extension
  }
  const format = (source.mimeType ?? source.contentType ?? source.format ?? "").split(";")[0]?.trim().toLowerCase()
  if (format && ["application/xml", "text/xml", "application/json", "text/plain", "plain_text"].includes(format)) {
    return format.split("/").at(-1) ?? "unknown"
  }
  if (format && ["text/html", "application/xhtml+xml", "html", "formatted text"].includes(format)) {
    return "html"
  }
  if (format === "application/pdf" || format === "pdf") {
    return "pdf"
  }
  if (extension && ["html", "htm", "xhtml"].includes(extension)) {
    return "html"
  }
  return extension === "pdf" ? "pdf" : "unknown"
}

function readableSource(source: Rendition) {
  const explicit = sourceUrlSchema.safeParse(source.readableUrl)
  if (
    explicit.success &&
    !["xml", "json", "txt"].includes(sourceFormat(explicit.data, {})) &&
    (source.id || source.documentId || source.versionId || source.sourceObservationId)
  ) {
    return { url: explicit.data, rank: sourceFormat(explicit.data, {}) === "pdf" ? 1 : 0 }
  }
  const url = sourceUrlSchema.safeParse(source.sourceUrl ?? source.url)
  if (!url.success) {
    return undefined
  }
  const format = sourceFormat(url.data, source)
  if (format !== "html" && format !== "pdf") {
    return undefined
  }
  return { url: url.data, rank: format === "html" ? 0 : 1 }
}

function sameVersion(source: Rendition, candidate: Rendition) {
  for (const field of [
    "billId",
    "versionId",
    "sourceObservationId",
    "versionHash",
    "versionCode",
    "documentDate"
  ] as const) {
    if ((source[field] ?? null) !== (candidate[field] ?? null)) {
      return false
    }
  }
  const documentId = source.documentId ?? source.id
  if (documentId && documentId === (candidate.documentId ?? candidate.id)) {
    return true
  }
  if (source.versionId && source.versionId === candidate.versionId) {
    return true
  }
  return Boolean(
    source.billId &&
    source.billId === candidate.billId &&
    source.classification === "version" &&
    candidate.classification === "version" &&
    source.versionCode &&
    source.versionCode === candidate.versionCode &&
    source.documentDate &&
    source.documentDate === candidate.documentDate
  )
}

function samePublisher(sourceUrl: string | null | undefined, candidateUrl: string) {
  const source = sourceUrlSchema.safeParse(sourceUrl)
  if (!source.success) {
    return false
  }
  const sourceHost = new URL(source.data).hostname
  const candidateHost = new URL(candidateUrl).hostname
  const federalHosts = new Set(["www.congress.gov", "congress.gov", "www.govinfo.gov", "govinfo.gov"])
  return sourceHost === candidateHost || (federalHosts.has(sourceHost) && federalHosts.has(candidateHost))
}

function retainedRenditions(source: EvidenceSourceContext) {
  const own = renditionSchema.parse(source)
  const renditions = [own]
  for (const value of source.renditions ?? []) {
    const parsed = renditionSchema.safeParse(value)
    if (!parsed.success) {
      continue
    }
    const candidate = {
      ...own,
      ...parsed.data,
      sourceUrl: parsed.data.sourceUrl ?? parsed.data.url,
      readableUrl: parsed.data.readableUrl,
      contentType: parsed.data.contentType,
      mimeType: parsed.data.mimeType,
      format: parsed.data.format
    }
    if (sameVersion(own, candidate)) {
      renditions.push(candidate)
    }
  }
  return renditions
}

export function createResearchEvidenceProjector(
  logger: Logger,
  runId: string,
  previousReferences: readonly string[] = []
) {
  const reported = new Set<string>()
  const retained = new Map<string, Rendition>()
  const references = new Map<string, string>()
  let nextReference = 1n
  for (const reference of previousReferences) {
    if (/^e[1-9][0-9]{0,30}$/.test(reference)) {
      const next = BigInt(reference.slice(1)) + 1n
      if (next > nextReference) {
        nextReference = next
      }
    }
  }
  return (data: unknown) => {
    let hasIndexedSources = false
    const snapshots = projectResearchEvidence(data, evidenceId, (evidence, source, sources) => {
      if (!hasIndexedSources) {
        hasIndexedSources = true
        for (const context of sources) {
          for (const rendition of retainedRenditions(context)) {
            if (retained.size < 1600 && readableSource(rendition)) {
              retained.set(digest(JSON.stringify(rendition)), rendition)
            }
          }
        }
      }
      const candidates = [...retained.values()].flatMap((candidate) => {
        const readable = readableSource(candidate)
        if (
          !readable ||
          !sameVersion(source, candidate) ||
          (candidate.readableUrl !== readable.url && !samePublisher(evidence.sourceUrl, readable.url))
        ) {
          return []
        }
        return [readable]
      })
      candidates.sort((left, right) => left.rank - right.rank || left.url.localeCompare(right.url))
      const readable = candidates[0]
      if (readable) {
        return { ...evidence, readableUrl: readable.url }
      }
      if (!reported.has(evidence.id)) {
        reported.add(evidence.id)
        const sourceUrl = sourceUrlSchema.safeParse(evidence.sourceUrl)
        let reason = "no_readable_rendition"
        if (!sourceUrl.success) {
          reason = "no_safe_source"
        } else if (source.readableUrl || source.renditions?.length) {
          reason = "unverified_readable_rendition"
        }
        const documentId = source.documentId ?? source.materialId ?? source.provisionId ?? source.id
        logger.warn("Readable evidence source fallback", {
          event: "evidence_readable_source_fallback",
          runId,
          evidenceId: evidence.id,
          documentId: documentId ? `document:${digest(documentId)}` : undefined,
          reason,
          sourceHost: sourceUrl.success ? new URL(sourceUrl.data).hostname : undefined,
          sourceFormat: sourceUrl.success ? sourceFormat(sourceUrl.data, source) : "unknown"
        })
      }
      return evidence
    })
    return snapshots.map((evidence) => {
      let citationRef = references.get(evidence.id)
      if (!citationRef) {
        citationRef = `e${nextReference++}`
        references.set(evidence.id, citationRef)
      }
      return { ...evidence, citationRef }
    })
  }
}
